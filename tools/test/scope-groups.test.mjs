// 범위 묶음 가드 — 양성 + negative ([ISSUE-52] AC1~AC7).
// 가드의 본체는 tools/lib/scope-groups.mjs, 묶음 이름의 정본은 CLAUDE.md §1 의 표,
// 경로 → 묶음의 배정은 config/public-scope.yml 의 `group` 축이다.
//
// ⚠️ negative 가 양성보다 많다. 이 가드가 재는 것은 전부 「빨갛다」를 요구하므로 실제 트리가
// 초록인 것만으로는 아무것도 검증되지 않는다 — 분모가 비어도 초록이기 때문이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCOPE_PATH, SCOPE_GROUPS_DOC, scopeEntries, walkFiles, coveringEntry, checkScopeCoverage, checkScopeEntries } from '../lib/public-scope.mjs';
import {
  GROUPS_TABLE_HEADER,
  GROUPS_ECHO,
  declaredGroups,
  groupTally,
  checkFileGroups,
  checkGroupNames,
  checkGroupsUsed,
  checkGroupEcho,
} from '../lib/scope-groups.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const clean = (name, fn) => test(name, () => assert.deepEqual(fn(ROOT), []));
const hits = (errors, needle) => errors.filter((e) => e.includes(needle));

/** 실제 트리의 사본 — 위반을 심는 자리. 설치물과 산출은 빼고 베낀다(주사가 걷어낼 자리다). */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-groups-'));
  fs.cpSync(ROOT, root, { recursive: true, filter: (src) => !/(^|[/\\])(\.git|node_modules|dist)$/.test(src) });
  return root;
}
const rewrite = (root, rel, fn) => {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  assert.notEqual(after, before, `${rel}: 심을 자리를 찾았다 — 바뀐 것이 없으면 이 통제는 아무것도 심지 않는다`);
  fs.writeFileSync(file, after);
};

// ─── AC1 (양성) ───────────────────────────────────────────────────────────────

clean('AC1: 묶음 밖 파일이 0 이다 — 파일 전수가 §1 의 묶음을 받는다', checkFileGroups);
clean('AC3: 선언이 쓰는 묶음이 전부 §1 의 표에 있다', checkGroupNames);
clean('AC4: 아무 행도 가리키지 않는 묶음이 0 이다', checkGroupsUsed);
clean('AC6: 표의 묶음이 전부 README 에 불린다', checkGroupEcho);

test('AC1: 요약 줄이 선다 — 묶음별 수의 합이 전수와 같고, 분모가 0 이 아니다', () => {
  const { tally, orphans, total } = groupTally(ROOT);
  assert.equal(orphans.length, 0, orphans.map(([f]) => f).join(' · '));
  assert.ok(total > 0, '분모가 비면 「묶음 밖 0」은 아무것도 뜻하지 않는다');
  assert.equal([...tally.values()].reduce((a, b) => a + b, 0), total, '합이 전수와 같다 — 어느 파일도 두 번 세이거나 빠지지 않는다');
  assert.equal(tally.size, declaredGroups(ROOT).length);
  for (const [group, n] of tally) assert.ok(n > 0, `묶음 「${group}」 에 드는 파일이 0 이다`);
});

test('AC7: 죽은 행이 0 이다 — 쪼갠 넷을 포함해 모든 행이 적어도 한 파일을 이긴다', () => {
  const entries = scopeEntries(ROOT);
  const files = walkFiles(ROOT);
  const dead = entries.filter((row) => !files.some((f) => coveringEntry(entries, f) === row)).map(([p]) => p);
  assert.deepEqual(dead, [], '⚠️ 덮는 규칙이 「먼저 매칭되는 행이 이긴다」라, 접두사 안의 좁은 행은 조용히 죽는다');
  for (const p of ['tools/lib/', 'tools/test/', 'tools/render-policies.mjs', 'tools/ruleset-drift.mjs'])
    assert.ok(entries.some(([q]) => q === p), `쪼갠 행 ${p} 가 선언에 있다`);
  assert.equal(entries.filter(([p]) => p === 'tools/').length, 0, '굵은 행은 남아 있지 않다 — 남으면 그것이 먼저 이겨 넷이 다 죽는다');
});

