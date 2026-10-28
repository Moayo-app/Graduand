import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeSnapshot } from '../judge.ts';
import { DeclarationInvalidError, SHARED_VALUES_KEY } from '../declaration.ts';
import { AdapterParseError } from '../adapters/adapter.ts';
import type { RepoSnapshot } from '../snapshot.ts';
import type { CheckResult } from '../schema.ts';
import { EVIDENCE_CAP } from './evidence.ts';
import { axisCheckId, isCheckOf } from './registry.ts';
import { canonAdapter, SHARED_VALUES_CHECK_ID, SHARED_VALUES_CROSS_CHECK_ID } from './shared-values.ts';

function snap(entries: Record<string, string | null>, extraPaths: string[] = []): RepoSnapshot {
  const paths = [...Object.keys(entries), ...extraPaths].sort();
  return { repo: 'acme/storefront', commit: 'c'.repeat(40), paths, files: new Map(Object.entries(entries)) };
}

/**
 * 축 하나를 든 선언 — 이름은 기본 `design` 이고, 축이 여럿인 판은 이름을 달아 부른다.
 * ⭐ 키의 자구는 스키마가 쥔다(`SHARED_VALUES_KEY`) — 테스트가 그것을 베끼면 사본이다.
 */
const decl = (axis: object, name = AXIS): string =>
  JSON.stringify({ [SHARED_VALUES_KEY]: { [name]: axis } });

/** 이 파일의 기본 축 이름과 그 칸들 — 체크 id 를 손으로 적지 않는다(짓는 손은 등록부다). */
const AXIS = 'design';
const CI = axisCheckId(SHARED_VALUES_CHECK_ID, AXIS);
const CROSS = axisCheckId(SHARED_VALUES_CROSS_CHECK_ID, AXIS);

const CANON_REPO = 'acme/design-system';
const CANON_FILE = 'tokens/tokens.css';

const CONSUMER_PALETTE = {
  adapter: 'css-custom-properties',
  files: ['src/theme.css'],
  scope: ':root',
  canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
  pinned: { '--paper': '#F6F5F2', '--ink': '#23263A', '--line': '#D8DAE3' },
};

const CONSUMER = decl(CONSUMER_PALETTE);

/** 박제만 갈아 끼운 소비 저장소 선언 — 나머지(어댑터 트리오 · 정본 포인터)는 그대로다. */
const consumerPinning = (pinned: Record<string, string>): string =>
  decl({ ...CONSUMER_PALETTE, pinned });

const CANON_CSS = [
  ':root {',
  '  --paper: #F6F5F2;',
  '  --ink: #23263A;',
  '  --line: #D8DAE3;', // 4행 — 교차 축 증거의 좌표가 여기를 가리킨다
  '}',
  '',
].join('\n');

