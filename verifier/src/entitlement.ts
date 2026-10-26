/**
 * 자격 — **판정의 입력이다.**
 *
 * ⭐⭐ `judge.ts` 축자가 「순수 함수다: I/O 도 네트워크도 없다」라서 판정이 자격을
 * **물을** 수는 없다. 그래서 묻는 것은 호출자(CLI · 페이지)고 판정은 **받는다** —
 * 선례는 같은 자리의 `JudgeContext.peers` 다(「호스트가 읽고 판정은 받는다」). 이
 * 모듈은 그 인자의 **모양과 뜻**만 쥐고 있고 네트워크는 한 줄도 없다: 벤더를 부르는
 * 손은 `hosts/entitlement.ts` 다.
 *
 * ⭐⭐ **자격은 위반이 아니라 미판정이다.** 자격 없이 돌린 측정은 `exit 0` 이고
 * (`expiry.ts` 의 빨강 근거 둘에 자격이 없다), 칸은 「미판정 + 사유」로 남는다 —
 * `no-declaration` 과 **같은 자리**다. ⛔ 「계산하고 표시만 가린다」는 「막는 척」이고
 * ⛔ 「분모도 감춘다」는 「부재를 공백으로」다: 분모는 선언에서 오고 **선언은 고객
 * 것**이라 자격이 걸리는 것은 **수를 내는 것**뿐이다(격자의 칸 구성은 그대로 보인다).
 *
 * ⭐⭐ **고지의 정본은 문장이 아니라 사실이다** — 아래 `entitlementNotice` 가 그 자리고,
 * 영문 문장 둘(`describeEntitlement` · `describeExpiry`)은 그 사실에서 **유도된다.**
 * 왜 그렇게 되었는지는 그 함수의 산문이 든다.
 *
 * ⭐ **사유 코드 둘을 가르는 기준은 「고객에게 요구하는 행동」이다** — 「사라」와
 * 「네트워크를 열어라」. ⛔ 뭉치면 돈 낸 고객이 오프라인 CI 에서 「자격 없음」을 받는다.
 * 그 가름을 아래 `DETAIL_REASONS` **한 표**가 쥔다: 행 하나가 곧 한 줄이라, 어느 상황을
 * 어느 쪽으로 읽을지 바꾸는 비용이 한 줄이다.
 */

import { daysUntil, isPastDate } from './expiry.ts';
import type { ReasonCode } from './schema.ts';

/**
 * ⚠️ **이 블록이 「사람 확인 필요」의 자리다.** 아래 다섯 중 셋(`file`·`handleKey`·
 * `keyEnv`)은 **상류에서 결정된 적이 없다** — 결정된 것은 「선언 파일과 **다른** 파일에
 * 활성화 핸들을 커밋한다」까지이고, 이름도 필드 모양도 비어 있다. 지어내 흩지 않고 **한
 * 자리**에 모아 둔 것이 그 사실의 집행이다: 상류가 다른 이름을 정하면 고치는 것은 이
 * 객체이고, 코드의 나머지는 이 이름을 **읽어서** 쓴다.
 *
 * ⭕ **핸들을 커밋해도 안전한 근거**: 벤더의 검증은 `key` 를 **함께** 요구하므로
 * (`required = ['key', 'organization_id']`) 핸들만으로는 아무것도 할 수 없다. 그리고
 * **커밋 가능해야 CI 가 쓴다** — 비밀로 두면 축이 장식이 된다.
 *
 * ⛔ **키는 커밋되지 않는다** — 공개 모듈에 비밀 0 이므로 키는 환경에서 온다. 그 자리가
 * `keyEnv` 이고, 모듈은 환경을 **읽지도 않는다**(읽는 손은 CLI 다).
 *
 * ⚠️ **`apiVersion` 은 못 박는다** — 벤더는 날짜 판을 `versionHeader` 로 고르고, 생략하면
 * 벤더가 고른 판을 받는다(공개된 스키마는 **최고령** 판을 준다). 선언하지 않은 의존은
 * 조용히 갈라진다 — 이 제품이 파는 명제를 자기에게 적용하는 자리다.
 */
