/**
 * 로케일 둘의 AC — **하드코딩 한글 0 · 두 벌의 키 집합이 같다 · 협상 코드 0.**
 *
 * ⭐⭐ **왜 「타입이 막는다」로 끝나지 않는가.** 번역 한 벌이 `Strings` 를 구현하므로 키가
 * 빠지면 `tsc` 가 막는다 — 그런데 타입이 **못 보는 실패 모양**이 둘 있다: ⑴ 키는 있고
 * 값이 **빈 문자열**인 자리 ⑵ 키는 있고 값이 **옮기지 않은 한글**인 자리(베껴 붙인 뒤
 * 번역을 잊은 그 줄). 둘 다 타입으로는 참이고 화면에서는 거짓이다. ⇒ 아래가 그 둘을 문다.
 *
 * ⭐ **문구를 테스트에 적지 않는다** — 단정은 전부 **두 벌을 돌며 유도**한다. 자구를 여기
 * 적으면 사본이 하나 늘고, 그 사본이 갈라지는 것이 이 제품이 재는 결함이다.
 *
 * ⚠️ **분모가 아직 개방 목록에서 유도되지 않는다.** 로케일 분모의 정본은 공개 배달
 * 저장소의 `config/allowed-countries.yml`(`doc_locale` 의 합집합)이고, 그쪽 가드 축자가
 * 「분모는 config 에서 **유도**하고 테스트에 수를 적지 않는다」다. ⛔ 그 파일의 사본을 여기
 * 두지 않는다 — ⇒ 유도하는 모양은 **코드 이사 뒤 한 저장소에서** 선다. 그래서 아래도
 * **로케일 수를 적지 않는다**: 분모는 `LOCALES` 에서 받고, 그 상수가 유도의 결과로 바뀐다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReport } from './report.ts';
import { unjudgeableScreen } from './screens.ts';
import { CATALOG, LOCALES, stringsFor, type Strings } from './strings.ts';
import type { Unjudgeable } from './outcome.ts';
import {
  DETAIL_REASONS,
  REASON_CODES,
  SCHEMA_VERSION,
  type Entitlement,
  type EntitlementDetail,
  type Measurement,
} from '../../verifier/src/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

/* ────────────────────────────── AC1 — 하드코딩 한글 0 ────────────────────────────── */

/**
 * ⭐⭐ **분모 — 발행되는 화면 코드.** 테스트는 분모가 아니다: 테스트의 이름이 곧 AC 문장이고
 * 그것은 한글로 선다(기존 밖으로 나가는 주소 금칙이 같은 자리에 같은 사유를 적어 뒀다 —
 * 「발행되는 것은 shippedSrc 이고, 금칙은 거기만큼 넓다」).
 */
