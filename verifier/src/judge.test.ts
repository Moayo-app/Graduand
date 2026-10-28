import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeSnapshot } from './judge.ts';
import { SCHEMA_VERSION } from './schema.ts';
import { DeclarationInvalidError } from './declaration.ts';
import { VERIFIER_IDS } from './verifiers/registry.ts';
import type { RepoSnapshot } from './snapshot.ts';

function snap(entries: Record<string, string | null>, extraPaths: string[] = []): RepoSnapshot {
  const paths = [...Object.keys(entries), ...extraPaths].sort();
  return { repo: 'acme/widgets', commit: 'd'.repeat(40), paths, files: new Map(Object.entries(entries)) };
}

test('체크는 id 순으로 정렬되고 스키마 식별 필드를 싣는다', () => {
  const j = judgeSnapshot(snap({ 'README.md': 'plain text', 'graduand.json': '{"ui": []}' }));
  assert.equal(j.v, SCHEMA_VERSION);
  assert.equal(j.repo, 'acme/widgets');
  assert.equal(j.commit, 'd'.repeat(40));
  assert.deepEqual(j.checks.map((c) => c.id), ['refs', 'shared-values', 'shared-values-cross', 'ui-paths']);
});

test('도는 판정기의 정본은 등록부다 — 하드코딩된 배열이 아니다', () => {
  const j = judgeSnapshot(snap({ 'README.md': 'plain text', 'graduand.json': '{"ui": []}' }));
  // 등록부의 이름 전부가 칸을 내고, 등록부 밖의 칸은 없다. 목록을 **읽어서** 비교한다 —
  // 이름을 테스트에 베껴 적으면 그 사본이 등록부와 갈라질 수 있다.
  assert.deepEqual(
    j.checks.map((c) => c.id),
    [...VERIFIER_IDS].sort(),
  );
  // 같은 판정기가 두 칸을 내도 한 번만 돈다 — id 는 유일하다.
  assert.equal(new Set(j.checks.map((c) => c.id)).size, j.checks.length);
});

test('선언이 깨지면 판정 실패 — 미판정으로 접지 않고 던진다', () => {
  assert.throws(
    () => judgeSnapshot(snap({ 'README.md': 'x', 'graduand.json': '{"typo": 1}' })),
    DeclarationInvalidError,
  );
});

test('선언 파일이 추적되는데 못 읽었으면 ui-paths 는 잘림이다', () => {
  const j = judgeSnapshot(snap({ 'README.md': 'x', 'graduand.json': null }));
  const ui = j.checks.find((c) => c.id === 'ui-paths')!;
  assert.equal(ui.status, 'unjudged');
  assert.equal(ui.reason, 'collection-truncated');
});

test('선언 파일이 아예 없으면 ui-paths 는 no-declaration, refs 는 그냥 돈다', () => {
  const j = judgeSnapshot(snap({ 'README.md': '[g](docs/g.md)', 'docs/g.md': 'ok' }));
  const ui = j.checks.find((c) => c.id === 'ui-paths')!;
  assert.equal(ui.reason, 'no-declaration');
  const refs = j.checks.find((c) => c.id === 'refs')!;
  assert.equal(refs.status, 'pass');
});
