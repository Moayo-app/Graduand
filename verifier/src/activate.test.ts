/**
 * 활성화의 순수층과 **벤더를 부르는 손** — 구독과 자격 사이의 그 한 걸음.
 *
 * 받는 것은 다섯이다 — 짓는 손과 읽는 손이 **왕복하는가** · 덮어쓰지 않는가 · 거절이
 * **사유마다 다른 행동**을 요구하는가 · 벤더 쪽이 된 뒤 파일이 실패한 자리를 **말하는가** ·
 * 키가 화면에 **0 건**인가.
 *
 * ⛔ 네트워크를 타지 않는다 — 벤더를 부르는 손은 주입된다(`EntitlementIo.fetch`).
 * ⛔ 파일시스템도 없다 — 가짜 io 를 넣는다. 실제로 파일을 쓰는 경로와 git 을 건드리지
 *    않는다는 단정은 `ac.test.ts` 가 측정 명령을 돌려서 받는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ⚠️ **패키지 입구에서 받는다**(`ac.test.ts` 와 같은 꼴) — 모듈을 직접 집으면 초기화
//    순서가 `entitlement → expiry → declaration → entitlement` 로 돌아 상수가 비어 보인다.
//    그 순환은 이 모듈이 만든 것이 아니고, 입구가 그 순서를 쥔다.
import {
  ACTIVATION_ACTIONS,
  ENTITLEMENT,
  activateEntitlement,
  activateExitCode,
  composeHandle,
  formatActivation,
  parseHandle,
  writeHandle,
  type Activation,
  type ActivationRefusal,
  type EntitlementIo,
  type HandleIo,
  type HandleWrite,
} from './index.ts';

/** 기록하는 가짜 호스트 — 「쓰지 않았다」를 쓰기 **횟수**로 단정한다. */
function fakeIo(present: string[] = []): HandleIo & { written: { path: string; text: string }[] } {
  const files = new Set(present);
  const written: { path: string; text: string }[] = [];
  return {
    written,
    pathIn: (root) => `${root}/${ENTITLEMENT.file}`,
    exists: (path) => files.has(path),
    write: (path, text) => {
      written.push({ path, text });
      files.add(path);
    },
  };
}

const asFetch = (impl: (url: string) => Promise<Response>): typeof fetch =>
  ((input: string | URL | Request) => impl(input instanceof Request ? input.url : String(input))) as typeof fetch;

const KEY = 'key_under_test';

/** 고객 몫이 다 된 io — 키는 있고, 네트워크만 테스트가 고른다. */
const io = (impl: typeof fetch, key: string | null = KEY): EntitlementIo => ({
  readHandle: () => null,
  readKey: () => key,
  fetch: impl,
});

const answers = (status: number, body: string): typeof fetch =>
  asFetch(() => Promise.resolve(new Response(body, { status, headers: { 'content-type': 'application/json' } })));

const ID = 'act_01HQZ';
const ok = (): typeof fetch => answers(200, JSON.stringify({ [ENTITLEMENT.activationKey]: ID }));

/**
 * ⭐⭐ **AC1 — 짓는 손과 읽는 손이 왕복한다.** 핸들을 우리가 쓰고 우리가 읽는데 그 둘이
 * 갈라지면, 활성화에 성공한 고객이 다음 판정에서 「핸들을 읽을 수 없다」를 받는다.
 */
test('활성화 AC1 — 벤더의 답에서 핸들을 받아 쓰고, 그 바이트를 우리가 다시 읽는다', async () => {
  const outcome = await activateEntitlement(io(ok()), ENTITLEMENT.activationLabel);
  assert.deepEqual(outcome, { state: 'activated', activationId: ID });

  const host = fakeIo();
  const write = writeHandle('/repo', host, ID);
  assert.equal(write.kind, 'written');
  assert.equal(host.written.length, 1, '쓰기가 한 번이 아니다');

  // ⭐ **왕복** — 쓴 바이트가 읽는 손을 그대로 통과하고 같은 값을 낸다.
  assert.deepEqual(parseHandle(host.written[0]!.text), { activationId: ID });
  assert.deepEqual(parseHandle(composeHandle(ID)), { activationId: ID });
  assert.equal(activateExitCode(outcome, write), 0);
});