const CANON_DECL = decl({ adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root' });

/** 정본 저장소의 체크아웃 — 교차 축이 시야에서 **이름으로** 찾는 그 스냅샷이다. */
function canonPeer(css: string | null = CANON_CSS, declaration: string | null = CANON_DECL): RepoSnapshot {
  const entries: Record<string, string | null> = { 'graduand.json': declaration, [CANON_FILE]: css };
  return {
    repo: CANON_REPO,
    commit: 'a'.repeat(40),
    paths: Object.keys(entries).sort(),
    files: new Map(Object.entries(entries)),
  };
}

const THEME_OK = [
  ':root {',
  '  --paper: #F6F5F2;',
  '  --ink: #23263A;',
  '  --line: #D8DAE3;',
  '  --brand-pop: #FF5C39;', // 박제 밖 — 판정 대상 아님으로 센다
  '}',
  '.dark {',
  '  --ink: #E8E9F2;', // 선언 스코프 밖 — 스코프 밖 읽기로 센다
  '}',
  '',
].join('\n');

/**
 * 그 축의 칸 — ⭐ **이름으로** 묻고 축은 묻지 않는다: 축이 선언됐으면 칸은 `<판정기>:<축>`
 * 이고, 하나도 선언되지 않았으면 접미 없는 맨 이름이다. 두 자리를 테스트가 따로 적으면
 * 「축 미선언」 판이 조용히 `undefined` 를 받는다(그 수는 아무것도 단정하지 못한다).
 */
const cellOf = (j: { checks: CheckResult[] }, verifier: string): CheckResult => {
  const found = j.checks.filter((c) => isCheckOf(verifier, c.id));
  assert.equal(found.length, 1, `${verifier} 칸이 ${found.length} 개다`);
  return found[0]!;
};
const paletteOf = (j: { checks: CheckResult[] }): CheckResult => cellOf(j, SHARED_VALUES_CHECK_ID);
const crossOf = (j: { checks: CheckResult[] }): CheckResult => cellOf(j, SHARED_VALUES_CROSS_CHECK_ID);

test('소비 저장소 — 코드 == 박제가 서고, 배제와 스코프 밖 읽기를 따로 센다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }));
  const p = paletteOf(j);
  assert.equal(p.status, 'pass');
  assert.deepEqual(p.counts, {
    files: 1,
    declared: 3,
    matched: 3,
    mismatched: 0,
    missing: 0,
    unjudged: 0,
    excluded: 1, // --brand-pop — 위반 0 에 접히지 않는다
    outOfScope: 1, // .dark 의 --ink
    evidenceOmitted: 0,
  });
});

test('불일치는 위반이고, 증거는 좌표(토큰·파일·행)뿐 값을 싣지 않는다', () => {
  const drifted = THEME_OK.replace('--ink: #23263A;', '--ink: #222230;');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': drifted }));
  const p = paletteOf(j);
  assert.equal(p.status, 'violation');
  assert.equal(p.counts.mismatched, 1);
  assert.deepEqual(p.evidence, [{ token: '--ink', file: 'src/theme.css', line: 3, why: 'mismatch' }]);
  const serialized = JSON.stringify(j);
  assert.ok(!serialized.includes('#222230')); // 실측값이 보고에 없다
  assert.ok(!serialized.includes('#23263A')); // 기준값도 없다
});

test('박제된 토큰이 코드에 없다 — 부재는 공집합이 아니라 소실(위반)이다', () => {
  const gone = THEME_OK.replace('  --line: #D8DAE3;\n', '');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': gone }));
  const p = paletteOf(j);
  assert.equal(p.status, 'violation');
  assert.equal(p.counts.missing, 1);
  assert.deepEqual(p.evidence, [{ token: '--line', why: 'missing' }]);
});

test('var() 간접 참조는 해석하지 않는다 — 위반도 통과도 아닌 미판정으로 센다', () => {
  const indirect = THEME_OK.replace('--line: #D8DAE3;', '--line: var(--hairline);');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': indirect }));
  const p = paletteOf(j);
  assert.equal(p.status, 'pass'); // 빨강의 근거는 위반뿐이다
  assert.equal(p.counts.unjudged, 1);
  assert.deepEqual(p.evidence, [{ token: '--line', file: 'src/theme.css', line: 4, why: 'var-indirection' }]);
});

test('같은 스코프의 중복 정의 — 캐스케이드를 해석하지 않고 미판정으로 센다', () => {
  const dup = THEME_OK.replace('}\n.dark', '  --ink: #000000;\n}\n.dark');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': dup }));
  const p = paletteOf(j);
  assert.equal(p.counts.unjudged, 1);
  assert.equal(p.evidence[0]!.why, 'ambiguous-cascade');
  assert.equal(p.evidence[0]!.occurrences, 2);
});

test('정본 저장소 — 기준은 자기 파일의 등록부, 자명 통과가 수로 남는다', () => {
  const canonDecl = decl({ adapter: 'css-custom-properties', files: ['tokens/tokens.css'], scope: '@theme' });
  const canonCss = '@theme {\n  --paper: #F6F5F2;\n  --ink: #23263A;\n}\n';
  const j = judgeSnapshot(snap({ 'graduand.json': canonDecl, 'tokens/tokens.css': canonCss }));
  const p = paletteOf(j);
  assert.equal(p.status, 'pass');
  assert.equal(p.counts.declared, 2);
  assert.equal(p.counts.matched, 2);
});

test('선언된 스코프가 실재와 어긋나면(토큰 0) 미판정이 아니라 판정 실패다', () => {
  const canonDecl = decl({ adapter: 'css-custom-properties', files: ['tokens/tokens.css'], scope: '@theme' });
  const rootOnly = ':root {\n  --paper: #F6F5F2;\n}\n';
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': canonDecl, 'tokens/tokens.css': rootOnly })),
    DeclarationInvalidError,
  );
});

test('모호한 정본(같은 스코프의 중복 정의)은 기준이 되지 못한다 — 판정 실패', () => {
  const canonDecl = decl({ adapter: 'css-custom-properties', files: ['tokens/tokens.css'], scope: ':root' });
  const dupCanon = ':root {\n  --ink: #111111;\n  --ink: #222222;\n}\n';
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': canonDecl, 'tokens/tokens.css': dupCanon })),
    (e: unknown) => e instanceof DeclarationInvalidError && e.problems[0]!.includes('--ink'),
  );
});

