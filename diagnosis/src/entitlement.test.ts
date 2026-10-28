/**
 * 자격 AC5 — **같은 스냅샷 · 같은 자격 인자 ⇒ 두 표면의 바이트가 같다.**
 *
 * ⭐⭐ 왜 이 단정이 이 패키지에 사는가: 「CI 와 페이지가 같은 수를 낸다」는 명제는 **두
 * 표면이 다 있는 자리**에서만 받을 수 있다. 판정기 패키지 혼자서는 「페이지가 판정한다」를
 * 흉내낼 수밖에 없고, 흉내는 사본이다 — 여기서는 페이지의 **실제 입구**(`diagnoseUrl`)가
 * 돈다.
 *
 * ⭐ 자격은 판정의 **인자**라, 시야(`peers`)와 똑같이 「같은 입력」의 일부다. 인자가 같으면
 * 바이트가 같고, 인자가 다르면 수가 달라진다 — 아래가 양쪽을 다 받는다.
 *
 * ⛔ 네트워크를 타지 않는다 — GitHub 도 벤더도 주입된 가짜다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diagnoseUrl } from './outcome.ts';
import {
  judgeSnapshot,
  loadGithubSnapshot,
  serializeJudgment,
  type Entitlement,
} from '../../verifier/src/index.ts';

const COMMIT = 'b7c4e9a1f2d3845607182930aabbccddeeff0011';

/** 편입 기록이 든 선언 — 격자의 분모가 여기서 온다. */
const DECLARATION = {
  ui: ['docs/', 'README.md'],
  admissions: { E1: { verifiers: ['refs'] }, E2: { verifiers: ['ui-paths'] } },
};

const FILES: Record<string, string> = {
  'README.md': '[guide](docs/guide.md)\n',
  'docs/guide.md': 'ok\n',
  'graduand.json': `${JSON.stringify(DECLARATION, null, 2)}\n`,
};

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

/** 픽스처를 서빙하는 가짜 GitHub API. */
function fakeGithub(): typeof fetch {
  const paths = Object.keys(FILES).sort();
  const shaOf = (path: string): string => `blob-${paths.indexOf(path)}`;
  const routes = new Map<string, unknown>([
    ['/repos/acme/widgets', { full_name: 'acme/widgets', default_branch: 'main' }],
    ['/repos/acme/widgets/commits/main', { sha: COMMIT }],
    [
      `/repos/acme/widgets/git/trees/${COMMIT}?recursive=1`,
      { truncated: false, tree: paths.map((path) => ({ path, type: 'blob', sha: shaOf(path) })) },
    ],
    ...paths.map((path): [string, unknown] => [
      `/repos/acme/widgets/git/blobs/${shaOf(path)}`,
      { content: b64(FILES[path]!), encoding: 'base64' },
    ]),
  ]);
  const impl = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body = routes.get(url.pathname + url.search);
    if (body === undefined) return Promise.resolve(new Response('not found', { status: 404 }));
    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  };
  return impl as typeof fetch;
}

/** 측정 명령 쪽의 판정 — 스냅샷을 쥐고 **같은 순수 함수 하나**를 부른다. */
async function viaCommand(entitlement: Entitlement | undefined): Promise<string> {
  const load = await loadGithubSnapshot({ repo: 'acme/widgets', fetch: fakeGithub() });
  return serializeJudgment(judgeSnapshot(load.snapshot, { entitlement }));
}

/** 페이지 쪽의 판정 — 페이지의 **실제 입구**를 그대로 쓴다. */
async function viaPage(entitlement: Entitlement | undefined): Promise<string> {
  const outcome = await diagnoseUrl({ repo: 'acme/widgets' }, { fetch: fakeGithub(), entitlement });
  assert.equal(outcome.kind, 'report', `보고서가 서지 않았다: ${outcome.kind}`);
  return serializeJudgment(outcome.measurement.judgment);
}

test('자격 AC5 — 같은 스냅샷·같은 자격 인자면 두 표면의 판정이 바이트 동일이다', async () => {
  const cases: (Entitlement | undefined)[] = [
    undefined, // 이 표면은 자격을 보지 않았다
    { state: 'entitled', expires: null },
    { state: 'absent', detail: 'not-configured', expires: null },
    { state: 'absent', detail: 'no-answer', expires: null },
  ];
  for (const entitlement of cases) {
    const [command, page] = await Promise.all([viaCommand(entitlement), viaPage(entitlement)]);
    assert.equal(command, page, `자격 ${JSON.stringify(entitlement)} 에서 두 표면이 갈라졌다`);
  }
});

