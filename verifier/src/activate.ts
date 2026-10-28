/**
 * 활성화 — **구독과 자격 사이의 한 걸음.**
 *
 * ⭐⭐ **왜 걸음이 하나 더 있는가.** 고객이 구독하면 받는 것은 **키**이고, 판정기가 묻는
 * 것은 **핸들**이다(`ENTITLEMENT.handleKey`). 그 둘을 잇는 것이 벤더의 활성화 한 번이고,
 * 그 전까지 산 고객의 저장소는 「키는 있는데 핸들이 없다」(`handle-absent`)에 앉는다 —
 * 돈을 내고도 수를 못 받는 자리다. 이 모듈이 그 자리를 없앤다.
 *
 * ⭐ **키와 핸들의 자리가 다른 것이 설계다** — 키는 비밀이라 환경에서 오고(커밋되는 비밀은
 * 비밀이 아니다), 핸들은 **커밋돼야** CI 가 쓴다. 벤더의 검증이 둘을 **함께** 요구하므로
 * 핸들만으로는 아무것도 할 수 없고, 그래서 커밋해도 안전하다.
 *
 * ⛔ **자동으로 활성화하지 않는다.** 활성화는 고객이 산 **자리 하나를 쓰는 일**이라
 * (키마다 한도가 있다) 판정이 지나는 길에 조용히 일어나면 안 된다 — `hosts/entitlement.ts`
 * 가 축자로 「재활성화를 하지 않는다: 자동 재활성화는 고객 모르게 자격 하나를 소비한다」고
 * 적어 둔 그 규율이고, 이 모듈은 그것을 **명령 하나**로 집행한다: 고객이 쳐야 돈다.
 *
 * ⛔ **덮어쓰지 않는다** — 핸들이 이미 있으면 멈추고 말한다. 덮어쓰면 자리를 **또** 쓰고,
 * 앞의 자리는 고객이 회수하지도 못한 채 남는다(`scaffold.ts` 의 「있으면 멈춘다」와 같은
 * 규율이고, 여기서는 비용이 돈이다).
 *
 * ⛔ **node 를 import 하지 않는다** — 「어디에 · 있는가 · 쓴다」 셋은 호스트의 의미라
 * `HandleIo` 로 주입받는다(`ScaffoldIo` 와 같은 꼴). 네트워크는 여기 한 줄도 없다:
 * 벤더를 부르는 손은 `hosts/entitlement.ts` 다.
 */

import { ENTITLEMENT } from './entitlement.ts';

/** 호스트가 쥐는 셋 — 자리 · 실재 · 쓰기. `ScaffoldIo` 와 같은 모양이고 **자리가 다르다**. */
export interface HandleIo {
  pathIn(root: string): string;
  exists(path: string): boolean;
  /** @throws 쓰지 못하면 던진다 — 조용한 실패는 「썼다」로 둔갑한다. */
  write(path: string, text: string): void;
}

/**
 * 핸들 파일의 **바이트** — ⭐ 키 **하나**다. 넓히지 않는 사유는 `parseHandle` 의 그것과
 * 같다: 과금 상태가 늘어나는 자리를 만들면 선언을 넓히지 않은 이유가 지워진다.
 *
 * ⚠️ 이 함수가 낸 바이트는 `parseHandle` 을 **반드시 통과해야 한다** — 짓는 손과 읽는 손이
 * 갈라지면 우리가 쓴 파일을 우리가 못 읽는다. 그 왕복을 AC 가 문다.
 */
export const composeHandle = (activationId: string): string =>
  `${JSON.stringify({ [ENTITLEMENT.handleKey]: activationId }, null, 2)}\n`;

export type HandleWrite =
  /** 썼다 — `path` 가 쓰인 자리이고, 고객이 **커밋할** 파일이다. */
  | { kind: 'written'; path: string }
  /** 이미 핸들이 있다 — 쓰지 않았다. ⛔ 덮어쓰면 자리를 또 쓴다. */
  | { kind: 'already-activated'; path: string }
  /** 쓰려 했고 실패했다 — 쓰지 않았다. ⚠️ 벤더 쪽 자리는 **이미 쓰였다**(아래 산문). */
  | { kind: 'write-failed'; path: string; message: string };

export function writeHandle(root: string, io: HandleIo, activationId: string): HandleWrite {
  const path = io.pathIn(root);
  if (io.exists(path)) return { kind: 'already-activated', path };
  try {
    io.write(path, composeHandle(activationId));
  } catch (e) {
    return { kind: 'write-failed', path, message: (e as Error).message };
  }
  return { kind: 'written', path };
}

/**
 * 활성화가 **거절된 자리들** — ⭐ 가르는 기준은 `DETAIL_REASONS` 와 같다: 「고객에게
 * 요구하는 행동」. ⛔ 자격의 사유 코드와 **같은 어휘를 쓰지 않는다**: 저쪽은 판정의 칸에
 * 실리는 말이고 이쪽은 명령 하나의 결말이다. 섞으면 활성화 실패가 판정 결과처럼 읽힌다.
 */
export type ActivationRefusal =
  /** 환경에 키가 없다 — 살 것이 아니라 **설정**이다. */
  | 'key-absent'
  /** 이 빌드에 발행 조직 id 가 없다 — ⛔ 고객 탓이 아니다. */
  | 'vendor-unconfigured'
  /** 벤더가 **답했고 거절했다** — 키가 유효하지 않거나 자리를 다 썼다. 그 말을 그대로 싣는다. */
  | 'vendor-said-no'
  /** 답을 받지 못했다 — 끊김 · 시각 초과 · 5xx. ⛔ 「없다」가 아니다. */
  | 'no-answer'
  /** 답은 받았으나 활성화 id 를 읽지 못했다. ⛔ 모르는 모양을 「됐다」로 읽지 않는다. */
  | 'answer-unreadable';

