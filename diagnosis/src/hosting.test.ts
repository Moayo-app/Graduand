/**
 * 발행 자리의 AC — 호스팅 선언 · 로케일을 가르지 않는 규칙 · 최초 발행의 기록.
 *
 * ⭐⭐ **색인 선언 자체는 여기 없다** — canonical · hreflang · sitemap 은 **생성기의 산출**이라
 * 그쪽 가드가 든다(`generate.test.ts`). 여기가 보는 것은 **그 산출이 놓이는 자리**와, 그
 * 자리가 섰다고 말할 수 있는 **근거**다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_OUT, renderAll, TEMPLATE_FILE } from './generate.ts';
import {
  FIRST_PUBLISHED,
  FIRST_PUBLISHED_EVIDENCE,
  POLICY_EFFECTIVE,
  POLICY_EFFECTIVE_EVIDENCE,
} from './publisher.ts';
import {
  CHECKOUT_PATH,
  PORTAL_PATH,
  CHECKOUT_SITE,
  COMPANY_PATH,
  COMPANY_SITE,
  DEFAULT_LOCALE,
  REDIRECTS,
  ROOT_PATH,
  SITE_ORIGIN,
  DOCUMENTS,
  documentPath,
  redirectsFile,
  robotsTxt,
} from './site.ts';
import { CATALOG, LOCALES, type Locale } from './strings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');

/**
 * 호스팅 선언 — ⭐ **저장소 루트에 산다.** `diagnosis/` 안에 두면 그 패키지의 공개 경계
 * 가드가 드는 「분모 완전성」이 이 파일의 열거를 요구하고, 호스팅 설정이 배달 산문의 분모에
 * 섞인다. 호스팅은 배달되는 산문이 아니다.
 */
const HOSTING_FILE = 'wrangler.jsonc';

const hosting = (): string => readFileSync(join(REPO, HOSTING_FILE), 'utf8');

/** 주석을 벗긴 선언 — 사유는 다음 사람에게 쓰는 것이고, 값이 아니다. */
const hostingValue = (): Record<string, unknown> =>
  JSON.parse(hosting().replace(/^\s*\/\/.*$/gm, '')) as Record<string, unknown>;

test('AC4 (negative) — 호스팅 선언이 배달 패키지 밖에 있고, 발행 루트를 가리킨다', () => {
  assert.ok(existsSync(join(REPO, HOSTING_FILE)), `${HOSTING_FILE} 이 저장소 루트에 없다`);
  assert.ok(
    !existsSync(join(ROOT, HOSTING_FILE)),
    `${HOSTING_FILE} 이 배달 패키지 안에 있다 — 공개 경계 가드의 분모가 호스팅 설정을 삼킨다`,
  );

  // ⛔ 자리를 **손으로 적지 않는다** — 생성기의 기본 산출 자리에서 받는다. 둘이 갈라지면
  //    호스팅이 빈 디렉터리를 서빙하고, 그 실패는 빌드에서 아무 표시도 남기지 않는다.
  const assets = hostingValue()['assets'] as Record<string, unknown> | undefined;
  assert.ok(assets !== undefined, '호스팅 선언에 자산 자리가 없다');
  assert.equal(assets['directory'], `./diagnosis/${DEFAULT_OUT}`, '호스팅이 가리키는 자리가 발행 루트가 아니다');

  // ⭐ 워커 스크립트가 **없다** — 「페이지 요청이 워커를 거치지 않는다」가 참으로 남는
  //   조건이고, 그 문장은 카탈로그와 페이지 코드가 언어 협상을 기각한 근거이기도 하다.
  // ⚠️ 문면이 좁아졌다: 전에는 「우리 코드가 도는 서버가 0」이었고, 과금 웹훅이 **따로**
  //   서면서 그 넓은 문장이 거짓이 됐다. ⭕ 이 단정이 재는 것은 **이 배포**이고 그대로다.
  assert.equal(hostingValue()['main'], undefined, '워커 스크립트가 섰다 — 페이지 요청이 워커를 거치게 된다');

  // ⛔⛔ **`workers.dev` 가 닫혀 있다.** 열려 있으면 커스텀 도메인 없이도 사이트가 **지금
  //    공개된다** — 「부착이 곧 컷오버」가 거짓이 되고, 링크 여섯이 404 인 화면이 우리 이름을
  //    걸고 색인된다. ⚠️ **`undefined` 는 통과가 아니다**: 적지 않으면 기본값이 **열림**이라,
  //    빈 칸을 「아직 안 정했다」로 두면 그 침묵이 공개 쪽으로 기운다.
  assert.equal(
    hostingValue()['workers_dev'],
    false,
    'workers.dev 주소가 닫혀 있지 않다 — 적지 않으면 기본값이 열림이고, 그 순간 컷오버가 일어난다',
  );
});

