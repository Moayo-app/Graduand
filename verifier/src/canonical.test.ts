import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson } from './canonical.ts';

test('키 삽입 순서와 무관하게 같은 바이트를 낸다', () => {
  const a = canonicalJson({ b: 1, a: { d: [1, 2], c: 'x' } });
  const b = canonicalJson({ a: { c: 'x', d: [1, 2] }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"c":"x","d":[1,2]},"b":1}');
});

test('공백 없는 결정적 출력 — 배열 순서는 보존한다', () => {
  assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
  assert.equal(canonicalJson({ k: null }), '{"k":null}');
  assert.equal(canonicalJson('한글 "quote"'), JSON.stringify('한글 "quote"'));
});

test('비결정 값은 조용히 넘기지 않고 던진다', () => {
  assert.throws(() => canonicalJson({ a: undefined }), TypeError);
  assert.throws(() => canonicalJson(Number.NaN), TypeError);
  assert.throws(() => canonicalJson(Number.POSITIVE_INFINITY), TypeError);
  assert.throws(() => canonicalJson(new Date()), TypeError);
  assert.throws(() => canonicalJson(new Map()), TypeError);
  assert.throws(() => canonicalJson(() => 1), TypeError);
});
