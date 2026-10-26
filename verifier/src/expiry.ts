/**
 * 면제의 만기 — **봉투가 판정한다.**
 *
 * ⭐⭐ 만기는 `Judgment` 에 들어갈 수 없다. `schema.ts` 축자가 「측정 시각 … 은
 * `Measurement` 봉투에 산다」 + 「바이트 동일성 비교는 `Judgment` 에만 건다」이고,
 * `canonical.ts` 는 `Date` 를 **던진다**. 만기를 판정에 섞으면 **같은 커밋이 어제는 통과
 * 오늘은 위반**이 되어 두 표면(CLI · 페이지)의 바이트 동일성이 그 자리에서 깨진다.
 * 그래서 이 모듈의 입력은 `measuredAt` 이고, 출력은 판정이 아니라 **봉투의 사실**이다.
 *
 * 그 사실이 하는 일은 하나다: **게이트의 색**. 넘긴 만기가 있으면 `exit 1` 이다.
 * - ⛔ 「보고만 한다」는 만기를 **장식**으로 만든다 — 아무것도 바뀌지 않는 날짜는 사유가
 *   압력을 흡수하게 두는 것이고, 만기가 필수인 이유를 지운다.
 * - ⛔ `exit 2` 도 아니다 — 만기 하나로 저장소 전체의 수를 지우는 것은 판정 실패의 자리고,
 *   여기서는 **판정이 났다**(그 칸은 미판정, 사유는 `declared-exemption`).
 * - ⭕ **3상태는 안 깨진다** — 늘어난 것은 종료 코드의 근거뿐이고 칸의 상태는 그대로다.
 *   빨강의 근거가 「위반」에서 「위반 **또는 넘긴 만기**」로 하나 늘었다.
 *
 * ⛔ 승인자 필드는 없고, 두지 않는다 — **git 이 갖는다.** 그 줄을 넣은 커밋이 요청이고
 * 머지한 사람이 승인이며, 감사는 `git log -S` 다. 근거 둘: `approvedBy` 는 이 제품에
 * 계정 개념이 0 이라 **검증될 길이 없는 선언**이고, 봉투가 git 을 읽는 것은 `RepoSnapshot`
 * 에 이력이 0 건이라 **표면마다 값이 달라진다**(회수된 면제가 지워지지 않는 성질까지 git
 * 이 공짜로 준다). 선언 스키마의 `EXEMPTION_KEYS` 가 닫힌 목록인 것이 그 집행이다.
 */

import { declarationOf, type RuleExemption } from './declaration.ts';
import type { Measurement } from './schema.ts';
import type { RepoSnapshot } from './snapshot.ts';

/** 만기를 넘긴 면제 한 건 — 선언이 적은 것만 싣는다(추측으로 채우는 필드가 없다). */
export interface OverdueExemption {
  rule: string;
  reason: string;
  expires: string;
}

/**
 * 측정 시각의 **UTC 날짜**(`YYYY-MM-DD`). 만기는 날짜이고 측정은 순간이라, 비교 전에
 * 한쪽을 자른다 — 자르는 자리는 UTC 하나다: 측정 표면의 지역 시간대로 자르면 같은 봉투가
 * 측정한 기계에 따라 다른 날짜를 내고, 그러면 만기가 기계마다 다른 날 넘어간다.
 *
 * @throws Error 시각을 읽을 수 없을 때 — 읽지 못한 시각으로 만기를 판정하지 않는다.
 *   (CLI 는 자기가 찍은 ISO 문자열을 넘기므로 이 자리는 닿지 않는다. 봉투를 **받아** 보는
 *   표면이 생기는 날 이 문장이 그 표면의 입구가 된다 — 조용히 통과시키지 않는다.)
 */
export function utcDateOf(measuredAt: string): string {
  const at = new Date(measuredAt);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`measuredAt is not a readable instant: ${JSON.stringify(measuredAt)}`);
  }
  return at.toISOString().slice(0, 10);
}

/**
 * 만기를 넘겼는가 — **만기일 당일은 넘긴 것이 아니다.**
 *
 * `expires` 는 「이 날까지」다(포함). 날짜는 순간이 아니라 하루라서, 당일을 넘긴 것으로
 * 읽으면 ⑴ 고객이 적은 그 날짜는 **어느 측정에서도 유효한 적이 없고**(오늘 적은 면제가
 * 적는 순간 빨강이다), ⑵ 「만기」라는 낱말이 「만기 전날까지」를 뜻하게 된다. 그래서
 * 넘김은 **다음 날 00:00 UTC** 부터다 — 날짜 비교로는 `측정 날짜 > expires` 다.
 *
 * ⚠️ 둘 다 `YYYY-MM-DD` 로 **검증된** 달력 날짜(`declaration.ts` · `utcDateOf`)라서
 * 코드유닛 비교가 곧 날짜 비교다 — 자리수가 고정이고 0 으로 채워져 있다.
 *
 * ⭐⭐ **만기를 가진 것이 둘이 되었다** — 면제(선언)와 자격(파일럿). 둘은 다른 물건이지만
 * 「넘겼는가」를 세는 손은 **하나여야 한다**: 두 손이 되면 경계값(당일)이 한쪽에서만
 * 포함이 되고, 그러면 같은 날짜가 어느 만기인지에 따라 다르게 읽힌다. 그래서 이 함수는
 * 면제 전용이 아니라 **날짜 하나의 술어**로 서 있고, 자격의 만기도 이것을 쓴다
 * (`entitlement.ts` · `hosts/entitlement.ts`) — 새 기전이 0 인 이유가 이 한 줄이다.
 */
