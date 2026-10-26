/**
 * 진단 흐름의 AC — 네트워크 경계(AC1) · 판정 불가 3종(AC3 · AC4 · AC6)과
 * fragment 손상 폴백. 네트워크는 전부 가짜 fetch 주입이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diagnoseUrl, openFragment, reasonOf, UNJUDGEABLE_REASONS, type Unjudgeable, type UnjudgeableReason } from './outcome.ts';
import { unjudgeableScreen, CLI_COMMAND, CLI_COMMAND_LATEST } from './screens.ts';
import { ko } from './strings-ko.ts';
import { encodeFragment, SCHEMA_VERSION, type Measurement } from '../../verifier/src/index.ts';
import { crc32, toBase64Url, utf8Encode } from '../../verifier/src/bytes.ts';

const COMMIT = 'a3f8c1e2d4b5a6978877665544332211deadbeef';
const NOW = () => new Date('2026-10-25T12:00:00.000Z');

const FILES: Record<string, string> = {
  'README.md': '[guide](docs/guide.md)\n[gone](docs/missing.md)\n',
  'docs/guide.md': 'ok\n',
  'graduand.json': '{"ui": ["app/"]}\n',
  'app/main.ts': 'export {};\n',
};

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

/** 픽스처를 서빙하는 가짜 GitHub API — 요청 URL 을 전부 기록한다. */
function fakeGithub(files: Record<string, string>): { fetch: typeof fetch; requested: string[] } {
  const paths = Object.keys(files).sort();
  const blobShaOf = (path: string): string => `blob-${paths.indexOf(path)}`;
  const routes = new Map<string, unknown>([
    ['/repos/acme/widgets', { full_name: 'acme/widgets', default_branch: 'main' }],
    ['/repos/acme/widgets/commits/main', { sha: COMMIT }],
    [
      `/repos/acme/widgets/git/trees/${COMMIT}?recursive=1`,
      { truncated: false, tree: paths.map((path) => ({ path, type: 'blob', sha: blobShaOf(path) })) },
    ],
    ...paths.map((path): [string, unknown] => [
      `/repos/acme/widgets/git/blobs/${blobShaOf(path)}`,
      { content: b64(files[path]!), encoding: 'base64' },
    ]),
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

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream({
    start(controller): void {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const transform: { readable: ReadableStream; writable: WritableStream } = new CompressionStream('gzip');
  const reader = (source.pipeThrough(transform) as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function diagnoseFixture(): Promise<Measurement> {
  const fake = fakeGithub(FILES);
  const outcome = await diagnoseUrl({ repo: 'acme/widgets' }, { fetch: fake.fetch, now: NOW });
  assert.equal(outcome.kind, 'report');
  if (outcome.kind !== 'report') throw new Error('unreachable');
  return outcome.measurement;
}

test('AC1 — 공개 URL 진단의 요청은 전부 api.github.com 이다: 다른 호스트 경유 0', async () => {
  const fake = fakeGithub(FILES);
  const outcome = await diagnoseUrl({ repo: 'acme/widgets' }, { fetch: fake.fetch, now: NOW });

  assert.equal(outcome.kind, 'report');
  if (outcome.kind !== 'report') return;
  assert.ok(fake.requested.length > 0);
  for (const url of fake.requested) {
    assert.ok(url.startsWith('https://api.github.com/'), `api.github.com 밖으로 나간 요청: ${url}`);
  }

  assert.equal(outcome.origin, 'url');
  assert.equal(outcome.measurement.source, 'github-api');
  assert.equal(outcome.measurement.dirty, 0);
  assert.equal(outcome.measurement.judgment.repo, 'acme/widgets');
  assert.equal(outcome.measurement.judgment.commit, COMMIT);
  assert.equal(outcome.measurement.measuredAt, '2026-10-25T12:00:00.000Z');
  // 픽스처의 실체: refs 는 깨진 참조 1 로 위반, ui-paths 는 선언이 실재해 통과.
  const byId = new Map(outcome.measurement.judgment.checks.map((c) => [c.id, c]));
  assert.equal(byId.get('refs')?.status, 'violation');
  assert.equal(byId.get('ui-paths')?.status, 'pass');
});

test('AC3 — 비공개(또는 부재) URL 은 「위반 0」이 아니라 판정 불가 화면 + 명령 경로다', async () => {
  const notFound = (() => Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }))) as typeof fetch;
  const outcome = await diagnoseUrl({ repo: 'acme/secret' }, { fetch: notFound });

  assert.notEqual(outcome.kind, 'report');
  assert.deepEqual(outcome, { kind: 'unreadable', code: 'private-or-missing' });
  if (outcome.kind !== 'unreadable') return;

  const screen = unjudgeableScreen(outcome, ko, NOW);
  const prose = screen.lines.join('\n');
  assert.match(prose, /「위반 0」이 아니다/);
  assert.match(prose, /비공개 저장소이거나, 존재하지 않는다/);
  assert.equal(screen.command, CLI_COMMAND);
  assert.equal(reasonOf(outcome), 'private-or-missing');
});

test('AC4 — 무인증 한도 소진은 남은 대기 시간과 명령 경로를 말한다', async () => {
  const resetAt = Math.floor(NOW().getTime() / 1000) + 23 * 60;
  const limited = (() =>
    Promise.resolve(
      new Response('', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetAt) },
      }),
    )) as typeof fetch;
  const outcome = await diagnoseUrl({ repo: 'acme/widgets' }, { fetch: limited });

  assert.deepEqual(outcome, { kind: 'rate-limited', resetAt });
  if (outcome.kind !== 'rate-limited') return;

  const screen = unjudgeableScreen(outcome, ko, NOW);
  const prose = screen.lines.join('\n');
  assert.match(prose, /약 23분 뒤 풀린다/);
  assert.equal(screen.command, CLI_COMMAND);
  assert.equal(reasonOf(outcome), 'rate-limited');

  // 리셋 시각이 없는 응답 — 모름을 0분으로 바꾸지 않는다.
  const silent = unjudgeableScreen({ kind: 'rate-limited', resetAt: null }, ko, NOW);
  assert.match(silent.lines.join('\n'), /리셋 시각을 말하지 않았다/);
});

test('fragment 왕복 — 측정이 그대로 돌아오고 출처는 fragment 다', async () => {
  const measurement = await diagnoseFixture();
  const outcome = await openFragment(await encodeFragment(measurement));
  assert.equal(outcome.kind, 'report');
  if (outcome.kind !== 'report') return;
  assert.equal(outcome.origin, 'fragment');
  assert.deepEqual(outcome.measurement, measurement);
});

test('AC6 — 모르는 fragment 판은 조용히 해석하지 않고 버전 불일치 화면이다', async () => {
  const measurement = await diagnoseFixture();
  const tampered = (await encodeFragment(measurement)).replace(/^g1\./, 'g9.');
  const outcome = await openFragment(tampered);

  assert.deepEqual(outcome, { kind: 'version-mismatch', axis: 'fragment', found: 'g9' });
  if (outcome.kind !== 'version-mismatch') return;
  const screen = unjudgeableScreen(outcome, ko, NOW);
  assert.match(screen.lines.join('\n'), /모른다/);
  assert.equal(screen.command, CLI_COMMAND_LATEST);
  assert.equal(reasonOf(outcome), 'version-mismatch');
});

test('AC6 — 스키마 판 불일치도 같은 규율이다 (본문 v 가 모르는 판)', async () => {
  const measurement = await diagnoseFixture();
  const raw = JSON.parse(JSON.stringify(measurement)) as { judgment: { v: number } };
  raw.judgment.v = SCHEMA_VERSION + 1;
  const json = utf8Encode(JSON.stringify(raw));
  const checksum = crc32(json).toString(16).padStart(8, '0');
  const fragment = `g1.${json.length}.${checksum}.${toBase64Url(await gzipBytes(json))}`;

  const outcome = await openFragment(fragment);
  assert.deepEqual(outcome, { kind: 'version-mismatch', axis: 'schema', found: String(SCHEMA_VERSION + 1) });
});

test('손상된 fragment 는 그리지 않는다 — 자기검증 실패는 보이는 실패다', async () => {
  const measurement = await diagnoseFixture();
  const fragment = await encodeFragment(measurement);
  const outcome = await openFragment(fragment.slice(0, fragment.length - 9));

  assert.equal(outcome.kind, 'fragment-unreadable');
  if (outcome.kind !== 'fragment-unreadable') return;
  const screen = unjudgeableScreen(outcome, ko, NOW);
  assert.match(screen.lines.join('\n'), /그리지 않는다/);
  assert.equal(reasonOf(outcome), 'fragment-unreadable');
});

test('깨진 선언은 미판정으로 접히지 않는다 — 판정 실패 화면이 문제를 축자로 든다', async () => {
  const broken = { ...FILES, 'graduand.json': '{"ui": "app/"}\n' };
  const fake = fakeGithub(broken);
  const outcome = await diagnoseUrl({ repo: 'acme/widgets' }, { fetch: fake.fetch, now: NOW });

  assert.equal(outcome.kind, 'declaration-invalid');
  if (outcome.kind !== 'declaration-invalid') return;
  assert.ok(outcome.problems.length > 0);
  const screen = unjudgeableScreen(outcome, ko, NOW);
  assert.match(screen.title, /판정 실패/);
  assert.ok(screen.lines.some((line) => line.includes(outcome.problems[0]!)));
  assert.equal(reasonOf(outcome), 'declaration-invalid');
});

test('API 한도로 본문 일부를 못 읽으면 보고서는 서되 해당 체크가 미판정이 된다', async () => {
  // tree 까지는 성공, blob 에서 한도 — 로더가 잘림으로 남기고 refs 는 수를 내지 않는다.
  const fake = fakeGithub(FILES);
  const limitedBlobs = ((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/git/blobs/')) {
      return Promise.resolve(
        new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
      );
    }
    return fake.fetch(url);
  }) as typeof fetch;

  const outcome = await diagnoseUrl({ repo: 'acme/widgets' }, { fetch: limitedBlobs, now: NOW });
  assert.equal(outcome.kind, 'report');
  if (outcome.kind !== 'report') return;
  const byId = new Map(outcome.measurement.judgment.checks.map((c) => [c.id, c]));
  assert.equal(byId.get('refs')?.status, 'unjudged');
  assert.equal(byId.get('refs')?.reason, 'collection-truncated');
});

