/**
 * 면제 목록 · 봉투의 만기 판정 · 종료 코드 — 이슈 AC1~AC6 전수.
 *
 * 받는 것 넷: 만기가 **봉투**에서 판정되는가(`Judgment` 는 시각을 모르는가) · 넘긴 만기가
 * **빨강**인가(장식이 아닌가) · 그 빨강이 **위반 수를 늘리지 않는가** · 승인자와 집행 강도가
 * 스키마와 소스에 **0 건**인가.
 *
 * ⛔ 「지금」을 읽는 테스트를 쓰지 않는다 — 날짜를 고정하거나(순수 함수에 `measuredAt` 을
 * 넘긴다), 실제 시각으로 돌리는 CLI 는 어느 날 돌려도 같은 쪽에 떨어지는 만기(먼 과거 ·
 * 먼 미래)를 준다. 오늘 초록이고 내일 빨강인 테스트는 이 제품이 파는 결함 그 자체다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeOverdue, gateExitCode, overdueExemptions, utcDateOf } from './expiry.ts';
import { EXEMPTION_KEYS, validateDeclaration, type ValidDeclaration } from './declaration.ts';
import { admissionGrid, gridCounts } from './grid.ts';
import { judgeSnapshot } from './judge.ts';
import { serializeJudgment, type Measurement } from './schema.ts';
import type { RepoSnapshot } from './snapshot.ts';
import { VERIFIER } from './version.ts';

/** 면제된 규칙 하나와 그 만기 — 기대값의 **유일한 출처**다(아래 전부가 여기서 읽는다). */
const EXEMPT_RULE = 'FH7';
const EXEMPT_REASON = '이 저장소에 그 표면이 없다';
const EXPIRES = '2026-06-30';

const declarationText = (expires: string): string =>
  `${JSON.stringify({
    ui: ['app/'],
    admissions: { FH11: { verifiers: ['refs'] } },
    exemptions: { [EXEMPT_RULE]: { reason: EXEMPT_REASON, expires } },
  })}\n`;

const FILES = (expires: string): Record<string, string> => ({
  'README.md': '[guide](docs/guide.md)\n',
  'docs/guide.md': 'ok\n',
  'app/main.ts': 'export {};\n',
  'graduand.json': declarationText(expires),
});

function snap(files: Record<string, string>): RepoSnapshot {
  return {
    repo: 'acme/widgets',
    commit: 'e'.repeat(40),
    paths: Object.keys(files).sort(),
    files: new Map(Object.entries(files)),
  };
}

/** 봉투 하나 — 같은 커밋을 **다른 시각**에 측정한 것만 다르다. */
const measure = (snapshot: RepoSnapshot, measuredAt: string): Measurement => ({
  judgment: judgeSnapshot(snapshot),
  source: 'workspace',
  measuredAt,
  verifier: { name: VERIFIER.name, version: VERIFIER.version },
  dirty: 0,
  // 개정 3 — 봉투가 격자와 시야를 든다. 빈 격자는 사유를 들고(빈 분모는 미판정),
  // 빈 시야는 「한 저장소 표면」이다.
  grid: { surfaces: [], rules: [], reason: 'no-declaration' },
  undeclared: {
    copies: [],
    copiesOmitted: 0,
    blocks: 0,
    diverged: [],
    divergedOmitted: 0,
    divergedPairs: 0,
    divergedTruncated: false,
    documents: { tracked: 0, read: 0 },
    surfaces: [],
  },
  peers: [],
});

const gateOf = (snapshot: RepoSnapshot, measuredAt: string): 0 | 1 =>
  gateExitCode([{ measurement: measure(snapshot, measuredAt), overdue: overdueExemptions(snapshot, measuredAt) }]);

// ---- 끝-끝: 실제 CLI 의 종료 코드 ----

function gitFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-expiry-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const git = (...args: string[]) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', 'https://github.com/acme/widgets.git');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fixture');
  return root;
}

const runCli = (root: string, ...args: string[]) =>
  spawnSync(process.execPath, [fileURLToPath(new URL('./cli.ts', import.meta.url)), '--root', root, ...args], {
    encoding: 'utf8',
  });

