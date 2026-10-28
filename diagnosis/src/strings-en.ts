/**
 * en — **번역**이다. 정본은 `strings-ko.ts` 고, 여기서 뜻을 더하거나 빼지 않는다.
 *
 * ⭐ 번역이 **빠뜨릴 수 없다** — 이 객체가 `Strings` 를 구현하므로 키 하나가 없거나 인자
 * 모양이 어긋나면 타입 검사가 막는다. 그 집행이 테스트가 아니라 `tsc` 에 있는 이유는,
 * 테스트만으로 물으면 그 사이 타입 검사가 초록이고 이 저장소가 이미 그 공백에서 샜다.
 *
 * ⚠️ 번역의 규율 넷 — 뜻이 갈라지는 자리가 늘 여기다:
 *   ⑴ **「미판정」은 unjudged 다** — ⛔ unknown · n/a · skipped 가 아니다: 그 셋은 전부
 *      「보지 않았다」로 읽히는데, 미판정은 **보았고 수를 내지 않았다**는 판정이다.
 *   ⑵ **수를 접는 말을 들이지 않는다** — 그 금칙의 목록은 `boundary.test.ts` 가 든다.
 *      ⚠️ 여기 다시 적으면 **이 파일이 그 가드에 걸린다**(실제로 걸렸다) — 사본을 만들지
 *      않는다는 규율이 금칙 목록 자신에게도 듣는다는 뜻이다.
 *   ⑶ **낫표(「」)는 영문 인용부호로** 옮긴다 — 자구만 바뀌고 강조의 자리는 그대로다.
 *   ⑷ **인칭을 정본과 같이 든다** — 정본이 합니다체 · 2인칭으로 뒤집혔으므로 이쪽도 읽는
 *      사람을 `you` 로 부른다. ⛔ 제품을 삼인칭으로 설명하는 꼴(「the customer's side」)로
 *      되돌리지 않는다: 그 꼴이 광고 화면을 자기 조직에게 쓰는 글로 만든다.
 *
 * ⚠️ **「체크아웃」이 두 가지다.** 스캐폴드 절의 그 말은 *git 작업 사본*이고(→ working copy),
 * 가격 절의 그 말은 *결제 화면*이다(→ checkout). 한 단어로 옮기면 영문 독자에게 둘 중
 * 하나가 거짓이 된다.
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
  'not-configured': `No entitlement is set up yet. Subscribe to one, commit its handle to ${ENTITLEMENT.file}, and put the key in ${ENTITLEMENT.keyEnv}.`,
  'vendor-said-no': `The vendor answered that this key is not valid for this activation. Subscribe or renew, then update ${ENTITLEMENT.file}.`,
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

  /*
   * 문서가 발행 시점에 싣는 정적 산문 — 정본(ko)의 같은 자리를 채운다.
   * ⭐ `` `…` `` 는 코드 조각, `*…*` 는 강조다(생성기가 이스케이프한 **뒤** 변환한다).
   */
  page: {
    title: 'graduand — judging whether the rules you wrote down still hold at this commit',
    description:
      "Whether your shared-value canon, the references in your docs and your declared UI paths still match the commit, judged by the visitor's own browser reading straight from the GitHub API. Neither your code nor the judgment is sent to any server.",
    heading: 'Judging whether the rules you wrote down still hold at this commit',
    lede:
      'This browser reads your shared-value canon, the references in your docs and your declared UI paths, and reports each one as a pass, a violation, or unjudged. No sign-up and no install. The canon of your rules stays in your own repository. We only point at it and compare, and your code never reaches us.',
    activated: 'The subscription is active.',

    nav: {
      label: 'Global navigation',
      home: 'graduand — back to the start',
      localeLabel: 'Change language',
    },

    entry: {
      label: 'Diagnosis entry',
      publicTitle: 'Public repository — just paste the address',
      publicBody:
        'Paste a repository address, press *Diagnose*, and this browser reads straight from the GitHub API and judges on the spot. There is no server in between, and no sign-in.',
      inputLabel: 'GitHub repository',
      inputPlaceholder: 'owner/name or a github.com address',
      submit: 'Diagnose',
      privateTitle: 'Private repository — one command',
      privateBody:
        'Run the command below at your repository root: judgment runs on that machine, and only a summary of the result opens this page through the address (fragment). Neither code nor tokens are sent. That screen is the *same* one a public repository address produces, down to the number of judged cells.',
      privateNote:
        'There is no field for a token (PAT) on this page — that is design, not an omission. This will not become a product that teaches you to paste tokens.',
    },

    features: {
      label: 'Features',
      title: 'What gets judged',
      lede:
        'Everything below runs today. For a public repository you only paste the address. For a private one, a single command on the machine that already holds the repository gives you *the same report*.',
      items: [
        {
          title: 'Whether the places your docs point at really exist',
          body: 'Every file, path and anchor your documents point at is followed and checked against what somebody who clones the repository could actually reach. This is the axis that reports with no declaration at all, so you get numbers on the first screen without configuring anything.',
        },
        {
          title: 'Whether your shared values still match the basis',
          body: 'Shared values such as colour and spacing are read straight out of the code and matched token by token against the basis your repository wrote down. A value routed through `var()`, or defined twice in the same scope, is left unjudged rather than guessed at.',
        },
        {
          title: 'Where a value has drifted between repositories',
          body: 'The repository that copied the basis and the repository that owns it are read *together*, to see whether the two still agree. Change a value and its copy in one pull request and every guard in that repository stays green — which is why this question can only be asked on a surface that sees both.',
        },
        {
          title: 'Whether a declared UI path points at nothing',
          body: 'Each UI path in your declaration is checked for a directory that really exists. A declaration that says "there is no UI" — `ui: []` — passes with nothing to judge, while writing nothing at all is not a pass but unjudged.',
        },
        {
          title: 'What is already visible with no declaration',
          body: 'Blocks that live verbatim in two or more documents are counted. Pairs that have already started saying two different things are counted separately and shown to you. This axis observes and does not judge, so nothing here can turn anything red. Where a fact should live is yours to decide.',
        },
        {
          title: 'Three states only — pass, violation, unjudged',
          body: 'A cell nobody looked at is never counted as a pass. A check that could not run carries its reason. The three counts are never folded into one indicator — one folded number hides *what was left out*.',
        },
        {
          title: 'It drops into your CI as it is',
          body: 'Entrances for GitHub Actions, GitLab CI and Bitbucket Pipelines all stand today. A violation turns that job red. Judgment finishes inside your own CI, and there is no place where our infrastructure reads your repository.',
        },
      ],
    },

    scaffold: {
      label: 'Declaration scaffold',
      title: 'Start declaring — three steps',
      body: 'An axis stays unjudged because nothing was declared for it. Without a declared basis the answer is not "0 violations", it is unjudged. ① Copy the snippet below, ② save it at your repository root as `graduand.json`, ③ commit it, and those cells are judged from the next diagnosis on. You do not even need a working copy. Copying and pasting is all of it.',
      snippetLabel: 'Empty declaration',
      copy: 'Copy the snippet',
      emptyNote:
        'An empty admissions record is fine. "No rule has been admitted yet" is a *true declaration*, and every one of those cells stays unjudged. An empty state is not treated as a defect here.',
      canonNote:
        '⭐ When you admit a rule, you write a *name that points at* the canon of that norm. Copy the same norm into every repository and those copies drift apart. This page measures exactly that drift.',
      workingCopyNote:
        'If you do have a working copy, one command writes the same content to the same place. It does not overwrite an existing declaration, and it does not commit.',
    },

    cta: {
      label: 'Subscription',
      title: 'Repository subscription',
      boundary:
        'The diagnosis keeps running here for free, exactly as it does now — judgment runs on your side, and its result never reaches us. Subscribing does not move that boundary.',
      price: '$15 / month · $150 / year per repository',
      priceNote: '(total)',
      tax: 'Tax follows where you are — it is either included in the price shown or added to it, and the final amount is settled at checkout.',
      choiceNote:
        'Monthly or annual, and how many repositories (minimum 1), are chosen *on the payment screen*. This link does not lock them in advance.',
      start: 'Start a subscription',
    },

    activation: {
      title: 'What you do in the repository after you subscribe',
      body:
        'Three things. Put the key you get when you subscribe into your environment, run `graduand activate` once in your repository, and it writes a handle file. Commit that file, and put the key into your CI secrets. *The key is never committed*: a secret that is committed is not a secret.',
      naming:
        'This screen does not write the names of that file and that key. The command tells you, right where you need them. Writing them here would add one more copy, and that copy parts from the command the day a name moves.',
    },

    faq: {
      title: 'Questions we get',
      knivesQ: 'When do holding a declaration on screen, and promoting a rule, stand up?',
      knivesA1:
        'Holding *stands*. The prior decision that blocked it is closed (*the page composes, the command writes*), and the place to link or create a constitution is the link in the Product column below. ⛔ That page neither writes nor commits. The page hands you a string; writing the file is done by the command on your own machine.',
      knivesA2:
        'Promotion has *not stood up yet*. Its shape is settled, though: among the observed drifts, *a person picks* what goes upstream (the machine names candidates and invents no criterion). When it stands it takes your declaration as its basis, so it asks about entitlement.',
      freeQ: 'How much is visible for free?',
      freeA1:
        'Right now everything runs. This in-browser diagnosis has no place that asks for entitlement yet, so it blocks nothing.',
      freeA2:
        'What divides is not the file but *whether a feature needs a declaration*. Reference judging yields counts with no declaration at all. The features of the declaration itself (admissions, the grid, exemptions) and the checks that take a declaration as their basis do ask for entitlement.',
      freeA3:
        'Even where it is asked for, *the shape of the cells stays visible*. Only the counts are withheld, and those cells stay unjudged.',
    },

    footer: {
      privacy: 'Privacy policy',
      terms: 'Terms of service',
      refunds: 'Refund policy',
      portal: 'Cancel a subscription — customer portal',
      renewal:
        'A subscription renews automatically at the end of each billing period — the details of renewal, and cancelling, are handled in the customer portal.',
      effective:
        'The three policies have no effective date yet. No paid subscription is taken before that date is set.',
      effectiveOn: (date) => `The three policies take effect on ${date}.`,
      companyHeading: 'Company',
      newWindow: 'opens in a new window',
      contact: 'Contact us',
      productHeading: 'Product',
      pricing: 'Pricing',
      constitution: 'Constitution · observation',
      diagnosis: 'Diagnosis',
      legalHeading: 'Legal',
      languagesHeading: 'Languages',
      publisher: {
        label: 'Business information',
        company: 'Company name',
        representative: 'Representative',
        registration: 'Business registration number',
        address: 'Address',
        contact: 'Contact',
        mailOrderReport: 'Mail-order sales registration number',
      },
    },
  },

  constitution: {
    title: 'graduand — constitution and observation',
    description:
      'Link or create a constitution to compose the declaration, and read what downstream has diverged from the canon in three states. The declaration lives in your repository; we point at it and compare.',
    heading: 'Hold the constitution and see what diverged',
    lede:
      'The canon of a rule is *one repository in your own organisation*. This page *composes* the declaration that points at that address and reads what downstream has diverged from it. ⛔ Your repository is never sent to us: judgment runs in this browser, and no code here can send a result back.',

    hold: {
      label: 'Constitution',
      title: 'Add a constitution — link or create',
      body:
        '"Making a constitution" is *two* acts. One repository authors the norms (create), and every repository that receives them carries a declaration (link). Below, ① choose what you are declaring, ② name the constitution, ③ read a repository and ④ pick the file and the scope, and one declaration (`graduand.json`) is composed.',
      writeNote:
        '⛔ This page *neither writes nor commits*. It hands you a string, and writing the file belongs to the command that runs on your own machine. The composer is *one and the same*, so both entrances produce identical bytes.',

      kindLabel: '① What are you declaring',
      kindCanon: 'Create — this repository is the canon',
      kindLink: 'Link — the canon is another repository',
      canonNote:
        'The declaration of the repository that authors the norms. It states no pins and no canon address: *the canon does not pin its own values*. Below, read your repository and pick which file and which scope hold those values.',
      linkNote:
        'Point at the canon and write the pinned values *read from that repository*. Read the canon repository below. ⛔ Nothing is copied by hand: copying the same value into N repositories by hand is the production line of that drift, and this product measures it.',

      axisLabel: '② Name of this constitution — the shared-value axis',
      axisPlaceholder: 'design',
      axisNote:
        'One repository can answer to *several* constitutions. Each axis carries its own canon, so a development constitution and a design constitution may live in different upstreams while one declaration points at both. ⛔ The name is *yours to choose*: only whitespace and `:` are refused, because a judged cell is named `verifier:axis`.',

      repoLabel: '③ Repository to read',
      repoPlaceholder: 'owner/name or a github.com address',
      read: 'Read the repository',
      fileLabel: '④ File — only shapes this adapter reads are listed',
      scopeLabel: '④ Scope — only what was *actually read* in that file is listed',
      compose: 'Compose the declaration',
      snippetLabel: 'Composed declaration',
      copy: 'Copy',
      nextNote:
        'Commit this snippet as `graduand.json` at your repository root, and the diagnosis at the root reads that repository and reports. If the declaration points at a canon, it reads that too and judges "pins == canon".',
    },

    result: {
      noFiles: 'This repository holds no file of a shape the adapter reads — nothing is invented here.',
      noScopes:
        'Zero values were read in this file — pick another file, or check whether this one really holds the shared values.',
      scopeOption: (scope, tokens) => `${scope} — ${tokens} value(s)`,
      axis: (axis) => `Axis "${axis}" — the judged cells stand as "verifier:${axis}".`,
      added:
        'One axis was added to the declaration this repository already holds — the snippet below is the whole file (the other axes, the UI paths and the admissions are written back exactly as declared).',
      pinned: (count) => `Pinned ${count} value(s) read from the canon — nothing was copied by hand.`,
      canonSelf:
        'This repository is the canon, so it pins nothing — the cross axis stays "not declared = unjudged", and that is true.',
      unpinned: (count) =>
        `${count} canon token(s) left unpinned — their values are not resolved, so they cannot serve as a basis. Those cells are unjudged, not violations.`,
      unpinnedWhy: {
        'ambiguous-cascade': 'defined more than once in the same scope',
        'var-indirection': 'a var() indirection, so the value is not resolved',
      },
      admissionsEmpty:
        'The admission record is empty — "no rule has been admitted yet" is a true declaration, and those cells are all unjudged.',
      refused: 'Nothing was composed — a declaration with an invented basis is not produced:',
      jurisdiction: ({ cells, violation, pass, unjudged }) =>
        `jurisdiction ${cells} — violation ${violation} · pass ${pass} · unjudged ${unjudged}`,
      shape: (rules, surfaces) => `rules ${rules} × surfaces ${surfaces}`,
      emptyDenominator:
        '0 cells — an empty basis is unjudged, and "0 admissions" is not a defect. Cells stand once the declaration holds rules and surfaces.',
      chose: (verifiers) => `verifiers chosen: ${verifiers}`,
      choseNone: 'No verifier was chosen — a rule that cannot run is not "0 violations".',
      canonRead: (repos) => `Repositories seen alongside: ${repos} — "pins == canon" stands on this surface.`,
      canonAbsent:
        'This measurement saw one repository only — "pins == canon" stays unjudged. Unjudged is not "0 violations".',
    },
  },

  status: {
    pass: 'pass',
    violation: 'violation',
    unjudged: 'unjudged',
  },

  reason: {
    'no-declaration':
      'reason no-declaration — the basis for this judgment was never declared. An absent declaration is neither a violation nor a pass.',
    'collection-truncated':
      'reason collection-truncated — the input could not be read in full. No numbers are produced on top of a truncated collection.',
    'no-adapter':
      'reason no-adapter — no adapter is declared, so the code was never read. The pinned values still stand as the basis, but "code == pinned" cannot be asked.',
    'single-repo-surface':
      'reason single-repo-surface — "pinned == canon" belongs to a surface that sees every repository. This surface sees one, so it does not judge.',
    'no-verifier':
      'reason no-verifier — the rule was admitted, but no verifier is declared for that cell. A rule that cannot be run is not "0 violations"; it is a judgment that could not run.',
    'declared-divergence':
      'reason declared-divergence — you declared, with a stated reason, that the canon of this value is here. It drops out of "pinned == canon" only; "code == pinned" is still judged.',
    'declared-exemption':
      'reason declared-exemption — you declared this rule exempt, with a stated reason and an expiry. The cell stays and the basis does not shrink.',
    'no-entitlement':
      'reason no-entitlement — there is no entitlement. The basis (the shape of the cells) is still shown; only the numbers are withheld.',
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
        : `URL fragment — a summary measured on your repository's side and carried here (${source})`,
    dirtyUnknown: 'The number of uncommitted changes could not be read — "unknown" is not 0.',
    dirty: (files) =>
      `${files} file(s) with uncommitted changes — the numbers below do not correspond exactly to the commit above.`,
    fragmentNotice:
      'This address (the fragment) carries the repository name and the judgment result — share the address and they go with it.',
    scope: (notations) => [
      `Notations refs looks at: ${notations}`,
      'Notations outside this list, and input that could not be read, are unjudged — not "0 violations".',
    ],
    totals: ({ checks, measured, violations, passes, unjudged }) =>
      `${checks} in scope — ${measured} measured (${violations} violation(s) · ${passes} pass(es)) · ${unjudged} not measured`,
    measuredHeading: 'Measured',
    unmeasuredHeading: 'Not measured',
    evidenceSummary: (shown) => `${shown} piece(s) of evidence`,
    omitted: (beyond) => `… and ${beyond} more — the counts above are exhaustive.`,
    divergence: ({ token, reason, at }) =>
      `${token} — declared divergence: ${reason}${at === null ? '' : ` (${at})`}`,
  },

  undeclared: {
    heading: 'Seen without a declaration',
    notice: [
      'This section is not a judgment — no pass, no violation, and nothing here can turn anything red.',
      'An axis that invents violations without a declaration is a rule we wrote, which is the opposite of what this product sells.',
    ],
    documentsRead: (tracked) => `Read all ${tracked} document(s).`,
    documentsPartial: (tracked, read) =>
      `Read ${read} of ${tracked} document(s) — the numbers below stand on a partial read.`,
    copiesNone: (minLines) => `0 copies — no block of ${minLines}+ lines lives verbatim in two documents.`,
    copies: (blocks) => `${blocks} copied block(s) — the same block lives verbatim in two or more documents.`,
    divergedNone: '0 diverged copies — no pair of blocks shares more lines than either version holds of its own.',
    diverged: (pairs) =>
      `${pairs} diverged cop(ies) — pairs sharing more lines than either version holds of its own, yet not identical: two versions of one fact.`,
    divergedFamily: (homes, pairs, shared, differing) =>
      `${homes} homes · ${pairs} pair(s) · ${shared} shared lines · ${differing} differing`,
    divergedOmitted: (beyond) => `… and ${beyond} more pair(s) — the count above is exhaustive.`,
    divergedTruncated:
      'The pair scan stopped at its ceiling — the count above is what was seen, not what is there.',
    homes: (homes, lines) => `${homes} homes · ${lines} lines`,
    copiesOmitted: (beyond) => `… and ${beyond} more — the count above is exhaustive.`,
    why: [
      'A copy is not a violation — where a fact lives is your call.',
      'A copy is a place that can diverge: two verbatim blocks part the day only one of them is fixed.',
      'A diverged copy is a place where that day has already passed — which side is right is not ours to say.',
    ],
    surfacesHeading: 'Shared-value surfaces you could declare (counted by shape — contents are not read here)',
    surfaceNone: (adapter) => `${adapter}: no tracked file has that shape.`,
    surfaceAll: (adapter, files) => `${adapter}: ${files} file(s) — all of their contents are in this measurement.`,
    surfacePartial: (adapter, files, loaded) =>
      `${adapter}: ${loaded} of ${files} file(s) carry contents — the rest were not read, which is not "0 tokens".`,
  },

  screen: {
    commandCaption:
      'Run it at your repository root and judgment runs on that machine; only the result summary opens in the fragment of this page’s address — neither code nor tokens go anywhere.',

    privateOrMissing: {
      title: 'Cannot judge — this address cannot be read without authentication',
      lines: [
        'Either the repository is private or it does not exist — the unauthenticated GitHub API does not tell the two apart, and this page does not pretend to.',
        'Unreadable is not "0 violations" — no numbers were produced.',
        'Judging a private repository happens where the repository is. The absence of a token (PAT) field here is design, not an omission.',
      ],
    },

    truncated: {
      title: 'Cannot judge — the API truncated the file list',
      lines: [
        'The repository is large enough that the unauthenticated API surface will not return the whole file list. A judgment on a truncated list would be false, so no numbers are produced.',
        'The command that runs on your repository’s side is not subject to this limit.',
      ],
    },

    rateLimited: (wait) => ({
      title: 'Cannot judge — the unauthenticated GitHub API rate limit was hit',
      lines: [
        'This network has used up its unauthenticated call budget — GitHub counts that limit per IP.',
        wait,
        'There is a path that does not wait — the command that runs on your repository’s side is not subject to this limit.',
      ],
    }),
    waitUnknown: 'The response did not say when the limit resets — please try again shortly.',
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
        'Drawing a truncated summary would produce a false report, so it is not drawn — please make the address again on the measuring side and carry it whole.',
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
        'Either the network dropped or the GitHub API answered in an unexpected way. No numbers were produced — please try again.',
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
      'The cells below still show their basis. What is missing is the numbers, not the shape.',
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
    copied: (file) => `Copied — save it at your repository root as ${file}.`,
    copyFailed: 'Could not write to the clipboard — please select the snippet above and copy it yourself.',
  },
};
