/**
 * `--open` — 판정 결과를 **보고 페이지의 주소에 실어** 기본 브라우저를 연다.
 *
 * 이 모듈이 쥐는 것은 둘이다 — **여는 주소**와 **여는 행위**.
 *
 * ⭐ **주소는 상수다** — 루트 + fragment(`https://graduand.dev/#<요약>`), 자리는
 * `REPORT_URL_ROOT` 하나다.
 *   - ⛔ **선언(`graduand.json`)에서 읽지 않는다** — 고객이 우리 보고서 자리를 선언하는
 *     꼴이고, 닫힌 선언 스키마에 제품 운영 값이 섞인다.
 *   - ⛔ **플래그로 덮어쓰게 하지 않는다** — 판정을 남의 페이지에 띄우는 길이고, 이
 *     제품이 파는 것이 「주소가 말하는 것을 믿을 수 있는가」다.
 *   - ⚠️ 박히는 값은 **영구적**이다: 공개된 옛 판은 영원히 옛 주소를 연다. 그래서
 *     주소는 플래그가 아니라 이 상수의 몫이다.
 *
 * ⭐ **전용 경로가 아니라 루트다.** 보고 페이지 자신이 `location.hash` 를 읽어 비어
 * 있으면 입구를, 있으면 보고서를 그린다(`hashchange` 까지 듣는다). 경로를 가르면
 * 페이지가 둘이 되고, 같은 뷰모델·같은 판정기를 쓰는 둘은 사본이다. 색인될 것도
 * 늘지 않는다 — fragment 는 서버로 전송되지 않으므로 색인되는 것은 루트 하나다.
 *
 * ⭐ **여는 행위는 주입받는다.** 이 모듈은 판정 결과를 들고 있고 부작용은 경계
 * (`cli.ts`)에서 들어온다 — 같은 자리에서 `process.exit` 을 받는 모양과 같다.
 * 그래서 테스트가 「열린 주소」를 단정할 수 있다.
 *
 * ⚠️ **상한을 넘으면 열지 않는다.** 조용히 잘린 주소는 **거짓 보고서**를 그린다.
 * fragment 의 자기검증이 그 위험을 「보이는 실패」로 바꾸지만, 애초에 열지 않는 것이
 * 먼저다 — 열지 않고 이유와 **대안 경로**를 말한다.
 */

import { spawnSync } from 'node:child_process';
import { encodeFragment, RECOMMENDED_URL_MAX } from './fragment.ts';
import type { Measurement } from './schema.ts';

/** 보고 페이지의 자리 — 한 군데다. 끝의 `/` 가 루트라는 사실의 일부다. */
export const REPORT_URL_ROOT = 'https://graduand.dev/';

export const reportUrl = (fragment: string): string => `${REPORT_URL_ROOT}#${fragment}`;

/** 「주소를 연다」는 행위. 경계가 주입한다 — 실패는 던져서 말한다. */
export type Opener = (url: string) => void;

export type OpenOutcome =
  /** 열었다. `url` 이 열린 그 주소다. */
  | { kind: 'opened'; url: string }
  /** 상한을 넘었다 — 열지 않았고, 주소를 내지도 않는다(붙여넣어도 잘린다). */
  | { kind: 'too-long'; length: number }
  /** 주소는 상한 안인데 실행이 실패했다(명령 부재 · 인자 상한). */
  | { kind: 'open-failed'; url: string; why: string };

/**
 * 측정을 보고 페이지 주소로 만들어 `open` 에 넘긴다. 열지 못한 경우를 **값으로**
 * 돌려준다 — 「열었다」와 「못 열었다」가 같은 코드 경로로 지나가면 둘을 같게 말하게 된다.
 */
export async function openReport(measurement: Measurement, open: Opener): Promise<OpenOutcome> {
  const url = reportUrl(await encodeFragment(measurement));
  if (url.length > RECOMMENDED_URL_MAX) return { kind: 'too-long', length: url.length };
  try {
    open(url);
  } catch (e) {
    return { kind: 'open-failed', url, why: (e as Error).message };
  }
  return { kind: 'opened', url };
}

/**
 * 사람에게 할 말 — 주소는 stdout, 못 연 이유와 대안 경로는 stderr.
 *
 * 열린 주소를 stdout 으로도 내는 이유: 브라우저가 뜨지 않는 환경(원격 셸 · CI)에서
 * 「열었다」만 말하면 고객이 받을 것이 없다. 주소가 있으면 붙여넣을 수 있다.
 */
export function formatOpenOutcome(outcome: OpenOutcome): { stdout: string[]; stderr: string[] } {
  if (outcome.kind === 'opened') return { stdout: [outcome.url], stderr: [] };
  if (outcome.kind === 'too-long') {
    return {
      // ⛔ 주소를 내지 않는다 — 상한을 넘은 주소는 붙여넣어도 조용히 잘린다.
      stdout: [],
      stderr: [
        `⚠ not opened — the report URL would be ${outcome.length} characters, past the recommended ceiling of ${RECOMMENDED_URL_MAX}`,
        '   A silently truncated address draws a false report, so this path stops instead of guessing.',
        '   Take the measurement through a file instead: graduand --json > measurement.json',
      ],
    };
  }
  return {
    stdout: [outcome.url], // 상한 안이다 — 붙여넣으면 열린다
    stderr: [
      `⚠ could not launch a browser — ${outcome.why}`,
      '   The address above is within the ceiling: open it by hand, or use graduand --json',
    ],
  };
}

/**
 * 플랫폼별 「주소를 여는」 명령.
 *
 * ⚠️ **상한이 실측된 플랫폼은 macOS(`open`)뿐이다** — 그 경로에서 병목은 브라우저가
 * 아니라 exec 의 인자 상한이고, 권고 상한은 그 실측 천장의 작은 비율이다. 다른
 * 플랫폼의 천장은 **미측정**이라 같은 권고 상한을 쓰되, 넘는 주소를 조용히 열지
 * 않는 규율이 그 미측정분을 받는다(실패는 exec 에서 요란하게 난다).
 */
export function openCommand(platform: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', ''] };
  return { command: 'xdg-open', args: [] };
}

export class OpenFailedError extends Error {}

/**
 * 기본 브라우저를 여는 실제 행위. 런타임 의존 0 이 이 패키지의 성질이라 npm 패키지를
 * 들이지 않고 `node:child_process` 를 쓴다.
 *
 * **기다린다** — `open`·`xdg-open`·`start` 는 브라우저에 주소를 넘기고 바로 돌아오므로
 * 기다리는 비용이 없고, 기다리지 않으면 **열리지 않았는데 열렸다고 말하게 된다**.
 * 인자 상한 초과(`E2BIG`)·명령 부재가 여기서 값으로 잡힌다.
 */
export const systemOpener: Opener = (url) => {
  const { command, args } = openCommand(process.platform);
  const r = spawnSync(command, [...args, url], { stdio: 'ignore' });
  if (r.error) throw new OpenFailedError(`${command}: ${r.error.message}`);
  if (r.status !== 0) {
    throw new OpenFailedError(`${command} exited with ${r.status === null ? `signal ${r.signal}` : r.status}`);
  }
};