/**
 * ⭐⭐ **부착이 곧 컷오버다 — 그래서 `routes` 는 혼자 설 수 없다.**
 *
 * 커스텀 도메인을 붙이는 순간 사이트가 공개되므로 그 두 줄은 공개 전환과 **같은 순간에**
 * 열린다. ⚠️ 비어 있는 것을 **미결로 두면** 다음 사람이 「빠뜨렸나」로 읽고 채운다 — 그리고
 * 그 순간 링크 여섯이 404 인 화면이 공개된다(정책 셋 · 구독 입구 · 해지 입구 · 회사).
 *
 * ⭐⭐ **전에는 이 단정이 「비어 있다」 하나였다.** 그것이 지키던 것은 참이지만, 채우는 날
 * 가드가 **먼저 비켜서야** 했다 — 그리고 비켜선 가드는 나머지 칸들에 대해 아무 말도 하지
 * 않는다: 부착만 머지되고 최초 발행 연도와 정책 시행일이 비어 있는 판이 **초록으로** 나갈 수
 * 있었다. ⇒ 단정을 **묶음으로** 바꾼다: 비어 있거나, 아니면 같은 창에서 참이 되는 칸 전부와
 * **함께** 선다. ⛔ 가드를 걷는 일이 컷오버의 한 단계가 되지 않게 하는 것이 요점이다.
 *
 * ⭕ 이 단정이 배달 저장소 쪽 AC5(「`routes` 가 공개 전환 전에는 비어 있다 — **테스트나
 * 주석이 그 이유를 든다**」)를 집행한다 — 정본이 여기라서 테스트도 여기 선다.
 */

/**
 * 부착이 **같은 창에서** 참으로 만드는 칸들 — 선언이고, 각 항에 **왜 같은 창인가**를 적는다.
 * ⛔ 수를 적지 않는다: 분모는 이 목록이다.
 */
const cutoverSlots: readonly {
  readonly name: string;
  readonly stands: boolean;
  readonly why: string;
}[] = [
  {
    name: 'FIRST_PUBLISHED',
    stands: FIRST_PUBLISHED !== null,
    why: '최초 발행 연도는 **부착된 해**다 — 과거의 사실이라 나중에 시계에서 뽑을 수 없고, 그날 적지 않으면 영영 근거가 없다',
  },
  {
    name: 'FIRST_PUBLISHED_EVIDENCE',
    stands: FIRST_PUBLISHED_EVIDENCE !== null,
    why: '그 해를 사실로 만드는 기록 — 연도만 적을 수 있게 두면 다음 사람이 그럴듯한 해를 적고 아무것도 빨개지지 않는다',
  },
  {
    name: 'POLICY_EFFECTIVE',
    stands: POLICY_EFFECTIVE !== null,
    why: '부착이 구독 입구를 **실제로 연다** — 푸터의 약속(「시행일이 박히기 전에는 받지 않는다」)이 그 순간 효력을 갖는다',
  },
  {
    name: 'POLICY_EFFECTIVE_EVIDENCE',
    stands: POLICY_EFFECTIVE_EVIDENCE !== null,
    why: '그 날을 사실로 만드는 기록 — 정책 산문의 판이고, 날짜만 적는 길을 막는 규율이 연도와 같다',
  },
];

