// 증서 가드 — 「선언된 미러가 정본과 같다」 · 「Terms 칸이 서고 Change Date 가 읽히는 모양이다」
// · 「증서가 부르는 경로와 선언의 BSL 행이 같다」.
//
// 가드의 본체는 tools/lib/license-copy.mjs 이고, 여기서는 실제 트리와 **갈라짐을 심은
// 사본 트리** 둘을 다 잰다 — 초록만 보면 그 초록이 「같다」인지 「아무것도 안 봤다」인지
// 말할 수 없다.
//
// ⭐⭐ **심기가 Change Date 의 지금 값에 매이지 않는다.** 전에는 `'UNSET'` 문자열을 찾아
//    바꿨고, 그래서 **날짜가 박히는 날** 그 replace 가 무효타가 되어 갈라짐을 심지 못한
//    채 「심었는데 안 잡힌다」로 빨개졌다 — 바이트 비교가 산다는 증명이 하필 발행일에
//    공허해지는 자리였다. 지금은 칸이 무엇이든 그 줄을 **다른 값으로** 바꾼다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CERTIFICATE,
  CHANGE_DATE,
  CHANGE_DATE_STATES,
  TERMS_FIELDS,
  PRODUCT_LICENSE,
  checkMirrors,
  checkTermsBlock,
  changeDateState,
  checkChangeDatePassed,
  licensedWorkBlock,
  checkLicensedWorkScope,
} from '../lib/license-copy.mjs';
import { SCOPE_PATH, mirrorPairs } from '../lib/public-scope.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MIRROR = 'LICENSE';
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** 실제 트리의 사본 — 갈라짐을 심는 자리. 임시 디렉터리의 뒷정리는 OS 몫이다. */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-license-'));
  for (const rel of [MIRROR, CERTIFICATE, SCOPE_PATH]) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
  }
  return root;
}
const rewrite = (root, rel, fn) => fs.writeFileSync(path.join(root, rel), fn(read(root, rel)));

const CHANGE_DATE_LINE = /^(Change Date:[ \t]+)(\S+)/m;

/** Change Date 칸을 그 값으로 적는다 — 모양이 틀린 값을 심는 자리. */
const setChangeDate = (text, value) => {
  assert.match(text, CHANGE_DATE_LINE, 'Change Date 줄을 찾지 못했다 — 심기가 분모를 잃었다');
  return text.replace(CHANGE_DATE_LINE, `$1${value}`);
};

/**
 * Change Date 를 **지금과 다른 올바른 날짜**로 다시 박는다 — 발행마다 오는 그 사건의 재현.
 *
 * ⭐⭐ 심을 값을 **지금 값에서 유도한다.** 고정 날짜를 적으면 그 날짜가 실제로 박히는 판에서
 * replace 가 무효타가 되고, 심지 않은 채 「심었는데 안 잡힌다」로 빨개진다 — `UNSET` 문자열에
 * 매여 있던 그 결함이 **찾는 값에서 쓰는 값으로** 한 칸 옮겨 간 꼴이다. 유도하면 충돌이
 * 구조적으로 불가능하다. ⇒ 이 함수가 「값에 매이지 않는다」의 실물이다.
 */
const restamp = (text) => {
  const current = text.match(CHANGE_DATE_LINE)?.[2];
  assert.ok(current, 'Change Date 줄을 찾지 못했다 — 심기가 분모를 잃었다');
  const next = current === '2030-10-26.' ? '2031-01-02.' : '2030-10-26.';
  const out = setChangeDate(text, next);
  assert.notEqual(out, text, '심기가 아무것도 바꾸지 않았다 — 분모가 빈 채로 도는 자리다');
  return out;
};

// ── 양성 ──────────────────────────────────────────────────────────────────────

test('미러 — 선언된 사본이 제 정본과 바이트까지 같다', () => {
  assert.deepEqual(checkMirrors(ROOT), []);
});

test('⭐ 미러의 짝이 **선언에서** 온다 — 가드에 박혀 있지 않다', () => {
  const pairs = mirrorPairs(ROOT);
  assert.ok(pairs.length > 0, '선언에 미러가 0 이면 위 초록은 미판정이다');
  assert.deepEqual(pairs, [[MIRROR, CERTIFICATE]], '지금 선언된 미러는 루트 증서 하나다');
});

