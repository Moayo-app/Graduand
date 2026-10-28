/**
 * 체크아웃 입구의 AC — **스텁임을 말한다 · 새 탭 · 계정 식별자 0 · 월환산 표기 0.**
 *
 * ⭐⭐ **순서가 못박혀 있다 — 「Build first, submit second」.** 제출과 통과는 **사람 몫**이고
 * 그 몫은 끝났다 — 심사가 통과했고 창구에 카탈로그가 섰다. ⚠️ 그래도 이 입구는 스텁이다:
 * 남은 조건이 **우리 손으로 옮겨왔을** 뿐이고, 그것은 이 주소를 창구로 보내는 리다이렉트
 * 선언이다. 그래서 지금 페이지가 질 수 있는 것은 여전히 둘이다: ⑴ **지금 스텁이라는 사실을
 * 말하는가** ⑵ 실링크가 선 날 **페이지가 거짓말을 하지 않는 모양인가**(새 탭 · 수량을
 * 링크가 잠그지 않음 · 계정 식별자 0).
 *
 * ⭐ **교체는 페이지 밖에서 일어난다.** 입구의 `href` 는 `CHECKOUT_PATH` 이고 그것은 지정된
 * 리다이렉트 자리다 — 벤더 주소는 발행된 화면에 박히지 않는다(벤더가 주소를 바꾼 날 그
 * 화면이 거짓말을 하고, 그 거짓말은 붙여넣어 옮겨지며 오래 산다). ⇒ 벤더가 움직일 때
 * 움직이는 것은 **선언 한 줄**(`CHECKOUT_SITE`)이고 발행본은 한 바이트도 움직이지 않는다.
 *
 * ⭕ **그 선언이 섰고, 그래서 스텁 고지가 걷혔다.** 머리말이 적어 두었던 「고지를 걷도록
 * 무는 것은 없다 — 그것은 사람의 한 수다」가 **실제로 일어난 자리**다. ⛔ 단정을 지운 것이
 * 아니라 **사실을 따라 옮겼다**: 아래 AC1 이 자구 둘 대신 구조 둘을 문다(선언에 행이 있다 ·
 * 발행본에 벤더 주소가 0 이다). ⚠️ 서빙은 여전히 별개다 — 도메인이 붙는 날 이 문이 열린다.
 *
 * ⬜ **수량을 비워 둔 링크에서 고객이 수량을 고르는 화면**은 벤더 문서에 없다 — 문서는 범위만
 * 말한다. 그 칸은 **샌드박스 실측 몫**이고, 「선언 > 실재」라 문서의 함의로 닫지 않는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCUMENT_FILE, renderAll, TEMPLATE_FILE } from './generate.ts';
import { CHECKOUT_PATH, CHECKOUT_SITE, REDIRECTS } from './site.ts';
import { LOCALES } from './strings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/**
 * ⭐⭐ **분모는 발행본이다.** 산문이 카탈로그로 내려온 뒤 손글씨 틀에는 산문이 0 이므로,
 * 「화면이 무엇을 말하는가」를 묻는 단정이 틀을 보면 **아무 말도 하지 않는다**. ⇒ 생성기가
 * 낸 바이트를 받는다 — 그것이 자바스크립트를 끈 방문자가 받는 전부이기도 하다.
 *
 * ⭐ 틀을 **인자로** 받는 꼴이라, 금칙을 심은 틀로도 같은 유도가 돈다(음성 대조군의 조건).
 */
const documentsFrom = (template: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(renderAll(template)).map(([locale, html]) => [`${locale}/${DOCUMENT_FILE}`, html]),
  );

const template = (): string => read(TEMPLATE_FILE);
const documents = (): Record<string, string> => documentsFrom(template());

/**
 * 정본 로케일의 발행본 — ⚠️ **한국어 자구를 무는 단정이 보는 자리**다(ko 가 정본이다).
 * 번역 벌의 자구를 여기 적으면 사본이 로케일마다 하나씩 늘고, 그 사본들이 갈라지는 것이
 * 이 제품이 재는 결함이다 — 번역 벌이 비어 있지 않고 옮겨졌는지는 `i18n.test.ts` 가 문다.
 */
