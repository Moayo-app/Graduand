// 증서 가드 — 「발행본이 싣는 증서가 정본과 같다」와 「Terms 블록의 칸이 서 있다」.
// 가드의 본체는 tools/lib/license-copy.mjs 이고, 여기서는 실제 트리와 **갈라짐을 심은
// 사본 트리** 둘을 다 잰다 — 초록만 보면 그 초록이 「같다」인지 「아무것도 안 봤다」인지
// 말할 수 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CANON, PACKAGED_COPY, TERMS_FIELDS, checkPackagedCopy, checkTermsBlock } from '../lib/license-copy.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** 실제 트리의 사본 — 갈라짐을 심는 자리. 임시 디렉터리의 뒷정리는 OS 몫이다. */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-license-'));
  fs.mkdirSync(path.join(root, 'verifier'));
  for (const rel of [CANON, PACKAGED_COPY]) fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  return root;
}
const rewrite = (root, rel, fn) => fs.writeFileSync(path.join(root, rel), fn(fs.readFileSync(path.join(root, rel), 'utf8')));

test('증서 — 발행본이 싣는 사본이 정본과 바이트까지 같다', () => {
  assert.deepEqual(checkPackagedCopy(ROOT), []);
});

test('증서 — Terms 블록의 다섯 칸이 서 있고, Change Date 가 미결로 읽힌다', () => {
  assert.deepEqual(checkTermsBlock(ROOT), []);
  assert.equal(TERMS_FIELDS.length, 5);
});

test('증서 (negative) — 사본의 한 글자가 달라지면 가드가 그 파일을 지목한다', () => {
  const root = cloneRoot();
  // ⭐ 심는 갈라짐이 **Change Date 한 줄**이다 — 발행마다 다시 박히는 그 칸이 이 가드의 표적이다.
  rewrite(root, PACKAGED_COPY, (s) => s.replace('Change Date:          UNSET.', 'Change Date:          2030-01-01.'));
  const errors = checkPackagedCopy(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes(PACKAGED_COPY), errors[0]);
});

test('증서 (negative) — Terms 블록의 칸을 지우면 그 칸 이름이 불린다', () => {
  const root = cloneRoot();
  rewrite(root, CANON, (s) => s.replace('Additional Use Grant:', 'Additional Use Note: '));
  assert.equal(checkTermsBlock(root).filter((e) => e.includes('Additional Use Grant:')).length, 1);
});

test('증서 (negative) — 지어낸 날짜가 박히면 미결 단정이 운다', () => {
  const root = cloneRoot();
  rewrite(root, CANON, (s) => s.replace('Change Date:          UNSET.', 'Change Date:          2030-01-01.'));
  assert.equal(checkTermsBlock(root).filter((e) => e.includes('UNSET')).length, 1);
});
