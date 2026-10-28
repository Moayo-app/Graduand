/**
 * 저장소 스냅샷 — 판정의 유일한 입력.
 *
 * 판정기는 I/O 를 하지 않는다. 워크스페이스(고객 CI)든 GitHub API(브라우저)든,
 * 호스트가 **같은 모양의 스냅샷**을 만들어 넘기고 판정은 그 위에서 순수하게 돈다.
 * 두 표면이 같은 커밋에서 같은 바이트의 판정을 내는 것은 이 구조가 보장한다 —
 * 판정 코드에 분기가 없으면 갈라질 자리도 없다.
 *
 * 표본은 **추적되는 파일**이다(워크스페이스는 git index, API 는 커밋의 tree).
 * 디스크에 있어도 추적되지 않는 파일은 클론한 사람에게 없는 파일이고, 판정의 약속은
 * 「클론한 사람이 따라갈 수 있는가」다.
 */

export interface RepoSnapshot {
  /** `owner/name`. 대상에서 읽지 못했으면 null. */
  repo: string | null;
  /** 판정 대상 커밋의 전체 SHA. */
  commit: string;
  /** 추적되는 파일 전부 (저장소 루트 기준 상대 경로, 정렬됨). 존재 판정의 분모다. */
  paths: string[];
  /**
   * 판정이 본문을 읽어야 하는 파일의 내용 — 마크다운 · 선언 파일, 그리고 선언이
   * 지목한 공유값 파일(축 전부의 `files` — 호스트가 선언을 먼저 읽고 싣는다).
   * **null = 읽기 실패.** 조용히 건너뛰지 않는다 — 못 읽은 것은 잘림이고,
   * 잘림 위에서는 수를 내지 않는다.
   */
  files: Map<string, string | null>;
}

/**
 * 스냅샷이 언제나 본문까지 실어야 하는 파일인가 — 마크다운과 선언 파일.
 * 선언이 지목하는 팔레트 파일은 여기 없다: 그 목록은 선언의 내용이라 정적으로 알 수
 * 없고, 호스트가 선언을 읽은 뒤 `declaredAxisFiles` 로 더 싣는다.
 */
export const needsContent = (path: string): boolean =>
  path.endsWith('.md') || path === 'graduand.json';

/** 존재 색인 — 파일 집합과, 추적 파일이 함의하는 디렉터리 집합. */
export interface PathIndex {
  hasFile(path: string): boolean;
  hasDir(path: string): boolean;
  has(path: string): boolean;
}

export function indexPaths(paths: string[]): PathIndex {
  const files = new Set(paths);
  const dirs = new Set<string>();
  for (const p of paths) {
    let at = p.lastIndexOf('/');
    while (at > 0) {
      const dir = p.slice(0, at);
      if (dirs.has(dir)) break;
      dirs.add(dir);
      at = dir.lastIndexOf('/');
    }
  }
  const norm = (p: string) => p.replace(/\/+$/, '');
  return {
    hasFile: (p) => files.has(norm(p)),
    hasDir: (p) => dirs.has(norm(p)),
    has: (p) => files.has(norm(p)) || dirs.has(norm(p)),
  };
}

/** 대상 저장소를 읽을 수 없다 — 판정 불가(미판정과 다르다: 스냅샷 자체가 없다). */
export class RepoUnreadableError extends Error {
  readonly code: 'not-a-git-worktree' | 'no-commit' | 'private-or-missing' | 'tree-truncated';
  constructor(code: RepoUnreadableError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/** API 한도에 걸렸다 — 「문제 없음」과 구분해 보고할 수 있도록 리셋 시각을 싣는다. */
export class RateLimitedError extends Error {
  /** Unix epoch 초. 응답이 말하지 않았으면 null. */
  readonly resetAt: number | null;
  constructor(resetAt: number | null) {
    super(
      resetAt === null
        ? 'GitHub API rate limit exceeded'
        : `GitHub API rate limit exceeded — resets at ${new Date(resetAt * 1000).toISOString()}`,
    );
    this.resetAt = resetAt;
  }
}
