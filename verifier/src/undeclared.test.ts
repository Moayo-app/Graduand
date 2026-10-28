/**
 * 선언 0 에서 보이는 사실 — 여기서 받는 것은 다섯이다: 집이 **둘 이상**이어야 사본인가 ·
 * 하한이 놓치는 쪽으로 틀리는가 · 잘림이 「사본 0」으로 접히지 않는가 · 분모가 **어댑터
 * 등록부**에서 오는가 · 그리고 이 칸에 **상태가 없는가**.
 *
 * ⛔ 기대 수를 손으로 적는 자리를 최소로 둔다 — 블록과 파일은 입력에서 세고, 어댑터 줄
 * 수는 등록부에서 센다(적는 순간 그 수는 실물과 갈라질 수 있다).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  readUndeclared,
  foldDiverged,
  ANCHOR_CHARS,
  ANCHOR_HOMES_MAX,
  COPY_CAP,
  MIN_COPY_LINES,
  MIN_COPY_CHARS,
  HEAD_MAX,
} from './undeclared.ts';
import { VALUE_ADAPTERS } from './adapters/adapter.ts';
import type { RepoSnapshot } from './snapshot.ts';

function snap(entries: Record<string, string | null>): RepoSnapshot {
  return {
    repo: 'acme/widgets',
    commit: 'e'.repeat(40),
    paths: Object.keys(entries).sort(),
    files: new Map(Object.entries(entries)),
  };
}

/** 하한을 **넘는** 블록 하나 — 길이는 상수에서 유도한다(자구를 적지 않는다). */
const block = (head: string): string =>
  `${head}\n${'사본은 갈라진다 — 한 사실의 집이 둘이면 둘 중 하나만 고쳐지는 날 그 둘은 다른 말을 한다. '.repeat(
    Math.ceil(MIN_COPY_CHARS / 20),
  )}`;

const BLOCK = block('## 사본 금지');

test('같은 블록이 파일 둘에 축자로 있으면 사본 1 건이고, 사는 집 전부가 적힌다', () => {
  const facts = readUndeclared(
    snap({
      'README.md': `# 머리\n\n${BLOCK}\n`,
      'docs/guide.md': `# 안내\n\n${BLOCK}\n`,
    }),
  );
  assert.equal(facts.blocks, 1);
  assert.equal(facts.copies.length, 1);
  assert.deepEqual(facts.copies[0]!.files, ['README.md', 'docs/guide.md']);
  // 손잡이는 **첫 줄**이고 블록 전문이 아니다 — 봉투는 URL 에 실리는 표면이다.
  assert.equal(facts.copies[0]!.head, '## 사본 금지');
  assert.ok(facts.copies[0]!.lines >= MIN_COPY_LINES);
  assert.equal(facts.copiesOmitted, 0);
  assert.deepEqual(facts.documents, { tracked: 2, read: 2 });
});

test('집이 셋이면 집 셋이 적히고, 사본은 여전히 한 건이다 — 쌍으로 세지 않는다', () => {
  const files = ['a.md', 'b.md', 'docs/c.md'];
  const entries: Record<string, string> = {};
  for (const file of files) entries[file] = `${BLOCK}\n`;
  const facts = readUndeclared(snap(entries));
  assert.equal(facts.blocks, 1);
  assert.deepEqual(facts.copies[0]!.files, [...files].sort());
});

test('한 파일 안의 반복은 사본이 아니다 — 집이 둘이어야 사본이다', () => {
  const facts = readUndeclared(snap({ 'README.md': `${BLOCK}\n\n${BLOCK}\n` }));
  assert.equal(facts.blocks, 0);
  assert.deepEqual(facts.copies, []);
  // ⛔ 「사본 0」이 「문서 0」과 같아 보이지 않게 분모는 그대로 적힌다.
  assert.deepEqual(facts.documents, { tracked: 1, read: 1 });
});

test('하한 아래는 세지 않는다 — 놓치는 쪽으로 틀린다', () => {
  // 한 줄짜리(제목·목록 한 줄)와 짧은 블록은 산문의 평상시다.
  const short = '## 머리말';
  const twoShortLines = 'a\nb';
  assert.ok(short.length < MIN_COPY_CHARS);
  assert.ok(twoShortLines.split('\n').length >= MIN_COPY_LINES);
  assert.ok(twoShortLines.length < MIN_COPY_CHARS);
  // 한 줄인데 하한 문자수를 넘는 경우도 센다 — 줄 하한이 **함께** 걸린다.
  const oneLongLine = 'x'.repeat(MIN_COPY_CHARS + 10);
  const facts = readUndeclared(
    snap({
      'a.md': `${short}\n\n${twoShortLines}\n\n${oneLongLine}\n`,
      'b.md': `${short}\n\n${twoShortLines}\n\n${oneLongLine}\n`,
    }),
  );
  assert.equal(facts.blocks, 0, '하한 아래의 블록이 사본으로 셌다');
});

