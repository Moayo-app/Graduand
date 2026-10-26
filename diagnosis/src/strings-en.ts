/**
 * en — **번역**이다. 정본은 `strings-ko.ts` 고, 여기서 뜻을 더하거나 빼지 않는다.
 *
 * ⭐ 번역이 **빠뜨릴 수 없다** — 이 객체가 `Strings` 를 구현하므로 키 하나가 없거나 인자
 * 모양이 어긋나면 타입 검사가 막는다. 그 집행이 테스트가 아니라 `tsc` 에 있는 이유는,
 * 테스트만으로 물으면 그 사이 타입 검사가 초록이고 이 저장소가 이미 그 공백에서 샜다.
 *
 * ⚠️ 번역의 규율 셋 — 뜻이 갈라지는 자리가 늘 여기다:
 *   ⑴ **「미판정」은 unjudged 다** — ⛔ unknown · n/a · skipped 가 아니다: 그 셋은 전부
 *      「보지 않았다」로 읽히는데, 미판정은 **보았고 수를 내지 않았다**는 판정이다.
 *   ⑵ **수를 접는 말을 들이지 않는다** — 그 금칙의 목록은 `boundary.test.ts` 가 든다.
 *      ⚠️ 여기 다시 적으면 **이 파일이 그 가드에 걸린다**(실제로 걸렸다) — 사본을 만들지
 *      않는다는 규율이 금칙 목록 자신에게도 듣는다는 뜻이다.
 *   ⑶ **낫표(「」)는 영문 인용부호로** 옮긴다 — 자구만 바뀌고 강조의 자리는 그대로다.
 */

import { ENTITLEMENT } from '../../verifier/src/index.ts';
import type { EntitlementDetail } from '../../verifier/src/index.ts';
import type { Strings } from './strings.ts';

/**
 * 사유마다 **요구하는 행동** 하나 — 정본(ko)과 같은 자리를 채운다.
 *
 * ⚠️ **측정 명령의 영문 줄들과 자구가 같지 않다.** 같아 보이게 맞추고 싶어지는 자리인데,
 * 두 표면이 맞춰야 하는 것은 **사실**이고 자구가 아니다: 터미널의 줄은 글리프와 들여쓰기로
 * 모양을 만들고(`  ⓘ ` · 네 칸), 화면의 줄은 문장 하나로 선다. 자구를 베껴 오면 사본이
 * 하나 늘고, 그 사본은 한쪽만 고쳐지는 날 조용히 갈라진다.
 */
const ACTION: Readonly<Record<EntitlementDetail, string>> = {
  'not-configured': `No entitlement is set up yet. Buy one, commit its handle to ${ENTITLEMENT.file}, and put the key in ${ENTITLEMENT.keyEnv}.`,
  'vendor-said-no': `The vendor answered that this key is not valid for this activation. Buy or renew one, then update ${ENTITLEMENT.file}.`,
  'past-expiry': 'This entitlement is past its expiry. Converting brings the numbers back.',
  'handle-absent': `${ENTITLEMENT.keyEnv} is set, but ${ENTITLEMENT.file} is not here. Activate first, then commit the handle you get back.`,
  'handle-unreadable': `${ENTITLEMENT.file} could not be read. That file holds exactly one key, "${ENTITLEMENT.handleKey}".`,
  'key-absent': `${ENTITLEMENT.file} is committed, but ${ENTITLEMENT.keyEnv} is not in this environment. Put the key in this job's secrets.`,
  'vendor-unconfigured':
    'This build of the verifier has no issuing organization yet. Nothing could be asked, and that is not your fault.',
  'no-answer': 'The vendor did not answer. Open the network for this job, or run it again once the network is back.',
  'answer-unreadable':
    'The vendor answered in a shape this verifier does not know. An unknown answer is not a "no".',
};

