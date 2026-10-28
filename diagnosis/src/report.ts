/**
 * 보고서 뷰모델 — URL 모드와 fragment 모드가 **이 빌더 하나**로 그린다.
 * 모드가 가르는 것은 머리의 입력 출처 줄과 fragment 고지 한 줄뿐이다.
 *
 * 여기에는 어떤 산술도 없다 — 수는 측정이 준 3상태 그대로이고, 세 상태를 하나의
 * 숫자로 접는 코드는 이 파일에 생기지 않는다(경계 테스트가 전수한다). 증거는 축자로
 * 싣는다: 렌더러는 해석하지 않는다.
 *
 * ⭐ **문구는 이 파일에 없다** — 들어오는 것은 `Strings` 한 벌이고, 이 파일이 하는 일은
 * 「어느 문구를 어느 자리에」다. 문구가 여기 박히면 번역 한 벌이 **조용히 옛 문구를 들고**
 * 남는데, 그 갈라짐은 화면에 아무 표시도 남기지 않는다.
 * ⛔ **기본 로케일이 없다** — 자격의 생략이 「자격 있다」가 아닌 것과 같은 자리다: 기본값을
 * 두면 로케일을 싣지 않은 표면이 **조용히 정본으로** 그려지고, 그 화면은 주소가 선언한
 * 언어와 갈라진다.
 */

import {
  MIN_COPY_LINES,
  NOTATIONS,
  foldDiverged,
  entitlementNotice,
  utcDateOf,
  type CheckResult,
  type CheckStatus,
  type Entitlement,
  type EntitlementNotice,
  type Measurement,
  type Span,
  type UndeclaredFacts,
} from '../../verifier/src/index.ts';
import type { Strings } from './strings.ts';

export type ReportOrigin = 'url' | 'fragment';

export interface CheckVM {
  id: string;
  status: CheckStatus;
  statusLabel: string;
  /** `unjudged` 일 때만 non-null — 사유 없는 미판정은 스키마가 이미 거부한다. */
  reasonLine: string | null;
  countsLine: string;
  /** 축자 증거 — 한 건당 한 줄. */
  evidence: string[];
  /**
   * 접은 증거의 요약 — ⚠️ **보인 수만** 말한다. 자른 수는 `omittedLine` 이 따로 말한다:
   * 「안 보이는 이유」가 둘(접힘 · 잘림)인데 한 수로 뭉치면 읽는 사람이 **펼치면 다 보인다**고
   * 읽는다. 증거가 0 건이면 null 이다 — 접을 것이 없다.
   */
  evidenceSummary: string | null;
  omittedLine: string | null;
}

/** 보고서의 한 절 — ⭐ 머리와 목록이 **한 쌍**으로만 선다(빈 절은 뷰모델에서 이미 없다). */
export interface ReportSection {
  heading: string;
  checks: CheckVM[];
}

/** 사본 한 건 — 집들과 그 손잡이. ⛔ 블록 전문은 봉투에도 없다(싣는 것은 첫 줄 하나다). */
export interface CopyVM {
  homesLine: string;
  head: string;
  files: string[];
}

/**
 * 선언 0 에서 보이는 사실의 절 — ⛔ **상태가 없다.** `CheckVM` 과 달리 `status` 도
 * `statusLabel` 도 없는 것이 그 규율의 집행이다: 이 절을 그리는 렌더러가 글리프를 붙일
 * 자리가 **타입에** 없다.
 */
/**
 * 갈라진 사본의 **가족** — 손잡이 하나와 그 집들. ⛔ 비율이 아니다.
 *
 * ⭐ 쌍이 아니라 가족인 것이 화면의 결정이다 — 집이 N 이면 쌍이 C(N,2) 로 불어 같은 손잡이가
 * 열 몇 번 반복된다(실측). ⛔ 접는 손은 **판정기 모듈의 하나**다(`foldDiverged`): 여기서
 * 접으면 측정 명령과 이 화면이 갈라지고, 갈라진 뒤에도 양쪽이 자기 기준으로는 옳다.
 */
export interface DivergedVM {
  countsLine: string;
  head: string;
  files: string[];
}

export interface UndeclaredVM {
  heading: string;
  noticeLines: string[];
  documentsLine: string;
  copiesLine: string;
  copies: CopyVM[];
  omittedLine: string | null;
  /** ⭐ 축자 사본과 **다른 줄**이다 — 「아직 같다」와 「이미 두 말을 한다」를 접지 않는다. */
  divergedLine: string;
  diverged: DivergedVM[];
  divergedOmittedLine: string | null;
  /** ⚠️ 다 보지 못했을 때만 non-null — 상한에 잘린 목록과 다른 사실이다. */
  divergedTruncatedLine: string | null;
  whyLines: string[];
  surfacesHeading: string;
  surfaceLines: string[];
}