export const isPastDate = (date: string, onDate: string): boolean => onDate > date;

/** 하루 — UTC 에는 서머타임이 없으므로 날짜 사이의 거리가 이 상수의 정수배다. */
const DAY_MS = 86_400_000;

/**
 * `onDate` 에서 `date` 까지 **남은 날** — 같은 날이면 0, 지났으면 음수다.
 *
 * ⭐ **0 이 「오늘까지 유효」와 같은 자리다**(`isPastDate` 가 당일을 넘김으로 읽지 않는다).
 * 그래서 「남은 날 0」은 「끝났다」가 아니라 「마지막 날이다」다 — 그 두 뜻을 가르는 것이
 * 고지의 요점이고, 가름의 기준은 위 술어 하나다.
 *
 * ⛔ 「남은 날」을 음수로 **감추지 않는다** — 넘긴 만기도 며칠 넘겼는지가 사실이고, 그
 * 사실을 0 으로 접으면 고지가 「언제 끝났는지」를 말할 수 없다. 접는 자리는 **문장**이다.
 *
 * @throws Error 둘 중 하나가 달력 날짜가 아닐 때 — 읽지 못한 날짜로 날 수를 세지 않는다.
 */
export function daysUntil(date: string, onDate: string): number {
  const to = Date.parse(`${date}T00:00:00.000Z`);
  const from = Date.parse(`${onDate}T00:00:00.000Z`);
  if (Number.isNaN(to) || Number.isNaN(from)) {
    throw new Error(`not a readable calendar date: ${JSON.stringify([date, onDate])}`);
  }
  // 둘 다 UTC 자정이라 차이는 하루의 정수배다 — `round` 는 부동소수 잔재만 막는다.
  return Math.round((to - from) / DAY_MS);
}

/**
 * 이 측정의 봉투에서 본 「넘긴 만기」 전수 — 규칙 id 코드유닛 순.
 *
 * 선언을 읽는 손은 판정과 **같은 하나**다(`declarationOf`). 선언이 없거나 면제가 0 줄이면
 * 빈 목록이다. 추적되는데 읽지 못한 선언(잘림)도 빈 목록이다 — 못 읽은 면제 목록을 두고
 * 「넘긴 만기 0」이라 말하는 것이 아니라, **잘림 위에서는 수를 내지 않는다**는 그 규율
 * 그대로다(그 격자는 이미 `collection-truncated` 미판정으로 남는다).
 *
 * @throws DeclarationInvalidError 선언이 깨졌을 때 — 판정 실패가 만기보다 앞선다.
 */
export function overdueExemptions(snapshot: RepoSnapshot, measuredAt: string): OverdueExemption[] {
  const declaration = declarationOf(snapshot);
  if (declaration === 'unreadable' || declaration.state !== 'valid') return [];
  const exemptions: Record<string, RuleExemption> = declaration.exemptions ?? {};
  const onDate = utcDateOf(measuredAt);
  return Object.entries(exemptions)
    .filter(([, exemption]) => isPastDate(exemption.expires, onDate))
    .map(([rule, exemption]) => ({ rule, reason: exemption.reason, expires: exemption.expires }))
    .sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}

/** 게이트가 보는 것 — 판정 하나와 그 봉투가 말한 「넘긴 만기」. */
export interface GateEntry {
  measurement: Measurement;
  overdue: readonly OverdueExemption[];
}

/**
 * 종료 코드 — **빨강의 근거는 위반 또는 넘긴 만기다.** 두 근거를 **한 함수**가 보는 것이
 * 이 파일의 요점이다: 두 곳에서 각자 세면 한쪽만 보는 표면이 생기고, 그 표면의 초록은
 * 거짓이다. ⛔ 2 는 여기서 나오지 않는다 — 그 자리는 판정 실패의 몫이고, 넘긴 만기는
 * 판정이 **난** 뒤의 사실이다.
 */
export const gateExitCode = (entries: readonly GateEntry[]): 0 | 1 =>
  entries.some(
    ({ measurement, overdue }) =>
      overdue.length > 0 || measurement.judgment.checks.some((c) => c.status === 'violation'),
  )
    ? 1
    : 0;

/**
 * 「넘긴 만기」를 말하는 줄들 — 넘긴 것이 0 이면 빈 목록이다(없는 사실을 적지 않는다).
 *
 * 빨강의 근거는 **언제나 말해진다**: 종료 코드만 1 로 바꾸고 이유를 적지 않으면 고객은
 * 위반 0 인 보고 앞에서 빨강을 보게 되고, 그것은 이 제품이 파는 결함의 모양 그대로다.
 * ⚠️ 위반 수는 **늘지 않는다** — 이 줄들은 수를 세는 자리가 아니라 봉투의 사실이다.
 */
export function describeOverdue(overdue: readonly OverdueExemption[], onDate: string): string[] {
  if (overdue.length === 0) return [];
  const lines = [
    `  ❌ ${overdue.length} exemption(s) past their expiry as of ${onDate} (UTC) — this is red, and it is not a violation count`,
  ];
  for (const { rule, expires, reason } of overdue) {
    lines.push(`    ${rule}: expired ${expires} — ${reason}`);
  }
  lines.push(
    '    an expiry that changes nothing is decoration — renew the exemption with a new date, or let the rule be judged',
  );
  return lines;
}
