/**
 * 판정 스키마 — 이 모듈이 내는 **유일한** 판정 결과 형식.
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
// ⚠️ **타입만** 가져온다(지워진다) — 격자를 **세는** 손은 `grid.ts` 하나이고, 이 모듈이
//    아는 것은 봉투에 실린 **모양**뿐이다. 값으로 가져오면 그 순간 순환이다.
import type { AdmissionGrid } from './grid.ts';
// ⚠️ 같은 이유로 **타입만** 가져온다 — 선언 0 의 사실을 **읽는** 손은 `undeclared.ts` 하나다.
import type { UndeclaredFacts } from './undeclared.ts';

/**
 * 개정 3 — **격자가 봉투에 타고, 시야가 봉투에 적힌다.**
 *
 * ⭐⭐ **왜 올렸는가.** 격자는 파생이라 봉투에 실리지 않았고, 그래서 요약(fragment)으로
 * 들어온 보고는 「관할 N — 위반 k · 통과 p · 미판정 m」을 **그리지 못했다.** 그 한 줄을 못
 * 받는 쪽이 하필 **비공개 저장소 고객**이다(그쪽의 유일한 길이 `--open` 이다) — 공개
 * 저장소를 주소로 넣은 방문자는 받고 **돈 내는 쪽이 더 가난한 화면**을 받았다.
 *
 * ⭕ **바이트 동일성 약속은 무사하다** — 그 약속은 `Judgment` 에만 걸려 있고, 봉투는 이미
 * 표면마다 다른 사실(측정 시각 · 입력 출처 · 미커밋 수)을 든다. 격자와 시야는 그 성질이
 * 같다: **측정의 속성**이지 판정이 아니다.
 *
 * ⛔ **요약에 선언을 싣는 길은 기각됐다** — 받는 쪽이 다시 세게 하려면 고객의 선언 바이트를
 * 주소에 실어야 하고, 그것은 고객 파일을 주소로 내보내는 일이다.
 *
 * ⚠️ 개정 2 의 요약은 이 판에서 **조용히 해석되지 않는다** — 모르는 `v` 는 던진다.
 *
 * 개정 2 는 2일차 헌법층의 결의 넷이 **한 개정**을 같이 썼다: 사유 코드 다섯 + 선언 파일의
 * 편입 기록·면제 목록 · `palette.diverged` · `canon` 동반 검증. 버전 축은 하나이므로 한
 * 번만 올린다 — 이 판도 같은 규율로 **한 번** 올린다.
 */
export const SCHEMA_VERSION = 6;

/**
 * 개정 6 — **사본 축이 갈라진 사본까지 본다.**
 *
 * ⭐⭐ **왜 올렸는가.** 개정 5 의 사본은 **축자로 같은** 블록뿐이었다 — 「집이 둘인데 아직
 * 같다」. 그런데 이 제품이 파는 것은 **갈라진 뒤**이고, 사본 둘 중 하나만 고쳐진 저장소에서
 * 그 수는 **0 건**이었다. ⚠️ 그 0 은 「사본 없음」으로 읽힌다 — 이 칸이 막으려던 바로 그
 * 둔갑을 이 칸이 저지르고 있었다. ⇒ 갈라진 쌍을 적는 칸 넷이 더 선다.
 *
 * ⛔ **유사도 점수가 생기지 않았다** — 단위는 여전히 축자 동일한 **줄**이고, 늘어난 것은
 * 수 둘(겹친 줄 · 갈라진 줄)과 그 쌍의 목록이다. 상태도 사유 코드도 3상태의 수도 그대로다.
 * ⭐ 문(gate)은 수의 **비교**이지 공표되는 비율이 아니다 — 비율을 내는 필드가 없다(겹친 줄이
 * **어느 한쪽의** 고유한 줄보다 많은가를 본다).
 *
 * ⚠️ **「다 보지 못했다」가 「갈라짐 0」과 다른 칸이다**(`divergedTruncated`) — 짝의 수에
 * 상한이 있고, 닿으면 멈춘다. 상한에 **잘린 목록**(`divergedOmitted`)과도 다른 사실이다:
 * 저쪽은 센 뒤에 자른 것이고 이쪽은 **세지 못한** 것이다.
 *
 * ⚠️ 개정 5 의 요약은 이 판에서 **조용히 해석되지 않는다** — 모르는 `v` 는 던진다. 없는
 * 칸을 0 으로 채우면 「보지 않았다」가 「갈라짐 0」이 된다.
 */