export const ENTITLEMENT = {
  /** 핸들이 사는 파일(저장소 루트 상대). ⛔ 선언 파일(`graduand.json`)이 아니다. */
  file: 'graduand.entitlement.json',
  /** 핸들 파일의 **유일한** 키. 벤더 필드 이름을 그대로 쓴다 — 번역하면 사본이 하나 는다. */
  handleKey: 'activation_id',
  /** 라이선스 키가 오는 자리. ⛔ 파일이 아니다 — 커밋되는 비밀은 비밀이 아니다. */
  keyEnv: 'GRADUAND_LICENSE_KEY',
  /** 벤더 검증 엔드포인트 — **무인증**이다(스키마에 `security` 키가 아예 없다). */
  validateUrl: 'https://api.polar.sh/v1/customer-portal/license-keys/validate',
  /** 날짜 판을 고르는 요청 헤더. */
  versionHeader: 'Polar-Version',
  /** 못 박은 판. */
  apiVersion: '2027-01',
  /**
   * 만기가 오는 벤더 필드. ⚠️ 벤더 이름을 **그대로** 쓴다 — 번역하면 사본이 하나 늘고,
   * 그 사본이 벤더의 판 갈이와 조용히 갈라진다(위 `handleKey` 와 같은 규율).
   * ⛔ 만기를 **우리가** 적는 자리는 없다: 파일럿의 만기는 자격의 성질이고 자격은 벤더가
   * 발행한다. 우리 쪽에 적어 두면 그 사본과 벤더의 값이 갈라진 날 고객이 **둘 다 참인**
   * 두 만기를 보게 된다 — 이 제품이 파는 결함의 모양 그대로다.
   */
  expiresKey: 'expires_at',
  /**
   * 발행 조직 id — 벤더 심사가 끝나는 날 들어온다. ⛔ 지어내지 않는다: `null` 은 「아직
   * **물을 수 없다**」이고, 그 상태는 고객 탓이 아니므로 「자격 없음」이 아니라 「확인
   * 불가」다(아래 `vendor-unconfigured`).
   */
  organizationId: null as string | null,
};

/**
 * 전환 링크 — **상대 경로 하나다.** 보고가 적는 것은 이 문자열이고, 그 뒤를 받는 것은
 * 호스팅의 리다이렉트 선언이다(페이지의 구독 입구 `<a href>` 와 **같은 자리**를 가리킨다 —
 * 같은 리다이렉트가 둘을 받으므로 벤더가 주소를 바꿀 때 고치는 자리도 하나다).
 *
 * ⛔ **벤더 절대 URL 을 보고에 박지 않는다.** 보고는 붙여넣어 옮겨지는 물건이라(fragment
 * 주소 · CI 로그 · 캡처) 벤더가 주소를 바꾼 날 **이미 나간 보고 전부**가 거짓말을 하고,
 * 그 거짓말은 오래 산다. ⭕ 상대 경로는 보고를 **읽는 자리**에서 풀리고 그 자리는 우리 것이다.
 *
 * ⭐⭐ 그리고 이것이 「**쓰는 그 도구가 전환을 말한다**」의 집행이다 — 고지가 벤더 메일에
 * 매달리지 않는다(⛔ 벤더 쪽 `email` 은 optional 이라 도달이 미보장이다).
 */
export const CHECKOUT_PATH = './checkout/';

/**
 * 자격의 상태 — 둘이다. **셋이 아닌 이유**: 「없다」와 「확인 못 했다」를 가르는 것은
 * 상태가 아니라 **왜 그렇게 되었는가**(`detail`)이고, 그 가름은 아래 한 표가 쥔다.
 * 상태를 셋으로 쪼개면 가름이 호출자마다 복제되고, 복제된 가름은 갈라진다.
 */
