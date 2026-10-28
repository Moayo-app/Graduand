#!/usr/bin/env node
/**
 * `graduand` CLI — 워크스페이스를 판정하는 측정 명령. 비공개 저장소의 데모·CI 가 쓴다.
 *
 *   graduand [--root <path>]... [--json | --fragment | --open]
 *   graduand init [--root <path>]
 *   graduand canon --axis <name> --adapter <id> --file <path>... --scope <scope> [--root <path>]
 *   graduand link --axis <name> --canon <owner/name> --canon-file <path> --canon-scope <scope>
 *                 [--adapter <id> --file <path>... --scope <scope>] [--root <path>]...
 *   graduand rules [--root <path>]... [--json]
 *   graduand --help
 *
 * `--root` 는 **여러 번** 올 수 있다 — 한 잡에 체크아웃 N개가 그 모양이고, 교차 축
 * (「박제 == 정본」)은 그 표면에서만 설 수 있다. 각 체크아웃은 **나머지 전부를 시야로**
 * 판정되고, 보고는 체크아웃마다 한 절씩 + 관할 합산 한 줄이다. 체크아웃이 하나면 교차
 * 축은 「선언만 격자」로 내려가 `single-repo-surface` 미판정으로 남는다.
 *
 * `--open` 은 요약을 보고 페이지 주소에 실어 기본 브라우저를 연다 — 주소·상한·여는
 * 행위의 규율은 `open.ts` 가 쥔다. 그 주소는 상수고 플래그로 덮어쓸 수 없다.
 *
 * `--help` 는 **무엇과 섞여도 이긴다** — 사용법을 묻는 사람은 플래그를 모르는 사람이라,
 * 「올바르게 물었을 때만 알려 준다」는 아무것도 알려 주지 않는다. ⛔ 그래서 이 플래그만
 * 「섞이면 사용법 오류」 규율의 예외이고, **조용하지 않다**: 이긴다는 사실이 여기 적혀 있고
 * 테스트가 그것을 문다. 그리고 `init --json` 과 달리 **어긋남이 없다** — 판정을 내겠다고
 * 해 놓고 내지 않는 것이 아니라, 요청받은 그 한 가지(사용법)를 한다.
 *
 * `init` 은 **하위 명령**이지 플래그가 아니다 — 판정이 아니라 선언 스캐폴드를 쓰는 다른
 * 행위이고(`scaffold.ts`), 그래서 보고 플래그와 섞이지 않는다. ⛔ git 을 건드리지 않는다:
 * 쓰는 것과 커밋하는 것은 다른 행위이고 둘째는 고객의 몫이다.
 *
 * `canon` · `link` 는 **헌법 조립**의 두 갈래이고(`constitution.ts`) `init` 과 같은 급의
 * 하위 명령이다 — 쓰는 규율도 같다(덮어쓰지 않는다 · 커밋하지 않는다). 가르는 것은 **내용**
 * 하나다: `canon` 은 「이 저장소가 정본이다」를, `link` 는 「정본은 저기이고 값은 이것이다」를
 * 적는다. ⭐ 후자의 박제는 **정본에서 읽는다** — 손으로 받는 자리가 없다.
 *
 * ⭐⭐ **`--axis` 가 「어느 헌법인가」다**(개정 4) — 선언은 공유값 축을 이름으로 여럿 들고
 * 축마다 정본이 따로 서므로, 한 저장소가 디자인 정본과 API 정본에 동시에 답한다(저장소가
 * 여럿이고 규율이 갈래로 파편화된 조직이 그 모양이다). ⛔ 기본값이 없다: 우리가 고른 이름이
 * 저장소 N 개에 조용히 박히는 자리를 만들지 않는다.
 * ⭐ 선언이 **이미 있으면** 조립은 그 선언에 축을 더한 **전문**을 stdout 으로 낸다 — 두
 * 선언을 손으로 합치는 행위가 이 제품이 재는 갈라짐의 생산 공정이라서다. ⛔ 그래도 쓰지는
 * 않는다(덮어쓰지 않는다는 규율은 그대로이고, 같은 이름의 축은 거부한다).
 *
 * `deliver` 는 **정본 → 하류**다 — 선언이 가리킨 정본에서 읽어 **하류의 박제 칸**을 다시
 * 쓴다(`deliver.ts`). ⭐ 조립과 달리 **덮어쓴다**: 조립은 선언을 **짓는** 행위라 있는 것을
 * 지울 수 없고, 배달은 그 선언이 **부른 값**을 따라 쓰는 행위다 — 분모가 받는 쪽 선언이라
 * 쓰는 칸이 선언에 이미 적혀 있다. ⛔ 그래도 선언의 다른 칸은 바이트로 그대로다.
 *
 * ⚠️ **`link` · `deliver` 는 루트를 여럿 받고, 쓰는 자리는 첫 루트다.** 나머지는 **시야**이고 정본은 그
 * 안에서 이름으로 찾아진다(판정의 시야와 같은 모양 · 같은 규율 — 비슷한 이름으로 맞히지
 * 않는다). 첫 루트는 **스냅샷으로 읽지 않는다**: 선언을 쓸 자리일 뿐이라 git 작업 트리일
 * 필요가 없다(`init` 과 같다).
 *
 * `rules` 는 **묻는 쪽**이고 위 넷과 가르는 축이 그것이다 — 선언을 쓰지도(`WRITES` 에 없다)
 * 판정하지도 않고, 「선언이 **무엇을 분모로 세웠는가**」만 낸다(`rules.ts`): 편입된 규칙과 그
 * 규칙이 고른 판정기 · **축마다의 정본 주소** · 면제와 그 만기 · 관할의 모양. ⭐ 그래서
 * 보고 플래그 중 `--json` **만** 받는다 — 소비자의 절반이 에이전트다. ⛔ `--fragment`·`--open`
 * 은 받지 않는다: 그 둘은 **측정 하나**를 싣는 자리고(주소 하나 · 요약 하나) 분모에는 실을
 * 측정이 없다. ⛔ 판정하지 않으므로 **빨강도 내지 않는다**(아래 종료 코드의 1 이 이 명령에
 * 없다) — 분모를 묻는 행위는 무엇도 위반하지 않는다.
 *
 * 종료 코드 — 빨강의 근거는 **위반 또는 넘긴 만기**다:
 *   0  `--help` 는 **한 일이 있다**(사용법을 말했다) — 판정을 묻지 않았으므로 초록이다.
 *      위반 0 · 넘긴 만기 0 (미판정이 있어도 0 — 미판정은 사유와 함께 보고될 뿐, 빨강의
 *      근거가 아니다). ⭕ **자격이 없어도 0 이다** — 자격은 위반이 아니라 미판정이고,
 *      막는 척하지 않는다: 칸은 분모와 사유를 그대로 보이고 수만 나오지 않는다.
 *   1  위반 ≥ 1 **또는** 만기를 넘긴 면제 ≥ 1. 둘째 근거는 판정이 아니라 **봉투**에서
 *      온다(`expiry.ts` — 만기는 `measuredAt` 기준이고 `Judgment` 에 들어갈 수 없다).
 *      ⭕ 3상태는 안 깨진다: 늘어난 것은 **종료 코드의 근거**이고 칸의 상태는 그대로다.
 *   2  판정 실패 — 선언이 깨졌거나 대상을 읽을 수 없다. 수를 내지 않았다.
 *      `init` 에서는 **쓰지 않았다**(이미 선언이 있거나 쓰지 못했다) — 역시 한 일이 없다.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadWorkspaces, loadWorkspaceSnapshot } from './hosts/workspace.ts';
import { judgeSnapshot } from './judge.ts';
import { admissionGrid, gridCounts, gridTotals, type AdmissionGrid } from './grid.ts';
import { serializeMeasurement, type CheckResult, type Measurement } from './schema.ts';
import {
  DECLARATION_FILE,
  DeclarationInvalidError,
  validateDeclaration,
  type ValidDeclaration,
} from './declaration.ts';
import { AdapterParseError } from './adapters/adapter.ts';
import { RepoUnreadableError, type RepoSnapshot } from './snapshot.ts';
import { encodeFragment } from './fragment.ts';
import { formatInitOutcome, initDeclaration, writeDeclaration, writeExitCode, type ScaffoldIo } from './scaffold.ts';
import { activateExitCode, formatActivation, writeHandle, type HandleIo } from './activate.ts';
import {
  composeConstitution,
  formatCompose,
  formatRefusal,
  type AdapterTrio,
  type ConstitutionIntent,
} from './constitution.ts';
import {
  deliver,
  deliverExitCode,
  formatDeliverRefusal,
  formatDelivery,
  planDelivery,
  type DeliverIo,
} from './deliver.ts';
import { formatRules, readRules, serializeRules } from './rules.ts';
import { foldDiverged, readUndeclared, type Span, type UndeclaredFacts } from './undeclared.ts';
import { describeOverdue, gateExitCode, overdueExemptions, utcDateOf, type OverdueExemption } from './expiry.ts';
import { describeEntitlement, describeExpiry, ENTITLEMENT, type Entitlement } from './entitlement.ts';
import { activateEntitlement, resolveEntitlement, type EntitlementIo } from './hosts/entitlement.ts';
import { formatOpenOutcome, openReport, systemOpener, type Opener } from './open.ts';
import { NOTATIONS } from './verifiers/notations.ts';
import { REFS_CHECK_ID } from './verifiers/refs.ts';
import { VERIFIER } from './version.ts';

const USAGE = [
  'usage: graduand [--root <path>]... [--json | --fragment | --open]',
  '       graduand init [--root <path>]',
  '       graduand canon --axis <name> --adapter <id> --file <path>... --scope <scope> [--root <path>]',
  '       graduand link --axis <name> --canon <owner/name> --canon-file <path> --canon-scope <scope>',
  '                     [--adapter <id> --file <path>... --scope <scope>] [--root <path>]...',
  '       graduand deliver [--root <path>]...',
  '       graduand rules [--root <path>]... [--json]',
  '       graduand activate [--root <path>]',
  '       graduand --help',
].join('\n');

type Mode = 'report' | 'json' | 'fragment' | 'open';

/** 하위 명령 — 없으면 판정이다. 닫힌 목록이고, 모르는 이름은 조용히 무시되지 않는다. */
const COMMANDS = ['init', 'canon', 'link', 'deliver', 'rules', 'activate'] as const;