test('활성화 AC1 (negative) — 빈 핸들은 쓰지 않는다: 모르는 모양을 「됐다」로 읽지 않는다', async () => {
  for (const raw of ['', '   ', 12345, null, {}] as const) {
    const answered = await activateEntitlement(io(answers(200, JSON.stringify({ [ENTITLEMENT.activationKey]: raw }))), 'x');
    assert.equal(answered.state, 'refused', `${JSON.stringify(raw)} 를 핸들로 받았다`);
    assert.equal((answered as { detail: ActivationRefusal }).detail, 'answer-unreadable');
  }
  // 키 자체가 없는 답도 같은 자리다 — 「id 가 없다」는 「활성화됐다」가 아니다.
  const empty = await activateEntitlement(io(answers(200, '{}')), 'x');
  assert.deepEqual(empty, { state: 'refused', detail: 'answer-unreadable', said: null });
});

/**
 * ⛔ **AC2 — 덮어쓰지 않는다.** 덮어쓰면 자리를 **또** 쓰고 앞의 자리는 회수되지 않는다.
 * ⭐ 그리고 **그때 화면이 활성화 id 를 적는다** — 벤더 쪽은 이미 쓰였으므로, 삼키면 고객은
 *   자리를 하나 잃은 줄도 모른다.
 */
test('활성화 AC2 — 핸들이 이미 있으면 쓰지 않고, 쓰려던 id 를 화면에 적는다', () => {
  const host = fakeIo([`/repo/${ENTITLEMENT.file}`]);
  const write = writeHandle('/repo', host, ID);
  assert.deepEqual(write, { kind: 'already-activated', path: `/repo/${ENTITLEMENT.file}` });
  assert.equal(host.written.length, 0, '덮어썼다 — 자리를 또 쓴다');

  const said = formatActivation({ state: 'activated', activationId: ID }, write);
  assert.deepEqual(said.stdout, [], '안 한 일을 stdout 에 적었다');
  const text = said.stderr.join('\n');
  assert.ok(text.includes(ID), '벤더 쪽이 쓴 자리를 삼켰다 — 고객이 그 id 를 받지 못한다');
  assert.equal(activateExitCode({ state: 'activated', activationId: ID }, write), 2);
});

test('활성화 AC2 (negative) — 쓰지 못한 자리도 같은 규율이다: 벤더 쪽 id 를 말한다', () => {
  const failing: HandleIo = {
    pathIn: (root) => `${root}/${ENTITLEMENT.file}`,
    exists: () => false,
    write: () => {
      throw new Error('읽기 전용 파일시스템');
    },
  };
  const write = writeHandle('/repo', failing, ID);
  assert.equal(write.kind, 'write-failed');
  const text = formatActivation({ state: 'activated', activationId: ID }, write).stderr.join('\n');
  assert.ok(text.includes(ID), '쓰지 못했는데 벤더 쪽 id 를 말하지 않았다');
  // 손으로 적을 수 있게 **자리와 키 이름**이 함께 온다 — 이름은 상수에서 읽는다.
  assert.ok(text.includes(ENTITLEMENT.file) && text.includes(ENTITLEMENT.handleKey), text);
});

/**
 * ⭐⭐ **AC3 — 거절이 뭉치지 않는다.** 요구하는 행동이 다르기 때문이다: 「설정을 고쳐라」 ·
 * 「네트워크를 열어라」 · 「키를 확인해라」 · 「당신 탓이 아니다」. 뭉치면 돈 낸 고객이
 * 오프라인에서 「키가 틀렸다」를 받는다.
 */
