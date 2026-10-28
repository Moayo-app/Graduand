/**
 * 이슈의 AC 전수 — 같은 커밋을 CI 모드(워크스페이스)와 브라우저 모드(GitHub API)로
 * 판정해 바이트 동일성까지 확인하는 끝-끝 수용 시험.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as api from './index.ts';
import { loadWorkspaceSnapshot, loadWorkspaces } from './hosts/workspace.ts';
import { formatOpenOutcome, openCommand, openReport, reportUrl, REPORT_URL_ROOT } from './open.ts';
import { gateExitCode } from './expiry.ts';
import { planDelivery } from './deliver.ts';
import * as deliverModule from './deliver.ts';

const FILES: Record<string, string> = {
  'README.md': '[guide](docs/guide.md)\n\nSee [[deep-dive]] and `app/main.ts:1`.\n',
  'docs/guide.md': '[back](../README.md)\n',
  'docs/deep-dive.md': 'ok\n',
  'graduand.json':
    JSON.stringify({
      ui: ['app/'],
      'shared-values': { design: {
        adapter: 'css-custom-properties',
        files: ['app/theme.css'],
        scope: ':root',
        canon: { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' },
        // 소문자 hex — 어댑터 정규화를 지나 박제와 일치해야 한다.
        pinned: { '--paper': '#F6F5F2', '--ink': '#23263A' },
      } },
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
  // ⭐ 개정 4 — 공유값의 칸은 **축마다** 선다(`<판정기>:<축>`). 이 선언은 축 하나(`design`)를
  //   들고, 선언을 모르는 두 축(refs · ui-paths)은 접미 없는 이름 그대로다.
  assert.deepEqual(parsed.checks.map((c) => c.id), [
    'refs',
    'shared-values-cross:design',
    'shared-values:design',
    'ui-paths',
  ]);
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
    'VALUE_ADAPTERS',
    'RateLimitedError',
    'REASON_CODES',
    'RECOMMENDED_URL_MAX',
    'RepoUnreadableError',
    'SCHEMA_VERSION',
    'SchemaParseError',
    'SCAFFOLD_JSON',
    'VERIFIER',
    'VERIFIER_IDS',
    // ⭐⭐ 무료 경계가 표면에 선다 — 「선언이 필요한 기능인가」의 분류와 그것에서 **유도된**
    //    두 목록. 화면이 파는 문장(「참조 판정은 선언 없이도 수가 나옵니다」)의 기계 쪽이고,
    //    소비자가 자기 목록을 적으면 그 사본이 등록부와 갈라진다. ⛔ 가격도 상품도 여기 없다:
    //    표면에 서는 것은 **무엇이 선언을 분모로 쓰는가**뿐이다.
    'VERIFIER_BASIS',
    'FREE_VERIFIER_IDS',
    'PAID_VERIFIER_IDS',
    // ⭐⭐ **구독과 자격 사이의 한 걸음** — 키 하나를 자리 하나로 바꾸고 그 핸들을 쓴다.
    //    표면에 서는 것은 그 **행위와 결말**이고, ⛔ 자동으로 부르는 이름은 여기 없다:
    //    활성화는 고객이 산 자리를 쓰는 일이라 판정이 지나는 길에 있을 수 없다.
    'activateEntitlement',
    'writeHandle',
    'composeHandle',
    'formatActivation',
    'activateExitCode',
    'ACTIVATION_ACTIONS',
    'VersionMismatchError',
    'admissionGrid',
    // ⭐ 지목을 읽는 손 — 교차 축이 설 수 있는 표면(체크아웃 N개 · 브라우저의 정본 읽기)은
    //    선언의 이 필드를 **먼저** 알아야 한다. 호스트마다 뜯으면 사본이다. ⭐ 개정 4 에서
    //    **목록**이 됐다: 축마다 지목이 하나라 한 선언이 서로 다른 상류 여럿을 가리킨다.
    'declaredCanons',
    // ⭐ 공유값 축 — 스키마의 키와 **축 이름을 묻는 손**이 표면에 선다. 화면이 키의 자구를
    //    박거나 이름의 규칙을 자기가 정하면 그 순간 사본이고, 사본은 검증기와 갈라진다.
    'SHARED_VALUES_KEY',
    'AXIS_KEYS',
    'axisNameProblem',
    // ⭐ 칸의 id 가 `<판정기>:<축>` 이라(개정 4) 「이 칸은 어느 판정기의 것인가」를 묻는 손이
    //    표면에 선다 — 보고 표면이 접두사 규칙을 따로 적으면 id 를 짓는 손과 갈라진다.
    'AXIS_SEPARATOR',
    'axisCheckId',
    'isCheckOf',
    // ⭐ 조립기 하나가 선다 — 화면과 측정 명령이 **같은 선언**을 내는 조건이다. ⛔ 쓰는
    //    손도 그 말도 여기 없다(호스트의 의미 · 표면의 로케일).
    'composeConstitution',
    // ⭐ 탐색 둘 — 추측을 없애는 자리다(고를 수 있는 경로 · 실제로 읽히는 스코프).
    'candidateFiles',
    'scopesIn',
    // ⭐⭐ 선언 0 에서도 보이는 사실 — ⛔ **판정이 아니다.** 선언 없이 위반을 짓는 축은
    //    우리가 지은 규율이고, 그것은 이 제품이 파는 명제의 반대다: 그래서 이 손이 내는
    //    것에 상태가 없고, 아래 금칙 정규식(점수·등급)에 더해 그 부재를 경계 테스트가
    //    전수한다. ⭐ 하한이 함께 서는 것은 화면이 그 수를 **받아** 말하기 위해서다.
    'readUndeclared',
    'MIN_COPY_LINES',
    // ⭐⭐ 쌍을 **가족으로 접는 손** — 보고 표면의 일이지만 손은 하나여야 한다(측정 명령과
    //    페이지가 각자 접으면 그 둘은 갈라지고, 갈라진 뒤에도 양쪽이 자기 기준으로는 옳다).
    //    ⛔ 봉투는 쌍을 그대로 든다 — 접는 것은 **파생**이라 스키마가 움직이지 않는다.
    'foldDiverged',
    'decodeFragment',
    'encodeFragment',
    'gridCounts',
    'gridTotals',
    'judgeSnapshot',
    'loadGithubSnapshot',
    // ⭐ 요약과 페이지 앵커가 한 자리(해시)를 나눠 쓰므로, 가르는 규칙이 **형식의 몫**이다 —
    //    소비자가 자기 판단으로 가르면 그 판단이 형식과 갈라지고, 갈라진 날 요약이 조용히
    //    앵커로 읽힌다. ⛔ 해석하지 않는다 — 모양만 본다.
    'looksLikeFragment',
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
  const shared = api.judgeSnapshot(snapshot).checks.find((c) => c.id === 'shared-values:design')!;
  assert.equal(shared.status, 'pass');
  assert.equal(shared.counts.declared, 2); // 분모 = 박제 2
  assert.equal(shared.counts.matched, 2); // 소문자 hex 가 정규화를 지나 박제와 일치했다
  assert.equal(shared.counts.excluded, 1); // --local-only — 배제도 센다
});

test('2일차 AC2 — 어댑터 없는 저장소도 선언 파일 폴백으로 같은 스키마의 수를 낸다', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json':
      '{"shared-values": {"design": {"pinned": {"--paper": "#F6F5F2", "--ink": "#23263A"}, "canon": {"repo": "acme/design-system", "file": "tokens/tokens.css", "scope": ":root"}}}}\n',
  });
  const { snapshot } = loadWorkspaceSnapshot(root);
  // 같은 스키마 — 직렬화·역직렬화가 그대로 통과하고, 분모가 수로 남는다.
  const parsed = api.parseJudgment(api.serializeJudgment(api.judgeSnapshot(snapshot)));
  const shared = parsed.checks.find((c) => c.id === 'shared-values:design')!;
  assert.equal(shared.status, 'unjudged');
  assert.equal(shared.reason, 'no-adapter');
  assert.equal(shared.counts.declared, 2);
});

test('2일차 AC3 — 어댑터도 선언도 없으면 「위반 0」이 아니라 「미판정 — 선언 없음」이다', () => {
  const root = gitFixture({ 'README.md': 'ok\n' });
  const { snapshot } = loadWorkspaceSnapshot(root);
  // ⭐ 축이 **하나도** 선언되지 않았으므로 칸의 이름은 접미 없는 맨 이름이다 — 칸이 빠지는
  //   것이 아니라 거기 남아 미판정을 말한다(분모는 선언 여부와 무관하게 고정이다).
  const shared = api.judgeSnapshot(snapshot).checks.find((c) => c.id === 'shared-values')!;
  assert.notEqual(shared.status, 'pass');
  assert.equal(shared.status, 'unjudged');
  assert.equal(shared.reason, 'no-declaration');
});

test('2일차 AC4 — 선언된 판정 기준이 실재하지 않으면 어긋남을 보고하고 멈춘다 (probe)', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json': '{"shared-values": {"design": {"adapter": "css-custom-properties", "files": ["src/theme.css"], "scope": ":root"}}}\n',
  });
  // 선언을 믿지 않는다 — 모듈은 판정 실패로 던지고, 측정 명령은 수 없이 2 로 끝난다.
  assert.throws(() => api.judgeSnapshot(loadWorkspaceSnapshot(root).snapshot), api.DeclarationInvalidError);
  // ⚠️ **자격이 있어야 그 축이 돈다** — 어긋남을 말하는 것은 공유값 판정기이고 그 축은
  //    선언을 분모로 쓴다. 자격 없이 돌리면 축이 아예 돌지 않아 **던질 것도 없고**, 그
  //    초록은 「어긋남이 없다」가 아니라 「묻지 않았다」다.
  const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
  const r = spawnSync(process.execPath, [cli, '--root', root, '--json'], {
    encoding: 'utf8',
    env: entitledEnv([root]),
  });
  assert.equal(r.status, 2);
  assert.equal(r.stdout.trim(), '');
  assert.ok(r.stderr.includes('src/theme.css'));
});

test('2일차 AC5 — 고객 저장소의 내용(값·산문)은 보고 밖으로 나가지 않는다', () => {
  const root = gitFixture({
    'README.md': 'ok\n',
    'graduand.json': JSON.stringify({
      'shared-values': { design: {
        adapter: 'css-custom-properties',
        files: ['src/theme.css'],
        scope: ':root',
        canon: { repo: 'acme/design-system', file: 'tokens/tokens.css', scope: ':root' },
        pinned: { '--paper': '#AAAAAA' },
      } },
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
  const shared = api.parseMeasurement(measurement).judgment.checks.find((c) => c.id === 'shared-values:design')!;
  assert.equal(shared.status, 'violation'); // 위반은 보고된다 —
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
          id: 'shared-values',
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
 * 자격을 **실제로 가진** 체크아웃으로 측정 명령을 돌리는 하네스.
 *
 * ⭐⭐ **아래 `gitRecorder` 와 같은 꼴이다** — 실물(여기서는 결제 벤더)을 **바깥에서**
 * 가로채고 **제품에는 스위치를 두지 않는다.** ⛔ 「검증을 건너뛰는」 환경변수를 제품에 두는
 * 길은 쓰지 않는다: 그런 스위치는 고객의 CI 에도 서고, 그 순간 자격이 장식이 된다.
 *
 * ⭐ 가로채는 자리가 **로더**(`--import`)인 것이 요점이다 — 하위 프로세스의 전역 `fetch` 를
 * 덮으므로 호스트가 실제로 묻는 길이 **전부** 돈다(핸들 파일을 읽고 · 키를 환경에서 읽고 ·
 * 벤더를 부르고 · 답을 파싱한다). 끊어 내는 것은 **네트워크 한 홉**뿐이다.
 *
 * ⚠️ 핸들을 `git add` 하지 않는다 — 핸들은 **과금 상태**이지 판정의 표본이 아니다. 추적되면
 * 스냅샷이 달라지고, 이 하네스가 재는 것이 자격 말고 하나 더 생긴다.
 *
 * @param roots 핸들을 둘 체크아웃 **전부** — 호스트는 루트마다 자격을 푼다. 하나만 두면
 *   나머지는 「자격 없음」이고, 그 섞임이 이 하네스를 거짓말로 만든다.
 */
