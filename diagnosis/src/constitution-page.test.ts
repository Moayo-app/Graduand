/**
 * 둘째 문서의 AC — **헌법 관리**(조립)와 **관측 결과**(격자 + 교차 축).
 *
 * ⭐⭐ **여기서 받는 것 넷** — ⑴ 정본을 **선언이 가리킨 주소에서** 읽어 교차 축이 브라우저
 * 에서 서는가 ⑵ 가리키지 않으면 그 축이 **미판정 + 사유**로 남고 「위반 0」과 다르게
 * 그려지는가 ⑶ 읽지 못한 것이 조립의 거부가 아니라 **전용 화면 + 대안 경로**로 가는가
 * ⑷ 조립의 두 갈래가 **같은 조립기 하나**를 지나 검증을 통과하는 선언을 내는가.
 *
 * ⛔ 네트워크는 **주입된 가짜 하나**다 — 이 파일은 fetch 를 만들지 않고, 그 가짜가 받은
 * 주소 전부를 기록해 「간 곳이 벤더 API 뿐」을 수로 확인한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decodeFragment,
  encodeFragment,
  gridCounts,
  isCheckOf,
  validateDeclaration,
  type AdmissionGrid,
  type CheckResult,
} from '../../verifier/src/index.ts';
import { publishedPath, readSources, renderSite } from './generate.ts';
import { buildComposed } from './composed.ts';
import { buildObservation } from './observation.ts';
import {
  composeIntent,
  diagnoseUrl,
  readRepo,
  readScopes,
  type ComposeNetOutcome,
  type Outcome,
} from './outcome.ts';
import { unjudgeableScreen } from './screens.ts';
import { CATALOG, LOCALES } from './strings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const strings = CATALOG[LOCALES[0]];

/** 이 파일의 공유값 축 — ⛔ 이름은 고객의 것이라 **테스트도 자기 이름을 짓는다**. */
const AXIS = 'design';
const CANON_REPO = 'acme/design-system';
const DOWN_REPO = 'acme/storefront';
const CANON_FILE = 'tokens/tokens.css';