const page = (): string => documents()[`${LOCALES[0]}/${DOCUMENT_FILE}`]!;

/** 발행되는 화면 코드 — 테스트는 분모가 아니다(스펙이 축자로 들어야 하는 자리가 있다). */
const shippedSrc = (): string[] =>
  readdirSync(join(ROOT, 'src'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
    .map((name) => `src/${name}`);

/** 구독 절 하나 — 입구가 둘이면 어느 것이 문인지 모른다는 기존 단정과 같은 자리를 본다. */
function ctaSection(html: string): string {
  const found = /<section id="cta"[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(found, '발행본에 구독 절이 없다');
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

/**
 * 위반을 **실제로 심은** 발행본 — ⭐ 심는 자리가 **틀**이다: 틀에 선 것은 발행본 전수에
 * 가므로, 같은 유도로 난 발행본에서 빨강을 확인하는 것이 「심으니 빨갛다」의 올바른 모양이다.
 * ⚠️ 임시 디렉터리가 필요 없어졌다 — 발행본은 **유도된 것**이라 파일로 내리지 않아도 난다.
 */
const plantedPage = (replace: (template: string) => string): string =>
  documentsFrom(replace(template()))[`${LOCALES[0]}/${DOCUMENT_FILE}`]!;

/**
 * ⭐⭐ **문이 선언을 지난다** — 입구의 `href` 는 상대 경로이고, 밖으로 나가는 절대 주소는
 * `site.ts` 의 선언 한 줄이 든다. 그 둘이 **같은 경로**에서 만나는지를 여기서 묻는다:
 * 선언만 서고 화면이 다른 곳을 가리키면 문은 여전히 아무 데도 열리지 않는다.
 *
 * ⚠️⚠️ **이 자리는 「스텁 고지가 서 있는가」였다.** 그 고지가 댄 사유는 두 번 움직였고
 * (⑴ 벤더의 창구 심사 → ⑵ 이 주소를 창구로 보내는 연결), ⑵ 가 선언으로 서면서 고지가
 * 가리킬 조건이 **0** 이 됐다 — 걷는 한 수는 머리말이 적어 둔 대로 **사람**이 뒀다.
 * ⇒ 단정도 사실을 따라 옮겼다: 「아직 안 간다」를 묻던 자리가 「**어디로 가는지가 선언에
 * 있다**」를 묻는다. ⛔ 지운 단정은 0 이다 — 자구 둘이 사라진 만큼 구조 둘이 들어왔다.
 */
test('AC1 — 구독 입구가 지정된 문을 지난다: 목적지가 선언에 있고 발행본에는 없다', () => {
  const rule = REDIRECTS.find((entry) => entry.from === CHECKOUT_PATH);
  assert.ok(rule, `${CHECKOUT_PATH} 행이 없다 — 입구가 가리키는 자리가 비어 있다`);
  assert.equal(rule!.to, CHECKOUT_SITE, '입구의 목적지가 선언된 벤더 주소가 아니다');
  // ⚠️ 302 다 — 벤더가 링크를 다시 내면 주소가 바뀌고, 301 을 캐시한 방문자는 죽은 문을 받는다.
  assert.equal(rule!.status, '302', '입구의 문이 영구 이동이다');

  for (const [name, html] of Object.entries(documents())) {
    const href = attrOf(checkoutAnchor(ctaSection(html)), 'href');
    assert.equal(href, CHECKOUT_PATH, `${name}: 입구가 지정된 리다이렉트 자리가 아니다`);
    assert.ok(!html.includes(CHECKOUT_SITE), `${name}: 발행본에 벤더 주소가 박혔다 — 문을 지나지 않는다`);
  }
});

test('AC1 (negative) — 벤더 주소가 발행본에 박히면 빨갛다', () => {
  // 음성 대조군 — 깨끗한 발행본에 그 주소가 0 이어야 「박으니 빨갛다」가 증거가 된다.
  for (const html of Object.values(documents())) assert.ok(!html.includes(CHECKOUT_SITE));

  const planted = plantedPage((t) => t.replace(`href="${CHECKOUT_PATH}"`, `href="${CHECKOUT_SITE}"`));
  assert.ok(planted.includes(CHECKOUT_SITE), '벤더 주소를 심었는데 발행본에 없다 — 하네스가 죽었다');
  assert.notEqual(
    attrOf(checkoutAnchor(planted), 'href'),
    CHECKOUT_PATH,
    '심었는데 입구가 그대로다 — 이 단정이 보는 자리가 틀렸다',
  );
});

/**
 * ⭐ 실링크가 선 날의 모양 — **지금 걸어 둘 수 있고, 걸어 두는 것이 맞다.** 벤더
 * 호스티드 체크아웃은 **다른 출처**이고, 진단 결과가 떠 있는 탭을 그것으로 덮으면 방문자가
 * 자기 보고서를 잃는다. 그래서 새 탭이고, `rel` 둘은 그 새 탭의 조건이다.
 */
test('AC2 (페이지 몫) — 입구가 새 탭으로 열리고, 수량을 링크가 미리 잠그지 않는다', () => {
  // ⭐ 이 단정들은 **구조**를 묻는다(자구가 아니다) ⇒ 발행본 전수가 분모다.
  for (const [name, html] of Object.entries(documents())) {
    const section = ctaSection(html);
    const link = checkoutAnchor(section);
    assert.equal(attrOf(link, 'target'), '_blank', `${name}: 입구가 같은 탭을 덮는다`);
    assert.equal(attrOf(link, 'href'), '/checkout/', `${name}: 입구가 지정된 리다이렉트 자리가 아니다`);
    for (const locked of ['units', 'seats', 'quantity', 'qty']) {
      assert.doesNotMatch(section, new RegExp(locked, 'i'), `${name}: 구독 절이 수량을 미리 선언한다: ${locked}`);
    }
  }

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

  // ⭐ 분모가 **틀 + 발행본 + 화면 코드**다 — 산문이 카탈로그로 내려와서 계정 어휘가 설
  //   수 있는 자리가 하나 늘었고(카탈로그), 방문자가 받는 바이트도 따로 봐야 한다.
  const subjects = {
    ...Object.fromEntries([TEMPLATE_FILE, ...shippedSrc()].map((file) => [file, read(file)])),
    ...documents(),
  };
  for (const [name, text] of Object.entries(subjects)) {
    assert.deepEqual(leaks(text), [], `${name} 에 계정 어휘가 있다`);
  }

  // ⛔ 질의로 실어 보내는 꼴을 **실제로 심는다** — 그전까지 가드가 0 이던 자리다.
  const planted = plantedPage((t) => t.replace('href="/checkout/"', 'href="/checkout/?uid=abc123"'));
  assert.notDeepEqual(leaks(planted), [], 'uid 를 심었는데 초록이다 — 금칙이 죽었다');
  assert.match(attrOf(checkoutAnchor(planted), 'href') ?? '', /[?]/, '심은 질의가 href 에 없다');

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

  // ⭐ 금액은 **로케일 불변**이다(총액 둘) ⇒ 수를 무는 단정은 발행본 전수가 분모다.
  for (const [name, html] of Object.entries(documents())) {
    const found = amountsOf(html);
    assert.equal(new Set(found).size, 2, `${name}: 화면의 금액이 둘(월·연)이 아니다: ${JSON.stringify(found)}`);
    assert.deepEqual(monthlyEquivalents(html), [], `${name}: 화면에 월환산가가 적혀 있다`);
  }

  // 수가 아니라 **말**로 적는 길도 막는다 — 「월 환산」·「환산하면」. ⚠️ 자구라서 정본을 본다.
  assert.doesNotMatch(page(), /환산/, '화면에 「환산」이라는 말이 있다');

  const annual = Math.max(...amountsOf(page()));
  const planted = [
    `<span class="price-note">(월 $${(annual / 12).toFixed(2)} 상당)</span>`,
    `<p>연 결제는 월 $${annual / 12} 꼴이다</p>`,
  ];
  for (const sample of planted) {
    const leaky = plantedPage((t) => t.replace('</main>', `  ${sample}\n</main>`));
    assert.notDeepEqual(monthlyEquivalents(leaky), [], `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`);
  }
});
