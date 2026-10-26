/**
 * 판정 스키마 v2 — 이 모듈이 내는 **유일한** 판정 결과 형식.
 *
 * 규율:
 * - 모든 보고 표면(CI 로그 · 브라우저 보고서 · URL fragment)은 이 스키마만 렌더한다.
 * - 수는 3상태로만 말한다: `pass` · `violation` · `unjudged`. **점수·등급·백분율 API 는
 *   존재하지 않고, 이 모듈에 생기지 않는다.** 「미판정 N건」을 0% 나 N/A 로 접으면
 *   읽기 실패가 「문제 없음」으로 둔갑한다 — 그 구분이 이 스키마의 존재 이유다.
 * - `unjudged` 에는 **사유 코드가 반드시 붙는다.** 사유 없는 미판정은 받지 않는다.
 * - `Judgment` 는 결정적이다: 같은 커밋을 어느 표면에서 판정해도 canonical 직렬화가
 *   바이트 동일하다. 측정 시각·입력 출처처럼 표면마다 다른 것은 `Measurement` 봉투에 산다.
 * - 모르는 `v` 는 조용히 해석하지 않는다 — 버전 불일치 오류를 던진다.
 */

import { canonicalJson } from './canonical.ts';

/**
 * 개정 2 — 2일차 헌법층의 결의 넷이 **한 개정**을 같이 썼다: 사유 코드 다섯(자격 둘 ·
 * 판정기 없음 · 선언된 갈라짐 · 선언된 면제) + 선언 파일의 편입 기록·면제 목록 ·
 * `palette.diverged` · `canon` 동반 검증. 버전 축은 하나이므로 한 번만 올린다.
 */
export const SCHEMA_VERSION = 2;