test('자격 AC5 — 자격 인자가 다르면 수가 달라진다: 시야처럼 자격도 **입력**이다', async () => {
  const entitled = await viaPage({ state: 'entitled', expires: null });
  const none = await viaPage({ state: 'absent', detail: 'not-configured', expires: null });
  const unverifiable = await viaPage({ state: 'absent', detail: 'no-answer', expires: null });

  assert.notEqual(entitled, none, '자격이 수를 막지 않았다');
  assert.notEqual(none, unverifiable, '「없음」과 「확인 불가」가 같은 바이트다 — 뭉쳤다');
  assert.match(none, /no-entitlement/);
  assert.match(unverifiable, /entitlement-unverifiable/);
  // ⭕ 자격을 보지 않은 표면은 자격이 있는 표면과 **같은 수**를 낸다 — 생략은 막지 않는다.
  assert.equal(await viaPage(undefined), entitled);
});

/**
 * ─── 만기 고지 AC5 — **두 표면이 같은 「사실」에서 그린다** ───
 *
 * ⭐⭐ **이 절은 무엇을 무는지가 옮겨간 자리다.** 그전까지 여기서 받은 단정은 둘이었다 —
 * ⑴ 페이지의 고지 줄들이 측정 명령의 그 줄들과 **바이트 동일**이고 ⑵ 그 문구가 두 패키지의
 * 발행 코드에서 **한 파일**에만 있다. 그 꼴의 전제는 「정본이 **완성된 영문 문장**을 내고 두
 * 표면이 축자로 든다」였고, 화면 문구가 코드에 박혀 있던 동안에는 그것이 받을 수 있는
 * 단정의 전부였다(그 자리에 그 사실이 축자로 적혀 있었다: 「두 표면의 한 문장이 로케일
 * 분리보다 먼저다」).
 *
 * ⛔ **로케일이 둘이 되는 날 그 전제는 설 수 없다.** ko 정본 · en 번역이 서면 「두 표면의 한
 * 문장」은 ⑴ 한국어 화면에 영문 한 줄을 세우거나 ⑵ 로케일마다 갈라진다 — 둘 다 거짓이다.
 * ⇒ 정본이 내는 것이 **문장에서 사실로** 내려왔고(`entitlementNotice`), 단정도 같이 내려온다:
 *
 *   ⑴ **사실**이 두 표면에서 바이트 동일이다 — 걸리는 자리가 문장에서 사실로 옮겼다.
 *   ⑵ **사실을 세는 코드가 한 파일**이다 — 페이지는 날짜를 세지 않는다.
 *   ⑶ **문장은 로케일마다 한 파일**이다 — 「사본 0」을 자구가 아니라 **자리**로 묻는다.
 *
 * ⭐ 옛 단정을 **지운 것이 아니다.** ⑴ 은 같은 바이트 비교이고 대상만 내려왔다. ⑵ 는 옛
 * ⑵ 가 막으려던 것(「오늘만 참인 동일성」)을 그대로 막는다 — 자리가 하나에서 **로케일마다
 * 하나**로 늘었을 뿐이고, 그 셋 밖에 사본이 생기면 빨갛다. 그리고 그 둘을 잇는 것이
 * **침묵도 사실이 결정한다**는 단정이다: 사실이 같으면 세 표면이 같이 말하고 같이 침묵한다.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { buildReport, type CheckVM, type ReportVM } from './report.ts';
import { ko } from './strings-ko.ts';
import { en } from './strings-en.ts';
import { CATALOG, LOCALES, type Strings } from './strings.ts';

/** 두 절을 가로질러 센다 — 이 파일이 묻는 것은 자격이지 절의 가름이 아니다. */
const allChecks = (vm: ReportVM): CheckVM[] => [...vm.measured.checks, ...(vm.unmeasured?.checks ?? [])];
import {
  DETAIL_REASONS,
  ENTITLEMENT,
  FREE_VERIFIER_IDS,
  PAID_VERIFIER_IDS,
  describeEntitlement,
  describeExpiry,
  entitlementNotice,
  isCheckOf,
  utcDateOf,
  type EntitlementDetail,
  type EntitlementNotice,
} from '../../verifier/src/index.ts';