/** 어느 날 돌려도 같은 쪽에 떨어지는 만기 — 실제 시각으로 도는 CLI 의 입력이다. */
const FAR_FUTURE = '2099-12-31';
const FAR_PAST = '2000-01-01';

test('AC1 — 만기가 미래인 면제: 그 칸은 미판정(선언된 면제)이고 게이트는 초록(exit 0)', () => {
  const snapshot = snap(FILES(EXPIRES));
  const checks = judgeSnapshot(snapshot).checks;
  const grid = admissionGrid(snapshot, checks);

  // 칸은 **남는다** — 분모에서 빠지는 것이 금지된 것이고, 사유가 붙은 미판정으로 센다.
  const row = grid.rules.find((r) => r.rule === EXEMPT_RULE) ?? assert.fail('면제 줄이 격자에 없다');
  assert.equal(row.status, 'unjudged');
  assert.equal(row.reason, 'declared-exemption');
  assert.equal(gridCounts(grid).cells, grid.rules.length * grid.surfaces.length);

  // 만기 **전날**까지 넘긴 것이 없고, 게이트는 초록이다.
  const measuredAt = '2026-06-29T12:00:00.000Z';
  assert.deepEqual(overdueExemptions(snapshot, measuredAt), []);
  assert.equal(gateOf(snapshot, measuredAt), 0);

  // 실제 CLI — 먼 미래의 만기로 돌려도 초록이고, 보고에 만기 줄이 **없다**.
  const r = runCli(gitFixture(FILES(FAR_FUTURE)));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /expiry/);
  assert.match(r.stdout, new RegExp(`${EXEMPT_RULE}: unjudged \\(declared-exemption\\)`));
});

test('AC2 — 만기를 넘긴 면제: exit 1 이고 이유가 「넘긴 만기」로 보고된다 (위반 수는 늘지 않는다)', () => {
  const snapshot = snap(FILES(EXPIRES));
  const measuredAt = '2026-07-01T00:00:00.000Z';

  const overdue = overdueExemptions(snapshot, measuredAt);
  assert.deepEqual(overdue, [{ rule: EXEMPT_RULE, reason: EXEMPT_REASON, expires: EXPIRES }]);
  assert.equal(gateOf(snapshot, measuredAt), 1);

  // ⚠️ 빨강의 둘째 근거는 **위반이 아니다** — 판정의 수는 만기 전과 한 건도 다르지 않다.
  const before = judgeSnapshot(snapshot).checks;
  assert.equal(before.filter((c) => c.status === 'violation').length, 0);
  assert.equal(gridCounts(admissionGrid(snapshot, before)).violation, 0);

  // 말해지는가 — 종료 코드만 1 로 바꾸고 이유를 적지 않으면 위반 0 인 보고 앞의 빨강이다.
  const said = describeOverdue(overdue, utcDateOf(measuredAt)).join('\n');
  assert.match(said, new RegExp(EXEMPT_RULE));
  assert.match(said, new RegExp(EXPIRES));
  assert.match(said, /expiry/);

  // 실제 CLI — 보고 모드는 보고 안에서 말하고, 위반 0 이라는 수는 그대로다.
  const root = gitFixture(FILES(FAR_PAST));
  const report = runCli(root);
  assert.equal(report.status, 1, report.stdout + report.stderr);
  assert.match(report.stdout, /past their expiry/);
  assert.match(report.stdout, new RegExp(`${EXEMPT_RULE}: expired ${FAR_PAST}`));
  assert.match(report.stdout, /violation 0/);

  // 게이트는 보고 형식에 매이지 않는다 — `--json` 의 stdout 은 파싱되는 채로 남고(측정
  // 하나가 한 줄), 이유는 stderr 로 말해진다. 그 경로가 초록이면 그 초록은 거짓이다.
  const json = runCli(root, '--json');
  assert.equal(json.status, 1, json.stderr);
  assert.match(json.stderr, /past their expiry/);
  assert.equal(JSON.parse(json.stdout.trim()).judgment.commit.length, 40);
});

