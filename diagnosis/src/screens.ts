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

/** 패키지 식별자는 잠정이다 — 판정기 모듈의 이름 트랙을 따라간다. */
export const CLI_COMMAND = 'npx graduand --open';
export const CLI_COMMAND_LATEST = 'npx graduand@latest --open';

export interface ScreenVM {
  title: string;
  lines: string[];
  command: string | null;
  commandCaption: string | null;
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
});

/** 대안 경로가 **없는** 화면 — 고칠 자리가 고객의 선언이거나 네트워크다. */
const withoutCommand = (text: { title: string; lines: readonly string[] }): ScreenVM => ({
  title: text.title,
  lines: [...text.lines],
  command: null,
  commandCaption: null,
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
      return withoutCommand(screen.declarationInvalid(outcome.problems));
    case 'error':
      return withoutCommand(screen.error(outcome.message));
  }
}
