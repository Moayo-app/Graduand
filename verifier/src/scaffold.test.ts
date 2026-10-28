/**
 * 스캐폴드의 순수층 — 담는 내용 · 덮어쓰지 않는 규율 · 말하는 것.
 *
 * 파일시스템은 여기 없다(가짜 io 를 넣는다) — 실제로 파일을 쓰는 경로와 git 을
 * 건드리지 않는다는 단정은 `ac.test.ts` 가 CLI 를 돌려서 받는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCAFFOLD_DECLARATION,
  SCAFFOLD_JSON,
  formatInitOutcome,
  initDeclaration,
  writeExitCode,
  type DeclarationWrite,
  type ScaffoldIo,
} from './scaffold.ts';
import { DECLARATION_FILE, AXIS_KEYS, TOP_KEYS, validateDeclaration } from './declaration.ts';
import { VERIFIER_IDS } from './verifiers/registry.ts';
import { judgeSnapshot } from './judge.ts';
import type { RepoSnapshot } from './snapshot.ts';

/** 기록하는 가짜 호스트 — 「쓰지 않았다」를 쓰기 횟수로 단정한다. */
function fakeIo(present: string[] = []): ScaffoldIo & { written: { path: string; text: string }[] } {
  const files = new Set(present);
  const written: { path: string; text: string }[] = [];
  return {
    written,
    pathIn: (root) => `${root}/${DECLARATION_FILE}`,
    exists: (path) => files.has(path),
    write: (path, text) => {
      written.push({ path, text });
      files.add(path);
    },
  };
}

const snapshotWith = (files: Record<string, string>): RepoSnapshot => ({
  repo: 'acme/widgets',
  commit: 'a'.repeat(40),
  paths: Object.keys(files).sort(),
  files: new Map(Object.entries(files)),
});

test('스캐폴드는 지금 스키마의 검증을 통과한다', () => {
  const result = validateDeclaration(SCAFFOLD_JSON);
  assert.equal(result.state, 'valid');
  assert.deepEqual(result.state === 'valid' ? result.admissions : null, {});
  // 나머지 셋은 **미선언**이다 — 빈 값이 아니라 키 부재여야 미판정으로 남는다.
  assert.equal(result.state === 'valid' ? result.ui : 'x', null);
  assert.equal(result.state === 'valid' ? result.sharedValues : 'x', null);
  assert.equal(result.state === 'valid' ? result.exemptions : 'x', null);
});

test('스캐폴드는 비어 있다 — 도메인 규칙 0 · 켜는 판정기 0', () => {
  // ⭐ 예시 헌법(도메인 규칙이 든 견본)은 범위 밖이다 — 트리거는 1호 고객 접촉이다.
  assert.deepEqual(SCAFFOLD_DECLARATION.admissions, {});
  assert.deepEqual(Object.keys(SCAFFOLD_DECLARATION), ['admissions']);
  // 개정 2 에서 판정기 선택은 `admissions.<규칙 id>.verifiers` 아래 산다 — 규칙 id 가
  // 없으면 켤 자리가 없다. 그래서 스캐폴드에는 판정기 이름이 하나도 없다.
  for (const id of VERIFIER_IDS) {
    assert.ok(!SCAFFOLD_JSON.includes(id), `스캐폴드가 판정기를 켠다: ${id}`);
  }
});

test('스캐폴드를 둔 저장소는 선언 구동 축이 전부 미판정이고 선언 부재와 같은 수를 낸다', () => {
  const withScaffold = judgeSnapshot(snapshotWith({ 'README.md': 'ok\n', [DECLARATION_FILE]: SCAFFOLD_JSON }));
  const withoutDeclaration = judgeSnapshot(snapshotWith({ 'README.md': 'ok\n' }));

  // `refs` 는 선언 0 으로 도는 축이다(판정의 분모가 선언이 아니다) — 여기서 빠진다.
  const declarationDriven = (id: string): boolean => id !== 'refs';
  for (const check of withScaffold.checks.filter((c) => declarationDriven(c.id))) {
    assert.equal(check.status, 'unjudged', `${check.id} 가 미판정이 아니다`);
    assert.equal(check.reason, 'no-declaration');
  }
  assert.equal(withScaffold.checks.filter((c) => c.status === 'violation').length, 0);
  // 빈 선언과 선언 부재는 같은 판정을 낸다 — 빈 상태는 결함이 아니라 미판정이다.
  assert.deepEqual(
    withScaffold.checks.map((c) => [c.id, c.status, c.reason]),
    withoutDeclaration.checks.map((c) => [c.id, c.status, c.reason]),
  );
});

test('init — 선언이 없으면 스캐폴드를 그 바이트 그대로 쓴다', () => {
  const io = fakeIo();
  const outcome = initDeclaration('repo', io);
  assert.deepEqual(outcome, { kind: 'written', path: `repo/${DECLARATION_FILE}` });
  assert.deepEqual(io.written, [{ path: `repo/${DECLARATION_FILE}`, text: SCAFFOLD_JSON }]);
  assert.equal(writeExitCode(outcome), 0);
});

test('init — 선언이 이미 있으면 덮어쓰지 않고 그 사실을 말한다 (쓰기 0 건)', () => {
  const io = fakeIo([`repo/${DECLARATION_FILE}`]);
  const outcome = initDeclaration('repo', io);
  assert.equal(outcome.kind, 'already-declared');
  assert.deepEqual(io.written, []); // ⛔ 한 글자도 쓰지 않았다
  assert.equal(writeExitCode(outcome), 2); // 한 일이 없으면 초록으로 끝나지 않는다

  const said = formatInitOutcome(outcome);
  assert.deepEqual(said.stdout, []);
  assert.ok(said.stderr.some((l) => l.includes(DECLARATION_FILE) && l.includes('덮어쓰지 않았다')));
});

test('init — 쓰지 못하면 썼다고 말하지 않는다', () => {
  const io = fakeIo();
  io.write = () => {
    throw new Error('EACCES: permission denied');
  };
  const outcome = initDeclaration('repo', io);
  assert.equal(outcome.kind, 'write-failed');
  assert.equal(writeExitCode(outcome), 2);
  assert.ok(formatInitOutcome(outcome).stderr.some((l) => l.includes('EACCES')));
});

test('init 이 말하는 것 — 쓴 자리 · 커밋하지 않았다는 사실 · 빈 분모가 정당하다는 사실', () => {
  const said = formatInitOutcome({ kind: 'written', path: `repo/${DECLARATION_FILE}` } satisfies DeclarationWrite);
  const text = said.stdout.join('\n');
  assert.deepEqual(said.stderr, []);
  assert.ok(text.includes(`repo/${DECLARATION_FILE}`));
  assert.match(text, /커밋하지도 스테이징하지도 않았다/);
  assert.match(text, /미판정/);
});

test('안내문은 스키마에서 읽는다 — 산문에 박은 사본이 0 이다', () => {
  // ⚠️ 키 목록·판정기 목록의 정본은 `declaration.ts` 와 등록부다. 안내문이 사본을 들면
  // 스키마가 움직이는 날 거짓이 되므로, 전수가 그 목록에서 나왔는지 여기서 받는다.
  const text = formatInitOutcome({ kind: 'written', path: DECLARATION_FILE }).stdout.join('\n');
  for (const key of [...TOP_KEYS, ...AXIS_KEYS, ...VERIFIER_IDS]) {
    assert.ok(text.includes(key), `안내문이 ${key} 를 말하지 않는다`);
  }
  assert.ok(text.includes(String(TOP_KEYS.length)) && text.includes(String(AXIS_KEYS.length)));
});