export type Entitlement =
  /**
   * 자격이 있다. `expires` 는 **만기일**(`YYYY-MM-DD`)이고, 만기가 없는 자격은 `null` 이다
   * — ⛔ 생략으로 두지 않는다: 생략은 「만기가 없다」와 「만기를 읽지 못했다」를 같게 만들고,
   * 둘째는 벤더의 답을 읽지 못한 것이므로 `answer-unreadable` 의 자리다.
   */
  | { state: 'entitled'; expires: string | null }
  /**
   * 수를 내지 않는다. `detail` 이 사유 코드와 「요구하는 행동」을 함께 고른다.
   *
   * ⭐ **만기는 여기에도 산다** — 넘겨서 막힌 자격은 「없다」이면서 **만기일이 사실**이다.
   * 그 날짜를 버리면 보고가 「자격 없음」만 말하고 **언제 끝났는지**를 말할 수 없다 —
   * ⛔ 조용히 수가 사라지는 그 모양이다. 만기와 무관하게 막힌 상태(답을 못 받았다 따위)
   * 에서는 `null` 이다: 없는 사실을 적지 않는다.
   */
  | { state: 'absent'; detail: EntitlementDetail; expires: string | null }
  /**
   * ⭐⭐ **아무도 아무것도 하지 않았다** — 고객은 핸들도 키도 두지 않았고, 이 빌드에는
   * 발행 조직 id 가 아직 없다(`ENTITLEMENT.organizationId === null`). 물을 것도 물을 길도
   * 없으므로 **아무것도 막지 않는다**: 「검증하고 표시하되 막지 않는다」에서 지금 서 있는
   * 것은 **표시**뿐이다.
   *
   * ⚠️ 고객이 **자기 몫을 한** 경우는 여기가 아니다 — 핸들이나 키가 있는데 우리가 묻지
   * 못하면 그 수는 막히고 사유는 우리를 가리킨다(`vendor-unconfigured`). 우리 쪽 미비를
   * 고객의 「자격 없음」으로 적지 않는 것과, 고객의 설정을 우리 미비로 **덮지** 않는 것이
   * 같은 규율의 양면이다.
   *
   * ⛔ 「확인 불가」로 접지 않는다 — 그러면 오늘 아무 고객도 수를 받지 못하고, 그 빨강의
   * 근거는 **우리 쪽 미비**다. ⛔ 생략(`undefined`)으로 두지도 않는다 — 생략은 조용하고,
   * 이 상태는 보고에서 **한 줄로 말해진다**: 자격을 묻지 않은 수라는 사실이 숨지 않는다.
   *
   * ⭕ 조직 id 가 들어오는 날 이 상태는 **사라진다** — 상수 한 줄이 그 전환의 전부다.
   */
  | { state: 'unwired' };

/**
 * ⭐⭐ **가름의 정본 — 상황 하나가 한 줄이다.**
 *
 * 「자격 없음」(`no-entitlement`)은 **「없다」고 말할 수 있는 답이 있을 때**다:
 * 벤더가 없다고 답했거나, 저장소와 환경 **양쪽**이 비어 있을 때(= 아직 사지 않았다).
 * 나머지 전부는 **답을 받지 못한 것**이라 「자격 확인 불가」(`entitlement-unverifiable`)다
 * — 네트워크가 막혔든, 설정이 반만 됐든, 우리 쪽 조직 id 가 아직 없든, 요구하는 행동이
 * 「사라」가 **아니다.**
 */