test('줄 끝 공백과 CR 만 정규화한다 — 그 밖은 축자다', () => {
  const same = readUndeclared(
    snap({ 'a.md': `${BLOCK}   \n`, 'b.md': `${BLOCK.replace(/\n/g, '\r\n')}\n` }),
  );
  assert.equal(same.blocks, 1, '줄 끝 공백·CR 이 다른 블록으로 갈렸다');

  // 들여쓰기는 **축자**다 — 더 정규화하면 「같은 블록인가」가 우리의 해석이 되고, 해석한
  // 동일성은 고객이 검증할 수 없다.
  const indented = readUndeclared(
    snap({ 'a.md': `${BLOCK}\n`, 'b.md': `${BLOCK.split('\n').map((l) => `  ${l}`).join('\n')}\n` }),
  );
  assert.equal(indented.blocks, 0);
});

test('문서 본문을 못 읽었으면 그 수가 적힌다 — 잘림을 0 으로 접지 않는다', () => {
  const facts = readUndeclared(snap({ 'a.md': `${BLOCK}\n`, 'b.md': null, 'c.md': null }));
  assert.deepEqual(facts.documents, { tracked: 3, read: 1 });
  // 읽은 문서 하나에서는 사본이 설 수 없다 — 그 0 은 「사본 없음」이 아니라 부분 수집이고,
  // 그 사실은 위 분모가 든다.
  assert.equal(facts.blocks, 0);
});

test('마크다운이 아닌 파일은 사본의 분모가 아니다', () => {
  const facts = readUndeclared(snap({ 'a.txt': `${BLOCK}\n`, 'b.txt': `${BLOCK}\n` }));
  assert.deepEqual(facts.documents, { tracked: 0, read: 0 });
  assert.equal(facts.blocks, 0);
});

test('상한을 넘으면 잘린 수가 적히고 전수는 그대로다', () => {
  const entries: Record<string, string> = { 'a.md': '', 'b.md': '' };
  const bodies = Array.from({ length: COPY_CAP + 7 }, (_, i) => block(`## 블록 ${i}`));
  entries['a.md'] = `${bodies.join('\n\n')}\n`;
  entries['b.md'] = `${bodies.join('\n\n')}\n`;
  const facts = readUndeclared(snap(entries));
  assert.equal(facts.blocks, bodies.length, '전수가 상한에 깎였다');
  assert.equal(facts.copies.length, COPY_CAP);
  assert.equal(facts.copiesOmitted, bodies.length - COPY_CAP);
});

test('손잡이는 상한에서 잘린다 — 블록 전문은 어느 칸으로도 나가지 않는다', () => {
  const head = `## ${'긴'.repeat(HEAD_MAX + 20)}`;
  const body = block(head);
  const facts = readUndeclared(snap({ 'a.md': `${body}\n`, 'b.md': `${body}\n` }));
  assert.equal(facts.copies[0]!.head.length, HEAD_MAX);
  const serialized = JSON.stringify(facts);
  // 블록의 둘째 줄은 어디에도 없다 — 싣는 것은 첫 줄 하나다.
  assert.ok(!serialized.includes(body.split('\n')[1]!));
});

test('같은 입력은 같은 바이트다 — 정렬이 전순서다', () => {
  // 집 수도 줄 수도 같은 블록 둘 — 손잡이와 파일 목록까지 비교해야 순서가 정해진다.
  const one = block('## 가');
  const two = block('## 나');
  const entries = {
    'a.md': `${one}\n\n${two}\n`,
    'b.md': `${one}\n\n${two}\n`,
  };
  const first = JSON.stringify(readUndeclared(snap(entries)));
  const again = JSON.stringify(readUndeclared(snap({ ...entries })));
  assert.equal(first, again);
});

test('선언할 수 있는 분모는 **어댑터 등록부**가 센다 — 0 건도 참인 답이다', () => {
  const empty = readUndeclared(snap({ 'README.md': 'ok\n' }));
  assert.equal(empty.surfaces.length, VALUE_ADAPTERS.length);
  for (const surface of empty.surfaces) {
    assert.equal(surface.files, 0);
    assert.equal(surface.loaded, 0);
  }
  // 등록부의 id 전부가 줄을 갖는다 — 저장소가 분모를 정하지 않는다.
  assert.deepEqual(
    empty.surfaces.map((s) => s.adapter).sort(),
    [...VALUE_ADAPTERS].map((a) => a.id).sort(),
  );
});

