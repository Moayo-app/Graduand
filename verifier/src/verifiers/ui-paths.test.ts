import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeUiPaths } from './ui-paths.ts';
import { indexPaths } from '../snapshot.ts';

const index = indexPaths(['app/index.html', 'app/main.ts', 'site.css', 'docs/guide.md']);

test('선언 부재 = unjudged(no-declaration) — 「위반 0」이 아니다', () => {
  const absent = judgeUiPaths(index, { state: 'absent' });
  assert.equal(absent.status, 'unjudged');
  assert.equal(absent.reason, 'no-declaration');

  const noKey = judgeUiPaths(index, { state: 'valid', ui: null, palette: null, admissions: null, exemptions: null });
  assert.equal(noKey.status, 'unjudged');
  assert.equal(noKey.reason, 'no-declaration');
});

test('ui: [] 는 「UI 없음」 선언 — 판정 대상 0 으로 pass', () => {
  const r = judgeUiPaths(index, { state: 'valid', ui: [], palette: null, admissions: null, exemptions: null });
  assert.equal(r.status, 'pass');
  assert.equal(r.counts.declared, 0);
});

test('선언된 경로가 전부 실재하면 pass — 디렉터리와 파일 양쪽', () => {
  const r = judgeUiPaths(index, { state: 'valid', ui: ['app/', 'site.css'], palette: null, admissions: null, exemptions: null });
  assert.equal(r.status, 'pass');
  assert.deepEqual(r.counts, { declared: 2, present: 2, absent: 0, evidenceOmitted: 0 });
});

test('허공을 가리키는 선언은 violation — missing 과 not-a-dir 를 가른다', () => {
  const r = judgeUiPaths(index, { state: 'valid', ui: ['web/', 'site.css/'], palette: null, admissions: null, exemptions: null });
  assert.equal(r.status, 'violation');
  assert.deepEqual(r.evidence, [
    { path: 'web/', presence: 'missing' },
    { path: 'site.css/', presence: 'not-a-dir' },
  ]);
});

test('선언 파일을 읽지 못했으면 부재가 아니라 잘림이다 (AC3)', () => {
  const r = judgeUiPaths(index, 'unreadable');
  assert.equal(r.status, 'unjudged');
  assert.equal(r.reason, 'collection-truncated');
});
