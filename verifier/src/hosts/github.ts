/**
 * GitHub API 호스트 — 브라우저(진단 입구)가 쓰는 스냅샷 로더.
 *
 * - **무인증이다.** 토큰 입력은 설계로 받지 않는다 — PAT 붙여넣기를 가르치는 제품이
 *   되지 않는다. 공개 저장소는 필요한 것이 전부 무인증으로 읽히고, 비공개 저장소는
 *   「판정 불가」가 정직한 답이다(대안은 고객 쪽에서 도는 명령 경로다).
 * - **호스트는 `api.github.com` 하나다.** 판정 결과를 되쏘는 경로는 존재하지 않는다 —
 *   이 파일이 만드는 URL 전부가 그 한 호스트를 가리키고, 그것이 검증 가능한 주장이
 *   되도록 fetch 를 주입받는다.
 * - 한도 초과는 「문제 없음」이 아니라 별도 상태다: tree 를 얻기 전이면 판정 불가로
 *   던지고, 본문을 읽다 걸리면 그 파일들을 잘림으로 남겨 해당 체크가 미판정이 된다.
 */

import { needsContent, RateLimitedError, RepoUnreadableError, type RepoSnapshot } from '../snapshot.ts';
import { declaredPaletteFiles, DECLARATION_FILE } from '../declaration.ts';
import { fromBase64, utf8Decode } from '../bytes.ts';

export interface GithubLoadOptions {
  /** `owner/name`. */
  repo: string;
  /** 브랜치·태그·SHA. 생략하면 기본 브랜치. */
  ref?: string;
  /** 테스트와 호스트 관찰을 위해 주입 가능. 기본은 전역 fetch. */
  fetch?: typeof fetch;
}

export interface GithubLoad {
  snapshot: RepoSnapshot;
  source: 'github-api';
  /** github-api 는 커밋을 직접 읽으므로 dirty 는 항상 0 이다. */
  dirty: 0;
}

const API = 'https://api.github.com';

function rateLimited(rsp: Response): boolean {
  return (
    (rsp.status === 403 || rsp.status === 429) &&
    (rsp.headers.get('x-ratelimit-remaining') === '0' || rsp.headers.has('retry-after'))
  );
}

function resetOf(rsp: Response): number | null {
  const reset = rsp.headers.get('x-ratelimit-reset');
  if (reset !== null && /^\d+$/.test(reset)) return Number(reset);
  return null;
}

export async function loadGithubSnapshot(options: GithubLoadOptions): Promise<GithubLoad> {
  const doFetch = options.fetch ?? fetch;
  const get = async (path: string): Promise<Response> =>
    doFetch(`${API}${path}`, { headers: { accept: 'application/vnd.github+json' } });

  const need = async (path: string, what: string): Promise<unknown> => {
    const rsp = await get(path);
    if (rateLimited(rsp)) throw new RateLimitedError(resetOf(rsp));
    if (rsp.status === 404) {
      // 무인증 API 는 비공개와 부재를 구분해 주지 않는다 — 구분하는 척하지 않는다.
      throw new RepoUnreadableError('private-or-missing', `${what}: not readable without credentials — private, or does not exist`);
    }
    if (!rsp.ok) throw new Error(`${what}: GitHub API responded ${rsp.status}`);
    return rsp.json();
  };

  const repoInfo = (await need(`/repos/${options.repo}`, options.repo)) as {
    full_name: string;
    default_branch: string;
  };
  const ref = options.ref ?? repoInfo.default_branch;

  const commitInfo = (await need(
    `/repos/${options.repo}/commits/${encodeURIComponent(ref)}`,
    `${options.repo}@${ref}`,
  )) as { sha: string };

  const tree = (await need(
    `/repos/${options.repo}/git/trees/${commitInfo.sha}?recursive=1`,
    `${options.repo} tree`,
  )) as { truncated: boolean; tree: { path: string; type: string; sha: string }[] };

  if (tree.truncated) {
    // 잘린 tree 위에서는 존재 판정 자체가 거짓이 된다 — 미판정이 아니라 판정 불가다.
    throw new RepoUnreadableError('tree-truncated', `${options.repo}: tree listing truncated by the API — too large to judge over the API surface`);
  }

  const blobs = tree.tree.filter((e) => e.type === 'blob');
  const paths = blobs.map((e) => e.path).sort();

  const files = new Map<string, string | null>();
  let exhausted = false;
  const loadBlob = async (path: string, sha: string): Promise<void> => {
    if (exhausted) {
      files.set(path, null);
      return;
    }
    const rsp = await get(`/repos/${options.repo}/git/blobs/${sha}`);
    if (rateLimited(rsp)) {
      // 한도에 걸렸다 — 남은 본문은 잘림이다. 계속 두드리지 않는다.
      exhausted = true;
      files.set(path, null);
      return;
    }
    if (!rsp.ok) {
      files.set(path, null);
      return;
    }
    const blob = (await rsp.json()) as { content: string; encoding: string };
    if (blob.encoding !== 'base64') {
      files.set(path, null);
      return;
    }
    try {
      files.set(path, utf8Decode(fromBase64(blob.content)));
    } catch {
      files.set(path, null);
    }
  };

  // 선언 파일을 먼저 읽는다 — 어댑터가 읽을 파일(palette.files)은 선언이 지목한다.
  // 선언된 파일만 더 싣는 것은 비용이 아니라 한도 규율이다: 무인증 한도 아래에서
  // 저장소의 스타일시트 전부를 두드리는 로더는 큰 저장소를 전부 잘림으로 만든다.
  const declEntry = blobs.find((e) => e.path === DECLARATION_FILE);
  if (declEntry) await loadBlob(declEntry.path, declEntry.sha);
  const declText = files.get(DECLARATION_FILE);
  const declared = new Set(typeof declText === 'string' ? declaredPaletteFiles(declText) : []);

  for (const entry of blobs) {
    if (files.has(entry.path)) continue;
    if (!needsContent(entry.path) && !declared.has(entry.path)) continue;
    await loadBlob(entry.path, entry.sha);
  }

  return {
    snapshot: { repo: repoInfo.full_name, commit: commitInfo.sha, paths, files },
    source: 'github-api',
    dirty: 0,
  };
}