test('AC3 — 같은 커밋 · 다른 measuredAt: Judgment 는 바이트 동일이고 만기만 봉투에서 갈린다', () => {
  const snapshot = snap(FILES(EXPIRES));
  const before = measure(snapshot, '2026-06-01T00:00:00.000Z');
  const after = measure(snapshot, '2027-06-01T00:00:00.000Z');

  // 판정은 시각을 모른다 — canonical 직렬화가 **바이트 동일**하다.
  assert.equal(serializeJudgment(before.judgment), serializeJudgment(after.judgment));
  assert.notEqual(before.measuredAt, after.measuredAt);

  // 갈라지는 것은 봉투를 보는 쪽 하나다.
  assert.deepEqual(overdueExemptions(snapshot, before.measuredAt), []);
  assert.equal(overdueExemptions(snapshot, after.measuredAt).length, 1);
  assert.equal(gateExitCode([{ measurement: before, overdue: overdueExemptions(snapshot, before.measuredAt) }]), 0);
  assert.equal(gateExitCode([{ measurement: after, overdue: overdueExemptions(snapshot, after.measuredAt) }]), 1);
});

test('AC4 — 만기 비교는 UTC 날짜 절단이고, 만기일 당일은 넘긴 것이 아니다', () => {
  const snapshot = snap(FILES(EXPIRES));
  const overdueOn = (measuredAt: string) => overdueExemptions(snapshot, measuredAt).length;

  // ⭐ **당일은 유효하다**(`expires` = 「이 날까지」, 포함). 날짜는 순간이 아니라 하루이고,
  // 당일을 넘긴 것으로 읽으면 고객이 적은 그 날짜는 어느 측정에서도 유효한 적이 없다 —
  // 오늘 적은 면제가 적는 순간 빨강이 되고, 「만기」가 「만기 전날까지」를 뜻하게 된다.
  assert.equal(utcDateOf('2026-06-30T00:00:00.000Z'), EXPIRES);
  assert.equal(overdueOn('2026-06-30T00:00:00.000Z'), 0);
  assert.equal(overdueOn('2026-06-30T23:59:59.999Z'), 0);
  // 넘김은 **다음 날 00:00 UTC** 부터다.
  assert.equal(overdueOn('2026-07-01T00:00:00.000Z'), 1);

  // 자르는 자리는 UTC 하나다 — 지역 시간대로 자르면 같은 봉투가 기계마다 다른 날짜를 낸다.
  // 지역 날짜로는 7월 1일이지만 UTC 로는 6월 30일 15:30 이라 **아직 넘기지 않았다**.
  assert.equal(utcDateOf('2026-07-01T00:30:00+09:00'), EXPIRES);
  assert.equal(overdueOn('2026-07-01T00:30:00+09:00'), 0);
  // 반대편 — 지역 날짜로는 6월 30일이지만 UTC 로는 7월 1일이라 **넘겼다**.
  assert.equal(utcDateOf('2026-06-30T23:00:00-05:00'), '2026-07-01');
  assert.equal(overdueOn('2026-06-30T23:00:00-05:00'), 1);

  // 읽을 수 없는 시각으로는 만기를 판정하지 않는다 — 조용히 통과시키지 않는다.
  assert.throws(() => utcDateOf('어제'), /not a readable instant/);
});