/** 정본이 든 공유값 — 교차 축의 **분모**다. ⛔ 기대 수를 따로 적지 않는다. */
const TOKENS: Record<string, string> = { '--paper': '#F6F5F2', '--ink': '#23263A' };
const cssOf = (tokens: Record<string, string>): string =>
  `:root {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;

const canonFiles = (): Record<string, string> => ({
  'README.md': 'ok\n',
  'graduand.json': `${JSON.stringify(
    {
      ui: ['tokens/'],
      'shared-values': { [AXIS]: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root' } },
      admissions: { FH11: { verifiers: ['shared-values', 'shared-values-cross'] } },
    },
    null,
    2,
  )}\n`,
  [CANON_FILE]: cssOf(TOKENS),
});

/** 하류 — 박제가 정본과 같고, `canon` 은 인자가 고른다(없으면 포인터 없는 선언이다). */
const downFiles = (withCanon: boolean, pinned: Record<string, string> = TOKENS): Record<string, string> => ({
  'README.md': 'ok\n',
  'src/theme.css': cssOf(pinned),
  'graduand.json': `${JSON.stringify(
    {
      ui: ['src/'],
      'shared-values': { [AXIS]: {
        adapter: 'css-custom-properties',
        files: ['src/theme.css'],
        scope: ':root',
        ...(withCanon
          ? { canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' }, pinned }
          : {}),
      } },
      admissions: { FH11: { verifiers: ['shared-values', 'shared-values-cross'] } },
    },
    null,
    2,
  )}\n`,
});

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

/**
 * 저장소 **여럿**을 서빙하는 가짜 벤더 API — 교차 축이 서려면 시야에 둘이 있어야 한다.
 * 목록에 없는 저장소는 404 다(무인증 API 가 비공개와 부재를 구분해 주지 않는 그 자리).
 */
function fakeGithub(repos: Record<string, Record<string, string>>): {
  fetch: typeof fetch;
  requested: string[];
} {
  const requested: string[] = [];
  const impl = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requested.push(url.toString());
    const json = (body: unknown): Promise<Response> =>
      Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    const miss = (): Promise<Response> => Promise.resolve(new Response('not found', { status: 404 }));

    for (const [repo, files] of Object.entries(repos)) {
      const paths = Object.keys(files).sort();
      const sha = (path: string): string => `blob-${repo}-${paths.indexOf(path)}`;
      if (url.pathname === `/repos/${repo}`) return json({ full_name: repo, default_branch: 'main' });
      if (url.pathname === `/repos/${repo}/commits/main`) return json({ sha: `commit-${repo}` });
      if (url.pathname === `/repos/${repo}/git/trees/commit-${repo}`) {
        return json({ truncated: false, tree: paths.map((path) => ({ path, type: 'blob', sha: sha(path) })) });
      }
      const blob = /\/git\/blobs\/(.+)$/.exec(url.pathname)?.[1];
      if (blob !== undefined && url.pathname.startsWith(`/repos/${repo}/`)) {
        const path = paths.find((entry) => sha(entry) === blob);
        if (path !== undefined) return json({ content: b64(files[path]!), encoding: 'base64' });
      }
    }
    return miss();
  };
  return { fetch: impl as typeof fetch, requested };
}

type Report = Extract<Outcome, { kind: 'report' }>;

/** 보고가 **섰는지**를 먼저 가른다 — 읽지 못한 것은 보고가 아니라 판정 불가다. */
const reportOf = (outcome: Outcome): Report => {
  assert.equal(outcome.kind, 'report', JSON.stringify(outcome));
  return outcome as Report;
};

/** 격자는 **봉투가 든다** — 저장소를 읽은 쪽이 세고, 요약으로 받은 쪽은 같은 수를 그린다. */
const gridOf = (report: Report): AdmissionGrid => report.measurement.grid;

/** 조립이 **섰는지**를 먼저 가른다 — 읽지 못한 것은 거부가 아니라 판정 불가다. */
const composeOf = (outcome: ComposeNetOutcome) => {
  assert.equal(outcome.kind, 'compose', JSON.stringify(outcome));
  return (outcome as Extract<ComposeNetOutcome, { kind: 'compose' }>).outcome;
};

/** 그 판정기의 칸 — ⭐ 이름으로 묻고 축은 묻지 않는다(칸의 id 는 `<판정기>:<축>` 이다). */
const checkOf = (report: Report, id: string): CheckResult => {
  const found = report.measurement.judgment.checks.filter((check) => isCheckOf(id, check.id));
  assert.equal(found.length, 1, `${id} 칸이 ${found.length} 개다`);
  return found[0]!;
};

test('관측 AC1 — 선언이 가리킨 정본까지 읽어 교차 축이 **브라우저에서** 수를 낸다', async () => {
  const api = fakeGithub({ [CANON_REPO]: canonFiles(), [DOWN_REPO]: downFiles(true) });
  const outcome = reportOf(await diagnoseUrl({ repo: DOWN_REPO }, { fetch: api.fetch }));

  const cross = checkOf(outcome, 'shared-values-cross');
  assert.equal(cross.status, 'pass'); // 정본이 보이는 표면이다 — 미판정으로 남지 않는다
  assert.equal(cross.counts.canon, Object.keys(TOKENS).length); // 분모는 정본이다
  assert.equal(cross.counts.matched, Object.keys(TOKENS).length);
  assert.deepEqual(outcome.measurement.peers, [CANON_REPO]);

  // ⭐ 격자의 수는 **세는 손 하나**가 낸다 — 뷰모델이 따로 세지 않는다.
  const vm = buildObservation(outcome, strings);
  const counts = gridCounts(gridOf(outcome));
  assert.ok(vm.jurisdictionLine !== null);
  assert.ok(vm.jurisdictionLine.includes(String(counts.cells)), vm.jurisdictionLine);
  assert.equal(vm.emptyLine, null);
  assert.ok(vm.canonLine.includes(CANON_REPO), vm.canonLine);
  assert.deepEqual(
    vm.rows.map((row) => row.rule),
    gridOf(outcome).rules.map((rule) => rule.rule),
  );

  // ⛔ 간 곳은 벤더 API 하나다 — 결과를 되쏜 자리가 0 이고, 읽은 저장소는 **둘**이다.
  for (const url of api.requested) assert.ok(url.startsWith('https://api.github.com/'), url);
  for (const repo of [CANON_REPO, DOWN_REPO]) {
    assert.ok(api.requested.some((url) => url.includes(`/repos/${repo}`)), repo);
  }
});

test('관측 AC2 (negative) — 선언이 정본을 가리키지 않으면 미판정이고, 그 저장소를 **읽지도 않는다**', async () => {
  const api = fakeGithub({ [CANON_REPO]: canonFiles(), [DOWN_REPO]: downFiles(false) });
  const outcome = reportOf(await diagnoseUrl({ repo: DOWN_REPO }, { fetch: api.fetch }));

  const cross = checkOf(outcome, 'shared-values-cross');
  assert.equal(cross.status, 'unjudged');
  assert.notEqual(cross.status, 'pass'); // 시야 밖은 「위반 0」이 아니다
  assert.deepEqual(outcome.measurement.peers, []);

  const vm = buildObservation(outcome, strings);
  assert.equal(vm.canonLine, strings.constitution.result.canonAbsent);
  // ⛔ 가리키지 않은 저장소를 **추측으로** 읽지 않는다 — 우리가 정본을 고르지 않는다.
  assert.equal(api.requested.filter((url) => url.includes(CANON_REPO)).length, 0);
});

test('관측 AC3 (negative) — 편입이 0 이면 칸이 0 이고, 수를 내지 않고 **사유를 적는다**', async () => {
  const files = downFiles(true);
  files['graduand.json'] = `${JSON.stringify(
    {
      'shared-values': { [AXIS]: {
        adapter: 'css-custom-properties',
        files: ['src/theme.css'],
        scope: ':root',
        canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
        pinned: TOKENS,
      } },
    },
    null,
    2,
  )}\n`;
  const api = fakeGithub({ [CANON_REPO]: canonFiles(), [DOWN_REPO]: files });
  const outcome = reportOf(await diagnoseUrl({ repo: DOWN_REPO }, { fetch: api.fetch }));

  const vm = buildObservation(outcome, strings);
  // 빈 분모는 **미판정**이다 — 「관할 0 — 위반 0」은 읽는 사람에게 「문제 없음」이다.
  assert.equal(vm.jurisdictionLine, null);
  assert.equal(vm.emptyLine, strings.constitution.result.emptyDenominator);
  assert.deepEqual(vm.rows, []);
  // ⭐ 그래도 체크의 수는 그대로 난다 — 격자와 체크는 **다른 질문의 답**이다.
  assert.equal(checkOf(outcome, 'shared-values-cross').status, 'pass');
});

test('관측 AC4 (negative) — 정본을 읽지 못하면 전용 화면이 서고 **대안 경로**를 함께 말한다', async () => {
  // 정본이 비공개이거나 없다 — 무인증 API 는 그 둘을 구분해 주지 않는다.
  const api = fakeGithub({ [DOWN_REPO]: downFiles(true) });
  const outcome = await diagnoseUrl({ repo: DOWN_REPO }, { fetch: api.fetch });

  assert.equal(outcome.kind, 'unreadable');
  const screen = unjudgeableScreen(outcome as Exclude<Outcome, { kind: 'report' }>, strings);
  assert.ok(screen.command !== null, '대안 경로가 없다');
  assert.match(screen.command, /^npx graduand/);
});

test('조립 AC1 — 생성 갈래는 **네트워크가 0** 이고, 낸 선언이 검증을 통과한다', async () => {
  const outcome = await composeIntent(
    {
      kind: 'canon',
      axis: AXIS,
      // ⛔ 더할 선언이 없다 — 이 표면이 보지 않았거나 그 저장소에 선언이 없다(둘 다 새 선언이다).
      base: null,
      trio: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: ':root' },
      // ⛔ 이 표면은 저장소를 **보지 않았다** — null 이 「참이다」가 아니라 「묻지 않았다」다.
      self: null,
    },
    {
      // ⛔ 불리면 그 자체가 실패다 — 이 갈래는 입력이 전부 손에 있다.
      fetch: (() => assert.fail('생성 갈래가 네트워크를 썼다')) as unknown as typeof fetch,
    },
  );
  const vm = buildComposed(composeOf(outcome), 'canon', strings, CANON_REPO);
  assert.ok(vm.json !== null);
  const read = validateDeclaration(vm.json);
  assert.equal(read.state, 'valid');
  // 자기가 정본이면 박제하지 않는다 — 그 사실을 화면이 말한다.
  assert.ok(vm.lines.includes(strings.constitution.result.canonSelf), vm.lines.join(' | '));
  assert.ok(vm.lines.includes(strings.constitution.result.admissionsEmpty));
  assert.deepEqual(vm.problems, []);
});

test('조립 AC2 — 연결 갈래가 박제를 **정본에서 읽는다**: 손으로 받는 칸이 없다', async () => {
  const api = fakeGithub({ [CANON_REPO]: canonFiles() });
  const outcome = await composeIntent(
    {
      kind: 'link',
      axis: AXIS,
      base: null,
      canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' },
      trio: null,
      self: null,
    },
    { fetch: api.fetch },
  );
  const composed = composeOf(outcome);
  const vm = buildComposed(composed, 'link', strings, CANON_REPO);
  assert.ok(vm.json !== null);

  const read = validateDeclaration(vm.json);
  assert.ok(read.state === 'valid', vm.json);
  // ⭐ 값이 **정본에서** 왔다 — 화면의 입력 칸에는 값이 없다.
  assert.deepEqual(read.sharedValues?.[AXIS]?.pinned, TOKENS);
  assert.deepEqual(read.sharedValues?.[AXIS]?.canon, { repo: CANON_REPO, file: CANON_FILE, scope: ':root' });
  assert.ok(vm.lines.includes(strings.constitution.result.pinned(Object.keys(TOKENS).length)));
});

test('조립 AC3 (negative) — 정본을 읽지 못하면 **조립의 거부가 아니라** 판정 불가다', async () => {
  const api = fakeGithub({});
  const outcome = await composeIntent(
    { kind: 'link', axis: AXIS, base: null, canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' }, trio: null, self: null },
    { fetch: api.fetch },
  );
  // 요구하는 행동이 다르다 — 「선언을 고쳐라」가 아니라 「이 입구로는 못 읽는다」이다.
  assert.equal(outcome.kind, 'unreadable');
  const screen = unjudgeableScreen(outcome as Exclude<Outcome, { kind: 'report' }>, strings);
  assert.ok(screen.command !== null);
});

test('조립 AC4 (negative) — 정본이 자기 읽는 법을 선언하지 않으면 **거부**하고 조각을 내지 않는다', async () => {
  const files = canonFiles();
  files['graduand.json'] = '{\n  "admissions": {}\n}\n'; // 어댑터 트리오가 없다
  const api = fakeGithub({ [CANON_REPO]: files });
  const outcome = await composeIntent(
    { kind: 'link', axis: AXIS, base: null, canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' }, trio: null, self: null },
    { fetch: api.fetch },
  );
  const vm = buildComposed(composeOf(outcome), 'link', strings, CANON_REPO);

  assert.equal(vm.json, null, '지어낸 분모가 든 조각을 냈다');
  assert.equal(vm.refusedHead, strings.constitution.result.refused);
  assert.ok(vm.problems.length > 0);
  // ⛔ 사유 목록은 **축자**다 — 기계가 읽는 손잡이(필드 이름)를 품는다.
  assert.ok(vm.problems.join(' ').includes('names an adapter'), vm.problems.join(' | '));
});

test('조립 (negative) — 해석되지 않는 정본 값은 박제되지 않고 **말해진다**', async () => {
  const files = canonFiles();
  files[CANON_FILE] = `${cssOf(TOKENS)}:root {\n  --alias: var(--ink);\n}\n`;
  const api = fakeGithub({ [CANON_REPO]: files });
  const outcome = await composeIntent(
    { kind: 'link', axis: AXIS, base: null, canon: { repo: CANON_REPO, file: CANON_FILE, scope: ':root' }, trio: null, self: null },
    { fetch: api.fetch },
  );
  const vm = buildComposed(composeOf(outcome), 'link', strings, CANON_REPO);

  assert.ok(vm.json !== null);
  assert.ok(!vm.json.includes('--alias'), '해석되지 않은 값이 기준이 됐다');
  // ⛔ 조용히 건너뛰지 않는다 — 말하지 않으면 그 공백이 선언의 침묵이 된다.
  assert.deepEqual(
    vm.unpinned.map((token) => token.token),
    ['--alias'],
  );
  assert.equal(vm.unpinned[0]!.why, strings.constitution.result.unpinnedWhy['var-indirection']);
  assert.ok(vm.lines.includes(strings.constitution.result.unpinned(1)));
});

/**
 * ⭐⭐ **산문이 바이트로 박혀 있다** — 스크립트를 전부 걷어낸 방문자가 받는 것이 이것이다.
 * 런타임에 채우면 그 방문자가 받는 바이트에 산문이 **0** 이 되는데, 그것은 구독 입구를
 * 자바스크립트 없이 눌리게 둔 이유를 정면으로 지운다.
 *
 * ⛔ **함수 잎은 이 분모가 아니다** — `result.*` 는 **수와 사유를 받아** 문장을 짓는 자리라
 * 발행 시점에 값이 없다(그 잎의 깨움은 위 AC 들이 뷰모델을 **실제로 돌려** 든다).
 */
test('둘째 문서 — 카탈로그의 산문이 발행본에 **바이트로** 선다 (로케일 전수)', () => {
  const documents = renderSite(readSources(ROOT));
  // ⭐ 공백을 고른다 — 강조가 태그로 서면서 그 자리에 공백이 하나 더 생긴다(태그를 벗기는
  //   손이 자리를 비워 두기 때문이다). 자구가 같은지를 묻는 단정이 그 한 칸에 걸리지 않게 한다.
  const naked = (value: string): string => value.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  // ⭐ 엔티티를 **먼저** 푼다 — 따옴표는 발행본에서 `&quot;` 로 서고, 그 뒤에 태그를 벗긴
  //   꼴을 **둘** 만든다: 자리를 공백으로 두는 꼴과 아예 붙이는 꼴이다. 한글은 조사가 태그
  //   뒤에 붙어서(`…하나</strong>다`) 공백으로만 벗기면 단어가 갈라진다.
  const plain = (html: string): string => {
    const unescaped = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return [unescaped, unescaped.replace(/<[^>]*>/g, ''), unescaped.replace(/<[^>]*>/g, ' ')]
      .join('\n')
      .replace(/\s+/g, ' ');
  };

  for (const locale of LOCALES) {
    const html = plain(documents[publishedPath(locale, 'constitution')]!);
    const leaves: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') leaves.push(value);
      else if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk);
      // 함수 잎은 건너뛴다 — 위 머리말의 사유 그대로다.
    };
    const { result, ...standing } = CATALOG[locale].constitution;
    walk(standing);
    assert.ok(leaves.length > 0, `${locale}: 둘째 문서의 산문이 0 이다`);
    assert.ok(typeof result.refused === 'string', `${locale}: 결과 문구 절이 비었다`);
    for (const leaf of leaves) {
      assert.ok(html.includes(naked(leaf)), `${locale}: 발행본에 없는 자구다 — ${leaf.slice(0, 40)}`);
    }
  }
});

/* ───────────── 탐색 — 추측을 받지 않는다(읽어서 고르게 한다) ───────────── */

test('탐색 AC1 — 후보 파일은 **어댑터가 읽는 꼴**뿐이고, 스코프는 읽어 본 사실이다', async () => {
  const files = canonFiles();
  files[CANON_FILE] = `${cssOf(TOKENS)}.dark {\n  --paper: #101216;\n}\n`;
  const api = fakeGithub({ [CANON_REPO]: files });

  const repo = await readRepo({ repo: CANON_REPO }, 'css-custom-properties', { fetch: api.fetch });
  assert.equal(repo.kind, 'repo');
  const listed = (repo as Extract<typeof repo, { kind: 'repo' }>).files;
  // ⛔ 화면이 확장자를 알지 못한다 — 어댑터가 자기 꼴을 말한다.
  assert.deepEqual(listed, [CANON_FILE]);
  assert.ok(!listed.includes('README.md'), '읽지 못하는 꼴이 후보에 들었다');

  const scoped = await readScopes({ repo: CANON_REPO }, [CANON_FILE], 'css-custom-properties', {
    fetch: api.fetch,
  });
  assert.equal(scoped.kind, 'scopes');
  const probe = (scoped as Extract<typeof scoped, { kind: 'scopes' }>).probe;
  assert.ok(probe.kind === 'read', JSON.stringify(probe));
  // 읽힌 수 내림차순 — 「어느 쪽이 공유값의 자리인가」를 수가 말한다(우리가 고르지 않는다).
  assert.deepEqual(probe.scopes.map((entry) => entry.scope), [':root', '.dark']);
  assert.equal(probe.scopes[0]!.tokens, Object.keys(TOKENS).length);
});

test('탐색 AC2 (negative) — 읽을 꼴의 파일이 없으면 **빈 목록**이다: 지어내지 않는다', async () => {
  const api = fakeGithub({ [CANON_REPO]: { 'README.md': 'ok\n', 'graduand.json': '{}\n' } });
  const repo = await readRepo({ repo: CANON_REPO }, 'css-custom-properties', { fetch: api.fetch });
  assert.equal(repo.kind, 'repo');
  assert.deepEqual((repo as Extract<typeof repo, { kind: 'repo' }>).files, []);
});

test('탐색 AC3 (negative) — 고른 스코프가 실물과 어긋나면 **조립이 거부한다**', async () => {
  const api = fakeGithub({ [CANON_REPO]: canonFiles() });
  const scoped = await readScopes({ repo: CANON_REPO }, [CANON_FILE], 'css-custom-properties', {
    fetch: api.fetch,
  });
  assert.equal(scoped.kind, 'scopes');
  const snapshot = (scoped as Extract<typeof scoped, { kind: 'scopes' }>).snapshot;

  // 실물은 `:root` 인데 `.dark` 를 들고 조립한다 — 읽어 본 손이 그것을 막는다.
  const outcome = await composeIntent({
    kind: 'canon',
    axis: AXIS,
    // ⛔ 이 판은 **더하지 않는다** — 새 선언을 짓는 경로이고, 그 사실을 null 이 말한다.
    base: null,
    trio: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: '.dark' },
    self: snapshot,
  });
  const vm = buildComposed(composeOf(outcome), 'canon', strings, CANON_REPO);
  assert.equal(vm.json, null, '실물과 어긋난 선언을 냈다');
  assert.ok(vm.problems.join(' ').includes('reads zero values'), vm.problems.join(' | '));
  // ⭐ 어댑터가 **본 것**을 함께 말한다 — 다음에 고를 값이 그 줄에 있다.
  assert.ok(vm.problems.join(' ').includes(':root'), vm.problems.join(' | '));
});