const refusals: readonly { readonly detail: ActivationRefusal; readonly make: () => Promise<Activation> }[] = [
  { detail: 'key-absent', make: () => activateEntitlement(io(ok(), null), 'x') },
  {
    detail: 'no-answer',
    make: () => activateEntitlement(io(asFetch(() => Promise.reject(new TypeError('fetch failed')))), 'x'),
  },
  { detail: 'no-answer', make: () => activateEntitlement(io(answers(503, '')), 'x') },
  { detail: 'vendor-said-no', make: () => activateEntitlement(io(answers(403, '{"detail":"limit reached"}')), 'x') },
  { detail: 'vendor-said-no', make: () => activateEntitlement(io(answers(404, '{"detail":"not found"}')), 'x') },
  { detail: 'answer-unreadable', make: () => activateEntitlement(io(answers(200, 'not json')), 'x') },
];

test('활성화 AC3 — 거절마다 사유가 다르고, 사유마다 요구하는 행동이 있다', async () => {
  for (const { detail, make } of refusals) {
    const outcome = await make();
    assert.equal(outcome.state, 'refused');
    assert.equal((outcome as { detail: ActivationRefusal }).detail, detail);
    assert.equal(activateExitCode(outcome, null), 2, '거절이 초록이다');
  }

  // ⛔ 사유 없는 거절은 이 제품이 팔지 않는 물건이다 — 표가 전수를 든다.
  const seen = new Set(refusals.map(({ detail }) => detail));
  for (const detail of Object.keys(ACTIVATION_ACTIONS) as ActivationRefusal[]) {
    assert.ok(ACTIVATION_ACTIONS[detail].length >= 8, `${detail} 에 요구하는 행동이 없다`);
  }
  // 네 자리는 실제로 돌려 봤고, 나머지 하나(빌드 미비)는 상수를 비워야 서는 자리다.
  assert.deepEqual(
    (Object.keys(ACTIVATION_ACTIONS) as ActivationRefusal[]).filter((d) => !seen.has(d)),
    ['vendor-unconfigured'],
    '돌려 보지 않은 거절이 늘었다 — 늘면 여기도 늘거나 돌려 봐야 한다',
  );

  // ⭐ 요구하는 행동이 **서로 다른 말**이다 — 같은 말이면 가르는 뜻이 없다.
  const actions = Object.values(ACTIVATION_ACTIONS);
  assert.equal(new Set(actions).size, actions.length, '거절 둘이 같은 행동을 요구한다');
});

test('활성화 AC3 — 발행 조직 id 가 없는 빌드는 **고객을 탓하지 않는다**', async () => {
  const before = ENTITLEMENT.organizationId;
  ENTITLEMENT.organizationId = null;
  try {
    const outcome = await activateEntitlement(
      io(
        asFetch(() => {
          throw new Error('물을 수 없는 빌드가 벤더를 불렀다');
        }),
      ),
      'x',
    );
    assert.deepEqual(outcome, { state: 'refused', detail: 'vendor-unconfigured', said: null });
    assert.ok(ACTIVATION_ACTIONS['vendor-unconfigured'].includes('당신 탓이 아니다'));
  } finally {
    ENTITLEMENT.organizationId = before;
  }
});

/**
 * ⭐ **AC4 — 벤더가 한 말을 지어내지 않는다.** 거절의 사유는 벤더가 알고 우리는 모른다
 * (키가 틀렸는가 · 자리를 다 썼는가). ⇒ 그 말을 **그대로** 싣고, 못 읽으면 null 이다.
 */
