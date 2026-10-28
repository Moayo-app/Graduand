import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  CHECK_STATUSES,
  REASON_CODES,
  parseJudgment,
  serializeJudgment,
  parseMeasurement,
  serializeMeasurement,
  SchemaParseError,
  VersionMismatchError,
  type Judgment,
  type Measurement,
} from './schema.ts';

const judgment: Judgment = {
  v: SCHEMA_VERSION,
  repo: 'acme/widgets',
  commit: 'a'.repeat(40),
  checks: [
    {
      id: 'refs',
      status: 'violation',
      reason: null,
      counts: { files: 3, unresolved: 1, evidenceOmitted: 0 },
      evidence: [{ file: 'docs/a.md', line: 2, why: 'missing', tried: 'docs/x.md', notation: 'markdown-link', raw: 'x.md' }],
    },
    { id: 'ui-paths', status: 'unjudged', reason: 'no-declaration', counts: { declared: 0 }, evidence: [] },
  ],
};

test('직렬화 → 역직렬화가 전 필드를 보존한다 (AC2)', () => {
  const text = serializeJudgment(judgment);
  const back = parseJudgment(text);
  assert.deepEqual(back, judgment);
  // AC2 의 열거: v · repo · 커밋 SHA · 체크별 3상태 · 미판정 사유 코드.
  assert.equal(back.v, SCHEMA_VERSION);
  assert.equal(back.repo, 'acme/widgets');
  assert.equal(back.commit, 'a'.repeat(40));
  assert.deepEqual(back.checks.map((c) => c.status), ['violation', 'unjudged']);
  assert.equal(back.checks[1]!.reason, 'no-declaration');
});

test('모르는 v 는 조용히 해석하지 않는다 (AC4)', () => {
  const alien = JSON.stringify({ ...judgment, v: SCHEMA_VERSION + 1 });
  assert.throws(() => parseJudgment(alien), VersionMismatchError);
  assert.throws(() => parseJudgment(JSON.stringify({ hello: 1 })), VersionMismatchError);
  assert.throws(() => parseJudgment('not json'), SchemaParseError);
});

test('미판정에는 사유가 반드시 붙는다 — 사유 없는 unjudged 는 거부', () => {
  const bad = structuredClone(judgment);
  bad.checks[1] = { ...bad.checks[1]!, reason: null };
  assert.throws(() => serializeJudgment(bad), SchemaParseError);
  const alsoBad = structuredClone(judgment);
  alsoBad.checks[0] = { ...alsoBad.checks[0]!, reason: 'no-declaration' }; // unjudged 아닌데 사유
  assert.throws(() => serializeJudgment(alsoBad), SchemaParseError);
});

test('counts 는 음이 아닌 정수만 — 백분율이 끼어들 자리가 없다', () => {
  const bad = structuredClone(judgment);
  bad.checks[0]!.counts = { ratio: 0.97 };
  assert.throws(() => serializeJudgment(bad), SchemaParseError);
});

test('측정 봉투 roundtrip — dirty 는 null 과 0 을 구분한다', () => {
  const m: Measurement = {
    judgment,
    source: 'workspace',
    measuredAt: '2026-10-24T00:00:00.000Z',
    verifier: { name: 'graduand', version: '0.0.0' },
    dirty: null,
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
  assert.deepEqual(parseMeasurement(serializeMeasurement(m)), m);
  assert.throws(
    () => serializeMeasurement({ ...m, dirty: -1 }),
    SchemaParseError,
  );
  assert.throws(
    () => serializeMeasurement({ ...m, source: 'hosted' as never }),
    SchemaParseError,
  );
});

test('사유 코드는 아홉이고 3상태는 셋 그대로다 (AC7)', () => {
  // 개정 2 가 사유 코드 다섯을 더했고, 개정 4 는 **하나도 더하지 않았다** — 늘어난 것은
  // 칸의 수(축마다 하나)이지 상태도 사유도 아니다. ⛔ 상태는 늘지 않는다 — 「위반이지만 경고」 같은
  // 네 번째 상태가 들어오는 순간 「빨강의 근거는 위반뿐」이 깨진다.
  assert.equal(REASON_CODES.length, 9);
  assert.equal(new Set(REASON_CODES).size, 9);
  assert.deepEqual([...CHECK_STATUSES], ['pass', 'violation', 'unjudged']);
  for (const code of ['no-verifier', 'declared-divergence', 'declared-exemption', 'no-entitlement', 'entitlement-unverifiable']) {
    assert.ok((REASON_CODES as readonly string[]).includes(code), code);
  }
  for (const code of REASON_CODES) assert.doesNotMatch(code, /score|grade|percent|warn|severity/i);
});

test('개정이 올랐으므로 앞 판의 직렬화본은 조용히 읽히지 않는다', () => {
  // ⚠️ 이 수는 **일부러 리터럴**이다 — 개정이 오르면 여기가 빨개져서 「올렸다」가 의도된
  //    행위임을 사람이 확인하게 한다(낡음을 고정하는 리터럴과 반대 성질이다).
  assert.equal(SCHEMA_VERSION, 6);
  // ⭐ 거부하는 판을 **유도한다** — 바로 앞 판이 조용히 읽히지 않는 것이 이 단정의 내용이다.
  for (const stale of [SCHEMA_VERSION - 1, 1]) {
    assert.throws(() => parseJudgment(JSON.stringify({ ...judgment, v: stale })), VersionMismatchError);
  }
});