/**
 * 묶음 판정 — ⭐ **순수하다**: 호스팅 값과 칸들의 상태를 받아 어긋난 자리를 낸다.
 *
 * ⚠️ 순수한 이유가 **음성 대조군**이다. 실물은 지금 한쪽 가지(비어 있다)만 밟으므로, 다른
 * 가지를 심은 입력으로 돌리지 않으면 그 가지는 **돈 적 없는 코드**다 — 그리고 돈 적 없는
 * 가드는 컷오버 날 처음 돌면서 틀린다. ⇒ 같은 손을 심은 입력에도 돌린다.
 */
function cutoverFaults(
  value: Record<string, unknown>,
  slots: readonly { readonly name: string; readonly stands: boolean }[],
): string[] {
  const routes = value['routes'];
  // ⭕ 비어 있는 것은 **결정**이다 — 어긋난 자리가 0 이다.
  if (routes === undefined) return [];

  const faults: string[] = [];

  // ⭐ 맨 도메인 **하나**다 — `www` 는 선언이 든 적이 없고, 들이려면 그 주소로 오는 요청을
  //   어디로 보낼지가 먼저 결정이다. ⛔ 조용히 는 칸을 두지 않는다.
  if (!Array.isArray(routes) || routes.length !== 1) {
    faults.push('routes: 선언이 한 칸이 아니다 — 맨 도메인 하나만 붙는다');
    return faults;
  }

  const route = routes[0] as Record<string, unknown>;
  // ⛔ 호스트를 손으로 적지 않는다 — **발행 출처에서 유도한다.** 두 자리에 적으면 갈라지고,
  //   갈라진 날 색인 선언과 서빙이 다른 주소를 가리킨다.
  const expected = new URL(SITE_ORIGIN).host;
  if (route['pattern'] !== expected) {
    faults.push(`routes: 붙는 주소가 발행 출처와 다르다 — ${String(route['pattern'])}`);
  }
  // ⚠️ `custom_domain` 이 참이어야 **그 영역의 레코드로** 선다. 빠뜨리면 경로 패턴으로
  //   읽혀 부착이 일어나지 않고, 그 실패는 빌드에서 아무 표시도 남기지 않는다.
  if (route['custom_domain'] !== true) {
    faults.push('routes: 커스텀 도메인 부착이 아니다 — 경로 패턴으로 읽힌다');
  }

  // ⭐⭐ **부착이 「페이지 요청이 워커를 거치지 않는다」를 깨뜨리지 않는다** — 그 문장은
  //   카탈로그와 페이지 코드가 언어 협상을 기각한 근거이고, 부착하는 날 워커를 함께 세우면
  //   그 둘이 **같이** 거짓이 된다.
  if (value['main'] !== undefined) faults.push('main: 부착과 함께 워커가 섰다 — 페이지 요청이 워커를 거치게 된다');
  if (value['workers_dev'] !== false) faults.push('workers_dev: 부착과 함께 벤더 주소가 열렸다');

  for (const slot of slots) {
    if (!slot.stands) faults.push(`${slot.name}: 부착은 섰는데 이 칸이 비어 있다`);
  }
  return faults;
}