export const CHECK_STATUSES = ['pass', 'violation', 'unjudged'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/**
 * 미판정 사유 코드 (닫힌 목록 — 늘리려면 스키마 개정이다):
 * - `no-declaration`: 판정의 분모가 선언되지 않았다. 선언 부재는 위반도 통과도 아니다.
 * - `collection-truncated`: 입력을 전부 읽지 못했다. 부분 수집 위에 얹은 수는 언제나
 *   낙관적이므로, 이 사유가 붙은 체크는 위반 수를 내지 않는다.
 * - `no-adapter`: 기준(박제)은 선언됐지만 코드를 읽을 어댑터가 선언되지 않았다 —
 *   비교의 왼변이 없다. 폴백 선언의 분모는 수로 남고, 비교는 어댑터가 서는 날 선다.
 * - `single-repo-surface`: 이 표면은 저장소 하나만 본다. 교차 축(박제 == 정본)은
 *   저장소 전부가 보이는 표면의 몫이고, 시야 밖은 「위반 0」이 아니라 판정 불가다.
 *   체크아웃이 여럿이어도 **정본이 그중에 없으면** 같은 자리다 — 시야에 없는 것을
 *   추측으로 채우지 않는다.
 *   같은 사유가 **한 저장소에서 확인할 수 없는 규칙 id** 도 받는다 — 잘못 선언한 것은
 *   판정 실패이되 **그 판정이 이 표면에서 가능할 때**다.
 * - `no-verifier`: 규칙은 편입됐지만 그 칸을 볼 판정기가 선언되지 않았다(`verifiers` 키
 *   부재 · `verifiers: []` = 「판정기 없음」 선언). 실행할 수 없는 규칙은 「위반 0」이
 *   아니라 **판정 실행 불가**다. ⚠️ 등록부에 **없는 이름**은 이 사유가 아니라 판정
 *   실패다 — 선언하지 않은 것은 미판정, 잘못 선언한 것은 판정 실패.
 * - `declared-divergence`: 고객이 사유를 달아 「이 값의 정본은 여기다」를 선언했다.
 *   교차 축(박제 == 정본)에서만 빠지고 **CI 축은 자기 박제로 계속 판정한다** — 판정이
 *   사라지지 않고 기준이 옮겨간다. 그래서 통과(✅)가 아니라 「밖 — 미판정」이다.
 * - `declared-exemption`: 고객이 사유와 **만기**를 달아 이 규칙을 적용하지 않기로
 *   선언했다. 분모는 줄지 않는다 — 칸은 남고 사유가 붙는다. 「만기가 지났는가」는
 *   `Judgment` 가 아니라 `Measurement` 봉투의 몫이다: 같은 커밋이 날짜마다 다른 수를
 *   내면 두 표면의 바이트 동일성이 깨진다. 넘긴 만기가 바꾸는 것은 **종료 코드**이고
 *   (`expiry.ts` — 빨강의 근거가 「위반 또는 넘긴 만기」로 하나 늘었다) 이 칸의 상태는
 *   그대로 미판정이다 — 3상태는 만기로 늘어나지 않는다.
 * - `no-entitlement`: 자격이 없다 — 벤더가 **답했고** 그 답이 「없다」였다. 분모(격자의
 *   칸)는 그대로 보이고 **수만 나오지 않는다**: 「없는 기능」과 「자격 없는 기능」이 같아
 *   보이면 부재를 공백으로 접는 것이다.
 * - `entitlement-unverifiable`: 자격을 **확인하지 못했다** — 답을 받지 못했다. 「없음」과
 *   뭉치지 않는다: 요구하는 행동이 「사라」와 「네트워크를 열어라」로 다르고, 뭉치면 돈을
 *   낸 고객이 막힌 CI 에서 「자격 없음」을 받는다.
 */
export const REASON_CODES = [
  'no-declaration',
  'collection-truncated',
  'no-adapter',
  'single-repo-surface',
  'no-verifier',
  'declared-divergence',
  'declared-exemption',
  'no-entitlement',
  'entitlement-unverifiable',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

/** 증거 한 건 — 평평한 원시값만. 렌더러가 해석 없이 그대로 그릴 수 있어야 한다. */
export type Evidence = Record<string, string | number>;

export interface CheckResult {
  id: string;
  status: CheckStatus;
  /** `unjudged` 일 때만 non-null. */
  reason: ReasonCode | null;
  /** 3상태 수와 그 분모들. 점수·백분율은 여기에도 없다. */
  counts: Record<string, number>;
  /** 상한이 있다 — 넘친 수는 `counts.evidenceOmitted` 가 센다. 수(counts)는 항상 전수다. */
  evidence: Evidence[];
}

export interface Judgment {
  v: typeof SCHEMA_VERSION;
  /** `owner/name`. 대상에서 읽지 못했으면 null — 추정으로 채우지 않는다. */
  repo: string | null;
  /** 판정 대상 커밋의 전체 SHA. */
  commit: string;
  /** `id` 코드유닛 순으로 정렬된다. */
  checks: CheckResult[];
}

export const MEASUREMENT_SOURCES = ['workspace', 'github-api'] as const;
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];

/**
 * 측정 봉투 — 판정이 아니라 **측정의 속성**. 보고서 머리가 요구하는 것들
 * (입력 출처 · 측정 시각 · 판정기 버전)이 여기 살고, 바이트 동일성 비교는
 * `Judgment` 에만 건다.
 */
export interface Measurement {
  judgment: Judgment;
  source: MeasurementSource;
  /** ISO 8601 UTC. */
  measuredAt: string;
  verifier: { name: string; version: string };
  /**
   * workspace 측정의 정직성: 미커밋 변경 파일 수. 0 이 아니면 이 수는 `commit` 에
   * 정확히 대응하지 않는다. 알 수 없으면 null — 0 으로 바꾸지 않는다. github-api 는
   * 커밋을 직접 읽으므로 항상 0 이다.
   */
  dirty: number | null;
}

export class SchemaParseError extends Error {}

export class VersionMismatchError extends SchemaParseError {
  readonly axis: 'schema' | 'fragment';
  readonly found: string;
  constructor(axis: 'schema' | 'fragment', found: string) {
    super(`unknown ${axis} version: ${found}`);
    this.axis = axis;
    this.found = found;
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function assertCheck(raw: unknown, at: string): CheckResult {
  if (!isPlainObject(raw)) throw new SchemaParseError(`${at}: not an object`);
  const { id, status, reason, counts, evidence } = raw;
  if (typeof id !== 'string' || id === '') throw new SchemaParseError(`${at}.id`);
  if (typeof status !== 'string' || !(CHECK_STATUSES as readonly string[]).includes(status)) {
    throw new SchemaParseError(`${at}.status: ${String(status)}`);
  }
  if (status === 'unjudged') {
    if (typeof reason !== 'string' || !(REASON_CODES as readonly string[]).includes(reason)) {
      throw new SchemaParseError(`${at}.reason: unjudged requires a reason code`);
    }
  } else if (reason !== null) {
    throw new SchemaParseError(`${at}.reason: must be null unless unjudged`);
  }
  if (!isPlainObject(counts)) throw new SchemaParseError(`${at}.counts`);
  for (const [k, v] of Object.entries(counts)) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw new SchemaParseError(`${at}.counts.${k}`);
    }
  }
  if (!Array.isArray(evidence)) throw new SchemaParseError(`${at}.evidence`);
  evidence.forEach((e, i) => {
    if (!isPlainObject(e)) throw new SchemaParseError(`${at}.evidence[${i}]`);
    for (const [k, v] of Object.entries(e)) {
      if (typeof v !== 'string' && typeof v !== 'number') {
        throw new SchemaParseError(`${at}.evidence[${i}].${k}`);
      }
    }
  });
  return raw as unknown as CheckResult;
}

export function assertJudgment(raw: unknown): Judgment {
  if (!isPlainObject(raw)) throw new SchemaParseError('judgment: not an object');
  // 버전을 가장 먼저 본다 — 모르는 v 의 본문을 구조로 판정하는 것 자체가 월권이다.
  if (typeof raw.v !== 'number' || raw.v !== SCHEMA_VERSION) {
    throw new VersionMismatchError('schema', String(raw.v));
  }
  if (raw.repo !== null && typeof raw.repo !== 'string') throw new SchemaParseError('judgment.repo');
  if (typeof raw.commit !== 'string' || raw.commit === '') throw new SchemaParseError('judgment.commit');
  if (!Array.isArray(raw.checks)) throw new SchemaParseError('judgment.checks');
  raw.checks.forEach((c, i) => assertCheck(c, `checks[${i}]`));
  return raw as unknown as Judgment;
}

export function assertMeasurement(raw: unknown): Measurement {
  if (!isPlainObject(raw)) throw new SchemaParseError('measurement: not an object');
  assertJudgment(raw.judgment);
  if (typeof raw.source !== 'string' || !(MEASUREMENT_SOURCES as readonly string[]).includes(raw.source)) {
    throw new SchemaParseError('measurement.source');
  }
  if (typeof raw.measuredAt !== 'string') throw new SchemaParseError('measurement.measuredAt');
  if (!isPlainObject(raw.verifier) || typeof raw.verifier.name !== 'string' || typeof raw.verifier.version !== 'string') {
    throw new SchemaParseError('measurement.verifier');
  }
  if (raw.dirty !== null && (typeof raw.dirty !== 'number' || !Number.isInteger(raw.dirty) || raw.dirty < 0)) {
    throw new SchemaParseError('measurement.dirty');
  }
  return raw as unknown as Measurement;
}

export const serializeJudgment = (judgment: Judgment): string => canonicalJson(assertJudgment(judgment));

export function parseJudgment(text: string): Judgment {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new SchemaParseError(`judgment: invalid JSON — ${(e as Error).message}`);
  }
  return assertJudgment(raw);
}

export const serializeMeasurement = (m: Measurement): string => canonicalJson(assertMeasurement(m));

export function parseMeasurement(text: string): Measurement {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new SchemaParseError(`measurement: invalid JSON — ${(e as Error).message}`);
  }
  return assertMeasurement(raw);
}