test('활성화 AC4 — 벤더가 한 말을 그대로 싣고, 길면 자른다', async () => {
  const said = (await activateEntitlement(io(answers(403, '{"detail":"activation limit reached"}')), 'x')) as {
    said: string | null;
  };
  assert.equal(said.said, 'activation limit reached');

  // JSON 이 아니면 본문 그대로 — 모르는 모양을 버리지 않는다.
  const plain = (await activateEntitlement(io(answers(400, 'bad request')), 'x')) as { said: string | null };
  assert.equal(plain.said, 'bad request');

  // 길면 자른다 — 화면이 남의 본문으로 넘치지 않는다.
  const long = (await activateEntitlement(io(answers(400, 'x'.repeat(500))), 'x')) as { said: string | null };
  assert.ok(long.said !== null && long.said.length < 500, '벤더의 본문을 그대로 쏟았다');

  // 빈 본문은 **말하지 않은 것**이다 — 빈 말을 말했다고 적지 않는다.
  const quiet = (await activateEntitlement(io(answers(400, '')), 'x')) as { said: string | null };
  assert.equal(quiet.said, null);
});

/**
 * ⛔⛔ **AC5 — 키가 화면에 0 건이다.** 핸들은 커밋되는 값이라 적어도 되지만, 키는 비밀이다.
 * 로그는 CI 에 남고 붙여넣어 옮겨진다 — 한 번 새면 되돌릴 수 없다.
 */
test('활성화 AC5 (negative) — 어느 결말에서도 키가 화면에 0 건이다', async () => {
  const written: HandleWrite = { kind: 'written', path: `/repo/${ENTITLEMENT.file}` };
  const outcomes: { outcome: Activation; write: HandleWrite | null }[] = [
    { outcome: { state: 'activated', activationId: ID }, write: written },
    { outcome: { state: 'activated', activationId: ID }, write: { kind: 'already-activated', path: 'p' } },
    { outcome: { state: 'activated', activationId: ID }, write: { kind: 'write-failed', path: 'p', message: 'm' } },
    { outcome: { state: 'activated', activationId: ID }, write: null },
  ];
  for (const { detail } of refusals) outcomes.push({ outcome: { state: 'refused', detail, said: null }, write: null });

  for (const { outcome, write } of outcomes) {
    const said = formatActivation(outcome, write);
    const text = [...said.stdout, ...said.stderr].join('\n');
    assert.ok(!text.includes(KEY), `키가 화면에 샜다: ${text}`);
    assert.ok(text.length > 0, '아무 말도 하지 않았다 — 조용한 결말을 두지 않는다');
  }
});

/**
 * ⛔⛔ **벤더가 키를 되비쳐도 새지 않는다.** 지우는 자리는 키를 아는 자리 하나뿐이다
 * (`hosts/entitlement.ts`) — 화면을 그리는 손은 키를 받지 않아 거기서는 지울 수도 없다.
 * ⚠️ 심어서 확인한다: 심지 않으면 이 단정은 아무것도 재지 않는다.
 */
test('활성화 AC5 (negative) — 벤더가 키를 되비쳐도 화면에 0 건이다: 심으면 지워진다', async () => {
  const echoed = (await activateEntitlement(io(answers(404, `{"detail":"key ${KEY} not found"}`)), 'x')) as {
    said: string | null;
  };
  assert.ok(echoed.said !== null, '벤더의 말을 통째로 버렸다');
  assert.ok(!echoed.said!.includes(KEY), `키가 사유에 남았다: ${echoed.said}`);
  assert.ok(echoed.said!.includes('not found'), '키를 지우면서 벤더의 말까지 지웠다');

  const text = formatActivation({ state: 'refused', detail: 'vendor-said-no', said: echoed.said }, null).stderr.join('\n');
  assert.ok(!text.includes(KEY), `키가 화면에 샜다: ${text}`);
});

test('활성화 AC5 — 쓴 핸들에도 키가 없다: 커밋되는 파일에 비밀이 0 이다', () => {
  const bytes = composeHandle(ID);
  assert.ok(!bytes.includes(KEY));
  assert.deepEqual(Object.keys(JSON.parse(bytes)), [ENTITLEMENT.handleKey], '핸들 파일의 키가 하나가 아니다');
});