/** 사유마다 가장 작은 표본 하나. `Record<UnjudgeableReason, …>` 라 일곱이 다 차야 선다. */
const SAMPLE: Record<UnjudgeableReason, Unjudgeable> = {
  'private-or-missing': { kind: 'unreadable', code: 'private-or-missing' },
  'tree-truncated': { kind: 'unreadable', code: 'tree-truncated' },
  'rate-limited': { kind: 'rate-limited', resetAt: null },
  'version-mismatch': { kind: 'version-mismatch', axis: 'schema', found: '9' },
  'fragment-unreadable': { kind: 'fragment-unreadable', message: '체크섬이 맞지 않는다' },
  'declaration-invalid': { kind: 'declaration-invalid', problems: ['ui 는 배열이어야 한다'] },
  error: { kind: 'error', message: '네트워크가 끊겼다' },
};

test('판정 불가 사유 일곱이 전부 제 전용 화면을 받는다 — 하나로 접히지 않는다', () => {
  assert.equal(UNJUDGEABLE_REASONS.length, 7);
  const titles = new Set<string>();
  for (const reason of UNJUDGEABLE_REASONS) {
    const outcome = SAMPLE[reason];
    assert.equal(reasonOf(outcome), reason);
    const screen = unjudgeableScreen(outcome, ko, NOW);
    assert.ok(screen.title.length > 0, `${reason}: 제목이 비었다`);
    assert.ok(screen.lines.length > 0, `${reason}: 설명이 비었다`);
    titles.add(screen.title);
  }
  // 전용 화면이라는 말의 뜻 — 사유 일곱이 서로 다른 제목 일곱이다.
  assert.equal(titles.size, UNJUDGEABLE_REASONS.length);
});
