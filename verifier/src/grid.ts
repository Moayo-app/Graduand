/**
 * 편입 격자 — **규칙 × 표면**. 분모는 선언이다.
 *
 * 행은 선언이 말한 규칙 id(편입 기록 `admissions` + 면제 목록 `exemptions`), 열은 선언된
 * UI 표면(`ui`)이다. 칸 수는 **행 × 열**이고 그 수를 고객이 적는 자리는 없다.
 *
 * ⛔ **`coverage` 는 저작되지 않는다 — 파생이다.** 고객이 적을 수 있으면 「판정기 0 인데
 * enforced」가 설 수 있고, 그것을 막을 조항이 제품에 없다. 그래서 커버리지라는 **값**은
 * 이 제품에 존재하지 않고, 이 모듈이 세는 **수**만 있다(선언에 `coverage` 가 있으면 판정
 * 실패다 — `declaration.ts`).
 *
 * 칸의 상태는 그 줄의 상태다 — 규칙이 고른 판정기들의 판정을 **접지 않고** 합친다:
 * - 위반이 하나라도 있으면 **위반**
 * - 아니고 미판정이 하나라도 있으면 **미판정**(첫 사유) — ⛔ 부분 판정을 통과로 접지
 *   않는다: 접으면 낙관적으로 틀리고, 그 틀림이 이 제품이 파는 결함 그 자체다
 * - 전부 통과면 **통과**
 *
 * 그리고 **빈 분모는 미판정이다** — 0 칸의 격자를 「위반 0」으로 읽히게 두지 않는다:
 * - 편입·면제가 0 줄이면(키 부재 · `{}`) 행이 없다. 「편입 0」은 **정당한 상태**이고
 *   결함이 아니다 — 1일차 고객이 여기 앉는다.
 * - `ui` 가 없거나 빈 목록이면 열이 없다. 「UI 없음」은 참인 선언이지만 격자의 **열을
 *   주지 않는다** — 열 0 × 행 N = 0 칸이다.
 *
 * ⛔ 점수·등급·백분율은 여기에도 없다 — 3상태를 하나의 수로 접는 산술이 이 파일에 생기지 않는다.
 *
 * ⭐ **격자는 파생이라 판정 직렬화(`Judgment`)에 실리지 않는다.** 선언 바이트와 판정 결과를
 * 둘 다 쥔 표면이면 어디서 세어도 같은 수다 — 두 입력이 다 결정적이기 때문이다. 판정 요약
 * (fragment)만 쥔 표면은 선언이 없으므로 격자를 세지 않는다: 없는 분모를 추측해 세는 것이
 * 바로 이 모듈이 막는 것이다.
 */

import type { CheckResult, CheckStatus, ReasonCode } from './schema.ts';
import type { RepoSnapshot } from './snapshot.ts';
import { declarationOf } from './declaration.ts';

/** 격자 한 줄 = 규칙 하나. 칸은 이 줄 × 표면이고, 줄의 상태가 그 칸 전부의 상태다. */
export interface GridRule {
  rule: string;
  status: CheckStatus;
  /** `unjudged` 일 때만 non-null — 사유 없는 미판정은 이 제품이 팔지 않는 물건이다. */
  reason: ReasonCode | null;
  /** 이 규칙이 고른 등록부 이름(정렬). 빈 목록 = 「판정기 없음」(키 부재도 여기 앉는다). */
  verifiers: string[];
}

export interface AdmissionGrid {
  /** 열 — 선언된 UI 표면. */
  surfaces: string[];
  /** 행 — 규칙 id 코드유닛 순. */
  rules: GridRule[];
  /** 칸이 0 일 때의 사유. 칸이 있으면 null — 「빈 분모는 미판정이다」가 이 필드다. */
  reason: ReasonCode | null;
}

/** 3상태 칸 수와 그 분모. ⛔ 비율도 등급도 없다 — 셋의 합이 `cells` 다. */
export interface GridCounts {
  cells: number;
  violation: number;
  pass: number;
  unjudged: number;
}

/**
 * 칸을 센다 — **이 함수 하나만 센다.** 두 곳에서 각자 세면 그 순간 사본이고, 갈라진 사본이
 * 이 제품이 재는 결함이다. 보고 표면(CLI · 페이지)은 여기 수를 그대로 싣는다.
 */
export function gridCounts(grid: AdmissionGrid): GridCounts {
  const surfaces = grid.surfaces.length;
  const cellsOf = (status: CheckStatus): number =>
    grid.rules.filter((r) => r.status === status).length * surfaces;
  return {
    cells: grid.rules.length * surfaces,
    violation: cellsOf('violation'),
    pass: cellsOf('pass'),
    unjudged: cellsOf('unjudged'),
  };
}

