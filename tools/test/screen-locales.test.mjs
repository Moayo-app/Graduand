// 화면 로케일 분모 가드 — 양성 + negative (작업장 쪽 AC2·AC3).
// 가드의 본체는 tools/lib/screen-locales.mjs, 분모의 정본은 config/allowed-countries.yml 이다.
//
// ⚠️ negative 가 양성보다 많다. AC3 이 요구하는 것이 「**빨갛다**」라서, 실제 트리가 초록인
// 것만으로는 아무것도 검증되지 않는다 — 분모가 비어도 초록이기 때문이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MASTER_LOCALE, docLocales } from '../lib/policy.mjs';
import { SCREEN_CATALOG, screenLocales, checkScreenLocales } from '../lib/screen-locales.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const hits = (errors, needle) => errors.filter((e) => e.includes(needle));

/** 실제 트리의 사본 — 위반을 심는 자리. ⭐ 사본마다 경로가 달라 import 캐시가 섞이지 않는다. */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-screen-'));
  fs.cpSync(ROOT, root, { recursive: true, filter: (src) => !/(^|[/\\])(\.git|node_modules|dist)$/.test(src) });
  return root;
}
const rewrite = (root, rel, fn) => {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  assert.notEqual(after, before, `${rel}: 심을 자리를 찾았다 — 바뀐 것이 없으면 이 통제는 아무것도 심지 않는다`);
  fs.writeFileSync(file, after);
};
/** 개방 목록에 나라 한 줄 — AC3 이 재는 그 PR 의 모양이다. */
const openCountry = (root, code, locale) =>
  rewrite(root, 'config/allowed-countries.yml', (s) => `${s.trimEnd()}\n  - code: ${code}\n    doc_locale: ${locale}\n    basis: "통제가 심은 행"\n`);

test('AC2: 화면의 로케일 집합이 개방 목록이 유도한 분모와 같다', async () => {
  assert.deepEqual(await checkScreenLocales(ROOT), []);
});

test('AC2: 분모를 테스트가 적지 않는다 — 양쪽 다 유도되고, 비어 있지 않다', async () => {
  const open = docLocales(ROOT);
  const { locales, shipped } = await screenLocales(ROOT);
  assert.ok(open.length > 0 && locales.length > 0, '한쪽이 비면 「같다」는 공짜로 참이다');
  assert.deepEqual([...locales].sort(), [...open].sort());
  assert.deepEqual([...shipped].sort(), [...open].sort(), '열거만이 아니라 **출하된 벌**도 같은 분모다');
  assert.equal(locales[0], MASTER_LOCALE, '정본이 첫 자리다 — docLocales 와 같은 규율');
});

test('AC3 (negative): ⭐ 개방 목록에 로케일을 더하고 벌을 안 만들면 **빨갛다**', async () => {
  const root = cloneRoot();
  openCountry(root, 'JP', 'ja');
  const errors = await checkScreenLocales(root);
  assert.equal(hits(errors, '「ja」').length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('그 말을 못 한다'), errors[0]);
});

test('AC3 (negative): 같은 로케일을 쓰는 나라를 더하는 것은 **초록이다** — 분모는 나라가 아니라 로케일이다', async () => {
  const root = cloneRoot();
  openCountry(root, 'GB', 'en');
  assert.deepEqual(await checkScreenLocales(root), [], '로케일이 늘지 않았는데 빨개지면 가드가 나라를 세고 있는 것이다');
});

test('AC2 (negative): 반대 방향도 운다 — 닫힌 나라의 벌이 출하되는 자리', async () => {
  const root = cloneRoot();
  rewrite(root, 'config/allowed-countries.yml', (s) => s.replace(/  - code: US\n(?:    [^\n]*\n)+/, ''));
  const errors = await checkScreenLocales(root);
  assert.ok(hits(errors, '「en」').length >= 1, errors.join(' · '));
  assert.ok(errors.some((e) => e.includes('닫힌 나라의 벌이 출하된다')), errors.join(' · '));
});

test('AC2 (negative): 열거에만 있고 벌이 없는 로케일도 운다 — 약속만 남은 자리', async () => {
  const root = cloneRoot();
  openCountry(root, 'JP', 'ja');
  rewrite(root, SCREEN_CATALOG, (s) => s.replace("export const LOCALES = ['ko', 'en'] as const;", "export const LOCALES = ['ko', 'en', 'ja'] as const;"));
  const errors = await checkScreenLocales(root);
  assert.ok(errors.some((e) => e.includes('벌이 없다')), errors.join(' · '));
  assert.equal(hits(errors, '그 말을 못 한다').length, 0, '열거에 넣었으므로 개방 목록 쪽 방향은 조용해야 한다');
});

test('AC2 (negative): ⚠️⚠️ 카탈로그를 못 읽으면 **던진다** — 분모 0 으로 초록이 되지 않는다', async () => {
  const root = cloneRoot();
  rewrite(root, SCREEN_CATALOG, (s) => s.replace("export const LOCALES = ['ko', 'en'] as const;", 'export const LOCALES = [] as const;'));
  await assert.rejects(() => checkScreenLocales(root), /LOCALES 가 비었거나/);
});

test('AC2 (negative): 정본이 첫 자리에서 밀리면 운다 — 두 곳이 「첫 벌이 정본」을 같은 뜻으로 쓴다', async () => {
  const root = cloneRoot();
  rewrite(root, SCREEN_CATALOG, (s) => s.replace("export const LOCALES = ['ko', 'en'] as const;", "export const LOCALES = ['en', 'ko'] as const;"));
  assert.ok((await checkScreenLocales(root)).some((e) => e.includes('첫 자리')), '순서가 뒤집혔는데 조용하다');
});

test('⚠️ 사본은 심기 전에 초록이다 — 통제가 사본 자체의 결함을 잡고 있지 않다', async () => {
  assert.deepEqual(await checkScreenLocales(cloneRoot()), []);
});