test('증서 — Terms 블록의 다섯 칸이 서 있고 Change Date 가 읽히는 모양이다', () => {
  assert.deepEqual(checkTermsBlock(ROOT), []);
  assert.equal(TERMS_FIELDS.length, 5);
});

test('⚠️ 단정이 **정본**을 읽는다 — 미러를 읽으면 발행 내내 거짓 초록이다', () => {
  // ⭐ 정본에만 날짜를 박고 미러는 그대로 둔다 = 배달 직후의 상태. 그때 Terms 단정이
  //    **정본을 보고 있어야** 하고, 미러가 뒤처진 사실은 checkMirrors 가 따로 말한다.
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, restamp);
  assert.deepEqual(checkTermsBlock(root), [], '정본의 ISO 날짜는 올바른 모양이라 초록이다');
  assert.equal(checkMirrors(root).length, 1, '뒤처진 미러는 미러 가드가 말한다');
  // ⛔ 거꾸로 — 정본은 미결인데 미러에만 날짜가 박히면, 정본을 읽는 단정은 그것을 모른다.
  //    그 사실도 미러 가드가 잡는다(아래 negative). 두 가드의 모집단이 다르다는 뜻이다.
});

test('⭐⭐ Change Date 단정이 **상태가 아니라 모양**이다 — 발행일에 지울 것이 없다', () => {
  assert.ok(CHANGE_DATE.test('Change Date:          UNSET. 아직 발행 전이다'), '미결이 읽힌다');
  assert.ok(CHANGE_DATE.test('Change Date:          2030-10-26. 이 판의 값이다'), 'ISO 날짜가 읽힌다');
  assert.ok(!CHANGE_DATE.test('Change Date:'), '빈 칸은 조용하므로 읽히지 않는다');
  assert.ok(!CHANGE_DATE.test('Change Date:          2030년 10월 26일.'), '지어낸 모양은 읽히지 않는다');
  assert.ok(!CHANGE_DATE.test('Change Date:          four years after release.'), '산문은 날짜가 아니다');
});

