/**
 * 디자인 토큰 값 박제 — 한지 바탕 + 먹 램프 6색 + **담채 3색**(공유 디자인 토큰의 사본)과
 * 탭 타깃 하한. 값을 바꾸려면 이 spec 을 같은 변경으로 함께 바꾼다 — 코드 선언만으로 두면
 * 사본이 조용히 갈라진다.
 *
 * ⭐⭐ **그리고 담채는 판정 전용으로 잠긴다.** 이 파일이 전에 박제한 것은 먹 램프와 바탕
 * 뿐이었고 담채 셋에는 핀이 **0** 이었다 — 뜻이 가장 무거운 세 값이 가드 밖이었다. 실측하니
 * 셋 다 이미 판정 밖으로 새어 있었다(입력 오류 · 활성화 배너 · 스텁 고지). 빌리면 같은 색이
 * **주어가 다른 두 문장**을 동시에 뜻하게 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');

test('먹 램프 6색 + 한지 바탕 — hex 값이 그대로 있다', () => {
  const pinned: Record<string, string> = {
    base: '#F7F6F3',
    'ink-burnt': '#1A1D2E',
    'ink-dense': '#2D3142',
    'ink-heavy': '#6B6E80',
    'ink-light': '#C8CAD2',
    'ink-clear': '#EFEFF2',
  };
  for (const [name, hex] of Object.entries(pinned)) {
    assert.match(css, new RegExp(`--${name}:\\s*${hex};`), `${name} 토큰이 ${hex} 가 아니다`);
  }
});

test('탭 타깃 하한 — 44, 누를 수 있는 것이 이 아래로 내려가지 않는다', () => {
  assert.match(css, /--tap-min:\s*44px;/);
  assert.match(css, /min-height:\s*var\(--tap-min\)/);
});

/**
 * 담채 3색 — 판정의 세 상태가 쥔 값이다. ⚠️ 먹 램프와 **따로** 박는다: 램프는 공유 토큰의
 * 사본이고 이 셋은 **램프 밖 예외**라, 한 목록에 두면 걷을 때 함께 걷힌다.
 */
test('담채 3색 — hex 값이 그대로 있다', () => {
  const pinned: Record<string, string> = {
    'state-pass': '#2F6B4F',
    'state-violation': '#A03A32',
    'state-unjudged': '#8A6420',
  };
  for (const [name, hex] of Object.entries(pinned)) {
    assert.match(css, new RegExp(`--${name}:\\s*${hex};`), `${name} 토큰이 ${hex} 가 아니다`);
  }
});

/**
 * ⭐⭐ **담채를 쓰는 선택자 전수 — 선언이 분모다.**
 *
 * 아래 둘을 합친 것이 CSS 에서 `var(--state-*)` 를 쓰는 선택자 **전부와 정확히 같아야**
 * 한다. 새 자리가 생기면 빨갛고(빌림이 조용히 늘지 않는다), 선언에 있는데 실물에 없어도
 * 빨갛다(낡은 선언은 미판정이 아니라 판정 실패다).
 */
const judgmentSelectors: readonly { readonly selector: string; readonly why: string }[] = [
  { selector: '.screen', why: '판정 불가 화면 — 판정의 결과를 그리는 자리다' },
  { selector: '.check-pass', why: '통과 칸의 괘선 — 3상태의 한 칸이다' },
  { selector: '.check-violation', why: '위반 칸의 괘선 — 3상태의 한 칸이다' },
  { selector: '.check-unjudged', why: '미판정 칸의 괘선 — 3상태의 한 칸이다' },
  { selector: '.badge-pass', why: '통과 배지 — 같은 칸의 이름표다' },
  { selector: '.badge-violation', why: '위반 배지 — 같은 칸의 이름표다' },
  { selector: '.badge-unjudged', why: '미판정 배지 — 같은 칸의 이름표다' },
  { selector: '.reason', why: '미판정의 사유 — 미판정과 같은 자리에 선다' },
  { selector: '.report-unmeasured', why: '재지 않은 것 절의 점선 테두리 — 절 자체가 3상태의 한 칸이다' },
  // ⭐ 격자의 칸 — 주어가 **판정 결과**다(「편입된 규칙이 선언된 표면에서 무엇을 말하는가」).
  //   체크 칸과 같은 급이라 같은 담채를 쓰고, 빌림이 아니다.
  { selector: '.grid-pass', why: '통과 칸의 괘선 — 격자의 한 칸이고 3상태의 한 칸이다' },
  { selector: '.grid-violation', why: '위반 칸의 괘선 — 격자의 한 칸이고 3상태의 한 칸이다' },
  { selector: '.grid-unjudged', why: '미판정 칸의 괘선 — 격자의 한 칸이고 3상태의 한 칸이다' },
];