/** 보고서 머리의 항목 이름 — ⭐ 렌더러가 아니라 **뷰모델**이 든다(조립과 문구를 가르는 선). */
export interface ReportLabels {
  repo: string;
  commit: string;
  source: string;
  measuredAt: string;
  verifier: string;
}

export interface ReportVM {
  title: string;
  labels: ReportLabels;
  head: {
    repo: string;
    commit: string;
    /** 모드가 가르는 유일한 메타 줄. */
    sourceLine: string;
    measuredAt: string;
    verifierLine: string;
    dirtyLine: string | null;
    /** fragment 모드의 고지 한 줄 — URL 모드에는 없다. */
    fragmentNotice: string | null;
    /**
     * 이 보고가 고지의 근거로 삼은 **사실** — 문장이 아니다(상태 · 사유 · 만기일 · 남은 날 ·
     * 넘겼는가 · 전환 경로). 자격을 보지 않은 표면에서도 **있다**: 그때의 상태가
     * `'unasked'` 이고, 그것은 생략이 아니라 사실이다.
     *
     * ⭐⭐ **두 표면이 맞춰야 하는 것이 이것이다.** 측정 명령과 이 페이지가 같은 사실에서
     * 그리면 ⑴ 어느 표면도 날짜를 **다시 세지 않고** ⑵ 침묵할지 말할지를 사실 하나가
     * 결정하고 ⑶ 로케일이 늘어도 그 둘이 움직이지 않는다. 그래서 **바이트 동일성이 걸리는
     * 자리가 문장이 아니라 여기**다 — `entitlement.test.ts` 가 그 사실을 문다.
     */
    entitlement: EntitlementNotice;
    /**
     * 그 사실을 **이 로케일로** 그린 줄들 — 고지할 것이 없으면 빈 목록이다.
     *
     * ⭐ 문장은 카탈로그가 짓는다(`strings.entitlement`). 그전까지는 판정기 모듈이 낸
     * **완성된 영문 문장**을 축자로 들었는데, 그 꼴은 화면 문구가 ko·en 두 벌이 되는 순간
     * ⑴ 한국어 화면에 영문 한 줄을 세우거나 ⑵ 두 표면의 「같은 한 문장」이 로케일마다
     * 갈라진다 — 둘 다 거짓이라 정본이 **사실로 내려왔다.**
     */
    entitlementLines: string[];
  };
  scopeLines: string[];
  /** 재어진 것 — 통과와 위반이 **같은 칸** 안에서 갈린다(심볼이 가른 쪽과 같다). */
  measured: ReportSection;
  /** 재지 않은 것 — ⭕ 0 건이면 **절이 없다**(AC3). */
  unmeasured: ReportSection | null;
  totalsLine: string;
  /**
   * 선언 0 에서 보이는 사실 — ⛔ **null 이 아니다.** 「사본 0」도 사실이고, 절을 없애면
   * 「읽지 않았다」와 같은 화면이 된다(빈 절을 세우지 않는 그 규율의 **반대쪽** 자리다:
   * 저쪽은 머리만 서고 아무 수도 없는 절이고, 이쪽은 분모와 수가 둘 다 있는 절이다).
   */
  undeclared: UndeclaredVM;
}

/** 화면에 싣는 증거 상한 — 수(counts)는 그와 무관하게 항상 전수다. */
const EVIDENCE_DISPLAY_MAX = 40;

const isRefsShape = (e: Record<string, string | number>): boolean =>
  'file' in e && 'line' in e && 'notation' in e && 'raw' in e && 'why' in e && 'tried' in e;

/**
 * 선언된 갈라짐의 증거 — `why` 는 기계가 읽는 코드고 `reason` 은 **사람이 읽는 문장**이다.
 * 문장을 `k=v` 열의 한 칸으로 접으면 화면에 있으면서도 읽히지 않는데, **읽지 않는 사유는
 * 통과료다.** 그래서 이 꼴만 문장으로 세워 그린다 — 해석은 없다(사유는 축자 그대로 간다).
 */
const isDivergenceShape = (e: Record<string, string | number>): boolean =>
  e.why === 'declared-divergence' && typeof e.token === 'string' && typeof e.reason === 'string';

