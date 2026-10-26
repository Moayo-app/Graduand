/**
 * 자격을 **묻는** 손 — 벤더의 무인증 검증을 부르고, 답을 `Entitlement` 하나로 접는다.
 *
 * ⭐⭐ **네트워크가 여기 사는 이유**: 판정은 순수 함수라(`judge.ts`) 자격을 물을 수 없고,
 * 두 표면(고객 CI · 브라우저)이 **같은 판정 함수**를 쓰므로 묻는 자리는 판정 **밖**이어야
 * 한다. 그 경계가 호스트다 — 스냅샷을 만드는 손(`github.ts`·`workspace.ts`)과 같은 자리고,
 * 판정은 그 결과를 **받는다.**
 *
 * ⭕ **무인증인 근거**: 이 엔드포인트의 스키마에 `security` 키가 **아예 없다.** 그래서
 * 공개 모듈이 비밀을 하나도 품지 않고 벤더에게 물을 수 있다 — 고객의 키는 고객의 환경에만
 * 있고(`ENTITLEMENT.keyEnv`), 이 모듈은 환경을 **읽지도 않는다**(읽는 손은 측정 명령이다).
 *
 * ⚠️ **판을 못 박아 보낸다** — 헤더를 생략하면 벤더가 고른 판을 받고, 공개된 스키마는
 * **최고령** 판을 준다. 「버전을 선언하지 않은 의존은 조용히 갈라진다」를 자기에게 적용하는
 * 자리라, 헤더는 선택이 아니다.
 *
 * ⛔ **재활성화를 하지 않는다** — 핸들이 낡았으면 사유와 함께 **제안**까지가 이 도구의
 * 몫이다(`describeEntitlement`). 자동 재활성화는 고객 모르게 자격 하나를 소비한다.
 */

import {
  ENTITLEMENT,
  parseHandle,
  type Entitlement,
  type EntitlementDetail,
} from '../entitlement.ts';
import { isPastDate, utcDateOf } from '../expiry.ts';

/**
 * 묻기를 포기하는 시각 — 답을 기다리다 **잡이 멈추는 것**이 「네트워크를 열어라」보다 나쁘다.
 * 끊긴 것은 답을 못 받은 것이라 `no-answer` 로 접힌다(「사라」가 아니다).
 */
const VALIDATE_TIMEOUT_MS = 10_000;

/**
 * 호스트가 주는 세 손 — 파일 하나 · 환경 하나 · 네트워크 하나. 셋 다 **주입된다**:
 * 테스트가 네트워크를 타지 않는 것이 이 경계의 값이고(`outcome.ts` 의 `now?.()` 와 같은
 * 꼴), 그래서 이 모듈에 `node:fs` 도 `process` 도 없다.
 */
export interface EntitlementIo {
  /** 커밋된 핸들 파일의 내용. **없으면 null**. 못 읽으면 던진다 — 조용히 null 이 아니다. */
  readHandle(): string | null;
  /** 라이선스 키. 환경에 없으면 null. ⛔ 커밋되는 자리에서 읽지 않는다. */
  readKey(): string | null;
  fetch: typeof fetch;
}

const absent = (detail: EntitlementDetail, expires: string | null = null): Entitlement => ({
  state: 'absent',
  detail,
  expires,
});

/**
 * 벤더가 적은 만기 — `YYYY-MM-DD` 하나로 자른다(⛔ 시각은 버린다: 만기는 날짜고, 자르는
 * 자리는 UTC 하나다 — 그러지 않으면 같은 자격이 측정한 기계의 시간대에 따라 다른 날 끝난다).
 *
 * 셋을 가른다: 적지 않았으면 **만기 없는 자격**(`null`), 읽을 수 있으면 그 날짜,
 * 모양을 모르면 `'unreadable'` 이다. ⛔ 모르는 모양을 「만기 없음」으로 읽지 않는다 —
 * 그러면 읽지 못한 만기가 **영구 자격**으로 둔갑하고, 그 수는 아무 날에도 끝나지 않는다.
 */
function readExpiry(raw: unknown): string | null | 'unreadable' {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'unreadable';
  try {
    return utcDateOf(raw);
  } catch {
    return 'unreadable';
  }
}