/**
 * 개정 5 — **선언 0 에서 보이는 사실이 봉투에 탄다.**
 *
 * ⭐⭐ **왜 올렸는가.** 선언하지 않은 저장소에서 공유값 축과 UI 경로 축이 미판정인 것은
 * 옳다 — 분모는 고객의 선언이다. 그런데 그 저장소를 본 보고서는 네 칸 중 **하나**만
 * 재어진 화면이고, 읽는 사람의 「이 도구는 내 저장소에 할 말이 거의 없다」도 틀리지
 * 않았다: 우리가 실제로 **말한** 것이 한 칸뿐이었다. ⇒ 선언 없이도 저장소가 보여 주는
 * 사실을 적는 칸을 둔다(`undeclared` — 문서 사본 · 선언할 수 있는 분모).
 *
 * ⛔ **판정기를 늘리지 않았다.** 선언 없이 위반을 짓는 축은 **우리가 지은 규율**이고 그것은
 * 이 제품이 파는 명제의 반대다 — 상태도 사유 코드도 3상태의 수도 늘지 않았고, 늘어난 것은
 * 「판정이 아닌 사실」의 칸 하나다. 그 칸을 보고 통과나 위반을 읽을 수 있는 필드가 **하나도
 * 없는** 것이 그 규율의 집행이다(`undeclared.ts`).
 *
 * ⭕ **바이트 동일성 약속은 무사하다** — 격자와 시야가 봉투에 탄 개정 3 과 같은 자리다:
 * 이 사실은 **스냅샷**을 쥔 쪽만 읽을 수 있고, 그것은 측정의 속성이지 판정이 아니다.
 * ⭐ 그래서 요약(fragment)을 받은 쪽도 **받아 그린다** — 다시 읽지 않는다(읽을 저장소가 없다).
 *
 * ⚠️ 개정 4 의 요약은 이 판에서 **조용히 해석되지 않는다** — 모르는 `v` 는 던진다. 그
 * 요약에는 이 칸이 없고, 없는 칸을 「0 건」으로 채우면 「읽지 않았다」가 「사본 0」이 된다.
 */

/**
 * 개정 4 — **공유값 축이 여럿이고, 칸의 이름이 축을 든다.**
 *
 * ⭐⭐ **왜 올렸는가.** 선언이 공유값을 **하나**만 들 수 있었다(`palette`): 그래서 한 저장소가
 * 가리킬 수 있는 정본도 하나였고, 「개발 헌법 · 디자인 헌법」처럼 규율이 갈래로 나뉘어 **서로
 * 다른 상류에** 사는 조직은 그 둘을 선언할 자리가 없었다 — 저장소가 여럿이고 규율이
 * 파편화된 조직이 평상시의 그 모양이다. ⇒ 선언의 키가 `shared-values.<축>` 으로 바뀌고
 * (축 이름은 **고객이 짓는다**), 판정의 칸은 `<판정기>:<축>` 이 된다.
 *
 * ⭕ **상태도 사유 코드도 늘지 않았다** — 늘어난 것은 **칸의 수**다. 축 하나를 세 칸으로
 * 접는 산술도, 축 사이를 합치는 산술도 생기지 않았다(합치는 자리는 격자 하나다).
 *
 * ⚠️ 개정 3 의 요약은 이 판에서 **조용히 해석되지 않는다** — 모르는 `v` 는 던진다. 그
 * 요약의 체크 id 는 `palette`·`palette-cross` 이고, 그 이름은 이 판의 어느 판정기도 아니다:
 * 조용히 읽으면 「등록부에 없는 판정기가 통과했다」가 화면에 선다.
 */

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
  /**
   * 편입 격자 — ⭐ **측정이 지어 봉투에 싣는다.** 격자는 선언 바이트와 판정 결과를 **둘 다**
   * 쥔 쪽만 셀 수 있고, 그 쪽은 저장소를 읽은 표면이다. 그리는 쪽(요약을 받은 브라우저)은
   * 다시 세지 않고 **받아 그린다** — 없는 분모를 추측해 세는 자리를 만들지 않는 규율은
   * 그대로이고, 세는 손이 여전히 하나다(`admissionGrid`).
   *
   * ⛔ `Judgment` 에 싣지 않는다 — 바이트 동일성은 거기 걸려 있다. ⛔ null 이 아니다:
   * 「칸이 0 이다」는 격자 자신이 사유와 함께 말한다(빈 분모는 미판정이다).
   */
  grid: AdmissionGrid;
  /**
   * 이 측정이 **함께 본** 저장소들(자기 자신 제외, 이름 순). 빈 목록 = 한 저장소 표면.
   *
   * ⭐ 시야는 판정의 **입력**이고(교차 축이 설 수 있는 조건) 판정 결과만 보고는 「정본을
   * 보았는가」까지는 알아도 **무엇을 보았는가**를 말할 수 없다. 요약을 받은 쪽이 「정본
   * acme/x 를 함께 읽었다」를 **참으로** 적으려면 그 이름이 봉투에 있어야 한다.
   * ⛔ 이름뿐이다 — 남의 저장소 내용은 어느 칸으로도 나가지 않는다.
   */
  peers: string[];
  /**
   * 선언 0 에서도 **보이는 사실** — ⛔ 판정이 아니다(상태도 3상태 수도 없다).
   *
   * ⭐ 격자와 **같은 성질**이라 같은 봉투에 산다: 스냅샷을 쥔 쪽만 읽을 수 있고, 읽은 수는
   * 측정의 속성이다. ⛔ `Judgment` 에 싣지 않는다 — 바이트 동일성은 거기 걸려 있다.
   * ⛔ 옵셔널이 아니다: 생략을 허용하면 「읽지 않았다」와 「사본 0 건」이 같은 바이트가 되고,
   * 그 둘을 가르는 것이 이 제품의 전부다.
   */
  undeclared: UndeclaredFacts;
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

