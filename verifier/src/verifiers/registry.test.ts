import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIER_IDS, isVerifierId } from './registry.ts';
import { SHARED_VALUES_CHECK_ID, SHARED_VALUES_CROSS_CHECK_ID } from './shared-values.ts';
import { REFS_CHECK_ID } from './refs.ts';
import { UI_PATHS_CHECK_ID } from './ui-paths.ts';

test('등록부 = 출하한 체크 id 의 전부 — 어휘가 하나다', () => {
  // `satisfies` 가 한 방향(상수 → 등록부)을 집행한다. 이 가드가 반대 방향을 집행한다 —
  // 판정기 없는 이름을 등록부에 더하면 고객이 그것을 선언하고 그 칸은 영원히 오지 않는다.
  assert.deepEqual(
    [...VERIFIER_IDS].sort(),
    [SHARED_VALUES_CHECK_ID, SHARED_VALUES_CROSS_CHECK_ID, REFS_CHECK_ID, UI_PATHS_CHECK_ID].sort(),
  );
});

test('모르는 이름은 등록부가 받지 않는다 — 판정은 선언 검증이 한다', () => {
  assert.equal(isVerifierId('refs'), true);
  assert.equal(isVerifierId('palette-corss'), false);
  assert.equal(isVerifierId(''), false);
});