test('probe — 선언된 파일이 실재하지 않으면 선언을 믿지 않고 판정 실패로 멈춘다', () => {
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'README.md': 'x' })),
    (e: unknown) => e instanceof DeclarationInvalidError && e.problems[0]!.includes('src/theme.css'),
  );
});

test('어댑터가 못 읽는 파일은 토큰 0건의 통과가 아니라 판정 실패다', () => {
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': 'not a stylesheet' })),
    (e: unknown) => e instanceof AdapterParseError && e.file === 'src/theme.css',
  );
});

test('폴백 — 어댑터 없이 pinned 만 선언해도 분모가 같은 스키마의 수로 남는다', () => {
  const fallback = decl({
    pinned: { '--paper': '#F6F5F2', '--ink': '#23263A' },
    canon: { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' },
  });
  const j = judgeSnapshot(snap({ 'graduand.json': fallback }));
  const p = paletteOf(j);
  assert.equal(p.status, 'unjudged');
  assert.equal(p.reason, 'no-adapter');
  assert.equal(p.counts.declared, 2);
});

test('정본 포인터만 있는 선언 — 이 표면에 기준이 없다: no-declaration 미판정', () => {
  const pointerOnly = decl({ canon: { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' } });
  const j = judgeSnapshot(snap({ 'graduand.json': pointerOnly }));
  const p = paletteOf(j);
  assert.equal(p.status, 'unjudged');
  assert.equal(p.reason, 'no-declaration');
});

test('palette 선언이 없으면 두 축 다 「위반 0」이 아니라 「미판정 — 선언 없음」이다', () => {
  const j = judgeSnapshot(snap({ 'README.md': 'plain' }));
  assert.deepEqual(
    [paletteOf(j), crossOf(j)].map((c) => [c.status, c.reason]),
    [['unjudged', 'no-declaration'], ['unjudged', 'no-declaration']],
  );
});

test('교차 축(박제 == 정본)은 이 표면이 질 수 없다 — 숨기지 않고 사유로 적는다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }));
  const cross = crossOf(j);
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'single-repo-surface');
  assert.equal(cross.counts.pinned, 3);
  // 박제 전부가 이 표면의 「밖」이다 — 수로 남겨 「위반 0」과 같아 보이지 않게 한다.
  assert.equal(cross.counts.excluded, 3);
});

test('선언된 파일이 추적되는데 못 읽혔다 — 소실이 아니라 잘림(미판정)이다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': null }));
  const p = paletteOf(j);
  assert.equal(p.status, 'unjudged');
  assert.equal(p.reason, 'collection-truncated');
  assert.deepEqual(p.counts, { files: 1, read: 0 });
});

// ---- 교차 축(박제 == 정본) — 정본이 시야에 든 표면 ----

test('교차 축 — 정본이 시야에 들면 박제를 정본과 비교해 수를 낸다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer()],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'pass');
  assert.equal(cross.reason, null);
  assert.deepEqual(cross.counts, {
    canon: 3, // 분모는 정본이 든 토큰이다
    pinned: 3,
    matched: 3,
    mismatched: 0,
    unpinned: 0,
    unjudged: 0,
    diverged: 0, // 갈라짐을 선언하지 않았다 — 0 이 수로 선다(「갈라짐 N건」과 같아 보이지 않게)
    excluded: 0,
    evidenceOmitted: 0,
  });
});

test('값과 박제를 함께 바꾼 PR — CI 축은 초록인데 교차 축이 위반으로 선다', () => {
  // 이 저장소의 모든 가드가 초록인 채 저장소 간 갈라짐이 성립하는 바로 그 모양이다.
  const pinned = { ...CONSUMER_PALETTE.pinned, '--line': '#CCCCCC' };
  const theme = THEME_OK.replace('--line: #D8DAE3;', '--line: #CCCCCC;');
  const j = judgeSnapshot(snap({ 'graduand.json': consumerPinning(pinned), 'src/theme.css': theme }), {
    peers: [canonPeer()],
  });
  assert.equal(paletteOf(j).status, 'pass'); // 코드 == 박제 — 이 저장소만 보면 초록이다
  const cross = crossOf(j);
  assert.equal(cross.status, 'violation');
  assert.equal(cross.counts.mismatched, 1);
  // 증거의 좌표는 **정본의** 파일·행이다 — 공유값이 사는 자리.
  assert.deepEqual(cross.evidence, [{ token: '--line', file: CANON_FILE, line: 4, why: 'mismatch' }]);
  const serialized = JSON.stringify(j);
  assert.ok(!serialized.includes('#CCCCCC')); // 박제값이 보고에 없다
  assert.ok(!serialized.includes('#D8DAE3')); // 정본값도 없다
});