/**
 * 봉투에 실린 격자의 **모양**을 받는다 — ⛔ 수를 다시 세지 않는다(세는 손은 `grid.ts` 다).
 * ⚠️ 여기서 보는 것은 「이 바이트가 격자를 자처하는가」이고, 「그 수가 맞는가」가 아니다:
 * 후자는 **같은 입력에서 다시 세어** 물어야 하는데 요약을 받은 쪽에는 그 입력이 없다.
 */
function assertGrid(raw: unknown): void {
  if (!isPlainObject(raw)) throw new SchemaParseError('measurement.grid');
  if (!Array.isArray(raw.surfaces) || raw.surfaces.some((s) => typeof s !== 'string' || s === '')) {
    throw new SchemaParseError('measurement.grid.surfaces');
  }
  if (raw.reason !== null && (typeof raw.reason !== 'string' || !(REASON_CODES as readonly string[]).includes(raw.reason))) {
    throw new SchemaParseError('measurement.grid.reason');
  }
  if (!Array.isArray(raw.rules)) throw new SchemaParseError('measurement.grid.rules');
  raw.rules.forEach((rule, i) => {
    if (!isPlainObject(rule)) throw new SchemaParseError(`measurement.grid.rules[${i}]`);
    if (typeof rule.rule !== 'string' || rule.rule === '') {
      throw new SchemaParseError(`measurement.grid.rules[${i}].rule`);
    }
    if (typeof rule.status !== 'string' || !(CHECK_STATUSES as readonly string[]).includes(rule.status)) {
      throw new SchemaParseError(`measurement.grid.rules[${i}].status`);
    }
    // 사유 없는 미판정은 이 제품이 팔지 않는 물건이다 — 격자의 줄에서도 같다.
    if (rule.status === 'unjudged') {
      if (typeof rule.reason !== 'string' || !(REASON_CODES as readonly string[]).includes(rule.reason)) {
        throw new SchemaParseError(`measurement.grid.rules[${i}].reason`);
      }
    } else if (rule.reason !== null) {
      throw new SchemaParseError(`measurement.grid.rules[${i}].reason`);
    }
    if (!Array.isArray(rule.verifiers) || rule.verifiers.some((v) => typeof v !== 'string' || v === '')) {
      throw new SchemaParseError(`measurement.grid.rules[${i}].verifiers`);
    }
  });
}