/**
 * 측정 시각을 고정한다 — 만기를 세는 「오늘」이 테스트 안에서 움직이지 않는다.
 *
 * ⚠️ **오늘이 아닌 날이어야 한다.** 봉투의 날짜가 마침 오늘이면 「봉투로 센다」와 「시계를
 * 읽는다」가 **같은 값**을 내고, 그날 하루는 아래 단정들이 아무것도 재지 않는다. 지난
 * 날짜로 못 박아 두면 그 공백이 영구히 닫힌다 — 아래 만기들은 모두 이 날짜 기준이다.
 */
const MEASURED_AT = '2026-09-15T08:30:00.000Z';
const ON_DATE = utcDateOf(MEASURED_AT);

/** 다음 날 — 「기준일이 움직이면 사실도 움직인다」는 대조군에만 쓴다. */
const nextDay = (date: string): string =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * 고지의 사실이 걸리는 자격 **전수** — 상태 넷(묻지 않음 · 묻지 못함 · 있음 · 없음)과 만기의
 * 경계(당일 · 남음 · 넘김 · 없음)가 다 들어 있다.
 */
const CASES: readonly (Entitlement | undefined)[] = [
  undefined, // 이 표면은 자격을 보지 않았다 — 고지도 0 줄이다
  { state: 'unwired' },
  { state: 'entitled', expires: null },
  { state: 'entitled', expires: ON_DATE }, // 만기 당일 — 남은 날 0
  { state: 'entitled', expires: '2026-09-30' },
  { state: 'absent', detail: 'past-expiry', expires: '2026-09-01' },
  { state: 'absent', detail: 'no-answer', expires: null },
];

/** 페이지의 실제 입구로 보고 뷰모델 하나 — 자격은 판정의 인자로, 로케일은 그 문서의 벌로. */
async function pageReport(entitlement: Entitlement | undefined, strings: Strings) {
  const outcome = await diagnoseUrl(
    { repo: 'acme/widgets' },
    { fetch: fakeGithub(), entitlement, now: () => new Date(MEASURED_AT) },
  );
  assert.equal(outcome.kind, 'report', `보고서가 서지 않았다: ${outcome.kind}`);
  assert.ok(outcome.kind === 'report');
  return buildReport(outcome.measurement, outcome.origin, strings, outcome.entitlement);
}

/** 측정 명령이 보고의 자격 절에 찍는 줄 전부 — **그 순서 그대로**가 그 표면의 고지다. */
const commandLines = (entitlement: Entitlement | undefined): string[] => [
  ...describeEntitlement(entitlement),
  ...describeExpiry(entitlement, ON_DATE),
];

test('만기 고지 AC5 — 두 표면이 같은 **사실**에서 그린다: 바이트 동일성이 사실에 걸린다', async () => {
  for (const entitlement of CASES) {
    const counted = entitlementNotice(entitlement, ON_DATE);
    for (const locale of LOCALES) {
      const vm = await pageReport(entitlement, CATALOG[locale]);
      // ⭐ **바이트** 동일이다 — 깊은 비교만으로는 「같은 모양」까지만 받는다.
      assert.equal(
        JSON.stringify(vm.head.entitlement),
        JSON.stringify(counted),
        `${locale} · ${JSON.stringify(entitlement)} 에서 두 표면의 사실이 갈라졌다`,
      );
    }
  }

  // ⭐ 로케일이 움직여도 사실은 **한 바이트도** 움직이지 않는다 — 움직이는 것은 문장이다.
  const facts = await Promise.all(
    LOCALES.map(async (locale) => JSON.stringify((await pageReport(CASES[3], CATALOG[locale])).head.entitlement)),
  );
  assert.equal(new Set(facts).size, 1, `로케일마다 사실이 다르다: ${facts.join(' | ')}`);

  // 하네스 대조군 — 기준일이 하루 움직이면 사실도 움직인다(위 단정이 공허하지 않다).
  const dated = { state: 'entitled', expires: ON_DATE } as const;
  assert.notDeepEqual(
    entitlementNotice(dated, ON_DATE),
    entitlementNotice(dated, nextDay(ON_DATE)),
    '기준일이 움직였는데 사실이 그대로다 — 세는 손이 죽었다',
  );
});