test('AC5 (negative) — routes 는 비어 있거나 부착의 칸 전부와 함께 선다', () => {
  // ⛔ 빈칸이 **말 없이** 있지 않다 — 주석이 사유를 든다(선언하지 않은 것은 미판정이다).
  assert.match(hosting(), /routes/, 'routes 가 왜 없는지 적힌 자리가 없다');

  const standing = cutoverSlots.map(({ name, stands }) => ({ name, stands }));
  assert.deepEqual(cutoverFaults(hostingValue(), standing), [], '실물이 어긋나 있다');

  // 각 항에 사유가 있다 — 칸이 늘면 사유가 따라오지 않고는 초록이 되지 않는다.
  for (const { name, why } of cutoverSlots) assert.ok(why.length >= 12, `부착의 칸 ${name} 에 사유가 없다`);

  const attached = { ...hostingValue(), routes: [{ pattern: new URL(SITE_ORIGIN).host, custom_domain: true }] };
  const empty = cutoverSlots.map(({ name }) => ({ name, stands: false }));
  const filled = cutoverSlots.map(({ name }) => ({ name, stands: true }));

  // ⭐⭐ **부착만 머지하면 빨갛다** — 칸마다 **이름이 불린다**(어느 칸이 비었는지 말하지
  //   않는 빨강은 컷오버 날 사람을 멈춰 세우기만 한다).
  const alone = cutoverFaults(attached, empty);
  for (const { name } of cutoverSlots) {
    assert.ok(alone.some((fault) => fault.startsWith(`${name}:`)), `부착만 섰는데 ${name} 을 부르지 않는다`);
  }

  // ⭕ **그리고 전부 서면 초록이다** — 그날 이 가드를 걷는 일이 한 단계가 되지 않는다.
  assert.deepEqual(cutoverFaults(attached, filled), [], '칸이 전부 섰는데도 빨갛다 — 그날 가드를 걷게 된다');

  // 음성 대조군 셋 — 심은 어긋남마다 빨갛다.
  assert.notDeepEqual(
    cutoverFaults({ ...attached, routes: [{ pattern: 'example.invalid', custom_domain: true }] }, filled),
    [],
    '발행 출처와 다른 주소를 붙였는데 초록이다',
  );
  assert.notDeepEqual(
    cutoverFaults({ ...attached, routes: [{ pattern: new URL(SITE_ORIGIN).host }] }, filled),
    [],
    '커스텀 도메인 부착이 아닌데 초록이다',
  );
  assert.notDeepEqual(
    cutoverFaults({ ...attached, main: 'src/worker.ts' }, filled),
    [],
    '부착과 함께 워커가 섰는데 초록이다',
  );
});

/**
 * ⭐ **이 선언의 정본이 여기라는 것** — 배달이 공개 저장소로 나르고, 받는 쪽에서 손으로
 * 고치지 않는다(다음 배달이 되돌린다). ⚠️ 받는 쪽 선언표를 여기서 읽지 않는다 — CI 에
 * 다른 저장소 의존을 심는 길이고, 이 저장소가 같은 사유로 두 번 기각했다. ⇒ 무는 것은
 * **그 사실이 이 파일에 적혀 있는가**다: 적혀 있지 않으면 다음 사람이 받는 쪽에서 고친다.
 */
test('AC4 — 선언이 자기 정본과 배달을 밝힌다', () => {
  for (const mark of ['배달', '정본']) {
    assert.ok(hosting().includes(mark), `호스팅 선언에 「${mark}」 이 적혀 있지 않다`);
  }
});

/**
 * ⭐⭐ **AC3 — 루트가 헤더를 보지 않는다.** 협상이 0 이라는 것은 **주소 하나가 한 언어를
 * 가리킨다**는 뜻이고, 헤더로 갈라지면 같은 주소를 공유한 사람과 공유받은 사람이 **다른
 * 화면**을 받는다. 보고서를 주소로 옮기는 제품에서 그것은 기능이 아니라 결함이다.
 */
const negotiationTokens: readonly { readonly source: string; readonly why: string }[] = [
  { source: ['accept', '-language'].join(''), why: '요청 헤더로 언어를 고르는 자리 — 협상 그 자체다' },
  { source: ['va', 'ry'].join(''), why: '응답이 헤더마다 갈린다는 선언 — 갈리는 응답이 있다는 뜻이다' },
];

/**
 * 리다이렉트 행마다의 **사유** — ⭐ 선언은 `site.ts` 가 들고 사유는 여기 산다.
 *
 * ⚠️ **나눈 이유가 금칙이다**: `site.ts` 는 발행되는 화면 코드라 한글 리터럴이 금칙이고
 * (주석은 무죄다), 사유를 기계가 묻게 하려면 **값**이어야 한다. ⇒ 값은 테스트에 두고
 * 가드가 **1:1** 을 단정한다 — 행이 늘면 사유가 따라오지 않고는 초록이 되지 않는다.
 */