/**
 * 체크아웃 여럿의 칸을 **함께** 센다 — 한 잡이 저장소 N개를 보면 격자도 N개이고, 그
 * 수는 하나의 분모로 합산된다. 세는 손은 여전히 `gridCounts` 하나다.
 *
 * ⛔ 합치면서 접지 않는다: 셋의 합이 `cells` 라는 성질이 N개에서도 그대로다(비율도
 * 등급도 생기지 않는다). 칸이 0 인 격자(빈 분모)는 0 을 더한다 — 그 격자의 사유는 그
 * 격자가 들고 있고, 합산이 그것을 삼키지 않는다.
 */
export function gridTotals(grids: readonly AdmissionGrid[]): GridCounts {
  const total: GridCounts = { cells: 0, violation: 0, pass: 0, unjudged: 0 };
  for (const grid of grids) {
    const counts = gridCounts(grid);
    total.cells += counts.cells;
    total.violation += counts.violation;
    total.pass += counts.pass;
    total.unjudged += counts.unjudged;
  }
  return total;
}

/** 규칙이 고른 판정기들의 판정을 합친다 — 위반 > 미판정 > 통과. */
function stateOf(
  verifiers: string[],
  byId: ReadonlyMap<string, CheckResult>,
): Pick<GridRule, 'status' | 'reason'> {
  if (verifiers.length === 0) {
    // `verifiers` 키 부재와 `[]`(「판정기 없음」 선언)이 같은 자리에 앉는다 — 실행할 수
    // 없는 규칙은 「위반 0」이 아니라 **판정 실행 불가**다.
    return { status: 'unjudged', reason: 'no-verifier' };
  }
  let unjudged: ReasonCode | null = null;
  for (const name of verifiers) {
    // 등록부의 이름은 전부 돈다(`judge.ts` 의 `RUNNERS` 가 전수를 집행하고, 등록부 밖의
    // 이름은 선언 검증이 이미 판정 실패로 막았다) — 여기서 비면 그것은 버그다.
    const check = byId.get(name)!;
    if (check.status === 'violation') return { status: 'violation', reason: null };
    // 사유 없는 미판정은 스키마가 이미 거부한다 — 첫 사유가 그 줄의 사유다.
    if (check.status === 'unjudged' && unjudged === null) unjudged = check.reason;
  }
  return unjudged === null ? { status: 'pass', reason: null } : { status: 'unjudged', reason: unjudged };
}

/**
 * 스냅샷의 선언과 그 판정 결과에서 격자를 센다. 선언을 읽는 손은 판정과 **같은 하나**다
 * (`declarationOf`).
 *
 * @throws DeclarationInvalidError 선언이 깨졌을 때 — 격자도 수를 내지 않는다.
 */
export function admissionGrid(snapshot: RepoSnapshot, checks: readonly CheckResult[]): AdmissionGrid {
  const declaration = declarationOf(snapshot);
  if (declaration === 'unreadable') {
    // 추적되는데 못 읽었다 — 부재가 아니라 잘림이고, 잘림 위에서는 수를 내지 않는다.
    return { surfaces: [], rules: [], reason: 'collection-truncated' };
  }
  const read = declaration.state === 'valid' ? declaration : null;
  const surfaces = read?.ui ?? [];

  const byId = new Map(checks.map((c) => [c.id, c]));
  const rules: GridRule[] = [];
  for (const [rule, admission] of Object.entries(read?.admissions ?? {})) {
    const verifiers = [...(admission.verifiers ?? [])].sort();
    rules.push({ rule, ...stateOf(verifiers, byId), verifiers });
  }
  for (const rule of Object.keys(read?.exemptions ?? {})) {
    // 면제는 칸을 「밖」에 두고 **분모는 줄지 않는다** — 칸은 남고 사유가 붙는다.
    // ⚠️ 격자는 **날짜를 모른다** — 만기는 봉투가 본다(`expiry.ts`). 여기서 만기를 보면
    // 격자가 날마다 다른 수를 내고, 격자는 선언과 판정만으로 결정적이어야 한다.
    rules.push({ rule, status: 'unjudged', reason: 'declared-exemption', verifiers: [] });
  }
  rules.sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));

  // 행이든 열이든 0 이면 칸이 0 이다 — 사유를 달아 미판정으로 남긴다.
  const empty = rules.length === 0 || surfaces.length === 0;
  return { surfaces: [...surfaces], rules, reason: empty ? 'no-declaration' : null };
}