test('만기 고지 AC5 — **침묵도 사실이 결정한다**: 세 표면이 같이 말하고 같이 침묵한다', async () => {
  for (const entitlement of CASES) {
    const spoke = commandLines(entitlement).length > 0;
    for (const locale of LOCALES) {
      const lines = (await pageReport(entitlement, CATALOG[locale])).head.entitlementLines;
      assert.equal(
        lines.length > 0,
        spoke,
        `${locale} · ${JSON.stringify(entitlement)} — 한 표면은 말하고 한 표면은 침묵했다`,
      );
    }
  }
  // 분모에 **양쪽이** 있다 — 전부 말하거나 전부 침묵하는 목록이면 이 단정은 아무것도 재지 않는다.
  assert.ok(CASES.some((e) => commandLines(e).length > 0), '말하는 자격이 분모에 없다');
  assert.ok(CASES.some((e) => commandLines(e).length === 0), '침묵하는 자격이 분모에 없다');
});

test('만기 고지 AC2 (페이지) — 만기 당일은 「남은 날 0」이고 **아직 자격이 있다**: 두 로케일 다', async () => {
  for (const locale of LOCALES) {
    const vm = await pageReport({ state: 'entitled', expires: ON_DATE }, CATALOG[locale]);
    const { expiry } = vm.head.entitlement;
    assert.ok(expiry !== null, `${locale}: 만기가 사실에 없다`);
    assert.equal(expiry.daysLeft, 0, `${locale}: 만기 당일의 남은 날이 0 이 아니다`);
    assert.equal(expiry.pastExpiry, false, `${locale}: 만기 당일이 넘긴 것으로 읽혔다`);
    assert.equal(expiry.onDate, ON_DATE, `${locale}: 센 기준일이 봉투의 날짜가 아니다`);

    // ⭕ 수는 그대로 나온다 — 만기가 든 자격은 **막는** 자격이 아니다.
    assert.ok(allChecks(vm).length > 0);
    for (const check of allChecks(vm)) assert.notEqual(check.countsLine, '', `${locale}: 만기가 수를 막았다`);

    // ⭐ 그리고 그 사실이 **화면에 닿는다** — 사실이 맞아도 문장이 삼키면 고객은 듣지 못한다.
    //   남은 날이 다른 자격 · 넘긴 자격과 **줄이 달라지는지**로 센다(자구를 여기 적지 않는다).
    const later = await pageReport({ state: 'entitled', expires: '2026-09-30' }, CATALOG[locale]);
    const past = await pageReport({ state: 'entitled', expires: '2026-09-01' }, CATALOG[locale]);
    assert.notDeepEqual(vm.head.entitlementLines, later.head.entitlementLines, `${locale}: 남은 날이 화면에 없다`);
    assert.notDeepEqual(vm.head.entitlementLines, past.head.entitlementLines, `${locale}: 넘김 여부가 화면에 없다`);
  }
});

