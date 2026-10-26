/**
 * 판정기 닫힌 등록부 — 고객이 편입 기록에서 **고를 수 있는 이름의 전부**.
 *
 * 규율 셋:
 * 1. **고객은 우리가 출하한 이름 중에서 고른다.** 셸 명령을 선언하는 자리는 없다 —
 *    고객 CI 와 브라우저가 같은 순수 함수 하나를 쓰기 때문이고(`judge.ts`), 브라우저는
 *    셸을 돌릴 수 없다. 받는 순간 두 표면이 다른 수를 낸다.
 * 2. **이름 = 판정 결과의 `CheckResult.id` 다.** 어휘가 둘이면 선언된 이름이 결과의
 *    어느 칸인지 말할 수 없다 — 각 판정기 모듈의 체크 id 상수가 이 목록을 `satisfies`
 *    로 겨냥해 둘의 일치를 타입이 집행한다. 축이 갈린 판정기(`palette`·`palette-cross`)
 *    는 칸이 둘이므로 이름도 둘이다.
 * 3. **모르는 이름은 「판정 실패」다** — 미판정이 아니다. 선례는 미지의 어댑터 id
 *    (`declaration.ts`)이고 규칙은 하나다: **선언하지 않은 것은 미판정, 잘못 선언한
 *    것은 판정 실패.** 조용한 무시가 간극의 숨는 자리다. 「판정기 없음」(부재 · 빈
 *    목록)의 자리는 따로 있다 — `schema.ts` 의 `no-verifier` 사유다.
 *
 * ⛔ 이 모듈은 아무것도 import 하지 않는다 — 판정기 모듈들이 이것을 가리키므로
 * 반대 방향 간선을 두면 순환이고, 순환의 상수는 초기화 순서에 따라 비어 보인다.
 */

export const VERIFIER_IDS = ['palette', 'palette-cross', 'refs', 'ui-paths'] as const;

export type VerifierId = (typeof VERIFIER_IDS)[number];

export const isVerifierId = (name: string): name is VerifierId =>
  (VERIFIER_IDS as readonly string[]).includes(name);