test('박제에서 조용히 빠진 정본 토큰 — 침묵의 갈라짐은 위반이다', () => {
  const { '--line': _dropped, ...pinned } = CONSUMER_PALETTE.pinned;
  const theme = THEME_OK.replace('  --line: #D8DAE3;\n', '');
  const j = judgeSnapshot(snap({ 'graduand.json': consumerPinning(pinned), 'src/theme.css': theme }), {
    peers: [canonPeer()],
  });
  assert.equal(paletteOf(j).status, 'pass'); // 박제가 분모인 CI 축은 그 토큰을 모른다
  const cross = crossOf(j);
  assert.equal(cross.status, 'violation');
  assert.equal(cross.counts.unpinned, 1);
  assert.equal(cross.counts.pinned, 2);
  assert.deepEqual(cross.evidence, [{ token: '--line', file: CANON_FILE, line: 4, why: 'unpinned' }]);
});

test('정본이 모르는 박제는 「판정 대상 아님」으로 센다 — 위반 0 에 접히지 않는다', () => {
  const pinned = { ...CONSUMER_PALETTE.pinned, '--brand-pop': '#FF5C39' };
  const j = judgeSnapshot(snap({ 'graduand.json': consumerPinning(pinned), 'src/theme.css': THEME_OK }), {
    peers: [canonPeer()],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'pass');
  assert.equal(cross.counts.excluded, 1);
  assert.equal(cross.counts.matched, 3);
});

test('이름이 다른 체크아웃은 정본이 될 수 없다 — 시야 밖은 판정 불가다', () => {
  const stranger: RepoSnapshot = { ...canonPeer(), repo: 'acme/other-thing' };
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [stranger],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'single-repo-surface');
  assert.equal(cross.counts.excluded, 3);
});

test('정본 저장소가 어댑터를 선언하지 않았다 — 읽을 손이 없어 미판정이다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(CANON_CSS, null)],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'collection-truncated'); // 선언이 추적되는데 못 읽혔다
});

test('정본 저장소에 팔레트 선언이 없으면 교차 축은 no-adapter 미판정이다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(CANON_CSS, JSON.stringify({ ui: [] }))],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'no-adapter');
  assert.equal(cross.counts.pinned, 3); // 분모는 수로 남는다
});

test('정본 파일이 추적되는데 못 읽혔다 — 잘림이지 「정본에 없음」이 아니다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(null)],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'collection-truncated');
});

test('probe — 정본 포인터가 가리키는 파일이 그 저장소에 없으면 판정 실패다', () => {
  // 정본 저장소는 자기 팔레트를 **다른** 파일에 두고 있다 — 포인터가 가리키는 경로는
  // 그 저장소에 실재하지 않는다. 읽을 손은 있고 읽을 자리가 없는 상태다.
  const elsewhere = canonPeer(CANON_CSS, decl({ adapter: 'css-custom-properties', files: ['tokens/other.css'], scope: ':root' }));
  const moved: RepoSnapshot = {
    ...elsewhere,
    paths: ['graduand.json', 'tokens/other.css'],
    files: new Map([
      ['graduand.json', elsewhere.files.get('graduand.json')!],
      ['tokens/other.css', CANON_CSS],
    ]),
  };
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), { peers: [moved] }),
    (e: unknown) => e instanceof DeclarationInvalidError && e.problems[0]!.includes(CANON_FILE),
  );
});

test('probe — 정본 포인터의 스코프가 실재와 어긋나면 판정 실패다', () => {
  const consumer = decl({ ...CONSUMER_PALETTE, canon: { repo: CANON_REPO, file: CANON_FILE, scope: '@theme' } });
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': consumer, 'src/theme.css': THEME_OK }), { peers: [canonPeer()] }),
    (e: unknown) => e instanceof DeclarationInvalidError && e.problems[0]!.includes(`${SHARED_VALUES_KEY}.${AXIS}.canon.scope`),
  );
});

test('정본의 var() 간접 참조는 해석하지 않는다 — 미판정 토큰으로 센다', () => {
  const indirect = CANON_CSS.replace('--line: #D8DAE3;', '--line: var(--hairline);');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(indirect)],
  });
  const cross = crossOf(j);
  assert.equal(cross.status, 'pass'); // 빨강의 근거는 위반뿐이다
  assert.equal(cross.counts.unjudged, 1);
  assert.equal(cross.evidence[0]!.why, 'var-indirection');
});