test('본문이 실리지 않은 후보는 `loaded` 에서 빠진다 — 「토큰 0」으로 접히지 않는다', () => {
  const adapter = VALUE_ADAPTERS[0]!;
  const extension = adapter.extensions[0]!;
  const facts = readUndeclared(
    snap({
      [`src/loaded${extension}`]: ':root { --ink: #000; }\n',
      // 추적되는데 본문이 없다 — 무인증 로더가 선언 밖 스타일시트를 싣지 않는 그 평상시다.
      [`src/untracked-content${extension}`]: null,
      'README.md': 'ok\n',
    }),
  );
  const surface = facts.surfaces.find((s) => s.adapter === adapter.id)!;
  assert.equal(surface.files, 2);
  assert.equal(surface.loaded, 1);
});

test('⛔ 이 칸에는 상태도 3상태 수도 점수도 없다', () => {
  const facts = readUndeclared(snap({ 'a.md': `${BLOCK}\n`, 'b.md': `${BLOCK}\n` }));
  const serialized = JSON.stringify(facts);
  for (const forbidden of ['pass', 'violation', 'unjudged', 'status', 'reason', 'score', 'grade', 'percent']) {
    assert.ok(!serialized.includes(forbidden), `선언 0 의 사실에 ${forbidden} 이 있다`);
  }
});

// ── 갈라진 사본 (#119) ─────────────────────────────────────────────────────

/** 손잡이가 되는 줄 — 하한을 **상수에서** 넘긴다(자구를 적지 않는다). */
const anchor = (tag: string): string => `${tag} ${'한 사실의 집이 둘이면 둘 중 하나만 고쳐지는 날 그 둘은 다른 말을 한다.'.repeat(2)}`.slice(0, 200);

/** 겹친 줄 셋 + 갈라진 줄 하나 = 「한 사실의 두 판」. */
const VERSION_A = [anchor('가'), anchor('나'), anchor('다'), '이 줄은 A 에만 있다'].join('\n');
const VERSION_B = [anchor('가'), anchor('나'), anchor('다'), '이 줄은 B 에만 있다'].join('\n');

test('한 줄만 다른 두 블록은 **갈라진 사본 한 쌍**이고, 겹친 줄과 갈라진 줄이 수로 선다', () => {
  const facts = readUndeclared(snap({ 'a.md': `${VERSION_A}\n`, 'docs/b.md': `${VERSION_B}\n` }));
  assert.equal(facts.divergedPairs, 1);
  assert.equal(facts.diverged.length, 1);
  const pair = facts.diverged[0]!;
  assert.deepEqual(pair.files, ['a.md', 'docs/b.md']);
  assert.equal(pair.shared, 3);
  assert.equal(pair.differing, 2); // 양쪽에 하나씩 — 한쪽에만 있는 줄을 **둘 다** 센다
  assert.ok(pair.head.length > 0);
  assert.equal(facts.divergedOmitted, 0);
  assert.equal(facts.divergedTruncated, false);

  // ⛔ 축자 사본의 목록은 비어 있다 — 두 판은 같지 않다.
  assert.equal(facts.blocks, 0);
});

test('축자로 같은 두 블록은 갈라진 사본이 **아니다** — 두 번 세지 않는다', () => {
  const facts = readUndeclared(snap({ 'a.md': `${VERSION_A}\n`, 'b.md': `${VERSION_A}\n` }));
  assert.equal(facts.blocks, 1, '축자 사본으로 서지 않았다');
  assert.equal(facts.divergedPairs, 0, '같은 쌍이 갈라짐으로도 세어졌다');
});

test('겹친 쪽이 다수가 아니면 세지 않는다 — 놓치는 쪽으로 틀린다', () => {
  // 겹친 줄 하나(손잡이) · 갈라진 줄 여섯 — 같은 손잡이를 들었을 뿐 한 사실의 두 판이 아니다.
  const thin = [anchor('가'), 'A1', 'A2', 'A3'].join('\n');
  const other = [anchor('가'), 'B1', 'B2', 'B3'].join('\n');
  const facts = readUndeclared(snap({ 'a.md': `${thin}\n`, 'b.md': `${other}\n` }));
  assert.equal(facts.divergedPairs, 0);
});

