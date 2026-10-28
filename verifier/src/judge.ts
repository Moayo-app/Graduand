/**
 * 판정 오케스트레이션 — 스냅샷 하나와 그 **시야**를 받아 **등록부에 선 판정기 전부**를 돌린다.
 *
 * ⭐⭐ 시야와 **자격**이 같은 자리(`JudgeContext`)에 같은 성질로 들어온다 — 둘 다 호스트가
 * 읽어(물어) 싣는 입력이고, 판정은 받는다. 자격이 없으면 **선언을 분모로 쓰는 축만** 돌지
 * 않고 그 칸이 「미판정 + 사유」로 남는다(`ungraded`) — 자격은 위반이 아니고, 분모는 그대로
 * 보인다. ⚠️ **전부가 아니다**: 선언 없이 도는 축은 그대로 수를 낸다(아래 `judgeSnapshot`).
 *
 * 순수 함수다: I/O 도 네트워크도 없다. 고객 CI 와 브라우저가 **이 함수 하나**를 쓰므로
 * 같은 커밋에 대한 두 표면의 판정은 canonical 직렬화까지 바이트 동일하다 — ⚠️ 같은 시야
 * 에서다(`JudgeContext`). 시야가 넓어지면(체크아웃이 여럿이면) 저장소 하나만 보는 표면이
 * 원리상 못 보던 축이 서므로 수가 **달라진다**: 같은 입력에 같은 바이트이고, 시야는 입력이다.
 *
 * ⭐ **판정 집합의 정본은 등록부다**(`verifiers/registry.ts`). 여기 있던 하드코딩된 배열
 * (`[judgeRefs(…), judgeUiPaths(…), …judgeSharedValues(…)]`)은 등록부와 **조용히 갈라질 수
 * 있었다** — 고객이 고를 수 있는 이름과 실제로 도는 판정기가 다른 목록에 적히면, 선언된
 * 이름이 어느 칸도 내지 않는 채 초록이 된다. 아래 `RUNNERS` 는 `Record<VerifierId, …>` 라서
 * 등록부에 이름을 더하면 **런너 없이는 타입이 서지 않는다.**
 *
 * ⚠️ **고객의 편입 기록은 「무엇이 도는가」를 고르지 않는다** — 등록부의 판정기는 전부 돈다
 * (`refs` 처럼 선언 0 으로 도는 무료 축이 있다). 편입이 고르는 것은 **격자의 관할**이고,
 * 그 셈은 `grid.ts` 가 이 결과 위에서 한다.
 */

import { SCHEMA_VERSION, type CheckResult, type Judgment, type ReasonCode } from './schema.ts';
import { indexPaths, type PathIndex, type RepoSnapshot } from './snapshot.ts';
import { declarationOf, type ResolvedDeclaration } from './declaration.ts';
import {
  FREE_VERIFIER_IDS,
  isCheckOf,
  PAID_VERIFIER_IDS,
  VERIFIER_IDS,
  type VerifierId,
} from './verifiers/registry.ts';
import { entitlementGate, type Entitlement, type EntitlementDetail } from './entitlement.ts';
import { judgeRefs } from './verifiers/refs.ts';
import { judgeUiPaths } from './verifiers/ui-paths.ts';
import { judgeSharedValues } from './verifiers/shared-values.ts';

/**
 * 판정이 보는 **시야** — 이 스냅샷 하나가 아니라, 같은 잡이 함께 체크아웃한 것들.
 *
 * ⭐ 교차 축(「박제 == 정본」)이 사는 자리다: 그 축은 저장소 **전부가 보이는 표면**만 질 수
 * 있고, 「전부가 보인다」는 것은 한 잡에 체크아웃이 여럿이라는 뜻이다(`loadWorkspaces`).
 * 시야가 비면 축은 미판정으로 남는다 — 비는 것이 「위반 0」이 아니다.
 *
 * ⛔ 판정은 여전히 순수하다 — 체크아웃을 **읽는 것은 호스트**이고 판정은 받는다. 이 필드가
 * 스냅샷 목록인 것(경로·토큰 목록이 아닌 것)이 그 경계의 집행이다.
 */