test('정본의 중복 정의도 해석하지 않는다 — 모호한 정본은 그 저장소의 CI 축이 세운다', () => {
  const dup = CANON_CSS.replace('}', '  --line: #000000;\n}');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(dup)],
  });
  const cross = crossOf(j);
  assert.equal(cross.counts.unjudged, 1);
  assert.equal(cross.evidence[0]!.why, 'ambiguous-cascade');
  assert.equal(cross.evidence[0]!.occurrences, 2);
});

test('정본 저장소 자신 — 박제가 없으니 교차 축의 한 변이 선언되지 않았다', () => {
  const j = judgeSnapshot(canonPeer());
  const cross = crossOf(j);
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'no-declaration');
  assert.equal(cross.counts.pinned, 0);
});

test('깨진 선언을 든 정본 저장소 — 교차 축은 수를 내지 않고 요란하게 멈춘다', () => {
  assert.throws(
    () => judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
      peers: [canonPeer(CANON_CSS, '{"typo": 1}')],
    }),
    DeclarationInvalidError,
  );
});

// ---- 선언된 갈라짐(`shared.diverged`) — 사유를 단 칸은 교차 축에서 「밖」이다 ----

const DIVERGENCE_REASON = '우리 지면 값은 우리 것이다 — 이 값의 정본은 이 저장소다';

/** 공유값 둘만 박제하고, 셋째 자리를 **사유를 단 갈라짐**으로 선언한 소비 저장소. */
const DIVERGED_PINNED = { '--ink': '#23263A', '--line': '#D8DAE3' };
const CONSUMER_DIVERGED = decl({
  ...CONSUMER_PALETTE,
  pinned: DIVERGED_PINNED,
  diverged: { '--paper': DIVERGENCE_REASON },
});

test('AC1 — 사유를 단 갈라짐은 교차 축에서 「밖 — 미판정」이고 사유 문장이 증거에 실린다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER_DIVERGED, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer()],
  });
  const cross = crossOf(j);
  // 박제한 둘은 정본과 같다 — 빨강의 근거는 위반뿐이다. 그전까지 --paper 는 박제에서
  // 조용히 빠진 토큰(`unpinned`)으로 **위반**이었다: 사유가 그 칸을 옮긴다.
  assert.equal(cross.status, 'pass');
  assert.deepEqual(cross.counts, {
    canon: 3, // 분모는 줄지 않는다 — 선언된 갈라짐이 칸을 비우지 않는다
    pinned: 2,
    matched: 2,
    mismatched: 0,
    unpinned: 0,
    unjudged: 0,
    diverged: 1,
    excluded: 0,
    evidenceOmitted: 0,
  });
  // 코드는 기계가(`why`) · 문장은 증거가(`reason`) — 새 필드 0, 평평한 원시값뿐이다.
  assert.deepEqual(cross.evidence, [
    { token: '--paper', file: CANON_FILE, line: 2, why: 'declared-divergence', reason: DIVERGENCE_REASON },
  ]);
  // 값은 여전히 싣지 않는다 — 양쪽 저장소의 파일 내용이 보고를 타고 나가지 않는다.
  assert.ok(!JSON.stringify(j).includes('#F6F5F2'));
});

test('AC2 — 같은 토큰이 CI 축에서는 그대로 판정된다: 갈라짐 선언이 「코드 == 박제」를 건드리지 않는다', () => {
  // ⭐ 가르는 기준 — 면제는 판정을 없애고, 선언된 갈라짐은 기준을 옮긴다. 그래서 CI 축은
  // 갈라짐 선언을 **읽지 않는다**: 같은 박제를 든 선언과 수가 한 글자도 다르지 않다.
  const base = judgeSnapshot(snap({ 'graduand.json': consumerPinning(DIVERGED_PINNED), 'src/theme.css': THEME_OK }));
  const withDivergence = judgeSnapshot(snap({ 'graduand.json': CONSUMER_DIVERGED, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer()],
  });
  assert.deepEqual(paletteOf(withDivergence), paletteOf(base));

  // ⚠️ 박제와 갈라짐은 토큰 단위로 배타다(선언 스키마) — 그래서 갈라진 토큰의 칸은 CI 축의
  // 기준 밖이고, 그 사실은 「판정 대상 아님」의 수로 남는다. 칸이 조용히 사라지지 않는다.
  const ci = paletteOf(withDivergence);
  assert.equal(ci.counts.declared, 2);
  assert.equal(ci.counts.excluded, 2); // --paper(갈라짐) · --brand-pop(서비스 고유값)

  // 판정은 사라지지 않았다 — 박제된 토큰이 코드에서 어긋나면 CI 축은 그대로 빨갛다.
  const drifted = THEME_OK.replace('--ink: #23263A;', '--ink: #222230;');
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER_DIVERGED, 'src/theme.css': drifted }), {
    peers: [canonPeer()],
  });
  assert.equal(paletteOf(j).status, 'violation');
  assert.equal(paletteOf(j).counts.mismatched, 1);
  assert.equal(crossOf(j).counts.diverged, 1); // 교차 축의 갈라짐은 그대로 「밖」이다
});

