/**
 * 참조 표기 열거 — `refs` 판정기의 수집 층.
 *
 * ⭐ **표기는 하나가 아니다.** 한 표기만 보는 검사는 「위반 0」이 아니라 **한 표기에
 * 대해서만 위반 0**이다. 그래서 훑는 표기를 열거하고 **그 열거를 보고에 싣는다** —
 * 열거 밖 표기는 미판정이고, 미판정 범위는 사람이 볼 수 있어야 한다.
 */

/** 이 판정기가 훑는 표기. 보고에 그대로 실린다. */
export const NOTATIONS = [
  { id: 'markdown-link', example: '[text](target)' },
  { id: 'wiki', example: '[[name]]' },
  { id: 'bare-bracket', example: '[name-shaped-token]' },
  { id: 'backtick-path', example: '`path/file.md`' },
] as const;

export type NotationId = (typeof NOTATIONS)[number]['id'];

export interface Reference {
  /** 참조가 적힌 파일 (저장소 루트 기준). */
  file: string;
  /** 1-indexed. */
  line: number;
  notation: NotationId;
  /** 적힌 그대로의 대상 문자열. */
  raw: string;
}

/**
 * 자리표시자와 글롭은 대상이 아니다 — `{domain}` · `<placeholder>` 는 채워 넣을 자리이고
 * `issues/*.md` 는 패턴이다. 「해소돼야 한다」로 단정하면 문서의 의도와 정반대를 요구한다.
 *
 * 스킴 문자셋에 `.` 을 넣지 않는다 — RFC 는 허용하지만 실물 스킴에는 쓰이지 않고,
 * 넣으면 `file.ts:10` 류의 `파일:줄` 인용이 스킴으로 오인돼 판정에서 통째로 빠진다.
 */
const excluded = (t: string): boolean =>
  t === '' ||
  t.includes('{') ||
  t.includes('<') ||
  t.includes('*') ||
  t.startsWith('#') ||
  /^[a-z][a-z0-9+-]*:/i.test(t); // http: · https: · mailto: · file: …

/**
 * 이름 형태 토큰만 `bare-bracket` 으로 센다 — **소문자 · 3마디 이상 · 글자 최소 하나**.
 *
 * `[…]` 는 산문에 흔해서(이슈 태그 · 표 칸 · 날짜) 전부 세면 잡음이 판정을 덮는다.
 * 「글자 최소 하나」가 없으면 `2026-04-05` 같은 날짜가 3마디로 통과한다. 이 휴리스틱은
 * 놓치는 쪽으로 틀리며, 놓친 것은 「위반 0」이 아니라 **미판정**이다.
 */
const nameShaped = /^(?=[a-z0-9_-]*[a-z])[a-z0-9]+(?:[_-][a-z0-9]+){2,}$/;

const WIKI = /\[\[([^\]]+)\]\]/g;
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
const BARE = /\[([^\]]+)\]/g;
const TICK = /`([^`]+)`/g;

/** 코드 펜스 안은 예시라 참조가 아니다. */
const FENCE = /^\s*(```|~~~)/;

export function extract(file: string, text: string): Reference[] {
  const out: Reference[] = [];
  let inFence = false;

  text.split('\n').forEach((line, i) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const at = (notation: NotationId, raw: string) => {
      if (!excluded(raw)) out.push({ file, line: i + 1, notation, raw });
    };

    // 인라인 코드 스팬 안은 표기의 *언급*이지 참조가 아니다 — 표기를 설명하는 문서가
    // 자기 예시를 위반으로 보고받지 않게 한다. 펜스 제외와 같은 이유다.
    const outsideCode = line.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length));

    // 마스킹 순서가 중요하다 — `[[x]]` 는 `[x]` 에도 걸리고, `[t](u)` 도 `[t]` 에 걸린다.
    let rest = outsideCode;
    for (const m of rest.matchAll(WIKI)) at('wiki', m[1]!.trim());
    rest = rest.replace(WIKI, (s) => ' '.repeat(s.length));

    for (const m of rest.matchAll(LINK)) at('markdown-link', m[1]!.trim());
    rest = rest.replace(LINK, (s) => ' '.repeat(s.length));

    for (const m of rest.matchAll(BARE)) {
      const t = m[1]!.trim();
      if (nameShaped.test(t)) at('bare-bracket', t);
    }

    for (const m of line.matchAll(TICK)) {
      const t = m[1]!.trim();
      // 백틱 경로는 「/ 를 갖고 파일 확장자로 끝난다」로 좁힌다. 그냥 `foo` 는 코드다.
      // `:215` 같은 줄 인용이 붙어도 경로다 — 확장자로 **끝나야** 한다고 두면 `파일:줄`
      // 인용이 수집에서 통째로 빠지고, 그건 「위반 0」이 아니라 미판정이다.
      if (t.includes('/') && /\.[a-z0-9]{1,5}(?::\d+(?:-\d+)?)?$/i.test(t)) at('backtick-path', t);
    }
  });

  return out;
}