export interface JudgeContext {
  /** 같은 잡이 함께 본 **다른** 체크아웃. 자기 자신은 들어오지 않는다. */
  peers?: readonly RepoSnapshot[];
  /**
   * 호출자가 **검증해 넣은** 자격(`hosts/entitlement.ts`). ⭐ `peers` 와 **같은 성질**이다
   * — 읽는(묻는) 것은 호스트이고 판정은 받는다. ⛔ 판정이 자격을 물을 수는 없다: 이 함수
   * 에 네트워크가 없다.
   *
   * ⚠️ **생략은 「이 표면은 자격을 보지 않았다」다** — 「자격 있다」가 아니다. 보는 표면은
   * 반드시 싣고(측정 명령), 싣지 않은 표면의 수는 자격을 묻지 않은 수다. 기본값으로
   * 「있다」를 두지 않는 이유가 그것이다 — 두면 거짓 선언이 공짜로 선다.
   */
  entitlement?: Entitlement;
}

interface JudgeInput {
  snapshot: RepoSnapshot;
  index: PathIndex;
  declaration: ResolvedDeclaration;
  peers: readonly RepoSnapshot[];
}

/**
 * 판정기 하나가 내는 체크 — 축이 갈린 판정기는 **칸이 둘이라 이름도 둘**이고(등록부 규율 2),
 * 한 번 돌아 둘을 함께 낸다. 그래서 런너의 반환은 목록이다.
 */
type Runner = (input: JudgeInput) => CheckResult[];

/** 등록부 조회 — 이름마다 런너 하나. 전수는 `Record` 가 집행한다(빠지면 타입이 선다). */
const RUNNERS: Record<VerifierId, Runner> = {
  refs: ({ snapshot, index }) => [judgeRefs(snapshot, index)],
  'shared-values': (input) => judgeSharedValues(input),
  'shared-values-cross': (input) => judgeSharedValues(input),
  'ui-paths': ({ index, declaration }) => [judgeUiPaths(index, declaration)],
};

/**
 * 칸의 정렬 — ⭐ **세는 손이 하나다.** 자격이 축을 가르면서 결과가 두 갈래(돈 축 · 안 돈 축)
 * 에서 오는데, 갈래마다 각자 정렬하면 합친 목록의 순서가 **갈래의 수에 따라** 달라진다.
 * 그러면 같은 커밋·같은 자격에서 직렬화 바이트가 흔들리고, 두 표면의 바이트 동일성이 깨진다.
 */
const byCheckId = (a: CheckResult, b: CheckResult): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * 등록부를 돌려 체크를 낸다. 이름 하나가 여러 칸을 내면 그 칸들이 한 번에 들어오고,
 * 이미 든 이름은 다시 돌리지 않는다 — 판정은 순수하므로 두 번 돌려도 같은 수이되, 같은
 * 수를 두 번 내는 것은 낭비다. 결과는 `id` 코드유닛 순으로 정렬된다.
 *
 * ⭐ **부분 집합을 받는다** — 자격이 없을 때 도는 것은 선언 없이 서는 축뿐이다. ⛔ 전부
 * 돌려 놓고 표시만 가리는 길은 이 모듈이 기각한 모양이다(「계산하고 표시만 가린다」는
 * 「막는 척」이다): **돌지 않는 것**이 집행이라, 막힌 축은 이 함수에 들어오지도 않는다.
 */
function runRegistry(input: JudgeInput, ids: readonly VerifierId[] = VERIFIER_IDS): CheckResult[] {
  const byId = new Map<string, CheckResult>();
  for (const id of ids) {
    // ⭐ 「이미 돌았는가」를 **칸의 이름으로** 묻는다 — 개정 4 에서 칸의 id 가 등록부 이름과
    //   같지 않게 됐다(`shared-values:<축>`). `byId.has(id)` 로 물으면 축이 선언된 저장소에서
    //   그 질문이 영원히 거짓이고, 판정기가 축 수와 무관하게 **두 번** 돈다(순수 함수라 수는
    //   같지만, 같은 수를 두 번 내는 것은 낭비다). 가르는 술어는 등록부가 쥔다.
    if ([...byId.keys()].some((checkId) => isCheckOf(id, checkId))) continue;
    for (const check of RUNNERS[id](input)) byId.set(check.id, check);
  }
  return [...byId.values()].sort(byCheckId);
}

