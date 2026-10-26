/**
 * 판정 오케스트레이션 — 스냅샷 하나와 그 **시야**를 받아 **등록부에 선 판정기 전부**를 돌린다.
 *
 * ⭐⭐ 시야와 **자격**이 같은 자리(`JudgeContext`)에 같은 성질로 들어온다 — 둘 다 호스트가
 * 읽어(물어) 싣는 입력이고, 판정은 받는다. 자격이 없으면 등록부는 **돌지 않고** 칸 전부가
 * 「미판정 + 사유」로 남는다(`ungraded`) — 자격은 위반이 아니고, 분모는 그대로 보인다.
 *
 * 순수 함수다: I/O 도 네트워크도 없다. 고객 CI 와 브라우저가 **이 함수 하나**를 쓰므로
 * 같은 커밋에 대한 두 표면의 판정은 canonical 직렬화까지 바이트 동일하다 — ⚠️ 같은 시야
 * 에서다(`JudgeContext`). 시야가 넓어지면(체크아웃이 여럿이면) 저장소 하나만 보는 표면이
 * 원리상 못 보던 축이 서므로 수가 **달라진다**: 같은 입력에 같은 바이트이고, 시야는 입력이다.
 *
 * ⭐ **판정 집합의 정본은 등록부다**(`verifiers/registry.ts`). 여기 있던 하드코딩된 배열
 * (`[judgeRefs(…), judgeUiPaths(…), …judgePalette(…)]`)은 등록부와 **조용히 갈라질 수
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
import { VERIFIER_IDS, type VerifierId } from './verifiers/registry.ts';
import { entitlementGate, type Entitlement, type EntitlementDetail } from './entitlement.ts';
import { judgeRefs } from './verifiers/refs.ts';
import { judgeUiPaths } from './verifiers/ui-paths.ts';
import { judgePalette } from './verifiers/palette.ts';

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
  palette: (input) => judgePalette(input),
  'palette-cross': (input) => judgePalette(input),
  refs: ({ snapshot, index }) => [judgeRefs(snapshot, index)],
  'ui-paths': ({ index, declaration }) => [judgeUiPaths(index, declaration)],
};

/**
 * 등록부를 돌려 체크 전부를 낸다. 이름 하나가 여러 칸을 내면 그 칸들이 한 번에 들어오고,
 * 이미 든 이름은 다시 돌리지 않는다 — 판정은 순수하므로 두 번 돌려도 같은 수이되, 같은
 * 수를 두 번 내는 것은 낭비다. 결과는 `id` 코드유닛 순으로 정렬된다.
 */
function runRegistry(input: JudgeInput): CheckResult[] {
  const byId = new Map<string, CheckResult>();
  for (const id of VERIFIER_IDS) {
    if (byId.has(id)) continue;
    for (const check of RUNNERS[id](input)) byId.set(check.id, check);
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
  const gate = entitlementGate(context.entitlement);
  const checks =
    gate === null
      ? runRegistry({ snapshot, index, declaration, peers: context.peers ?? [] })
      : ungraded(gate.reason, gate.detail);

  return { v: SCHEMA_VERSION, repo: snapshot.repo, commit: snapshot.commit, checks };
}

/**
 * 자격이 없을 때의 체크 전부 — **등록부의 이름마다 한 칸**이고 전부 미판정이다.
 *
 * ⭐ **수가 없고 칸은 있다**: `counts` 가 비는 것이 「수를 내지 않았다」의 집행이고,
 * 칸의 분모는 선언에서 오므로(`grid.ts`) 자격 없이도 그대로 보인다. ⛔ 「계산하고 표시만
 * 가린다」가 아니다 — 판정기는 **돌지 않는다**(위 분기가 `runRegistry` 를 부르지 않는다).
 * ⛔ 「분모도 감춘다」도 아니다 — 격자는 이 결과 위에서 선언의 칸을 그대로 센다.
 *
 * 이름을 베껴 적지 않고 등록부를 **읽는다** — 사본은 등록부와 갈라지고, 갈라지면 어느
 * 칸이 자격에 막혔는지 말할 수 없다. 정렬은 `runRegistry` 와 같은 `id` 코드유닛 순이다.
 */
function ungraded(reason: ReasonCode, detail: EntitlementDetail): CheckResult[] {
  return [...VERIFIER_IDS]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => ({ id, status: 'unjudged' as const, reason, counts: {}, evidence: [{ entitlement: detail }] }));
}
