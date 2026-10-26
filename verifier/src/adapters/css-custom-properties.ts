/**
 * `css-custom-properties` — v1 의 어댑터 하나. CSS 커스텀 속성(`--token: value`)을
 * 읽는다. 바닐라 CSS 와 Tailwind v4(CSS-first `@theme`)를 같은 파서가 덮는다.
 *
 * **부분집합 파서다.** 허용하는 자리 셋: 최상위 셀렉터 블록 · `@media` 1단 아래의
 * 셀렉터 블록 · 최상위 `@theme` 블록. 그 밖(2단 중첩 · 여러 줄 선언 · 괄호 불균형)에서
 * 커스텀 속성을 만나면 조용히 떨어뜨리지 않고 **실패한다** — 부분집합의 경계는 판정이
 * 필요한 만큼이고, 경계 밖은 「못 읽었다」지 「없다」가 아니다. 범용 CSS 파서를 들이지
 * 않는 것은 의존 0 을 지키는 결정이다 — 눈이 머는 자리는 늘리지 않고 실패로 드러낸다.
 */

import type { PaletteAdapter, ReadToken } from './adapter.ts';

/** `#abc` → `#AABBCC`. hex 가 아니면 공백만 접고 그대로 — 해석은 비교가 아니라 월권이다. */
function normalizeValue(v: string): string {
  const t = v.trim().replace(/\s+/g, ' ');
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!m) return t;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toUpperCase()}`;
}

/** `@theme` 와 그 변형(`@theme inline` 등)은 at-rule 이지만 선언이 직접 사는 블록이다. */
const isTheme = (label: string): boolean => label === '@theme' || label.startsWith('@theme ');

interface Block {
  label: string;
  /** 선언을 직접 담지 못하는 at-rule(`@media` 등)인가 — `@theme` 는 제외. */
  atRule: boolean;
}

type ParseOutcome = { ok: true; tokens: Omit<ReadToken, 'file'>[] } | { ok: false; message: string };

function parseOne(text: string): ParseOutcome {
  // 주석은 소거하되 행은 보존한다 — 행 번호가 증거라서 줄을 당기면 증거가 거짓이 된다.
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));
  const tokens: Omit<ReadToken, 'file'>[] = [];
  const stack: Block[] = [];
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    // 한 줄 안의 선언·중괄호를 순서대로 소비한다 — 「한 줄 = 한 사건」의 부분집합.
    let rest = lines[i]!;
    while (rest.trim() !== '') {
      const open = rest.indexOf('{');
      const close = rest.indexOf('}');
      const decl = /^\s*(--[A-Za-z0-9-_]+)\s*:\s*([^;{}]+);/.exec(rest);

      if (decl && (open === -1 || decl[0].length <= open) && (close === -1 || decl[0].length <= close)) {
        if (stack.length === 0) {
          return { ok: false, message: `line ${i + 1}: custom property outside any block — not CSS this adapter can read` };
        }
        const scopeOk =
          (stack.length === 1 && !stack[0]!.atRule) || // 최상위 셀렉터 (@theme 포함)
          (stack.length === 2 && stack[0]!.atRule && !stack[1]!.atRule); // @media 1단 > 셀렉터
        if (!scopeOk) {
          return {
            ok: false,
            message: `line ${i + 1}: declaration at a nesting this subset parser does not know (${stack.map((s) => s.label).join(' > ')}) — a blind spot is a parse failure, not a pass`,
          };
        }
        tokens.push({
          name: decl[1]!,
          value: normalizeValue(decl[2]!),
          scope: stack.map((s) => s.label).join(' > '),
          line: i + 1,
        });
        rest = rest.slice(decl[0].length);
        continue;
      }

      if (open !== -1 && (close === -1 || open < close)) {
        const label = rest.slice(0, open).trim();
        stack.push({
          label: label || '(unnamed block)',
          atRule: label.startsWith('@') && !isTheme(label),
        });
        rest = rest.slice(open + 1);
        continue;
      }

      if (close !== -1) {
        if (stack.length === 0) {
          return { ok: false, message: `line ${i + 1}: unbalanced braces — a closing brace with no open block` };
        }
        stack.pop();
        rest = rest.slice(close + 1);
        continue;
      }

      // 선언도 중괄호도 아닌 꼬리. 단 `--이름:` 으로 시작하는데 `;` 가 없으면
      // 여러 줄에 걸친 선언이다 — 이 부분집합 밖이고, 밖은 실패로 드러낸다.
      if (/^\s*--[A-Za-z0-9-_]+\s*:/.test(rest)) {
        return { ok: false, message: `line ${i + 1}: a declaration spanning multiple lines — outside this subset parser` };
      }
      break;
    }
  }

  if (stack.length > 0) {
    return { ok: false, message: `end of file: unclosed block (${stack.map((s) => s.label).join(' > ')})` };
  }
  if (tokens.length === 0) {
    // 선언이 팔레트 파일이라 지목한 파일에서 토큰 0 — 「깨끗한 파일」이 아니라
    // 「파일 형식이 선언 밖으로 움직였다」는 신호다.
    return { ok: false, message: 'zero custom properties read — if this is the palette file, its format has moved out from under the declaration' };
  }
  return { ok: true, tokens };
}

export const cssCustomProperties: PaletteAdapter = {
  id: 'css-custom-properties',
  normalize: normalizeValue,
  read(files) {
    const tokens: ReadToken[] = [];
    for (const { path, text } of files) {
      const parsed = parseOne(text);
      if (!parsed.ok) return { ok: false, file: path, message: parsed.message };
      for (const t of parsed.tokens) tokens.push({ ...t, file: path });
    }
    return { ok: true, tokens };
  },
};
