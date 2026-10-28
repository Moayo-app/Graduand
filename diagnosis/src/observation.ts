/**
 * 관측 결과의 뷰모델 — **보고서 + 격자**다. ⭐ 그 자리는 **루트의 진단**이다(결정
 * 2026-10-27): 판정을 보여 주는 표면이 둘이면 같은 모듈이 두 화면을 내고, 그 둘은 갈라진다.
 * ⇒ 저장소를 읽은 진단이 **격자까지** 말하고, 둘째 문서는 헌법을 쥐는 일만 한다.
 *
 * ⭐⭐ **보고서를 다시 짓지 않는다** — 체크마다의 3상태 · 수 · 증거는 `report.ts` 가 이미
 * 그리고, 이 층이 더하는 것은 **격자**(규칙 × 표면)와 **정본을 함께 읽었는가** 한 줄이다.
 * 여기서 체크를 다시 그리면 같은 판정에 두 벌의 그림이 생기고, 그 둘은 갈라진다.
 *
 * ⛔ **셋을 하나로 접는 수가 없다** — 격자는 「관할 N — 위반 k · 통과 p · 미판정 m」으로만
 * 말하고, 그 산술이 이 파일에 없으며 생길 자리도 없다(수는 `gridCounts` 가 낸다 — 세는 손은
 * 판정기 모듈의 그 하나다). ⚠️ **접는 어휘 셋을 이 패키지는 주석에도 적지 않는다**: 분모가
 * 화면 코드 전부라, 자구가 코드에 들어오는 순간 가드가 빨갛다(그 금칙이 그만큼 넓다).
 *
 * ⛔ **빈 분모를 숨기지 않는다** — 칸이 0 인 격자는 수를 내지 않고 **사유를 적는다**:
 * 「편입 0」은 결함이 아니라 1일차 고객이 앉는 정당한 상태다.
 */

import { gridCounts, type AdmissionGrid, type CheckStatus, type GridRule } from '../../verifier/src/index.ts';
import { buildReport, type ReportVM } from './report.ts';
import type { Outcome } from './outcome.ts';
import type { Strings } from './strings.ts';

/** 격자 한 줄 — 규칙 하나. 칸은 이 줄 × 표면이고, 줄의 상태가 그 칸 전부의 상태다. */
export interface GridRowVM {
  rule: string;
  status: CheckStatus;
  statusLabel: string;
  /** `unjudged` 일 때만 non-null — 사유 없는 미판정은 이 제품이 팔지 않는 물건이다. */
  reasonLine: string | null;
  /** 그 규칙이 고른 판정기들, 또는 「고르지 않았다」. */
  choseLine: string;
}

export interface ObservationVM {
  /** 함께 읽은 정본, 또는 「선언이 가리키지 않았다」 — ⭐ 교차 축이 설 수 있었는지의 사실. */
  canonLine: string;
  /** 「관할 N — 위반 k · 통과 p · 미판정 m」. 칸이 0 이면 null 이다(수를 내지 않는다). */
  jurisdictionLine: string | null;
  /** 규칙 × 표면 — 분모의 꼴. 칸이 0 이어도 선다(분모가 왜 0 인지가 그 꼴에 있다). */
  shapeLine: string;
  /** 칸이 0 일 때의 사유 한 줄. 칸이 있으면 null. */
  emptyLine: string | null;
  rows: GridRowVM[];
  /** 체크마다의 3상태 · 수 · 증거 — 보고서 뷰모델이 그대로 든다. */
  report: ReportVM;
}

const rowOf = (rule: GridRule, strings: Strings): GridRowVM => ({
  rule: rule.rule,
  status: rule.status,
  statusLabel: strings.status[rule.status],
  // 사유 코드마다의 문장은 **보고서와 같은 표**를 쓴다 — 같은 미판정을 두 문장으로 부르지 않는다.
  reasonLine: rule.reason === null ? null : strings.reason[rule.reason],
  choseLine:
    rule.verifiers.length > 0
      ? strings.constitution.result.chose(rule.verifiers.join(' · '))
      : strings.constitution.result.choseNone,
});

/**
 * @param grid 저장소를 읽은 표면만 쥔다 — 요약(fragment)으로 들어온 보고는 선언이 없어
 *             격자를 세지 않는다(없는 분모를 추측해 세지 않는 그 규율이다).
 */
export function buildObservation(
  outcome: Extract<Outcome, { kind: 'report' }>,
  strings: Strings,
): ObservationVM {
  const { result } = strings.constitution;
  // ⭐⭐ **격자를 여기서 세지 않는다 — 봉투가 들고 온다.** 저장소를 읽은 쪽이 한 번 세고,
  //   요약으로 받은 쪽은 받아 그린다: 세는 손이 하나로 남고, 요약만 쥔 표면도 같은 수를
  //   그린다(그 한 줄이 비공개 고객에게만 빠지던 자리다).
  const grid: AdmissionGrid = outcome.measurement.grid;
  const counts = gridCounts(grid);
  return {
    canonLine:
      outcome.measurement.peers.length === 0
        ? result.canonAbsent
        : result.canonRead(outcome.measurement.peers.join(' · ')),
    // ⭐ 칸이 0 이면 **수를 내지 않는다** — 「관할 0 — 위반 0」은 읽는 사람에게 「문제 없음」
    //   이고, 그것이 이 제품이 막는 그 둔갑이다.
    jurisdictionLine: grid.reason === null ? result.jurisdiction(counts) : null,
    shapeLine: result.shape(grid.rules.length, grid.surfaces.length),
    emptyLine: grid.reason === null ? null : result.emptyDenominator,
    rows: grid.rules.map((rule) => rowOf(rule, strings)),
    // ⭐ 보고서는 **같은 손**이 그린다 — 자격도 그 보고가 본 것을 그대로 싣는다.
    report: buildReport(outcome.measurement, outcome.origin, strings, outcome.entitlement),
  };
}