test('증서 — Licensed Work 가 부르는 경로와 선언의 BSL 행이 양방향 1:1 이다', () => {
  assert.deepEqual(checkLicensedWorkScope(ROOT), []);
  assert.ok([...licensedWorkBlock(read(ROOT, CERTIFICATE)).matchAll(/`([^`\n]+\/)`/g)].length > 0, '증서가 경로를 부른다');
});

test('증서 — Licensed Work 칸을 칸 순서에 기대지 않고 끊는다', () => {
  const block = licensedWorkBlock(read(ROOT, CERTIFICATE));
  assert.ok(block.includes('`verifier/`'), '칸 본문이 제 경로를 담는다');
  for (const field of TERMS_FIELDS.filter((f) => f !== 'Licensed Work:'))
    assert.ok(!block.includes(`\n${field}`), `${field} 가 칸 본문에 섞여 들어왔다`);
});

// ── negative ─────────────────────────────────────────────────────────────────

test('미러 (negative) — 정본의 Change Date 가 박히고 미러가 뒤처지면 미러를 지목한다', () => {
  const root = cloneRoot();
  assert.deepEqual(checkMirrors(root), [], '심기 전의 사본은 초록이다');
  // ⭐ 이것이 **발행마다 오는 그 사건**이다 — 지금 칸이 UNSET 이든 날짜든 같은 심기로 선다.
  rewrite(root, CERTIFICATE, restamp);
  const errors = checkMirrors(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes(MIRROR) && errors[0].includes(CERTIFICATE), errors[0]);
  assert.ok(errors[0].includes('손으로 고치지 않는다'), '고칠 자리를 거꾸로 지시하지 않는다');
});

test('미러 (negative) — ⛔ 미러만 손으로 고쳐도 빨갛다: 고칠 자리가 그쪽이 아니다', () => {
  const root = cloneRoot();
  rewrite(root, MIRROR, restamp);
  assert.equal(checkMirrors(root).length, 1, '미러를 앞질러 고치는 손도 갈라짐이다');
});

test('미러 (negative) — ⛔ 분모가 빈 채로 초록이 되지 않는다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_PATH, (s) => s.replace('    mirrors: verifier/LICENSE\n', ''));
  const errors = checkMirrors(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('mirrors 축을 쓰는 행이 0'), errors[0]);
});

test('미러 (negative) — 정본이 비면 「같다」가 참인 채로 아무것도 재지 않으므로 빨갛다', () => {
  const root = cloneRoot();
  for (const rel of [CERTIFICATE, MIRROR]) fs.writeFileSync(path.join(root, rel), 'Business Source License 1.1\n');
  const errors = checkMirrors(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('너무 짧다'), errors[0]);
});

test('증서 (negative) — Terms 블록의 칸을 지우면 그 칸 이름이 불린다', () => {
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, (s) => s.replace('Additional Use Grant:', 'Additional Use Note: '));
  assert.equal(checkTermsBlock(root).filter((e) => e.includes('Additional Use Grant:')).length, 1);
});

test('증서 (negative) — 지어낸 모양이 박히면 단정이 운다 (빈 칸도 같다)', () => {
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, (s) => setChangeDate(s, '2030년.'));
  assert.equal(checkTermsBlock(root).filter((e) => e.includes('Change Date')).length, 1);
  rewrite(root, CERTIFICATE, (s) => setChangeDate(s, '').replace(/^Change Date:[ \t]+$/m, 'Change Date:'));
  assert.equal(checkTermsBlock(root).filter((e) => e.includes('Change Date')).length, 1);
});

test('증서 (negative) — 증서가 한 디렉터리를 그만 부르면 선언의 그 행이 지목된다', () => {
  const root = cloneRoot();
  assert.deepEqual(checkLicensedWorkScope(root), [], '심기 전의 사본은 초록이다');
  // ⭐ 백틱을 떼는 것만으로 증서는 그 경로를 **이름으로 부르지 않게** 된다 — 산문은 거의
  //    그대로인데 허가의 범위가 좁아지는, 조용한 쪽의 사고다.
  rewrite(root, CERTIFICATE, (s) => s.replace('`diagnosis/`', 'diagnosis/'));
  const errors = checkLicensedWorkScope(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('diagnosis/') && errors[0].includes(SCOPE_PATH), errors[0]);
});

test('증서 (negative) — 선언이 BSL 을 떼면 **두 허가가 동시에** 걸리므로 반대 방향도 운다', () => {
  const root = cloneRoot();
  rewrite(root, SCOPE_PATH, (s) =>
    s.replace(
      '  - path: diagnosis/\n    origin: workshop\n    license: BSL-1.1\n',
      '  - path: diagnosis/\n    origin: workshop\n    license: Apache-2.0\n',
    ),
  );
  const errors = checkLicensedWorkScope(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes(CERTIFICATE) && errors[0].includes('diagnosis/'), errors[0]);
});

test('증서 (negative) — ⛔ 분모가 빈 채로 초록이 되지 않는다: 양쪽 다 0 이어도 「같다」는 참이다', () => {
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, (s) => s.replaceAll('`verifier/`', 'verifier/').replaceAll('`diagnosis/`', 'diagnosis/'));
  rewrite(root, SCOPE_PATH, (s) => s.replaceAll('    license: BSL-1.1\n', '    license: Apache-2.0\n'));
  const errors = checkLicensedWorkScope(root);
  assert.equal(errors.length, 2, errors.join(' · '));
  assert.ok(errors.some((e) => e.includes(CERTIFICATE)) && errors.some((e) => e.includes(PRODUCT_LICENSE)));
});

// ── Change Date 가 지나갔는가 ─────────────────────────────────────────────────
//
// ⭐⭐ 이 축만 **시계를 읽는다.** 그래서 판정에 오늘을 **주입**하고, 테스트는 고정 날짜로
//    양쪽을 다 잰다 — 같은 커밋이 돌리는 날에 따라 다른 답을 주지 않는다.

/** 고정된 「오늘」 — UTC 자정으로 지어, 돌리는 기계의 시간대가 답을 바꾸지 않게 한다. */
const DAY = (iso) => new Date(`${iso}T00:00:00Z`);
const TODAY = DAY('2030-06-15');
const stamped = (text, iso) => setChangeDate(text, `${iso}.`);

test('⭐⭐ 지금의 초록에 **이름이 붙어 있다** — 「잴 날짜가 없다」이지 「날짜가 괜찮다」가 아니다', () => {
  // 이 단정이 이 축의 요점이다. 발행 전에는 이 가드가 영원히 초록이고, 그 초록이
  // 「괜찮다」로 읽히는 순간 아무도 이 축을 다시 보지 않는다 — 미판정이 통과가 된다.
  assert.deepEqual(checkChangeDatePassed(ROOT), []);
  assert.deepEqual(changeDateState(read(ROOT, CERTIFICATE)), { state: 'unstamped' });
  assert.equal(CHANGE_DATE_STATES.length, 4);
});

test('상태 넷이 갈린다 — 미결 · 아직 멀다 · 지나갔다 · 모양이 아니다', () => {
  const base = read(ROOT, CERTIFICATE);
  assert.equal(changeDateState(base, TODAY).state, 'unstamped');
  assert.equal(changeDateState(stamped(base, '2030-06-16'), TODAY).state, 'future');
  assert.equal(changeDateState(stamped(base, '2030-06-14'), TODAY).state, 'passed');
  assert.equal(changeDateState(setChangeDate(base, '2030년.'), TODAY).state, 'unreadable');
  assert.equal(changeDateState('증서가 아니다\n', TODAY).state, 'unreadable');
});

test('⚠️ 당일도 늦다 — 효력이 **그날** 시작한다', () => {
  const base = read(ROOT, CERTIFICATE);
  assert.equal(changeDateState(stamped(base, '2030-06-15'), TODAY).state, 'passed', '그날은 이미 넘어간 날이다');
  assert.equal(changeDateState(stamped(base, '2030-06-16'), TODAY).state, 'future');
});

test('⚠️ 날짜 비교가 **UTC 일자**다 — 시간대가 같은 커밋의 답을 바꾸지 않는다', () => {
  const base = stamped(read(ROOT, CERTIFICATE), '2030-06-15');
  // 같은 순간을 UTC 의 서로 다른 시각으로 봐도 「그 날」이면 판정이 같다.
  for (const at of ['2030-06-15T00:00:00Z', '2030-06-15T12:34:56Z', '2030-06-15T23:59:59Z'])
    assert.equal(changeDateState(base, new Date(at)).state, 'passed', at);
  assert.equal(changeDateState(base, new Date('2030-06-14T23:59:59Z')).state, 'future', '전날은 아직 멀다');
});

test('(negative): 지나간 날짜가 박혀 있으면 가드가 그 날짜를 지목한다', () => {
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, (s) => stamped(s, '2030-06-14'));
  const errors = checkChangeDatePassed(root, TODAY);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('2030-06-14') && errors[0].includes('유료 층 보호 0'), errors[0]);
  // ⭕ 그리고 **모양**은 여전히 올바르다 — 두 축이 서로 다른 것을 잰다.
  assert.deepEqual(checkTermsBlock(root), [], '지나간 날짜도 ISO 날짜라 모양 축은 초록이다');
});

test('(negative): 아직 오지 않은 날짜는 초록이고, 그 초록은 **재서** 초록이다', () => {
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, (s) => stamped(s, '2030-06-16'));
  assert.deepEqual(checkChangeDatePassed(root, TODAY), []);
  assert.equal(changeDateState(read(root, CERTIFICATE), TODAY).state, 'future');
});

test('⚠️ 모양이 아닌 칸은 이 가드가 **말하지 않는다** — 모양의 주인은 checkTermsBlock 이다', () => {
  // 한 사실에 주인이 둘이면 같은 빨강이 두 번 울고 고칠 자리가 흐려진다.
  const root = cloneRoot();
  rewrite(root, CERTIFICATE, (s) => setChangeDate(s, '2030년.'));
  assert.deepEqual(checkChangeDatePassed(root, TODAY), [], '여기서는 침묵한다');
  assert.equal(checkTermsBlock(root).filter((e) => e.includes('Change Date')).length, 1, '그쪽이 말한다');
});
