/**
 * 워크스페이스 호스트 — 고객 CI(와 `npx`)가 쓰는 스냅샷 로더. Node 전용이라
 * 패키지 루트가 아니라 `graduand/workspace` 서브패스로만 노출된다.
 *
 * 입력은 **워크스페이스뿐**이다 — 네트워크를 쓰지 않고, 비공개 자산을 읽지 않는다.
 *
 * 표본은 git 이 추적하는 파일이다. 디스크를 걸으면 빌드 산출물·워크트리 잔해가 섞여
 * 수가 흔들리고, 추적되지 않는 파일은 클론한 사람에게 없는 파일이다. git 작업 트리가
 * 아니면 추정으로 걷지 않고 **판정 불가**로 멈춘다 — 부재를 「위반 0」으로 세지 않는
 * 규율과 같은 모양이다.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { needsContent, RepoUnreadableError, type RepoSnapshot } from '../snapshot.ts';
import {
  declaredCanons,
  declaredAxisFiles,
  DECLARATION_FILE,
  type CanonPointer,
} from '../declaration.ts';

export interface WorkspaceLoad {
  snapshot: RepoSnapshot;
  source: 'workspace';
  /** 미커밋 변경 파일 수. 알 수 없으면 null — 0 으로 바꾸지 않는다. */
  dirty: number | null;
}

