/**
 * 증거 상한 — 보고가 URL fragment 에 실려야 하므로 증거 목록에는 상한이 있다.
 *
 * **수(counts)는 항상 전수다** — 잘리는 것은 증거 목록뿐이고, 잘린 건수는
 * `counts.evidenceOmitted` 가 센다. 조용히 자르지 않는다.
 */

import type { Evidence } from '../schema.ts';

export const EVIDENCE_CAP = 200;

export function capEvidence(all: Evidence[]): { evidence: Evidence[]; omitted: number } {
  if (all.length <= EVIDENCE_CAP) return { evidence: all, omitted: 0 };
  return { evidence: all.slice(0, EVIDENCE_CAP), omitted: all.length - EVIDENCE_CAP };
}
