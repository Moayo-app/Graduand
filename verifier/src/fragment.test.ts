import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFragment, encodeFragment, FragmentIntegrityError, FRAGMENT_VERSION } from './fragment.ts';
import { SCHEMA_VERSION, VersionMismatchError, type Measurement } from './schema.ts';

const measurement: Measurement = {
  judgment: {
    v: SCHEMA_VERSION,
    repo: 'acme/widgets',
    commit: 'b'.repeat(40),
    checks: [{ id: 'refs', status: 'pass', reason: null, counts: { files: 2, unresolved: 0 }, evidence: [] }],
  },
  source: 'workspace',
  measuredAt: '2026-10-24T01:02:03.000Z',
  verifier: { name: 'graduand', version: '0.0.0' },
  dirty: 0,
};

test('roundtrip — 인코딩한 것을 그대로 되읽는다', async () => {
  const fragment = await encodeFragment(measurement);
  assert.ok(fragment.startsWith(`${FRAGMENT_VERSION}.`));
  assert.match(fragment, /^g1\.\d+\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/); // URL fragment 에 안전한 문자만
  assert.deepEqual(await decodeFragment(fragment), measurement);
});

test('잘린 fragment 는 그려지지 않는다 — 자기검증이 잡는다', async () => {
  const fragment = await encodeFragment(measurement);
  await assert.rejects(decodeFragment(fragment.slice(0, fragment.length - 10)), FragmentIntegrityError);
});

test('본문 변조는 체크섬 또는 압축 해제에서 잡힌다', async () => {
  const fragment = await encodeFragment(measurement);
  const parts = fragment.split('.');
  const tampered = [...parts.slice(0, 3), `AAAA${parts[3]!.slice(4)}`].join('.');
  await assert.rejects(decodeFragment(tampered), FragmentIntegrityError);
});

test('자기검증 헤더 위조 — 길이·체크섬 불일치를 가른다', async () => {
  const fragment = await encodeFragment(measurement);
  const [v, len, crc, payload] = fragment.split('.') as [string, string, string, string];
  await assert.rejects(decodeFragment([v, String(Number(len) + 1), crc, payload].join('.')), FragmentIntegrityError);
  await assert.rejects(decodeFragment([v, len, 'deadbeef', payload].join('.')), FragmentIntegrityError);
});

test('모르는 fragment 버전은 조용히 해석하지 않는다 (AC4 의 fragment 축)', async () => {
  const fragment = await encodeFragment(measurement);
  const alien = `g2.${fragment.split('.').slice(1).join('.')}`;
  await assert.rejects(decodeFragment(alien), VersionMismatchError);
  await assert.rejects(decodeFragment('not-a-fragment'), FragmentIntegrityError);
});