/**
 * 판정 밖인데 담채를 쓰는 자리 — **사유와 함께** 선언한다.
 *
 * ⚠️ 둘 다 「우리가 무엇을 출하했는가」가 **아니라** 다른 축이다 — 그래서 ②의 잠금(영업
 * 화면의 「안 섰다」가 담채를 빌리지 않는다)이 이 둘을 건드리지 않았다. ⬜ 이 둘의 담채
 * 사용을 언제 볼지는 정해진 적이 없다 — 안 재는 것이 아니라 **아직 안 쟀다**고 적는다.
 *
 * ⚠️⚠️ **이 목록이 한때 자기모순이었다.** `.activated`(주어 = 고객의 자격)는 여기 있었는데
 * `.entitlement`(같은 주어)는 **판정 선택자**로 올라가 있었다 — 같은 사실이 두 칸에 다르게
 * 적혀 있었다. ⇒ `.entitlement` 를 먹으로 내리면서 그 갈라짐이 닫혔다. `.warn` 도 같은
 * 계열이다: 「커밋이 더럽다」는 **측정 조건**이지 어느 규칙의 판정이 아니다.
 */
const stateExemptions: readonly { readonly selector: string; readonly why: string }[] = [
  {
    selector: '.field-error',
    why: '입력 오류 — 주어가 사람이 넣은 값이다(우리 출하 상태가 아니다)',
  },
  {
    selector: '.activated',
    why: '자격이 섰다는 신호 — 주어가 고객의 자격이다(우리 출하 상태가 아니다)',
  },
];

/**
 * CSS 에서 `var(--state-*)` 를 쓰는 선택자 — 규칙 블록을 돌며 거둔다.
 *
 * ⚠️ **주석을 먼저 벗긴다** — 규칙 앞의 주석은 선택자와 같은 자리에 있어서, 벗기지 않으면
 * 선택자 이름에 그 산문이 통째로 붙는다(실측). 주석은 다음 사람에게 쓰는 것이고 꾸밈이
 * 아니다 — 이 패키지가 한글 가드에서 쓰는 규율과 같다.
 */
const stateUsingSelectors = (text: string): string[] =>
  [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[2]!.includes('var(--state-'))
    .map((match) => match[1]!.trim().replace(/\s+/g, ' '))
    .sort();

test('담채 잠금 — 판정 밖에서 담채를 빌리는 자리가 선언된 둘뿐이다', () => {
  const declared = [...judgmentSelectors, ...stateExemptions].map(({ selector }) => selector).sort();
  assert.deepEqual(
    stateUsingSelectors(css),
    declared,
    '담채를 쓰는 선택자가 선언과 다르다 — 빌림이 늘었거나 선언이 낡았다',
  );
  for (const { selector, why } of [...judgmentSelectors, ...stateExemptions]) {
    assert.ok(why.length >= 8, `${selector} 에 사유가 없다`);
  }
});

test('담채 잠금 (negative) — 판정 밖 선택자에 담채를 심으면 빨갛다', () => {
  const planted = `${css}\n.sales-pitch { border-left: 3px solid var(--state-unjudged); }\n`;
  assert.ok(
    stateUsingSelectors(planted).includes('.sales-pitch'),
    '담채를 심었는데 거두어지지 않았다 — 가드가 죽었다',
  );
});

/**
 * ⭐ 「안 섰다」의 괘선이 **먹**이라는 것 — 위 잠금의 **반대쪽**이다. 잠금은 「담채가 새지
 * 않는다」를 말하고 이 단정은 「그 자리가 실제로 먹을 쓴다」를 말한다: 둘 다 서야 괘선이
 * 아무 색도 없는 자리로 조용히 사라지지 않는다.
 */
test('안 선 것의 고지 — 괘선이 가장 진한 먹이다', () => {
  assert.match(
    css,
    /\.ink-notice \{\n\s*border-left: 3px solid var\(--ink-burnt\);/,
    '「아직 서지 않았다」의 괘선이 먹 램프 밖이다',
  );
});
