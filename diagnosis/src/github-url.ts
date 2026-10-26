/**
 * 공개 입구의 입력 해석 — 사용자가 적는 것을 `owner/name`(+선택 ref)으로 좁힌다.
 *
 * 받는 형태는 좁다: `owner/name` · `github.com/owner/name(.git)` ·
 * `…/tree/<ref>` · `…/blob/<ref>/…` (ref 만 취한다) · 앞에 http(s) 가 붙은 같은 것들.
 * 그 밖은 null — 추측으로 넓히지 않는다. 추측이 틀리면 「읽을 수 없음」이
 * 엉뚱한 이름으로 보고되고, 잘못된 대상에 대한 보고는 없느니만 못하다.
 */

export interface RepoRef {
  /** `owner/name`. */
  repo: string;
  /** 브랜치·태그·SHA. 없으면 기본 브랜치. */
  ref?: string;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoInput(raw: string): RepoRef | null {
  let text = raw.trim();
  if (text === '') return null;

  const protocol = text.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (protocol !== null) {
    const scheme = protocol[1]!.toLowerCase();
    if (scheme !== 'https' && scheme !== 'http') return null;
    text = text.slice(protocol[0].length);
  }
  text = text.split('#')[0]!.split('?')[0]!;

  const host = text.match(/^(www\.)?github\.com\//i);
  if (host !== null) {
    text = text.slice(host[0].length);
  } else if (protocol !== null) {
    return null; // github.com 밖의 URL 은 받지 않는다 — 로더의 호스트는 하나다.
  }

  const segments = text.split('/').filter((s) => s !== '');
  if (segments.length < 2) return null;

  const owner = segments[0]!;
  const name = segments[1]!.replace(/\.git$/, '');
  if (!OWNER.test(owner) || !NAME.test(name) || name === '.' || name === '..') return null;
  const repo = `${owner}/${name}`;

  if (segments.length === 2) return { repo };
  if (segments[2] === 'tree' && segments.length > 3) {
    // 브랜치 이름의 `/` 와 하위 경로를 URL 은 구분해 주지 않는다 — 나머지 전부를 ref 로 본다.
    return { repo, ref: segments.slice(3).join('/') };
  }
  if (segments[2] === 'blob' && segments.length > 3) {
    return { repo, ref: segments[3]! };
  }
  return null;
}