test('AC3 (negative) — 사유 없는 갈라짐 항은 판정 실패다: 사유 없는 갈라짐은 드리프트다', () => {
  for (const reason of ['', '   ']) {
    const noReason = decl({ ...CONSUMER_PALETTE, pinned: DIVERGED_PINNED, diverged: { '--paper': reason } });
    assert.throws(
      () => judgeSnapshot(snap({ 'graduand.json': noReason, 'src/theme.css': THEME_OK }), { peers: [canonPeer()] }),
      (e: unknown) =>
        e instanceof DeclarationInvalidError &&
        e.problems.some((p) => p.includes(`${SHARED_VALUES_KEY}.${AXIS}.diverged`) && p.includes('--paper')),
      `사유 ${JSON.stringify(reason)} 를 심었는데 판정이 섰다 — 통과료를 받았다`,
    );
  }
  // 음성 대조군 — 사유를 달면 같은 선언이 선다. 가르는 것은 하네스가 아니라 사유다.
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER_DIVERGED, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer()],
  });
  assert.equal(crossOf(j).counts.diverged, 1);
});

test('AC5 (negative) — 갈라짐 증거도 EVIDENCE_CAP 을 넘지 않는다: 넘친 건수는 수가 센다', () => {
  const tokens = Array.from({ length: EVIDENCE_CAP + 1 }, (_, i) => `--t${i}`);
  const canonCss = [':root {', '  --kept: #111111;', ...tokens.map((t) => `  ${t}: #222222;`), '}', ''].join('\n');
  const consumer = decl({
    ...CONSUMER_PALETTE,
    pinned: { '--kept': '#111111' },
    diverged: Object.fromEntries(tokens.map((t) => [t, `${t} 의 정본은 이 저장소다`])),
  });
  const theme = ':root {\n  --kept: #111111;\n}\n';
  const j = judgeSnapshot(snap({ 'graduand.json': consumer, 'src/theme.css': theme }), {
    peers: [canonPeer(canonCss)],
  });
  const cross = crossOf(j);
  assert.equal(cross.counts.diverged, EVIDENCE_CAP + 1); // 수는 전수다
  assert.equal(cross.evidence.length, EVIDENCE_CAP); // 잘리는 것은 증거 목록뿐이다
  assert.equal(cross.counts.evidenceOmitted, 1);
});

test('정본이 든 토큰 전부가 갈라짐이면 통과가 아니다 — 비교 0 은 ✅ 가 아니라 미판정이다', () => {
  // ⛔ 「✅ 안에서 개수로」는 거짓 초록이다(갈라짐 N건과 0건이 같은 ✅). 비교가 한 건도
  // 서지 않으면 이 축은 통과를 주장할 수 없다 — 분모와 증거는 그대로 두고 사유를 적는다.
  const allDiverged = decl({
    ...CONSUMER_PALETTE,
    pinned: { '--brand-pop': '#FF5C39' }, // 정본이 모르는 박제 — 비교의 분모에 들지 않는다
    diverged: {
      '--paper': '지면은 우리 것이다',
      '--ink': '본문 잉크는 우리 것이다',
      '--line': '괘선은 우리 것이다',
    },
  });
  const cross = crossOf(
    judgeSnapshot(snap({ 'graduand.json': allDiverged, 'src/theme.css': THEME_OK }), { peers: [canonPeer()] }),
  );
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'declared-divergence');
  assert.equal(cross.counts.canon, 3); // 분모는 고정이다
  assert.equal(cross.counts.diverged, 3);
  assert.equal(cross.counts.matched, 0);
  assert.equal(cross.evidence.length, 3); // 사유 셋이 칸마다 실려 나간다
});

test('갈라짐 선언은 교차 축의 분모를 늘리지 않는다 — 정본이 모르는 토큰은 옮길 칸이 없다', () => {
  const stale = decl({
    ...CONSUMER_PALETTE,
    diverged: { '--ghost': '이 저장소에만 있는 값이다' }, // 정본에 없는 이름
  });
  const cross = crossOf(
    judgeSnapshot(snap({ 'graduand.json': stale, 'src/theme.css': THEME_OK }), { peers: [canonPeer()] }),
  );
  assert.equal(cross.status, 'pass');
  assert.equal(cross.counts.canon, 3);
  assert.equal(cross.counts.matched, 3);
  assert.equal(cross.counts.diverged, 0);
});