export const en: Strings = {
  locale: 'en',

  status: {
    pass: 'pass',
    violation: 'violation',
    unjudged: 'unjudged',
  },

  reason: {
    'no-declaration':
      'reason no-declaration — the denominator of this judgment was never declared. An absent declaration is neither a violation nor a pass.',
    'collection-truncated':
      'reason collection-truncated — the input could not be read in full. No numbers are produced on top of a truncated collection.',
    'no-adapter':
      'reason no-adapter — no adapter is declared, so the code was never read. The pinned values still stand as the denominator, but "code == pinned" cannot be asked.',
    'single-repo-surface':
      'reason single-repo-surface — "pinned == canon" belongs to a surface that sees every repository. This surface sees one, so it does not judge.',
    'no-verifier':
      'reason no-verifier — the rule was admitted, but no verifier is declared for that cell. A rule that cannot be run is not "0 violations"; it is a judgment that could not run.',
    'declared-divergence':
      'reason declared-divergence — this value was declared, with a stated reason, to have its canon here. It drops out of "pinned == canon" only; "code == pinned" is still judged.',
    'declared-exemption':
      'reason declared-exemption — this rule was declared exempt, with a stated reason and an expiry. The cell stays and the denominator does not shrink.',
    'no-entitlement':
      'reason no-entitlement — there is no entitlement. The denominator (the shape of the cells) is still shown; only the numbers are withheld.',
    'entitlement-unverifiable':
      'reason entitlement-unverifiable — the entitlement could not be checked (no answer came back). This is not the same cell as "no entitlement".',
  },

  report: {
    title: 'Judgment report',
    label: {
      repo: 'Repository',
      commit: 'Commit',
      source: 'Input source',
      measuredAt: 'Measured at',
      verifier: 'Verifier',
    },
    repoUnknown: '(repository name could not be read)',
    source: (origin, source) =>
      origin === 'url'
        ? `Public repository URL — read straight from api.github.com by this browser (${source})`
        : `URL fragment — a summary measured on the repository's side and carried here (${source})`,
    dirtyUnknown: 'The number of uncommitted changes could not be read — "unknown" is not 0.',
    dirty: (files) =>
      `${files} file(s) with uncommitted changes — the numbers below do not correspond exactly to the commit above.`,
    fragmentNotice:
      'This address (the fragment) carries the repository name and the judgment result — share the address and they go with it.',
    scope: (notations) => [
      `Notations refs looks at: ${notations}`,
      'Notations outside this list, and input that could not be read, are unjudged — not "0 violations".',
    ],
    totals: ({ checks, violations, passes, unjudged }) =>
      `${checks} check(s) — ${violations} violation(s) · ${passes} pass(es) · ${unjudged} unjudged`,
    omitted: (beyond) => `… and ${beyond} more — the counts above are exhaustive.`,
    divergence: ({ token, reason, at }) =>
      `${token} — declared divergence: ${reason}${at === null ? '' : ` (${at})`}`,
  },

  screen: {
    commandCaption:
      'Run it at the repository root and the judgment runs on that machine; only the result summary opens in the fragment of this page’s address — neither code nor tokens go anywhere.',

    privateOrMissing: {
      title: 'Cannot judge — this address cannot be read without authentication',
      lines: [
        'Either the repository is private or it does not exist — the unauthenticated GitHub API does not tell the two apart, and this page does not pretend to.',
        'Unreadable is not "0 violations" — no numbers were produced.',
        'Judging a private repository happens where the repository is. The absence of a PAT (token) field here is design, not an omission.',
      ],
    },

    truncated: {
      title: 'Cannot judge — the API truncated the file list',
      lines: [
        'The repository is large enough that the unauthenticated API surface will not return the whole file list. A judgment on a truncated list would be false, so no numbers are produced.',
        'The command that runs on the repository’s side is not subject to this limit.',
      ],
    },

    rateLimited: (wait) => ({
      title: 'Cannot judge — the unauthenticated GitHub API rate limit was hit',
      lines: [
        'This network has used up its unauthenticated call budget — GitHub counts that limit per IP.',
        wait,
        'There is a path that does not wait — the command that runs on the repository’s side is not subject to this limit.',
      ],
    }),
    waitUnknown: 'The response did not say when the limit resets — try again shortly.',
    wait: (minutes, resetAt) => `The limit clears in about ${minutes} minute(s) (as of ${resetAt}).`,

    versionMismatch: (axis, found) => ({
      title: 'Cannot judge — this page does not know this report version',
      lines: [
        `The summary in the address was made with ${axis} version "${found}", and this page does not know that version.`,
        'Silently interpreting a version it does not know would produce a false report — so it stops here.',
        'Reload the page to open it with the newest version, or update the verifier on the measuring side and make the address again.',
      ],
    }),
    axis: { fragment: 'fragment', schema: 'schema' },

    fragmentUnreadable: {
      title: 'Cannot judge — the summary in the address is damaged',
      lines: [
        'The summary’s self-check (length and checksum) does not match — somewhere along the way the address was truncated or altered.',
        'Drawing a truncated summary would produce a false report — so it is not drawn. Make the address again on the measuring side and carry it whole.',
      ],
    },

    declarationInvalid: (problems) => ({
      title: 'Judgment failed — graduand.json is broken',
      lines: [
        'A broken declaration does not fold into unjudged; it stops loudly right here — a silently ignored typo would read as "pass".',
        ...problems.map((problem) => `· ${problem}`),
        'Fix the declaration and it runs again immediately.',
      ],
    }),

    error: (message) => ({
      title: 'The diagnosis did not finish',
      lines: [
        message,
        'Either the network dropped or the GitHub API answered in an unexpected way. No numbers were produced — try again.',
      ],
    }),
  },

  entitlement: {
    unwired: [
      'The entitlement was never asked for — this build of the verifier has no issuing organization yet.',
      'Nothing is gated. The numbers below were never asked to prove an entitlement.',
    ],
    absent: (reason, detail) => [
      `Unjudged (${reason}). This is neither red nor a violation count.`,
      ACTION[detail],
      'The cells below still show their denominator. What is missing is the numbers, not the shape.',
    ],
    expires: ({ expires, daysLeft, onDate }, convertPath) => [
      `As of ${onDate} (UTC) — this entitlement expires ${expires}, with ${daysLeft} day(s) left.`,
      `Convert inside this same tool before then: ${convertPath}`,
    ],
    expired: ({ expires, daysLeft, onDate }, convertPath) => [
      `As of ${onDate} (UTC) — this entitlement ended ${expires}, ${-daysLeft} day(s) ago.`,
      `Convert inside this same tool to get the numbers back: ${convertPath}`,
    ],
  },

  entry: {
    unreadableInput:
      'This is not a shape that can be read — it takes owner/name or a github.com repository address.',
    running: 'Diagnosing — this browser is reading straight from api.github.com.',
  },

  scaffold: {
    copied: (file) => `Copied — save it at the repository root as ${file}.`,
    copyFailed: 'Could not write to the clipboard — select the snippet above and copy it yourself.',
  },
};
