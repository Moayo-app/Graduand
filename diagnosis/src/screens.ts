/**
 * 판정 불가 화면들 — 「위반 0」으로 접히지 않는 상태 각각의 전용 화면.
 *
 * 공통 규율: 상태를 숨기지 않고, 대안 경로를 반드시 함께 말한다. 비공개·한도·크기는
 * 전부 같은 대안(저장소 쪽에서 도는 명령)으로 풀리고, 버전 불일치는 양쪽 판을 맞추는
 * 것으로 풀린다.
 *
 * ⭐ **문구는 이 파일에 없다** — 들어오는 것은 `Strings` 한 벌이고, 이 파일이 쥔 것은
 * 「어느 상태가 어느 화면을 받는가」와 「어느 명령을 함께 말하는가」다. 그 **갈래**가 이
 * 파일의 내용이고, 번역이 바꿀 수 없는 것도 그것이다.
 */

import type { Unjudgeable } from './outcome.ts';
import type { Strings } from './strings.ts';

/**
 * 패키지 식별자는 **확정됐다** — 이름 트랙의 선행조건이 전부 닫혔다.
 *
 * ⚠️ 상표 심사가 남아 있어 **다시 열릴 수 있는 축이 하나** 있다. 그때 이 이름은 판정기 모듈의
 * 이름 트랙을 따라간다 — 두 자리가 갈라지지 않게 한쪽만 고치지 않는다.
 */
export const CLI_COMMAND = 'npx graduand --open';
export const CLI_COMMAND_LATEST = 'npx graduand@latest --open';

export interface ScreenVM {
  title: string;
  lines: string[];
  command: string | null;
  commandCaption: string | null;
  /**
   * 선언 스캐폴드를 이 화면 **옆에** 남길 것인가.
   *
   * ⭐⭐ **갈래이지 문구가 아니다** — 그래서 이 파일이 쥔다(머리말 축자: 쥔 것은 「어느 상태가
   * 어느 화면을 받는가」다). 가르는 사실 하나: **고칠 자리가 고객의 선언인가.** 선언이 틀린
   * 화면에서는 스캐폴드가 곧 대안 경로이고, 명령을 든 화면들에서는 대안이 이미 명령이라
   * 스캐폴드가 **두 번째 길**이 되어 어느 쪽을 하라는 건지 흐려진다. ⛔ `error` 는 고칠
   * 자리가 우리 쪽이나 네트워크라 스캐폴드가 아무것도 풀지 않는다.
   */
  showsScaffold: boolean;
}

function waitLine(resetAt: number | null, now: Date, strings: Strings): string {
  if (resetAt === null) return strings.screen.waitUnknown;
  const minutes = Math.max(1, Math.ceil((resetAt * 1000 - now.getTime()) / 60_000));
  return strings.screen.wait(minutes, new Date(resetAt * 1000).toISOString());
}

/** 대안 경로를 함께 말하는 화면 — 명령과 그 설명은 **한 쌍**으로만 선다. */
const withCommand = (
  text: { title: string; lines: readonly string[] },
  command: string,
  strings: Strings,
): ScreenVM => ({
  title: text.title,
  lines: [...text.lines],
  command,
  commandCaption: strings.screen.commandCaption,
  showsScaffold: false,
});

/**
 * 대안 경로가 **없는** 화면 — 고칠 자리가 고객의 선언이거나 네트워크다.
 *
 * ⚠️ 그 둘이 **같은 화면 꼴을 쓰면서 다른 길을 연다** — 선언이면 스캐폴드가 그 길이고,
 * 네트워크면 아무 길도 없다. ⇒ 부르는 쪽이 그것을 **말해야** 한다(기본값을 두면 새 갈래가
 * 생기는 날 조용히 한쪽으로 접힌다).
 */
const withoutCommand = (
  text: { title: string; lines: readonly string[] },
  showsScaffold: boolean,
): ScreenVM => ({
  title: text.title,
  lines: [...text.lines],
  command: null,
  commandCaption: null,
  showsScaffold,
});

export function unjudgeableScreen(
  outcome: Unjudgeable,
  strings: Strings,
  now: () => Date = () => new Date(),
): ScreenVM {
  const screen = strings.screen;
  switch (outcome.kind) {
    case 'unreadable':
      return outcome.code === 'private-or-missing'
        ? withCommand(screen.privateOrMissing, CLI_COMMAND, strings)
        : withCommand(screen.truncated, CLI_COMMAND, strings);
    case 'rate-limited':
      return withCommand(screen.rateLimited(waitLine(outcome.resetAt, now(), strings)), CLI_COMMAND, strings);
    case 'version-mismatch':
      return withCommand(
        screen.versionMismatch(
          outcome.axis === 'fragment' ? screen.axis.fragment : screen.axis.schema,
          outcome.found,
        ),
        CLI_COMMAND_LATEST,
        strings,
      );
    case 'fragment-unreadable':
      return withCommand(screen.fragmentUnreadable, CLI_COMMAND, strings);
    case 'declaration-invalid':
      return withoutCommand(screen.declarationInvalid(outcome.problems), true);
    case 'error':
      return withoutCommand(screen.error(outcome.message), false);
  }
}
