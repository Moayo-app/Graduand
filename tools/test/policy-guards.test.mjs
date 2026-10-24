// [ISSUE-12] 저장소 내 가드 10종 + 저장소 간 정본 선언표 — 양성 경로 (AC1·AC2).
// 가드의 본체는 tools/lib/policy.mjs — 여기서는 실제 트리가 전수 초록인 것만 단정한다.
// negative 경로(AC3–AC6)는 policy-guards.negative.test.mjs 가 사본 트리에 위반을 심어 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  POLICY_KINDS,
  MASTER_LOCALE,
  docLocales,
  policyFiles,
  policyBody,
  read,
  checkPopulation,
  checkStringsConfig,
  checkProductName,
  checkVendor,
  checkLegalName,
  checkMeta,
  checkTranslationSync,
  checkPriorityClause,
  checkPriceFigures,
  checkRefundAbsolutes,
  checkCanon,
} from '../lib/policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const clean = (name, fn) => test(name, () => assert.deepEqual(fn(ROOT), []));

test('G1: 모집단은 개방 목록에서 유도된다 — 테스트는 로케일 수를 적지 않는다', () => {
  const locales = docLocales(ROOT);
  assert.equal(locales[0], MASTER_LOCALE, '정본 로케일이 맨 앞이다');
  assert.equal(policyFiles(ROOT).length, locales.length * POLICY_KINDS.length, '문서 수 = 로케일 × 3');
});

clean('G2+AC6: 전수 실재 · 고아 파일 0 · locales/ko 없음', checkPopulation);
clean('G3: 금칙·필수 문자열 config 가 형태를 갖춘다', checkStringsConfig);
clean('G4+AC1: 제품 이름(잠정 식별자)이 전 로케일에서 일치하고 옛 이름이 0건이다', checkProductName);
clean('G5+AC1: 벤더 이름이 전 로케일에서 일치하고 옛 벤더가 0건이다', checkVendor);
clean('G6: 법인명은 처리방침 §5·§6 표에만 산다 — 산문 0건', checkLegalName);
clean('G7: 메타는 ko 한 벌 — 번역판에 기계 줄이 없고, 시행일 상태가 전 로케일 본문과 1:1 이다', checkMeta);
clean('AC5: 번역판의 정본 해시가 ko 본문의 지금 해시와 같다 — 재전파 대조', checkTranslationSync);
clean('G9+AC2: 번역판 선두에 한국어판 우선 조항이 축자로 선다', checkPriorityClause);
clean('G10+AC4: 본문에 가격 숫자가 0건이다 — 금액은 결제 화면 위임', checkPriceFigures);
clean('AC3: 「환불 불가」류 단정이 0건이다', checkRefundAbsolutes);
clean('저장소 간: 정본 선언표의 행이 실재와 1:1 이고, 선언 없는 정책 파일이 없다', checkCanon);

test('AC4 예외: 기간(14일 · 14 days)은 가격이 아니다 — 환불 문서가 그것을 말하고도 초록이다', () => {
  assert.ok(policyBody(read(ROOT, 'docs/policies/refund.md')).includes('14일'), 'ko 환불 정책이 14일 창을 말한다');
  assert.ok(policyBody(read(ROOT, 'docs/policies/locales/en/refund.md')).includes('14 days'), 'en 환불 정책이 14 days 를 말한다');
  assert.deepEqual(checkPriceFigures(ROOT), []);
});