test('손잡이가 짧기만 하면 짝이 되지 않는다 — 짧은 줄은 관용구다', () => {
  // 겹치는 줄이 셋이지만 **전부 하한 아래**다 — 그 겹침은 사본의 신호가 아니다.
  const short = ['## 설치', '---', '| a | b |'].join('\n');
  const a = `${short}\n${'가'.repeat(MIN_COPY_CHARS)}`;
  const b = `${short}\n${'나'.repeat(MIN_COPY_CHARS)}`;
  for (const line of short.split('\n')) assert.ok(line.length < ANCHOR_CHARS, line);
  const facts = readUndeclared(snap({ 'a.md': `${a}\n`, 'b.md': `${b}\n` }));
  assert.equal(facts.divergedPairs, 0);
});

test('한 손잡이가 상한을 넘게 서면 그 줄로 짝을 짓지 않는다', () => {
  // 같은 손잡이 하나를 든 블록을 상한보다 **하나 더** 세운다 — 전부 서로 조금씩 다르다.
  const entries: Record<string, string> = {};
  for (let at = 0; at <= ANCHOR_HOMES_MAX; at += 1) {
    entries[`doc${at}.md`] = `${[anchor('가'), anchor('나'), anchor('다'), `이 줄은 ${at} 에만 있다`].join('\n')}\n`;
  }
  const facts = readUndeclared(snap(entries));
  // ⭐ 손잡이 셋이 전부 상한을 넘으므로 짝이 하나도 서지 않는다 — 놓치는 쪽으로 틀린다.
  assert.equal(facts.divergedPairs, 0);

  // 대조군 — 상한 **안**이면 짝이 선다(하네스가 아무것도 못 찾는 게 아니다).
  const fewer: Record<string, string> = {};
  for (let at = 0; at < ANCHOR_HOMES_MAX; at += 1) fewer[`doc${at}.md`] = entries[`doc${at}.md`]!;
  assert.ok(readUndeclared(snap(fewer)).divergedPairs > 0, '상한 안에서도 짝이 서지 않는다');
});

test('한 파일 안의 두 판은 세지 않는다 — 집이 둘이어야 사본이다', () => {
  const facts = readUndeclared(snap({ 'a.md': `${VERSION_A}\n\n${VERSION_B}\n` }));
  assert.equal(facts.divergedPairs, 0);
});

test('같은 입력은 같은 바이트다 — 쌍의 정렬이 전순서다', () => {
  const entries = {
    'a.md': `${VERSION_A}\n`,
    'b.md': `${VERSION_B}\n`,
    'c.md': `${[anchor('가'), anchor('나'), anchor('다'), '이 줄은 C 에만 있다'].join('\n')}\n`,
  };
  const first = JSON.stringify(readUndeclared(snap(entries)).diverged);
  const again = JSON.stringify(readUndeclared(snap({ ...entries })).diverged);
  assert.equal(first, again);
  // 셋이 서로 다른 판이면 쌍은 셋이다 — 쌍이 단위이고 군집으로 접지 않는다.
  assert.equal(readUndeclared(snap(entries)).divergedPairs, 3);
});

test('⛔ 갈라진 사본에도 상태도 비율도 없다', () => {
  const facts = readUndeclared(snap({ 'a.md': `${VERSION_A}\n`, 'docs/b.md': `${VERSION_B}\n` }));
  const serialized = JSON.stringify(facts.diverged);
  for (const forbidden of ['status', 'score', 'ratio', 'percent', 'similarity', 'violation']) {
    assert.ok(!serialized.includes(forbidden), `갈라진 사본에 ${forbidden} 이 있다`);
  }
});

test('석 줄 문단에서 한 줄이 고쳐진 것 — 드리프트의 **평상시 모양**이 걸린다', () => {
  // ⚠️⚠️ 이 모양이 문의 분모였다. 겹침 2 · 고유 1+1 이라, 양쪽 고유의 **합**과 겨루면
  //    동점으로 빠진다 — 실측이 그것을 드러냈고(실제 문서 픽스처가 0 건이었다) 문이
  //    「어느 **한쪽**의 고유한 줄보다 많은가」로 바뀌었다.
  const keep1 = anchor('배포는 태그에서 시작한다');
  const keep2 = anchor('롤백은 직전 태그를 다시 배포하는 것이다');
  const facts = readUndeclared(
    snap({
      'README.md': `${[keep1, anchor('승인 하나로 운영에 나간다'), keep2].join('\n')}\n`,
      'docs/deploy.md': `${[keep1, anchor('승인 둘로 운영에 나간다'), keep2].join('\n')}\n`,
    }),
  );
  assert.equal(facts.divergedPairs, 1, '평상시 모양이 문에서 빠졌다');
  assert.equal(facts.diverged[0]!.shared, 2);
  assert.equal(facts.diverged[0]!.differing, 2);
  assert.equal(facts.blocks, 0, '축자 사본으로도 세어졌다');
});