/**
 * 선언을 **쓰는** 하위 명령들 — 보고 플래그와 섞이지 않고, 조립 플래그는 여기만 받는다.
 *
 * ⭐ `rules` 가 **여기 없는 것이 그 명령의 정의다** — 쓰지 않고 묻는다. 그래서 보고 플래그
 * 하나(`--json`)를 받고, 받지 않는 둘은 아래에서 따로 거부된다(측정을 싣는 플래그들이다).
 */
const WRITES: readonly Command[] = ['init', 'canon', 'link', 'deliver', 'activate'];
/** `help` 는 하위 명령 이름이 아니라 플래그가 고르는 행위다 — 그래서 위 목록에 없다. */
type Command = 'judge' | 'help' | (typeof COMMANDS)[number];

/** 사용법을 묻는 플래그 — 둘 다 받는다(관행이고, 틀린 쪽을 고르면 아무것도 못 듣는다). */
const HELP_FLAGS = ['--help', '-h'] as const;

/**
 * 조립 플래그 — ⭐ 값이 **하나뿐인** 것과 **여럿인** 것을 타입이 가른다. 둘을 한 자리에
 * 담으면 `--scope` 를 두 번 받아 조용히 뒤쪽을 쓰는 길이 생기고, 그것은 요청한 것과 한
 * 것이 어긋나는 그 결함이다.
 */
interface ComposeFlags {
  /** 공유값 축의 이름 — 「어느 헌법인가」. ⛔ 기본값이 없다(§ `intentOf`). */
  axis: string | null;
  adapter: string | null;
  files: string[];
  scope: string | null;
  canonRepo: string | null;
  canonFile: string | null;
  canonScope: string | null;
}

/** 아무 조립 플래그도 받지 않은 상태 — ⛔ 기본값이 아니다(기본값으로 조립하는 자리는 없다). */
const noFlags = (): ComposeFlags => ({
  axis: null,
  adapter: null,
  files: [],
  scope: null,
  canonRepo: null,
  canonFile: null,
  canonScope: null,
});

const FLAG_KEYS: Readonly<Record<string, Exclude<keyof ComposeFlags, 'files'>>> = {
  '--axis': 'axis',
  '--adapter': 'adapter',
  '--scope': 'scope',
  '--canon': 'canonRepo',
  '--canon-file': 'canonFile',
  '--canon-scope': 'canonScope',
};