export const DETAIL_REASONS = {
  /** 저장소에 핸들이 없고 환경에 키도 없다 — 아직 사지 않았다. */
  'not-configured': 'no-entitlement',
  /** 벤더가 답했고 그 답이 「없다」였다(404 — 없음·회수·만료·활성화 불일치). */
  'vendor-said-no': 'no-entitlement',
  /**
   * 벤더가 자격을 주었고 그 자격의 **만기가 지났다** — 봉투가 `measuredAt` 으로 판정한다.
   *
   * ⭐ 「없다」쪽이다: 답이 있고, 그 답은 **끝났다**이고, 요구하는 행동은 「사라(전환하라)」다.
   * ⚠️ `vendor-said-no` 와 뭉치지 않는다 — 404 는 벤더가 못 찾은 것이고 이쪽은 **우리가**
   * 날짜를 읽어 판정한 것이라, 고객에게 말해 줄 수 있는 것이 다르다(만기일과 남은 날).
   * ⛔ 「확인 불가」도 아니다: 네트워크도 설정도 멀쩡하고, 끝난 것은 기간이다.
   */
  'past-expiry': 'no-entitlement',
  /** 키는 있는데 핸들이 없다 — 산 사람이다. 묻지 못한 것이지 없는 것이 아니다. */
  'handle-absent': 'entitlement-unverifiable',
  /** 핸들 파일을 읽을 수 없다(없는 키 · 깨진 JSON). 조용히 넘기지 않는다. */
  'handle-unreadable': 'entitlement-unverifiable',
  /** 핸들은 커밋돼 있는데 환경에 키가 없다 — ⭐ 이 줄이 「오프라인 CI 의 돈 낸 고객」이다. */
  'key-absent': 'entitlement-unverifiable',
  /**
   * 고객은 자기 몫을 했는데 **우리 쪽** 발행 조직 id 가 아직 없다 — 물을 길이 없었다.
   * ⛔ 「사라」가 아니다: 사유가 가리키는 것은 고객이 아니라 이 빌드다.
   */
  'vendor-unconfigured': 'entitlement-unverifiable',
  /** 답을 받지 못했다 — 네트워크 실패 · 5xx. ⛔ 「사라」가 아니라 「네트워크를 열어라」다. */
  'no-answer': 'entitlement-unverifiable',
  /** 답은 받았으나 읽을 수 없다 — 모르는 모양을 「없다」로 읽지 않는다. */
  'answer-unreadable': 'entitlement-unverifiable',
} as const satisfies Record<string, ReasonCode>;

export type EntitlementDetail = keyof typeof DETAIL_REASONS;

/** 고객에게 **요구하는 행동** — 사유 코드가 둘인 이유가 이 문장들이다. */
const DETAIL_ACTIONS: Record<EntitlementDetail, string> = {
  'not-configured': `no entitlement is configured — buy one, commit its handle to ${ENTITLEMENT.file}, and put the key in ${ENTITLEMENT.keyEnv}`,
  'vendor-said-no': `the vendor answered: this key is not valid for this activation — buy or renew one, then update ${ENTITLEMENT.file}`,
  'past-expiry': 'this entitlement is past its expiry — convert to get the numbers back',
  'handle-absent': `${ENTITLEMENT.keyEnv} is set but ${ENTITLEMENT.file} is missing — activate this checkout and commit the handle it gives you`,
  'handle-unreadable': `${ENTITLEMENT.file} could not be read — it holds exactly one key, "${ENTITLEMENT.handleKey}"`,
  'key-absent': `${ENTITLEMENT.file} is committed but ${ENTITLEMENT.keyEnv} is not in this environment — put the key in this job's secrets`,
  'vendor-unconfigured': 'this build of the verifier has no issuing organization yet — nothing could be asked, and that is not your fault',
  'no-answer': 'the vendor did not answer — open the network for this job, or re-run it when the network is back',
  'answer-unreadable': 'the vendor answered in a shape this verifier does not know — an unknown answer is not a "no"',
};