/**
 * @param context 같은 잡이 함께 본 체크아웃들. 생략하면 **한 저장소 표면**이고, 저장소
 *                전부가 보여야 서는 축은 미판정으로 남는다(그 칸이 비는 것이 아니다).
 * @throws DeclarationInvalidError 선언이 깨졌을 때 — `declarationOf` 와 같은 자리다.
 *         시야에 든 체크아웃의 선언이 깨진 것도 같다: 정본으로 지목된 저장소의 선언을
 *         읽지 못하면 그 축은 수를 내지 않는다.
 */
export function judgeSnapshot(snapshot: RepoSnapshot, context: JudgeContext = {}): Judgment {
  const index = indexPaths(snapshot.paths);
  // ⭐ 선언을 **먼저** 읽는다 — 자격보다 앞이다. 깨진 선언은 여전히 판정 실패이고(요란하게
  // 멈춘다), 자격이 없다고 그 사실이 조용해지지 않는다. 그리고 이 호출이 분모를 세우므로
  // 「분모는 자격 없이 보인다」가 이 순서에 걸려 있다 — 격자는 같은 선언을 읽는다.
  const declaration = declarationOf(snapshot, index);
  const input: JudgeInput = { snapshot, index, declaration, peers: context.peers ?? [] };

  // ⭐⭐ **자격은 전부를 막지 않는다 — 축마다 가른다.** 가르는 기준은 파일도 판정기의
  //    난이도도 아니고 **「선언이 필요한 기능인가」**이고, 그 분류의 정본은 등록부다
  //    (`VERIFIER_BASIS`). 화면이 그 말로 팔고 있으므로 여기서 다른 기준을 쓰면 **선언과
  //    실물이 갈라진다** — 이 제품이 파는 바로 그 결함이다.
  // ⛔ 전부 돌려 놓고 막힌 축의 수만 지우지 않는다: 막힌 축은 `runRegistry` 에 들어오지도
  //    않는다(「계산하고 표시만 가린다」는 「막는 척」이다).
  // ⛔ 반대로 막힌 축의 **칸을 없애지도** 않는다 — 칸의 구성은 선언에서 오고 선언은 고객
  //    것이다. 자격이 거는 것은 **수를 내는 것**뿐이라, 칸은 「미판정 + 사유」로 남는다.
  const gate = entitlementGate(context.entitlement);
  const checks =
    gate === null
      ? runRegistry(input)
      : [
          ...runRegistry(input, FREE_VERIFIER_IDS),
          ...ungraded(gate.reason, gate.detail, PAID_VERIFIER_IDS),
        ].sort(byCheckId);

  return { v: SCHEMA_VERSION, repo: snapshot.repo, commit: snapshot.commit, checks };
}

/**
 * 자격이 막은 축의 체크 — **이름마다 한 칸**이고 전부 미판정이다.
 *
 * ⭐ **수가 없고 칸은 있다**: `counts` 가 비는 것이 「수를 내지 않았다」의 집행이고,
 * 칸의 분모는 선언에서 오므로(`grid.ts`) 자격 없이도 그대로 보인다. ⛔ 「계산하고 표시만
 * 가린다」가 아니다 — 판정기는 **돌지 않는다**(위 분기가 `runRegistry` 를 부르지 않는다).
 * ⛔ 「분모도 감춘다」도 아니다 — 격자는 이 결과 위에서 선언의 칸을 그대로 센다.
 *
 * ⚠️ **분모가 등록부 전수에서 부분 집합으로 좁아졌다** — 전에는 이 함수가 칸 **전부**를
 * 냈고, 그것이 무료 축까지 함께 끄던 그 한 줄이다. 받는 쪽이 목록을 **인자로** 넘기므로
 * 이 함수는 무엇이 무료인지 모른다: 그 분류를 아는 자리는 등록부 하나다.
 */
function ungraded(
  reason: ReasonCode,
  detail: EntitlementDetail,
  ids: readonly VerifierId[] = VERIFIER_IDS,
): CheckResult[] {
  return [...ids]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => ({ id, status: 'unjudged' as const, reason, counts: {}, evidence: [{ entitlement: detail }] }));
}
