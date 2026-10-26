/**
 * 이슈의 AC 전수 — 같은 커밋을 CI 모드(워크스페이스)와 브라우저 모드(GitHub API)로
 * 판정해 바이트 동일성까지 확인하는 끝-끝 수용 시험.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as api from './index.ts';
import { loadWorkspaceSnapshot, loadWorkspaces } from './hosts/workspace.ts';
import { formatOpenOutcome, openCommand, openReport, reportUrl, REPORT_URL_ROOT } from './open.ts';
import { gateExitCode } from './expiry.ts';

const FILES: Record<string, string> = {
  'README.md': '[guide](docs/guide.md)\n\nSee [[deep-dive]] and `app/main.ts:1`.\n',
  'docs/guide.md': '[back](../README.md)\n',
  'docs/deep-dive.md': 'ok\n',
  'graduand.json':
    JSON.stringify({
      ui: ['app/'],
      palette: {
        adapter: 'css-custom-properties',
        files: ['app/theme.css'],
        scope: ':root',
        canon: { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' },
        // 소문자 hex — 어댑터 정규화를 지나 박제와 일치해야 한다.
        pinned: { '--paper': '#F6F5F2', '--ink': '#23263A' },
      },
    }) + '\n',
  'app/theme.css': ':root {\n  --paper: #f6f5f2;\n  --ink: #23263a;\n  --local-only: #ff5c39;\n}\n',
  'app/main.ts': 'export {};\n',
};

function makeFixture(): { root: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), 'graduand-fixture-'));
  for (const [path, content] of Object.entries(FILES)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const git = (...args: string[]) => {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args[0]}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', 'https://github.com/acme/widgets.git');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fixture');
  return { root, commit: git('rev-parse', 'HEAD') };
}

const b64 = (text: string): string =>
  Buffer.from(text, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');

/** 픽스처와 같은 내용을 서빙하는 가짜 GitHub API. 요청 URL 을 전부 기록한다. */
function fakeGithub(commit: string): { fetch: typeof fetch; requested: string[] } {
  const paths = Object.keys(FILES).sort();
  const blobShaOf = (path: string) => `blob-${paths.indexOf(path)}`;
  const routes = new Map<string, unknown>([
    ['/repos/acme/widgets', { full_name: 'acme/widgets', default_branch: 'main' }],
    ['/repos/acme/widgets/commits/main', { sha: commit }],
    [
      `/repos/acme/widgets/git/trees/${commit}?recursive=1`,
      { truncated: false, tree: paths.map((path) => ({ path, type: 'blob', sha: blobShaOf(path) })) },
    ],
    ...paths.map(
      (path): [string, unknown] => [
        `/repos/acme/widgets/git/blobs/${blobShaOf(path)}`,
        { content: b64(FILES[path]!), encoding: 'base64' },
      ],
    ),
  ]);

  const requested: string[] = [];
  const impl = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requested.push(url.toString());
    const body = routes.get(url.pathname + url.search);
    if (body === undefined) return Promise.resolve(new Response('not found', { status: 404 }));
    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  };
  return { fetch: impl as typeof fetch, requested };
}

const fixture = makeFixture();

test('AC1 — 같은 커밋, CI 모드와 브라우저 모드의 판정 직렬화가 바이트 동일하다', async () => {
  const ci = loadWorkspaceSnapshot(fixture.root);
  assert.equal(ci.dirty, 0);
  const ciBytes = api.serializeJudgment(api.judgeSnapshot(ci.snapshot));

  const github = fakeGithub(fixture.commit);
  const browser = await api.loadGithubSnapshot({ repo: 'acme/widgets', fetch: github.fetch });
  const browserBytes = api.serializeJudgment(api.judgeSnapshot(browser.snapshot));

  assert.equal(ciBytes, browserBytes);
});

test('AC2 — 직렬화에 v · repo · 커밋 SHA · 체크별 3상태 · 미판정 사유가 전부 실린다', () => {
  const { snapshot } = loadWorkspaceSnapshot(fixture.root);
  const parsed = api.parseJudgment(api.serializeJudgment(api.judgeSnapshot(snapshot)));
  assert.equal(parsed.v, api.SCHEMA_VERSION);
  assert.equal(parsed.repo, 'acme/widgets');
  assert.equal(parsed.commit, fixture.commit);
  assert.deepEqual(parsed.checks.map((c) => c.id), ['palette', 'palette-cross', 'refs', 'ui-paths']);
  for (const check of parsed.checks) {
    assert.ok((api.CHECK_STATUSES as readonly string[]).includes(check.status));
    if (check.status === 'unjudged') assert.ok((api.REASON_CODES as readonly string[]).includes(check.reason!));
  }
});

test('AC3 — 읽지 못한 축은 「통과」가 아니라 「미판정 + 사유 코드」다', () => {
  const { snapshot } = loadWorkspaceSnapshot(fixture.root);
  const maimed = { ...snapshot, files: new Map(snapshot.files) };
  maimed.files.set('docs/guide.md', null); // 마크다운 한 축을 읽지 못했다
  const refs = api.judgeSnapshot(maimed).checks.find((c) => c.id === 'refs')!;
  assert.equal(refs.status, 'unjudged');
  assert.equal(refs.reason, 'collection-truncated');
});

test('AC4 — 모르는 v 의 직렬화본은 조용히 해석되지 않는다', () => {
  const { snapshot } = loadWorkspaceSnapshot(fixture.root);
  const text = api.serializeJudgment(api.judgeSnapshot(snapshot));
  const alien = text.replace(`"v":${api.SCHEMA_VERSION}`, '"v":99');
  assert.throws(() => api.parseJudgment(alien), api.VersionMismatchError);
});

test('AC5 — 네트워크 요청은 벤더 API 하나뿐, 결과를 되쏘는 경로가 없다', async () => {
  const github = fakeGithub(fixture.commit);
  await api.loadGithubSnapshot({ repo: 'acme/widgets', fetch: github.fetch });
  assert.ok(github.requested.length > 0);
  for (const url of github.requested) {
    assert.equal(new URL(url).host, 'api.github.com');
  }
});

test('AC6 — 공개 표면은 닫힌 목록이고 점수·등급 API 는 존재하지 않는다', () => {
  const surface = Object.keys(api).sort();
  const expected = [
    'AdapterParseError',
    'CHECK_STATUSES',
    'DECLARATION_FILE',
    'DeclarationInvalidError',
    'FRAGMENT_VERSION',
    'FragmentIntegrityError',
    'MEASUREMENT_SOURCES',
    'NOTATIONS',
    'PALETTE_ADAPTERS',
    'RateLimitedError',
    'REASON_CODES',
    'RECOMMENDED_URL_MAX',
    'RepoUnreadableError',
    'SCHEMA_VERSION',
    'SchemaParseError',
    'SCAFFOLD_JSON',
    'VERIFIER',
    'VERIFIER_IDS',
    'VersionMismatchError',
    'admissionGrid',
    'decodeFragment',
    'encodeFragment',
    'gridCounts',
    'gridTotals',
    'judgeSnapshot',
    'loadGithubSnapshot',
    // 만기는 봉투의 몫이라 판정 API 옆에 선다 — ⛔ 게이트의 종료 코드와 그 서술은 측정
    // 명령의 행위라 이 표면에 없다(`initExitCode` 와 같은 자리다).
    'overdueExemptions',
    'utcDateOf',
    // 자격은 **판정의 인자**라 판정 API 옆에 선다 — 묻는 손(`resolveEntitlement`)은 호스트
    // 이고 판정은 받는다. ⛔ 자격을 「통과/실패」로 내는 이름도, 재활성화를 **소비하는**
    // 이름도 여기 없다 — 제안까지가 도구의 몫이다.
    'ENTITLEMENT',
    'DETAIL_REASONS',
    'entitlementGate',
    'parseHandle',
    'resolveEntitlement',
    // ⭐⭐ 고지의 정본이 표면에 선다 — 그것은 **사실**이다(`entitlementNotice`): 상태 ·
    // 사유 · 만기일 · 남은 날 · 넘겼는가 · 전환 경로. 두 표면이 같은 고지를 내는 길은
    // 「같은 사실을 받아 **각자** 그린다」다 — 문장을 정본으로 두면 페이지의 로케일이 둘이
    // 되는 날 「같은 한 문장」이 갈라진다. ⭐ 아래 둘은 **측정 명령의 영문 자구**이고 그
    // 사실에서 유도된다. ⛔ 전환 링크는 **상대 경로 상수** 하나다 — 벤더 절대 URL 0.
    'CHECKOUT_PATH',
    'entitlementNotice',
    'describeEntitlement',
    'describeExpiry',
    'parseJudgment',
    'parseMeasurement',
    'serializeJudgment',
    'serializeMeasurement',
    'validateDeclaration',
  ].sort();
  assert.deepEqual(surface, expected);
  for (const name of surface) {
    assert.doesNotMatch(name, /score|grade|percent|rating|rank/i);
  }
});

test('판정기 자기 식별이 package.json 과 함께 움직인다', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    name: string;
    version: string;
  };
  assert.equal(api.VERIFIER.name, pkg.name);
  assert.equal(api.VERIFIER.version, pkg.version);
});

test('측정 명령 — CLI 가 판정하고(exit 0) 위반이면 1, 판정 실패면 2 로 끝난다', async () => {
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const run = (root: string, ...args: string[]) =>
    spawnSync(process.execPath, [cli, '--root', root, ...args], { encoding: 'utf8' });

  const ok = run(fixture.root, '--json');
  assert.equal(ok.status, 0, ok.stderr);
  const measurement = api.parseMeasurement(ok.stdout.trim());
  assert.equal(measurement.source, 'workspace');
  assert.equal(measurement.judgment.commit, fixture.commit);

  const fragment = run(fixture.root, '--fragment');
  assert.equal(fragment.status, 0, fragment.stderr);
  const decoded = await api.decodeFragment(fragment.stdout.trim());
  assert.deepEqual(decoded.judgment, measurement.judgment);

  // 위반 → exit 1
  const red = makeViolationFixture();
  const violation = run(red);
  assert.equal(violation.status, 1, violation.stdout + violation.stderr);

  // 깨진 선언 → 판정 실패, exit 2 — 수를 내지 않는다
  const broken = makeBrokenDeclarationFixture();
  const failure = run(broken, '--json');
  assert.equal(failure.status, 2);
  assert.equal(failure.stdout.trim(), '');
});