/**
 * 거절마다 **요구하는 행동** — ⭐ 사유를 적지 않는 거절은 이 제품이 팔지 않는 물건이다.
 * ⛔ 이름 셋(핸들 파일 · 키 환경변수)을 여기 **축자로 적지 않는다**: 상수에서 읽는다.
 */
export const ACTIVATION_ACTIONS: Record<ActivationRefusal, string> = {
  'key-absent': `구독하신 뒤 받은 라이선스 키를 ${ENTITLEMENT.keyEnv} 에 넣고 다시 돌려라 — 이 명령은 그 환경변수 하나만 읽는다`,
  'vendor-unconfigured': '이 빌드에는 발행 조직 id 가 없어 물을 길이 없었다 — 당신 탓이 아니다',
  'vendor-said-no': '벤더가 거절했다 — 키가 맞는지, 그리고 그 키의 활성화 자리가 남았는지 결제 창구에서 확인하라',
  'no-answer': '벤더가 답하지 않았다 — 네트워크를 열고 다시 돌리거나, 잠시 뒤 다시 돌려라',
  'answer-unreadable': '벤더가 이 판이 모르는 모양으로 답했다 — 읽지 못한 답을 「됐다」로 읽지 않았다',
};

/** 활성화 한 번의 결말 — 벤더 쪽의 사실이고, 파일을 쓰는 것은 그 **뒤**다. */
export type Activation =
  | { state: 'activated'; activationId: string }
  /** `said` 는 **벤더가 한 말**이다(읽히면). ⛔ 우리가 지어내지 않는다. */
  | { state: 'refused'; detail: ActivationRefusal; said: string | null };

/**
 * 말하는 것 — 된 것 · 안 된 것 · 다음에 할 것. `formatInitOutcome` 과 같은 규율이다.
 *
 * ⚠️⚠️ **벤더 쪽은 됐는데 파일을 못 쓴 자리**가 이 함수의 어려운 칸이다 — 그때 자리는
 * **이미 쓰였고** 그 사실을 삼키면 고객은 자리를 하나 잃은 줄도 모른다. ⇒ 활성화 id 를
 * **화면에 적어** 손으로 옮길 수 있게 한다. ⛔ 비밀이 아니다(핸들은 커밋되는 값이다).
 */
export function formatActivation(
  outcome: Activation,
  write: HandleWrite | null,
): { stdout: string[]; stderr: string[] } {
  if (outcome.state === 'refused') {
    return {
      stdout: [],
      stderr: [
        `❌ 활성화하지 못했다 — ${outcome.detail}`,
        `   ${ACTIVATION_ACTIONS[outcome.detail]}`,
        ...(outcome.said === null ? [] : [`   벤더가 한 말: ${outcome.said}`]),
      ],
    };
  }
  switch (write?.kind) {
    case 'written':
      return {
        stdout: [
          `✅ 활성화했다 — ${write.path} 를 썼다`,
          `   ⚠️ 이 파일을 **커밋해라** — 커밋되기 전까지 CI 는 핸들이 없는 저장소를 본다.`,
          `   ⛔ 커밋하지도 스테이징하지도 않았다 — 이 명령은 git 을 건드리지 않는다.`,
          `   ⛔ 키는 이 파일에 없다 — 키는 ${ENTITLEMENT.keyEnv} 에 그대로 두고, 잡의 비밀에 넣어라.`,
          `   ⚠️ 활성화는 그 키의 자리 하나를 쓴다 — 저장소마다 한 번이고, 다시 돌려도 덮어쓰지 않는다.`,
        ],
        stderr: [],
      };
    case 'already-activated':
      return {
        stdout: [],
        stderr: [
          `❌ 핸들이 이미 있다 — 덮어쓰지 않았다: ${write.path}`,
          '   덮어쓰면 자리를 **또** 쓰고, 앞의 자리는 회수되지 않은 채 남는다.',
          `   ⚠️ 벤더 쪽 자리는 **이 실행이 이미 썼다** — 쓰려던 활성화 id: ${outcome.activationId}`,
          '   바꿀 생각이면 그 파일을 치운 뒤 이 id 를 손으로 적어라.',
        ],
      };
    case 'write-failed':
      return {
        stdout: [],
        stderr: [
          `❌ 핸들을 쓰지 못했다 — ${write.path}: ${write.message}`,
          '   쓰지 못한 것을 썼다고 말하지 않는다.',
          `   ⚠️ 벤더 쪽 자리는 **이미 쓰였다** — 활성화 id: ${outcome.activationId}`,
          `   그 값을 ${ENTITLEMENT.file} 에 키 "${ENTITLEMENT.handleKey}" 하나로 손수 적으면 같은 자리다.`,
        ],
      };
    // 벤더는 됐는데 쓰기를 **시도조차 하지 않은** 호출 — 부르는 쪽의 결함이라 조용히 두지 않는다.
    default:
      return {
        stdout: [],
        stderr: [
          `❌ 활성화는 됐는데 파일을 쓰지 않았다 — 활성화 id: ${outcome.activationId}`,
          '   부르는 쪽이 쓰기를 건너뛰었다 — 이 결말은 보고되지 조용히 통과하지 않는다.',
        ],
      };
  }
}

/** 0 = 활성화하고 썼다 · 2 = 그 밖 전부. ⛔ 1 은 쓰지 않는다 — 그 자리는 「위반 ≥ 1」의 몫이다. */
export const activateExitCode = (outcome: Activation, write: HandleWrite | null): 0 | 2 =>
  outcome.state === 'activated' && write?.kind === 'written' ? 0 : 2;
