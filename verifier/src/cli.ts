#!/usr/bin/env node
/**
 * `graduand` CLI — 워크스페이스를 판정하는 측정 명령. 비공개 저장소의 데모·CI 가 쓴다.
 *
 *   graduand [--root <path>]... [--json | --fragment | --open]
 *   graduand init [--root <path>]
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

import { loadWorkspaces } from './hosts/workspace.ts';
import { judgeSnapshot } from './judge.ts';
import { admissionGrid, gridCounts, gridTotals, type AdmissionGrid } from './grid.ts';
import { serializeMeasurement, type CheckResult, type Measurement } from './schema.ts';
import { DECLARATION_FILE, DeclarationInvalidError } from './declaration.ts';
import { AdapterParseError } from './adapters/adapter.ts';
import { RepoUnreadableError } from './snapshot.ts';
import { encodeFragment } from './fragment.ts';
import { formatInitOutcome, initDeclaration, initExitCode, type ScaffoldIo } from './scaffold.ts';
import { describeOverdue, gateExitCode, overdueExemptions, utcDateOf, type OverdueExemption } from './expiry.ts';
import { describeEntitlement, describeExpiry, ENTITLEMENT, type Entitlement } from './entitlement.ts';
import { resolveEntitlement, type EntitlementIo } from './hosts/entitlement.ts';
import { formatOpenOutcome, openReport, systemOpener, type Opener } from './open.ts';
import { NOTATIONS } from './verifiers/notations.ts';
import { REFS_CHECK_ID } from './verifiers/refs.ts';
import { VERIFIER } from './version.ts';

const USAGE = [
  'usage: graduand [--root <path>]... [--json | --fragment | --open]',
  '       graduand init [--root <path>]',
  '       graduand --help',
].join('\n');

type Mode = 'report' | 'json' | 'fragment' | 'open';

/** 하위 명령 — 없으면 판정이다. 닫힌 목록이고, 모르는 이름은 조용히 무시되지 않는다. */
const COMMANDS = ['init'] as const;
/** `help` 는 하위 명령 이름이 아니라 플래그가 고르는 행위다 — 그래서 위 목록에 없다. */
type Command = 'judge' | 'help' | (typeof COMMANDS)[number];

/** 사용법을 묻는 플래그 — 둘 다 받는다(관행이고, 틀린 쪽을 고르면 아무것도 못 듣는다). */
const HELP_FLAGS = ['--help', '-h'] as const;

function parseArgs(argv: string[]): { roots: string[]; mode: Mode; command: Command } {
  // ⭐ **먼저 본다.** 뒤의 검증을 지나게 하면 `graduand --help --json` 이 사용법 오류로
  // 죽고, 사용법을 물은 사람이 받는 것이 사용법이 아니라 질책이 된다 — 그 exit 2 는
  // 「도구가 광고한 것과 하는 것이 다르다」의 가장 값싼 판이다.
  if (argv.some((arg) => (HELP_FLAGS as readonly string[]).includes(arg))) {
    return { roots: ['.'], mode: 'report', command: 'help' };
  }
  /** 적힌 순서대로의 체크아웃. 비면 `.` 하나다 — 기본은 지금 있는 저장소다. */
  const roots: string[] = [];
  let mode: Mode = 'report';
  let command: Command = 'judge';
  /** 보고 플래그가 **적혔는가** — `init` 과 섞이면 사용법 오류다(기본값과 구분된다). */
  let modeFlag: string | null = null;
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
    } else if (arg === '--json' || arg === '--fragment' || arg === '--open') {
      mode = arg.slice(2) as Mode;
      modeFlag = arg;
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  // 조용히 무시하지 않는다 — `init --json` 을 받아 놓고 판정을 내지 않으면, 요청한 것과
  // 한 것이 어긋난 채 exit 0 이다. 이 제품이 파는 결함의 모양 그대로다.
  if (command === 'init' && modeFlag !== null) {
    throw new UsageError(`init takes no report flags: ${modeFlag}`);
  }
  if (roots.length === 0) roots.push('.');
  // 선언을 쓰는 것은 한 저장소의 행위다 — 여러 루트를 받아 그중 하나에만 쓰면, 요청한
  // 것과 한 것이 어긋난다.
  if (command === 'init' && roots.length > 1) {
    throw new UsageError('init writes one declaration — pass a single --root');
  }
  // fragment · open 은 **측정 하나**를 싣는다(주소 하나 · 요약 하나). 여러 체크아웃을
  // 받아 그중 하나만 실으면 나머지는 조용히 사라진다.
  if ((mode === 'fragment' || mode === 'open') && roots.length > 1) {
    throw new UsageError(`--${mode} carries one measurement — pass a single --root`);
  }
  return { roots, mode, command };
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
  const { roots, mode, command } = parseArgs(process.argv.slice(2));

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
    return initExitCode(outcome);
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
    const measurement: Measurement = {
      judgment: judgeSnapshot(load.snapshot, { peers, entitlement }),
      source: load.source,
      measuredAt,
      verifier: { name: VERIFIER.name, version: VERIFIER.version },
      dirty: load.dirty,
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
          grid: admissionGrid(load.snapshot, measurement.judgment.checks),
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
