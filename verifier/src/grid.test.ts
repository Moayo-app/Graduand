/**
 * 편입 격자 — 규칙 × 표면. 여기서 받는 것은 넷이다: 칸이 **선언에서만** 유도되는가 ·
 * 줄의 상태가 판정을 접지 않고 합치는가 · 판정기 없음이 통과가 아닌가 · 빈 분모가 수를
 * 내지 않는가.
 *
 * ⛔ 기대 칸 수를 **상수로 적지 않는다** — 아래 전부가 선언 객체에서 곱한다. 수를 적는
 * 순간 그 수는 선언과 갈라질 수 있고, 갈라진 수가 바로 이 제품이 재는 결함이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { admissionGrid, gridCounts, type GridRule } from './grid.ts';
import { judgeSnapshot } from './judge.ts';
import { DeclarationInvalidError } from './declaration.ts';
import type { RepoSnapshot } from './snapshot.ts';

function snap(entries: Record<string, string | null>): RepoSnapshot {
  return {
    repo: 'acme/widgets',
    commit: 'd'.repeat(40),
    paths: Object.keys(entries).sort(),
    files: new Map(Object.entries(entries)),
  };
}

/** 선언 객체가 기대값의 **유일한 출처**다 — 행도 열도 여기서 센다. */
const DECLARATION = {
  ui: ['docs/', 'README.md'],
  admissions: {
    R1: { verifiers: ['refs'] },
    R2: { verifiers: [] }, // 「판정기 없음」이라는 선언
    R3: {}, // `verifiers` 키 부재 — 같은 자리에 앉는다
    R4: { verifiers: ['refs', 'shared-values-cross'] }, // 하나는 통과, 하나는 미판정
  },
  exemptions: {
    R5: { reason: '이 저장소에 그 표면이 없다', expires: '2027-01-31' },
  },
};

const FILES: Record<string, string | null> = {
  'README.md': '[guide](docs/guide.md)\n',
  'docs/guide.md': 'ok\n',
  'graduand.json': `${JSON.stringify(DECLARATION)}\n`,
};

/** 격자와 그 격자가 센 판정 결과 — 기대 사유는 **체크에서 읽는다**(사유도 적지 않는다). */
const judged = (entries: Record<string, string | null>) => {
  const snapshot = snap(entries);
  const checks = judgeSnapshot(snapshot).checks;
  return { grid: admissionGrid(snapshot, checks), checks };
};

const gridOf = (entries: Record<string, string | null>) => judged(entries).grid;

const rowOf = (rules: GridRule[], rule: string): GridRule =>
  rules.find((r) => r.rule === rule) ?? assert.fail(`${rule} 줄이 격자에 없다`);

test('격자는 규칙 × 표면으로 서고, 칸 수는 선언에서만 유도된다', () => {
  const grid = gridOf(FILES);
  const rules = [...Object.keys(DECLARATION.admissions), ...Object.keys(DECLARATION.exemptions)].sort();

  assert.deepEqual(grid.rules.map((r) => r.rule), rules); // 행 = 편입 + 면제
  assert.deepEqual(grid.surfaces, DECLARATION.ui); // 열 = 선언된 표면
  assert.equal(grid.reason, null); // 분모가 있다

  const counts = gridCounts(grid);
  assert.equal(counts.cells, rules.length * DECLARATION.ui.length);
  assert.ok(counts.cells > 0, '분모가 0 이면 이 테스트는 아무것도 재지 않는다');
  // 3상태의 합이 분모다 — 어느 칸도 떨어지지 않고, 어느 칸도 두 번 세지 않는다.
  assert.equal(counts.violation + counts.pass + counts.unjudged, counts.cells);
});

test('`verifiers: []` 와 키 부재는 미판정(판정기 없음)이고 통과가 아니다', () => {
  const { rules } = gridOf(FILES);
  for (const rule of ['R2', 'R3']) {
    const row = rowOf(rules, rule);
    assert.equal(row.status, 'unjudged', `${rule} 이 미판정이 아니다`);
    assert.equal(row.reason, 'no-verifier');
    assert.notEqual(row.status, 'pass');
    assert.deepEqual(row.verifiers, []);
  }
});

test('줄의 상태는 판정을 접지 않고 합친다 — 부분 판정은 통과가 아니다', () => {
  const { grid, checks } = judged(FILES);
  // 고른 판정기가 전부 통과 → 통과.
  assert.equal(rowOf(grid.rules, 'R1').status, 'pass');
  assert.equal(checks.find((c) => c.id === 'refs')!.status, 'pass');

  // 하나가 미판정이면 줄이 미판정이다 — 통과로 접으면 낙관적으로 틀린다. 그리고 그 줄의
  // 사유는 **그 판정기가 적은 사유 그대로**다: 격자가 사유를 새로 짓지 않는다.
  // ⭐ 이 선언은 공유값 축을 **하나도** 들지 않으므로 그 칸은 접미 없는 맨 이름이다 —
  //   그리고 규칙이 선언한 이름(`shared-values-cross`)이 그 칸을 그대로 모은다.
  const cross = checks.find((c) => c.id === 'shared-values-cross')!;
  const partial = rowOf(grid.rules, 'R4');
  assert.equal(cross.status, 'unjudged');
  assert.equal(partial.status, 'unjudged');
  assert.equal(partial.reason, cross.reason);
  assert.deepEqual(partial.verifiers, ['refs', 'shared-values-cross']);
});

