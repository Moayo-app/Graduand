import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFragment, encodeFragment, FragmentIntegrityError, FRAGMENT_VERSION,
  looksLikeFragment,
} from './fragment.ts';
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

/**
 * ⭐⭐ **요약과 페이지 앵커가 한 자리를 나눠 쓴다** — 보고 페이지의 주소가 루트 + `#<요약>`
 * 이기 때문이다. 가르는 규칙이 **요약의 모양**이므로 그 모양을 아는 이 모듈이 든다.
 *
 * ⚠️ 무는 것의 절반은 「**요약을 앵커로 접지 않는가**」다 — 접으면 잘린 보고서가 아무 표시
 * 없이 사라지고, 그것이 이 모듈의 자기검증이 막으려는 바로 그 위험이다.
 */
test('요약인 척하는 해시를 가른다 — 잘린 것도 모르는 판도 요약이다', async () => {
  const fragment = await encodeFragment(measurement);
  assert.ok(looksLikeFragment(fragment), '멀쩡한 요약이 요약이 아니라고 한다');

  // ⑴ **잘려도 요약이다** — 점이 몇 개든 선두의 판 이름이 남아 있으면 보이는 실패로 간다.
  const parts = fragment.split('.');
  for (const truncated of [parts.slice(0, 3).join('.'), parts.slice(0, 2).join('.'), `${parts[0]!}.`]) {
    assert.ok(looksLikeFragment(truncated), `잘린 요약을 앵커로 접었다: ${truncated}`);
    await assert.rejects(decodeFragment(truncated), FragmentIntegrityError);
  }

  // ⑵ **모르는 판도 요약이다** — 조용히 무시하면 그 사람은 보고서가 왜 안 뜨는지 모른다.
  const alien = `g2.${parts.slice(1).join('.')}`;
  assert.ok(looksLikeFragment(alien), '모르는 판을 앵커로 접었다');
  await assert.rejects(decodeFragment(alien), VersionMismatchError);

  // ⑶ 판 이름을 자처하지 않는 해시는 **페이지 앵커**다 — 그것만 거짓이다.
  for (const anchor of ['cta', 'faq', 'pricing', 'scaffold', '', 'g', 'g1', 'graduand']) {
    assert.ok(!looksLikeFragment(anchor), `앵커를 요약으로 읽었다: ${JSON.stringify(anchor)}`);
  }
});
