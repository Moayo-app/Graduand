import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeSnapshot } from '../judge.ts';
import { DeclarationInvalidError } from '../declaration.ts';
import { AdapterParseError } from '../adapters/adapter.ts';
import type { RepoSnapshot } from '../snapshot.ts';
import type { CheckResult } from '../schema.ts';
import { EVIDENCE_CAP } from './evidence.ts';

function snap(entries: Record<string, string | null>, extraPaths: string[] = []): RepoSnapshot {
  const paths = [...Object.keys(entries), ...extraPaths].sort();
  return { repo: 'acme/storefront', commit: 'c'.repeat(40), paths, files: new Map(Object.entries(entries)) };
}

const decl = (palette: object): string => JSON.stringify({ palette });

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

const paletteOf = (j: { checks: CheckResult[] }): CheckResult => j.checks.find((c) => c.id === 'palette')!;
const crossOf = (j: { checks: CheckResult[] }): CheckResult => j.checks.find((c) => c.id === 'palette-cross')!;

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
    (e: unknown) => e instanceof DeclarationInvalidError && e.problems[0]!.includes('palette.canon.scope'),
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

// ---- 선언된 갈라짐(`palette.diverged`) — 사유를 단 칸은 교차 축에서 「밖」이다 ----

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
        e.problems.some((p) => p.includes('palette.diverged') && p.includes('--paper')),
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
