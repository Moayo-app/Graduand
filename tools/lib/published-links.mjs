// 발행본의 링크 대조 — **발행본이 가리키는 것이 발행본 안에 실재하는가.**
//
// ⭐⭐ **왜 소스가 아니라 발행본인가.** 진단 패키지는 자기 참조를 이미 잰다(그쪽 AC6). 그런데
//    발행본을 짓는 손은 **둘**이다 — 진단 생성기와 정책 렌더러. 어느 쪽도 상대가 낸 파일을
//    보지 못하므로, 둘 사이의 이음매에는 아무 단정도 서지 않는다. 실제로 그 자리가 터졌다:
//    절반만 돌린 빌드가 정책 6벌 없는 발행본을 냈고, 그대로 올라가 **법정 게시 문서로 가는
//    푸터 링크가 전부 404** 가 됐다. 가드는 전부 초록이었다 — 아무도 발행본을 보지 않았으니까.
//
// ⛔ **네트워크를 타지 않는다.** 재는 것은 「이 트리 안에서 풀리는가」이고, 그래야 올리기
//    **전에** 답이 나온다. 올린 뒤에 `curl` 로 아는 것은 이미 고객이 먼저 아는 것이다.
//
// ⭐ 리다이렉트 선언이 **분모의 한쪽**이다 — `/portal/` 처럼 파일이 아닌 자리는 `_redirects`
//    가 든다. 그래서 선언 없는 루트 절대 경로를 화면이 가리키면 여기서 빨갛다.

/** 발행본이 거는 자리 — 속성 둘만 본다. ⛔ CSS `url()` 은 모집단 밖이다(꾸밈은 벌이 다르다). */
const LINK_ATTR = /\b(?:href|src)\s*=\s*"([^"]*)"/g;

/** 밖으로 나가는 꼴 — 스킴이 붙었거나 프로토콜 상대다. 이 대조가 책임지는 자리가 아니다. */
export const isOutbound = (href) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);

/** 한 문서가 거는 자리 전수 — 중복은 남긴다(어느 줄이 틀렸는지는 경로가 말한다). */
export const linksOf = (html) => [...html.matchAll(LINK_ATTR)].map((m) => m[1]);

const dirOf = (rel) => {
  const at = rel.lastIndexOf('/');
  return at === -1 ? '' : rel.slice(0, at + 1);
};

/** `a/b/../c` → `a/c`. ⛔ 트리 밖으로 나가는 `..` 은 그대로 둬 **풀리지 않게** 한다. */
const normalize = (p) => {
  const out = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.length > 0 && out[out.length - 1] !== '..' ? out.pop() : out.push('..');
    else out.push(part);
  }
  return out.join('/');
};

/**
 * 발행본 안의 **대상 경로** — 못 가리키는 것(조각만 · 밖)은 `null` 이다.
 *
 * ⭐ 디렉터리는 `index.html` 로 푼다 — 정적 서빙이 그렇게 내주고, 우리 루트·로케일 링크가
 * 전부 그 꼴이다. ⚠️ 질의와 조각은 떼고 본다: 파일을 고르는 것은 경로다.
 */
export function targetOf(fromRel, href) {
  if (href === '' || href.startsWith('#') || isOutbound(href)) return null;
  const bare = href.split('#')[0].split('?')[0];
  if (bare === '') return null;
  const rooted = bare.startsWith('/') ? bare.slice(1) : `${dirOf(fromRel)}${bare}`;
  const at = normalize(rooted);
  return bare.endsWith('/') || at === '' ? `${at}${at === '' ? '' : '/'}index.html` : at;
}

/** 리다이렉트가 받는 자리의 꼴 — 선언은 루트 절대 경로로 적힌다. */
const asRooted = (fromRel, href) => {
  const bare = href.split('#')[0].split('?')[0];
  return bare.startsWith('/') ? bare : `/${normalize(`${dirOf(fromRel)}${bare}`)}${bare.endsWith('/') ? '/' : ''}`;
};

/**
 * 판정 — 순수하다. 트리를 **받는다**(읽는 손은 check-published-links.mjs).
 *
 * @param pages     `{ [발행 경로]: html }` — 링크를 거는 문서 전수.
 * @param files     발행본에 실재하는 경로 전수(Set).
 * @param redirects 리다이렉트 선언이 받는 자리 전수(Set, `/portal/` 꼴).
 * @returns `{ errors, checked }` — ⭐ `checked` 가 분모다: 0 이면 아무것도 재지 않은 초록이다.
 */
export function judgeLinks(pages, files, redirects) {
  const errors = [];
  let checked = 0;
  for (const [from, html] of Object.entries(pages)) {
    for (const href of linksOf(html)) {
      const target = targetOf(from, href);
      if (target === null) continue;
      checked += 1;
      if (files.has(target)) continue;
      if (redirects.has(asRooted(from, href))) continue;
      errors.push(`${from}: 「${href}」 가 발행본 안에서 풀리지 않는다 — ${target} 가 없고 리다이렉트 선언도 없다`);
    }
  }
  return { errors, checked };
}