test('탐색 AC4 — 읽어서 고른 트리오는 그대로 통과한다 (화면이 내는 것이 참인 선언이다)', async () => {
  const api = fakeGithub({ [CANON_REPO]: canonFiles() });
  const scoped = await readScopes({ repo: CANON_REPO }, [CANON_FILE], 'css-custom-properties', {
    fetch: api.fetch,
  });
  const read = scoped as Extract<typeof scoped, { kind: 'scopes' }>;
  assert.ok(read.probe.kind === 'read');
  const chosen = read.probe.scopes[0]!.scope;

  const outcome = await composeIntent({
    kind: 'canon',
    axis: AXIS,
    // ⚠️ 스코프를 읽는 걸음은 **선언을 다시 묻지 않는다**(본문을 싣는 두 번째 읽기다) —
    //   화면은 첫 읽기에서 받은 base 를 들고 간다. 이 판은 새 선언을 짓는다.
    base: null,
    trio: { adapter: 'css-custom-properties', files: [CANON_FILE], scope: chosen },
    self: read.snapshot,
  });
  const vm = buildComposed(composeOf(outcome), 'canon', strings, CANON_REPO);
  assert.ok(vm.json !== null, vm.problems.join(' | '));
  const declaration = validateDeclaration(vm.json);
  assert.ok(declaration.state === 'valid');
  assert.equal(declaration.sharedValues?.[AXIS]?.scope, chosen);
});