/**
 * 자격이 수를 막는가 — 막으면 **사유 코드와 그 까닭**을 함께 준다. 자격이 있거나 **이
 * 표면이 자격을 보지 않았으면** null 이다. 사유를 고르는 손은 이 함수 하나다: 둘로
 * 나뉘면 어느 표면이 어느 가름을 썼는지 말할 수 없다.
 *
 * ⚠️ **생략은 「보지 않았다」다**(「자격 있다」가 아니다). 그 구분은 `judge.ts` 가 아니라
 * 자격을 **싣는 표면**이 쥔다: 보는 표면은 반드시 싣고(측정 명령이 그렇다), 싣지 않은
 * 표면의 수는 「자격을 묻지 않은 수」다. ⛔ 생략을 「자격 없음」으로 읽으면 자격을 보지
 * 않는 표면(무료 진단)이 아무 수도 내지 못하고, ⛔ 「자격 있음」으로 **기본값을 두면**
 * 그것은 거짓 선언이다 — 그래서 기본값이 **없다.**
 */
export const entitlementGate = (
  entitlement: Entitlement | undefined,
): { reason: ReasonCode; detail: EntitlementDetail } | null =>
  entitlement === undefined || entitlement.state !== 'absent'
    ? null
    : { reason: DETAIL_REASONS[entitlement.detail], detail: entitlement.detail };

/**
 * 커밋된 핸들 — 키 하나다. ⛔ 넓히지 않는다: 과금 상태가 늘어나는 자리를 만들면 그것이
 * 선언을 넓히지 않은 이유를 지운다.
 */
export interface EntitlementHandle {
  activationId: string;
}

/**
 * 핸들 파일을 읽는다 — **순수 함수**다(파일을 여는 손은 호스트다).
 *
 * 모르는 키는 `'unreadable'` 이다 — 조용히 무시하면 오타가 「자격 없음」으로 둔갑하고,
 * 그 둘은 요구하는 행동이 다르다. ⛔ 그렇다고 **판정 실패**(exit 2)도 아니다: 핸들은
 * 판정의 **대상**이 아니라 과금 상태라, 깨진 핸들 하나로 저장소 전체의 수를 지우지 않는다.
 */
export function parseHandle(text: string): EntitlementHandle | 'unreadable' {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return 'unreadable';
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'unreadable';
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== ENTITLEMENT.handleKey) return 'unreadable';
  const value = (raw as Record<string, unknown>)[ENTITLEMENT.handleKey];
  if (typeof value !== 'string' || value.trim() === '') return 'unreadable';
  return { activationId: value };
}

/* ─────────────────── 고지의 정본 — **문장이 아니라 사실이다** ─────────────────── */

/**
 * ⭐⭐ **왜 정본이 문장에서 사실로 내려왔는가.**
 *
 * 그전까지 이 모듈이 낸 것은 **완성된 영문 문장**이었고 두 표면(측정 명령 · 페이지)이 그
 * 반환을 **축자로** 들었다 — 그 꼴의 요점은 「두 표면이 **같은 한 문장**을 낸다」였고, 그때
 * 받을 수 있는 단정이 그것뿐이었다(페이지의 화면 문구가 아직 코드에 박혀 있었다).
 *
 * ⛔ **그 꼴은 로케일이 둘이 되는 날 설 수 없다.** 페이지가 ko 정본 · en 번역으로 서면
 * 「같은 한 문장」은 ⑴ 한국어 화면에 영문 한 줄을 세우거나 ⑵ 로케일마다 갈라진다 — 둘 다
 * 거짓이다. ⇒ 정본이 내는 것을 **사실**로 내린다: 상태 · 사유 · 만기일 · 남은 날 ·
 * 넘겼는가 · 전환 경로. **문장은 표면마다, 로케일마다 한 파일**이 짓는다.
 *
 * ⭐ **그래서 바이트 동일성이 걸리는 자리가 옮겨간다** — 문장에서 **사실**로. 두 표면이
 * 같은 사실에서 그리면 ⑴ 어느 표면도 날짜를 **다시 세지 않고** ⑵ 침묵할지 말할지를 사실
 * 하나가 결정하고 ⑶ 로케일이 늘어도 그 둘이 움직이지 않는다. 페이지 패키지의 AC5 가 그
 * 셋을 문다 — 두 표면이 다 있는 자리에서만 받을 수 있는 단정이라 여기서는 흉내가 된다.
 *
 * ⛔ **세는 손이 둘이 되지 않는다.** 경계값(만기 **당일**은 아직 자격이다)은 `expiry.ts` 의
 * `isPastDate` 하나가 쥐고, 그 술어를 자격에서 부르는 자리는 `entitlementNotice` 하나다.
 * 두 곳에서 각자 세면 당일이 한쪽에서만 포함이 되고, 그러면 **같은 자격이 표면에 따라**
 * 끝났다/안 끝났다가 된다 — 이 제품이 파는 결함의 모양 그대로다.
 */

