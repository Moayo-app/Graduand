/**
 * 체크아웃 입구의 AC — **스텁임을 말한다 · 새 탭 · 계정 식별자 0 · 월환산 표기 0.**
 *
 * ⭐⭐ **순서가 못박혀 있다 — 「Build first, submit second」.** 실링크는 벤더 심사가
 * 끝난 뒤에만 실물이 되고, 심사 제출과 통과는 **사람 몫**이다. 그래서 지금 페이지가 질
 * 수 있는 것은 둘이다: ⑴ **지금 스텁이라는 사실을 말하는가** ⑵ 실링크가 선 날 **페이지가
 * 거짓말을 하지 않는 모양인가**(새 탭 · 수량을 링크가 잠그지 않음 · 계정 식별자 0).
 *
 * ⭐ **교체는 페이지 밖에서 일어난다.** 입구의 `href` 는 `./checkout/` 이고 그것은 지정된
 * 리다이렉트 자리다 — 벤더 주소는 발행된 화면에 박히지 않는다(벤더가 주소를 바꾼 날 그
 * 화면이 거짓말을 하고, 그 거짓말은 붙여넣어 옮겨지며 오래 산다). ⇒ 실링크 교체 때 움직이는
 * 것은 **리다이렉트 선언 하나**이고, 페이지에서 걷히는 것은 **아래 스텁 고지**다.
 *
 * ⚠️ **스텁 고지를 걷는 것을 무는 것은 없다** — 코드는 「벤더 심사가 통과했는가」를 알 길이
 * 없다. 아래가 무는 것은 「**지금** 고지가 서 있는가」이고, 심사 통과 뒤 그 고지를 걷는 것은
 * 사람의 한 수다. 숨기지 않고 적는다 — 「안 재다」가 아니라 「재고, 무는 것이 없다」이다.
 *
 * ⬜ **수량을 비워 둔 링크에서 고객이 수량을 고르는 화면**은 벤더 문서에 없다 — 문서는 범위만
 * 말한다. 그 칸은 **샌드박스 실측 몫**이고, 「선언 > 실재」라 문서의 함의로 닫지 않는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const page = (): string => read('index.html');

/** 발행되는 화면 코드 — 테스트는 분모가 아니다(스펙이 축자로 들어야 하는 자리가 있다). */
const shippedSrc = (): string[] =>
  readdirSync(join(ROOT, 'src'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
    .map((name) => `src/${name}`);

/** 구독 절 하나 — 입구가 둘이면 어느 것이 문인지 모른다는 기존 단정과 같은 자리를 본다. */
function ctaSection(html: string): string {
  const found = /<section id="cta"[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(found, 'index.html 에 구독 절이 없다');
  return found;
}

/** 구독 입구의 `<a>` 여는 태그 — 푸터의 `policy-link` AC 와 같은 꼴로 클래스를 센다. */
function checkoutAnchor(html: string): string {
  const found = [...html.matchAll(/<a\b[^>]*class="[^"]*checkout-link[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(found.length, 1, `체크아웃 입구가 checkout-link 하나가 아니다 (${found.length} 건)`);
  return found[0]!;
}

const attrOf = (tag: string, name: string): string | null => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/** 화면에 적힌 금액 전수 — **수를 테스트에 적지 않기 위해** 화면에서 뽑는다. */
const amountsOf = (html: string): number[] =>
  [...html.matchAll(/\$([\d.,]+)/g)].map((m) => Number(m[1]!.replace(/,/g, '')));

/** `index.html` 하나만 베낀 사본 — 위반을 **실제로 심어** 빨강을 확인할 자리. */
function pageFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-checkout-'));
  writeFileSync(join(root, 'index.html'), page());
  return root;
}
const fixtureHtml = (root: string): string => readFileSync(join(root, 'index.html'), 'utf8');
const plant = (root: string, html: string): void => writeFileSync(join(root, 'index.html'), html);

/**
 * ⭐ **스텁 고지가 말해야 하는 것 둘** — 「스텁이다」와 「결제로 이어지지 않는다」.
 * 하나만 있으면 반쪽이다: 상태만 말하고 결과를 말하지 않으면 방문자는 눌러 보고서야 알고,
 * 결과만 말하고 상태를 말하지 않으면 **고장**처럼 읽힌다.
 */
const stubClaims: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /스텁/, why: '상태 — 이 입구가 아직 실물이 아니라는 사실' },
  { pattern: /결제로 이어지지 않는다/, why: '결과 — 눌렀을 때 무엇이 일어나지 않는지' },
];

test('AC1 — 심사 통과 전: CTA 가 스텁임을 말하고 결제로 이어지지 않는다', () => {
  const cta = ctaSection(page());
  for (const { pattern, why } of stubClaims) {
    assert.match(cta, pattern, `스텁 고지에 없는 것: ${why}`);
  }

  // 결제로 이어지지 않는 **근거**는 「주소가 벤더가 아니다」다 — `./checkout/` 은 지정된
  // 리다이렉트 자리이고, 그 선언이 서기 전까지 이 문은 아무 데도 열리지 않는다.
  const href = attrOf(checkoutAnchor(cta), 'href');
  assert.equal(href, './checkout/', '체크아웃 href 가 지정된 리다이렉트 자리가 아니다');
});

test('AC1 (negative) — 스텁 고지를 걷으면 빨갛다', () => {
  // 음성 대조군 — 깨끗한 사본이 초록이어야 「걷으니 빨갛다」가 가드의 증거가 된다.
  const clean = pageFixture();
  for (const { pattern } of stubClaims) assert.match(ctaSection(fixtureHtml(clean)), pattern);

  for (const { pattern, why } of stubClaims) {
    const root = pageFixture();
    plant(root, fixtureHtml(root).replace(/<p class="stub-notice">[\s\S]*?<\/p>/, ''));
    assert.doesNotMatch(ctaSection(fixtureHtml(root)), pattern, `고지를 걷었는데 ${why} 가 남아 있다`);
  }
});

/**
 * ⭐ 실링크가 선 날의 모양 — **지금 걸어 둘 수 있고, 걸어 두는 것이 맞다.** 벤더
 * 호스티드 체크아웃은 **다른 출처**이고, 진단 결과가 떠 있는 탭을 그것으로 덮으면 방문자가
 * 자기 보고서를 잃는다. 그래서 새 탭이고, `rel` 둘은 그 새 탭의 조건이다.
 */
test('AC2 (페이지 몫) — 입구가 새 탭으로 열리고, 수량을 링크가 미리 잠그지 않는다', () => {
  const cta = ctaSection(page());
  const anchor = checkoutAnchor(cta);

  assert.equal(attrOf(anchor, 'target'), '_blank', '입구가 같은 탭을 덮는다 — 방문자가 보고서를 잃는다');
  const rel = (attrOf(anchor, 'rel') ?? '').split(/\s+/);
  // `noopener` 는 벤더 화면이 이 탭을 조작하지 못하게 하고, `noreferrer` 는 **보내는 것 자체를
  // 하나 더 줄인다** — 이 페이지는 집으로 아무것도 보내지 않는데, 떠나는 발걸음이 우리 주소를
  // 들고 가는 것은 같은 규율의 바깥이 아니다.
  for (const token of ['noopener', 'noreferrer']) {
    assert.ok(rel.includes(token), `입구의 rel 에 ${token} 이 없다`);
  }

  // ⛔ 링크에 수량을 박지 않는다 — 박으면 수량이 **잠겨** 「수량을 거기서 선언한다」가 깨진다.
  const href = attrOf(anchor, 'href') ?? '';
  assert.doesNotMatch(href, /[?#]/, `입구의 href 에 질의가 붙었다: ${href}`);
  for (const locked of ['units', 'seats', 'quantity', 'qty']) {
    assert.doesNotMatch(cta, new RegExp(locked, 'i'), `구독 절이 수량을 미리 선언한다: ${locked}`);
  }
});

/**
 * ⭐⭐ **AC3 — 실을 uid 자체가 없다.** 이 제품에는 계정 개념이 **0** 이다(자격의 핸들조차
 * 고객 저장소에 커밋되는 것이고 우리 쪽 식별자가 아니다). 그래서 「페이로드에서 뺐다」가
 * 아니라 **뺄 것이 없다** — 그 사실을 어휘로 민다: 화면과 화면 코드 전부에 계정 어휘가 0 이다.
 */
const accountWords: readonly { readonly word: string; readonly why: string }[] = [
  { word: 'uid', why: '우리 쪽 식별자 — 있으면 체크아웃에 실릴 수 있다' },
  { word: 'user_id', why: '같은 것의 다른 표기' },
  { word: 'customer_id', why: '벤더 쪽 식별자를 우리가 들고 있는 꼴' },
  { word: 'account', why: '계정 개념 자체 — 이 제품에 없다' },
  { word: 'external_id', why: '우리 식별자를 벤더에 심는 자리' },
  { word: 'client_reference_id', why: '같은 자리의 벤더 필드 이름' },
];

test('AC3 (negative) — 체크아웃 호출에 우리 쪽 계정 식별자가 0: 심으면 빨갛다', () => {
  const leaks = (text: string): string[] =>
    accountWords.filter(({ word }) => new RegExp(word, 'i').test(text)).map(({ word }) => word);

  for (const file of ['index.html', ...shippedSrc()]) {
    assert.deepEqual(leaks(read(file)), [], `${file} 에 계정 어휘가 있다`);
  }

  // 음성 대조군 — 깨끗한 사본이 초록이어야 「심으니 빨갛다」가 금칙의 증거가 된다.
  assert.deepEqual(leaks(fixtureHtml(pageFixture())), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  // ⛔ 질의로 실어 보내는 꼴을 **실제로 심는다** — 그전까지 가드가 0 이던 자리다.
  const root = pageFixture();
  plant(root, fixtureHtml(root).replace('href="./checkout/"', 'href="./checkout/?uid=abc123"'));
  assert.notDeepEqual(leaks(fixtureHtml(root)), [], 'uid 를 심었는데 초록이다 — 금칙이 죽었다');
  assert.match(attrOf(checkoutAnchor(fixtureHtml(root)), 'href') ?? '', /[?]/, '심은 질의가 href 에 없다');

  // 각 금칙에 **왜 계정 식별자인가**가 붙어 있다 — 사유 없는 금칙은 다음 사람이 걷는다.
  const self = read('src/checkout.test.ts');
  for (const { word, why } of accountWords) {
    assert.ok(self.includes(`'${word}'`), `금칙 ${word} 이 소스에 열거돼 있지 않다`);
    assert.ok(why.length >= 8, `금칙 ${word} 에 사유가 없다`);
  }
});

/**
 * ⭐⭐ **AC4 — 연 가격은 총액이다.** 「월 $12.50」류는 **연액을 월액처럼 보이게** 만들어
 * 고객이 승낙하는 금액과 실제로 청구되는 금액을 갈라 놓는다 — 이 제품이 파는 결함의 모양
 * 그대로다(선언과 실물의 갈라짐).
 *
 * ⭐ **월환산가를 테스트에 적지 않는다** — 화면의 두 금액에서 **유도한다**(연액 ÷ 12).
 * 적어 두면 가격이 움직인 날 그 수가 뜻 없이 깨지거나, 더 나쁘게는 **옛 가격을 재게** 된다.
 */
test('AC4 (negative) — 연 상품에 월환산 표기가 0건: 심으면 빨갛다', () => {
  const monthlyEquivalents = (html: string): number[] => {
    const amounts = amountsOf(html);
    const annual = Math.max(...amounts);
    // 연액 ÷ 12 = 월환산가. 그 수가 화면에 **적혀 있으면** 월환산 표기다.
    const perMonth = annual / 12;
    return amounts.filter((amount) => Math.abs(amount - perMonth) < 0.005);
  };

  const amounts = amountsOf(page());
  assert.equal(new Set(amounts).size, 2, `화면의 금액이 둘(월·연)이 아니다: ${JSON.stringify(amounts)}`);
  assert.deepEqual(monthlyEquivalents(page()), [], '화면에 월환산가가 적혀 있다');
  // 수가 아니라 **말**로 적는 길도 막는다 — 「월 환산」·「환산하면」.
  assert.doesNotMatch(page(), /환산/, '화면에 「환산」이라는 말이 있다');

  // 음성 대조군 — 깨끗한 사본이 초록이어야 「심으니 빨갛다」가 금칙의 증거가 된다.
  assert.deepEqual(monthlyEquivalents(fixtureHtml(pageFixture())), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  const annual = Math.max(...amounts);
  const planted = [
    `<span class="price-note">(월 $${(annual / 12).toFixed(2)} 상당)</span>`,
    `<p>연 결제는 월 $${annual / 12} 꼴이다</p>`,
  ];
  for (const sample of planted) {
    const root = pageFixture();
    plant(root, fixtureHtml(root).replace('</main>', `  ${sample}\n</main>`));
    assert.notDeepEqual(monthlyEquivalents(fixtureHtml(root)), [], `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`);
  }
});