// ---- 2일차(헌법층) AC — 팔레트 어댑터 · 선언 · 보고 ----

test('2일차 AC1 — 어댑터 설정이 있으면 팔레트를 고객 정본에서 읽어 수를 낸다', () => {
  const { snapshot } = loadWorkspaceSnapshot(fixture.root);
  const palette = api.judgeSnapshot(snapshot).checks.find((c) => c.id === 'palette')!;
  assert.equal(palette.status, 'pass');
  assert.equal(palette.counts.declared, 2); // 분모 = 박제 2
  assert.equal(palette.counts.matched, 2); // 소문자 hex 가 정규화를 지나 박제와 일치했다
  assert.equal(palette.counts.excluded, 1); // --local-only — 배제도 센다
});

test('2일차 AC2 — 어댑터 없는 저장소도 선언 파일 폴백으로 같은 스키마의 수를 낸다', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json':
      '{"palette": {"pinned": {"--paper": "#F6F5F2", "--ink": "#23263A"}, "canon": {"repo": "acme/design-system", "file": "tokens/tokens.css", "scope": ":root"}}}\n',
  });
  const { snapshot } = loadWorkspaceSnapshot(root);
  // 같은 스키마 — 직렬화·역직렬화가 그대로 통과하고, 분모가 수로 남는다.
  const parsed = api.parseJudgment(api.serializeJudgment(api.judgeSnapshot(snapshot)));
  const palette = parsed.checks.find((c) => c.id === 'palette')!;
  assert.equal(palette.status, 'unjudged');
  assert.equal(palette.reason, 'no-adapter');
  assert.equal(palette.counts.declared, 2);
});

test('2일차 AC3 — 어댑터도 선언도 없으면 「위반 0」이 아니라 「미판정 — 선언 없음」이다', () => {
  const root = gitFixture({ 'README.md': 'ok\n' });
  const { snapshot } = loadWorkspaceSnapshot(root);
  const palette = api.judgeSnapshot(snapshot).checks.find((c) => c.id === 'palette')!;
  assert.notEqual(palette.status, 'pass');
  assert.equal(palette.status, 'unjudged');
  assert.equal(palette.reason, 'no-declaration');
});

test('2일차 AC4 — 선언된 판정 기준이 실재하지 않으면 어긋남을 보고하고 멈춘다 (probe)', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json': '{"palette": {"adapter": "css-custom-properties", "files": ["src/theme.css"], "scope": ":root"}}\n',
  });
  // 선언을 믿지 않는다 — 모듈은 판정 실패로 던지고, 측정 명령은 수 없이 2 로 끝난다.
  assert.throws(() => api.judgeSnapshot(loadWorkspaceSnapshot(root).snapshot), api.DeclarationInvalidError);
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const r = spawnSync(process.execPath, [cli, '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(r.stdout.trim(), '');
  assert.ok(r.stderr.includes('src/theme.css'));
});

test('2일차 AC5 — 고객 저장소의 내용(값·산문)은 보고 밖으로 나가지 않는다', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json': JSON.stringify({
      palette: {
        adapter: 'css-custom-properties',
        files: ['src/theme.css'],
        scope: ':root',
        canon: { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' },
        pinned: { '--paper': '#AAAAAA' },
      },
    }),
    // 불일치 값과 산문 주석 — 어느 쪽도 판정 직렬화에 실리면 안 된다.
    'src/theme.css': '/* internal prose: SECRET-ACME-NOTE */\n:root {\n  --paper: #0B1C2D;\n}\n',
  });
  const load = loadWorkspaceSnapshot(root);
  const measurement = api.serializeMeasurement({
    judgment: api.judgeSnapshot(load.snapshot),
    source: load.source,
    measuredAt: '2026-10-25T00:00:00.000Z',
    verifier: { name: api.VERIFIER.name, version: api.VERIFIER.version },
    dirty: load.dirty,
  });
  const palette = api.parseMeasurement(measurement).judgment.checks.find((c) => c.id === 'palette')!;
  assert.equal(palette.status, 'violation'); // 위반은 보고된다 —
  assert.ok(!measurement.includes('#0B1C2D')); // 실측값 없이,
  assert.ok(!measurement.includes('#AAAAAA')); // 기준값 없이,
  assert.ok(!measurement.includes('SECRET-ACME-NOTE')); // 산문 없이 — 좌표(토큰·파일·행)로만.
});

/**
 * @param remote `origin` 의 주소. 교차 축은 체크아웃을 **이름(`owner/name`)으로** 찾으므로,
 *               주소가 없는 픽스처는 정본으로 지목될 수 없다 — 그것이 기본값이다.
 */
function gitFixture(files: Record<string, string>, remote?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-fixture-'));
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

const makeViolationFixture = (): string => gitFixture({ 'README.md': '[gone](docs/nowhere.md)\n' });
const makeBrokenDeclarationFixture = (): string =>
  gitFixture({ 'README.md': 'ok\n', 'graduand.json': '{"uii": []}\n' });

// ---- 입구 AC — `--open` 이 광고된 대로 돈다 ----

/**
 * 「여는 행위」를 주입으로 가로챈다 — 실제 명령(`open`·`xdg-open`)과 **같은 이름**의
 * 스크립트를 PATH 앞에 두면, CLI 가 평소대로 그 이름을 실행하고 주소가 파일에 적힌다.
 * 제품 코드에 테스트용 뒷문(환경변수·숨은 플래그)을 두지 않고 열린 주소를 단정하는
 * 방법이다 — 가로채는 자리가 **진짜 경로 그 자리**이므로, 배선이 끊기면 테스트가 안다.
 */
function openTrap(): { env: NodeJS.ProcessEnv; opened: () => string | null } {
  const dir = mkdtempSync(join(tmpdir(), 'graduand-opener-'));
  const log = join(dir, 'opened.txt');
  const stub = join(dir, openCommand(process.platform).command);
  writeFileSync(stub, `#!/bin/sh\nprintf '%s' "$1" > ${log}\n`);
  chmodSync(stub, 0o755);
  return {
    env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ''}` },
    opened: () => (existsSync(log) ? readFileSync(log, 'utf8') : null),
  };
}

/** `cmd /c start` 경로는 이 하네스(sh 스크립트)로 가로챌 수 없다 — 그 플랫폼은 미측정이다. */
const TRAPPABLE = process.platform !== 'win32';

const cliPath = (): string => fileURLToPath(new URL('./cli.ts', import.meta.url));

test('입구 AC1·AC2·AC3 — `--open` 은 exit 0 이고, 루트 + fragment 를 열고, 그 fragment 가 원래 측정으로 돌아온다', async (t) => {
  if (!TRAPPABLE) return t.skip('win32: 여는 명령이 cmd 를 지난다 — 이 하네스로 가로챌 수 없다');
  const cli = cliPath();
  const trap = openTrap();
  const r = spawnSync(process.execPath, [cli, '--root', fixture.root, '--open'], {
    encoding: 'utf8',
    env: trap.env,
  });

  // AC1 — 광고된 명령이 2 로 죽지 않는다. 그리고 실제로 「여는 행위」가 일어났다.
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const opened = trap.opened();
  assert.ok(opened !== null, '여는 명령이 호출되지 않았다');
  assert.equal(r.stdout.trim(), opened); // 열었다고 말한 주소 == 실제로 넘긴 주소

  // AC2 — 주소는 루트 + fragment 다. 전용 경로가 붙지 않는다.
  assert.ok(opened.startsWith(`${REPORT_URL_ROOT}#`), opened.slice(0, 64));
  assert.equal(new URL(opened).pathname, '/');

  // AC3 — 열린 주소의 fragment 를 풀면 원래 측정이 나온다(같은 커밋 · 같은 판정).
  const decoded = await api.decodeFragment(new URL(opened).hash.slice(1));
  assert.equal(decoded.judgment.commit, fixture.commit);
  const json = spawnSync(process.execPath, [cli, '--root', fixture.root, '--json'], { encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(decoded.judgment, api.parseMeasurement(json.stdout.trim()).judgment);
});

/** 압축되지 않는 바이트로 상한을 넘긴다 — gzip 이 기본값이라 장황한 산문으로는 넘지 않는다. */
function hugeMeasurement(): api.Measurement {
  const evidence = Array.from({ length: 20 }, (_, i) => ({
    token: `--t${i}`,
    noise: randomBytes(6_000).toString('base64url'),
  }));
  return {
    judgment: {
      v: api.SCHEMA_VERSION,
      repo: 'acme/widgets',
      commit: fixture.commit,
      checks: [
        {
          id: 'palette',
          status: 'violation',
          reason: null,
          counts: { declared: 20, matched: 0, evidenceOmitted: 0 },
          evidence,
        },
      ],
    },
    source: 'workspace',
    measuredAt: '2026-10-26T00:00:00.000Z',
    verifier: { name: api.VERIFIER.name, version: api.VERIFIER.version },
    dirty: 0,
  };
}

test('입구 AC4 — 상한을 넘는 측정은 열지 않고, 주소도 내지 않고, 대안 경로를 말한다', async () => {
  const huge = hugeMeasurement();
  const url = reportUrl(await api.encodeFragment(huge));
  assert.ok(url.length > api.RECOMMENDED_URL_MAX, `상한을 넘는 입력이어야 한다 — ${url.length}`);

  const asked: string[] = [];
  const outcome = await openReport(huge, (u) => asked.push(u));
  assert.deepEqual(asked, []); // 열지 않았다
  assert.equal(outcome.kind, 'too-long');

  const said = formatOpenOutcome(outcome);
  assert.deepEqual(said.stdout, []); // ⛔ 잘릴 주소를 붙여넣으라고 내지도 않는다
  assert.ok(said.stderr.some((l) => l.includes(String(api.RECOMMENDED_URL_MAX))));
  assert.ok(said.stderr.some((l) => l.includes('--json'))); // 대안 경로를 말한다
});

test('입구 — 브라우저가 뜨지 않으면 열었다고 말하지 않는다 (주소는 붙여넣을 수 있게 낸다)', async () => {
  const { snapshot, source, dirty } = loadWorkspaceSnapshot(fixture.root);
  const measurement: api.Measurement = {
    judgment: api.judgeSnapshot(snapshot),
    source,
    measuredAt: '2026-10-26T00:00:00.000Z',
    verifier: { name: api.VERIFIER.name, version: api.VERIFIER.version },
    dirty,
  };
  const outcome = await openReport(measurement, () => {
    throw new Error('xdg-open: spawnSync xdg-open ENOENT');
  });
  assert.equal(outcome.kind, 'open-failed');
  const said = formatOpenOutcome(outcome);
  assert.ok(said.stdout[0]!.startsWith(`${REPORT_URL_ROOT}#`));
  assert.ok(said.stderr.some((l) => l.includes('could not launch')));
});

test('입구 — 보고 주소는 상수다: 플래그로 덮어쓸 수 없다', () => {
  const r = spawnSync(process.execPath, [cliPath(), '--root', fixture.root, '--open=https://example.com/'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown argument/);
  assert.equal(r.stdout.trim(), '');
});

/**
 * ─── 선언 스캐폴드 (`graduand init` · 페이지의 조각) ───
 *
 * 「헌법을 만든다」의 **편입** 쪽 입구. 여기서 받는 것은 셋이다 — 쓴 파일이 지금 스키마를
 * 통과하는가 · 빈 분모가 미판정으로 남는가 · 덮어쓰지도 커밋하지도 않는가.
 *
 * ⚠️ **AC2 의 「전부 미판정」은 선언 구동 축의 전부다** — `refs` 는 선언 0 으로 도는 축
 * (판정의 분모가 선언이 아니다)이라 선언이 비어도 계속 수를 낸다. 그 사실을 「전부」에
 * 섞어 접지 않고, 아래 테스트가 둘을 갈라서 단정한다.
 */

/** 선언이 **없는** 저장소 — 추적 파일 하나와 커밋 하나. `init` 의 입력이다. */
function bareFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-init-'));
  writeFileSync(join(root, 'README.md'), 'ok\n');
  const git = (...args: string[]) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fixture');
  return root;
}

const git = (root: string, ...args: string[]): string =>
  spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }).stdout.trim();