/* ───────────── 개정 3 ① — 격자가 봉투에 탄다 ───────────── */

test('봉투 AC — 요약으로 받은 보고가 **같은 격자**를 그린다 (돈 내는 쪽이 더 가난하지 않다)', async () => {
  const api = fakeGithub({ [CANON_REPO]: canonFiles(), [DOWN_REPO]: downFiles(true) });
  const read = reportOf(await diagnoseUrl({ repo: DOWN_REPO }, { fetch: api.fetch }));

  // 저장소를 읽은 표면이 센 격자가 **비어 있지 않다** — 아니면 이 단정이 공짜로 참이 된다.
  assert.ok(gridOf(read).rules.length > 0 && gridOf(read).surfaces.length > 0);

  // 그 측정을 주소에 접어 보내고, 받은 쪽이 다시 편다 — `--open` 이 비공개 고객에게 하는 일.
  const fragment = await encodeFragment(read.measurement);
  const back = await decodeFragment(fragment);
  assert.deepEqual(back.grid, read.measurement.grid);
  assert.deepEqual(back.peers, read.measurement.peers);

  // ⭐⭐ 그리고 **그린 화면이 같다** — 요약만 쥔 표면이 관할 수를 못 받던 그 자리가 닫혔다.
  const direct = buildObservation(read, strings);
  const viaFragment = buildObservation(
    { kind: 'report', origin: 'fragment', measurement: back },
    strings,
  );
  assert.equal(viaFragment.jurisdictionLine, direct.jurisdictionLine);
  assert.equal(viaFragment.canonLine, direct.canonLine);
  assert.deepEqual(viaFragment.rows, direct.rows);
  assert.ok(viaFragment.jurisdictionLine !== null);

  // ⛔ 선언 바이트는 주소에 실리지 않는다 — 격자는 **센 수**이지 고객 파일이 아니다.
  const declaration = JSON.parse(downFiles(true)['graduand.json']!) as { 'shared-values': { [AXIS]: { pinned: Record<string, string> } } };
  for (const value of Object.values(declaration['shared-values'][AXIS]!.pinned)) {
    assert.ok(!fragment.includes(value), `${value} 가 주소에 실렸다`);
  }
});