function parseArgs(argv: string[]): {
  roots: string[];
  mode: Mode;
  command: Command;
  flags: ComposeFlags;
} {
  // ⭐ **먼저 본다.** 뒤의 검증을 지나게 하면 `graduand --help --json` 이 사용법 오류로
  // 죽고, 사용법을 물은 사람이 받는 것이 사용법이 아니라 질책이 된다 — 그 exit 2 는
  // 「도구가 광고한 것과 하는 것이 다르다」의 가장 값싼 판이다.
  if (argv.some((arg) => (HELP_FLAGS as readonly string[]).includes(arg))) {
    return { roots: ['.'], mode: 'report', command: 'help', flags: noFlags() };
  }
  /** 적힌 순서대로의 체크아웃. 비면 `.` 하나다 — 기본은 지금 있는 저장소다. */
  const roots: string[] = [];
  let mode: Mode = 'report';
  let command: Command = 'judge';
  /** 보고 플래그가 **적혔는가** — `init` 과 섞이면 사용법 오류다(기본값과 구분된다). */
  let modeFlag: string | null = null;
  const flags = noFlags();
  const addRoot = (value: string): void => {
    // 같은 루트를 두 번 받으면 한 저장소가 자기 자신의 시야에 들어온다 — 조용히 합치지
    // 않고 멈춘다: 같은 저장소가 둘로 세어진 수는 전부 거짓이다.
    if (roots.includes(value)) throw new UsageError(`--root is declared twice: ${value}`);
    roots.push(value);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith('-')) {
      // 하위 명령은 첫 자리에만 온다 — 뒤에 붙은 이름은 플래그의 값으로 읽히던 것이고,
      // 그 자리를 받으면 오타가 명령으로 둔갑한다.
      if (i !== 0) throw new UsageError(`unexpected argument: ${arg}`);
      if (!(COMMANDS as readonly string[]).includes(arg)) throw new UsageError(`unknown command: ${arg}`);
      command = arg as Command;
    } else if (arg === '--root') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new UsageError('--root requires a path');
      addRoot(value);
      i += 1;
    } else if (arg.startsWith('--root=')) {
      addRoot(arg.slice('--root='.length));
    } else if (arg === '--file' || arg.startsWith('--file=')) {
      const value = arg.startsWith('--file=') ? arg.slice('--file='.length) : argv[(i += 1)];
      if (!value || value.startsWith('--')) throw new UsageError('--file requires a path');
      // 같은 파일을 두 번 받으면 선언이 그것을 두 번 든다 — 검증이 거부하는 선언이고,
      // 조용히 합치면 요청한 목록과 적힌 목록이 다르다.
      if (flags.files.includes(value)) throw new UsageError(`--file is declared twice: ${value}`);
      flags.files.push(value);
    } else if (arg in FLAG_KEYS || arg.split('=')[0]! in FLAG_KEYS) {
      const [name, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
      const key = FLAG_KEYS[name]!;
      const value = inline ?? argv[(i += 1)];
      if (!value || value.startsWith('--')) throw new UsageError(`${name} requires a value`);
      if (flags[key] !== null) throw new UsageError(`${name} is declared twice`);
      flags[key] = value;
    } else if (arg === '--json' || arg === '--fragment' || arg === '--open') {
      mode = arg.slice(2) as Mode;
      modeFlag = arg;
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  // 조용히 무시하지 않는다 — `init --json` 을 받아 놓고 판정을 내지 않으면, 요청한 것과
  // 한 것이 어긋난 채 exit 0 이다. 이 제품이 파는 결함의 모양 그대로다.
  if (WRITES.includes(command) && modeFlag !== null) {
    throw new UsageError(`${command} takes no report flags: ${modeFlag}`);
  }
  // ⭐ `rules` 는 `--json` 을 받고 **측정을 싣는 둘은 받지 않는다** — fragment 는 요약 하나를
  // 주소에 싣고 open 은 그 주소를 열지만, 분모에는 실을 측정이 없다. ⛔ 조용히 무시하지
  // 않는다: 요약을 달라고 해서 분모를 받으면 요청한 것과 받은 것이 어긋난 채 exit 0 이다.
  if (command === 'rules' && (mode === 'fragment' || mode === 'open')) {
    throw new UsageError(`rules carries no measurement — it declares the denominator: ${modeFlag}`);
  }
  // 조립 플래그는 **조립하는 명령만** 받는다 — 판정이나 `init` 에 붙으면 그 값은 아무것도
  // 하지 않는 채 exit 0 이 되고, 「요청한 것과 한 것이 어긋난 초록」이 바로 이 제품이 파는
  // 결함이다. ⛔ 조용히 무시하지 않는다.
  const composeFlags = [...Object.keys(FLAG_KEYS), '--file'].filter(
    (name) => (name === '--file' ? flags.files.length > 0 : flags[FLAG_KEYS[name]!] !== null),
  );
  if (command !== 'canon' && command !== 'link' && composeFlags.length > 0) {
    throw new UsageError(`${command === 'judge' ? 'judgment' : command} takes no composition flags: ${composeFlags.join(' ')}`);
  }
  if (roots.length === 0) roots.push('.');
  // 선언을 쓰는 것은 한 저장소의 행위다 — 여러 루트를 받아 그중 하나에만 쓰면, 요청한
  // 것과 한 것이 어긋난다.
  if ((command === 'init' || command === 'canon') && roots.length > 1) {
    throw new UsageError(`${command} writes one declaration — pass a single --root`);
  }
  // ⭐ 활성화도 **한 저장소의 행위**다 — 자리를 하나 쓰는 일이라, 루트를 여럿 받아 그중
  //    하나에만 쓰면 고객은 자리 하나를 쓰고 나머지 저장소는 그대로다.
  if (command === 'activate' && roots.length > 1) {
    throw new UsageError('activate spends one seat — pass a single --root');
  }
  // fragment · open 은 **측정 하나**를 싣는다(주소 하나 · 요약 하나). 여러 체크아웃을
  // 받아 그중 하나만 실으면 나머지는 조용히 사라진다.
  if ((mode === 'fragment' || mode === 'open') && roots.length > 1) {
    throw new UsageError(`--${mode} carries one measurement — pass a single --root`);
  }
  return { roots, mode, command, flags };
}

/**
 * 선언한 트리오를 **이 저장소에서 읽어 보는** 손 — 트리오가 없으면 볼 것도 없다(null).
 *
 * ⚠️ 그래서 `canon` 은 이제 **git 작업 트리를 요구한다** — 선언하는 파일이 이 저장소의
 * 것이고, 판정의 표본이 git 이 추적하는 파일이기 때문이다. 추적되지 않는 파일을 선언한
 * 선언은 처음부터 거짓이고, 그것을 **쓰기 전에** 잡는 것이 조립의 몫이다.
 */
type SelfLoader = (trio: AdapterTrio | null) => RepoSnapshot | null;

/**
 * 플래그에서 조립의 **의도**를 짓는다 — ⛔ 빠진 값을 기본값으로 채우지 않는다: `canon` 의
 * 트리오는 셋이 한 몸이고, `link` 의 포인터는 셋이 한 주소다. 반쪽을 받아 반쪽 선언을
 * 지으면 조립기가 자기 산출로 검증 실패를 만든다.
 */
function intentOf(
  command: 'canon' | 'link',
  flags: ComposeFlags,
  self: SelfLoader,
  base: ValidDeclaration | null,
): ConstitutionIntent {
  // ⛔ 축의 기본값을 두지 않는다 — `"palette"` 든 `"default"` 든 **우리가 고른 이름**이
  //    저장소 N 개에 조용히 박히고, 그 이름은 고객의 말이 아니다. 묻지 않은 것을 짓지 않는다.
  if (flags.axis === null) throw new UsageError(`${command} needs --axis <name> — the axis name is yours to choose ("design", "api", …)`);
  const axis = flags.axis;
  const trio: AdapterTrio | null =
    flags.adapter !== null && flags.files.length > 0 && flags.scope !== null
      ? { adapter: flags.adapter, files: flags.files, scope: flags.scope }
      : null;
  const trioParts = [
    flags.adapter === null ? null : '--adapter',
    flags.files.length === 0 ? null : '--file',
    flags.scope === null ? null : '--scope',
  ].filter((part): part is string => part !== null);
  // 셋이 함께 오거나 하나도 오지 않는다 — 선언 검증이 트리오에 걸어 둔 그 동반이다.
  if (trio === null && trioParts.length > 0) {
    throw new UsageError(
      `--adapter, --file and --scope are passed together or not at all (found only: ${trioParts.join(' ')})`,
    );
  }

  if (command === 'canon') {
    if (trio === null) throw new UsageError('canon needs --adapter, --file and --scope');
    const pointer = [
      flags.canonRepo === null ? null : '--canon',
      flags.canonFile === null ? null : '--canon-file',
      flags.canonScope === null ? null : '--canon-scope',
    ].filter((part): part is string => part !== null);
    // ⭐ 「이 저장소가 정본이다」와 「정본은 저기다」는 **배타**다 — 둘을 함께 받으면 어느
    //    쪽을 적으라는 건지 알 수 없고, 추측해서 한쪽을 고르는 자리를 만들지 않는다.
    if (pointer.length > 0) {
      throw new UsageError(`canon declares this repo as the canon — it takes no pointer: ${pointer.join(' ')}`);
    }
    return { kind: 'canon', axis, trio, self: self(trio), base };
  }

  if (flags.canonRepo === null || flags.canonFile === null || flags.canonScope === null) {
    throw new UsageError('link needs --canon, --canon-file and --canon-scope');
  }
  return {
    kind: 'link',
    axis,
    canon: { repo: flags.canonRepo, file: flags.canonFile, scope: flags.canonScope },
    trio,
    self: self(trio),
    base,
  };
}

class UsageError extends Error {}

function describeCheck(check: CheckResult): string[] {
  const counts = Object.entries(check.counts)
    .filter(([k]) => k !== 'evidenceOmitted')
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
  // 수가 **없는** 체크(자격이 막은 칸)는 꼬리의 ` — ` 를 달지 않는다 — 빈 자리는 「수 0」이
  // 아니라 「수를 내지 않았다」이고, 빈 꼬리는 잘린 줄처럼 읽힌다.
  const tail = counts === '' ? '' : ` — ${counts}`;
  const head =
    check.status === 'unjudged'
      ? `  ${check.id}: unjudged (${check.reason})${tail}`
      : `  ${check.id}: ${check.status}${tail}`;
  const lines = [head];
  for (const e of check.evidence.slice(0, 40)) {
    if (check.id === REFS_CHECK_ID && 'line' in e) {
      lines.push(`    ${e.file}:${e.line} [${e.notation}] ${e.raw} — ${e.why} (${e.tried})`);
    } else {
      lines.push(`    ${Object.entries(e).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    }
  }
  const omitted = check.counts.evidenceOmitted ?? 0;
  const beyondPrint = Math.max(check.evidence.length - 40, 0) + omitted;
  if (beyondPrint > 0) lines.push(`    … and ${beyondPrint} more (counts above are complete)`);
  return lines;
}

/**
 * 관할 격자 — 보고는 **「관할 N — 위반 k · 통과 p · 미판정 m」**으로 말한다. ⛔ 점수·등급·
 * 백분율 0: 세 수를 하나로 접는 산술이 이 함수에 없다. 분모가 0 이면 수를 내지 않고 사유를
 * 적는다 — 「편입 0」은 결함이 아니라 정당한 상태이고, 빨강의 근거는 여전히 **위반뿐**이다.
 */
function describeGrid(grid: AdmissionGrid): string[] {
  const shape = `rules ${grid.rules.length} × surfaces ${grid.surfaces.length}`;
  if (grid.reason !== null) {
    return [
      `  jurisdiction: unjudged (${grid.reason}) — ${shape} = 0 cells`,
      '  an empty denominator is a declaration, not a defect — 0 admissions is a legitimate state, and it is not red',
    ];
  }
  const { cells, violation, pass, unjudged } = gridCounts(grid);
  const lines = [
    `  jurisdiction ${cells} — violation ${violation} · pass ${pass} · unjudged ${unjudged}   (${shape})`,
  ];
  for (const rule of grid.rules) {
    const verdict = rule.status === 'unjudged' ? `unjudged (${rule.reason})` : rule.status;
    const chose = rule.verifiers.length > 0 ? rule.verifiers.join(' · ') : 'none declared';
    lines.push(`    ${rule.rule}: ${verdict} — verifiers: ${chose}`);
  }
  return lines;
}

/**
 * 선언 0 에서 보이는 사실 — ⛔ **재어진 것과 같은 절에 두지 않는다.** 상태가 없는 수를
 * 체크 옆에 세우면 「사본 7 건」이 위반 7 건으로 읽히고, 그 혼동이 이 제품이 파는 결함이다.
 *
 * ⭐ 그래서 머리말이 **그 사실을 적는다** — 「판정이 아니다」를 적지 않은 수는 언제든
 * 판정으로 읽힌다(`graduand rules` 가 자기 산출에 같은 줄을 다는 그 자리와 같다).
 */
/** 범위 한 줄 — ⭐ 전부 같으면 **한 수**다(없는 폭을 적지 않는다). */
const span = (range: Span): string => (range.from === range.to ? `${range.from}` : `${range.from}–${range.to}`);

function describeUndeclared(undeclared: UndeclaredFacts): string[] {
  const { documents, copies, copiesOmitted, blocks, surfaces } = undeclared;
  const lines = [
    '  seen without a declaration — facts, not a judgment: no pass, no violation, nothing red here',
  ];
  // 분모를 먼저 적는다 — 「사본 0」이 「문서를 못 읽었다」와 같아 보이지 않게.
  lines.push(
    documents.read === documents.tracked
      ? `    documents ${documents.tracked} read in full`
      : `    documents ${documents.tracked} tracked · ${documents.read} read — these numbers stand on a partial read`,
  );
  lines.push(
    blocks === 0
      ? '    copied blocks 0 — no block of 2+ lines lives verbatim in two documents'
      : `    copied blocks ${blocks} — the same block lives verbatim in two or more documents`,
  );
  for (const copy of copies) {
    lines.push(`      ${copy.files.length} homes · ${copy.lines} lines — ${copy.head}`);
    for (const file of copy.files) lines.push(`        ${file}`);
  }
  if (copiesOmitted > 0) {
    lines.push(`      … and ${copiesOmitted} more (the count above is complete)`);
  }
  lines.push('    a copy is not a violation — where a fact lives is the customer\'s call');
  lines.push('    it is a place that can diverge: two verbatim blocks part the day only one of them is fixed');
  // ⭐ 갈라진 쪽은 **다른 사실**이라 줄이 따로 선다 — 앞은 「아직 같다」, 뒤는 「이미 두 말을
  //   하고 있다」. 한 수로 접으면 요구하는 행동(집을 모은다 / 어느 쪽이 참인지 정한다)이 섞인다.
  lines.push(
    undeclared.divergedPairs === 0
      ? '    diverged copies 0 — no pair of blocks shares more lines than either version holds of its own'
      : `    diverged copies ${undeclared.divergedPairs} — pairs sharing more lines than either version holds of its own, yet not identical`,
  );
  // ⭐ 손잡이가 같은 쌍은 **가족으로 접어** 그린다 — 집이 N 이면 쌍이 C(N,2) 로 불어
  //   같은 손잡이가 열 몇 번 반복된다(실측). ⛔ 수를 잃지 않는다: 쌍마다 다르던 수는
  //   범위로 남고, 접는 손은 판정기 모듈의 하나다(페이지가 같은 함수를 부른다).
  for (const family of foldDiverged(undeclared.diverged)) {
    lines.push(
      `      ${family.files.length} homes · ${family.pairs} pair(s) · shared ${span(family.shared)} · differing ${span(family.differing)} — ${family.head}`,
    );
    for (const file of family.files) lines.push(`        ${file}`);
  }
  if (undeclared.divergedOmitted > 0) {
    lines.push(`      … and ${undeclared.divergedOmitted} more (the count above is complete)`);
  }
  if (undeclared.divergedTruncated) {
    // ⛔ 못 본 것을 「갈라짐 0」으로 접지 않는다 — 상한에 잘린 **목록**과 다른 사실이다.
    lines.push('      ⚠ the pair scan stopped at its ceiling — the count above is what was seen, not what is there');
  }
  // 선언할 수 있는 분모 — 어댑터 등록부 전수다(저장소가 분모를 정하지 않는다).
  lines.push('    shared-value surfaces that could be declared (by shape — contents are not read here):');
  for (const surface of surfaces) {
    const read =
      surface.files === 0
        ? 'no file of that shape is tracked'
        : surface.loaded === surface.files
          ? `${surface.loaded} with contents in this snapshot`
          : `${surface.loaded} of them with contents in this snapshot — the rest were not read, which is not "0 tokens"`;
    lines.push(`      ${surface.adapter}: files ${surface.files} — ${read}`);
  }
  return lines;
}

function formatReport(
  measurement: Measurement,
  grid: AdmissionGrid,
  overdue: readonly OverdueExemption[],
  entitlement: Entitlement,
): string {
  const { judgment } = measurement;
  const lines = [
    `graduand — verifier report`,
    `  repo:   ${judgment.repo ?? '(no remote found — unknown)'}`,
    `  commit: ${judgment.commit}`,
    `  source: ${measurement.source} · measured at ${measurement.measuredAt} · ${measurement.verifier.name} ${measurement.verifier.version}`,
  ];
  if (measurement.dirty === null) {
    lines.push('  ⚠ uncommitted changes: unknown — this count could not be read, which is not the same as 0');
  } else if (measurement.dirty > 0) {
    lines.push(`  ⚠ ${measurement.dirty} uncommitted file(s) — these numbers do not correspond exactly to the commit above`);
  }
  // 넘긴 만기는 **봉투의 사실**이라 봉투의 정직성 줄들(측정 시각 · 미커밋 변경) 옆에
  // 선다 — 판정 결과 절에 섞으면 위반처럼 읽히고, 위반 수는 이것으로 늘지 않는다.
  lines.push(...describeOverdue(overdue, utcDateOf(measurement.measuredAt)));
  // 자격은 **측정의 속성**이라 봉투의 정직성 줄들 옆에 선다 — 판정 결과 절에 섞으면
  // 위반처럼 읽히고, 위반 수는 이것으로 늘지 않는다(넘긴 만기와 달리 빨강도 아니다).
  lines.push(...describeEntitlement(entitlement));
  // ⭐ 만기 고지는 자격 줄 **바로 뒤**다 — 넘긴 뒤의 보고에서 「미판정 — 자격 없음」과
  // 전환 링크가 한 자리에 있어야 고객이 무엇을 하면 되는지가 한 화면에 든다. 사이를
  // 벌리면 「없다」만 읽히고 「하면 된다」가 스크롤 밖으로 나간다.
  lines.push(...describeExpiry(entitlement, utcDateOf(measurement.measuredAt)));
  lines.push('', `  notations scanned by refs: ${NOTATIONS.map((n) => n.id).join(' · ')}`);
  lines.push('  anything outside that enumeration is unjudged, not "0 violations"', '');
  for (const check of judgment.checks) lines.push(...describeCheck(check), '');
  const violations = judgment.checks.filter((c) => c.status === 'violation').length;
  const unjudged = judgment.checks.filter((c) => c.status === 'unjudged').length;
  lines.push(
    `  checks ${judgment.checks.length} — violation ${violations} · pass ${judgment.checks.length - violations - unjudged} · unjudged ${unjudged}`,
  );
  // 체크의 수와 격자의 수는 **다른 질문의 답**이고 둘 다 참이다 — 체크는 「이 저장소의
  // 축들이 무엇을 말하는가」, 격자는 「편입된 규칙이 선언된 표면에서 무엇을 말하는가」다.
  // 한 수로 합치지 않는다.
  lines.push('', ...describeGrid(grid));
  // ⭐ 선언 0 의 사실은 **격자 다음**이다 — 분모와 수를 먼저 말하고, 그 분모가 비어 있어
  //   재지 못한 자리에 대해 「그래도 보이는 것」을 적는다. 앞에 두면 그 사실이 판정의
  //   머리처럼 읽힌다.
  lines.push('', ...describeUndeclared(measurement.undeclared));
  return lines.join('\n');
}

/**
 * 체크아웃 N개의 보고 — 절마다 한 저장소이고, 끝에 **관할 합산** 한 줄이 선다. 체크아웃이
 * 하나면 합산 줄은 없다: 같은 수를 두 번 적는 것이고, 그 둘은 갈라질 수 있다.
 */
function formatReports(
  entries: readonly {
    measurement: Measurement;
    grid: AdmissionGrid;
    overdue: readonly OverdueExemption[];
    entitlement: Entitlement;
  }[],
): string {
  const sections = entries.map(({ measurement, grid, overdue, entitlement }) =>
    formatReport(measurement, grid, overdue, entitlement),
  );
  if (entries.length < 2) return sections.join('\n\n');
  const { cells, violation, pass, unjudged } = gridTotals(entries.map((e) => e.grid));
  sections.push(
    [
      `graduand — ${entries.length} checkouts in one job`,
      `  jurisdiction ${cells} — violation ${violation} · pass ${pass} · unjudged ${unjudged}   (across ${entries.length} checkouts)`,
    ].join('\n'),
  );
  return sections.join('\n\n');
}

/**
 * 파일시스템의 의미는 호스트 몫이다 — 스캐폴드 모듈은 node 를 모르고(페이지가 그대로
 * 쓴다), 「어디에 · 있는가 · 쓴다」 셋이 이 경계에서 들어간다.
 *
 * ⛔ git 이 없다 — `init` 은 추적도 커밋도 하지 않는다. 이 객체에 그 손이 없는 것이
 * 그 사실의 집행이다.
 */
const fsScaffoldIo: ScaffoldIo = {
  pathIn: (root) => join(root, DECLARATION_FILE),
  exists: (path) => existsSync(path),
  // `wx` — 있으면 쓰지 않고 던진다. 위의 exists 검사와 쓰기 사이의 틈을 커널이 닫는다.
  write: (path, text) => writeFileSync(path, text, { flag: 'wx' }),
};

/**
 * 핸들이 사는 자리 — ⭐ 위와 **같은 꼴, 다른 파일**이다(`ENTITLEMENT.file`). ⛔ 선언 파일이
 * 아니다: 과금 상태는 판정의 분모가 아니라서 선언 안에 들어가지 않는다.
 * ⛔ 여기에도 git 이 없다 — 커밋은 고객의 몫이고, 그 사실을 이 객체가 집행한다.
 */
const fsHandleIo: HandleIo = {
  pathIn: (root) => join(root, ENTITLEMENT.file),
  exists: (path) => existsSync(path),
  write: (path, text) => writeFileSync(path, text, { flag: 'wx' }),
};

/**
 * **이미 있는 선언** — 조립이 축을 더할 자리다. ⛔ 없으면 null 이고, 그것은 「새 선언을
 * 짓는다」다(묻지 않은 것과 섞이지 않는다 — 이 함수는 **언제나 묻는다**).
 *
 * ⚠️ **깨진 선언에는 더하지 않는다** — 던진다. 판정이 깨진 선언 앞에서 요란하게 멈추는 그
 * 자리와 같다: 읽을 수 없는 선언에 축을 더하면 우리가 그 파일의 나머지를 **추측해** 다시
 * 쓰는 일이고, 그 추측이 고객의 박제를 지울 수 있다.
 *
 * @throws DeclarationInvalidError 선언이 깨졌을 때.
 */
function baseDeclaration(root: string): ValidDeclaration | null {
  let text: string;
  try {
    text = readFileSync(join(root, DECLARATION_FILE), 'utf8');
  } catch {
    // 없거나 읽히지 않는다 — 조립은 새 선언을 짓고, **쓰는** 손이 덮어쓰기를 막는다(`wx`).
    return null;
  }
  const result = validateDeclaration(text);
  if (result.state === 'valid') return result;
  throw new DeclarationInvalidError(
    result.state === 'invalid'
      ? result.problems
      : [`${DECLARATION_FILE} could not be read as a declaration (${result.state})`],
  );
}

/**
 * 배달의 호스트 — ⚠️ **이름이 `overwrite` 다.** 스캐폴드의 `write` 가 `wx` 로 「있으면
 * 쓰지 않는다」를 커널에 맡긴 그 자리와 **다른 행위**라, 두 능력을 한 이름으로 부르지
 * 않는다: 한 이름이면 어느 호출이 덮어쓸 수 있는지 읽어서 알 수 없다.
 */
const fsDeliverIo: DeliverIo = {
  pathIn: (root) => join(root, DECLARATION_FILE),
  overwrite: (path, text) => writeFileSync(path, text),
};

/**
 * 자격의 세 입력이 이 경계에서 들어온다 — **커밋된 파일 하나 · 환경 하나 · 네트워크 하나.**
 *
 * ⛔ 키는 파일에서 읽지 않는다(`readKey` 가 환경만 본다) — 커밋되는 비밀은 비밀이 아니다.
 * ⛔ 핸들은 선언 파일에서 읽지 않는다 — 선언은 닫힌 스키마이고, 넓히면 과금 상태가 판정
 * 대상 안으로 들어온다. 두 파일 이름이 다른 상수에서 오는 것이 그 분리의 집행이다.
 *
 * ⚠️ 핸들 파일이 **있는데 못 읽히면** 던진다 — 호스트가 null 로 접으면 「없다」와
 * 「못 읽었다」가 같아지고, 그 둘은 요구하는 행동이 다르다.
 */
const entitlementIo = (root: string): EntitlementIo => ({
  readHandle: () => {
    const at = join(root, ENTITLEMENT.file);
    return existsSync(at) ? readFileSync(at, 'utf8') : null;
  },
  readKey: () => {
    const key = process.env[ENTITLEMENT.keyEnv];
    return key === undefined || key.trim() === '' ? null : key;
  },
  fetch: (...args) => fetch(...args),
});

/** 부작용은 경계에서 들어온다 — `process.exit` 과 「브라우저를 여는 것」이 같은 자리다. */
async function main(open: Opener): Promise<number> {
  const { roots, mode, command, flags } = parseArgs(process.argv.slice(2));

  // 사용법은 **stdout** 이다 — 물어서 받은 답이지 오류가 아니다(오류일 때만 stderr 로 간다).
  if (command === 'help') {
    console.log(USAGE);
    return 0;
  }

  if (command === 'init') {
    const outcome = initDeclaration(roots[0]!, fsScaffoldIo);
    const said = formatInitOutcome(outcome);
    for (const line of said.stdout) console.log(line);
    for (const line of said.stderr) console.error(line);
    return writeExitCode(outcome);
  }

  if (command === 'activate') {
    // ⭐⭐ **구독과 자격 사이의 한 걸음** — 키는 환경에서 오고(비밀), 핸들은 파일로 간다
    //    (커밋된다). 벤더를 부르는 것이 **먼저**이고 파일은 그 답을 받아 쓴다: 순서가
    //    뒤바뀌면 쓰지 못한 자리를 썼다고 적게 된다.
    // ⛔ 판정이 지나는 길에서는 이 함수가 불리지 않는다 — 자리를 쓰는 일은 고객이 친
    //    명령에만 있다(`hosts/entitlement.ts` 의 「자동 재활성화를 하지 않는다」).
    const outcome = await activateEntitlement(entitlementIo(roots[0]!), ENTITLEMENT.activationLabel);
    const write = outcome.state === 'activated' ? writeHandle(roots[0]!, fsHandleIo, outcome.activationId) : null;
    const said = formatActivation(outcome, write);
    for (const line of said.stdout) console.log(line);
    for (const line of said.stderr) console.error(line);
    return activateExitCode(outcome, write);
  }

  if (command === 'rules') {
    // ⭐ 루트를 **여럿** 받는다 — 한 잡의 체크아웃 N 개가 각자 자기 선언을 들고, 분모도
    //    그만큼이다. ⛔ 합산 줄이 없다: 분모는 저장소마다 **다른 헌법**을 가리킬 수 있고,
    //    그것을 한 수로 접는 것은 이 명령이 보여야 하는 바로 그 사실을 지우는 일이다.
    const views = loadWorkspaces(roots).map((load) => readRules(load.snapshot));
    console.log(mode === 'json' ? serializeRules(views) : formatRules(views));
    // ⛔ 빨강을 내지 않는다 — 분모를 묻는 행위는 무엇도 위반하지 않는다. 선언이 **없어도**
    //    0 이다: 「분모가 선언되지 않았다」는 사유와 함께 보고되는 미판정이다.
    return 0;
  }

  if (command === 'deliver') {
    // ⭐ 지목이 **선언에** 있으므로 로더의 2회차가 정본의 그 파일을 싣는다 — 의도를
    //    따로 넘기는 자리는 조립(`link`)의 몫이고, 여기서는 선언이 이미 분모다.
    const loads = loadWorkspaces(roots);
    const target = loads[0]!;
    const peers = loads.slice(1).map((load) => load.snapshot);
    const outcome = planDelivery(target.snapshot, peers);
    if (outcome.kind === 'refused') {
      for (const line of formatDeliverRefusal(outcome)) console.error(line);
      return 2;
    }
    const write = deliver(roots[0]!, fsDeliverIo, outcome);
    const said = formatDelivery(outcome, write);
    for (const line of said.stdout) console.log(line);
    for (const line of said.stderr) console.error(line);
    return deliverExitCode(write);
  }

  if (command === 'canon' || command === 'link') {
    // ⭐ 선언한 파일의 **본문**을 함께 싣는다 — 지목이 선언에 아직 없으므로(그 선언을 짓는
    //   중이다) 로더가 그것을 인자로 받는다. 조립은 그 본문으로 트리오를 읽어 본다.
    const intent = intentOf(
      command,
      flags,
      (trio) => (trio === null ? null : loadWorkspaceSnapshot(roots[0]!, trio.files).snapshot),
      // ⭐⭐ **이미 있는 선언에 축을 더하는 자리** — 「헌법 여럿」이 도구로 서는 지점이다.
      //   디자인 헌법을 선언한 저장소가 API 헌법을 더할 때 조립이 **그 선언 전부 + 축 하나**를
      //   내고, 고객이 두 선언을 손으로 합치는 그 행위가 사라진다.
      baseDeclaration(roots[0]!),
    );
    // ⭐ 시야는 **첫 루트를 뺀 나머지**다 — 첫 루트는 쓸 자리이고, 자기 자신이 자기 정본의
    //    시야에 들어오는 모양을 만들지 않는다(판정의 「자기 자신은 시야에 들어오지 않는다」와
    //    같은 규율). ⭐ 지목이 **선언이 아니라 의도**에서 오므로 로더가 그것을 받는다 —
    //    아직 선언이 없어서(그 선언을 짓는 중이다) 1회차의 선언 읽기로는 알 수 없다.
    const peers =
      intent.kind === 'link'
        ? loadWorkspaces(roots.slice(1), [intent.canon]).map((load) => load.snapshot)
        : [];
    const composed = composeConstitution(intent, peers);
    if (composed.kind === 'refused') {
      for (const line of formatRefusal(composed)) console.error(line);
      return 2;
    }
    const write = writeDeclaration(roots[0]!, fsScaffoldIo, composed.json);
    const said = formatCompose(command, composed, write);
    for (const line of said.stdout) console.log(line);
    for (const line of said.stderr) console.error(line);
    return writeExitCode(write);
  }

  const loads = loadWorkspaces(roots);
  const measuredAt = new Date().toISOString();
  // ⭐ 자격은 판정 **밖에서** 물어 **인자로** 들어간다 — 판정은 순수 함수이고, 묻는 손은
  // 호스트다. 체크아웃마다 그 저장소의 핸들로 묻는다: 핸들이 저장소에 커밋되는 이유가
  // 바인딩이라, 하나로 물어 전부에 쓰면 그 바인딩이 장식이 된다(하나 사서 전부에 쓴다).
  // ⭐ 만기를 판정하는 날짜는 **봉투의 그 날짜**다 — 자격을 풀 때 시계를 다시 읽으면
  // 한 보고 안에서 「측정 시각」과 「만기를 센 날」이 갈라질 수 있다(자정 경계).
  const onDate = utcDateOf(measuredAt);
  const entitlements = await Promise.all(roots.map((root) => resolveEntitlement(entitlementIo(root), onDate)));
  // 각 체크아웃은 **나머지 전부를 시야로** 판정된다 — 자기 자신은 시야에 들어오지 않는다.
  const entries = loads.map((load, at) => {
    const peers = loads.filter((_, other) => other !== at).map((other) => other.snapshot);
    const entitlement = entitlements[at]!;
    const judgment = judgeSnapshot(load.snapshot, { peers, entitlement });
    const measurement: Measurement = {
      judgment,
      source: load.source,
      measuredAt,
      verifier: { name: VERIFIER.name, version: VERIFIER.version },
      dirty: load.dirty,
      // ⭐ 격자를 **여기서 한 번** 센다 — 선언 바이트와 판정 결과를 둘 다 쥔 자리가 여기다.
      //   보고는 이 수를 그대로 싣고(아래), 요약은 봉투째 나른다: 세는 손이 하나로 남는다.
      // ⭐ 자격이 **격자에도** 실린다 — 편입·격자·면제는 선언 자신의 기능이라, 축의 가름
      //   만으로는 무료 축만 고른 규칙 줄에서 수가 샌다(`grid.ts` 의 산문이 그 자리다).
      grid: admissionGrid(load.snapshot, judgment.checks, entitlement),
      // ⭐ 선언 0 의 사실도 **여기서 한 번** 읽는다 — 스냅샷을 쥔 자리가 여기다. ⛔ 판정이
      //   아니므로 빨강의 근거에 들어가지 않는다(종료 코드는 위반과 넘긴 만기 둘뿐이다).
      undeclared: readUndeclared(load.snapshot),
      // 시야에 이름이 없는 체크아웃은 지목될 수도 없다 — 이름 없는 것을 적지 않는다.
      peers: peers.map((peer) => peer.repo).filter((repo): repo is string => repo !== null).sort(),
    };
    // 만기는 판정 **다음**에, 봉투에서 본다 — 모드와 무관하게 본다: 게이트는 보고 형식이
    // 아니라 측정의 성질이고, `--json` 으로 돌린 CI 가 만기를 못 보면 그 초록은 거짓이다.
    return { load, measurement, entitlement, overdue: overdueExemptions(load.snapshot, measuredAt) };
  });

  // 빨강의 근거는 보고 형식에 매이지 않는다 — 보고 모드는 보고 안에서 말하고(봉투의
  // 정직성 줄들 옆), 나머지 모드는 stderr 로 말한다: `--json` 의 stdout 은 측정 하나가
  // 한 줄이라 거기에 산문을 끼우면 파싱이 깨진다.
  if (mode !== 'report') {
    for (const { measurement, overdue, entitlement } of entries) {
      for (const line of describeOverdue(overdue, utcDateOf(measurement.measuredAt))) console.error(line);
      // 자격도 보고 형식에 매이지 않는다 — `--json` 으로 돌린 CI 가 「수가 왜 없는가」를
      // 못 들으면 그 미판정은 사유 없는 미판정과 구별되지 않는다.
      for (const line of describeEntitlement(entitlement)) console.error(line);
      // 만기 고지도 그렇다 — 만기가 보고 모드에서만 보이면 `--json` 으로 도는 CI 의 고객은
      // 만기일을 **한 번도** 듣지 못한 채 어느 날 수를 잃는다.
      for (const line of describeExpiry(entitlement, utcDateOf(measurement.measuredAt))) console.error(line);
    }
  }

  if (mode === 'json') {
    // 측정 하나가 한 줄 — 체크아웃마다 독립적으로 파싱된다.
    for (const { measurement } of entries) console.log(serializeMeasurement(measurement));
  } else if (mode === 'fragment') console.log(await encodeFragment(entries[0]!.measurement));
  else if (mode === 'open') {
    const said = formatOpenOutcome(await openReport(entries[0]!.measurement, open));
    for (const line of said.stdout) console.log(line);
    for (const line of said.stderr) console.error(line);
  } else {
    console.log(
      formatReports(
        entries.map(({ load, measurement, overdue, entitlement }) => ({
          measurement,
          overdue,
          entitlement,
          // ⭐ 봉투가 든 그 격자다 — 같은 측정 안에서 두 번 세지 않는다.
          grid: measurement.grid,
        })),
      ),
    );
  }

  // 두 근거를 세는 손은 하나다(`gateExitCode`) — 여기서 위반만 세고 만기를 따로 보면,
  // 한쪽만 보는 경로가 언제든 생길 수 있고 그 경로의 초록이 거짓이 된다.
  return gateExitCode(entries);
}

main(systemOpener).then(
  (code) => process.exit(code),
  (error: unknown) => {
    if (error instanceof UsageError) {
      console.error(`❌ ${error.message}`);
      console.error(USAGE);
    } else if (error instanceof DeclarationInvalidError) {
      console.error(`❌ judgment failed — ${error.message}`);
      console.error('   A broken declaration is loud on purpose: a silently ignored typo would read as "pass".');
    } else if (error instanceof AdapterParseError) {
      console.error(`❌ judgment failed — ${error.message}`);
      console.error('   A parse failure is loud on purpose: a file the adapter cannot read is not a file with 0 tokens.');
    } else if (error instanceof RepoUnreadableError) {
      console.error(`❌ judgment failed — ${error.message}`);
    } else {
      console.error(`❌ ${(error as Error).stack ?? String(error)}`);
    }
    process.exit(2);
  },
);