const runCli = (args: string[], root: string, env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(process.execPath, [cliPath(), ...args], { cwd: root, encoding: 'utf8', env });

/**
 * PATH 앞에서 `git` 을 가로채는 하네스 — 불리면 기록을 남긴다. 「건드리지 않았다」를
 * 사후 상태만으로 받지 않는다: 호출 자체가 0 건이어야 한다.
 */
function gitRecorder(): { env: NodeJS.ProcessEnv; calls: () => string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'graduand-git-stub-'));
  const log = join(dir, 'calls.log');
  const stub = join(dir, 'git');
  writeFileSync(stub, `#!/bin/sh\necho "$@" >> ${log}\nexit 0\n`);
  chmodSync(stub, 0o755);
  return {
    env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ''}` },
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []),
  };
}

test('스캐폴드 AC1 — 선언이 없는 저장소에 `init` 이 선언을 쓰고, 그 파일이 지금 스키마를 통과한다', () => {
  const root = bareFixture();
  const r = runCli(['init'], root);
  assert.equal(r.status, 0, r.stderr);

  const text = readFileSync(join(root, api.DECLARATION_FILE), 'utf8');
  // 두 입구(파일 · 페이지의 조각)가 내는 **그 바이트**다 — 사본이 아니다.
  assert.equal(text, api.SCAFFOLD_JSON);
  const validated = api.validateDeclaration(text);
  assert.equal(validated.state, 'valid');
  assert.match(r.stdout, /커밋하지도 스테이징하지도 않았다/);
});

test('스캐폴드 AC2 — `init` 직후 선언 구동 축은 전부 미판정이고 exit 0 이다 (커밋 전후 같은 수)', () => {
  const root = bareFixture();
  assert.equal(runCli(['init'], root).status, 0);

  const judge = (): api.Judgment => {
    const r = runCli(['--json'], root);
    assert.equal(r.status, 0, `미판정은 빨강의 근거가 아니다 — exit ${r.status}: ${r.stderr}`);
    return api.parseMeasurement(r.stdout).judgment;
  };

  // `refs` 만 선언 0 으로 돈다 — 나머지 축의 분모는 선언이고, 그 선언이 비어 있다.
  const declarationDriven = (c: api.CheckResult): boolean => c.id !== 'refs';
  const cells = (j: api.Judgment): string[][] => j.checks.map((c) => [c.id, c.status, String(c.reason)]);

  // ⑴ 쓴 직후 — 파일은 아직 추적되지 않는다(우리가 add 하지 않았다). 판정의 표본은
  // 추적되는 파일이라 선언은 「부재」로 읽히고, 그 축들은 미판정이다.
  const fresh = judge();
  assert.equal(fresh.checks.filter((c) => c.status === 'violation').length, 0);
  for (const check of fresh.checks.filter(declarationDriven)) {
    assert.equal(check.status, 'unjudged', `${check.id} 가 미판정이 아니다`);
    assert.equal(check.reason, 'no-declaration');
  }

  // ⑵ 고객이 그 파일을 저장소에 넣은 뒤 — 빈 선언이 실제로 읽힌다. 수는 같다:
  // 「편입 0」이라는 참인 선언과 선언 부재가 같은 미판정을 낸다(빈 상태는 결함이 아니다).
  git(root, 'add', api.DECLARATION_FILE);
  git(root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'declare');
  assert.deepEqual(cells(judge()), cells(fresh));
});

test('스캐폴드 AC3 — 기존 선언을 덮어쓰지 않는다: 멈추고 말한다', () => {
  const root = bareFixture();
  const path = join(root, api.DECLARATION_FILE);
  const mine = `${JSON.stringify({ ui: ['app/'] }, null, 2)}\n`;
  writeFileSync(path, mine);

  const r = runCli(['init'], root);
  assert.equal(r.status, 2); // 한 일이 없으면 초록으로 끝나지 않는다
  assert.equal(readFileSync(path, 'utf8'), mine); // ⛔ 한 글자도 바뀌지 않았다
  assert.match(r.stderr, /덮어쓰지 않았다/);
  assert.equal(r.stdout.trim(), ''); // 쓰지 않은 것을 썼다고 말하지 않는다
});

test('스캐폴드 AC5 — `init` 은 git 을 건드리지 않는다: 호출 0 · 커밋 0 · 스테이징 0', () => {
  const root = bareFixture();
  const before = git(root, 'rev-list', '--count', 'HEAD');

  const recorder = gitRecorder();
  const r = runCli(['init'], root, recorder.env);
  assert.equal(r.status, 0, r.stderr);

  // ⭕ 목적지의 척도 ⑵ — 고객 저장소에 우리가 쓴 커밋 0. 호출 자체가 없다.
  assert.deepEqual(recorder.calls(), []);
  assert.equal(git(root, 'rev-list', '--count', 'HEAD'), before);
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
  // 쓴 파일은 **추적되지 않은 채** 남는다 — 저장소 이력에 넣는 것은 고객의 행위다.
  assert.equal(git(root, 'status', '--porcelain'), `?? ${api.DECLARATION_FILE}`);
});

test('스캐폴드 — `init` 은 하위 명령이다: 보고 플래그와 섞이지 않고, 모르는 이름은 조용히 무시되지 않는다', () => {
  const root = bareFixture();

  // 요청한 것과 한 것이 어긋난 채 exit 0 이 되는 길을 막는다.
  const mixed = runCli(['init', '--json'], root);
  assert.equal(mixed.status, 2);
  assert.match(mixed.stderr, /init takes no report flags/);
  assert.ok(!existsSync(join(root, api.DECLARATION_FILE)));

  const typo = runCli(['innit'], root);
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /unknown command/);

  // 하위 명령의 자리는 첫 자리 하나다 — 뒤에 붙은 이름이 명령으로 둔갑하지 않는다.
  const trailing = runCli(['--json', 'init'], root);
  assert.equal(trailing.status, 2);
  assert.match(trailing.stderr, /unexpected argument/);
});

/**
 * ─── 편입 기록 · 격자 · coverage 파생 ───
 *
 * 격자는 **규칙 × 표면**이고 분모는 선언이다. 여기서 받는 것은 다섯이다 — 격자가 서는가 ·
 * 판정기 없음이 통과가 아닌가 · 파생값을 저작하면 멈추는가 · 편입 0 이 초록인가 · 칸 수가
 * 선언에서만 유도되는가.
 *
 * ⛔ 기대 칸 수를 상수로 적지 않는다 — 아래 전부가 선언 객체에서 곱한다.
 */

/** 편입 기록이 든 선언 — 이 객체가 기대값의 **유일한 출처**다. */
const ADMITTED = {
  ui: ['docs/', 'README.md'],
  admissions: {
    R1: { verifiers: ['refs'] }, // 통과
    R2: { verifiers: [] }, // 「판정기 없음」 선언 — 미판정
    R3: { verifiers: ['refs', 'palette-cross'] }, // 부분 판정 — 미판정
  },
  exemptions: { R9: { reason: '이 저장소에 그 표면이 없다', expires: '2027-01-31' } },
};

const admittedFixture = (): string =>
  gitFixture({
    'README.md': '[guide](docs/guide.md)\n',
    'docs/guide.md': 'ok\n',
    'graduand.json': `${JSON.stringify(ADMITTED, null, 2)}\n`,
  });

const gridOf = (root: string): api.AdmissionGrid => {
  const { snapshot } = loadWorkspaceSnapshot(root);
  return api.admissionGrid(snapshot, api.judgeSnapshot(snapshot).checks);
};

test('편입 AC1 — 편입 기록이 든 선언은 격자를 규칙 × 표면으로 세우고 수를 3상태로 낸다', () => {
  const root = admittedFixture();
  const grid = gridOf(root);

  assert.deepEqual(
    grid.rules.map((r) => r.rule),
    [...Object.keys(ADMITTED.admissions), ...Object.keys(ADMITTED.exemptions)].sort(),
  );
  assert.deepEqual(grid.surfaces, ADMITTED.ui);
  assert.equal(grid.reason, null); // 분모가 있으므로 수를 낸다

  const counts = api.gridCounts(grid);
  // 3상태뿐이고 셋의 합이 분모다 — 점수도 등급도 백분율도 이 수에 없다.
  assert.deepEqual(Object.keys(counts).sort(), ['cells', 'pass', 'unjudged', 'violation']);
  assert.equal(counts.violation + counts.pass + counts.unjudged, counts.cells);
  for (const value of Object.values(counts)) assert.ok(Number.isInteger(value) && value >= 0);

  // 보고가 「관할 N — 위반 k · 통과 p · 미판정 m」으로 말한다.
  const report = runCli(['--root', '.'], root);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /jurisdiction \d+ — violation \d+ · pass \d+ · unjudged \d+/);
  for (const banned of [/score/i, /grade/i, /percent/i, /\d%/]) assert.doesNotMatch(report.stdout, banned);
});

test('편입 AC2 — `verifiers: []` 인 규칙은 미판정(판정기 없음)이고 통과가 아니다', () => {
  const grid = gridOf(admittedFixture());
  const row = grid.rules.find((r) => r.rule === 'R2')!;

  assert.equal(row.status, 'unjudged');
  assert.equal(row.reason, 'no-verifier');
  assert.notEqual(row.status, 'pass'); // 실행할 수 없는 규칙은 「위반 0」이 아니다

  // 그 줄의 칸은 분모에 그대로 남는다 — 미판정은 칸을 빼지 않는다.
  assert.ok(api.gridCounts(grid).unjudged >= ADMITTED.ui.length);
});

test('편입 AC3 — 선언에 `coverage` 를 적으면 판정 실패다: 파생값을 저작할 자리가 없다', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json': JSON.stringify({ admissions: { R1: { verifiers: ['refs'], coverage: 'enforced' } } }),
  });

  // 판정 실패 — 위반(1)도 미판정(0)도 아닌 2 다. 수를 내지 않았다.
  const r = runCli(['--root', '.'], root);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), '');
  assert.match(r.stderr, /coverage/);
  assert.match(r.stderr, /derived/);

  const { snapshot } = loadWorkspaceSnapshot(root);
  assert.throws(() => api.judgeSnapshot(snapshot), api.DeclarationInvalidError);
});

test('편입 AC4 — 편입 기록이 없는 선언(1일차 고객)은 미판정이고 exit 0 이다', () => {
  // 스캐폴드가 쓰는 그 바이트 — 「아직 아무 규칙도 편입하지 않았다」는 참인 선언이다.
  const root = gitFixture({ 'README.md': 'ok\n', 'graduand.json': api.SCAFFOLD_JSON });

  const grid = gridOf(root);
  assert.equal(grid.reason, 'no-declaration'); // 빈 분모는 미판정이다
  assert.equal(api.gridCounts(grid).cells, 0);

  // ⭕ 편입 0 은 **정당한 상태**다 — 빨강의 근거는 위반뿐이고, 미판정은 그 근거가 아니다.
  const r = runCli(['--root', '.'], root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /jurisdiction: unjudged \(no-declaration\)/);
});

test('편입 AC5 — 격자의 칸 수는 선언에서만 유도된다 (테스트에 수를 적지 않는다)', () => {
  const grid = gridOf(admittedFixture());
  const rows = Object.keys(ADMITTED.admissions).length + Object.keys(ADMITTED.exemptions).length;
  const columns = ADMITTED.ui.length;

  assert.equal(api.gridCounts(grid).cells, rows * columns);
  assert.ok(rows * columns > 0, '분모가 0 이면 이 테스트는 아무것도 재지 않는다');

  // 선언이 움직이면 칸도 같이 움직인다 — 수가 선언에 매여 있다는 것이 그 사실이다.
  const wider = {
    ...ADMITTED,
    ui: [...ADMITTED.ui, 'docs/guide.md'],
    admissions: { ...ADMITTED.admissions, R4: { verifiers: ['ui-paths'] } },
  };
  const widerRoot = gitFixture({
    'README.md': '[guide](docs/guide.md)\n',
    'docs/guide.md': 'ok\n',
    'graduand.json': `${JSON.stringify(wider, null, 2)}\n`,
  });
  const widerCells = api.gridCounts(gridOf(widerRoot)).cells;
  assert.equal(
    widerCells,
    (Object.keys(wider.admissions).length + Object.keys(wider.exemptions).length) * wider.ui.length,
  );
  assert.ok(widerCells > rows * columns);
});

/**
 * ─── 교차 축(「박제 == 정본」) · 체크아웃 N개 ───
 *
 * 여기서 받는 것은 다섯이다 — 정본 포인터가 **실제로 소비되는가** · 한 저장소 표면이
 * 「판정 불가」로 정직하게 그려지는가 · 침묵의 갈라짐이 정본이 보이는 표면에서 **위반**
 * 인가 · 같은 선언이 한 저장소 표면에서는 「밖 + 미판정」인가 · 격자가 체크아웃 N개를
 * 함께 세는가.
 *
 * ⛔ 기대 수를 상수로 적지 않는다 — 아래 전부가 선언 객체와 토큰 객체에서 유도한다.
 */

const CANON_REPO = 'acme/design-system';
const CONSUMER_REPO = 'acme/storefront';
const CANON_FILE = 'tokens/tokens.css';
const CONSUMER_FILE = 'src/theme.css';

/** 정본이 든 공유값 — 교차 축의 **분모**다. */
const CANON_TOKENS: Record<string, string> = {
  '--paper': '#F6F5F2',
  '--ink': '#23263A',
  '--line': '#D8DAE3',
};

const cssOf = (tokens: Record<string, string>): string =>
  `:root {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;

const CANON_DECLARATION = {
  ui: ['tokens/'],
  palette: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root' },
  admissions: { FH11: { verifiers: ['palette', 'palette-cross'] } },
};

/** 정본 저장소의 체크아웃 — 자기가 정본이라 박제하지 않는다(그래서 `canon` 도 없다). */
const canonFixture = (): string =>
  gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify(CANON_DECLARATION, null, 2)}\n`,
      [CANON_FILE]: cssOf(CANON_TOKENS),
    },
    `https://github.com/${CANON_REPO}.git`,
  );

