import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeRefs } from './refs.ts';
import { indexPaths, type RepoSnapshot } from '../snapshot.ts';

function snap(entries: Record<string, string | null>, extraPaths: string[] = []): RepoSnapshot {
  const paths = [...Object.keys(entries), ...extraPaths].sort();
  return { repo: 'acme/widgets', commit: 'c'.repeat(40), paths, files: new Map(Object.entries(entries)) };
}

const judge = (s: RepoSnapshot) => judgeRefs(s, indexPaths(s.paths));

test('전부 해소되면 pass — 수는 전수로 실린다', () => {
  const r = judge(
    snap(
      {
        'README.md': '[guide](docs/guide.md) and [[guide]]',
        'docs/guide.md': 'see `src/app.ts:3` and [up](../README.md)',
      },
      ['src/app.ts'],
    ),
  );
  assert.equal(r.status, 'pass');
  assert.equal(r.counts.scanned, 4);
  assert.equal(r.counts.unresolved, 0);
});

test('missing / wrong-base / outside-repo 를 사유로 가른다', () => {
  const r = judge(snap({ 'docs/a.md': '[x](nope.md)\n[y](docs/real.md)\n[z](~/home/secret.md)', 'docs/real.md': '' }));
  assert.equal(r.status, 'violation');
  const whys = r.evidence.map((e) => e.why).sort();
  assert.deepEqual(whys, ['missing', 'outside-repo', 'wrong-base']);
  const wrongBase = r.evidence.find((e) => e.why === 'wrong-base')!;
  assert.equal(wrongBase.raw, 'docs/real.md'); // 루트 기준으로는 실재한다 — 처방이 다르다
});

test('절대 접두사 — 꼬리가 저장소에서 해소되면 위반, 아니면 판정 대상 밖', () => {
  const r = judge(
    snap({ 'docs/a.md': 'see `/mnt/work/src/app.ts` and `/legal/terms.html` route' }, ['src/app.ts']),
  );
  assert.equal(r.counts.unresolved, 1);
  assert.equal(r.evidence[0]!.why, 'absolute-prefix');
  assert.equal(r.counts.external, 1);
});

test('유예는 바로 앞 줄 + until + remove 전부 있어야 통과하고, 따로 센다', () => {
  const excused = ['<!-- graduand-excuse until: TICKET-9 remove: delete with the ref -->', '[x](gone.md)'].join('\n');
  const r = judge(snap({ 'a.md': excused }));
  assert.equal(r.status, 'pass');
  assert.equal(r.counts.excused, 1);

  const incomplete = ['<!-- graduand-excuse until: TICKET-9 -->', '[x](gone.md)'].join('\n');
  const r2 = judge(snap({ 'a.md': incomplete }));
  assert.equal(r2.status, 'violation');
});

test('이름 표기는 저장소 안 어딘가의 마크다운 이름으로 해소된다', () => {
  const r = judge(snap({ 'README.md': '[[deep-dive]] [[nowhere-at-all]]', 'docs/deep-dive.md': '' }));
  assert.equal(r.counts.unresolved, 1);
  assert.equal(r.evidence[0]!.raw, 'nowhere-at-all');
});

test('백틱 경로는 부모가 실재할 때만 지역 참조다 — 남의 저장소 이야기는 세지 않는다', () => {
  const r = judge(snap({ 'a.md': '`docs/missing.md` and `other-repo/src/thing.ts`', 'docs/real.md': '' }));
  assert.equal(r.counts.unresolved, 1);
  assert.equal(r.evidence[0]!.raw, 'docs/missing.md');
});

test('읽기 실패가 하나라도 있으면 수를 내지 않는다 — unjudged + 사유 (AC3)', () => {
  const r = judge(snap({ 'a.md': '[x](gone.md)', 'b.md': null }));
  assert.equal(r.status, 'unjudged');
  assert.equal(r.reason, 'collection-truncated');
  assert.equal(r.counts.unresolved, undefined); // 부분 수집 위의 위반 수는 존재하지 않는다
  assert.deepEqual(r.evidence, [{ file: 'b.md' }]);
});

test('추적되지 않는 파일은 존재가 아니다 — 분모는 추적 파일이다', () => {
  // snapshot.paths 에 없는 파일을 가리키면 디스크 사정과 무관하게 missing 이다.
  const r = judge(snap({ 'a.md': '[x](untracked.md)' }));
  assert.equal(r.status, 'violation');
  assert.equal(r.evidence[0]!.why, 'missing');
});