/** `https://…/owner/name(.git)` · `git@host:owner/name(.git)` → `owner/name`. */
function repoFromRemote(url: string): string | null {
  const tail = url
    .replace(/\.git\/?$/, '')
    .replace(/^[a-z+]+:\/\/[^/]+\//i, '')
    .replace(/^[^@]+@[^:]+:/, '');
  const segs = tail.split('/').filter(Boolean);
  if (segs.length < 2) return null;
  return `${segs[segs.length - 2]}/${segs[segs.length - 1]}`;
}

/**
 * @param root 체크아웃의 루트. 여러 체크아웃을 보는 잡은 root 마다 한 번 부른다
 *             (`loadWorkspaces`) — 판정은 스냅샷을 받을 뿐이라 그 위에 새 호스트가 없다.
 * @param alsoContent 본문을 더 실을 **추적되는** 경로. 다른 체크아웃의 선언이 이 저장소를
 *                    정본으로 지목했을 때 그 파일이 여기 온다 — 지목은 **남의 선언**에
 *                    적혀 있어 이 저장소의 선언만 보고는 알 수 없다. 추적되지 않는 경로는
 *                    실리지 않는다(표본은 여전히 git 이 추적하는 파일이다).
 */
export function loadWorkspaceSnapshot(root = '.', alsoContent: readonly string[] = []): WorkspaceLoad {
  // `--no-optional-locks` — 읽기가 대상의 index 를 다시 쓰게 두지 않는다. 판정은 읽기 전용이다.
  const git = (...args: string[]) =>
    spawnSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8' });

  // `-z` — 없으면 git 이 비ASCII 파일명을 8진 이스케이프로 인용해 돌려주고, 그 문자열로
  // 열면 실패한다. 그 실패는 조용한 과소 집계가 아니라 잘림으로 보고되지만, 애초에
  // 멀쩡한 파일명을 잘림으로 만들 이유가 없다.
  const tracked = git('ls-files', '-z');
  if (tracked.status !== 0) {
    throw new RepoUnreadableError(
      'not-a-git-worktree',
      `${root}: not a git work tree — refusing to guess at the sample (absence is not "0 violations")`,
    );
  }
  const paths = tracked.stdout.split('\0').filter(Boolean).sort();

  const head = git('rev-parse', 'HEAD');
  if (head.status !== 0) {
    throw new RepoUnreadableError('no-commit', `${root}: no commit to judge (git rev-parse HEAD failed)`);
  }
  const commit = head.stdout.trim();

  const remote = git('remote', 'get-url', 'origin');
  const repo = remote.status === 0 ? repoFromRemote(remote.stdout.trim()) : null;

  const status = git('status', '--porcelain');
  const dirty = status.status === 0 ? status.stdout.split('\n').filter(Boolean).length : null;

  const files = new Map<string, string | null>();
  const read = (path: string): void => {
    try {
      files.set(path, readFileSync(join(root, path), 'utf8'));
    } catch {
      files.set(path, null); // 조용히 건너뛰지 않는다 — 못 읽은 것은 잘림이다.
    }
  };

  // 선언 파일을 먼저 읽는다 — 어댑터가 읽을 파일(축 전부의 `files`)은 선언이 지목하므로,
  // 본문을 실을 목록이 선언에 의존한다. 깨진 선언이면 더 싣지 않는다(판정 층이 멈춘다).
  if (paths.includes(DECLARATION_FILE)) read(DECLARATION_FILE);
  const declText = files.get(DECLARATION_FILE);
  const declared = new Set([
    ...(typeof declText === 'string' ? declaredAxisFiles(declText) : []),
    ...alsoContent,
  ]);

  for (const path of paths) {
    if (files.has(path)) continue;
    if (!needsContent(path) && !declared.has(path)) continue;
    read(path);
  }

  return { snapshot: { repo, commit, paths, files }, source: 'workspace', dirty };
}

/**
 * 한 잡이 체크아웃 **N개**를 보는 모양 — 교차 축(「박제 == 정본」)이 설 수 있는 유일한
 * 표면이다. root 마다 `loadWorkspaceSnapshot` 을 부르는 것이 전부다: 저장소를 새로 받아오는
 * 경로도, 판정을 정본에 취합하는 쓰기 권한도 여기 없다.
 *
 * 2회차가 있는 이유: 정본 포인터는 **소비 저장소의 선언**에 적혀 있어서, 정본 저장소의
 * 로더는 1회차에 「내 파일 하나가 남의 정본이다」를 알 수 없다. 1회차로 선언들을 읽어
 * 지목을 모으고, 지목된 파일이 아직 안 실린 체크아웃만 다시 읽는다 — 추측으로 더 읽지
 * 않고, 지목이 없으면 2회차도 없다.
 *
 * @param intended 아직 **선언에 없는** 지목. ⭐ 헌법 조립의 `link` 가 여기 온다 — 그
 *        포인터는 명령줄에 있고 선언에는 아직 없으므로(그 선언을 **짓는** 중이다) 1회차의
 *        선언 읽기로는 알 수 없다. ⛔ 그래도 추측은 늘지 않는다: 실리는 것은 **지목된
 *        경로 하나**이고, 추적되지 않는 경로는 여전히 실리지 않는다.
 */
export function loadWorkspaces(
  roots: readonly string[],
  intended: readonly CanonPointer[] = [],
): WorkspaceLoad[] {
  const first = roots.map((root) => ({ root, load: loadWorkspaceSnapshot(root) }));

  // 정본으로 지목된 저장소 → 그 저장소에서 읽어야 하는 파일. 주소(`repo`)를 읽지 못한
  // 체크아웃은 지목될 수 없다 — 이름이 없으면 포인터와 맞출 자리가 없다.
  const wanted = new Map<string, Set<string>>();
  const want = (repo: string, file: string): void => {
    const at = wanted.get(repo) ?? new Set<string>();
    at.add(file);
    wanted.set(repo, at);
  };
  for (const canon of intended) want(canon.repo, canon.file);
  for (const { load } of first) {
    const text = load.snapshot.files.get(DECLARATION_FILE);
    // ⭐ 지목이 **축마다 하나**라서 목록이다 — 축이 여럿이면 한 선언이 서로 다른 저장소
    //   여럿을 가리킬 수 있고(디자인 정본과 API 정본이 다른 상류에 산다), 첫 하나만
    //   따라가면 나머지 축은 「정본이 시야에 없다」로 영원히 미판정이 된다.
    for (const { canon } of declaredCanons(typeof text === 'string' ? text : null)) {
      want(canon.repo, canon.file);
    }
  }

  return first.map(({ root, load }) => {
    const repo = load.snapshot.repo;
    const extra = [...(repo === null ? [] : (wanted.get(repo) ?? []))].filter(
      (path) => !load.snapshot.files.has(path),
    );
    return extra.length === 0 ? load : loadWorkspaceSnapshot(root, extra);
  });
}