const redirectReasons: Readonly<Record<string, string>> = {
  [ROOT_PATH]:
    '루트가 기본 로케일로 간다 — 헤더를 보지 않으므로 무조건이고, 목적지가 결정이라 302 다',
  [COMPANY_PATH]:
    '푸터의 회사 링크가 나가는 문 — 절대 주소를 발행본에 박지 않고, 남의 자리라 302 다',
  [CHECKOUT_PATH]:
    '구독 입구가 나가는 문 — 같은 규율이고, 벤더가 링크를 다시 내면 주소가 바뀌므로 302 다',
  [PORTAL_PATH]:
    '해지 입구가 나가는 문 — 구독 입구와 같은 규율이고 방향이 반대다. 가입한 길로 그만둘 수 있어야 한다',
};

/** 선언 → 실제로 쓰이는 규칙 줄들. 발행되는 바이트에서 거둔다 — 선언을 두 번 세지 않는다. */
const redirectRules = (): string[][] =>
  redirectsFile()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split(/\s+/));

test('AC3 (negative) — 호스팅 선언 전수에 헤더 분기가 0 이다', () => {
  const subjects: Record<string, string> = {
    [HOSTING_FILE]: hosting(),
    _redirects: redirectsFile(),
  };
  for (const [name, text] of Object.entries(subjects)) {
    for (const { source, why } of negotiationTokens) {
      assert.doesNotMatch(text, new RegExp(source, 'i'), `${name}: 헤더 분기가 섰다 — ${source} (${why})`);
    }
  }
});

test('AC5 — ⭐ 루트의 성질은 **루트 행에** 선다: 한 곳으로 · 302', () => {
  const rules = redirectRules();
  assert.ok(rules.length > 0, '리다이렉트 규칙이 0 이다');

  // ⚠️ 「전수가 같은 대상」이 아니라 **루트 행 하나**를 묻는다. 전에는 행이 하나라 둘이
  //    겹쳐 있었고, 그 겹침은 둘째 행을 못 들이면서 아무것도 더 지키지 못했다.
  const root = rules.filter((rule) => rule[0] === ROOT_PATH);
  assert.equal(root.length, 1, '루트 규칙이 하나가 아니다 — 무조건이 아니다');
  assert.equal(root[0]![1], documentPath(DEFAULT_LOCALE, 'page'), '루트가 기본 로케일로 가지 않는다');

  // ⚠️ 영구가 아니다 — 목적지는 **결정**이고, 301 은 브라우저가 오래 캐시해서 그 결정이
  //    바뀐 날 돌아온 방문자에게 보이지 않는다. ⭐ 그 사유는 행마다 같아서 전수로 묻는다.
  for (const rule of rules) assert.equal(rule[2], '302', `${rule[0]}: 영구 리다이렉트다 — 되돌릴 수 없는 캐시는 지키지 못할 약속이다`);
});

test('AC2 (negative) — 행마다 사유가 있다: 선언과 사유가 1:1 이다', () => {
  const froms = REDIRECTS.map((rule) => rule.from);
  assert.deepEqual(froms, [...new Set(froms)], '같은 자리를 두 번 선언했다 — 둘째 행은 영영 안 쓰인다');
  assert.deepEqual(froms.sort(), Object.keys(redirectReasons).sort(), '선언과 사유가 어긋난다 — 행이 늘면 사유가 따라온다');
  for (const [from, why] of Object.entries(redirectReasons))
    assert.ok(why.length >= 8, `리다이렉트 ${from} 에 사유가 없다`);

  // ⭐ 선언이 **실제 파일**과 1:1 인지도 묻는다 — 선언만 늘고 파일이 안 늘면 아무것도 안 간다.
  assert.deepEqual(redirectRules().map((rule) => rule[0]), REDIRECTS.map((rule) => rule.from));
});