const shippedSrc = (): string[] =>
  readdirSync(join(ROOT, 'src'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
    .map((name) => `src/${name}`);

/** 분모 **밖**임을 사유와 함께 선언한 것 — ⭐ **한 자리뿐**이다. */
const hangulAllowed: readonly { readonly file: string; readonly why: string }[] = [
  {
    file: 'src/strings-ko.ts',
    why: 'ko 정본 — 한글이 사는 자리가 여기 하나라는 것이 이 가드의 요점이다. 넓히면 가드가 아무 말도 하지 않는다',
  },
];

/**
 * 주석을 벗긴 코드 — **본문 언어는 규약 대상이 아니다.** 주석은 다음 사람에게 쓰는 것이고,
 * 화면에 가지 않는다.
 *
 * ⚠️ 이 벗기기는 **문자열 안의 `//` 를 모른다** — 그런데 여기서 안전한 **근거**가 있다:
 * 밖으로 나가는 주소 금칙이 화면 코드의 `//` 문자열을 이미 0 으로 만들어 뒀다(프로토콜
 * 상대 주소 금칙 — `boundary.test.ts`). 정규식의 `\\/\\/` 에는 `//` 가 **문자로 나타나지
 * 않는다.** ⇒ 가드 둘이 맞물려 있는 자리라, 그 금칙이 걷히면 이 벗기기도 함께 봐야 한다.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join('\n');
}

/**
 * 주석을 벗긴 뒤 한글이 남는 파일 전수 — 선언된 자리는 비켜 간다.
 *
 * ⚠️ 분모 밖 선언을 **인자로** 받는다: 음성 대조군이 **같은 유도**를 빈 선언으로 돌려야
 * 「선언이 없으면 빨갛다」가 가드의 증거가 된다(하네스를 따로 짜면 그 둘이 갈라진다).
 */
const hardcodedHangul = (
  files: readonly string[],
  allowed: readonly { readonly file: string }[] = hangulAllowed,
): string[] =>
  files
    .filter((file) => !allowed.some((entry) => entry.file === file))
    .filter((file) => HANGUL.test(withoutComments(read(file))));

test('AC1 (negative) — 화면 코드에 하드코딩 한글이 0: 주석을 벗긴 뒤 남는 것이 없다', () => {
  assert.deepEqual(hardcodedHangul(shippedSrc()), []);

  // ⭐ 벗기기가 **멀쩡한지**를 함께 문다 — 모든 것을 벗기는 고장난 벗기기도 초록이다.
  assert.ok(HANGUL.test(withoutComments(read('src/strings-ko.ts'))), '정본에서도 한글이 안 보인다 — 벗기기가 고장났다');
  assert.ok(!HANGUL.test(withoutComments('// 주석 하나\nexport const a = 1;\n')), '주석이 벗겨지지 않았다');
  assert.ok(!HANGUL.test(withoutComments('/* 블록\n * 주석 */\nexport const b = 2;\n')), '블록 주석이 벗겨지지 않았다');

  // ⭐ 선언을 걷으면 빨갛다 — 같은 유도를 **빈 선언**으로 돌린다: 그래야 초록의 근거가
  //    「한글이 없다」가 아니라 「선언된 한 자리 말고는 없다」임이 보인다.
  assert.deepEqual(hardcodedHangul(shippedSrc(), []), ['src/strings-ko.ts'], '빈 선언으로 돌렸는데 정본이 안 걸린다');

  // ⛔ 번역 벌은 분모 밖이 아니다 — 거기 들어가면 「옮기지 않은 한글」이 조용히 통과한다.
  assert.ok(
    !hangulAllowed.some((allowed) => allowed.file === 'src/strings-en.ts'),
    '번역 벌이 분모 밖에 있다 — 그러면 가드가 죽는다',
  );

  for (const { file, why } of hangulAllowed) {
    assert.ok(shippedSrc().includes(file), `분모 밖 선언이 가리키는 ${file} 이 없다 — 낡은 선언이다`);
    assert.ok(why.length >= 8, `분모 밖 선언 ${file} 에 사유가 없다`);
  }
});

/* ──────────────────── AC2 (키 집합) — 두 벌이 같은 자리를 채운다 ──────────────────── */

type Leaf = { readonly path: string; readonly value: string };

/** 뷰모델 층을 **실제로 돌려** 거둔 문자열 전수 — 함수 잎을 진짜 인자로 깨운다. */
function renderedLeaves(strings: Strings): Leaf[] {
  const leaves: Leaf[] = [];
  const push = (path: string, value: unknown): void => {
    if (typeof value === 'string') leaves.push({ path, value });
    else if (Array.isArray(value)) value.forEach((item, at) => push(`${path}[${at}]`, item));
    else if (typeof value === 'object' && value !== null) {
      for (const [key, inner] of Object.entries(value)) push(`${path}.${key}`, inner);
    }
  };

  for (const origin of ['url', 'fragment'] as const) {
    for (const dirty of [0, 3, null]) {
      push(`report(${origin},${String(dirty)})`, buildReport({ ...measurement, dirty }, origin, strings));
    }
  }
  push('report(unnamed)', buildReport(unnamedRepo(), 'url', strings));
  UNJUDGEABLE.forEach((outcome, at) => {
    push(`screen[${at}](${outcome.kind})`, unjudgeableScreen(outcome, strings, () => NOW));
  });
  // ⭐ 고지 — **사실**을 실어 돌린다: 그 절의 문구는 자격이 실려야 그려지고, 실리지 않으면
  //   위의 단정들이 그 절에 대해 **아무 말도 하지 않는다**(키는 맞고 화면은 비는 그 모양).
  //   ⚠️ 사실 자신(`head.entitlement`)은 로케일과 무관하다 — 위의 보고 전수가 그것도 거두므로
  //   경로 비교가 그 무관함까지 함께 받는다.
  ENTITLEMENTS.forEach((entitlement, at) => {
    push(`notice[${at}]`, buildReport(measurement, 'url', strings, entitlement).head.entitlementLines);
  });
  push('entry', strings.entry);
  push('scaffold.copied', strings.scaffold.copied('graduand.json'));
  push('scaffold.copyFailed', strings.scaffold.copyFailed);
  return leaves;
}

test('AC2 — 두 벌의 키 집합이 같다: 화면에 서는 자리가 하나도 어긋나지 않는다', () => {
  // ⛔ 로케일 수를 적지 않는다 — 분모는 `LOCALES` 에서 받는다(그 상수가 유도의 자리다).
  assert.deepEqual(Object.keys(CATALOG).sort(), [...LOCALES].sort(), '출하된 벌과 열거가 어긋난다');
  assert.ok(LOCALES.length >= 2, '로케일이 하나다 — 패리티를 물을 상대가 없다');
  assert.equal(LOCALES[0], 'ko', '정본이 첫 자리가 아니다');

  for (const locale of LOCALES) {
    assert.equal(CATALOG[locale].locale, locale, `${locale}: 벌이 자기를 다르게 말한다`);
    assert.equal(stringsFor(locale), CATALOG[locale], `${locale}: stringsFor 가 다른 벌을 준다`);
  }

  // 자리의 **경로**가 같다 — 뷰모델을 실제로 돌려 거둔 잎의 경로 집합으로 센다.
  const paths = LOCALES.map((locale) => renderedLeaves(CATALOG[locale]).map((leaf) => leaf.path));
  const canon = paths[0]!;
  for (let at = 1; at < paths.length; at += 1) {
    assert.deepEqual(paths[at], canon, `${LOCALES[at]}: 화면에 서는 자리가 정본과 다르다`);
  }
  assert.ok(canon.length > 0, '거둔 자리가 0 이다 — 하네스가 고장났다');
});

test('AC2 — 빈 문구가 0 이다: 타입이 못 보는 자리를 두 벌 전수로 문다', () => {
  for (const locale of LOCALES) {
    const blank = renderedLeaves(CATALOG[locale]).filter((leaf) => leaf.value.trim() === '');
    assert.deepEqual(blank, [], `${locale}: 빈 문구가 있다 — 키는 있고 말은 없다`);
  }
});

test('AC2 — 번역 벌에 한글이 0 이다: 옮기지 않은 줄이 여기서 보인다', () => {
  // ⭐⭐ 이것이 **타입이 못 보는 실패**다 — 정본을 베껴 붙이고 번역을 잊으면 키도 인자도
  // 맞아서 `tsc` 가 초록인데, 화면에는 영문 문서에 한글 한 줄이 선다.
  for (const locale of LOCALES.filter((l) => l !== 'ko')) {
    const untranslated = renderedLeaves(CATALOG[locale])
      .filter((leaf) => HANGUL.test(leaf.value))
      .map((leaf) => leaf.path);
    assert.deepEqual(untranslated, [], `${locale}: 옮기지 않은 줄이 있다`);
  }

  // 대조군 — 하네스가 아무 벌이나 초록으로 만들지 않는다.
  const hangulInCanon = renderedLeaves(CATALOG.ko).filter((leaf) => HANGUL.test(leaf.value));
  assert.notDeepEqual(hangulInCanon, [], '정본에서도 한글이 안 보인다 — 하네스가 고장났다');
});

test('AC2 — 모르는 lang 은 조용히 정본으로 접히지 않는다', () => {
  for (const unknown of ['', 'ja', 'en-US', 'ko-KR', 'kr']) {
    assert.throws(() => stringsFor(unknown), /no catalog for lang/, `${JSON.stringify(unknown)} 가 조용히 통과했다`);
  }
  // 발행본이 선언한 언어는 **아는 값**이어야 한다 — 아니면 페이지가 그 자리에서 던진다.
  const lang = /<html[^>]*\blang="([^"]*)"/.exec(read('index.html'))?.[1];
  assert.ok(lang !== undefined, 'index.html 이 lang 을 선언하지 않았다');
  assert.doesNotThrow(() => stringsFor(lang), `발행본의 lang "${lang}" 에 카탈로그가 없다`);
});