function entitledEnv(roots: readonly string[]): NodeJS.ProcessEnv {
  for (const root of roots) {
    writeFileSync(
      join(root, api.ENTITLEMENT.file),
      `${JSON.stringify({ [api.ENTITLEMENT.handleKey]: 'act_under_test' })}\n`,
    );
  }
  return vendorStubEnv();
}

/** 활성화가 내주는 핸들 — 하네스가 **기대하는 값**이라 단정이 이 상수를 읽는다. */
const STUB_ACTIVATION_ID = 'act_from_vendor_stub';

/**
 * 벤더만 가로채고 **핸들은 두지 않는다** — 위 하네스에서 갈라져 나온 자리다.
 *
 * ⭐ 가름의 사유: 활성화는 **핸들이 없는 저장소**에서 시작한다(그것을 만들러 가는 명령이다).
 * 핸들을 미리 두는 하네스로 그 명령을 재면 첫 분기(「이미 있다」)만 영원히 밟는다.
 * ⭐ 스텁이 **두 주소를 다** 받는다 — 검증과 활성화는 같은 벤더의 다른 문이고, 한쪽만
 * 세우면 활성화 뒤의 판정이 네트워크로 새어 나간다.
 */
function vendorStubEnv(): NodeJS.ProcessEnv {
  const dir = mkdtempSync(join(tmpdir(), 'graduand-vendor-stub-'));
  const stub = join(dir, 'vendor.mjs');
  const answer = (body: string): string =>
    `Promise.resolve(new Response(${JSON.stringify(body)}, { status: 200, headers: { 'content-type': 'application/json' } }))`;
  writeFileSync(
    stub,
    [
      `const validate = ${JSON.stringify(api.ENTITLEMENT.validateUrl)};`,
      `const activate = ${JSON.stringify(api.ENTITLEMENT.activateUrl)};`,
      'const real = globalThis.fetch;',
      'globalThis.fetch = (input, init) => {',
      '  const url = input instanceof Request ? input.url : String(input);',
      `  if (url.startsWith(activate)) return ${answer(JSON.stringify({ [api.ENTITLEMENT.activationKey]: STUB_ACTIVATION_ID }))};`,
      `  if (url.startsWith(validate)) return ${answer('{}')};`,
      '  return real(input, init);',
      '};',
      '',
    ].join('\n'),
  );
  return {
    ...process.env,
    [api.ENTITLEMENT.keyEnv]: 'key_under_test',
    NODE_OPTIONS: `--import ${pathToFileURL(stub).href}`,
  };
}

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

  // ⚠️ **자격이 있어야 「선언 없음」이 보인다** — 없으면 그 축의 사유가 「자격 없음」으로
  //    덮이고, 이 테스트가 묻는 것(빈 선언과 선언 부재가 **같은 수**인가)이 가려진다.
  const env = entitledEnv([root]);
  const judge = (): api.Judgment => {
    const r = runCli(['--json'], root, env);
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
    R3: { verifiers: ['refs', 'shared-values-cross'] }, // 부분 판정 — 미판정
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
  'shared-values': { design: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root' } },
  admissions: { FH11: { verifiers: ['shared-values', 'shared-values-cross'] } },
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
  'shared-values': { design: {
    adapter: 'css-custom-properties',
    files: [CONSUMER_FILE],
    scope: ':root',
    canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
    pinned,
  } },
  admissions: { FH11: { verifiers: ['shared-values', 'shared-values-cross'] } },
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

/**
 * 그 판정기의 **칸 하나** — ⭐ 이름으로 묻고 축은 묻지 않는다(개정 4 에서 칸의 id 가
 * `<판정기>:<축>` 이 됐다). 칸이 둘 이상이면 실패한다: 축이 여럿인 판은 id 로 직접 부른다.
 */
const checkOf = (surface: CrossSurface, id: string): api.CheckResult => {
  const found = surface.judgment.checks.filter((c) => api.isCheckOf(id, c.id));
  return found.length === 1 ? found[0]! : assert.fail(`${id} 칸이 ${found.length} 개다`);
};

const surfaceOf = (surfaces: CrossSurface[], repo: string): CrossSurface =>
  surfaces.find((s) => s.repo === repo) ?? assert.fail(`${repo} 표면이 없다`);

test('교차 축 AC1 — 정본과 하류를 함께 보면 박제와 정본의 차이가 위반으로 선다', () => {
  const canon = canonFixture();
  const consumer = consumerFixture(DRIFTED_PINS);
  const surfaces = judgeTogether([canon, consumer]);

  const downstream = surfaceOf(surfaces, CONSUMER_REPO);
  // 이 저장소만 보는 축은 초록이다 — 코드와 박제를 함께 바꿨으니까.
  assert.equal(checkOf(downstream, 'shared-values').status, 'pass');

  const cross = checkOf(downstream, 'shared-values-cross');
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
  // ⚠️ 빨강이 **전파되려면 자격이 있어야 한다** — 교차 축은 선언을 분모로 쓴다. 사지 않은
  //    저장소의 CI 는 이 축으로 빨개지지 않고, 그것이 파는 물건의 경계다.
  const r = runCli(['--root', canon, '--root', consumer], process.cwd(), entitledEnv([canon, consumer]));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /shared-values-cross:design: violation/);
});

test('교차 축 AC2 — 체크아웃 하나면 그 칸은 single-repo-surface 미판정이고, 위반 0 과 다르게 그려진다', () => {
  // AC1 과 **같은 선언**이다 — 갈라짐은 실재하고, 이 표면이 그것을 볼 수 없을 뿐이다.
  const consumer = consumerFixture(DRIFTED_PINS);
  const [only] = judgeTogether([consumer]);

  const cross = checkOf(only!, 'shared-values-cross');
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'single-repo-surface');
  assert.notEqual(cross.status, 'pass'); // 시야 밖은 「위반 0」이 아니다
  assert.equal(cross.counts.excluded, Object.keys(DRIFTED_PINS).length); // 박제 전부가 「밖」이다

  const r = runCli(['--root', consumer], process.cwd(), entitledEnv([consumer]));
  assert.equal(r.status, 0, r.stdout + r.stderr); // 미판정은 빨강의 근거가 아니다
  // 화면이 「통과」로 그리지 않는다: 사유가 적히고, 관할 칸은 미판정으로 센다.
  assert.match(r.stdout, /shared-values-cross:design: unjudged \(single-repo-surface\)/);
  assert.match(r.stdout, /jurisdiction \d+ — violation 0 · pass 0 · unjudged [1-9]/);
  assert.doesNotMatch(r.stdout, /shared-values-cross:design: pass/);
});

test('교차 축 AC3 — 박제에서 빼고 사유를 적지 않은 토큰은 정본이 보이는 표면에서 위반이다', () => {
  const canon = canonFixture();
  const consumer = consumerFixture(SILENT_PINS, CANON_TOKENS);
  const surfaces = judgeTogether([canon, consumer]);

  const downstream = surfaceOf(surfaces, CONSUMER_REPO);
  // 박제가 분모인 CI 축은 그 토큰을 **모른다** — 뺀 쪽이 싼 길이 되는 자리다.
  assert.equal(checkOf(downstream, 'shared-values').status, 'pass');

  const cross = checkOf(downstream, 'shared-values-cross');
  assert.equal(cross.status, 'violation');
  assert.equal(cross.counts.pinned, Object.keys(SILENT_PINS).length);
  assert.equal(cross.counts.unpinned, Object.keys(CANON_TOKENS).length - Object.keys(SILENT_PINS).length);
  assert.deepEqual(cross.evidence.map((e) => [e.token, e.why]), [['--line', 'unpinned']]);

  const r = runCli(['--root', canon, '--root', consumer], process.cwd(), entitledEnv([canon, consumer]));
  assert.equal(r.status, 1, r.stdout + r.stderr);
});

test('교차 축 AC4 — 같은 선언이 한 저장소 표면에서는 「밖 + 미판정」이다 (위반이 아니다)', () => {
  const consumer = consumerFixture(SILENT_PINS, CANON_TOKENS);
  const [only] = judgeTogether([consumer]);

  const cross = checkOf(only!, 'shared-values-cross');
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

  const r = runCli(['--root', canon, '--root', consumer], process.cwd(), entitledEnv([canon, consumer]));
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
    E2: { verifiers: ['shared-values'] },
    E3: { verifiers: ['ui-paths'] },
    E4: { verifiers: ['refs', 'shared-values-cross'] },
  },
};