test('AC1 — 회사 링크가 지정된 문을 지난다: 목적지가 선언에 있고 발행본에는 없다', () => {
  const company = redirectRules().find((rule) => rule[0] === COMPANY_PATH);
  assert.ok(company, `${COMPANY_PATH} 행이 없다 — 푸터가 가리키는 자리가 비어 있다`);
  assert.equal(company![1], COMPANY_SITE);

  // ⭐⭐ **발행본에는 그 주소가 0 이다** — 화면은 상대 경로를 가리키고 선언이 나른다.
  const documents = renderAll(readFileSync(join(ROOT, TEMPLATE_FILE), 'utf8'));
  for (const [locale, html] of Object.entries(documents)) {
    assert.ok(!html.includes(COMPANY_SITE), `${locale}: 발행본에 회사 주소가 박혔다 — 문을 지나지 않는다`);
    assert.match(html, new RegExp(`href="${COMPANY_PATH}"[^>]*target="_blank"`), `${locale}: 회사 링크가 새 창으로 열리지 않는다`);
    assert.match(html, new RegExp(`href="${COMPANY_PATH}"[^>]*rel="noopener"`), `${locale}: 새 창 링크에 noopener 가 없다`);

    // ⭐⭐ **새 창이 말없이 열리지 않는다** — 시각으로는 숨고 보조기술에는 들린다.
    //    ⛔ 문구를 여기 적지 않는다: 카탈로그에서 받는다(적으면 사본이 하나 는다).
    const notice = CATALOG[locale as Locale].page.footer.newWindow;
    assert.ok(notice.length > 0, `${locale}: 새 창 문구가 비었다`);
    assert.match(
      html,
      new RegExp(`${COMPANY_PATH}[\\s\\S]{0,200}visually-hidden[^>]*>[^<]*${notice}`),
      `${locale}: 새 창이라는 사실이 보조기술에 들리지 않는다`,
    );
  }
});

/**
 * ⭐⭐ **AC5 — robots 규칙이 로케일마다 갈리지 않는다.** 한쪽만 막으면 그 로케일이 **조용히
 * 사라지고** 화면에는 아무 표시도 남지 않는다 — 색인에서만 없어진다.
 */
const robotsDirectives = (html: string): string[] =>
  [...html.matchAll(/<meta\s+name="robots"[^>]*content="([^"]*)"/gi)].map((match) => match[1]!).sort();

test('AC5 (negative) — robots 규칙이 두 로케일에서 같다: 한쪽만 바꾸면 빨갛다', () => {
  // ⛔ 규칙이 **경로를 가르지 않는다** — 로케일 접두가 robots 에 한 번도 적히지 않는다.
  for (const locale of LOCALES) {
    // ⭐ 분모가 문서 × 로케일이다 — 한 문서만 보면 둘째 문서의 로케일 차별을 못 본다.
    for (const doc of DOCUMENTS) {
      assert.ok(
        !robotsTxt().includes(documentPath(locale, doc)),
        `robots 가 ${locale}/${doc} 을 따로 다룬다`,
      );
    }
  }

  const documents = renderAll(readFileSync(join(ROOT, TEMPLATE_FILE), 'utf8'));
  const directives = LOCALES.map((locale) => robotsDirectives(documents[locale]));
  for (const declared of directives) {
    assert.deepEqual(declared, directives[0]!, '두 로케일의 meta robots 가 다르다');
  }

  // ⭐ 음성 대조군 — 한쪽에만 심으면 빨갛다. ⚠️ 지금 둘 다 비어 있어서 **이 대조군이 없으면
  //   단정이 아무 말도 하지 않는다**(빈 것 둘은 언제나 같다).
  const planted = robotsDirectives(
    documents[LOCALES[0]].replace('</head>', '  <meta name="robots" content="noindex">\n</head>'),
  );
  assert.notDeepEqual(planted, directives[0]!, 'noindex 를 심었는데 같다고 한다 — 가드가 죽었다');
});

