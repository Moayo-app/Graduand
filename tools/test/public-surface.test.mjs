// 공개 표면 가드 — 기여 안내가 비공개 쪽을 가리키지 않는다는 단정을 기계로 고정한다.
// 가드의 본체는 tools/lib/public-surface.mjs. 양성(실제 트리가 깨끗하다)과
// negative(누설을 심으면 운다)를 한 파일에 둔다 — 모집단이 한 벌이라 쪼갤 이유가 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PUBLIC_PROSE, checkProseLeaks, checkPublicProse } from '../lib/public-surface.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');

test('양성: 공개 산문 전수에 누설이 0건이다', () => {
  assert.deepEqual(checkPublicProse(ROOT), []);
});

test('양성: 기여 안내가 선다 — 공개 생성물의 머리말이 가리키는 루트 경로다', () => {
  assert.ok(PUBLIC_PROSE.includes('CONTRIBUTING.md'));
  const text = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
  assert.match(text, /받지 않습니다/, 'PR 을 받지 않는다고 적는다');
  assert.match(text, /정본이 둘/, '그 이유(정본이 둘이 된다)를 함께 적는다');
  assert.match(text, /이슈는 환영/, '이슈는 환영한다고 적는다');
});

test('negative: 누설을 심으면 그 문면을 지목한다 — 모양 일곱 가지', () => {
  const planted = [
    '작업장은 Example_dev 다.',
    '정본은 example-hq 에 산다.',
    '템플릿은 Example-Platform 쪽이다.',
    '근거는 ADR-4 다.',
    '티켓은 ISSUE-249 다.',
    '자세한 것은 Example-app/example#241 을 보라.',
    '라이선스는 #23 이 세운다.',
  ];
  for (const line of planted) assert.equal(checkProseLeaks(line).length, 1, `심은 누설이 1건으로 잡힌다: ${line}`);
});

test('negative: 모집단 파일이 사라지면 운다 — 머리말이 가리킬 대상이 없어진다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-public-'));
  assert.equal(checkPublicProse(root).length, 1);
  assert.match(checkPublicProse(root)[0], /없는 문서/);
});

test('negative: 사본에 누설을 심으면 양성 경로가 빨갛다 — 심기 전은 초록이었다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-public-'));
  fs.copyFileSync(path.join(ROOT, 'CONTRIBUTING.md'), path.join(root, 'CONTRIBUTING.md'));
  assert.deepEqual(checkPublicProse(root), [], '심기 전의 사본은 초록이다');
  fs.appendFileSync(path.join(root, 'CONTRIBUTING.md'), '\n정본은 example-hq 에 있다.\n');
  assert.equal(checkPublicProse(root).length, 1);
});
