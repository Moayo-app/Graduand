/**
 * 고객 CI 와 에이전트의 입구 — AC 전수.
 *
 * ① `graduand rules` — 선언이 **무엇을 분모로 세웠는가**. ⛔ 판정하지 않는다.
 * ② 입구들(재사용 Action · GitLab include · 빅버킷 조각) — 변환의 손이 **하나**인가.
 *
 * ⭐⭐ **입구의 분모를 손으로 적지 않는다** — `verifier/ci/` 의 `.yml` 전수가 분모다.
 * 목록을 여기 적으면 넷째 입구가 그 목록 **밖에서** 태어날 수 있고, 가드가 보지 못한
 * 입구는 argv 를 자기가 지어도 초록이다.
 *
 * ⭐ 여기 negative 가 양성보다 많다 — 입구의 결함은 전부 **조용한** 모양이다(빠뜨린
 * 루트 · 접힌 종료 코드 · 돌지 못한 채 초록). 울지 않는 가드는 장식이라, 울어야 하는
 * 자리마다 테스트를 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, chmodSync, constants, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { admissionGrid, admissionShape, cellCount } from './grid.ts';
import { judgeSnapshot } from './judge.ts';
import { parseRules, readRules, serializeRules } from './rules.ts';
import { SCHEMA_VERSION, VersionMismatchError } from './schema.ts';
import { loadWorkspaceSnapshot } from './hosts/workspace.ts';

const cliPath = (): string => fileURLToPath(new URL('./cli.ts', import.meta.url));
const ciDir = (): string => fileURLToPath(new URL('../ci/', import.meta.url));
const scriptPath = (): string => join(ciDir(), 'graduand-ci.sh');
const peersPath = (): string => join(ciDir(), 'graduand-peers.sh');

/**
 * 출하된 입구 전수 — ⭐ **디렉터리에서 받는다**(손으로 적은 목록이 아니다). 입구를 더하면
 * 가드의 분모가 **저절로** 늘고, 아래 단정들이 그 새 입구에도 걸린다.
 */
const entrances = (): { name: string; text: string }[] =>
  readdirSync(ciDir())
    .filter((name) => name.endsWith('.yml'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(ciDir(), name), 'utf8') }));

/**
 * 산문을 뺀 본문 — ⚠️ 주석은 플래그를 **설명한다**(고객이 읽는 자리다). 재는 것은 「그
 * 플래그를 **코드가** 적는가」이고, 둘을 섞으면 설명을 지워야 초록이 된다.
 */
const code = (text: string): string =>
  text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');

/** 셸 하네스는 POSIX 셸을 요구한다 — 없는 플랫폼에서는 그 사실을 적고 건너뛴다. */
const POSIX = process.platform !== 'win32';

function gitFixture(files: Record<string, string>, remote?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-ci-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const git = (...args: string[]) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  if (remote !== undefined) git('remote', 'add', 'origin', remote);
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fixture');
  return root;
}

const runCli = (args: string[]) =>
  spawnSync(process.execPath, [cliPath(), ...args], { encoding: 'utf8' });

const runScript = (env: NodeJS.ProcessEnv) =>
  spawnSync('sh', [scriptPath()], { encoding: 'utf8', env: { ...process.env, ...env } });

