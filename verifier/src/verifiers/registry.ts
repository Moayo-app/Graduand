/**
 * 판정기 닫힌 등록부 — 고객이 편입 기록에서 **고를 수 있는 이름의 전부**.
 *
 * 규율 셋:
 * 1. **고객은 우리가 출하한 이름 중에서 고른다.** 셸 명령을 선언하는 자리는 없다 —
 *    고객 CI 와 브라우저가 같은 순수 함수 하나를 쓰기 때문이고(`judge.ts`), 브라우저는
 *    셸을 돌릴 수 없다. 받는 순간 두 표면이 다른 수를 낸다.
 * 2. **이름 = 판정 결과의 `CheckResult.id` 다.** 어휘가 둘이면 선언된 이름이 결과의
 *    어느 칸인지 말할 수 없다 — 각 판정기 모듈의 체크 id 상수가 이 목록을 `satisfies`
 *    로 겨냥해 둘의 일치를 타입이 집행한다. 축이 갈린 판정기(`shared-values`·`shared-values-cross`)
 *    는 칸이 둘이므로 이름도 둘이다.
 * 3. **모르는 이름은 「판정 실패」다** — 미판정이 아니다. 선례는 미지의 어댑터 id
 *    (`declaration.ts`)이고 규칙은 하나다: **선언하지 않은 것은 미판정, 잘못 선언한
 *    것은 판정 실패.** 조용한 무시가 간극의 숨는 자리다. 「판정기 없음」(부재 · 빈
 *    목록)의 자리는 따로 있다 — `schema.ts` 의 `no-verifier` 사유다.
 *
 * ⛔ 이 모듈은 아무것도 import 하지 않는다 — 판정기 모듈들이 이것을 가리키므로
 * 반대 방향 간선을 두면 순환이고, 순환의 상수는 초기화 순서에 따라 비어 보인다.
 */

export const VERIFIER_IDS = ['refs', 'shared-values', 'shared-values-cross', 'ui-paths'] as const;

export type VerifierId = (typeof VERIFIER_IDS)[number];

export const isVerifierId = (name: string): name is VerifierId =>
  (VERIFIER_IDS as readonly string[]).includes(name);

/**
 * 체크 id 와 **축 이름**을 가르는 글자 — `<판정기>:<축>`.
 *
 * ⭐⭐ **규율 2 가 개정 4 에서 갈라진 자리다.** 「이름 = 체크 id」였는데 공유값 축이 여럿이
 * 되면서 한 판정기가 **축마다 한 칸**을 낸다: 칸이 N 개인데 고객이 고르는 이름은 하나여야
 * 한다(등록부는 **우리가 출하한 것**이라 닫혀 있고, 축 이름은 **고객이 짓는** 것이라 닫힐
 * 수 없다). ⇒ 고객이 선언하는 것은 **등록부의 이름**이고, 결과의 칸은 그 이름에 축을
 * 접미한다. 격자는 접두사로 그 칸들을 다시 모은다(`grid.ts`).
 *
 * ⚠️ 그래서 축 이름에 이 글자가 들면 id 를 되 가를 수 없다 — 선언 검증이 그것을 막는다
 * (`declaration.ts` 의 `AXIS_NAME_FORBIDDEN`). ⛔ 접미 없는 맨 이름도 여전히 유효한 칸이다:
 * 축이 **하나도 선언되지 않았을 때**가 그 자리이고, 그 칸은 미판정으로 남는다.
 */
export const AXIS_SEPARATOR = ':';

/**
 * 판정기마다 **선언이 필요한가** — ⭐⭐ **무료 경계의 정본이다.**
 *
 * ⭐⭐ **가르는 기준이 파일이 아니라 「선언이 필요한 기능인가」다.** 화면이 그 말로 팔고
 * 있고(「참조 판정은 선언 없이도 수가 나옵니다 · 선언 자신의 기능과 선언을 기준으로 쓰는
 * 판정은 자격을 묻습니다」), 그 문장이 참이려면 **코드가 그 기준으로 갈라야 한다.**
 * ⛔ 「무료 목록」을 손으로 적지 않는다 — 적으면 등록부에 이름이 하나 더 설 때 그 목록이
 * 조용히 낡고, 새 판정기가 **아무 말 없이 무료**가 된다. `Record<VerifierId, …>` 라서
 * 이름을 더하면 **이 표를 채우지 않고는 타입이 서지 않는다.**
 *
 * ⚠️ 이 성질은 취향이 아니라 **인자로 확인된다** — 선언을 읽지 않는 판정기는 그 인자에
 * 선언이 아예 없다(`judgeRefs(snapshot, index)`). 표가 실물과 어긋나면 자격이 막아야 할
 * 축이 공짜로 돌거나 공짜여야 할 축이 막힌다.
 *
 * ⛔ 「무료 = 덜 정확하다」가 아니다 — 무료 축의 판정은 **유료와 같은 함수**가 낸다.
 * 가르는 것은 정확도가 아니라 **분모가 어디서 오는가**다.
 */
export const VERIFIER_BASIS: Record<
  VerifierId,
  { readonly needsDeclaration: boolean; readonly why: string }
> = {
  refs: {
    needsDeclaration: false,
    why: '문서가 가리키는 파일·경로·앵커가 실재하는가 — 분모가 **저장소 자신**이고 선언을 한 글자도 읽지 않는다(런너의 인자에 선언이 없다). 그래서 선언 0 인 1일차 저장소에서도 수가 난다',
  },
  'shared-values': {
    needsDeclaration: true,
    why: '축의 이름도 정본의 주소도 **선언이 짓는다** — 선언이 없으면 잴 것 자체가 없다(칸은 서되 미판정이다)',
  },
  'shared-values-cross': {
    needsDeclaration: true,
    why: '같은 선언 위에서 시야의 체크아웃들을 겹쳐 본다 — 분모가 선언이고, 시야는 그 위에 얹히는 둘째 조건이다',
  },
  'ui-paths': {
    needsDeclaration: true,
    why: '선언된 UI 표면(`ui`)이 실재하는가 — 분모가 **그 목록**이다',
  },
};

/** 선언 없이 도는 축 — 자격이 막지 않는다. ⛔ 손으로 적지 않고 위 표에서 **유도한다**. */
export const FREE_VERIFIER_IDS: readonly VerifierId[] = VERIFIER_IDS.filter(
  (id) => !VERIFIER_BASIS[id].needsDeclaration,
);

/** 선언을 분모로 쓰는 축 — 자격이 없으면 **돌지 않고** 칸만 남는다. */
export const PAID_VERIFIER_IDS: readonly VerifierId[] = VERIFIER_IDS.filter(
  (id) => VERIFIER_BASIS[id].needsDeclaration,
);

/** 축 하나의 체크 id. */
export const axisCheckId = (verifier: VerifierId, axis: string): string =>
  `${verifier}${AXIS_SEPARATOR}${axis}`;

/**
 * 이 체크가 그 판정기의 칸인가 — 맨 이름(축 미선언)과 접미된 이름(축 하나) 둘 다 받는다.
 * ⭐ **이 술어가 하나여야 한다**: 격자가 접두사 규칙을 따로 적으면 그 사본이 id 를 짓는
 * 손과 갈라지고, 갈라진 날 선언된 판정기가 **어느 칸도 모으지 못한 채** 통과가 된다.
 */
export const isCheckOf = (verifier: string, checkId: string): boolean =>
  checkId === verifier || checkId.startsWith(`${verifier}${AXIS_SEPARATOR}`);