/* ───────────────────────────── AC5 — 협상 코드 0 ───────────────────────────── */

/**
 * ⛔ **협상이 없다.** 서버 협상은 **우리 코드가 도는 서버가 0** 이라 설 자리가 없고,
 * 브라우저 쪽 분기도 **같은 협상**이다: 주소가 가리키는 문서와 다른 언어가 그려지면 그
 * 주소를 공유한 사람과 공유받은 사람이 **다른 화면**을 받는다. 보고서를 주소로 옮기는
 * 제품에서 그것은 기능이 아니라 결함이다.
 */
const negotiationPatterns: readonly { readonly id: string; readonly source: string; readonly why: string }[] = [
  {
    id: 'accept-language',
    source: ['accept', '-language'].join(''),
    why: '요청 헤더 협상 — 우리 코드가 도는 서버가 0 이라 애초에 설 자리가 없다',
  },
  {
    id: 'navigator-language',
    source: ['navigator\\.', 'languages?'].join(''),
    why: '브라우저 쪽 협상 — 주소 하나가 사람마다 다른 언어를 그린다',
  },
  {
    id: 'redirect',
    source: ['location\\.', '(replace|assign|href\\s*=)'].join(''),
    why: '이동으로 로케일을 고르는 길 — 협상 302 의 브라우저 판이다',
  },
];

