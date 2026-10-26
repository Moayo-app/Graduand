import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssCustomProperties } from './css-custom-properties.ts';

const read = (text: string, path = 'tokens.css') => cssCustomProperties.read([{ path, text }]);

test('읽기마다 이름·값·스코프·파일·행을 든다', () => {
  const r = read(':root {\n  --paper: #F6F5F2;\n  --ink: #23263A;\n}\n');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens, [
    { name: '--paper', value: '#F6F5F2', scope: ':root', file: 'tokens.css', line: 2 },
    { name: '--ink', value: '#23263A', scope: ':root', file: 'tokens.css', line: 3 },
  ]);
});

test('값 정규화 — #abc 는 #AABBCC 로, hex 아닌 값은 공백만 접는다', () => {
  assert.equal(cssCustomProperties.normalize('#abc'), '#AABBCC');
  assert.equal(cssCustomProperties.normalize('  #f6f5f2 '), '#F6F5F2');
  assert.equal(cssCustomProperties.normalize('oklch(96%  0.01   95)'), 'oklch(96% 0.01 95)');
  const r = read(':root { --a: #abc; --b: var(--x); }');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens.map((t) => t.value), ['#AABBCC', 'var(--x)']);
});

test('스코프가 판정의 일부다 — :root 와 .dark 가 다른 스코프로 읽힌다', () => {
  const r = read(':root {\n  --ink: #111111;\n}\n.dark {\n  --ink: #EEEEEE;\n}\n');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens.map((t) => [t.scope, t.line]), [[':root', 2], ['.dark', 5]]);
});

test('Tailwind v4 — 최상위 @theme(변형 포함)는 선언이 직접 사는 블록이다', () => {
  const r = read('@theme {\n  --color-paper: #F6F5F2;\n}\n@theme inline {\n  --color-ink: #23263A;\n}\n');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens.map((t) => t.scope), ['@theme', '@theme inline']);
});

test('@media 1단 아래의 셀렉터까지 읽고, 스코프 문자열이 중첩을 말한다', () => {
  const r = read('@media (prefers-color-scheme: dark) {\n  :root {\n    --ink: #EEEEEE;\n  }\n}\n');
  assert.ok(r.ok);
  assert.equal(r.tokens[0]!.scope, '@media (prefers-color-scheme: dark) > :root');
});

test('주석은 소거하되 행 번호는 보존한다 — 행이 증거다', () => {
  const r = read('/* 머리말\n   여러 줄 */\n:root {\n  --ink: #111111; /* --fake: #000; */\n}\n');
  assert.ok(r.ok);
  assert.deepEqual(r.tokens.map((t) => [t.name, t.line]), [['--ink', 4]]);
});

test('파싱 실패는 결과의 한 갈래다 — 모르는 중첩은 조용한 통과가 아니다', () => {
  const r = read('@supports (color: oklch(0 0 0)) {\n  @media (min-width: 0px) {\n    :root { --paper: #FFFFFF; }\n  }\n}\n');
  assert.ok(!r.ok);
  assert.ok(r.message.includes('line 3'));
  assert.equal(r.file, 'tokens.css');
});

test('부분집합의 경계들 — 블록 밖 선언 · 여러 줄 선언 · 괄호 불균형 · 안 닫힌 블록', () => {
  assert.ok(!read('--loose: #fff;\n').ok);
  assert.ok(!read(':root {\n  --ink:\n    #111111;\n}\n').ok);
  assert.ok(!read('}\n').ok);
  assert.ok(!read(':root {\n  --ink: #111111;\n').ok);
});

test('토큰 0건은 깨끗한 파일이 아니라 형식이 움직였다는 신호다', () => {
  const r = read('body { color: red; }\n');
  assert.ok(!r.ok);
  assert.ok(r.message.includes('zero'));
});

test('여러 파일을 이어 읽고, 실패는 파일 이름을 든다', () => {
  const ok = cssCustomProperties.read([
    { path: 'a.css', text: ':root { --a: #111111; }' },
    { path: 'b.css', text: ':root { --b: #222222; }' },
  ]);
  assert.ok(ok.ok);
  assert.deepEqual(ok.tokens.map((t) => t.file), ['a.css', 'b.css']);

  const bad = cssCustomProperties.read([
    { path: 'a.css', text: ':root { --a: #111111; }' },
    { path: 'b.css', text: 'not css at all' },
  ]);
  assert.ok(!bad.ok);
  assert.equal(bad.file, 'b.css');
});