/* ───────────── 개정 4 ② — 헌법 여럿: 있는 선언에 축을 더한다 ───────────── */

test('조립 AC5 — 선언이 있는 저장소에 **축을 더하면** 전문이 나온다 (두 선언을 손으로 합치지 않는다)', async () => {
  // 이 저장소는 이미 디자인 헌법을 선언했다 — ⭐ 그 선언에 축을 더하는 것이 「헌법 추가」다.
  const api = fakeGithub({ [DOWN_REPO]: downFiles(true) });
  const repo = await readRepo({ repo: DOWN_REPO }, 'css-custom-properties', { fetch: api.fetch });
  assert.equal(repo.kind, 'repo');
  const read = repo as Extract<typeof repo, { kind: 'repo' }>;
  assert.ok(read.base !== null, '이미 든 선언을 읽지 못했다');

  const outcome = await composeIntent({
    kind: 'canon',
    axis: 'brand',
    base: read.base,
    trio: { adapter: 'css-custom-properties', files: ['src/theme.css'], scope: ':root' },
    self: read.snapshot,
  });
  const composed = composeOf(outcome);
  const vm = buildComposed(composed, 'canon', strings, CANON_REPO);
  assert.ok(vm.json !== null, vm.problems.join(' | '));

  const declaration = validateDeclaration(vm.json);
  assert.ok(declaration.state === 'valid', vm.json);
  // ⭐⭐ 축이 둘이고 **남의 축은 그대로다** — 더하기가 기존 박제를 건드리지 않는다.
  assert.deepEqual(Object.keys(declaration.sharedValues ?? {}).sort(), ['brand', AXIS]);
  assert.deepEqual(declaration.sharedValues![AXIS]!.pinned, TOKENS);
  assert.deepEqual(declaration.sharedValues![AXIS]!.canon, {
    repo: CANON_REPO,
    file: CANON_FILE,
    scope: ':root',
  });
  // ⭐ 화면이 **더했다는 사실**을 말한다 — 말하지 않으면 고객은 자기 선언을 두 번 합친다.
  assert.ok(vm.lines.includes(strings.constitution.result.added), vm.lines.join(' | '));
  assert.ok(vm.lines.includes(strings.constitution.result.axis('brand')), vm.lines.join(' | '));
});