const consumerDeclaration = (pinned: Record<string, string>) => ({
  ui: ['src/', 'README.md'],
  palette: {
    adapter: 'css-custom-properties',
    files: [CONSUMER_FILE],
    scope: ':root',
    canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
    pinned,
  },
  admissions: { FH11: { verifiers: ['palette', 'palette-cross'] } },
});

/**
 * 소비 저장소의 체크아웃. 코드는 기본적으로 **박제와 같다** — 그래야 CI 축(「코드 ==
 * 박제」)이 초록인 채 교차 축만 질문에 답하는 그 상황이 선다.
 */
const consumerFixture = (pinned: Record<string, string>, code = pinned): string =>
  gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify(consumerDeclaration(pinned), null, 2)}\n`,
      [CONSUMER_FILE]: cssOf(code),
    },
    `https://github.com/${CONSUMER_REPO}.git`,
  );

/** 값과 박제를 함께 바꾼 PR — 이 저장소의 모든 가드가 초록인 채 저장소 간 갈라짐이 선다. */
const DRIFTED_PINS = { ...CANON_TOKENS, '--line': '#CCCCCC' };
/** 박제에서 토큰을 빼고 사유를 적지 않은 선언 — 침묵의 갈라짐이다. */
const SILENT_PINS = { '--paper': CANON_TOKENS['--paper']!, '--ink': CANON_TOKENS['--ink']! };

interface CrossSurface {
  repo: string | null;
  judgment: api.Judgment;
  grid: api.AdmissionGrid;
}

/** 한 잡이 체크아웃 N개를 본다 — 각 체크아웃은 **나머지 전부를 시야로** 판정된다. */
function judgeTogether(roots: string[]): CrossSurface[] {
  const loads = loadWorkspaces(roots);
  return loads.map((load, at) => {
    const peers = loads.filter((_, other) => other !== at).map((other) => other.snapshot);
    const judgment = api.judgeSnapshot(load.snapshot, { peers });
    return { repo: load.snapshot.repo, judgment, grid: api.admissionGrid(load.snapshot, judgment.checks) };
  });
}

const checkOf = (surface: CrossSurface, id: string): api.CheckResult =>
  surface.judgment.checks.find((c) => c.id === id) ?? assert.fail(`${id} 칸이 없다`);

const surfaceOf = (surfaces: CrossSurface[], repo: string): CrossSurface =>
  surfaces.find((s) => s.repo === repo) ?? assert.fail(`${repo} 표면이 없다`);