function evidenceLine(e: Record<string, string | number>, strings: Strings): string {
  if (isRefsShape(e)) {
    return `${e.file}:${e.line} [${e.notation}] ${e.raw} — ${e.why} (${e.tried})`;
  }
  if (isDivergenceShape(e)) {
    return strings.report.divergence({
      token: String(e.token),
      reason: String(e.reason),
      at: 'file' in e && 'line' in e ? `${e.file}:${e.line}` : null,
    });
  }
  return Object.entries(e)
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ');
}

function buildCheck(check: CheckResult, strings: Strings): CheckVM {
  const countsLine = Object.entries(check.counts)
    .filter(([k]) => k !== 'evidenceOmitted')
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
  const shown = check.evidence.slice(0, EVIDENCE_DISPLAY_MAX);
  const beyond = Math.max(check.evidence.length - EVIDENCE_DISPLAY_MAX, 0) + (check.counts.evidenceOmitted ?? 0);
  return {
    id: check.id,
    status: check.status,
    statusLabel: strings.status[check.status],
    reasonLine: check.status === 'unjudged' && check.reason !== null ? strings.reason[check.reason] : null,
    countsLine,
    evidence: shown.map((e) => evidenceLine(e, strings)),
    // ⭐ 보인 수와 자른 수를 **따로** 든다 — 접힘과 잘림은 「안 보이는 이유」가 다르다.
    evidenceSummary: shown.length > 0 ? strings.report.evidenceSummary(shown.length) : null,
    omittedLine: beyond > 0 ? strings.report.omitted(beyond) : null,
  };
}

function dirtyLine(dirty: number | null, strings: Strings): string | null {
  if (dirty === null) return strings.report.dirtyUnknown;
  if (dirty > 0) return strings.report.dirty(dirty);
  return null;
}

/**
 * 사실 하나를 이 로케일의 줄들로 — **순서가 뜻을 만든다.** 자격 줄들 다음이 만기와 전환
 * 경로라, 만기를 넘긴 보고에서 **무엇이 없는가와 무엇을 하면 되는가**가 한 자리에 있다.
 * 측정 명령도 같은 순서로 잇는다 — 그래서 두 표면이 같은 고지를 낸다.
 *
 * ⛔ **여기서 날짜를 세지 않는다.** 「넘겼는가」는 사실의 `pastExpiry` 에서 **받아** 어느
 * 문장인지만 고른다: 이 자리에서 다시 세면 경계값(만기 **당일**은 아직 자격이다)을 쥔 손이
 * 둘이 되고, 그러면 같은 자격이 표면에 따라 끝났다/안 끝났다가 된다.
 */
function entitlementLines(notice: EntitlementNotice, strings: Strings): string[] {
  const lines: string[] = [];
  // 자격 줄들 — 자격이 있거나(`entitled`) 묻지 않았으면(`unasked`) 0 줄이다.
  if (notice.state === 'unwired') lines.push(...strings.entitlement.unwired);
  else if (notice.state === 'absent') lines.push(...strings.entitlement.absent(notice.reason, notice.detail));
  // 만기 줄들 — 만기가 없는 자격에는 셀 것이 없어 사실이 `null` 이다.
  if (notice.expiry !== null) {
    const say = notice.expiry.pastExpiry ? strings.entitlement.expired : strings.entitlement.expires;
    lines.push(...say(notice.expiry, notice.convertPath));
  }
  return lines;
}

/**
 * 선언 0 의 사실 → 이 로케일의 줄들. ⛔ 여기서 **세지 않는다** — 수는 봉투가 적어 오고,
 * 이 함수가 하는 일은 「어느 문구를 어느 자리에」다(보고서 전체의 그 규율 그대로다).
 */