/**
 * 만기의 사실 — **넷이 함께 있거나 함께 없다.**
 *
 * 만기가 없는 자격에는 셀 것이 없어서 `EntitlementNotice.expiry` 가 `null` 이다.
 * ⛔ 「만기 없음」을 `daysLeft: 0` 으로 적지 않는다 — 그 0 은 「**마지막 날이다**」의 자리고
 * (`daysUntil` 산문), 두 뜻이 같은 값을 쓰면 고지가 거짓말을 한다.
 */
export interface ExpiryFact {
  /** 만기일(`YYYY-MM-DD`) — 「이 날까지」다(포함). */
  readonly expires: string;
  /** 남은 날 — 당일 0, 넘겼으면 **음수 그대로**다. ⭐ 접는 자리는 **문장**이다. */
  readonly daysLeft: number;
  /** 넘겼는가 — 가름은 `isPastDate` 하나다. */
  readonly pastExpiry: boolean;
  /** 센 기준일 — **봉투의 UTC 날짜**다(「오늘」을 읽지 않았다). */
  readonly onDate: string;
}

/**
 * 사실 중 **날짜를 세지 않는** 부분 — 자격의 상태와 사유.
 *
 * ⭐ `'unasked'` 는 **생략이 아니라 사실**이다. 「이 표면은 자격을 보지 않았다」가
 * `Entitlement` 쪽에서는 `undefined` 로 사는데(기본값을 두면 거짓 선언이라서), 고지의
 * 사실은 그것을 **이름으로** 들고 온다: 생략은 조용하고, 조용한 것은 화면에서 사라진다.
 *
 * ⚠️ 이 모양이 `describeEntitlement` 와 `entitlementNotice` 의 **공통 유도**다 — 자격 줄들은
 * 만기를 세지 않으므로 기준일 없이도 설 수 있고, 그래서 둘이 같은 유도를 나눠 쓴다.
 */
export type NoticeFacts =
  | { readonly state: 'unasked' | 'unwired' | 'entitled'; readonly reason: null; readonly detail: null }
  | { readonly state: 'absent'; readonly reason: ReasonCode; readonly detail: EntitlementDetail };

/**
 * 고지 한 건의 사실 전부 — **문장 0 줄**이다.
 *
 * ⚠️ `convertPath` 는 `CHECKOUT_PATH` 의 **값**이다(사본이 아니라 그 상수 자신이 온다).
 * 필드 이름이 그 상수의 이름과 다른 것은 고집이고 근거가 둘이다: ⑴ 고지가 고객에게 요구하는
 * **행동**이 「전환」이라(문장 축자 「convert in this same tool」) 이름은 벤더의 화면이 아니라
 * 그 행동을 가리킨다 ⑵ 페이지의 공개 경계 가드가 **화면 코드에서 그 낱말을 금칙으로** 쥐고
 * 있어서(배선이 없으면 끊길 것도 없다) 사실이 그 낱말을 들고 가면 읽는 순간 빨갛다.
 */
export type EntitlementNotice = NoticeFacts & {
  readonly expiry: ExpiryFact | null;
  readonly convertPath: string;
};