/**
 * ⭐⭐ **AC6 · AC7 — 시작은 기록이고 끝은 시계다.**
 *
 * 끝 연도는 빌드가 UTC 로 주입하고(그쪽 가드가 문다), 시작 연도는 **과거의 사실**이라
 * 시계에서 뽑을 수 없다 — 뽑으면 그해의 현재 연도가 되어 매년 거짓이 된다. ⇒ 리터럴이고,
 * ⛔ 리터럴은 **근거와 함께** 선다: 연도만 적을 수 있게 두면 다음 사람이 그럴듯한 해를 적고
 * 그 값은 틀려도 아무것도 빨개지지 않는다.
 */
/**
 * 사람이 **그날 박는 리터럴들** — ⭐ 꼴이 다르고(연도 하나 · 날짜 하나) 규율은 같다:
 * 리터럴이고, 그 자리에 시계가 없다. ⛔ 수를 적지 않는다 — 분모는 이 목록이다.
 */
const stampedLiterals: readonly { readonly name: string; readonly shape: RegExp; readonly why: string }[] = [
  {
    name: 'FIRST_PUBLISHED',
    shape: /^(null|\d{4})$/,
    why: '부착된 해 — 과거의 사실이라 시계에서 뽑으면 그해의 현재 연도가 되어 매년 거짓이 된다',
  },
  {
    name: 'POLICY_EFFECTIVE',
    shape: /^(null|'\d{4}-\d{2}-\d{2}')$/,
    why: '사람이 고른 날 — 시계에서 뽑으면 배포한 날이 된다. 꼴이 로케일 불변이어야 두 벌이 같은 바이트를 받는다',
  },
];

test('AC6 (negative) — 그날 박는 칸이 리터럴이고, 그 자리에 시계가 없다', () => {
  const source = readFileSync(join(ROOT, 'src', 'publisher.ts'), 'utf8');
  for (const { name, shape, why } of stampedLiterals) {
    assert.ok(why.length >= 12, `${name} 에 사유가 없다`);
    const declaration = new RegExp(`export const ${name}[^=]*=\\s*([^;]*);`).exec(source)?.[1]?.trim();
    assert.ok(declaration !== undefined, `${name} 선언을 찾지 못했다`);
    assert.match(declaration, shape, `${name} 이 리터럴이 아니다 — ${declaration}`);
    for (const clock of ['Date', 'getUTCFullYear', 'now']) {
      assert.ok(!declaration.includes(clock), `${name} 을 시계에서 뽑는다 — ${clock}`);
    }
  }
});

/**
 * ⭐ **값과 근거가 쌍이다** — 둘이고 규율이 같아 전수로 돈다. ⛔ 값만 적을 수 있게 두면
 * 다음 사람이 그럴듯한 값을 적고, 그 값은 틀려도 아무것도 빨개지지 않는다.
 */
const stampedPairs: readonly {
  readonly name: string;
  readonly value: number | string | null;
  readonly evidence: string | null;
}[] = [
  { name: '최초 발행 연도', value: FIRST_PUBLISHED, evidence: FIRST_PUBLISHED_EVIDENCE },
  { name: '정책 시행일', value: POLICY_EFFECTIVE, evidence: POLICY_EFFECTIVE_EVIDENCE },
];

test('AC7 (negative) — 값과 근거가 함께 서거나 함께 비어 있다', () => {
  for (const { name, value, evidence } of stampedPairs) {
    assert.equal(
      value === null,
      evidence === null,
      `${name}: 값과 근거 중 하나만 서 있다 — 근거 없는 값이거나, 가리킬 값이 없는 근거다`,
    );
    if (value !== null) {
      assert.ok((evidence ?? '').length >= 12, `${name}: 근거가 너무 짧다 — 어느 기록이 그것을 사실로 만드는지 적는다`);
    }
  }

  if (FIRST_PUBLISHED !== null) {
    assert.ok(FIRST_PUBLISHED <= new Date().getUTCFullYear(), '시작 연도가 미래다');
  }
  // ⚠️ 시행일에는 **미래 금지가 없다** — 정책은 앞으로 오는 날부터 시행될 수 있고, 그것이
  //   정상이다. ⬜ 「그 날이 지났는가」는 발행 표면이 말할 일이 아니라 **봉투가 말한다**.
});