// ── 개정 4 — 축이 여럿이고, 그 둘이 **다른 상류**를 가리킨다 ───────────────

const API_REPO = 'acme/contracts';
const API_FILE = 'api/limits.css';
const API_CSS = ':root {\n  --page-size: 50;\n  --timeout: 30s;\n}\n';

/** 축 둘을 든 선언 — ⭐ 각자 **다른 저장소**를 정본으로 지목한다. */
const twoAxes = (apiPinned: Record<string, string>): string =>
  JSON.stringify({
    [SHARED_VALUES_KEY]: {
      [AXIS]: CONSUMER_PALETTE,
      api: {
        canon: { repo: API_REPO, file: API_FILE, scope: ':root' },
        pinned: apiPinned,
      },
    },
  });

function apiPeer(css: string | null = API_CSS): RepoSnapshot {
  const entries: Record<string, string | null> = {
    'graduand.json': JSON.stringify({
      [SHARED_VALUES_KEY]: { contracts: { adapter: 'css-custom-properties', files: [API_FILE], scope: ':root' } },
    }),
    [API_FILE]: css,
  };
  return { repo: API_REPO, commit: 'b'.repeat(40), paths: Object.keys(entries).sort(), files: new Map(Object.entries(entries)) };
}

test('축이 둘이면 칸이 넷이다 — 이름이 축을 들고, 두 축이 **다른 정본**에서 읽힌다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': twoAxes({ '--page-size': '50', '--timeout': '30s' }), 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(), apiPeer()],
  });
  // ⭐⭐ 축마다 칸 둘 — 저장소가 여럿이고 규율이 갈래로 파편화된 조직이 선언할 자리다.
  assert.deepEqual(j.checks.map((c) => c.id), [
    'refs',
    'shared-values-cross:api',
    `shared-values-cross:${AXIS}`,
    'shared-values:api',
    `shared-values:${AXIS}`,
    'ui-paths',
  ]);
  // 디자인 축은 `acme/design-system` 에서, API 축은 `acme/contracts` 에서 읽혔다.
  assert.equal(cellOf(j, `${SHARED_VALUES_CROSS_CHECK_ID}:${AXIS}`).status, 'pass');
  const api = cellOf(j, 'shared-values-cross:api');
  assert.equal(api.status, 'pass');
  assert.equal(api.counts.canon, 2);
  assert.equal(api.counts.matched, 2);
  // ⭐ API 축은 어댑터를 선언하지 않았다(폴백) — CI 축은 그 자리에서 미판정이고, 그 사실이
  //   디자인 축의 수를 흐리지 않는다: 축 사이를 접는 산술이 없다.
  assert.equal(cellOf(j, 'shared-values:api').reason, 'no-adapter');
  assert.equal(cellOf(j, `${SHARED_VALUES_CHECK_ID}:${AXIS}`).status, 'pass');
});

test('한 축의 위반이 다른 축의 통과를 가리지 않는다 — 칸은 축마다 따로 선다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': twoAxes({ '--page-size': '100' }), 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(), apiPeer()],
  });
  const api = cellOf(j, 'shared-values-cross:api');
  assert.equal(api.status, 'violation');
  assert.equal(api.counts.mismatched, 1); // --page-size
  assert.equal(api.counts.unpinned, 1); // --timeout — 침묵의 갈라짐
  // 디자인 축은 그대로 통과다 — 두 헌법은 서로의 수를 바꾸지 않는다.
  assert.equal(cellOf(j, `${SHARED_VALUES_CROSS_CHECK_ID}:${AXIS}`).status, 'pass');
});

test('정본의 축 둘이 같은 파일을 **다른 어댑터로** 읽으면 판정 실패다 — 읽을 손을 추측하지 않는다', () => {
  // ⚠️ 선언을 **손으로** 짓는다 — 등록부에 어댑터가 하나뿐이라 서로 다른 아는 이름 둘을
  //   실물 선언으로는 적을 수 없다(모르는 이름은 선언 검증이 먼저 거부한다). 그래서 이
  //   갈래는 이음새에서 집행한다: 둘째 어댑터가 출하되는 날 실물 경로가 여기로 온다.
  const ambiguous = {
    state: 'valid' as const,
    ui: null,
    sharedValues: {
      a: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root', canon: null, pinned: null, diverged: null },
      b: { adapter: 'sass-variables', files: [CANON_FILE], scope: ':root', canon: null, pinned: null, diverged: null },
    },
    admissions: null,
    exemptions: null,
  };
  assert.throws(
    () => canonAdapter(ambiguous, { repo: CANON_REPO, file: CANON_FILE, scope: ':root' }, `${SHARED_VALUES_KEY}.${AXIS}`),
    (e: unknown) => e instanceof DeclarationInvalidError && e.problems[0]!.includes('different adapters'),
  );
  // ⭐ 그 파일을 선언한 축이 하나면 모호함이 없다 — 좁히는 것이 먼저다.
  const narrowed = { ...ambiguous, sharedValues: { ...ambiguous.sharedValues, b: { ...ambiguous.sharedValues.b, files: ['other.css'] } } };
  assert.equal(
    canonAdapter(narrowed, { repo: CANON_REPO, file: CANON_FILE, scope: ':root' }, 'x')?.id,
    'css-custom-properties',
  );
});