test('만기 고지 AC3 (페이지) — 넘긴 뒤의 화면에 「미판정 — 자격 없음」과 전환 경로가 함께 선다', async () => {
  for (const locale of LOCALES) {
    const vm = await pageReport({ state: 'absent', detail: 'past-expiry', expires: '2026-09-01' }, CATALOG[locale]);

    // 칸마다의 사유 문장 — 화면이 아는 사유의 그 표에서, 이 로케일의 벌로 온다.
    // ⚠️⚠️ **분모가 선언을 분모로 쓰는 축이다.** 전에는 칸 **전부**를 돌았고 그것이 참이던
    //   이유는 자격이 전부를 막았기 때문이다 — 그 가름이 축마다로 내려오면서(`judge.ts`)
    //   무료 축은 넘긴 만기와 무관하게 수를 낸다. ⛔ 걷어낸 단정은 0 이다: 아래 ⭕ 가
    //   그 무료 축을 **반대 방향으로** 문다.
    assert.ok(allChecks(vm).length > 0);
    const chosen = (ids: readonly string[]): CheckVM[] =>
      allChecks(vm).filter((check) => ids.some((id) => isCheckOf(id, check.id)));

    const paid = chosen(PAID_VERIFIER_IDS);
    assert.ok(paid.length > 0, `${locale}: 선언 구동 칸이 화면에 0 이다 — 이 단정이 비었다`);
    for (const check of paid) {
      assert.equal(check.status, 'unjudged');
      assert.match(check.reasonLine ?? '', /no-entitlement/, `${locale}: 칸의 사유가 「자격 없음」이 아니다`);
      assert.equal(check.countsLine, '', `${locale}: 수가 나왔다 — 막는 척이다`);
    }

    // ⭕ **무료 축은 넘긴 만기에도 수를 낸다** — 화면이 「참조 판정은 선언 없이도 수가
    //   나옵니다」로 팔고 있고, 이 줄이 그 문장의 기계 쪽이다.
    const free = chosen(FREE_VERIFIER_IDS);
    assert.ok(free.length > 0, `${locale}: 무료 칸이 화면에 0 이다 — 이 단정이 비었다`);
    for (const check of free) {
      assert.doesNotMatch(check.reasonLine ?? '', /no-entitlement/, `${locale}: 무료 축이 자격에 막혔다`);
    }

    // 그리고 **같은 화면**에 만기일과 전환 경로가 있다 — 한 보고 안이다.
    const notice = vm.head.entitlement;
    assert.ok(notice.state === 'absent', `${locale}: 상태가 「없음」이 아니다`);
    assert.equal(notice.reason, 'no-entitlement', `${locale}: 넘긴 만기가 「확인 불가」로 읽혔다`);
    assert.ok(notice.expiry !== null && notice.expiry.pastExpiry, `${locale}: 넘김이 사실에 없다`);

    const lines = vm.head.entitlementLines;
    const said = lines.join('\n');
    // 사유 **코드**는 번역되지 않는다 — 기계가 읽는 손잡이가 로케일마다 달라지면 같은
    // 미판정을 두 이름으로 부르게 된다.
    assert.ok(said.includes(notice.reason), said);
    assert.ok(said.includes(notice.expiry.expires), `${locale}: 만기일이 화면에 없다 — ${said}`);
    assert.ok(said.includes(notice.convertPath), `${locale}: 전환 경로가 화면에 없다 — ${said}`);

    // 사이에 다른 절이 끼지 않는다 — 「무엇이 없는가」 바로 뒤가 「무엇을 하면 되는가」다.
    const saidNone = lines.findIndex((line) => line.includes(notice.reason));
    const saidWay = lines.findIndex((line) => line.includes(notice.convertPath));
    assert.ok(saidNone >= 0 && saidWay > saidNone, lines.join(' | '));
    assert.ok(saidWay - saidNone <= 4, `${locale}: 「없다」와 「하면 된다」가 ${saidWay - saidNone} 줄 떨어졌다`);
  }
});

/* ───────────────── 분모 — 두 패키지의 **발행되는** TS ───────────────── */

/** 테스트는 분모가 아니다 — 사본을 묻는 자리라서 발행되는 것만 센다. */
function shippedTs(dir: URL, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.isDirectory()) out.push(...shippedTs(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(`${prefix}${entry.name}`);
  }
  return out;
}

interface Source {
  readonly file: string;
  readonly text: string;
}

const PACKAGES = {
  verifier: new URL('../../verifier/src/', import.meta.url),
  diagnosis: new URL('./', import.meta.url),
} as const;

const sourcesOf = (id: keyof typeof PACKAGES): Source[] =>
  shippedTs(PACKAGES[id]).map((path) => ({
    file: `${id}/src/${path}`,
    text: readFileSync(new URL(path, PACKAGES[id]), 'utf8'),
  }));

/** 날짜를 **세는** 손 — 술어를 부르는 자리와 하루를 직접 쪼개는 자리. */
const countingHolders = (sources: readonly Source[]): string[] =>
  sources
    .filter(({ text }) => ['daysUntil(', 'isPastDate('].some((call) => text.includes(call)) || /86_?400_?000/.test(text))
    .map(({ file }) => file);