test('교차 축 AC1 — 정본과 하류를 함께 보면 박제와 정본의 차이가 위반으로 선다', () => {
  const canon = canonFixture();
  const consumer = consumerFixture(DRIFTED_PINS);
  const surfaces = judgeTogether([canon, consumer]);

  const downstream = surfaceOf(surfaces, CONSUMER_REPO);
  // 이 저장소만 보는 축은 초록이다 — 코드와 박제를 함께 바꿨으니까.
  assert.equal(checkOf(downstream, 'palette').status, 'pass');

  const cross = checkOf(downstream, 'palette-cross');
  assert.equal(cross.status, 'violation'); // 정본이 보이면 그 갈라짐이 보인다
  assert.equal(cross.counts.canon, Object.keys(CANON_TOKENS).length); // 분모는 정본이다
  assert.equal(cross.counts.mismatched, 1);
  // 증거는 **정본의** 좌표뿐이고 값은 없다 — 양쪽 저장소의 파일 내용이 보고로 나가지 않는다.
  assert.deepEqual(cross.evidence.map((e) => [e.token, e.file, e.why]), [['--line', CANON_FILE, 'mismatch']]);
  const serialized = api.serializeJudgment(downstream.judgment);
  for (const value of [...Object.values(CANON_TOKENS), ...Object.values(DRIFTED_PINS)]) {
    assert.ok(!serialized.includes(value), `${value} 가 보고에 실렸다`);
  }

  // 빨강의 근거는 위반이다 — 한 잡이 둘을 보고 exit 1 로 끝난다.
  const r = runCli(['--root', canon, '--root', consumer], process.cwd());
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /palette-cross: violation/);
});

test('교차 축 AC2 — 체크아웃 하나면 그 칸은 single-repo-surface 미판정이고, 위반 0 과 다르게 그려진다', () => {
  // AC1 과 **같은 선언**이다 — 갈라짐은 실재하고, 이 표면이 그것을 볼 수 없을 뿐이다.
  const consumer = consumerFixture(DRIFTED_PINS);
  const [only] = judgeTogether([consumer]);

  const cross = checkOf(only!, 'palette-cross');
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'single-repo-surface');
  assert.notEqual(cross.status, 'pass'); // 시야 밖은 「위반 0」이 아니다
  assert.equal(cross.counts.excluded, Object.keys(DRIFTED_PINS).length); // 박제 전부가 「밖」이다

  const r = runCli(['--root', consumer], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr); // 미판정은 빨강의 근거가 아니다
  // 화면이 「통과」로 그리지 않는다: 사유가 적히고, 관할 칸은 미판정으로 센다.
  assert.match(r.stdout, /palette-cross: unjudged \(single-repo-surface\)/);
  assert.match(r.stdout, /jurisdiction \d+ — violation 0 · pass 0 · unjudged [1-9]/);
  assert.doesNotMatch(r.stdout, /palette-cross: pass/);
});

test('교차 축 AC3 — 박제에서 빼고 사유를 적지 않은 토큰은 정본이 보이는 표면에서 위반이다', () => {
  const canon = canonFixture();
  const consumer = consumerFixture(SILENT_PINS, CANON_TOKENS);
  const surfaces = judgeTogether([canon, consumer]);

  const downstream = surfaceOf(surfaces, CONSUMER_REPO);
  // 박제가 분모인 CI 축은 그 토큰을 **모른다** — 뺀 쪽이 싼 길이 되는 자리다.
  assert.equal(checkOf(downstream, 'palette').status, 'pass');

  const cross = checkOf(downstream, 'palette-cross');
  assert.equal(cross.status, 'violation');
  assert.equal(cross.counts.pinned, Object.keys(SILENT_PINS).length);
  assert.equal(cross.counts.unpinned, Object.keys(CANON_TOKENS).length - Object.keys(SILENT_PINS).length);
  assert.deepEqual(cross.evidence.map((e) => [e.token, e.why]), [['--line', 'unpinned']]);

  const r = runCli(['--root', canon, '--root', consumer], process.cwd());
  assert.equal(r.status, 1, r.stdout + r.stderr);
});