// ── 쌍을 가족으로 접는다 (#121) ────────────────────────────────────────────

test('집 N 곳에 사는 한 블록은 **가족 하나**로 접히고, 집과 쌍의 수가 남는다', () => {
  const homes = ['a.md', 'b.md', 'docs/c.md', 'docs/d.md'];
  const entries: Record<string, string> = {};
  homes.forEach((file, at) => {
    entries[file] = `${[anchor('가'), anchor('나'), anchor('다'), `이 줄은 ${at} 에만 있다`].join('\n')}\n`;
  });
  const facts = readUndeclared(snap(entries));
  const pairs = (homes.length * (homes.length - 1)) / 2;
  assert.equal(facts.divergedPairs, pairs, '쌍이 C(N,2) 가 아니다 — 하네스가 고장났다');

  const families = foldDiverged(facts.diverged);
  assert.equal(families.length, 1, '같은 손잡이가 가족 하나로 접히지 않았다');
  assert.equal(families[0]!.pairs, pairs);
  // 집은 **합집합**이다 — 쌍마다 둘이던 자리가 그 블록이 사는 자리 전부로 모인다.
  assert.deepEqual(families[0]!.files, [...homes].sort());
});

test('손잡이가 다르면 **다른 가족**이다 — 전이적으로 이어 붙이지 않는다', () => {
  const families = foldDiverged([
    { head: '가', files: ['a.md', 'b.md'], shared: 4, differing: 2 },
    { head: '나', files: ['b.md', 'c.md'], shared: 4, differing: 2 },
  ]);
  assert.equal(families.length, 2);
});

test('수를 잃지 않는다 — 쌍마다 다르면 범위로, 같으면 한 수로 남는다', () => {
  const same = foldDiverged([
    { head: '가', files: ['a.md', 'b.md'], shared: 4, differing: 2 },
    { head: '가', files: ['a.md', 'c.md'], shared: 4, differing: 2 },
  ]);
  assert.deepEqual(same[0]!.shared, { from: 4, to: 4 });
  assert.deepEqual(same[0]!.differing, { from: 2, to: 2 });

  const varied = foldDiverged([
    { head: '가', files: ['a.md', 'b.md'], shared: 4, differing: 2 },
    { head: '가', files: ['a.md', 'c.md'], shared: 7, differing: 9 },
    { head: '가', files: ['b.md', 'c.md'], shared: 5, differing: 3 },
  ]);
  assert.deepEqual(varied[0]!.shared, { from: 4, to: 7 });
  assert.deepEqual(varied[0]!.differing, { from: 2, to: 9 });
  assert.equal(varied[0]!.pairs, 3);
  assert.deepEqual(varied[0]!.files, ['a.md', 'b.md', 'c.md']);
});

test('접는 것은 **파생**이다 — 봉투의 쌍은 그대로 남는다', () => {
  const homes = ['a.md', 'b.md', 'c.md'];
  const entries: Record<string, string> = {};
  homes.forEach((file, at) => {
    entries[file] = `${[anchor('가'), anchor('나'), anchor('다'), `이 줄은 ${at} 에만 있다`].join('\n')}\n`;
  });
  const facts = readUndeclared(snap(entries));
  // ⭕ 상한도 잘린 수도 여전히 **쌍**에 걸린다 — 접었다고 그 뜻이 바뀌지 않는다.
  assert.equal(facts.diverged.length, facts.divergedPairs);
  assert.equal(facts.divergedOmitted, 0);
  assert.equal(foldDiverged(facts.diverged).length, 1);
});

test('빈 목록은 빈 가족이다 — 없는 것을 지어내지 않는다', () => {
  assert.deepEqual(foldDiverged([]), []);
});

test('⛔ 가족에도 상태도 비율도 없다', () => {
  const serialized = JSON.stringify(
    foldDiverged([{ head: '가', files: ['a.md', 'b.md'], shared: 4, differing: 2 }]),
  );
  for (const forbidden of ['status', 'score', 'ratio', 'percent', 'similarity', 'violation']) {
    assert.ok(!serialized.includes(forbidden), `가족에 ${forbidden} 이 있다`);
  }
});