test('AC5 — 선언 스키마에 승인자 필드가 없다: 키 목록은 둘로 닫혀 있고 다른 이름은 판정 실패다', () => {
  // 닫힌 목록이 그 집행이다 — `reason` 과 `expires` 둘뿐이다.
  assert.deepEqual([...EXEMPTION_KEYS], ['reason', 'expires']);

  const valid = validateDeclaration(declarationText(EXPIRES)) as ValidDeclaration;
  assert.deepEqual(Object.keys(valid.exemptions![EXEMPT_RULE]!).sort(), [...EXEMPTION_KEYS].sort());

  // 승인·요청·서명의 이름은 전부 거부된다 — 확인 기전이 0 인 선언을 받지 않는다.
  for (const key of ['approvedBy', 'approved_by', 'requestedBy', 'approver', 'signedOffBy', 'owner']) {
    const text = `{"exemptions": {"${EXEMPT_RULE}": {"reason": "없다", "expires": "${EXPIRES}", "${key}": "henry"}}}`;
    assert.equal(validateDeclaration(text).state, 'invalid', `${key} 가 받아들여졌다`);
  }

  // 소스에도 **읽는 자리가 0** 이다 — 승인자는 git 이 갖는다(감사는 `git log -S` 다).
  // ⚠️ 산문의 언급은 남는다: 왜 없는지를 적는 줄이 그 결정의 집행이고, 그 줄을 지우면
  // 다음 사람이 「없으니 추가하자」로 읽는다. 받지 않는 것은 **코드가 읽는 꼴**이다.
  const reads = /\.(approvedBy|approver|requestedBy|signedOffBy|owner)\b|\[\s*['"`](approvedBy|approver|requestedBy|signedOffBy)['"`]\s*\]/;
  for (const [file, text] of judgmentSources()) {
    assert.doesNotMatch(text, reads, `${file} 이 승인자를 읽는다`);
    for (const line of codeLines(text)) {
      assert.doesNotMatch(line, /approv|signedOff|signed_off/i, `${file} 의 코드가 승인자를 안다: ${line}`);
    }
  }
});

test('AC6 — 판정 소스에 `enforcement` 를 읽는 코드가 0 이다 (유예 축은 발명되지 않았다)', () => {
  // 읽는 꼴 전수 — 속성 접근 · 색인 · 구조분해. 하나라도 있으면 유예가 선 것이다.
  const reads = /\.enforcement\b|\[\s*['"`]enforcement['"`]\s*\]|\benforcement\s*[,}]|\bseverity\b/i;
  for (const [file, text] of judgmentSources()) {
    assert.doesNotMatch(text, reads, `${file} 이 집행 강도를 읽는다`);
    // 코드에 남아 있는 언급은 **거부 표**(`NO_PLACE`)의 키 하나뿐이다 — 거부는 읽는 것이
    // 아니다. 산문의 언급은 남는다: 왜 축이 없는지를 적는 줄이 그 결정의 집행이다.
    for (const line of codeLines(text)) {
      if (!/enforcement/i.test(line)) continue;
      assert.ok(
        /^enforcement:\s*'/.test(line) && file === 'declaration.ts',
        `읽는 자리로 보인다: ${file} — ${line}`,
      );
    }
  }

  // 그리고 선언은 그 이름을 **요란하게** 거부한다 — 읽는 코드 0 인 필드는 거짓 초록이다.
  const r = validateDeclaration('{"admissions": {"FH11": {"enforcement": "warn"}}}');
  assert.equal(r.state, 'invalid');
  assert.ok((r as { problems: string[] }).problems.some((p) => p.includes('no axis')));
});

/**
 * 주석을 걷어낸 **코드 줄**만 — 산문은 판정하지 않는다(왜 없는지를 적는 줄이 결정의
 * 집행이라 지우지 않는다). ⚠️ 블록 주석의 속줄(`*`)과 줄 주석(`//`)을 버리는 보수적
 * 거르기다: 코드와 주석이 한 줄에 같이 있으면 그 줄은 **코드로 남아** 판정된다.
 */
const codeLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('*') && !line.startsWith('/*') && !line.startsWith('//'));

/**
 * 판정 소스 전수 — 테스트가 아닌 `.ts` 파일. ⛔ 목록을 손으로 적지 않는다: 적은 목록은
 * 새 파일이 생기는 날 조용히 그 파일을 비껴가고, 비껴간 파일이 유예가 숨는 자리다.
 */
function judgmentSources(): [string, string][] {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const out: [string, string][] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const at = join(dir, entry.name);
      if (entry.isDirectory()) walk(at, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        out.push([`${prefix}${entry.name}`, readFileSync(at, 'utf8')]);
      }
    }
  };
  walk(root, '');
  assert.ok(out.length > 10, '판정 소스를 찾지 못했다');
  return out;
}
