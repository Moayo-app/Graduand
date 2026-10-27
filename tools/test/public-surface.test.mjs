// 공개 표면 가드 — 기여 안내가 비공개 쪽을 가리키지 않는다는 단정을 기계로 고정한다.
// 가드의 본체는 tools/lib/public-surface.mjs. 양성(실제 트리가 깨끗하다)과
// negative(누설을 심으면 운다)를 한 파일에 둔다 — 모집단이 한 벌이라 쪼갤 이유가 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PUBLIC_PROSE, checkProseLeaks, checkPublicProse, checkWorkshopName } from '../lib/public-surface.mjs';
import { walkFiles } from '../lib/public-scope.mjs';

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
    `작업장은 ${['Example', '_dev'].join('')} 다.`,
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

/* ──── 비공개 작업장의 이름 — 분모가 저장소 전수인 한 모양 ──── */

test('⭕ 저장소 전수에 비공개 작업장의 이름이 0 이다', () => {
  assert.deepEqual(checkWorkshopName(ROOT, walkFiles(ROOT)), []);
});

test('⭐ 분모가 전수다 — 세션 부트스트랩도 든다(그 면제가 공개 전환에서 깨졌다)', () => {
  const files = walkFiles(ROOT);
  assert.ok(files.includes('CLAUDE.md'), 'CLAUDE.md 가 분모 밖이면 찾은 그 구멍이 그대로다');
  assert.ok(files.length > PUBLIC_PROSE.length, '전수가 좁은 모집단보다 넓다');
});

/**
 * 심는 이름 — ⚠️ **리터럴로 적지 않는다.** 분모가 저장소 전수라 **이 파일도 분모**이고,
 * 그대로 적으면 가드가 자기 통제를 누설로 잡는다. 쪼개서 잇는 것은 이 저장소의 기존
 * 관행이다(금칙 목록이 사명과 티켓 모양을 같은 꼴로 적는다).
 */
const PLANTED = ['Example', '_dev'].join('');

test('negative: 어느 파일에 심어도 빨갛다 — 면제가 없다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-workshop-'));
  for (const rel of ['CLAUDE.md', 'docs/agents/design.md', 'config/public-scope.yml']) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), '비공개 작업장이라고만 적는다.\n');
  }
  const files = ['CLAUDE.md', 'docs/agents/design.md', 'config/public-scope.yml'];
  assert.deepEqual(checkWorkshopName(root, files), [], '심기 전의 사본은 초록이다');

  for (const rel of files) {
    fs.appendFileSync(path.join(root, rel), `작업장은 ${PLANTED} 다.\n`);
    const errors = checkWorkshopName(root, files);
    assert.ok(errors.some((e) => e.startsWith(`${rel}:`)), `${rel}: 심었는데 조용하다`);
    assert.ok(errors.some((e) => e.includes(PLANTED)), '이름을 지목하지 않는다');
    fs.writeFileSync(path.join(root, rel), '비공개 작업장이라고만 적는다.\n');
  }
});