test('AC5 (negative) — 협상 코드가 0 이다: 심으면 빨갛다', () => {
  const leaks = (text: string): string[] =>
    negotiationPatterns.filter(({ source }) => new RegExp(source, 'i').test(text)).map(({ id }) => id);

  // ⭐ 금칙은 **코드**에 걸린다 — 금칙을 **설명하는** 주석은 무죄다(AC1 의 「주석은 무죄」와
  //   같은 원리이고, 같은 벗기기를 쓴다). ⚠️ 실제로 이 가드가 자기 설명에 걸렸다: 협상을
  //   기각한 **이유**를 적은 주석이 금칙 둘을 품는다. 산문을 지우는 쪽이 아니라 분모를
  //   바로잡는 쪽이 맞다 — 고치는 것은 잘못 선언한 분모이지 산문이 아니다.
  for (const file of shippedSrc()) {
    assert.deepEqual(leaks(withoutComments(read(file))), [], `${file} 에 협상 코드가 있다`);
  }
  // `index.html` 은 주석이 0 이라 그대로 본다 — 벗기기를 HTML 에 돌리면 마크업이 상한다.
  assert.doesNotMatch(read('index.html'), /<!--/, 'index.html 에 주석이 생겼다 — 이 단정의 전제가 깨졌다');
  assert.deepEqual(leaks(read('index.html')), [], 'index.html 에 협상 코드가 있다');

  const planted = [
    `const want = ${['navigator', '.language'].join('')};`,
    `headers: { '${['accept', '-language'].join('')}': 'ko' }`,
    `${['location', '.replace'].join('')}('./en/');`,
  ];
  for (const sample of planted) {
    assert.notDeepEqual(leaks(sample), [], `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`);
  }

  for (const { id, why } of negotiationPatterns) {
    assert.ok(why.length >= 8, `금칙 ${id} 에 사유가 없다`);
  }
});

/* ───────────────────────────── 하네스의 고정 입력 ───────────────────────────── */

const NOW = new Date('2026-10-26T00:00:00.000Z');