const DESIGN_CANON = { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' };
const API_CANON = { repo: 'acme/contracts', file: 'tokens/api.css', scope: '@theme' };

/**
 * 축 둘이 **서로 다른 정본**을 가리키는 선언 — 이 객체가 기대값의 **유일한 출처**다.
 * ⛔ 기대 칸 수도 축 수도 상수로 적지 않는다: 아래 전부가 이 객체에서 센다.
 */
const TWO_AXES = {
  ui: ['app/', 'README.md'],
  'shared-values': {
    design: {
      adapter: 'css-custom-properties',
      files: ['app/theme.css'],
      scope: ':root',
      canon: DESIGN_CANON,
      pinned: { '--paper': '#f6f5f2', '--ink': '#23263a' },
    },
    api: {
      adapter: 'css-custom-properties',
      files: ['app/theme.css'],
      scope: '@theme',
      canon: API_CANON,
      pinned: { '--timeout': '30s' },
      diverged: { '--retries': '이 서비스는 멱등하지 않다' },
    },
  },
  admissions: {
    FH11: { verifiers: ['shared-values', 'shared-values-cross'] },
    FH12: { verifiers: ['refs'] },
    FH13: { verifiers: [] },
  },
  exemptions: { FH20: { reason: '이 저장소에 그 표면이 없다', expires: '2027-01-31' } },
};

const twoAxisFixture = (): string =>
  gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify(TWO_AXES, null, 2)}\n`,
      'app/theme.css': ':root {\n  --paper: #f6f5f2;\n  --ink: #23263a;\n}\n@theme {\n  --timeout: 30s;\n}\n',
    },
    'https://github.com/acme/widgets.git',
  );

const bareFixture = (): string => gitFixture({ 'README.md': 'ok\n' });
const brokenFixture = (): string =>
  gitFixture({ 'README.md': 'ok\n', 'graduand.json': '{"palette": {}}\n' });
/** refs 축의 위반 하나 — 종료 코드 1 이 입구를 **그대로** 지나는지 묻는 자리다. */
const violationFixture = (): string =>
  gitFixture({
    'README.md': '[gone](docs/nowhere.md)\n',
    'graduand.json': `${JSON.stringify({ ui: ['README.md'], admissions: { R1: { verifiers: ['refs'] } } }, null, 2)}\n`,
  });

// ─── ① `graduand rules` ───

test('rules AC1 — 축마다 정본 주소가 한 줄씩 서고, 규칙마다 고른 판정기가 적힌다', () => {
  const root = twoAxisFixture();
  const r = runCli(['rules', '--root', root]);
  assert.equal(r.status, 0, r.stderr);

  // ⭐ 개정 4 의 「헌법 여럿」이 **사람 눈에** 서는 자리다 — 축마다 주소가 따로 적힌다.
  for (const [axis, canon] of [
    ['design', DESIGN_CANON],
    ['api', API_CANON],
  ] as const) {
    const line = r.stdout.split('\n').find((l) => l.trim().startsWith(`${axis} — `));
    assert.ok(line !== undefined, `${axis} 축의 줄이 없다:\n${r.stdout}`);
    for (const part of [canon.repo, canon.file, canon.scope]) assert.ok(line.includes(part), `${axis}: ${part}`);
  }
  assert.match(r.stdout, new RegExp(`axes ${Object.keys(TWO_AXES['shared-values']).length}`));

  // 편입된 규칙마다 고른 판정기가 적힌다 — 「판정기 없음」도 적힌다(빈 목록은 선언이다).
  for (const [rule, admission] of Object.entries(TWO_AXES.admissions)) {
    const line = r.stdout.split('\n').find((l) => l.trim().startsWith(`${rule}:`));
    assert.ok(line !== undefined, `${rule} 의 줄이 없다`);
    if (admission.verifiers.length === 0) assert.match(line, /none declared/);
    else for (const name of admission.verifiers) assert.ok(line.includes(name), `${rule}: ${name}`);
  }
  // 면제는 **만기와 함께** 적힌다 — 분모는 줄지 않으므로 같은 목록에 산다.
  assert.match(r.stdout, new RegExp(`FH20: exempt until ${TWO_AXES.exemptions.FH20.expires}`));

  // 관할의 모양 — 칸은 **행 × 열**이고 그 곱을 이 테스트가 다시 적지 않는다.
  const rows = Object.keys(TWO_AXES.admissions).length + Object.keys(TWO_AXES.exemptions).length;
  assert.match(r.stdout, new RegExp(`jurisdiction ${rows * TWO_AXES.ui.length} cells`));
});

test('rules AC1 (negative) — 분모의 보고에 판정의 낱말이 **하나도** 없다', () => {
  const r = runCli(['rules', '--root', twoAxisFixture()]);
  assert.equal(r.status, 0, r.stderr);
  // ⛔ 상태는 판정의 산출이고 분모는 선언의 산출이다 — 한 화면에 섞으면 「선언했다」가
  //    「통과했다」로 읽힌다. ⚠️ 「하지 않는다」를 적은 그 두 줄은 분모에서 뺀다.
  const body = r.stdout
    .split('\n')
    .filter((line) => !line.includes('it does not judge') && !line.includes('may be red'))
    .join('\n');
  for (const word of [/\bpass\b/, /\bviolation\b/, /\bunjudged\b/, /%/, /score/i, /grade/i]) {
    assert.doesNotMatch(body, word, `분모의 보고가 판정의 낱말을 들었다: ${String(word)}`);
  }
});

test('rules AC2 — `--json` 은 `v` 를 싣고, 같은 선언에서 **바이트가 같다**(시계가 없다)', () => {
  const root = twoAxisFixture();
  const first = runCli(['rules', '--root', root, '--json']);
  assert.equal(first.status, 0, first.stderr);
  const second = runCli(['rules', '--root', root, '--json']);
  // ⭐ 시계가 들면 이 단정이 먼저 깨진다 — 에이전트가 이 산출을 diff 로 쥘 수 있는 근거다.
  assert.equal(first.stdout, second.stdout);

  const parsed = parseRules(first.stdout.trim()) as Record<string, unknown>;
  assert.equal(parsed.v, SCHEMA_VERSION);
  assert.equal(parsed.presence, 'declared');
  // ⛔ 토큰의 **값**은 어느 칸으로도 나가지 않는다 — 수만 나간다.
  const axes = parsed.axes as { axis: string; pinned: number | null }[];
  assert.deepEqual(axes.map((a) => a.axis), Object.keys(TWO_AXES['shared-values']).sort());
  assert.equal(axes.find((a) => a.axis === 'design')!.pinned, 2);
  assert.doesNotMatch(first.stdout, /#f6f5f2/i);
});

test('rules AC2 (negative) — 모르는 `v` 는 조용히 읽히지 않고 던진다', () => {
  const view = readRules(loadWorkspaceSnapshot(twoAxisFixture()).snapshot);
  const text = serializeRules([view]);
  assert.deepEqual(parseRules(text), JSON.parse(text));

  const older = JSON.stringify({ ...(JSON.parse(text) as object), v: SCHEMA_VERSION - 1 });
  assert.throws(() => parseRules(older), VersionMismatchError);
  // `v` 가 아예 없는 바이트도 같은 자리다 — 버전을 **가장 먼저** 본다.
  assert.throws(() => parseRules('{}'), VersionMismatchError);
});

test('rules AC4 (negative) — 선언이 없으면 사유와 함께 말하고 **exit 0** 이다', () => {
  const r = runCli(['rules', '--root', bareFixture()]);
  // 미판정은 빨강이 아니다 — 분모를 묻는 행위는 무엇도 위반하지 않는다.
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /declaration: absent/);
  assert.match(r.stdout, /not declared/);
  assert.match(r.stdout, /jurisdiction 0 cells \(no-declaration\)/);
});

test('rules AC5 (negative) — 깨진 선언 앞에서는 분모를 내지 않고 멈춘다(exit 2)', () => {
  const r = runCli(['rules', '--root', brokenFixture()]);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /graduand\.json is invalid/);
  // ⛔ 빈 분모를 조용히 내지 않는다 — 「편입 0」과 「오타로 전부 못 읽었다」는 다른 사실이다.
  assert.doesNotMatch(r.stdout, /declared denominator/);
});

test('rules AC6 (negative) — 측정을 싣는 플래그 둘은 사용법 오류다', () => {
  for (const flag of ['--fragment', '--open']) {
    const r = runCli(['rules', '--root', twoAxisFixture(), flag]);
    assert.equal(r.status, 2, `${flag}: ${r.stdout}`);
    assert.match(r.stderr, /carries no measurement/);
    // 사용법 오류는 사용법을 **함께** 말한다.
    assert.match(r.stderr, /usage: graduand/);
  }
  // 조립 플래그도 받지 않는다 — 분모를 묻는 명령이 선언을 짓지 않는다.
  const composed = runCli(['rules', '--axis', 'design']);
  assert.equal(composed.status, 2);
  assert.match(composed.stderr, /takes no composition flags/);
});

test('rules — 루트 N 개는 절 N 개다. ⛔ 합산 줄이 없다(분모는 저장소마다 다른 헌법이다)', () => {
  const r = runCli(['rules', '--root', twoAxisFixture(), '--root', bareFixture()]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.match(/graduand — declared denominator/g)?.length, 2);
  assert.doesNotMatch(r.stdout, /checkouts in one job/);
});

test('rules — 분모를 읽는 손은 격자와 **같은 하나**다', () => {
  const { snapshot } = loadWorkspaceSnapshot(twoAxisFixture(), TWO_AXES['shared-values'].design.files);
  const shape = admissionShape(snapshot);
  const grid = admissionGrid(snapshot, judgeSnapshot(snapshot).checks);
  const view = readRules(snapshot);

  // 행·열·사유가 셋 다 같다 — 모양 위에 상태만 얹는다는 그 구조의 단정이다.
  assert.deepEqual(grid.rules.map((r) => r.rule), shape.rules.map((r) => r.rule));
  assert.deepEqual(grid.surfaces, shape.surfaces);
  assert.equal(grid.reason, shape.reason);
  assert.deepEqual(view.rules, shape.rules);
  // 칸을 곱하는 자리도 하나다.
  assert.equal(view.cells, cellCount(grid));
  assert.equal(view.cells, grid.rules.length * grid.surfaces.length);
});

// ─── ② 재사용 Action + GitLab include ───

test('입구 AC3 — argv 를 짓는 손이 하나고, 루트 N 개가 `--root` N 번으로 선다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다 — 이 하네스로 돌릴 수 없다');
  const roots = ['app', 'design system', './nested/peer'];
  const r = runScript({
    GRADUAND_DRY_RUN: '1',
    GRADUAND_COMMAND: 'rules',
    GRADUAND_FORMAT: 'json',
    GRADUAND_ROOTS: `${roots.join('\n')}\n`,
  });
  assert.equal(r.status, 0, r.stderr);
  // ⭐ 공백이 든 경로가 **둘로 갈라지지 않는다** — 쪼개는 축은 줄 하나다.
  assert.deepEqual(r.stdout.split('\n').filter(Boolean), [
    'rules',
    ...roots.flatMap((root) => ['--root', root]),
    '--json',
  ]);

  const basic = runScript({ GRADUAND_DRY_RUN: '1' });
  assert.deepEqual(basic.stdout.split('\n').filter(Boolean), ['--root', '.']);
});

test('입구 AC3 — 입구 전수가 **같은 스크립트**를 부른다(사본이 0 이다)', () => {
  const all = entrances();
  // ⛔ 분모가 0 이면 아래 전부가 공짜로 참이다 — 하네스가 고장났다는 뜻이다.
  assert.ok(all.length > 0, '입구를 하나도 못 찾았다');
  for (const { name, text } of all) {
    assert.ok(text.includes('graduand-ci.sh'), `${name} 이 공유 스크립트를 부르지 않는다`);
    // ⛔ 어느 입구도 `--root` 를 자기가 적지 않는다 — 적는 순간 변환의 손이 둘이다.
    assert.ok(!code(text).includes('--root'), `${name} 이 argv 를 자기가 짓는다`);
    // ⛔ 측정을 싣는 플래그는 어느 입구에도 **값으로** 서지 않는다(산문의 금지 설명은 센다).
    assert.ok(!/^\s*[A-Za-z_-]+:\s*--?(fragment|open)\s*$/m.test(code(text)), `${name}`);
  }
});

test('입구 AC3 — 시야를 모으는 손도 하나다: clone 하는 입구가 또래 루프를 자기가 적지 않는다', () => {
  // ⭐ 「clone 하는 입구」를 **코드에서** 가린다 — 목록을 적으면 넷째 입구가 그 밖에서
  //   태어난다. 판정기를 참조로 받는 입구(GitHub)는 여기 들지 않고, 그것이 참인 분류다.
  const cloning = entrances().filter((entrance) => code(entrance.text).includes('git clone'));
  assert.ok(cloning.length > 0, 'clone 하는 입구를 하나도 못 찾았다 — 하네스가 고장났다');
  for (const { name, text } of cloning) {
    assert.ok(text.includes('graduand-peers.sh'), `${name} 이 또래를 공유 스크립트로 가져오지 않는다`);
    // ⛔ 또래를 **자기가** 도는 루프가 없다 — 있으면 그 사본이 갈라진다.
    assert.ok(!/GRADUAND_PEERS["']?\s*\|/.test(code(text)), `${name} 이 또래 루프를 자기가 적는다`);
    assert.ok(!/read -r\s+dir\s+url\s+ref/.test(code(text)), `${name} 이 또래 루프를 자기가 적는다`);
  }
});

test('입구 AC6 (negative) — clone 하는 입구는 **판을 고정하지 않으면 멈춘다**', () => {
  // ⚠️ 없앨 수 없는 사본(부트스트랩)을 **선언하고 가드를 세운** 자리다 — 두 입구의 같은
  //    자리를 **함께** 문다. `main` 을 기본으로 깔면 고객의 판정기가 고객이 모르는 사이에
  //    바뀌고, 어제 초록이던 커밋이 오늘 빨강이 된다.
  for (const { name, text } of entrances().filter((e) => code(e.text).includes('git clone'))) {
    const body = code(text);
    assert.match(body, /GRADUAND_REF/, `${name}`);
    // 비면 멈춘다 — 그 자리에 exit 2 가 있다(판정 실패: 수를 내지 않았다).
    assert.match(body, /exit 2/, `${name} 이 판을 고정하지 않은 채 돈다`);
    // ⛔ 기본값을 깔지 않는다 — `GRADUAND_REF:-main` · `GRADUAND_REF: "main"` 같은 자리다.
    assert.ok(!/GRADUAND_REF\s*:\s*["']?[A-Za-z0-9]/.test(body), `${name} 이 판에 기본값을 깔았다`);
    // ⭕ `${GRADUAND_REF:-}` 는 기본값이 **아니다** — 「없으면 빈 값」이고, 바로 위의
    //    빈 값 검사가 그것을 받아 멈춘다. 기본값은 `:-` 뒤에 **무엇이 있는** 자리다.
    assert.ok(!/GRADUAND_REF:-\s*[^}\s]/.test(body), `${name} 이 판에 기본값을 깔았다`);
    // ⭐ 얕다 — 판정은 이력을 한 건도 읽지 않는다.
    assert.match(body, /git clone[^\n]*--depth 1/, `${name} 의 clone 이 얕지 않다`);
  }
});

test('입구 — 공유 스크립트 둘 다 실행 권한이 있다(빠뜨림은 누설이 아니라 빨강이다)', (t) => {
  if (!POSIX) return t.skip('win32: 실행 비트가 없다');
  for (const path of [scriptPath(), peersPath()]) accessSync(path, constants.X_OK);
});

/**
 * 입구에 **박힌 셸**을 꺼낸다 — YAML 블록 스칼라(`- |`) 뒤의 더 들여쓴 줄들.
 *
 * ⭐⭐ **왜 꺼내 보는가.** 입구가 YAML 안에 셸 프로그램을 들고 있고, 그 프로그램의 구문
 * 오류는 **우리 테스트에 걸리지 않는다** — 고객의 첫 실행에서 처음 운다. 그것이 이 파일의
 * 머리말이 말하는 「조용한 결함」의 한 모양이라, 꺼내서 `sh -n` 에 건다.
 *
 * ⚠️ YAML 파서를 들이지 않는다(이 패키지의 런타임 의존은 0 이다) — 보는 것은 블록 스칼라
 * 하나의 모양뿐이고, 그 모양이 바뀌면 아래 「블록을 하나도 못 찾았다」가 운다.
 */
function shellBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  for (let at = 0; at < lines.length; at += 1) {
    const opener = /^(\s*)- \|\s*$/.exec(lines[at]!);
    if (opener === null) continue;
    const indent = opener[1]!.length;
    const body: string[] = [];
    let cursor = at + 1;
    while (cursor < lines.length) {
      const line = lines[cursor]!;
      if (line.trim() !== '' && line.length - line.trimStart().length <= indent) break;
      body.push(line);
      cursor += 1;
    }
    // 들여쓰기를 공통분만큼 걷는다 — 걷지 않으면 히어독의 종료 표지가 어긋난다.
    const depth = Math.min(
      ...body.filter((line) => line.trim() !== '').map((line) => line.length - line.trimStart().length),
    );
    blocks.push(body.map((line) => line.slice(depth)).join('\n'));
    at = cursor - 1;
  }
  return blocks;
}

test('입구 AC7 — 입구에 박힌 셸이 **구문으로 선다**(고객의 첫 실행에서 처음 울지 않는다)', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  let seen = 0;
  for (const { name, text } of entrances()) {
    for (const [at, block] of shellBlocks(text).entries()) {
      seen += 1;
      const r = spawnSync('sh', ['-n'], { encoding: 'utf8', input: block });
      assert.equal(r.status, 0, `${name} 블록 ${at}: ${r.stderr}`);
    }
  }
  // ⛔ 분모가 0 이면 위의 단정이 공짜로 참이다 — 추출기가 고장난 자리를 운다.
  assert.ok(seen > 0, '입구에서 셸 블록을 하나도 못 찾았다 — 추출기가 고장났다');
});

test('입구 AC6 (negative) — 박힌 셸을 **실제로 돌려** 판 고정을 묻는다: 비면 exit 2', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  // ⭐ 빅버킷 조각은 고객이 **붙여 넣는 사본**이라, 그 사본이 실제로 멈추는지를 산문이
  //   아니라 실행으로 묻는다. ⛔ 네트워크는 타지 않는다 — 판이 비면 clone 앞에서 멈춘다.
  const bitbucket = entrances().find((entrance) => entrance.name === 'bitbucket-pipelines.yml');
  assert.ok(bitbucket !== undefined, '빅버킷 조각이 없다');
  const block = shellBlocks(bitbucket.text)[0];
  assert.ok(block !== undefined, '빅버킷 조각에서 셸 블록을 못 찾았다');

  const r = spawnSync('sh', [], {
    encoding: 'utf8',
    input: block,
    cwd: mkdtempSync(join(tmpdir(), 'graduand-bb-')),
    env: { ...process.env, GRADUAND_REF: '' },
  });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /GRADUAND_REF/);
  // ⛔ 돌지 못한 것을 「위반 0」으로 넘기지 않는다 — stdout 에 보고가 없다.
  assert.equal(r.stdout, '');
});

test('또래 AC4 (negative) — `<디렉터리> <url> <ref>` 셋을 갖지 않은 줄에서 멈춘다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  for (const line of ['design-system https://example.invalid/d.git', 'design-system', 'a b c d']) {
    const r = spawnSync('sh', [peersPath()], {
      encoding: 'utf8',
      env: { ...process.env, GRADUAND_PEERS: line, GRADUAND_PEERS_DRY_RUN: '1' },
    });
    // ⛔ 1 이 아니다 — 시야를 못 모은 것은 위반이 아니라 판정 실패다.
    assert.equal(r.status, 2, `${line}: ${r.stdout}`);
    assert.match(r.stderr, /GRADUAND_PEERS/);
    assert.equal(r.stdout, '');
  }
});

test('또래 AC5 — 비면 clone 0 이고 **조용히 성공한다**(또래 없는 저장소가 평상시다)', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  for (const value of ['', '   ', '\n\n']) {
    const r = spawnSync('sh', [peersPath()], {
      encoding: 'utf8',
      env: { ...process.env, GRADUAND_PEERS: value },
    });
    // ⭕ `GRADUAND_ROOTS` 와 **다른 자리**다 — 저쪽의 빈 값은 N 개를 하나로 접으므로 멈춘다.
    assert.equal(r.status, 0, `${JSON.stringify(value)}: ${r.stderr}`);
    assert.equal(r.stdout, '');
  }
});

test('또래 — 줄마다 셋을 그대로 쥔다: 공백과 빈 줄이 선언을 바꾸지 않는다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  const r = spawnSync('sh', [peersPath()], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GRADUAND_PEERS_DRY_RUN: '1',
      GRADUAND_PEERS: '  design-system https://example.invalid/d.git main  \n\ncontracts https://example.invalid/c.git v2\n',
    },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.split('\n').filter(Boolean), [
    'design-system https://example.invalid/d.git main',
    'contracts https://example.invalid/c.git v2',
  ]);
});

test('입구 — 스크립트에 실행 권한이 있다(빠뜨림은 누설이 아니라 빨강이다)', (t) => {
  if (!POSIX) return t.skip('win32: 실행 비트가 없다');
  // Action 이 이 파일을 **직접** 부르므로, 커밋된 모드가 곧 입구가 도는 조건이다.
  accessSync(scriptPath(), constants.X_OK);
});

test('입구 AC7 (negative) — 빈 `GRADUAND_ROOTS` 를 조용히 `.` 하나로 접지 않는다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  for (const value of ['', '  ', '\n\n']) {
    const r = runScript({ GRADUAND_ROOTS: value, GRADUAND_DRY_RUN: '1' });
    assert.equal(r.status, 2, `${JSON.stringify(value)}: ${r.stdout}`);
    assert.match(r.stderr, /GRADUAND_ROOTS/);
    assert.equal(r.stdout, '');
  }
});

test('입구 (negative) — 모르는 command · format 은 조용히 기본값으로 접히지 않는다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  const command = runScript({ GRADUAND_COMMAND: 'promote', GRADUAND_DRY_RUN: '1' });
  assert.equal(command.status, 2);
  assert.match(command.stderr, /judge/);

  for (const format of ['fragment', 'open', 'html']) {
    const r = runScript({ GRADUAND_FORMAT: format, GRADUAND_DRY_RUN: '1' });
    assert.equal(r.status, 2, `${format}: ${r.stdout}`);
    assert.match(r.stderr, /report/);
  }
});

test('입구 AC8 (negative) — Node 가 낮으면 **먼저 묻고 멈춘다**(exit 2 · 무엇을 하라고 말한다)', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  const dir = mkdtempSync(join(tmpdir(), 'graduand-node-stub-'));
  const stub = join(dir, 'node');
  writeFileSync(stub, '#!/bin/sh\necho v22.11.0\n');
  chmodSync(stub, 0o755);

  const r = runScript({ GRADUAND_NODE: stub, GRADUAND_ROOTS: bareFixture() });
  // ⛔ 1 이 아니다 — 돌 수 없는 것을 위반으로 세면 「돌 수 없다」가 「규칙을 깼다」로 둔갑한다.
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /23\.6/);
  assert.match(r.stderr, /setup-node/);

  // 판을 **읽지 못한** 자리도 같다 — 모르는 판으로 돌리지 않는다.
  const mute = join(dir, 'mute');
  writeFileSync(mute, '#!/bin/sh\nexit 0\n');
  chmodSync(mute, 0o755);
  const unread = runScript({ GRADUAND_NODE: mute, GRADUAND_ROOTS: bareFixture() });
  assert.equal(unread.status, 2);
  assert.match(unread.stderr, /판을 읽지 못했다/);
});

test('입구 — 종료 코드를 접지 않는다: 위반은 1 로, 깨진 선언은 2 로 그대로 나온다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  const red = runScript({ GRADUAND_ROOTS: violationFixture() });
  assert.equal(red.status, 1, red.stdout + red.stderr);

  const failed = runScript({ GRADUAND_ROOTS: brokenFixture() });
  assert.equal(failed.status, 2, failed.stdout);

  const green = runScript({ GRADUAND_COMMAND: 'rules', GRADUAND_ROOTS: twoAxisFixture() });
  assert.equal(green.status, 0, green.stderr);
  assert.match(green.stdout, /declared denominator/);
});

test('입구 (negative) — `output-path` 가 **종료 코드를 삼키지 않는다**', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  const out = join(mkdtempSync(join(tmpdir(), 'graduand-out-')), 'report.txt');
  // ⛔ `| tee` 로 쓰면 tee 의 코드가 돌아오고 **위반이 초록으로 둔갑한다** — 그 자리를 문다.
  const r = runScript({ GRADUAND_ROOTS: violationFixture(), GRADUAND_OUTPUT: out });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const captured = readFileSync(out, 'utf8');
  assert.match(captured, /verifier report/);
  // 담은 것과 찍은 것이 같다 — 담느라 사라진 줄이 없다.
  assert.equal(r.stdout, captured);
});

test('입구 (negative) — 판정기를 찾지 못하면 멈추고, 어디를 봤는지 말한다', (t) => {
  if (!POSIX) return t.skip('win32: POSIX 셸이 없다');
  const r = runScript({ GRADUAND_SRC: mkdtempSync(join(tmpdir(), 'graduand-nosrc-')), GRADUAND_DRY_RUN: '1' });
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /판정기를 찾지 못했다/);
});