test('조립 AC6 (negative) — **같은 축**을 다시 조립하지 않는다: 박제와 갈라짐 선언을 지우는 일이다', async () => {
  const api = fakeGithub({ [DOWN_REPO]: downFiles(true) });
  const repo = await readRepo({ repo: DOWN_REPO }, 'css-custom-properties', { fetch: api.fetch });
  const read = repo as Extract<typeof repo, { kind: 'repo' }>;

  const outcome = await composeIntent({
    kind: 'canon',
    axis: AXIS, // 이미 선언된 축이다
    base: read.base,
    trio: { adapter: 'css-custom-properties', files: ['src/theme.css'], scope: ':root' },
    self: read.snapshot,
  });
  const vm = buildComposed(composeOf(outcome), 'canon', strings, CANON_REPO);
  assert.equal(vm.json, null, '있는 축을 덮어쓴 조각을 냈다');
  assert.ok(vm.problems.join(' ').includes('already declared'), vm.problems.join(' | '));
});

test('조립 AC7 (negative) — 선언이 깨진 저장소에는 조립하지 않는다: **무엇이 깨졌는지** 말한다', async () => {
  const files = downFiles(true);
  files['graduand.json'] = '{"palette": {"adapter": "css-custom-properties", "files": ["a.css"], "scope": ":root"}}\n';
  const api = fakeGithub({ [DOWN_REPO]: files });
  const repo = await readRepo({ repo: DOWN_REPO }, 'css-custom-properties', { fetch: api.fetch });

  // ⭐ 앞 판의 키(`palette`)를 든 선언이 여기 앉는다 — 오타가 아니라 **옮겨간 키**다.
  assert.equal(repo.kind, 'declaration-invalid');
  const problems = (repo as Extract<typeof repo, { kind: 'declaration-invalid' }>).problems;
  assert.ok(problems.join(' ').includes('moved'), problems.join(' | '));
});