/**
 * 자격 하나를 푼다 — 판정의 **인자**가 되는 그 값이다.
 *
 * 순서가 뜻을 만든다: 저장소와 환경이 **양쪽 다** 비면 「아직 사지 않았다」(「사라」)이고,
 * 한쪽만 비면 「물을 수 없었다」(「설정을 고쳐라」)다. ⛔ 둘을 뭉치면 돈 낸 고객이 키를
 * 잊은 CI 에서 「자격 없음」을 받는다.
 *
 * @param onDate 봉투의 **UTC 날짜**(`utcDateOf(measuredAt)`). ⛔ 이 모듈이 시계를 읽지
 *   않는다 — 읽으면 같은 측정을 두 번 풀 때 다른 자격이 나올 수 있고, 그 둘 다 「지금」을
 *   근거로 댄다. 날짜가 **인자**인 것이 「봉투가 만기를 판정한다」의 집행이다.
 */
export async function resolveEntitlement(io: EntitlementIo, onDate: string): Promise<Entitlement> {
  let handleText: string | null;
  try {
    handleText = io.readHandle();
  } catch {
    return absent('handle-unreadable');
  }
  const key = io.readKey();

  // ⭐ **물을 수 있는가를 고객의 입력 뒤에 본다.** 발행 조직 id 가 없으면 벤더에게 물을
  // 길이 없다. 고객이 **아무것도 두지 않았다면** 물을 것도 없었으니 막지 않고(`unwired`),
  // 고객이 **자기 몫을 했다면** 막되 사유는 우리를 가리킨다(`vendor-unconfigured`) —
  // ⛔ 우리 쪽 미비를 고객의 「자격 없음」으로 적지 않고, ⛔ 고객의 설정을 우리 미비로
  // 덮어 조용히 통과시키지도 않는다.
  if (ENTITLEMENT.organizationId === null) {
    return handleText === null && key === null ? { state: 'unwired' } : absent('vendor-unconfigured');
  }

  if (handleText === null) return absent(key === null ? 'not-configured' : 'handle-absent');
  const handle = parseHandle(handleText);
  if (handle === 'unreadable') return absent('handle-unreadable');
  if (key === null) return absent('key-absent');

  let response: Response;
  try {
    response = await io.fetch(ENTITLEMENT.validateUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [ENTITLEMENT.versionHeader]: ENTITLEMENT.apiVersion,
      },
      body: JSON.stringify({
        key,
        organization_id: ENTITLEMENT.organizationId,
        [ENTITLEMENT.handleKey]: handle.activationId,
      }),
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
    });
  } catch {
    // 답을 받지 못했다 — 끊김 · 시각 초과. 이것이 「없다」로 접히면 안 된다.
    return absent('no-answer');
  }

  // ⭐ **404 는 서버가 답한 것이다** — 없음 · 회수 · 만료 · 활성화 불일치가 전부 여기 온다.
  if (response.status === 404) return absent('vendor-said-no');
  // 5xx 는 벤더가 서 있지 않은 것이라 「답을 못 받았다」와 같은 자리다.
  if (response.status >= 500) return absent('no-answer');
  if (!response.ok) return absent('answer-unreadable');

  let expires: string | null | 'unreadable';
  try {
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return absent('answer-unreadable');
    expires = readExpiry((body as Record<string, unknown>)[ENTITLEMENT.expiresKey]);
  } catch {
    // ⛔ 모르는 모양을 「없다」로 읽지 않는다 — 읽지 못한 답은 답이 아니다.
    return absent('answer-unreadable');
  }
  if (expires === 'unreadable') return absent('answer-unreadable');
  // ⭐⭐ **만기를 판정하는 것은 봉투다** — 그 판정이 여기(호스트)에 있는 이유는 판정 함수가
  // 순수하다는 것이다(`judge.ts`): 만기를 판정 **안**에서 보면 같은 커밋이 어제는 통과
  // 오늘은 미판정이 되어 「같은 입력에 같은 바이트」가 그 자리에서 깨진다. 여기서는
  // 날짜가 **입력**(`onDate`)이고, 나온 자격 하나가 다시 판정의 입력이다 — 시야와 같은 꼴이다.
  // ⭕ 그래서 「새 기전 0」이다: 세는 손은 면제의 만기와 **같은 술어** 하나다.
  if (expires !== null && isPastDate(expires, onDate)) return absent('past-expiry', expires);
  return { state: 'entitled', expires };
}