test('만기 고지 AC5 (negative) — 사실을 **세는 손이 하나**다: 페이지는 날짜를 세지 않는다', () => {
  const sources = [...sourcesOf('verifier'), ...sourcesOf('diagnosis')];
  for (const id of Object.keys(PACKAGES)) {
    assert.ok(sources.some((s) => s.file.startsWith(id)), `${id}: 분모가 비었다`);
  }

  // ⭐ 닫힌 목록이고, 자리마다 **왜 거기서 세는가**가 있다.
  assert.deepEqual(
    countingHolders(sources),
    [
      // 고지의 사실 — 남은 날과 넘김을 **여기서** 센다(두 표면이 그 값을 받는다).
      'verifier/src/entitlement.ts',
      // 술어와 날 수의 정본 + 면제의 「넘긴 만기」 전수 — 경계값을 쥔 한 자리다.
      'verifier/src/expiry.ts',
      // 벤더의 답을 자격으로 풀 때 넘김을 가른다 — 같은 술어를 부른다(새 기전 0).
      'verifier/src/hosts/entitlement.ts',
    ],
    '날짜를 세는 자리가 닫힌 목록과 다르다',
  );

  // ⛔ 페이지에는 **하나도 없다** — 그래서 페이지에 「두 번째 경계값」이 생길 자리가 없다.
  assert.deepEqual(countingHolders(sourcesOf('diagnosis')), []);

  // 대조군 — 페이지가 세기 시작하면 빨갛다.
  for (const planted of ['const left = daysUntil(a, b);', 'if (isPastDate(d, on)) return [];', 'const day = 86_400_000;']) {
    assert.notDeepEqual(
      countingHolders([{ file: 'diagnosis/src/planted.ts', text: planted }]),
      [],
      `${planted} 을 심었는데 초록이다 — 가드가 죽었다`,
    );
  }
});

/* ──────────── 문장의 **자리 셋** — 표면·로케일마다 하나 ──────────── */

/**
 * 문장에 끼어드는 **사실의 값들** — 소스에 축자로 없는 부분이라 지우고 본다.
 * ⛔ 자구를 테스트에 적지 않는 길이 이것이다: 아래가 세 표면을 **실제로 돌려** 나온 줄에서
 * 끼어든 값과 숫자를 지우고, 남은 조각이 그 패키지의 발행 코드에서 몇 파일에 있는지를 센다.
 */
const interpolated = (notice: EntitlementNotice): string[] => [
  notice.convertPath,
  ...(notice.reason === null ? [] : [notice.reason]),
  ENTITLEMENT.file,
  ENTITLEMENT.keyEnv,
  ENTITLEMENT.handleKey,
];

/** 한 줄에서 **소스에 축자로 있는** 조각들 — 짧은 조각은 우연히 겹치므로 버린다. */
function literalParts(lines: readonly string[], notice: EntitlementNotice): string[] {
  const parts: string[] = [];
  for (const line of lines) {
    let rest = line;
    for (const value of interpolated(notice)) rest = rest.split(value).join('\u0000');
    for (const piece of rest.split(/[\u0000\d]+/)) {
      const part = piece.trim();
      if (part.length >= 8) parts.push(part);
    }
  }
  return parts;
}

/** 두 표면이 **같은 줄**을 들었는가 — 베낀 자리는 거기서 보인다. */
function sharedLines(drawn: Readonly<Record<string, readonly string[]>>): string[] {
  const shared: string[] = [];
  const named = Object.entries(drawn).filter(([, lines]) => lines.length > 0);
  for (const [a, left] of named) {
    for (const [b, right] of named) {
      if (a >= b) continue;
      for (const line of left) if (right.includes(line)) shared.push(`${a} ↔ ${b}: ${line}`);
    }
  }
  return shared;
}

const HANGUL = /[가-힣]/;

