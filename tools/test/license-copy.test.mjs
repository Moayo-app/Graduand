// 증서 가드 — 「발행본이 싣는 증서가 정본과 같다」 · 「Terms 블록의 칸이 서 있다」 ·
// 「증서가 부르는 경로와 선언이 BSL 을 적은 경로가 같다」.
// 가드의 본체는 tools/lib/license-copy.mjs 이고, 여기서는 실제 트리와 **갈라짐을 심은
// 사본 트리** 둘을 다 잰다 — 초록만 보면 그 초록이 「같다」인지 「아무것도 안 봤다」인지
// 말할 수 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CANON,
  PACKAGED_COPY,
  TERMS_FIELDS,
  PRODUCT_LICENSE,
  checkPackagedCopy,
  checkTermsBlock,
  licensedWorkBlock,
  checkLicensedWorkScope,
} from '../lib/license-copy.mjs';
import { SCOPE_PATH } from '../lib/public-scope.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** 실제 트리의 사본 — 갈라짐을 심는 자리. 임시 디렉터리의 뒷정리는 OS 몫이다. */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-license-'));
  fs.mkdirSync(path.join(root, 'verifier'));
  fs.mkdirSync(path.join(root, 'config'));
  // ⚠️ 선언도 베낀다 — 1:1 가드의 분모 **둘** 중 하나다(증서가 다른 하나다).
  for (const rel of [CANON, PACKAGED_COPY, SCOPE_PATH]) fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
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

// ── 증서 ↔ 선언 1:1 ──────────────────────────────────────────────────────────

test('증서 — Licensed Work 가 부르는 경로와 선언의 BSL 행이 양방향 1:1 이다', () => {
  assert.deepEqual(checkLicensedWorkScope(ROOT), []);
  const named = [...licensedWorkBlock(fs.readFileSync(path.join(ROOT, CANON), 'utf8')).matchAll(/`([^`\n]+\/)`/g)];
  assert.ok(named.length > 0, '증서가 경로를 부르지 않으면 위 초록은 미판정이다');
});

test('증서 — Licensed Work 칸을 칸 순서에 기대지 않고 끊는다', () => {
  const block = licensedWorkBlock(fs.readFileSync(path.join(ROOT, CANON), 'utf8'));
  assert.ok(block.includes('`verifier/`'), '칸 본문이 제 경로를 담는다');
  for (const field of TERMS_FIELDS.filter((f) => f !== 'Licensed Work:'))
    assert.ok(!block.includes(`\n${field}`), `${field} 가 칸 본문에 섞여 들어왔다`);
});

test('증서 (negative) — 증서가 한 디렉터리를 그만 부르면 선언의 그 행이 지목된다', () => {
  const root = cloneRoot();
  assert.deepEqual(checkLicensedWorkScope(root), [], '심기 전의 사본은 초록이다');
  // ⭐ 백틱을 떼는 것만으로 증서는 그 경로를 **이름으로 부르지 않게** 된다 — 산문은 거의
  //    그대로인데 허가의 범위가 좁아지는, 조용한 쪽의 사고다.
  rewrite(root, CANON, (s) => s.replace('`diagnosis/`', 'diagnosis/'));
  const errors = checkLicensedWorkScope(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('diagnosis/') && errors[0].includes(SCOPE_PATH), errors[0]);
});

test('증서 (negative) — 선언이 BSL 을 떼면 **두 허가가 동시에** 걸리므로 반대 방향도 운다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_PATH, (s) =>
    s.replace('  - path: diagnosis/\n    origin: workshop\n    license: BSL-1.1\n', '  - path: diagnosis/\n    origin: workshop\n    license: Apache-2.0\n'),
  );
  const errors = checkLicensedWorkScope(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes(CANON) && errors[0].includes('diagnosis/'), errors[0]);
});

test('증서 (negative) — ⛔ 분모가 빈 채로 초록이 되지 않는다: 양쪽 다 0 이어도 「같다」는 참이다', () => {
  const root = cloneRoot();
  rewrite(root, CANON, (s) => s.replaceAll('`verifier/`', 'verifier/').replaceAll('`diagnosis/`', 'diagnosis/'));
  rewrite(root, SCOPE_PATH, (s) => s.replaceAll('    license: BSL-1.1\n', '    license: Apache-2.0\n'));
  const errors = checkLicensedWorkScope(root);
  assert.equal(errors.length, 2, errors.join(' · '));
  assert.ok(errors.some((e) => e.includes(CANON)) && errors.some((e) => e.includes(PRODUCT_LICENSE)));
});