/**
 * 봉투에 실린 **선언 0 의 사실**의 모양을 받는다 — ⛔ 수를 다시 세지 않는다(세는 손은
 * `undeclared.ts` 하나다). 격자의 그 자리와 같다: 「이 바이트가 그 사실을 자처하는가」만 본다.
 *
 * ⛔ 상태 필드가 없다는 것을 **구조로** 확인하지 않는다 — 그 전수는 경계 테스트의 몫이고,
 * 여기서 흉내내면 두 손이 갈라진다. 여기서 보는 것은 수가 음이 아닌 정수인가까지다.
 */
function assertUndeclared(raw: unknown): void {
  if (!isPlainObject(raw)) throw new SchemaParseError('measurement.undeclared');
  const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
  if (!whole(raw.copiesOmitted)) throw new SchemaParseError('measurement.undeclared.copiesOmitted');
  if (!whole(raw.blocks)) throw new SchemaParseError('measurement.undeclared.blocks');
  if (!isPlainObject(raw.documents) || !whole(raw.documents.tracked) || !whole(raw.documents.read)) {
    throw new SchemaParseError('measurement.undeclared.documents');
  }
  if (!Array.isArray(raw.copies)) throw new SchemaParseError('measurement.undeclared.copies');
  raw.copies.forEach((copy, i) => {
    const at = `measurement.undeclared.copies[${i}]`;
    if (!isPlainObject(copy)) throw new SchemaParseError(at);
    if (typeof copy.head !== 'string') throw new SchemaParseError(`${at}.head`);
    if (!whole(copy.lines)) throw new SchemaParseError(`${at}.lines`);
    // 집이 하나인 「사본」은 사본이 아니다 — 그 모양은 이 칸의 뜻과 어긋난다.
    if (!Array.isArray(copy.files) || copy.files.length < 2 || copy.files.some((f) => typeof f !== 'string' || f === '')) {
      throw new SchemaParseError(`${at}.files`);
    }
  });
  if (typeof raw.divergedTruncated !== 'boolean') {
    throw new SchemaParseError('measurement.undeclared.divergedTruncated');
  }
  if (!whole(raw.divergedOmitted)) throw new SchemaParseError('measurement.undeclared.divergedOmitted');
  if (!whole(raw.divergedPairs)) throw new SchemaParseError('measurement.undeclared.divergedPairs');
  if (!Array.isArray(raw.diverged)) throw new SchemaParseError('measurement.undeclared.diverged');
  raw.diverged.forEach((pair, i) => {
    const at = `measurement.undeclared.diverged[${i}]`;
    if (!isPlainObject(pair)) throw new SchemaParseError(at);
    if (typeof pair.head !== 'string') throw new SchemaParseError(`${at}.head`);
    // 집이 **정확히 둘**이다 — 쌍이 단위이고, 그 모양이 아니면 이 칸의 뜻과 어긋난다.
    if (
      !Array.isArray(pair.files) ||
      pair.files.length !== 2 ||
      pair.files.some((f) => typeof f !== 'string' || f === '') ||
      pair.files[0] === pair.files[1]
    ) {
      throw new SchemaParseError(`${at}.files`);
    }
    if (!whole(pair.shared)) throw new SchemaParseError(`${at}.shared`);
    // ⛔ 갈라진 줄이 0 인 쌍은 **축자 사본**이고 저쪽 목록의 것이다 — 두 번 세지 않는다.
    if (!whole(pair.differing) || pair.differing === 0) throw new SchemaParseError(`${at}.differing`);
  });
  if (!Array.isArray(raw.surfaces)) throw new SchemaParseError('measurement.undeclared.surfaces');
  raw.surfaces.forEach((surface, i) => {
    const at = `measurement.undeclared.surfaces[${i}]`;
    if (!isPlainObject(surface)) throw new SchemaParseError(at);
    if (typeof surface.adapter !== 'string' || surface.adapter === '') throw new SchemaParseError(`${at}.adapter`);
    const { files, loaded } = surface;
    if (!whole(files)) throw new SchemaParseError(`${at}.files`);
    // 실린 수가 추적 수를 넘을 수는 없다 — 넘으면 그 바이트는 분모를 자처하지 못한다.
    if (!whole(loaded) || loaded > files) throw new SchemaParseError(`${at}.loaded`);
  });
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
  assertGrid(raw.grid);
  assertUndeclared(raw.undeclared);
  if (!Array.isArray(raw.peers) || raw.peers.some((peer) => typeof peer !== 'string' || peer === '')) {
    throw new SchemaParseError('measurement.peers');
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