test('면제된 규칙은 「밖 — 미판정」이고 분모는 줄지 않는다', () => {
  const grid = gridOf(FILES);
  const row = rowOf(grid.rules, 'R5');
  assert.equal(row.status, 'unjudged');
  assert.equal(row.reason, 'declared-exemption');
  // 칸은 남는다 — 면제는 칸을 「밖」에 두는 선언이고, 격자에서 빼는 선언이 아니다.
  assert.equal(
    gridCounts(grid).cells,
    (Object.keys(DECLARATION.admissions).length + Object.keys(DECLARATION.exemptions).length) *
      DECLARATION.ui.length,
  );
});

test('고른 판정기의 위반은 그 줄의 위반이다', () => {
  const declaration = { ui: ['app/'], admissions: { R1: { verifiers: ['ui-paths'] } } };
  // 선언된 표면이 실재하지 않는다 — 분모가 허공을 가리키고, 그것은 위반이다.
  const grid = gridOf({ 'README.md': 'ok\n', 'graduand.json': JSON.stringify(declaration) });
  assert.equal(rowOf(grid.rules, 'R1').status, 'violation');
  assert.equal(rowOf(grid.rules, 'R1').reason, null);
  const counts = gridCounts(grid);
  assert.equal(counts.violation, counts.cells);
});

test('빈 분모는 미판정이다 — 편입 0 · 표면 0 · 선언 부재가 같은 자리에 앉는다', () => {
  const empties: Record<string, string | null>[] = [
    // 편입 기록 자체가 없다 — 1일차 고객.
    { 'README.md': 'ok\n', 'graduand.json': '{"ui": ["docs/"]}\n' },
    // 「편입 0」이라는 참인 선언.
    { 'README.md': 'ok\n', 'graduand.json': '{"ui": ["docs/"], "admissions": {}}\n' },
    // 행은 있으나 열이 없다 — 「UI 없음」은 참인 선언이지만 격자의 열을 주지 않는다.
    { 'README.md': 'ok\n', 'graduand.json': '{"ui": [], "admissions": {"R1": {"verifiers": ["refs"]}}}\n' },
    { 'README.md': 'ok\n', 'graduand.json': '{"admissions": {"R1": {"verifiers": ["refs"]}}}\n' },
    // 선언 파일이 아예 없다.
    { 'README.md': 'ok\n' },
  ];
  for (const entries of empties) {
    const grid = gridOf(entries);
    const counts = gridCounts(grid);
    assert.equal(grid.reason, 'no-declaration', JSON.stringify(entries['graduand.json']));
    assert.equal(counts.cells, 0);
    assert.deepEqual([counts.violation, counts.pass, counts.unjudged], [0, 0, 0]);
  }
});

test('선언 파일을 못 읽었으면 잘림이다 — 부재로 접지 않는다', () => {
  const snapshot = snap({ 'README.md': 'ok\n', 'graduand.json': null });
  const grid = admissionGrid(snapshot, judgeSnapshot(snapshot).checks);
  assert.equal(grid.reason, 'collection-truncated');
  assert.equal(gridCounts(grid).cells, 0);
});

test('깨진 선언에서는 격자도 수를 내지 않는다 — 판정 실패다', () => {
  const snapshot = snap({ 'README.md': 'ok\n', 'graduand.json': '{"coverage": "enforced"}\n' });
  assert.throws(() => admissionGrid(snapshot, []), DeclarationInvalidError);
});

// ── 개정 4 — 이름 하나가 칸 여럿을 모은다 ──────────────────────────────

test('규칙이 선언한 판정기 이름 하나가 **축 전부의 칸**을 모은다 — 한 축의 위반이 줄을 빨갛게 한다', () => {
  // 축 둘: 하나는 코드와 박제가 같고(통과), 하나는 어긋난다(위반). 규칙이 선언하는 것은
  // **등록부의 이름**(`shared-values`) 하나이고, 칸은 `shared-values:<축>` 둘이다.
  const declaration = {
    ui: ['src/'],
    'shared-values': {
      ok: {
        adapter: 'css-custom-properties',
        files: ['src/ok.css'],
        scope: ':root',
        canon: { repo: 'acme/design-system', file: 'tokens.css', scope: ':root' },
        pinned: { '--ink': '#1C1F2E' },
      },
      drifted: {
        adapter: 'css-custom-properties',
        files: ['src/drifted.css'],
        scope: ':root',
        canon: { repo: 'acme/design-system', file: 'tokens.css', scope: ':root' },
        pinned: { '--paper': '#FFFFFF' },
      },
    },
    admissions: { R1: { verifiers: ['shared-values'] } },
  };
  const { grid, checks } = judged({
    'graduand.json': `${JSON.stringify(declaration)}\n`,
    'src/ok.css': ':root {\n  --ink: #1C1F2E;\n}\n',
    'src/drifted.css': ':root {\n  --paper: #F6F5F2;\n}\n', // 박제와 어긋난다
  });

  assert.equal(checks.find((c) => c.id === 'shared-values:ok')!.status, 'pass');
  assert.equal(checks.find((c) => c.id === 'shared-values:drifted')!.status, 'violation');
  // ⛔ 축 사이를 접지 않는다 — 「하나는 통과」가 그 줄의 ✅ 를 사지 못한다.
  assert.equal(rowOf(grid.rules, 'R1').status, 'violation');
  // 선언에 적힌 것은 여전히 **등록부의 이름**이다 — 축은 결과의 칸이 든다.
  assert.deepEqual(rowOf(grid.rules, 'R1').verifiers, ['shared-values']);
});