/** 날짜를 세지 않는 부분 — `entitlementNotice` 와 `describeEntitlement` 가 **같이** 쓴다. */
const noticeFactsOf = (entitlement: Entitlement | undefined): NoticeFacts =>
  entitlement === undefined
    ? { state: 'unasked', reason: null, detail: null }
    : entitlement.state === 'absent'
      ? { state: 'absent', reason: DETAIL_REASONS[entitlement.detail], detail: entitlement.detail }
      : { state: entitlement.state, reason: null, detail: null };

/**
 * 만기의 사실 — **세는 자리가 여기 하나다.**
 *
 * 물은 적이 없는 표면(`undefined`)과 물을 길이 없는 빌드(`unwired`)에는 만기가 없다.
 * ⭐ 넘긴 자격(`absent` · `past-expiry`)에는 **있다** — 「없다」이면서 만기일이 사실이고, 그
 * 날짜를 버리면 고지가 **언제 끝났는지**를 말할 수 없다.
 */
const expiryFactOf = (entitlement: Entitlement | undefined, onDate: string): ExpiryFact | null => {
  const expires = entitlement === undefined || entitlement.state === 'unwired' ? null : entitlement.expires;
  if (expires === null) return null;
  // 만기 당일은 0 이고 **아직 자격이 있다** — 가름은 `isPastDate` 하나가 쥔다.
  return { expires, daysLeft: daysUntil(expires, onDate), pastExpiry: isPastDate(expires, onDate), onDate };
};

/**
 * **고지의 사실** — 두 표면이 이것을 받아 각자 문장을 그린다.
 *
 * ⭐⭐ **고지는 제품이 한다.** ⛔ 벤더 메일은 기각이다 — 벤더 쪽 수신 주소가 optional 이라
 * 도달이 미보장이고, 도달하지 않은 고지는 고지가 아니다. ⛔ 무고지도 기각이다 — 그러면
 * **조용히 수가 사라진다.** 남는 자리는 하나다: 고객이 **쓰는 그 도구**가 말한다.
 *
 * ⭐ 그리고 **간극이 기능이다** — 만기 뒤 전환 전까지 고객이 보는 「칸 전부 미판정 + 분모」가
 * 압력 그 자체이고 정직하다. 그 압력을 숫자로 접지 않는다: ⛔ 점수·등급·백분율 0.
 *
 * @param onDate 봉투의 **UTC 날짜**(`utcDateOf(measuredAt)`) — 「오늘」을 읽지 않는다: 지금을
 *   보는 손은 이 모듈에 없고(판정기 모듈은 시계를 쥐지 않는다), 봉투가 준 날짜로만 센다.
 *   그래서 같은 봉투는 **어느 표면에서 몇 번 그려도 같은 사실**을 낸다.
 */
export const entitlementNotice = (entitlement: Entitlement | undefined, onDate: string): EntitlementNotice => ({
  ...noticeFactsOf(entitlement),
  expiry: expiryFactOf(entitlement, onDate),
  convertPath: CHECKOUT_PATH,
});

/* ──────────────── 측정 명령의 영문 문장 — 사실에서 **유도된다** ──────────────── */

/**
 * 자격을 말하는 줄들 — 자격이 있으면 **빈 목록**이다(없는 사실을 적지 않는다).
 *
 * ⚠️ 이 줄들은 봉투의 정직성 줄 옆에 선다 — 위반처럼 읽히면 안 되고, 위반 수도 늘지
 * 않는다. 그리고 **재활성화를 스스로 하지 않는다**: 제안까지가 도구의 몫이다 — 자동
 * 재활성화는 고객 모르게 자격 하나를 소비한다.
 */
export const describeEntitlement = (entitlement: Entitlement | undefined): string[] =>
  entitlementSaid(noticeFactsOf(entitlement));

/**
 * 자격 줄들의 **영문 자구** — 사실의 「날짜를 세지 않는 부분」만 읽는다.
 *
 * ⭐ 그래서 기준일을 받지 않는다 — 이 줄들에는 센 수가 하나도 없고, 받으면 「받았으나 쓰지
 * 않는 인자」가 되어 어느 손이 세는지가 흐려진다. 세는 손은 `entitlementNotice` 하나다.
 */
