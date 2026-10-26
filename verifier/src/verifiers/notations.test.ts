import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extract } from './notations.ts';

const refsOf = (text: string) => extract('doc.md', text).map((r) => `${r.notation}:${r.raw}`);

test('네 표기를 전부 수집한다', () => {
  assert.deepEqual(refsOf('[t](docs/a.md) and [[guide]] and [issue-note-draft] and `src/x.ts:10`'), [
    'wiki:guide',
    'markdown-link:docs/a.md',
    'bare-bracket:issue-note-draft',
    'backtick-path:src/x.ts:10',
  ]);
});

test('스킴 · 자리표시자 · 글롭 · 앵커는 대상이 아니다', () => {
  assert.deepEqual(refsOf('[a](https://x.y) [b](mailto:p@q) [c]({domain}/x) [d](<repo>/x) [e](issues/*.md) [f](#anchor)'), []);
});

test('스킴 문자셋에 . 이 없다 — 파일:줄 인용은 스킴이 아니다', () => {
  assert.deepEqual(refsOf('[t](nope.ts:10)'), ['markdown-link:nope.ts:10']);
});

test('코드 펜스 안과 인라인 코드 스팬 안은 참조가 아니다', () => {
  const text = ['```', '[t](inside/fence.md)', '```', 'mention of `[[wiki]]` syntax', '[real](docs/a.md)'].join('\n');
  assert.deepEqual(refsOf(text), ['markdown-link:docs/a.md']);
});

test('마스킹 순서 — [[x]] 는 [x] 로, [t](u) 는 [t] 로 이중 집계되지 않는다', () => {
  const out = refsOf('[[one-two-three]] [four-five-six](docs/a.md)');
  assert.deepEqual(out, ['wiki:one-two-three', 'markdown-link:docs/a.md']);
});

test('bare-bracket 은 이름 형태만 — 날짜·티켓 태그·대문자는 세지 않는다', () => {
  assert.deepEqual(refsOf('[2026-04-05] [TICKET-42] [A-B-C] [ok] [real-name-token]'), ['bare-bracket:real-name-token']);
});

test('백틱 경로는 / 와 확장자를 요구한다 — 그냥 코드는 세지 않는다', () => {
  assert.deepEqual(refsOf('`foo` `a/b` `cmd --flag` `docs/file.md` `src/a.ts:1-9`'), [
    'backtick-path:docs/file.md',
    'backtick-path:src/a.ts:1-9',
  ]);
});