const entitlementFixture = (extra: Record<string, string> = {}): string =>
  gitFixture({
    'README.md': '[guide](docs/guide.md)\n',
    'docs/guide.md': 'ok\n',
    'graduand.json': `${JSON.stringify(ENTITLED, null, 2)}\n`,
    ...extra,
  });

/**
 * 같은 스냅샷을 자격 인자만 바꿔 판정한다 — 「같은 입력에 같은 수」의 그 입력이 자격이다.
 *
 * ⚠️ **자격이 격자에도 실린다** — 측정 명령이 하는 것과 같다(`cli.ts`). 여기서 빠뜨리면
 * 하네스가 실물보다 **느슨해지고**, 편입·격자·면제가 공짜로 새는 것을 이 파일이 못 본다.
 */
function judgedWith(root: string, entitlement?: api.Entitlement): { judgment: api.Judgment; grid: api.AdmissionGrid } {
  const { snapshot } = loadWorkspaceSnapshot(root);
  const judgment = api.judgeSnapshot(snapshot, { entitlement });
  return { judgment, grid: api.admissionGrid(snapshot, judgment.checks, entitlement) };
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

/**
 * ⭐⭐ **이 하네스가 할 일이 끝났다.** 전에는 「발행 조직 id 가 들어온 뒤의 세상」을 흉내
 * 내야 벤더에게 묻는 경로를 받을 수 있었고, 그 자리의 주석이 축자로 「id 가 실제로 들어오는
 * 날 이 하네스는 사라지고 아래 테스트는 **그대로 돈다**」였다. 그대로 됐다.
 *
 * ⇒ 남은 일은 **그 사실을 지키는 것**이다. 상수가 다시 비면 아래 테스트들은 벤더를 부르지
 * 못한 채 조용히 다른 길(`unwired` · `vendor-unconfigured`)을 타고, 그래도 초록일 수 있다 —
 * 그 조용함을 두지 않으려고 여기서 **먼저 멈춘다**. ⛔ 상수를 흉내 내지 않는다: 흉내는
 * 실물과 갈라진다.
 */
async function asWired<T>(run: () => Promise<T>): Promise<T> {
  assert.notEqual(
    api.ENTITLEMENT.organizationId,
    null,
    '발행 조직 id 가 비었다 — 벤더에게 묻는 경로가 서지 않아 아래 단정이 다른 세상을 잰다',
  );
  return run();
}

/**
 * **id 가 없는 빌드** — 포크와 발행 전이 여기 산다. ⭐ 위 하네스의 **반대쪽**이고, 사라진
 * 쪽과 달리 이것은 남는다: `null` 분기는 지워지지 않았고(우리 미비를 고객 탓으로 적지 않는
 * 자리다) 지워지지 않은 분기는 물어야 한다.
 */
async function asUnwired<T>(run: () => Promise<T>): Promise<T> {
  const before = api.ENTITLEMENT.organizationId;
  api.ENTITLEMENT.organizationId = null;
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

test('자격 AC1 — 자격이 없으면 선언을 분모로 쓰는 축만 막히고, 무료 축과 분모는 그대로다', () => {
  const root = entitlementFixture();
  const none = judgedWith(root, { state: 'absent', detail: 'not-configured', expires: null });
  const open = judgedWith(root);

  // 칸의 **구성**은 그대로다 — 등록부의 이름마다 한 칸.
  assert.deepEqual(
    none.judgment.checks.map((c) => c.id),
    [...api.VERIFIER_IDS].sort(),
  );

  // ⭐⭐ **가르는 기준은 「선언이 필요한가」이고 그 분류의 정본은 등록부다.** 여기 목록을
  //   베껴 적으면 사본이 하나 늘고, 갈라진 날 새 판정기가 **아무 말 없이 무료**가 된다.
  assert.ok(
    api.PAID_VERIFIER_IDS.length > 0 && api.FREE_VERIFIER_IDS.length > 0,
    '한쪽이 비면 이 테스트는 아무것도 재지 않는다 — 가름이 사라졌다',
  );

  const checkOf = (checks: readonly api.CheckResult[], id: string): api.CheckResult => {
    const found = checks.find((c) => c.id === id);
    assert.ok(found, `칸 ${id} 가 없다`);
    return found!;
  };

  // 선언을 분모로 쓰는 축은 같은 사유로 미판정이고 **수가 하나도 나오지 않는다.**
  for (const id of api.PAID_VERIFIER_IDS) {
    const check = checkOf(none.judgment.checks, id);
    assert.equal(check.status, 'unjudged', id);
    assert.equal(check.reason, 'no-entitlement', id);
    assert.deepEqual(check.counts, {}, `${id}: 수가 나왔다 — 「계산하고 표시만 가린다」는 막는 척이다`);
  }

  // ⭕⭕ **무료 축은 자격을 보지 않은 것과 바이트가 같다.** 「참조 판정은 선언 없이도 수가
  //   나옵니다」가 화면이 파는 문장이고, 이 단정이 그 문장의 기계 쪽이다. ⛔ 「막히지
  //   않았다」로 약하게 묻지 않는다 — 수가 **달라지는** 것도 같은 거짓말이다.
  for (const id of api.FREE_VERIFIER_IDS) {
    assert.deepEqual(
      checkOf(none.judgment.checks, id),
      checkOf(open.judgment.checks, id),
      `${id}: 선언 없이 도는 축의 판정이 자격에 따라 달라졌다`,
    );
  }

  // ⭐⭐ **분모는 선언에서 온다** — 자격을 본 격자와 보지 않은 격자의 모양이 같다.
  assert.deepEqual(none.grid.surfaces, open.grid.surfaces);
  assert.deepEqual(none.grid.rules.map((r) => r.rule), open.grid.rules.map((r) => r.rule));
  assert.deepEqual(none.grid.rules.map((r) => r.verifiers), open.grid.rules.map((r) => r.verifiers));
  assert.equal(none.grid.reason, null, '분모를 감췄다 — 「부재를 공백으로」다');

  // ⭐⭐ **격자는 축의 가름을 받지 않는다 — 통째로 자격을 묻는다.** 편입·격자·면제는
  //   선언 **자신의** 기능이라, 무료 축만 고른 규칙 줄에 수가 나면 유료 기능이 새는 것이다.
  //   ⚠️ 그 샘이 실제로 열려 있다 — 아래 분모가 그것을 증명한다.
  const counts = api.gridCounts(none.grid);
  assert.equal(counts.cells, Object.keys(ENTITLED.admissions).length * ENTITLED.ui.length);
  assert.ok(counts.cells > 0, '분모가 0 이면 이 테스트는 아무것도 재지 않는다');
  assert.equal(counts.unjudged, counts.cells);
  assert.equal(counts.violation, 0);
  assert.equal(counts.pass, 0);
  for (const row of none.grid.rules) assert.equal(row.reason, 'no-entitlement');

  // ⛔ **음성 대조군** — 무료 축**만** 고른 규칙이 분모에 실제로 있어야 위 단정이 일한다.
  //   없으면 「격자가 통째로 막힌다」는 축의 가름만으로도 참이 되어 아무것도 재지 않는다.
  const freeOnly = open.grid.rules.filter(
    (r) => r.verifiers.length > 0 && r.verifiers.every((v) => (api.FREE_VERIFIER_IDS as readonly string[]).includes(v)),
  );
  assert.ok(freeOnly.length > 0, '무료 축만 고른 규칙이 픽스처에 없다 — 격자의 가드가 빈다');
  assert.ok(
    freeOnly.some((r) => r.status !== 'unjudged'),
    '자격이 있어도 그 줄이 미판정이다 — 대조군이 되지 못한다',
  );
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
  // ⚠️ 분모가 **선언을 분모로 쓰는 축**이다 — 무료 축은 네트워크와 무관하게 돈다(자격 AC1).
  const offlineChecks = judgedWith(root, offline).judgment.checks;
  for (const id of api.PAID_VERIFIER_IDS) {
    const check = offlineChecks.find((c) => c.id === id);
    assert.ok(check, `칸 ${id} 가 없다`);
    assert.equal(check!.reason, 'entitlement-unverifiable', id);
    assert.notEqual(check!.reason, 'no-entitlement', '돈 낸 고객이 오프라인 CI 에서 「자격 없음」을 받는다');
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

test('자격 — 사지 않은 저장소는 막히되 빨갛지 않고, 무엇을 하면 되는지 말한다', () => {
  // 아무도 아무것도 하지 않았다 — 그런데 이 빌드는 **물을 수 있다**(발행 조직 id 가 섰다).
  const r = runCli(['--root', '.'], entitlementFixture());
  assert.equal(r.status, 0, r.stderr); // 자격은 위반이 아니라 미판정이다
  assert.match(r.stdout, /entitlement: unjudged \(no-entitlement\)/);

  // 「사라」가 요구하는 행동이고, **그 행동의 이름 둘**이 같은 줄에 온다 — 이름을 여기 적지
  // 않고 상수에서 읽는다(적으면 사본이 하나 늘고, 상류가 이름을 바꾸는 날 갈라진다).
  assert.ok(r.stdout.includes(api.ENTITLEMENT.file), r.stdout);
  assert.ok(r.stdout.includes(api.ENTITLEMENT.keyEnv), r.stdout);

  // ⭕ **무료 축은 그대로 수를 낸다** — 막힌 것은 선언을 분모로 쓰는 축뿐이다.
  assert.doesNotMatch(r.stdout, /refs: unjudged \(no-entitlement\)/, '선언 없이 도는 축이 막혔다');
  for (const id of api.PAID_VERIFIER_IDS) {
    assert.match(r.stdout, new RegExp(`${id}[^\\n]*: unjudged \\(no-entitlement\\)`), `${id} 가 막히지 않았다`);
  }
});

test('자격 — 묻지 못하는 빌드는 막지 않고 **말한다**: 조용한 통과를 두지 않는다', async () => {
  // ⚠️ **id 가 없는 빌드는 여전히 설 수 있다**(포크 · 발행 전). 그 빌드가 고객을 「자격
  //    없음」으로 적으면 **우리 미비를 고객 탓으로** 적는 것이라, 그 자리는 따로 선다.
  //    ⭐ 자리가 측정 명령에서 모듈로 내려왔다 — 발행되는 빌드에는 그 화면이 **설 수 없다**
  //    (상수가 섰다). 없는 화면을 무는 단정은 아무것도 재지 않으므로, 무는 자리를 옮긴다.
  const rejects = asFetch(() => {
    throw new Error('물을 수 없는 빌드가 벤더를 불렀다');
  });

  // ⑴ 고객도 아무것도 두지 않았다 — 물을 것이 없었으니 **막지 않는다**.
  const nothing = await asUnwired(() =>
    api.resolveEntitlement({ readHandle: () => null, readKey: () => null, fetch: rejects }, ON_DATE),
  );
  assert.deepEqual(nothing, { state: 'unwired' });
  assert.equal(api.entitlementGate(nothing), null, '묻지 못하는 빌드가 막았다');
  const said = api.describeEntitlement(nothing).join('\n');
  assert.match(said, /not asked/);
  assert.match(said, /nothing is gated/, '조용히 통과시켰다 — 막지 않은 것을 말하지 않았다');

  // ⑵ 고객은 **자기 몫을 했다** — 막되 사유가 우리를 가리킨다. ⛔ 「사라」가 아니다.
  const theirs = await asUnwired(() => api.resolveEntitlement(customerIo(rejects), ON_DATE));
  assert.deepEqual(theirs, { state: 'absent', detail: 'vendor-unconfigured', expires: null });
  assert.deepEqual(api.entitlementGate(theirs), {
    reason: 'entitlement-unverifiable',
    detail: 'vendor-unconfigured',
  });
});

/**
 * ─── 활성화 입구 — **구독과 자격 사이의 그 한 걸음**이 측정 명령에 선다 ───
 *
 * 순수층과 벤더를 부르는 손은 `activate.test.ts` 가 받는다. 여기가 받는 것은 **입구**다:
 * 명령이 실제로 파일을 쓰는가 · git 을 건드리지 않는가 · 그 핸들을 **다음 판정이 쓰는가**.
 * ⛔ 네트워크를 타지 않는다 — 벤더는 하네스가 로더에서 가로챈다.
 */
test('활성화 입구 — 키가 없으면 2 로 끝나고 파일을 쓰지 않는다', () => {
  const root = entitlementFixture();
  const r = runCli(['activate'], root);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(existsSync(join(root, api.ENTITLEMENT.file)), false, '키도 없이 핸들을 썼다');
  // 요구하는 행동이 **이름과 함께** 온다 — 이름은 상수에서 읽는다(사본을 만들지 않는다).
  assert.ok(r.stderr.includes(api.ENTITLEMENT.keyEnv), r.stderr);
});

test('활성화 입구 — 키가 있으면 핸들을 쓰고, 그 핸들을 다음 판정이 쓴다', () => {
  const root = entitlementFixture();
  const env = vendorStubEnv();

  const r = runCli(['activate'], root, env);
  assert.equal(r.status, 0, r.stdout + r.stderr);

  // ⑴ 파일이 실제로 섰고, **우리 읽는 손**이 그것을 읽는다.
  const at = join(root, api.ENTITLEMENT.file);
  assert.ok(existsSync(at), '활성화했다면서 파일이 없다');
  assert.deepEqual(api.parseHandle(readFileSync(at, 'utf8')), { activationId: STUB_ACTIVATION_ID });

  // ⑵ ⛔ git 을 건드리지 않는다 — 커밋은 고객의 몫이고, 그래서 그 파일은 **추적되지 않는다**.
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout;
  assert.match(status, new RegExp(`^\\?\\? ${api.ENTITLEMENT.file}$`, 'm'), status);
  assert.ok(r.stdout.includes('커밋'), '커밋하라고 말하지 않았다 — 안 한 일을 말하지 않으면 고객이 멈춘다');

  // ⑶ ⭐⭐ **그 핸들이 실제로 일한다** — 같은 저장소의 판정이 더는 자격에 막히지 않는다.
  const judged = runCli(['--root', '.'], root, env);
  assert.equal(judged.status, 0, judged.stdout + judged.stderr);
  assert.doesNotMatch(judged.stdout, /no-entitlement/, '활성화했는데 여전히 「자격 없음」이다');
  for (const id of api.PAID_VERIFIER_IDS) {
    assert.doesNotMatch(judged.stdout, new RegExp(`${id}[^\\n]*: unjudged \\(no-entitlement\\)`), id);
  }

  // ⑷ ⛔ 키는 화면에 0 건이다 — 로그는 CI 에 남고 붙여넣어 옮겨진다.
  assert.ok(!r.stdout.includes('key_under_test') && !r.stderr.includes('key_under_test'), r.stdout + r.stderr);
});

test('활성화 입구 (negative) — 두 번째는 덮어쓰지 않는다: 자리를 또 쓰지 않는다', () => {
  const root = entitlementFixture();
  const env = vendorStubEnv();
  assert.equal(runCli(['activate'], root, env).status, 0);
  const before = readFileSync(join(root, api.ENTITLEMENT.file), 'utf8');

  const again = runCli(['activate'], root, env);
  assert.equal(again.status, 2, again.stdout + again.stderr);
  assert.equal(readFileSync(join(root, api.ENTITLEMENT.file), 'utf8'), before, '덮어썼다');
  // ⚠️ 벤더 쪽 자리는 **이 실행이 이미 썼다** — 그 id 를 삼키면 고객이 자리 하나를 잃는다.
  assert.ok(again.stderr.includes(STUB_ACTIVATION_ID), again.stderr);
});

test('활성화 입구 (negative) — 보고 플래그도 여러 루트도 받지 않는다', () => {
  const root = entitlementFixture();
  // 쓰는 명령은 보고 플래그와 섞이지 않는다 — 조용히 무시하면 요청한 것과 한 것이 어긋난다.
  assert.equal(runCli(['activate', '--json'], root).status, 2);
  // 자리를 **하나** 쓰는 행위라, 루트를 여럿 받아 그중 하나에만 쓰지 않는다.
  assert.equal(runCli(['activate', '--root', '.', '--root', root], root).status, 2);
  assert.equal(existsSync(join(root, api.ENTITLEMENT.file)), false, '사용법 오류인데 파일을 썼다');
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
  // ⚠️ 분모가 **선언을 분모로 쓰는 축**이다 — 넘긴 만기도 무료 축을 끄지 않는다(자격 AC1).
  for (const id of api.PAID_VERIFIER_IDS) {
    const check = judgment.checks.find((c) => c.id === id);
    assert.ok(check, `칸 ${id} 가 없다`);
    assert.equal(check!.status, 'unjudged', id);
    assert.equal(check!.reason, 'no-entitlement', id);
    assert.deepEqual(check!.counts, {}, `${id}: 수가 나왔다 — 막는 척이다`);
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

/**
 * ─── 헌법 조립(「규범 저작」 쪽) · `canon` · `link` ───
 *
 * 받는 것 넷 — 박제가 **정본에서 읽히는가**(손으로 적은 값이 0 인가) · 「이 저장소가
 * 정본이다」가 박제 없는 선언으로 서는가 · 조립이 **지어내지 않는가**(시야 밖 · 읽을 손
 * 없음 · 해석되지 않는 값) · 쓰는 규율이 `init` 과 **같은가**(덮어쓰지 않는다 · 커밋하지
 * 않는다 · 쓰지 못한 것을 썼다고 말하지 않는다).
 *
 * ⛔ 기대 수를 상수로 적지 않는다 — 전부 `CANON_TOKENS` 와 등록부에서 유도한다.
 */

const commitAll = (root: string): void => {
  spawnSync('git', ['-C', root, 'add', '-A'], { encoding: 'utf8' });
  spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'decl'], {
    encoding: 'utf8',
  });
};

/** 선언이 **없는** 하류 체크아웃 — 조립이 그 자리에 선언을 세운다. */
const bareConsumerFixture = (): string =>
  gitFixture(
    { 'README.md': 'ok\n', [CONSUMER_FILE]: cssOf(CANON_TOKENS) },
    `https://github.com/${CONSUMER_REPO}.git`,
  );

const AXIS = 'design';
/** 정본의 주소만 — 축 이름과 따로 둔다(한 명령에 `--axis` 가 두 번 오면 사용법 오류다). */
const POINTER_ARGS = ['--canon', CANON_REPO, '--canon-file', CANON_FILE, '--canon-scope', ':root'];
const LINK_ARGS = ['--axis', AXIS, ...POINTER_ARGS];
const CANON_ARGS = ['--axis', AXIS, '--adapter', 'css-custom-properties', '--file', CANON_FILE, '--scope', ':root'];

const declarationAt = (root: string): api.DeclarationResult =>
  api.validateDeclaration(readFileSync(join(root, api.DECLARATION_FILE), 'utf8'));

test('헌법 조립 AC1 — `link` 이 박제를 **정본에서 읽어** 쓰고, 그 선언의 교차 축은 위반 0 이다', () => {
  const canon = canonFixture();
  const consumer = bareConsumerFixture();

  const r = runCli(['link', ...LINK_ARGS, '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);

  const read = declarationAt(consumer);
  assert.ok(read.state === 'valid', JSON.stringify(read));
  // ⭐ 손으로 옮긴 값이 0 이다 — 분모가 정본이고, 박제는 그것을 **전부** 받는다.
  assert.deepEqual(read.sharedValues?.[AXIS]?.pinned, CANON_TOKENS);
  assert.deepEqual(read.sharedValues?.[AXIS]?.canon, { repo: CANON_REPO, file: CANON_FILE, scope: ':root' });
  // 편입 기록은 비어 있다 — 견본 헌법은 여전히 범위 밖이다(트리거는 1호 고객 접촉이다).
  assert.deepEqual(read.sharedValues?.[AXIS]?.diverged, null);
  assert.deepEqual(read.admissions, {});

  // 쓴 것을 판정이 받는다 — ⚠️ 표본은 git 이 추적하는 파일이라 커밋이 그 조건이다.
  commitAll(consumer);
  const cross = checkOf(surfaceOf(judgeTogether([canon, consumer]), CONSUMER_REPO), 'shared-values-cross');
  assert.equal(cross.status, 'pass');
  assert.equal(cross.counts.mismatched + cross.counts.unpinned, 0);
  assert.equal(cross.counts.matched, Object.keys(CANON_TOKENS).length);
  assert.equal(cross.counts.canon, Object.keys(CANON_TOKENS).length);
});

test('헌법 조립 AC2 — `canon` 은 「이 저장소가 정본이다」를 쓴다: 박제 0 · 포인터 0', () => {
  const repo = gitFixture(
    { 'README.md': 'ok\n', [CANON_FILE]: cssOf(CANON_TOKENS) },
    `https://github.com/${CANON_REPO}.git`,
  );

  const r = runCli(['canon', ...CANON_ARGS, '--root', repo], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);

  const read = declarationAt(repo);
  assert.ok(read.state === 'valid', JSON.stringify(read));
  assert.deepEqual(read.sharedValues?.[AXIS]?.adapter, 'css-custom-properties');
  assert.deepEqual(read.sharedValues?.[AXIS]?.files, [CANON_FILE]);
  // ⭐ 자기가 정본이면 박제하지 않는다 — 포인터도 없다(주소 없는 박제의 반대편이 아니라,
  //    박제 자체가 없는 자리다).
  assert.equal(read.sharedValues?.[AXIS]?.pinned, null);
  assert.equal(read.sharedValues?.[AXIS]?.canon, null);

  commitAll(repo);
  const [only] = judgeTogether([repo]);
  const cross = checkOf(only!, 'shared-values-cross');
  assert.equal(cross.status, 'unjudged');
  assert.equal(cross.reason, 'no-declaration'); // 미선언은 미판정이다 — 「위반 0」이 아니다
  // CI 축(「코드 == 박제」)은 정본 저장소에서도 선다 — 기준이 자기 파일의 등록부다.
  assert.equal(checkOf(only!, 'shared-values').status, 'pass');
});

test('헌법 조립 AC3 (negative) — **같은 축**을 두 번 조립하지 않는다: 박제와 갈라짐 선언을 지우는 일이다', () => {
  const canon = canonFixture();
  const consumer = bareConsumerFixture();
  const args = ['link', ...LINK_ARGS, '--root', consumer, '--root', canon];

  assert.equal(runCli(args, process.cwd()).status, 0);
  const before = readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8');

  const again = runCli(args, process.cwd());
  assert.equal(again.status, 2); // 한 일이 없으면 초록으로 끝나지 않는다
  assert.equal(readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8'), before); // 바이트가 안 움직였다
  // ⭐ **축을 이름으로** 말한다 — 「선언이 이미 있다」로 끝내면 고객은 다른 축도 못 더하는
  //    줄 안다(개정 4 에서 더하기는 정당한 행위다). 거부의 대상은 **그 축**이다.
  assert.match(again.stderr, /"shared-values\.design" is already declared/);
  assert.match(again.stderr, /name another axis/);
  // ⛔ 조립하지 않았으므로 바이트도 내지 않는다 — 지어낸 분모가 든 선언을 주지 않는다.
  assert.equal(again.stdout.trim(), '');
});

test('헌법 조립 AC11 — **헌법 여럿**: 선언이 있는 저장소가 축을 더하면 전문이 나오고, 축마다 칸이 선다', () => {
  const canon = canonFixture();
  const consumer = bareConsumerFixture();
  assert.equal(runCli(['link', ...LINK_ARGS, '--root', consumer, '--root', canon], process.cwd()).status, 0);

  // 둘째 헌법 — ⭐ **다른 상류**다. 디자인 정본과 API 정본이 다른 저장소에 사는 것이
  //   저장소가 여럿인 조직의 평상시이고, 축이 하나였을 때는 선언할 자리가 없었다.
  const apiCanon = gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify({ [api.SHARED_VALUES_KEY]: { contracts: { adapter: 'css-custom-properties', files: ['api/limits.css'], scope: ':root' } } }, null, 2)}\n`,
      'api/limits.css': ':root {\n  --page-size: 50;\n}\n',
    },
    'https://github.com/acme/contracts.git',
  );

  const added = runCli(
    [
      'link',
      '--axis', 'api',
      '--canon', 'acme/contracts',
      '--canon-file', 'api/limits.css',
      '--canon-scope', ':root',
      '--root', consumer,
      '--root', apiCanon,
    ],
    process.cwd(),
  );
  // 선언이 이미 있으므로 **쓰지 않는다** — 그 규율은 그대로다. ⭐ 그러나 stdout 은
  // 「당신의 선언 + 축 하나」의 전문이다: 옮길 칸을 고객이 고르지 않는다.
  assert.equal(added.status, 2, added.stdout + added.stderr);
  assert.match(added.stderr, /축 하나를 더한 전문/);

  const merged = api.validateDeclaration(`${added.stdout.trim()}\n`);
  assert.ok(merged.state === 'valid', JSON.stringify(merged));
  assert.deepEqual(Object.keys(merged.sharedValues ?? {}).sort(), ['api', AXIS]);
  // ⭐ 남의 축은 그대로다 — 더하기가 기존 박제를 건드리지 않는다.
  assert.deepEqual(merged.sharedValues![AXIS]!.pinned, CANON_TOKENS);
  assert.deepEqual(merged.sharedValues!.api!.canon, {
    repo: 'acme/contracts',
    file: 'api/limits.css',
    scope: ':root',
  });
  assert.deepEqual(merged.sharedValues!.api!.pinned, { '--page-size': '50' });

  // 그 선언으로 판정하면 **축마다 칸 둘**이 서고, 두 정본이 각자의 체크아웃에서 읽힌다.
  writeFileSync(join(consumer, api.DECLARATION_FILE), `${added.stdout.trim()}\n`);
  commitAll(consumer);
  const surfaces = judgeTogether([canon, apiCanon, consumer]);
  const ids = surfaceOf(surfaces, CONSUMER_REPO).judgment.checks.map((c) => c.id);
  assert.ok(ids.includes(`shared-values:${AXIS}`), ids.join(' · '));
  assert.ok(ids.includes('shared-values:api'), ids.join(' · '));
  assert.ok(ids.includes(`shared-values-cross:${AXIS}`), ids.join(' · '));
  assert.ok(ids.includes('shared-values-cross:api'), ids.join(' · '));
  // ⛔ 맨 이름은 서지 않는다 — 축이 선언됐으면 칸은 그 축의 것이다.
  assert.ok(!ids.includes('shared-values'), ids.join(' · '));
});

test('헌법 조립 AC4 (negative) — 정본이 시야에 없으면 **아무것도 쓰지 않는다**', () => {
  const consumer = bareConsumerFixture();

  // 정본의 체크아웃을 넘기지 않았다 — 포인터만으로는 읽을 자리가 없다.
  const r = runCli(['link', ...LINK_ARGS, '--root', consumer], process.cwd());
  assert.equal(r.status, 2);
  assert.ok(!existsSync(join(consumer, api.DECLARATION_FILE)), '빈 박제가 쓰였다');
  assert.match(r.stderr, /not in this job's sight/);
  // ⛔ 포인터만 선 선언(= 연결의 절반)으로 접지 않는다 — 그러면 교차 축이 영원히 미판정이다.
  assert.doesNotMatch(r.stderr, /✅/);
});

test('헌법 조립 AC5 (negative) — 정본이 자기 읽는 법을 선언하지 않으면 멈춘다', () => {
  // 정본 저장소에 어댑터 트리오가 없다 — 소비 저장소의 어댑터로 남의 파일을 읽는 것은 추측이다.
  const canon = gitFixture(
    { 'README.md': 'ok\n', 'graduand.json': '{\n  "admissions": {}\n}\n', [CANON_FILE]: cssOf(CANON_TOKENS) },
    `https://github.com/${CANON_REPO}.git`,
  );
  const consumer = bareConsumerFixture();

  const r = runCli(['link', ...LINK_ARGS, '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 2);
  assert.ok(!existsSync(join(consumer, api.DECLARATION_FILE)));
  assert.match(r.stderr, /names an adapter/);
});

test('헌법 조립 AC6 (negative) — 모르는 어댑터 이름은 **아는 목록과 함께** 거부된다', () => {
  const repo = gitFixture({ 'README.md': 'ok\n', [CANON_FILE]: cssOf(CANON_TOKENS) });

  const r = runCli(['canon', '--axis', AXIS, '--adapter', 'sass-variables', '--file', CANON_FILE, '--scope', ':root', '--root', repo], process.cwd());
  assert.equal(r.status, 2);
  assert.ok(!existsSync(join(repo, api.DECLARATION_FILE)));
  // 아는 목록은 **등록부에서** 온다 — 산문에 박은 사본은 어댑터가 늘면 거짓이 된다.
  for (const adapter of api.VALUE_ADAPTERS) assert.ok(r.stderr.includes(adapter.id), r.stderr);
});

test('헌법 조립 AC7 (negative) — 포인터와 실재가 어긋나면 판정 실패다: 빈 박제를 쓰지 않는다', () => {
  const canon = canonFixture();
  const consumer = bareConsumerFixture();

  // 선언된 스코프에서 읽히는 토큰이 0 건이다 — 포인터와 실물이 서로 다른 말을 한다.
  const r = runCli(
    ['link', '--axis', AXIS, '--canon', CANON_REPO, '--canon-file', CANON_FILE, '--canon-scope', '.dark', '--root', consumer, '--root', canon],
    process.cwd(),
  );
  assert.equal(r.status, 2);
  assert.ok(!existsSync(join(consumer, api.DECLARATION_FILE)));
  assert.match(r.stderr, /judgment failed/);
});

test('헌법 조립 AC8 (negative) — 해석되지 않는 정본 값은 박제되지 않고 **말해진다**', () => {
  // 같은 스코프에 두 번 정의된 토큰과 `var()` 간접 참조 — 판정이 해석하지 않는 둘이다.
  const murky = `${cssOf(CANON_TOKENS)}:root {\n  --paper: #000000;\n  --alias: var(--ink);\n}\n`;
  const canon = gitFixture(
    { 'README.md': 'ok\n', 'graduand.json': `${JSON.stringify(CANON_DECLARATION, null, 2)}\n`, [CANON_FILE]: murky },
    `https://github.com/${CANON_REPO}.git`,
  );
  const consumer = bareConsumerFixture();

  const r = runCli(['link', ...LINK_ARGS, '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);

  const read = declarationAt(consumer);
  assert.ok(read.state === 'valid', JSON.stringify(read));
  const pinned = Object.keys(read.sharedValues?.[AXIS]?.pinned ?? {});
  // 해석되지 않은 값이 기준이 되지 않는다 — 기준이 거짓이면 그 위의 모든 수가 거짓이다.
  assert.ok(!pinned.includes('--paper'), '중복 정의된 토큰이 박제됐다');
  assert.ok(!pinned.includes('--alias'), 'var() 간접 참조가 박제됐다');
  // ⛔ 조용히 건너뛰지 않는다 — 말하지 않으면 그 공백이 선언의 침묵이 된다.
  for (const token of ['--paper', '--alias']) assert.ok(r.stdout.includes(token), r.stdout);

  // ⭐⭐ 그리고 그 모호함을 **아무도 삼키지 않는다** — 조립은 박제하지 않고 말하는 데서
  //    그치고, 그것을 빨갛게 만드는 것은 **정본 저장소 자신의 CI 축**이다(「모호한 정본은
  //    기준이 될 수 없다」). 조립이 대신 멈추면 하류가 남의 저장소 상태 때문에 선언을
  //    세울 수 없게 되고, 조립이 조용히 넘기면 그 모호함은 어느 표면에도 안 뜬다.
  assert.throws(() => judgeTogether([canon]), api.DeclarationInvalidError);
});

test('헌법 조립 (negative) — 조립 플래그는 조립하는 명령만 받는다: 조용히 무시되지 않는다', () => {
  const repo = gitFixture({ 'README.md': 'ok\n' });

  // 판정에 붙으면 그 값은 아무것도 하지 않는 채 exit 0 이 된다 — 요청한 것과 한 것이
  // 어긋난 초록이고, 그것이 이 제품이 파는 결함의 모양 그대로다.
  for (const args of [['--canon', CANON_REPO], ['--adapter', 'css-custom-properties']]) {
    const r = runCli([...args, '--root', repo], process.cwd());
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /takes no composition flags/);
  }
  const onInit = runCli(['init', '--canon', CANON_REPO, '--root', repo], process.cwd());
  assert.equal(onInit.status, 2);
  assert.ok(!existsSync(join(repo, api.DECLARATION_FILE)), 'init 이 플래그를 무시하고 썼다');

  // 트리오는 셋이 함께 오거나 하나도 오지 않는다 — 반쪽 선언이 설 자리를 만들지 않는다.
  const half = runCli(['canon', '--axis', AXIS, '--adapter', 'css-custom-properties', '--root', repo], process.cwd());
  assert.equal(half.status, 2);
  assert.match(half.stderr, /together or not at all/);

  // 「이 저장소가 정본이다」와 「정본은 저기다」는 배타다 — 추측해서 한쪽을 고르지 않는다.
  const both = runCli(['canon', ...CANON_ARGS, ...POINTER_ARGS, '--root', repo], process.cwd());
  assert.equal(both.status, 2);
  assert.match(both.stderr, /takes no pointer/);
});

/**
 * ─── 하류 배달(정본 → 하류) ───
 *
 * 받는 것 넷 — 분모가 **받는 쪽 선언**인가(박제한 것만 나르는가) · 건드리지 않는 자리
 * 셋(선언된 갈라짐 · 박제 안 한 정본 토큰 · 정본이 모르는 박제)을 지키는가 · 선언의
 * 다른 칸이 **바이트로** 보존되는가 · 쓰지 못한 것을 썼다고 말하지 않는가.
 *
 * ⛔ 기대 수를 상수로 적지 않는다 — 전부 `CANON_TOKENS` 와 선언 객체에서 유도한다.
 */

/**
 * 배달받는 하류 — ⭐ 선언을 **4칸 들여쓰기**로 쓴다: 배달이 다시 직렬화하면 그 서식이
 * 우리 것으로 바뀌고, 그 diff 안에서 「무엇이 배달됐는가」가 보이지 않는다.
 */
const deliveryConsumer = (pinned: Record<string, string>, diverged?: Record<string, string>): string => {
  const declaration = {
    ui: ['src/'],
    'shared-values': { design: {
      adapter: 'css-custom-properties',
      files: [CONSUMER_FILE],
      scope: ':root',
      canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
      pinned,
      ...(diverged === undefined ? {} : { diverged }),
    } },
    admissions: { FH11: { verifiers: ['shared-values', 'shared-values-cross'] } },
  };
  return gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify(declaration, null, 4)}\n`,
      // 코드는 박제와 같다 — CI 축이 초록인 채 배달만 질문에 답하는 그 상황이 선다.
      [CONSUMER_FILE]: cssOf(pinned),
    },
    `https://github.com/${CONSUMER_REPO}.git`,
  );
};

const linesOf = (text: string): string[] => text.split('\n');

test('배달 AC1 — 낡은 박제만 정본에 맞춰지고, 선언의 다른 칸은 **바이트로** 그대로다', () => {
  const canon = canonFixture();
  const consumer = deliveryConsumer(DRIFTED_PINS); // 값과 박제를 함께 바꾼 그 선언
  const before = readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8');

  const r = runCli(['deliver', '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);

  const after = readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8');
  // ⭐ 다시 직렬화하지 않았다 — 움직인 줄이 **나른 값의 수**와 같다.
  const moved = linesOf(after).filter((line, at) => line !== linesOf(before)[at]);
  const drifted: Record<string, string> = DRIFTED_PINS;
  const stale = Object.keys(drifted).filter(
    (token) => CANON_TOKENS[token] !== undefined && drifted[token] !== CANON_TOKENS[token],
  );
  assert.equal(moved.length, stale.length);
  for (const token of stale) assert.ok(moved.join('\n').includes(token), moved.join('\n'));

  const read = api.validateDeclaration(after);
  assert.ok(read.state === 'valid', JSON.stringify(read));
  for (const [token, value] of Object.entries(CANON_TOKENS)) {
    assert.equal(read.sharedValues?.[AXIS]?.pinned?.[token], value);
  }

  commitAll(consumer);
  const downstream = surfaceOf(judgeTogether([canon, consumer]), CONSUMER_REPO);
  // 교차 축(박제 == 정본)이 초록이 됐다 — 배달이 고친 것은 **선언**이다.
  assert.equal(checkOf(downstream, 'shared-values-cross').status, 'pass');
  // ⭐⭐ 그리고 CI 축(코드 == 박제)이 **코드를 가리킨다** — 배달은 코드를 고치지 않는다.
  //    그 빨강이 고객이 할 일이고, 배달이 그것을 대신 삼키면 코드와 선언이 갈라진 채
  //    두 축이 다 초록이 된다(이 제품이 재는 그 상태다).
  assert.equal(checkOf(downstream, 'shared-values').status, 'violation');
});

test('배달 AC2 — 전부 같으면 바이트를 **하나도** 쓰지 않는다 (파일을 열지도 않는다)', () => {
  const canon = canonFixture();
  const consumer = deliveryConsumer(CANON_TOKENS);
  const at = join(consumer, api.DECLARATION_FILE);
  const before = { text: readFileSync(at, 'utf8'), mtime: statSync(at).mtimeMs };

  const r = runCli(['deliver', '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(at, 'utf8'), before.text);
  // 같은 바이트를 다시 쓰면 「배달이 돌았다」를 mtime 으로 거짓말하게 된다.
  assert.equal(statSync(at).mtimeMs, before.mtime);
  assert.match(r.stdout, /바이트를 하나도 쓰지 않았다/);
  assert.ok(r.stdout.includes(`이미 같던 값 ${Object.keys(CANON_TOKENS).length} 건`), r.stdout);
});

test('배달 AC3 (negative) — 선언된 갈라짐은 **건드리지 않는다**: 기준을 옮긴 선언을 말없이 취소하지 않는다', () => {
  const canon = canonFixture();
  const moved = '--line'; // 이 값의 정본을 하류가 자기에게 옮겼다
  const pinned = Object.fromEntries(
    Object.entries(CANON_TOKENS).filter(([token]) => token !== moved),
  ) as Record<string, string>;
  // 박제와 갈라짐은 토큰 단위로 **배타**다 — 박제에서 빼고 사유를 달아 선언한다.
  const consumer = deliveryConsumer(pinned, { [moved]: '이 값의 정본은 이 저장소다 — 브랜드 축이 따로 선다' });
  const before = readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8');
  assert.ok(api.validateDeclaration(before).state === 'valid', before); // 픽스처가 참인 선언이다

  const r = runCli(['deliver', '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8'), before); // 바이트가 안 움직였다
  assert.match(r.stdout, /건드리지 않은 갈라짐 1 건/);
  assert.ok(r.stdout.includes(moved), r.stdout);
  // ⛔ 더하지도 않는다 — 갈라짐은 「박제 안 함」과 **다른 칸**이고, 둘을 한 수로 세지 않는다.
  assert.doesNotMatch(r.stdout, /더하지 않은 정본 토큰/);

  commitAll(consumer);
  const cross = checkOf(surfaceOf(judgeTogether([canon, consumer]), CONSUMER_REPO), 'shared-values-cross');
  // 그 칸은 「밖 — 미판정(선언된 갈라짐)」이고 위반이 아니다 — 배달이 그 자리를 지켰다.
  assert.equal(cross.status, 'pass');
  assert.equal(cross.counts.diverged, 1);
});

test('배달 AC4 (negative) — 박제하지 않은 정본 토큰은 **더하지 않는다**: 판정의 위반을 메우지 않는다', () => {
  const canon = canonFixture();
  const consumer = deliveryConsumer(SILENT_PINS); // 정본의 토큰 하나가 박제에 없다
  const before = readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8');

  const r = runCli(['deliver', '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8'), before); // 분모를 넓히지 않았다
  const silent: Record<string, string> = SILENT_PINS;
  const missing = Object.keys(CANON_TOKENS).filter((token) => silent[token] === undefined);
  assert.ok(r.stdout.includes(`더하지 않은 정본 토큰 ${missing.length} 건`), r.stdout);
  // ⛔ 「이미 정본과 같다」로 적지 않는다 — 그 선언은 교차 축에서 위반을 안고 있다.
  assert.doesNotMatch(r.stdout, /이미 정본과 같다/);

  commitAll(consumer);
  const cross = checkOf(surfaceOf(judgeTogether([canon, consumer]), CONSUMER_REPO), 'shared-values-cross');
  assert.equal(cross.status, 'violation'); // 침묵의 갈라짐은 그대로 위반이다
  assert.equal(cross.counts.unpinned, missing.length);
});

test('배달 AC5 (negative) — 정본이 시야에 없으면 아무 바이트도 쓰지 않는다', () => {
  const consumer = deliveryConsumer(DRIFTED_PINS);
  const before = readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8');

  const r = runCli(['deliver', '--root', consumer], process.cwd());
  assert.equal(r.status, 2);
  assert.equal(readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8'), before);
  assert.match(r.stderr, /not in this job's sight/);
  assert.match(r.stderr, /배달하지 않았다/);
});

test('배달 AC6 (negative) — 하류 선언이 깨졌으면 요란하게 멈추고 쓰지 않는다', () => {
  const canon = canonFixture();
  const broken = gitFixture(
    { 'README.md': 'ok\n', 'graduand.json': '{"shared-values": {"design": {"pinned": {"--paper": "#FFFFFF"}}}}\n' },
    `https://github.com/${CONSUMER_REPO}.git`,
  );
  const before = readFileSync(join(broken, api.DECLARATION_FILE), 'utf8');

  const r = runCli(['deliver', '--root', broken, '--root', canon], process.cwd());
  assert.equal(r.status, 2);
  assert.equal(readFileSync(join(broken, api.DECLARATION_FILE), 'utf8'), before);
  // 주소 없는 박제는 선언 검증이 이미 막는다 — 배달이 그 앞에서 멈춘다.
  assert.match(r.stderr, /judgment failed/);
});

test('배달 AC7 (negative) — 쓰지 못한 것을 썼다고 말하지 않는다', () => {
  const canon = canonFixture();
  const consumer = deliveryConsumer(DRIFTED_PINS);
  const load = loadWorkspaces([consumer, canon]);
  const outcome = planDelivery(load[0]!.snapshot, [load[1]!.snapshot]);
  assert.ok(outcome.kind === 'planned', JSON.stringify(outcome));
  assert.ok(outcome.text !== null);

  const write = deliverModule.deliver(consumer, {
    pathIn: (root) => join(root, api.DECLARATION_FILE),
    overwrite: () => {
      throw new Error('EACCES: permission denied');
    },
  }, outcome);
  assert.equal(write.kind, 'write-failed');
  assert.equal(deliverModule.deliverExitCode(write), 2);
  const said = deliverModule.formatDelivery(outcome, write);
  assert.equal(said.stdout.length, 0); // 쓰지 못했으면 stdout 에 「✅」가 서지 않는다
  assert.ok(said.stderr.join('\n').includes('EACCES'), said.stderr.join('\n'));
});

test('배달 AC8 — 축이 둘이면 **축마다** 나르고, 같은 토큰을 두 축이 박제해도 서로의 칸을 고치지 않는다', () => {
  const canon = canonFixture();
  // 둘째 상류 — ⭐ 같은 토큰 이름(`--ink`)을 **다른 값**으로 든다. 한 조직이 두 헌법에서
  //   같은 이름을 쓰는 것은 평상시이고, 파일 전체에서 「정확히 한 자리」로 찾으면 그
  //   순간 배달이 **전부** 멈춘다(틀리지는 않지만 할 수 있는 일을 못 한다).
  const otherTokens = { '--ink': '#101014' };
  const other = gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify({ [api.SHARED_VALUES_KEY]: { print: { adapter: 'css-custom-properties', files: ['print/tokens.css'], scope: ':root' } } }, null, 2)}\n`,
      'print/tokens.css': cssOf(otherTokens),
    },
    'https://github.com/acme/print.git',
  );

  const declaration = {
    ui: ['src/'],
    [api.SHARED_VALUES_KEY]: {
      [AXIS]: {
        adapter: 'css-custom-properties',
        files: [CONSUMER_FILE],
        scope: ':root',
        canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
        pinned: DRIFTED_PINS,
      },
      // 같은 토큰 이름을 든 둘째 축 — 낡은 값이 **디자인 축의 낡은 값과 같다**(가장 나쁜 판).
      print: {
        canon: { repo: 'acme/print', file: 'print/tokens.css', scope: ':root' },
        pinned: { '--ink': (DRIFTED_PINS as Record<string, string>)['--ink']! },
      },
    },
    admissions: { FH11: { verifiers: ['shared-values', 'shared-values-cross'] } },
  };
  const consumer = gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify(declaration, null, 2)}\n`,
      [CONSUMER_FILE]: cssOf(DRIFTED_PINS),
    },
    `https://github.com/${CONSUMER_REPO}.git`,
  );

  const r = runCli(['deliver', '--root', consumer, '--root', canon, '--root', other], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const read = api.validateDeclaration(readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8'));
  assert.ok(read.state === 'valid', JSON.stringify(read));
  // ⭐⭐ 축마다 **자기 정본의** 값을 받았다 — 같은 토큰 이름이 두 칸에서 다른 값으로 선다.
  assert.equal(read.sharedValues![AXIS]!.pinned!['--ink'], CANON_TOKENS['--ink']);
  assert.equal(read.sharedValues!.print!.pinned!['--ink'], otherTokens['--ink']);
  // 보고가 축 이름을 단다 — 「나른 값 N 건」만 적히면 어느 헌법의 값인지 말하지 못한다.
  assert.match(r.stdout, new RegExp(`\\[${AXIS}\\] 나른 값`));
  assert.match(r.stdout, /\[print\] 나른 값/);
});

test('배달 AC9 — 박제가 없는 축은 **건너뛰고 이름으로 말한다**: 다른 축의 배달을 막지 않는다', () => {
  const canon = canonFixture();
  const declaration = {
    [api.SHARED_VALUES_KEY]: {
      [AXIS]: {
        adapter: 'css-custom-properties',
        files: [CONSUMER_FILE],
        scope: ':root',
        canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
        pinned: DRIFTED_PINS,
      },
      // ⭐ 이 저장소가 **그 축의 정본**이다 — 자기 값을 자기에게 박제하지 않는다. 앞 판은
      //   축이 하나라 「박제가 없다」가 곧 배달 전체의 거부였고, 그 접힘이 여기서 거짓이 된다.
      local: { adapter: 'css-custom-properties', files: ['src/local.css'], scope: ':root' },
    },
  };
  const consumer = gitFixture(
    {
      'README.md': 'ok\n',
      'graduand.json': `${JSON.stringify(declaration, null, 2)}\n`,
      [CONSUMER_FILE]: cssOf(DRIFTED_PINS),
      'src/local.css': ':root {\n  --own: #123456;\n}\n',
    },
    `https://github.com/${CONSUMER_REPO}.git`,
  );

  const r = runCli(['deliver', '--root', consumer, '--root', canon], process.cwd());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const read = api.validateDeclaration(readFileSync(join(consumer, api.DECLARATION_FILE), 'utf8'));
  assert.ok(read.state === 'valid', JSON.stringify(read));
  assert.equal(read.sharedValues![AXIS]!.pinned!['--ink'], CANON_TOKENS['--ink']);
  // ⛔ 건너뛴 축이 **조용히 빠지지 않는다** — 이름과 사유가 보고에 선다.
  assert.match(r.stdout, /계획이 서지 않은 축 1 개/);
  assert.match(r.stdout, /local/);
});

test('헌법 조립 AC9 (negative) — 선언한 스코프가 아무것도 읽지 못하면 **쓰기 전에** 멈춘다', () => {
  const repo = gitFixture(
    { 'README.md': 'ok\n', [CANON_FILE]: cssOf(CANON_TOKENS) },
    `https://github.com/${CANON_REPO}.git`,
  );

  // 실물은 `:root` 인데 `.dark` 를 선언했다 — 조립이 **읽어 보고** 거부한다.
  const r = runCli(
    ['canon', '--axis', AXIS, '--adapter', 'css-custom-properties', '--file', CANON_FILE, '--scope', '.dark', '--root', repo],
    process.cwd(),
  );
  assert.equal(r.status, 2);
  assert.ok(!existsSync(join(repo, api.DECLARATION_FILE)), '실물과 어긋난 선언을 썼다');
  // ⭐ 어댑터가 **본 것**을 함께 말한다 — 고치는 사람이 다음에 적을 값이 그 줄에 있다.
  assert.match(r.stderr, /reads zero values/);
  assert.match(r.stderr, /":root"/);
});

test('헌법 조립 AC10 (negative) — 추적되지 않는 파일을 선언하면 멈춘다', () => {
  const repo = gitFixture({ 'README.md': 'ok\n' }, `https://github.com/${CANON_REPO}.git`);
  writeFileSync(join(repo, 'untracked.css'), cssOf(CANON_TOKENS)); // 커밋하지 않는다

  const r = runCli(
    ['canon', '--axis', AXIS, '--adapter', 'css-custom-properties', '--file', 'untracked.css', '--scope', ':root', '--root', repo],
    process.cwd(),
  );
  assert.equal(r.status, 2);
  assert.ok(!existsSync(join(repo, api.DECLARATION_FILE)));
  // 판정의 표본은 git 이 추적하는 파일이다 — 추적되지 않는 파일을 가리키는 선언은 처음부터 거짓이다.
  assert.match(r.stderr, /does not track/);
});

test('탐색 — 고를 수 있는 경로는 **어댑터가** 말하고, 스코프는 읽어 본 사실이다', () => {
  const repo = gitFixture({
    'README.md': 'ok\n',
    'app/theme.css': `${cssOf(CANON_TOKENS)}.dark {\n  --paper: #101216;\n}\n`,
    'app/main.ts': 'export {};\n',
  });
  const { snapshot } = loadWorkspaceSnapshot(repo, ['app/theme.css']);

  // ⛔ 화면이 확장자를 알지 못한다 — 어댑터가 자기 꼴을 말한다.
  for (const adapter of api.VALUE_ADAPTERS) {
    const candidates = api.candidateFiles(snapshot, adapter.id);
    assert.ok(candidates.length > 0, adapter.id);
    for (const path of candidates) {
      assert.ok(adapter.extensions.some((extension) => path.endsWith(extension)), path);
    }
    assert.ok(!candidates.includes('app/main.ts'), '읽지 못하는 꼴이 후보에 들었다');
  }

  const probe = api.scopesIn('css-custom-properties', [
    { path: 'app/theme.css', text: snapshot.files.get('app/theme.css')! },
  ]);
  assert.ok(probe.kind === 'read', JSON.stringify(probe));
  // 읽힌 수 내림차순 — 「어느 쪽이 공유값의 자리인가」를 수가 말한다(우리가 고르지 않는다).
  assert.deepEqual(probe.scopes.map((entry) => entry.scope), [':root', '.dark']);
  assert.equal(probe.scopes[0]!.tokens, Object.keys(CANON_TOKENS).length);

  // ⛔ 못 읽은 것은 「토큰 0」이 아니다 — 모르는 어댑터도 같은 자리다.
  assert.equal(api.scopesIn('nope', [{ path: 'a.css', text: ':root{}' }]).kind, 'unreadable');
});

// ── 선언 0 에서 보이는 사실 (#113) ─────────────────────────────────────────

/** 하한을 넘는 블록 — 길이는 상수에서 유도한다(자구를 적지 않는다). */
const COPIED_BLOCK = `## 사본 금지\n${'한 사실의 집이 둘이면 둘 중 하나만 고쳐지는 날 그 둘은 다른 말을 한다. '.repeat(4)}`;

test('AC12 — 선언 0 의 저장소도 보고가 사실을 낸다: 사본과 선언할 수 있는 표면', () => {
  // ⭐ 선언 파일이 **없다** — 무료 진단에 주소를 넣는 방문자 대부분이 이 모양이다.
  const root = gitFixture({
    'README.md': `# 머리\n\n${COPIED_BLOCK}\n`,
    'docs/guide.md': `# 안내\n\n${COPIED_BLOCK}\n`,
    'app/theme.css': ':root {\n  --ink: #1C1F2E;\n}\n',
  });
  const run = spawnSync(process.execPath, [cliPath(), '--root', root], { encoding: 'utf8' });
  // ⛔ 이 사실로는 빨개지지 않는다 — 빨강의 근거는 위반과 넘긴 만기 둘뿐이다.
  assert.equal(run.status, 0, run.stdout + run.stderr);

  const out = run.stdout;
  // 「판정이 아니다」가 **적혀 있다** — 적지 않은 수는 언제든 판정으로 읽힌다.
  assert.match(out, /facts, not a judgment/);
  assert.match(out, /copied blocks 1\b/);
  assert.ok(out.includes('README.md') && out.includes('docs/guide.md'), out);
  // 선언할 수 있는 표면 — 어댑터 등록부 전수가 줄을 갖는다.
  for (const adapter of api.VALUE_ADAPTERS) assert.ok(out.includes(adapter.id), adapter.id);
  // ⭐⭐ **실측이 설계를 고쳤다** — 워크스페이스 로더도 선언이 지목하지 않은 스타일시트의
  //   본문을 싣지 않는다(브라우저의 한도 규율이 아니라 **두 로더의 공통 규율**이다:
  //   `needsContent` 는 `.md` 와 선언 파일뿐이다). ⇒ 선언 전에는 `loaded` 가 0 이고, 그
  //   0 은 「토큰 0」이 아니라 「읽지 않았다」다 — 줄이 그 차이를 적는다.
  assert.match(out, /css-custom-properties: files 1 — 0 of them with contents/);
  assert.match(out, /not read, which is not "0 tokens"/);

  // 봉투가 그 사실을 나른다 — 요약을 받은 쪽도 다시 읽지 않고 **받아 그린다**.
  const json = spawnSync(process.execPath, [cliPath(), '--root', root, '--json'], { encoding: 'utf8' });
  const measurement = api.parseMeasurement(json.stdout.trim());
  assert.equal(measurement.undeclared.blocks, 1);
  assert.deepEqual(measurement.undeclared.copies[0]!.files, ['README.md', 'docs/guide.md']);
  assert.deepEqual(measurement.undeclared.documents, { tracked: 2, read: 2 });
});

test('AC12 (negative) — 선언 0 의 사실은 어느 칸도 재지 않는다: 미판정 수가 그대로다', () => {
  const root = gitFixture({
    'README.md': `# 머리\n\n${COPIED_BLOCK}\n`,
    'docs/guide.md': `# 안내\n\n${COPIED_BLOCK}\n`,
  });
  const { snapshot } = loadWorkspaceSnapshot(root);
  const judgment = api.judgeSnapshot(snapshot);
  const facts = api.readUndeclared(snapshot);
  assert.ok(facts.blocks > 0, '하네스가 사본을 못 찾았다 — 아래 단정이 공짜로 참이 된다');

  // ⭐⭐ 사본 1 건이 **어느 체크도** 움직이지 않는다 — 두께를 거짓 양성으로 사지 않았다.
  const serialized = JSON.stringify(judgment);
  assert.ok(!serialized.includes('undeclared'), '판정에 선언 0 의 사실이 샜다');
  for (const id of ['shared-values', 'shared-values-cross']) {
    const check = judgment.checks.find((c) => c.id === id)!;
    assert.equal(check.status, 'unjudged');
    assert.equal(check.reason, 'no-declaration');
  }
});

test('AC12 — 앞 판의 봉투는 조용히 읽히지 않는다: 없는 칸을 0 으로 채우지 않는다', async () => {
  const { snapshot } = loadWorkspaceSnapshot(fixture.root);
  const judgment = api.judgeSnapshot(snapshot);
  const measurement = {
    judgment,
    source: 'workspace' as const,
    measuredAt: '2026-10-28T00:00:00.000Z',
    verifier: { name: api.VERIFIER.name, version: api.VERIFIER.version },
    dirty: 0,
    grid: api.admissionGrid(snapshot, judgment.checks),
    undeclared: api.readUndeclared(snapshot),
    peers: [],
  };
  // 왕복이 그 칸을 잃지 않는다 — 요약이 사실을 나르는 것이 개정 5 의 내용이다.
  const decoded = await api.decodeFragment(await api.encodeFragment(measurement));
  assert.deepEqual(decoded.undeclared, measurement.undeclared);

  // ⛔ 칸이 없는 바이트는 **거부**다 — 없는 칸을 「사본 0」으로 채우면 「읽지 않았다」가
  //    「사본 없음」이 되고, 그 둘을 가르는 것이 이 제품의 전부다.
  const stale = JSON.parse(api.serializeMeasurement(measurement)) as Record<string, unknown>;
  delete stale.undeclared;
  assert.throws(() => api.parseMeasurement(JSON.stringify(stale)), api.SchemaParseError);

  // 집이 하나인 「사본」은 사본이 아니다 — 그 모양도 거부된다.
  const lone = JSON.parse(api.serializeMeasurement(measurement)) as { undeclared: { copies: unknown[] } };
  lone.undeclared.copies = [{ head: 'x', lines: 2, files: ['only.md'] }];
  assert.throws(() => api.parseMeasurement(JSON.stringify(lone)), api.SchemaParseError);
});

test('AC13 — 갈라진 사본이 보고에 서고, 축자 사본과 **다른 줄**이다 (#119)', () => {
  // 손잡이는 하한을 넘어야 한다 — 짧은 줄은 관용구라 짝을 짓지 못한다.
  const anchorLine = (tag: string): string =>
    `${tag} 한 사실의 집이 둘이면 둘 중 하나만 고쳐지는 날 그 둘은 다른 말을 한다.`;
  const version = (only: string): string =>
    [anchorLine('가'), anchorLine('나'), anchorLine('다'), `이 줄은 ${only} 에만 있다`].join('\n');

  const root = gitFixture({
    'README.md': `# 머리\n\n${version('A')}\n`,
    'docs/guide.md': `# 안내\n\n${version('B')}\n`,
  });
  const run = spawnSync(process.execPath, [cliPath(), '--root', root], { encoding: 'utf8' });
  // ⛔ 이 사실로는 빨개지지 않는다 — 빨강의 근거는 위반과 넘긴 만기 둘뿐이다.
  assert.equal(run.status, 0, run.stdout + run.stderr);

  assert.match(run.stdout, /diverged copies 1\b/);
  assert.match(run.stdout, /shared 3 · differing 2/);
  // ⭐ 축자 사본은 **0** 이다 — 두 판은 같지 않고, 두 사실이 한 수로 접히지 않는다.
  assert.match(run.stdout, /copied blocks 0\b/);

  const json = spawnSync(process.execPath, [cliPath(), '--root', root, '--json'], { encoding: 'utf8' });
  const { undeclared } = api.parseMeasurement(json.stdout.trim());
  assert.equal(undeclared.divergedPairs, 1);
  assert.deepEqual(undeclared.diverged[0]!.files, ['README.md', 'docs/guide.md']);
  assert.equal(undeclared.divergedTruncated, false);
  assert.equal(undeclared.blocks, 0);
});

test('AC13 (negative) — 갈라진 줄이 0 인 쌍은 봉투가 받지 않는다: 그것은 축자 사본이다', () => {
  const { snapshot } = loadWorkspaceSnapshot(fixture.root);
  const judgment = api.judgeSnapshot(snapshot);
  const measurement = {
    judgment,
    source: 'workspace' as const,
    measuredAt: '2026-10-28T00:00:00.000Z',
    verifier: { name: api.VERIFIER.name, version: api.VERIFIER.version },
    dirty: 0,
    grid: api.admissionGrid(snapshot, judgment.checks),
    undeclared: api.readUndeclared(snapshot),
    peers: [],
  };
  const bad = JSON.parse(api.serializeMeasurement(measurement)) as {
    undeclared: { diverged: unknown[] };
  };
  // ⛔ 두 번 세지 않는다 — 그 모양은 이 칸의 뜻과 어긋난다.
  bad.undeclared.diverged = [{ head: 'x', files: ['a.md', 'b.md'], shared: 5, differing: 0 }];
  assert.throws(() => api.parseMeasurement(JSON.stringify(bad)), api.SchemaParseError);

  // 집이 하나뿐인 쌍도 받지 않는다 — 쌍이 단위다.
  bad.undeclared.diverged = [{ head: 'x', files: ['a.md', 'a.md'], shared: 5, differing: 1 }];
  assert.throws(() => api.parseMeasurement(JSON.stringify(bad)), api.SchemaParseError);
});