function entitlementSaid(facts: NoticeFacts): string[] {
  if (facts.state === 'unwired') {
    // 막지 않는 것을 **말한다** — 조용한 통과는 「자격을 물었고 통과했다」로 읽힌다.
    return [
      '  ⓘ entitlement: not asked — this build of the verifier has no issuing organization yet',
      '    nothing is gated, and these numbers were never asked to prove an entitlement',
    ];
  }
  // 자격이 있거나(`entitled`) 이 표면이 묻지 않았으면(`unasked`) 자격 줄은 0 이다 —
  // 없는 사실을 적지 않는다. ⚠️ 음성으로 거르는 것은 **남는 갈래가 하나**임을 타입이
  // 보장하기 때문이다: 사유가 늘면 `NoticeFacts` 가 그 자리에서 이 함수를 깨뜨린다.
  if (facts.state !== 'absent') return [];
  return [
    `  ⓘ entitlement: unjudged (${facts.reason}) — this is not red, and it is not a violation count`,
    `    ${DETAIL_ACTIONS[facts.detail]}`,
    '    the cells below still show their denominator — what is missing is the numbers, not the shape',
  ];
}

/**
 * **측정 명령이 찍는 만기 줄들** — 만기가 없으면 빈 목록이다(없는 사실을 적지 않는다).
 *
 * ⭐ **넘긴 뒤에도 말한다** — 그때 `describeEntitlement` 가 「미판정 — 자격 없음」을 내고
 * 이 함수가 만기일과 전환 링크를 내므로, 두 목록을 이어 붙인 보고에는 **「무엇이 없는가」와
 * 「무엇을 하면 되는가」가 한 자리에** 있다. 그 사이를 벌리지 않는 것이 두 표면의 규율이고,
 * 이어 붙이는 **순서**가 그 규율의 전부다(측정 명령도 페이지도 같은 순서로 잇는다).
 *
 * ⚠️ **왜 이것이 사실의 얇은 겉면인가** — 고지가 말하는 것은 `entitlementNotice` 가 쥐고,
 * 여기 남은 것은 **영문 자구**뿐이다. 페이지는 같은 사실을 받아 ko·en 카탈로그로 그린다.
 *
 * @param onDate 봉투의 **UTC 날짜**(`utcDateOf(measuredAt)`) — 세는 자리는 사실 하나다.
 */
export const describeExpiry = (entitlement: Entitlement | undefined, onDate: string): string[] =>
  expirySaid(entitlementNotice(entitlement, onDate));

/**
 * 만기 줄들의 **영문 자구** — ⭐ **센 것은 사실이 쥐고 있다**: 여기가 하는 일은 ⑴ 넘긴
 * 쪽과 남은 쪽 중 어느 문장인지를 사실의 `pastExpiry` 에서 **받아** 고르고 ⑵ 음수인 남은
 * 날을 「며칠 전」으로 **접는** 것뿐이다. 접는 자리가 문장인 것이 `daysUntil` 산문 축자다.
 */
function expirySaid(notice: EntitlementNotice): string[] {
  const { expiry, convertPath } = notice;
  // 만기가 없으면 빈 목록이다 — 없는 사실을 적지 않는다.
  if (expiry === null) return [];
  const { expires, daysLeft, pastExpiry, onDate } = expiry;
  return pastExpiry
    ? [
        `  ⓘ entitlement expired ${expires} — ${-daysLeft} day(s) ago as of ${onDate} (UTC)`,
        `    convert in this same tool to get the numbers back: ${convertPath}`,
      ]
    : [
        `  ⓘ entitlement expires ${expires} — ${daysLeft} day(s) left as of ${onDate} (UTC)`,
        `    convert in this same tool before then: ${convertPath}`,
      ];
}