test('교차 축 AC4 — 같은 선언이 한 저장소 표면에서는 「밖 + 미판정」이다 (위반이 아니다)', () => {
  const consumer = consumerFixture(SILENT_PINS, CANON_TOKENS);
  const [only] = judgeTogether([consumer]);

  const cross = checkOf(only!, 'palette-cross');
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'single-repo-surface');
  assert.equal(cross.counts.excluded, Object.keys(SILENT_PINS).length);
  assert.notEqual(cross.status, 'violation'); // 잘못 선언한 것은 판정 실패이되 **판정이 가능할 때**다

  const r = runCli(['--root', consumer], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('교차 축 AC5 — 서로 다른 root 의 체크아웃 N개를 한 잡에서 보면 격자가 N개 표면을 함께 센다', () => {
  const canon = canonFixture();
  const consumer = consumerFixture(DRIFTED_PINS);
  const surfaces = judgeTogether([canon, consumer]);
  assert.equal(surfaces.length, 2);

  // 칸 수는 선언에서만 유도된다 — 체크아웃마다 규칙 × 표면이고, 합산도 그 곱의 합이다.
  const expected =
    Object.keys(CANON_DECLARATION.admissions).length * CANON_DECLARATION.ui.length +
    Object.keys(consumerDeclaration(DRIFTED_PINS).admissions).length *
      consumerDeclaration(DRIFTED_PINS).ui.length;
  const totals = api.gridTotals(surfaces.map((s) => s.grid));
  assert.equal(totals.cells, expected);
  assert.equal(totals.violation + totals.pass + totals.unjudged, totals.cells); // 셋의 합이 분모다
  // 합산은 **함께** 센다 — 어느 한 표면의 수보다 크다.
  for (const surface of surfaces) assert.ok(totals.cells > api.gridCounts(surface.grid).cells);

  const r = runCli(['--root', canon, '--root', consumer], process.cwd());
  assert.match(r.stdout, new RegExp(`${surfaces.length} checkouts in one job`));
  assert.match(
    r.stdout,
    new RegExp(
      `jurisdiction ${totals.cells} — violation ${totals.violation} · pass ${totals.pass} · unjudged ${totals.unjudged}`,
    ),
  );
  for (const banned of [/score/i, /grade/i, /percent/i, /\d%/]) assert.doesNotMatch(r.stdout, banned);

  // `--json` 은 체크아웃마다 한 줄 — 어느 측정도 조용히 사라지지 않는다.
  const json = runCli(['--root', canon, '--root', consumer, '--json'], process.cwd());
  const measured = json.stdout.trim().split('\n').map((line) => api.parseMeasurement(line));
  assert.deepEqual(measured.map((m) => m.judgment.repo), [CANON_REPO, CONSUMER_REPO]);
});

test('교차 축 — 측정 하나를 싣는 표면은 체크아웃 여럿을 조용히 버리지 않는다', () => {
  const canon = canonFixture();
  const consumer = consumerFixture(DRIFTED_PINS);
  for (const flag of ['--fragment', '--open']) {
    const r = runCli(['--root', canon, '--root', consumer, flag], process.cwd());
    assert.equal(r.status, 2, `${flag}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /carries one measurement/);
    assert.equal(r.stdout.trim(), '');
  }
  // 같은 루트를 두 번 받으면 한 저장소가 둘로 세어진다 — 조용히 합치지 않는다.
  const twice = runCli(['--root', consumer, '--root', consumer], process.cwd());
  assert.equal(twice.status, 2);
  assert.match(twice.stderr, /declared twice/);
});

/**
 * ─── 자격 (자격은 판정의 **인자**다) ───
 *
 * 받는 것은 여섯이다 — 자격 없음이 칸 전부를 미판정으로 두면서 **분모를 남기는가** ·
 * 「없음」과 「확인 불가」가 **갈라지는가** · 둘 다 **초록인가** · 판정 함수가 여전히
 * **순수한가** · 두 표면의 바이트가 같은가(그쪽은 페이지 패키지가 받는다) · 선언 파일에
 * 자격·과금 키가 **0** 인가.
 *
 * ⛔ 기대 칸 수를 상수로 적지 않는다 — 아래 전부가 선언 객체에서 곱한다.
 * ⛔ 테스트가 네트워크를 타지 않는다 — 벤더를 부르는 손은 **주입된다**.
 */

/** 자격이 걸리는 격자 — 이 객체가 기대값의 **유일한 출처**다. */
const ENTITLED = {
  ui: ['docs/', 'README.md'],
  admissions: {
    E1: { verifiers: ['refs'] },
    E2: { verifiers: ['palette'] },
    E3: { verifiers: ['ui-paths'] },
    E4: { verifiers: ['refs', 'palette-cross'] },
  },
};

const entitlementFixture = (extra: Record<string, string> = {}): string =>
  gitFixture({
    'README.md': '[guide](docs/guide.md)\n',
    'docs/guide.md': 'ok\n',
    'graduand.json': `${JSON.stringify(ENTITLED, null, 2)}\n`,
    ...extra,
  });

/** 같은 스냅샷을 자격 인자만 바꿔 판정한다 — 「같은 입력에 같은 수」의 그 입력이 자격이다. */
function judgedWith(root: string, entitlement?: api.Entitlement): { judgment: api.Judgment; grid: api.AdmissionGrid } {
  const { snapshot } = loadWorkspaceSnapshot(root);
  const judgment = api.judgeSnapshot(snapshot, { entitlement });
  return { judgment, grid: api.admissionGrid(snapshot, judgment.checks) };
}

/** 고정된 측정 시각과 그 봉투의 UTC 날짜 — 만기를 세는 「오늘」이 테스트 안에서 고정된다. */
const MEASURED_AT = '2026-10-26T00:00:00.000Z';
const ON_DATE = api.utcDateOf(MEASURED_AT);

const envelopeOf = (judgment: api.Judgment): api.Measurement => ({
  judgment,
  source: 'workspace',
  measuredAt: MEASURED_AT,
  verifier: { name: api.VERIFIER.name, version: api.VERIFIER.version },
  dirty: 0,
});

/**
 * 발행 조직 id 가 **들어온 뒤**의 세상 — 벤더에게 묻는 경로를 받으려면 그 상수가 서야 한다.
 * ⭐ 조직 id 가 실제로 들어오는 날 이 하네스는 사라지고 아래 테스트는 **그대로 돈다.**
 */
async function asWired<T>(run: () => Promise<T>): Promise<T> {
  const before = api.ENTITLEMENT.organizationId;
  api.ENTITLEMENT.organizationId = 'org_under_test';
  try {
    return await run();
  } finally {
    api.ENTITLEMENT.organizationId = before;
  }
}

/**
 * 고객 몫이 다 된 io 로 자격 하나를 푼다 — 네트워크만 테스트가 고르고, 만기를 세는 날짜는
 * 봉투의 그 날짜다(⛔ 시계를 읽지 않는다: 읽으면 이 테스트가 내일 다른 답을 받는다).
 */
const ON_DATE_IO = (impl: typeof fetch): Promise<api.Entitlement> =>
  api.resolveEntitlement(customerIo(impl), ON_DATE);

/** 고객 몫이 다 된 io — 네트워크만 테스트가 고른다(밖으로 한 바이트도 나가지 않는다). */
const customerIo = (impl: typeof fetch): api.EntitlementIo => ({
  readHandle: () => JSON.stringify({ [api.ENTITLEMENT.handleKey]: 'act_under_test' }),
  readKey: () => 'key_under_test',
  fetch: impl,
});

const asFetch = (impl: (url: string) => Promise<Response>): typeof fetch =>
  ((input: string | URL | Request) => impl(input instanceof Request ? input.url : String(input))) as typeof fetch;

test('자격 AC1 — 자격이 없으면 칸 전부가 「미판정 — 자격 없음」이고 분모는 그대로 보인다', () => {
  const root = entitlementFixture();
  const none = judgedWith(root, { state: 'absent', detail: 'not-configured', expires: null });

  // 등록부의 칸 전부가 같은 사유로 미판정이고, **수는 하나도 나오지 않는다.**
  assert.deepEqual(
    none.judgment.checks.map((c) => c.id),
    [...api.VERIFIER_IDS].sort(),
  );
  for (const check of none.judgment.checks) {
    assert.equal(check.status, 'unjudged');
    assert.equal(check.reason, 'no-entitlement');
    assert.deepEqual(check.counts, {}, '수가 나왔다 — 「계산하고 표시만 가린다」는 막는 척이다');
  }

  // ⭐⭐ **분모는 선언에서 온다** — 자격을 본 격자와 보지 않은 격자의 모양이 같다.
  const open = judgedWith(root);
  assert.deepEqual(none.grid.surfaces, open.grid.surfaces);
  assert.deepEqual(none.grid.rules.map((r) => r.rule), open.grid.rules.map((r) => r.rule));
  assert.deepEqual(none.grid.rules.map((r) => r.verifiers), open.grid.rules.map((r) => r.verifiers));
  assert.equal(none.grid.reason, null, '분모를 감췄다 — 「부재를 공백으로」다');

  const counts = api.gridCounts(none.grid);
  assert.equal(counts.cells, Object.keys(ENTITLED.admissions).length * ENTITLED.ui.length);
  assert.ok(counts.cells > 0, '분모가 0 이면 이 테스트는 아무것도 재지 않는다');
  assert.equal(counts.unjudged, counts.cells);
  assert.equal(counts.violation, 0);
  assert.equal(counts.pass, 0);
  for (const row of none.grid.rules) assert.equal(row.reason, 'no-entitlement');
});

test('자격 AC2 — 답을 못 받으면 「자격 확인 불가」다: 「자격 없음」과 같은 칸이 아니다', async () => {
  const [offline, served, said] = await asWired(async () => [
    // 끊긴 네트워크 — 답을 받지 못했다.
    await ON_DATE_IO(asFetch(() => Promise.reject(new TypeError('fetch failed')))),
    // 벤더가 서 있지 않다 — 같은 자리다(5xx 는 답이 아니다).
    await ON_DATE_IO(asFetch(() => Promise.resolve(new Response('', { status: 503 })))),
    // ⭐ **404 는 서버가 답한 것이다** — 이쪽만 「없다」로 읽는다.
    await ON_DATE_IO(asFetch(() => Promise.resolve(new Response('{}', { status: 404 })))),
  ]);

  assert.deepEqual(api.entitlementGate(offline), { reason: 'entitlement-unverifiable', detail: 'no-answer' });
  assert.deepEqual(api.entitlementGate(served), { reason: 'entitlement-unverifiable', detail: 'no-answer' });
  assert.deepEqual(api.entitlementGate(said), { reason: 'no-entitlement', detail: 'vendor-said-no' });

  // ⛔ 뭉치지 않는다 — 요구하는 행동이 「네트워크를 열어라」와 「사라」로 다르다.
  const root = entitlementFixture();
  for (const check of judgedWith(root, offline).judgment.checks) {
    assert.equal(check.reason, 'entitlement-unverifiable');
    assert.notEqual(check.reason, 'no-entitlement', '돈 낸 고객이 오프라인 CI 에서 「자격 없음」을 받는다');
  }
  for (const row of judgedWith(root, offline).grid.rules) assert.equal(row.reason, 'entitlement-unverifiable');
});

test('자격 AC3 — 자격 없음도 확인 불가도 exit 0 이다: 자격은 위반이 아니라 미판정이다', () => {
  const root = entitlementFixture();
  for (const detail of ['not-configured', 'vendor-said-no', 'no-answer', 'key-absent'] as const) {
    const { judgment } = judgedWith(root, { state: 'absent', detail, expires: null });
    assert.equal(judgment.checks.filter((c) => c.status === 'violation').length, 0);
    // 종료 코드를 내는 손은 하나다 — 그 함수에 자격이 **근거로 들어가지 않는다.**
    assert.equal(gateExitCode([{ measurement: envelopeOf(judgment), overdue: [] }]), 0, detail);
  }

  // ⭐ 그리고 **측정 명령 자체**가 초록이다 — 고객이 자기 몫을 했는데 이 빌드가 아직 묻지
  // 못하는 상태를 끝-끝으로 받는다(물을 길이 없으므로 네트워크는 한 바이트도 타지 않는다).
  const configured = entitlementFixture({
    [api.ENTITLEMENT.file]: `${JSON.stringify({ [api.ENTITLEMENT.handleKey]: 'act_under_test' })}\n`,
  });
  const r = runCli(['--root', '.'], configured, { ...process.env, [api.ENTITLEMENT.keyEnv]: 'key_under_test' });
  assert.equal(r.status, 0, `자격은 빨강의 근거가 아니다 — exit ${r.status}: ${r.stderr}`);
  assert.match(r.stdout, /entitlement: unjudged \(entitlement-unverifiable\)/);
  // 분모는 보고에도 그대로 선다 — 「관할 N」이 수를 내지 못한 채로도 적힌다.
  assert.match(r.stdout, /jurisdiction \d+ — violation 0 · pass 0 · unjudged \d+/);
  for (const banned of [/score/i, /grade/i, /percent/i, /\d%/]) assert.doesNotMatch(r.stdout, banned);
});

/**
 * 판정 함수에 있어서는 안 되는 원시 — 네트워크 · 파일 · 시계 · 무작위 · 환경. 자격이
 * **인자**라는 말의 집행이 이 목록이고, 각 항은 「같은 입력에 같은 바이트」를 깨는 손이다.
 */
const IMPURE_PRIMITIVES: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  { id: 'fetch', pattern: /\bfetch\s*\(/ },
  { id: 'xhr', pattern: /XMLHttpRequest|sendBeacon|WebSocket|EventSource/ },
  { id: 'node-builtin', pattern: /['"]node:/ },
  { id: 'fs', pattern: /read(File|dir)Sync|writeFileSync|existsSync/ },
  { id: 'clock', pattern: /\bnew Date\b|Date\.now/ },
  { id: 'random', pattern: /Math\.random/ },
  { id: 'env', pattern: /\bprocess\./ },
  { id: 'dynamic-import', pattern: /\bimport\s*\(/ },
];

const impurities = (text: string): string[] =>
  IMPURE_PRIMITIVES.filter((p) => p.pattern.test(text)).map((p) => p.id);

test('자격 AC4 (negative) — 판정 함수에 네트워크·I/O 원시가 0 이다: 자격은 인자로만 들어온다', () => {
  const judge = readFileSync(new URL('./judge.ts', import.meta.url), 'utf8');
  assert.deepEqual(impurities(judge), []);

  // import 도 경계 밖으로 나가지 않는다 — 벤더를 부르는 손은 **호스트**에 있다.
  for (const match of judge.matchAll(/from '([^']+)'/g)) {
    const spec = match[1]!;
    assert.ok(spec.startsWith('./'), `판정이 경계 밖을 가져온다: ${spec}`);
    assert.ok(!spec.includes('hosts/'), `판정이 호스트를 가져온다: ${spec}`);
  }

  // ⭐⭐ 금칙이 **살아 있다** — 심으면 빨갛다. 깨끗한 원본이 초록인 것이 그 대조군이다.
  const planted = [
    'const r = await fetch(ENTITLEMENT.validateUrl);',
    "import { readFileSync } from 'node:fs';",
    'const at = Date.now();',
    'const k = process.env.GRADUAND_LICENSE_KEY;',
    'const n = Math.random();',
  ];
  for (const sample of planted) {
    assert.notDeepEqual(impurities(`${judge}\n${sample}\n`), [], `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`);
  }
});

test('자격 AC6 (negative) — 선언 파일에 자격·과금 키가 0 이다: 핸들은 별 파일이다', () => {
  // 두 이름이 **다른 상수**에서 온다 — 선언은 닫힌 스키마고, 핸들은 그 밖에 산다.
  assert.notEqual(api.ENTITLEMENT.file, api.DECLARATION_FILE);

  // 스캐폴드가 쓰는 그 바이트에도 자격·과금 키가 없다 — 고객에게 권하는 선언이 그것이다.
  const scaffold = JSON.parse(api.SCAFFOLD_JSON) as Record<string, unknown>;
  for (const key of [api.ENTITLEMENT.handleKey, 'license_key', 'entitlement', 'subscription', 'billing']) {
    assert.ok(!(key in scaffold), `스캐폴드에 ${key} 가 있다`);
  }

  // ⭐⭐ 심으면 **판정 실패**다 — 조용히 무시되지 않고, 왜 자리가 없는지까지 말한다.
  for (const key of [api.ENTITLEMENT.handleKey, 'license_key']) {
    const result = api.validateDeclaration(JSON.stringify({ ui: [], [key]: 'x' }));
    assert.equal(result.state, 'invalid', `${key} 를 심었는데 선언이 통과했다`);
    const problems = (result as { problems: string[] }).problems;
    assert.ok(problems.some((p) => p.includes(key)), problems.join(' | '));
  }
  // 핸들 키는 **어디로 가야 하는지**를 말하고, 키는 **파일이 아니라 환경**이라고 말한다.
  const handle = api.validateDeclaration(JSON.stringify({ [api.ENTITLEMENT.handleKey]: 'x' })) as { problems: string[] };
  assert.ok(handle.problems.some((p) => p.includes(api.ENTITLEMENT.file)), handle.problems.join(' | '));
  const secret = api.validateDeclaration(JSON.stringify({ license_key: 'x' })) as { problems: string[] };
  assert.ok(secret.problems.some((p) => p.includes(api.ENTITLEMENT.keyEnv)), secret.problems.join(' | '));

  // 그리고 측정 명령이 그 자리에서 멈춘다 — exit 2 고, 수를 내지 않았다.
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json': JSON.stringify({ ui: [], [api.ENTITLEMENT.handleKey]: 'act_under_test' }),
  });
  const r = runCli(['--root', '.'], root);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), '');
  assert.match(r.stderr, new RegExp(api.ENTITLEMENT.file.replace(/\./g, '\\.')));
});

test('자격 — 커밋된 핸들은 키 하나다: 모르는 모양은 조용히 넘어가지 않는다', () => {
  assert.deepEqual(api.parseHandle(JSON.stringify({ [api.ENTITLEMENT.handleKey]: 'act_1' })), {
    activationId: 'act_1',
  });
  for (const bad of [
    '{',
    '[]',
    'null',
    '{}',
    JSON.stringify({ [api.ENTITLEMENT.handleKey]: '' }),
    JSON.stringify({ [api.ENTITLEMENT.handleKey]: 'act_1', license_key: 'k' }),
    JSON.stringify({ activationID: 'act_1' }),
  ]) {
    assert.equal(api.parseHandle(bad), 'unreadable', bad);
  }

  // ⭐ 깨진 핸들은 **판정 실패가 아니다** — 과금 상태 하나로 저장소 전체의 수를 지우지
  // 않는다. 미판정이고, 사유가 「확인 불가」이고, 그래서 초록이다.
  const root = entitlementFixture({ [api.ENTITLEMENT.file]: '{ broken\n' });
  const r = runCli(['--root', '.'], root, { ...process.env, [api.ENTITLEMENT.keyEnv]: 'key_under_test' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /entitlement: unjudged \(entitlement-unverifiable\)/);
});

test('자격 — 묻지 못하는 빌드는 막지 않고 **말한다**: 조용한 통과를 두지 않는다', () => {
  // 아무도 아무것도 하지 않았다 — 고객은 핸들도 키도 두지 않고, 이 빌드는 물을 길이 없다.
  const r = runCli(['--root', '.'], entitlementFixture());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /entitlement: not asked/);
  assert.match(r.stdout, /nothing is gated/);
  // 그래서 수가 **나온다** — 자격이 막지 않았다는 사실이 수의 존재로 보인다.
  assert.match(r.stdout, /jurisdiction \d+ — violation \d+ · pass \d+ · unjudged \d+/);
  assert.doesNotMatch(r.stdout, /no-entitlement/);
});

/**
 * ─── 파일럿 만기 고지 (만기는 봉투가 판정하고, **고지는 제품이 한다**) ───
 *
 * 받는 것은 넷이다 — 만기일과 남은 날이 **보이는가** · 만기 **당일**이 아직 자격인가 ·
 * 넘긴 뒤의 보고가 「자격 없음」과 **전환 링크를 함께** 말하는가 · 고지에 절대 URL 과
 * 지표 어휘가 **0** 인가. AC5(두 표면이 **같은 문장**)는 페이지 패키지가 받는다 — 두
 * 표면이 다 있는 자리에서만 받을 수 있는 단정이고, 흉내는 사본이다.
 *
 * ⛔ 남은 날을 **상수로 적지 않는다** — 아래 전부가 두 날짜에서 유도한다.
 * ⛔ 테스트가 네트워크를 타지 않는다 — 벤더를 부르는 손은 **주입된다**.
 * ⭐ 그리고 **새 기전이 0 이다**: 넘김을 세는 술어는 면제의 만기와 같은 하나다.
 */

/** 다음 날 — 경계가 「당일과 다음 날 사이」에 있다는 것을 재는 자리에만 쓴다. */
const nextDay = (date: string): string =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);

/** 두 날짜 사이의 날 수 — 기대값을 **유도한다**(테스트에 수를 적지 않는다). */
const spanDays = (from: string, to: string): number =>
  (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;

/**
 * 벤더가 **만기를 적어** 답하는 세상 — 자격 하나를 그 답에서 푼다.
 *
 * ⚠️ 벤더의 만기는 **시각**으로 온다(`…T12:00:00Z`) — 날짜로 자르는 자리가 하나인지를
 * 여기서 함께 잰다: 자르지 않으면 「남은 날」이 반나절 때문에 하루 어긋난다.
 */
const vendorSaysExpiry = (expires: string | null, onDate: string): Promise<api.Entitlement> =>
  asWired(() =>
    api.resolveEntitlement(
      customerIo(
        asFetch(() =>
          Promise.resolve(
            new Response(
              JSON.stringify(expires === null ? {} : { [api.ENTITLEMENT.expiresKey]: `${expires}T12:00:00.000Z` }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            ),
          ),
        ),
      ),
      onDate,
    ),
  );

/** 보고가 자격 절에 적는 줄 전부 — 측정 명령이 이 **순서 그대로** 찍는다. */
const noticeOf = (entitlement: api.Entitlement): string[] => [
  ...api.describeEntitlement(entitlement),
  ...api.describeExpiry(entitlement, ON_DATE),
];

test('만기 고지 AC1 — 만기가 든 자격은 만기일과 남은 날을 고지하고, 전환 링크가 상대 경로다', async () => {
  const EXPIRES = '2026-11-05';
  const entitlement = await vendorSaysExpiry(EXPIRES, ON_DATE);
  // 벤더가 시각으로 적어도 봉투가 쥐는 것은 **날짜**다.
  assert.deepEqual(entitlement, { state: 'entitled', expires: EXPIRES });

  const said = api.describeExpiry(entitlement, ON_DATE).join('\n');
  assert.match(said, new RegExp(EXPIRES), '만기일이 고지에 없다');
  assert.match(said, new RegExp(`\\b${spanDays(ON_DATE, EXPIRES)} day\\(s\\) left\\b`), said);
  // 센 날짜가 **봉투의 그 날짜**라고 고지가 스스로 말한다 — 「오늘」을 읽지 않았다.
  assert.match(said, new RegExp(`as of ${ON_DATE} \\(UTC\\)`), said);

  // 전환 링크는 상대 경로 하나다 — 보고가 벤더 주소를 쥐지 않는다.
  assert.ok(said.includes(api.CHECKOUT_PATH), said);
  assert.ok(api.CHECKOUT_PATH.startsWith('./'), api.CHECKOUT_PATH);

  // ⭕ 그러면서 **수는 그대로 나온다** — 만기가 든 자격은 막는 자격이 아니다.
  assert.equal(api.entitlementGate(entitlement), null);
  const { grid } = judgedWith(entitlementFixture(), entitlement);
  assert.ok(api.gridCounts(grid).violation + api.gridCounts(grid).pass > 0, '만기가 수를 막았다');

  // 만기가 **없는** 자격은 고지가 0 줄이다 — 없는 사실을 적지 않는다.
  assert.deepEqual(await vendorSaysExpiry(null, ON_DATE), { state: 'entitled', expires: null });
  assert.deepEqual(api.describeExpiry({ state: 'entitled', expires: null }, ON_DATE), []);
  assert.deepEqual(api.describeExpiry({ state: 'unwired' }, ON_DATE), []);
  assert.deepEqual(api.describeExpiry(undefined, ON_DATE), []);
});

test('만기 고지 AC2 — 만기 당일은 남은 날 0 이고 **아직 자격이 있다** (UTC 날짜 절단의 경계값)', async () => {
  const today = await vendorSaysExpiry(ON_DATE, ON_DATE);
  assert.deepEqual(today, { state: 'entitled', expires: ON_DATE });
  assert.equal(api.entitlementGate(today), null, '만기 당일에 수가 막혔다 — 「만기」가 「만기 전날까지」가 됐다');
  assert.match(api.describeExpiry(today, ON_DATE).join('\n'), /\b0 day\(s\) left\b/);
  // ⭐ 그 경계가 **사실에** 있다 — 문장은 이것을 읽어 접을 뿐이고, 두 표면이 받는 것도 이것이다.
  assert.deepEqual(api.entitlementNotice(today, ON_DATE).expiry, {
    expires: ON_DATE,
    daysLeft: 0,
    pastExpiry: false,
    onDate: ON_DATE,
  });

  // 경계는 **당일과 다음 날 사이**에 있다 — 하루 뒤가 넘긴 것이다.
  const tomorrow = nextDay(ON_DATE);
  assert.deepEqual(await vendorSaysExpiry(ON_DATE, tomorrow), {
    state: 'absent',
    detail: 'past-expiry',
    expires: ON_DATE,
  });

  // 그리고 **자르는 자리가 UTC 하나다** — 측정이 몇 시였는지가 경계를 옮기지 않는다.
  assert.equal(api.utcDateOf(`${ON_DATE}T00:00:00.000Z`), ON_DATE);
  assert.equal(api.utcDateOf(`${ON_DATE}T23:59:59.999Z`), ON_DATE);
  assert.equal(api.utcDateOf(`${tomorrow}T00:00:00.000Z`), tomorrow);
});

test('만기 고지 AC3 — 넘긴 뒤의 보고는 「미판정 — 자격 없음」과 전환 링크를 **함께** 말한다', async () => {
  const EXPIRED = '2026-10-01';
  const past = await vendorSaysExpiry(EXPIRED, ON_DATE);
  assert.deepEqual(past, { state: 'absent', detail: 'past-expiry', expires: EXPIRED });
  // 「없다」쪽이다 — 요구하는 행동이 「사라(전환하라)」다. ⛔ 「확인 불가」가 아니다.
  assert.deepEqual(api.entitlementGate(past), { reason: 'no-entitlement', detail: 'past-expiry' });

  const { judgment, grid } = judgedWith(entitlementFixture(), past);
  for (const check of judgment.checks) {
    assert.equal(check.status, 'unjudged');
    assert.equal(check.reason, 'no-entitlement');
    assert.deepEqual(check.counts, {}, '수가 나왔다 — 막는 척이다');
  }
  // ⭐ **간극이 기능이다** — 분모는 그대로 보인다. 압력은 빈 화면이 아니라 **빈 수**다.
  const counts = api.gridCounts(grid);
  assert.equal(counts.cells, Object.keys(ENTITLED.admissions).length * ENTITLED.ui.length);
  assert.equal(counts.unjudged, counts.cells);
  assert.equal(grid.reason, null, '분모를 감췄다');

  // 두 목록이 **이어 붙어** 한 자리에 선다 — 「무엇이 없는가」와 「무엇을 하면 되는가」.
  const lines = noticeOf(past);
  const text = lines.join('\n');
  assert.match(text, /unjudged \(no-entitlement\)/);
  assert.match(text, new RegExp(`entitlement expired ${EXPIRED} — ${spanDays(EXPIRED, ON_DATE)} day\\(s\\) ago`), text);
  assert.ok(text.includes(api.CHECKOUT_PATH), text);
  // 사이에 다른 절이 끼지 않는다 — 자격 줄들 바로 뒤가 만기 줄들이다.
  const saidNone = lines.findIndex((l) => l.includes('no-entitlement'));
  const saidLink = lines.findIndex((l) => l.includes(api.CHECKOUT_PATH));
  assert.ok(saidNone >= 0 && saidLink > saidNone, lines.join(' | '));
  assert.ok(saidLink - saidNone <= 4, `「없다」와 「하면 된다」가 ${saidLink - saidNone} 줄 떨어졌다`);

  // ⭐⭐ 그리고 **빨갛지 않다** — 자격은 위반이 아니라 미판정이다. 빨강의 근거 둘(위반 ·
  // 넘긴 **면제**의 만기)에 자격의 만기는 들어가지 않는다: 둘은 다른 물건이다.
  assert.equal(gateExitCode([{ measurement: envelopeOf(judgment), overdue: [] }]), 0);
});

test('만기 고지 AC4 (negative) — 고지에 절대 URL 이 0 이고 수를 접는 어휘도 0 이다', async () => {
  const states: api.Entitlement[] = [
    { state: 'unwired' },
    { state: 'entitled', expires: null },
    { state: 'entitled', expires: '2026-11-05' },
    ...Object.keys(api.DETAIL_REASONS).map(
      (detail): api.Entitlement => ({
        state: 'absent',
        detail: detail as api.EntitlementDetail,
        expires: '2026-10-01',
      }),
    ),
  ];
  // 사유 전수다 — 새 사유가 들어오면 이 단정이 그것도 본다.
  assert.ok(states.length > 3);

  for (const entitlement of states) {
    const text = noticeOf(entitlement).join('\n');
    for (const banned of [
      new RegExp(['ht', 'tps?://'].join(''), 'i'),
      /(^|[^.:])\/\/[a-z0-9]/i,
      new RegExp(['pol', 'ar'].join(''), 'i'),
      /score/i,
      /grade/i,
      /percent/i,
      /\d\s*%/,
    ]) {
      assert.doesNotMatch(text, banned, `${JSON.stringify(entitlement)} → ${text}`);
    }
  }

  // ⭐ 벤더 주소는 **모듈 안의 검증 엔드포인트**로만 산다 — 보고로 새지 않는다.
  assert.match(api.ENTITLEMENT.validateUrl, new RegExp(['ht', 'tps://'].join('')));
  assert.ok(api.CHECKOUT_PATH.startsWith('./'));
  assert.doesNotMatch(api.CHECKOUT_PATH, /:/);

  // 모르는 모양의 만기는 「만기 없음」으로 둔갑하지 않는다 — 읽지 못한 답은 답이 아니다.
  for (const raw of [12345, '어제', {}, 'not-a-date'] as const) {
    const answered = await asWired(() =>
      api.resolveEntitlement(
        customerIo(
          asFetch(() =>
            Promise.resolve(
              new Response(JSON.stringify({ [api.ENTITLEMENT.expiresKey]: raw }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }),
            ),
          ),
        ),
        ON_DATE,
      ),
    );
    assert.deepEqual(answered, { state: 'absent', detail: 'answer-unreadable', expires: null }, String(raw));
  }
});

/**
 * ⭐⭐ **고지의 정본은 문장이 아니라 사실이다** — 그리고 측정 명령의 영문 줄들은 그 사실에서
 * **유도된다.** 둘이 각자 세면 경계값(만기 **당일**)이 한쪽에서만 포함이 되고, 그러면 같은
 * 자격이 어느 줄을 읽는지에 따라 끝났다/안 끝났다가 된다.
 *
 * ⚠️ 「두 표면이 같은 사실에서 그린다」는 단정은 **페이지 패키지**가 받는다 — 두 표면이 다
 * 있는 자리에서만 받을 수 있고, 여기서 흉내내면 사본이다. 여기서 받는 것은 **한 표면 안에서
 * 문장이 사실을 벗어나지 않는다**는 것이다.
 */
test('만기 고지 — 측정 명령의 문장이 **사실을 벗어나지 않는다**: 침묵도 가름도 사실이 결정한다', () => {
  const states: (api.Entitlement | undefined)[] = [
    undefined,
    { state: 'unwired' },
    { state: 'entitled', expires: null },
    { state: 'entitled', expires: ON_DATE },
    { state: 'entitled', expires: nextDay(ON_DATE) },
    ...Object.keys(api.DETAIL_REASONS).map(
      (detail): api.Entitlement => ({
        state: 'absent',
        detail: detail as api.EntitlementDetail,
        expires: '2026-10-01',
      }),
    ),
  ];
  // 사유 전수다 — 새 사유가 들어오면 이 단정이 그것도 본다.
  assert.ok(states.length > 4);

  for (const entitlement of states) {
    const notice = api.entitlementNotice(entitlement, ON_DATE);

    // ⑴ **침묵이 사실에서 온다** — 만기가 사실에 없으면 만기 줄도 0 이다(없는 사실을 적지 않는다).
    const expirySaid = api.describeExpiry(entitlement, ON_DATE);
    assert.equal(expirySaid.length > 0, notice.expiry !== null, JSON.stringify(entitlement));
    if (notice.expiry !== null) {
      const said = expirySaid.join('\n');
      assert.ok(said.includes(notice.expiry.expires), said);
      // ⑵ **센 수가 그 문장에 든다** — 접는 자리가 문장이므로 절댓값으로 센다.
      assert.ok(said.includes(String(Math.abs(notice.expiry.daysLeft))), said);
      assert.ok(said.includes(notice.expiry.onDate), said);
      assert.ok(said.includes(notice.convertPath), said);
      // ⑶ **가름도 사실이 한다** — 같은 날짜를 넘긴 쪽으로 세면 문장이 달라진다.
      const flipped = api.describeExpiry(entitlement, nextDay(notice.expiry.expires)).join('\n');
      assert.notEqual(flipped, said, `${notice.expiry.expires} 에서 넘김이 문장에 닿지 않는다`);
    }

    // 자격 줄들도 같은 사실에서 — 말하는 상태는 「없음」과 「묻지 못함」 둘이다.
    const stateSaid = api.describeEntitlement(entitlement);
    assert.equal(
      stateSaid.length > 0,
      notice.state === 'absent' || notice.state === 'unwired',
      JSON.stringify(entitlement),
    );
    if (notice.state === 'absent') assert.ok(stateSaid.join('\n').includes(notice.reason), stateSaid.join(' | '));
  }
});

test('만기 고지 — 측정 명령의 **두 경로**가 다 고지하고, 문구의 사본을 들지 않는다', () => {
  const cli = readFileSync(new URL('./cli.ts', import.meta.url), 'utf8');

  // 보고 모드와 그 밖(`--json`·`--fragment`·`--open`) 둘 다다 — 한쪽만 고지하면 그 모드로
  // 도는 고객은 만기일을 **한 번도** 듣지 못한 채 어느 날 수를 잃는다.
  assert.equal((cli.match(/describeExpiry\(/g) ?? []).length, 2, '측정 명령의 고지 경로가 둘이 아니다');
  // 자격 줄 **바로 뒤**다 — 사이에 다른 절이 끼면 「없다」만 읽히고 「하면 된다」가 밀린다.
  assert.match(cli, /describeEntitlement\([\s\S]{0,600}?describeExpiry\(/);

  // ⭐⭐ 그리고 문구가 이 파일에 **없다** — 정본은 판정기 모듈 하나다(사본은 갈라진다).
  assert.doesNotMatch(cli, /day\(s\)/, '측정 명령이 고지 문구의 사본을 들었다');
  assert.ok(!cli.includes(api.CHECKOUT_PATH), '측정 명령이 전환 링크의 사본을 들었다');
});