test('AC7: 쪼갠 뒤에도 기존 두 가드가 그대로 선다', () => {
  assert.deepEqual(checkScopeCoverage(ROOT), []);
  assert.deepEqual(checkScopeEntries(ROOT), []);
});

test('AC1: 정책 렌더가 운영이 아니라 배선으로 적혀 있다 — 쪼갠 이유가 이 한 칸이다', () => {
  const groupOf = (p) => scopeEntries(ROOT).find(([q]) => q === p)[5];
  assert.equal(groupOf('tools/render-policies.mjs'), '사이트 배선');
  assert.equal(groupOf('tools/lib/'), '저장소 운영');
});

// ─── negative ────────────────────────────────────────────────────────────────

test('AC2 (negative): ⚠️ 행에서 group 을 지우면 scopeEntries 가 **던진다** — license 와 같은 대우다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_PATH, (s) => s.replace('    group: "정책 문서"\n', ''));
  assert.throws(() => scopeEntries(root), /group 이 없다/, '빈 칸이 통과하면 그 경로가 범위 정의 밖에서 공개된다');
});

test('AC3 (negative): 표에 없는 묶음 이름을 적으면 그 행을 이름으로 지목한다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_PATH, (s) => s.replace('    group: "사이트 배선"\n    basis: "사이트가 서는', '    group: "배포 설정"\n    basis: "사이트가 서는'));
  const errors = checkGroupNames(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('wrangler.jsonc') && errors[0].includes('배포 설정'), errors[0]);
});

test('AC4 (negative): 표에만 있고 아무 행도 안 쓰는 묶음은 범위를 조용히 넓힌다 — 그래서 빨갛다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_GROUPS_DOC, (s) =>
    s.replace('| **증서 전문** |', '| **계측기** | 아무 행도 가리키지 않는 묶음 |\n| **증서 전문** |'),
  );
  assert.equal(hits(checkGroupsUsed(root), '계측기').length, 1);
  assert.equal(hits(checkFileGroups(root), '계측기').length, 1, '드는 파일이 0 인 것도 따로 운다');
});

test('AC5 (negative): ⚠️⚠️ 표를 못 찾으면 **던진다** — 분모 0 으로 초록이 되지 않는다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_GROUPS_DOC, (s) => s.replace(GROUPS_TABLE_HEADER, '| 범위 | 설명 |'));
  assert.throws(() => declaredGroups(root), /묶음 표의 머리/);
  assert.throws(() => checkGroupNames(root), /묶음 표의 머리/, '검사 함수도 조용히 초록이 되지 않는다');
});

test('AC5 (negative): 표가 있는데 행이 0 이어도 던진다 — 머리만 남은 표는 분모가 아니다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_GROUPS_DOC, (s) => {
    const lines = s.split('\n');
    const head = lines.indexOf(GROUPS_TABLE_HEADER);
    lines.splice(head + 2, 6);
    return lines.join('\n');
  });
  assert.throws(() => declaredGroups(root), /행이 없다/);
});

test('AC6 (negative): README 에서 묶음 이름을 지우면 그 이름으로 운다', () => {
  const root = cloneRoot();
  rewrite(root, GROUPS_ECHO, (s) => s.replace('사이트 배선 · ', ''));
  const errors = checkGroupEcho(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('사이트 배선'), errors[0]);
});

test('AC1 (negative): 행을 지우면 그 아래 파일들이 묶음 밖으로 불린다 — 분모가 조용히 줄지 않는다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_PATH, (s) => s.replace(/  - path: docs\/policies\/\n(?:    [^\n]*\n)+/, ''));
  const errors = checkFileGroups(root);
  assert.ok(hits(errors, 'docs/policies/terms.md').length === 1, errors.join(' · '));
  assert.equal(hits(errors, '정책 문서').length, 1, '그 묶음에 드는 파일이 0 이 된 것도 함께 운다');
  assert.ok(hits(checkScopeCoverage(root), 'docs/policies/terms.md').length === 1, '선언 쪽 가드도 같이 운다 — 겹침이 의도다');
});

test('⚠️ 사본은 심기 전에 초록이다 — 통제가 사본 자체의 결함을 잡고 있지 않다', () => {
  const root = cloneRoot();
  for (const check of [checkFileGroups, checkGroupNames, checkGroupsUsed, checkGroupEcho]) assert.deepEqual(check(root), []);
});