/** 범위 한 자리 — ⭐ 전부 같으면 **한 수**다(없는 폭을 적지 않는다). 측정 명령과 같은 꼴이다. */
const span = (range: Span): string => (range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`);

function buildUndeclared(facts: UndeclaredFacts, strings: Strings): UndeclaredVM {
  const say = strings.undeclared;
  const { documents, copies, copiesOmitted, blocks, surfaces } = facts;
  return {
    heading: say.heading,
    noticeLines: [...say.notice],
    // 분모가 **먼저**다 — 「사본 0」이 「문서를 못 읽었다」와 같아 보이지 않게.
    documentsLine:
      documents.read === documents.tracked
        ? say.documentsRead(documents.tracked)
        : say.documentsPartial(documents.tracked, documents.read),
    // ⭐ 하한의 수는 판정기 모듈의 상수에서 온다 — 문구에 박으면 세는 손과 갈라진다.
    copiesLine: blocks === 0 ? say.copiesNone(MIN_COPY_LINES) : say.copies(blocks),
    copies: copies.map((copy) => ({
      homesLine: say.homes(copy.files.length, copy.lines),
      head: copy.head,
      files: [...copy.files],
    })),
    omittedLine: copiesOmitted > 0 ? say.copiesOmitted(copiesOmitted) : null,
    divergedLine: facts.divergedPairs === 0 ? say.divergedNone : say.diverged(facts.divergedPairs),
    diverged: foldDiverged(facts.diverged).map((family) => ({
      countsLine: say.divergedFamily(family.files.length, family.pairs, span(family.shared), span(family.differing)),
      head: family.head,
      files: [...family.files],
    })),
    divergedOmittedLine: facts.divergedOmitted > 0 ? say.divergedOmitted(facts.divergedOmitted) : null,
    // ⛔ 「다 보지 못했다」를 「갈라짐 0」 옆에 **침묵으로** 두지 않는다.
    divergedTruncatedLine: facts.divergedTruncated ? say.divergedTruncated : null,
    whyLines: [...say.why],
    surfacesHeading: say.surfacesHeading,
    surfaceLines: surfaces.map((surface) =>
      surface.files === 0
        ? say.surfaceNone(surface.adapter)
        : surface.loaded === surface.files
          ? say.surfaceAll(surface.adapter, surface.files)
          : say.surfacePartial(surface.adapter, surface.files, surface.loaded),
    ),
  };
}

export function buildReport(
  measurement: Measurement,
  origin: ReportOrigin,
  strings: Strings,
  entitlement?: Entitlement,
): ReportVM {
  const { judgment } = measurement;
  // ⭐ 세는 날짜는 **봉투의 그 날짜**다 — 「오늘」을 읽으면 한 보고 안에서 「측정 시각」과
  //   「만기를 센 날」이 갈라질 수 있고(자정 경계), 그러면 같은 봉투가 표면마다 다른 고지를
  //   낸다. 받은 보고서를 다시 그려도 같은 사실이 나오는 것이 그 선택의 값이다.
  const notice = entitlementNotice(entitlement, utcDateOf(measurement.measuredAt));
  const checks = judgment.checks.map((check) => buildCheck(check, strings));
  const violations = judgment.checks.filter((c) => c.status === 'violation').length;
  const unjudged = judgment.checks.filter((c) => c.status === 'unjudged').length;
  const passes = judgment.checks.length - violations - unjudged;
  // ⭐⭐ **가르는 손이 여기 하나다.** 렌더러가 상태를 보고 나누면 「어느 칸인가」가 조립
  //    층의 판단이 되고, 그 판단은 화면마다 사본이 된다 — 이 파일의 산문이 정한 선이다.
  const unmeasured = checks.filter((check) => check.status === 'unjudged');
  return {
    title: strings.report.title,
    labels: { ...strings.report.label },
    head: {
      repo: judgment.repo ?? strings.report.repoUnknown,
      commit: judgment.commit,
      sourceLine: strings.report.source(origin, measurement.source),
      measuredAt: measurement.measuredAt,
      verifierLine: `${measurement.verifier.name} ${measurement.verifier.version}`,
      dirtyLine: dirtyLine(measurement.dirty, strings),
      fragmentNotice: origin === 'fragment' ? strings.report.fragmentNotice : null,
      entitlement: notice,
      entitlementLines: entitlementLines(notice, strings),
    },
    scopeLines: [...strings.report.scope(NOTATIONS.map((n) => n.id).join(' · '))],
    measured: {
      heading: strings.report.measuredHeading,
      checks: checks.filter((check) => check.status !== 'unjudged'),
    },
    // ⛔ **빈 절을 세우지 않는다** — 「재지 않은 것 0건」이라는 머리가 서면 읽는 사람이 그
    //    절을 한 번 읽고 아무것도 못 얻는다. 수는 합계 줄이 0 으로 말한다(그쪽은 침묵하지
    //    않는다 — 미판정이 없다는 것도 사실이라 적힌다).
    unmeasured: unmeasured.length === 0 ? null : { heading: strings.report.unmeasuredHeading, checks: unmeasured },
    // ⭐ 재어진 절과 **다른 칸**이다 — 상태 없는 수가 체크 옆에 서면 위반처럼 읽힌다.
    undeclared: buildUndeclared(measurement.undeclared, strings),
    totalsLine: strings.report.totals({
      checks: judgment.checks.length,
      measured: violations + passes,
      violations,
      passes,
      unjudged,
    }),
  };
}