test('만기 고지 AC5 (negative) — 문장은 **로케일마다 한 파일**이다: 사본 0', async () => {
  const CLI = '측정 명령(영문)';
  const drawn = await Promise.all(
    CASES.map(async (entitlement) => {
      const [koVm, enVm] = await Promise.all([pageReport(entitlement, ko), pageReport(entitlement, en)]);
      return {
        notice: koVm.head.entitlement,
        lines: {
          [CLI]: commandLines(entitlement),
          '페이지 ko': koVm.head.entitlementLines,
          '페이지 en': enVm.head.entitlementLines,
        } as Record<string, readonly string[]>,
      };
    }),
  );

  // ⑴ 조각마다 자리가 **하나**다 — 그 패키지의 발행 코드 전부를 분모로 센다.
  const surfaces = [
    { id: CLI, pkg: 'verifier', at: 'verifier/src/entitlement.ts' },
    { id: '페이지 ko', pkg: 'diagnosis', at: 'diagnosis/src/strings-ko.ts' },
    { id: '페이지 en', pkg: 'diagnosis', at: 'diagnosis/src/strings-en.ts' },
  ] as const;
  for (const surface of surfaces) {
    const sources = sourcesOf(surface.pkg);
    const parts = new Set(drawn.flatMap((d) => literalParts(d.lines[surface.id] ?? [], d.notice)));
    assert.ok(parts.size >= 5, `${surface.id}: 유도한 조각이 ${parts.size} 개다 — 하네스가 고장났다`);
    for (const part of parts) {
      const holders = sources.filter(({ text }) => text.includes(part)).map(({ file }) => file);
      assert.deepEqual(holders, [surface.at], `${surface.id}: 「${part}」의 자리가 하나가 아니다`);
    }
  }

  // ⑵ 어느 표면도 남의 **줄**을 그대로 들지 않는다 — 들었다면 같은 줄이 두 자리에서 나온다.
  for (const { lines } of drawn) assert.deepEqual(sharedLines(lines), []);

  // 대조군 — 한 표면이 남의 줄을 베끼면 같은 유도가 그것을 집는다.
  const copied = drawn.find(({ lines }) => (lines[CLI] ?? []).length > 0);
  assert.ok(copied !== undefined, '말하는 자격이 분모에 없다 — 하네스가 고장났다');
  assert.notDeepEqual(
    sharedLines({ ...copied.lines, '페이지 en': copied.lines[CLI] ?? [] }),
    [],
    '베낀 벌을 심었는데 초록이다 — 가드가 죽었다',
  );

  // ⑶ 로케일이 **실제로** 갈라진다 — ko 에는 한글이 있고, en 과 측정 명령에는 0 이다.
  for (const { lines } of drawn) {
    if ((lines['페이지 ko'] ?? []).length === 0) continue;
    assert.ok(lines['페이지 ko']!.some((line) => HANGUL.test(line)), '정본 벌이 한글을 내지 않았다');
    for (const id of ['페이지 en', CLI]) {
      assert.ok(!(lines[id] ?? []).some((line) => HANGUL.test(line)), `${id} 에 옮기지 않은 한글이 있다`);
    }
  }
});

test('만기 고지 AC4 (negative, 페이지) — 고지에 절대 URL 0 · 수를 접는 어휘 0: **사유 전수**로 두 로케일', async () => {
  const states: Entitlement[] = [
    { state: 'unwired' },
    { state: 'entitled', expires: null },
    { state: 'entitled', expires: '2026-09-30' },
    ...Object.keys(DETAIL_REASONS).map(
      (detail): Entitlement => ({ state: 'absent', detail: detail as EntitlementDetail, expires: '2026-09-01' }),
    ),
  ];
  // 사유 전수다 — 새 사유가 들어오면 이 단정이 그것도 본다.
  assert.ok(states.length > 3);

  for (const locale of LOCALES) {
    for (const entitlement of states) {
      const vm = await pageReport(entitlement, CATALOG[locale]);
      const everything = [...vm.head.entitlementLines, ...vm.scopeLines, vm.totalsLine, vm.head.sourceLine].join('\n');
      for (const banned of [
        new RegExp(['ht', 'tps?://'].join(''), 'i'),
        /(^|[^.:])\/\/[a-z0-9]/i,
        new RegExp(['pol', 'ar'].join(''), 'i'),
        /score/i,
        /grade/i,
        /percent/i,
        /\d\s*%/,
      ]) {
        assert.doesNotMatch(everything, banned, `${locale} · ${JSON.stringify(entitlement)} → ${everything}`);
      }
    }
  }

  // ⭐ 전환 경로는 **상대 경로 하나**다 — 벤더 주소가 화면에 박히지 않는다. 페이지가 그
  //   값을 지어내지 않고 사실에서 받는다는 것이 이 단정의 요점이다.
  const notice = (await pageReport({ state: 'absent', detail: 'past-expiry', expires: '2026-09-01' }, ko)).head
    .entitlement;
  assert.ok(notice.convertPath.startsWith('./'), notice.convertPath);
  assert.doesNotMatch(notice.convertPath, /:/);
});