test('정본의 축이 여럿이어도 **어댑터가 하나면** 모호함이 없다 — 모으는 것은 축이 아니라 읽는 손이다', () => {
  const manyAxesOneAdapter = JSON.stringify({
    [SHARED_VALUES_KEY]: {
      brand: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root' },
      product: { adapter: 'css-custom-properties', files: ['other.css'], scope: '@theme' },
    },
  });
  const j = judgeSnapshot(snap({ 'graduand.json': CONSUMER, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(CANON_CSS, manyAxesOneAdapter)],
  });
  assert.equal(crossOf(j).status, 'pass');
});

test('축 하나의 정본만 시야에 들면 **그 축만** 수를 낸다 — 한 축의 시야가 다른 축을 가리지 않는다', () => {
  const j = judgeSnapshot(snap({ 'graduand.json': twoAxes({ '--page-size': '50' }), 'src/theme.css': THEME_OK }), {
    // API 정본은 시야 밖이다 — 디자인 정본만 들어왔다.
    peers: [canonPeer()],
  });
  assert.equal(cellOf(j, `${SHARED_VALUES_CROSS_CHECK_ID}:${AXIS}`).status, 'pass');
  const api = cellOf(j, 'shared-values-cross:api');
  // ⛔ 시야 밖은 「위반 0」이 아니라 판정 불가다 — 박제 전부가 이 표면의 「밖」이고 수로 남는다.
  assert.equal(api.status, 'unjudged');
  assert.equal(api.reason, 'single-repo-surface');
  assert.equal(api.counts.excluded, api.counts.pinned);
});

test('같은 토큰이 다른 축에서 각각 박제돼도 축은 **자기 분모만** 센다', () => {
  // 두 축이 같은 이름(`--ink`)을 **다른 값**으로 박제한다 — 한 조직이 두 헌법에서 같은
  // 이름을 쓰는 것은 평상시다. 각 축의 비교는 자기 정본과 자기 박제 사이에서만 선다.
  const declaration = JSON.stringify({
    [SHARED_VALUES_KEY]: {
      // 디자인 축은 자기 정본을 **전부** 박제한다 — 침묵의 갈라짐이 섞이면 이 테스트가
      // 재려는 것(축 사이의 간섭)이 다른 위반에 묻힌다.
      [AXIS]: CONSUMER_PALETTE,
      print: { canon: { repo: API_REPO, file: API_FILE, scope: ':root' }, pinned: { '--ink': '#101014' } },
    },
  });
  const printCanon = apiPeer(':root {\n  --ink: #101014;\n}\n');
  const j = judgeSnapshot(snap({ 'graduand.json': declaration, 'src/theme.css': THEME_OK }), {
    peers: [canonPeer(), printCanon],
  });
  const design = cellOf(j, `${SHARED_VALUES_CROSS_CHECK_ID}:${AXIS}`);
  const print = cellOf(j, 'shared-values-cross:print');
  // ⭐ 둘 다 통과다 — 분모가 섞였다면 둘 중 하나는 반드시 불일치로 섰을 값들이다.
  assert.equal(design.status, 'pass');
  assert.equal(print.status, 'pass');
  // 그리고 분모는 각자의 정본이다 — 디자인 정본은 토큰 셋, print 정본은 하나다.
  assert.equal(design.counts.canon, 3);
  assert.equal(design.counts.matched, 3);
  assert.equal(print.counts.canon, 1);
  assert.equal(print.counts.matched, 1);
  // ⭐ print 의 `--ink` 는 디자인 축의 분모에 **들어오지 않았다** — 들어왔다면 값이 다르므로
  //   디자인 축이 불일치로 섰을 것이다(그것이 이 테스트가 재는 간섭이다).
  assert.equal(design.counts.mismatched, 0);
  assert.equal(print.counts.mismatched, 0);
});