const measurement: Measurement = {
  judgment: {
    v: SCHEMA_VERSION,
    repo: 'acme/widgets',
    commit: 'a3f8c1e2d4b5a6978877665544332211deadbeef',
    checks: [
      {
        id: 'refs',
        status: 'violation',
        reason: null,
        counts: { references: 4, unresolved: 1, excused: 0, external: 1, evidenceOmitted: 2 },
        evidence: [
          {
            file: 'README.md',
            line: 2,
            notation: 'markdown-link',
            raw: 'docs/missing.md',
            why: 'missing',
            tried: 'docs/missing.md',
          },
          { token: '--paper', file: 'tokens/tokens.css', line: 2, why: 'declared-divergence', reason: 'r' },
        ],
      },
      { id: 'ui-paths', status: 'pass', reason: null, counts: { declared: 1 }, evidence: [] },
      // ⭐ 사유 **전수**가 한 번은 그려진다 — 표 하나가 비면 위의 경로 비교가 그 자리에서 다르다.
      // ⚠️ 수를 **비우지 않는다** — 수가 없는 칸(자격이 막은 칸)의 빈 `countsLine` 은
      //    제품의 참이고(꼬리의 ` — ` 를 달지 않는 그 자리), 빈 문구 가드가 무는 것은
      //    **카탈로그의 빈 문구**다. 하네스가 그 모양을 쓰면 둘이 섞인다.
      ...REASON_CODES.map((reason, at) => ({
        id: `unjudged-${at}`,
        status: 'unjudged' as const,
        reason,
        counts: { declared: at },
        evidence: [],
      })),
    ],
  },
  source: 'github-api',
  measuredAt: '2026-10-25T12:00:00.000Z',
  verifier: { name: 'graduand', version: '0.0.0' },
  dirty: 0,
};

/** 저장소 이름을 읽지 못한 측정 — 머리의 대체 문구가 두 벌 모두에서 서는지. */
const unnamedRepo = (): Measurement => {
  const copy = structuredClone(measurement);
  copy.judgment.repo = null;
  return copy;
};

/**
 * 고지가 서는 자리 전수 — ⭐ **사유를 적지 않고 유도한다**(`DETAIL_REASONS` 의 키 전부).
 * 상태 넷(묻지 않음 · 묻지 못함 · 있음 · 없음)과 만기의 경계 넷(없음 · 당일 · 남음 · 넘김)이
 * 다 들어 있다: 빠진 갈래의 문구는 두 벌 중 한쪽이 비어 있어도 위의 단정들이 **아무 말도
 * 하지 않는다.**
 *
 * ⚠️ 만기 날짜는 위 봉투의 측정 시각을 기준으로 고른다 — 「오늘」을 읽지 않으므로 이
 * 하네스의 경계값은 봉투가 움직일 때만 움직인다.
 */
const ENTITLEMENTS: readonly (Entitlement | undefined)[] = [
  undefined,
  { state: 'unwired' },
  { state: 'entitled', expires: null },
  { state: 'entitled', expires: '2026-10-25' }, // 봉투의 날짜 그대로 — 남은 날 0
  { state: 'entitled', expires: '2026-12-01' },
  ...Object.keys(DETAIL_REASONS).map(
    (detail): Entitlement => ({ state: 'absent', detail: detail as EntitlementDetail, expires: '2026-10-01' }),
  ),
];

/** 판정 불가 갈래 전수 — 화면 일곱이 전부 두 벌에서 그려진다. */
const UNJUDGEABLE: readonly Unjudgeable[] = [
  { kind: 'unreadable', code: 'private-or-missing' },
  { kind: 'unreadable', code: 'tree-truncated' },
  { kind: 'rate-limited', resetAt: Math.floor(NOW.getTime() / 1000) + 600 },
  { kind: 'rate-limited', resetAt: null },
  { kind: 'version-mismatch', axis: 'schema', found: '9' },
  { kind: 'version-mismatch', axis: 'fragment', found: '9' },
  { kind: 'fragment-unreadable', message: 'checksum' },
  { kind: 'declaration-invalid', problems: ['ui: not an array'] },
  { kind: 'error', message: 'network' },
];
