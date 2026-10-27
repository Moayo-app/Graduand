// negative 경로 — AC3·AC4·AC5·AC6 는 전부 「가드가 빨갛다」를 요구하므로,
// 실제 트리가 초록인 것만으로는 검증되지 않는다. 사본 트리에 위반을 심고 가드가 우는 것을 잰다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkPopulation,
  checkVendor,
  checkLegalName,
  checkMeta,
  checkTranslationSync,
  checkPriorityClause,
  checkPriceFigures,
  checkRefundAbsolutes,
  checkCanon,
  docLocales,
  parsePolicyMeta,
  loadStrings,
} from '../lib/policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** 실제 트리의 사본 — 위반을 심는 자리. 테스트 러너의 임시 디렉터리라 뒷정리는 OS 몫이다. */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-guards-'));
  fs.cpSync(path.join(ROOT, 'config'), path.join(root, 'config'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'docs/policies'), path.join(root, 'docs/policies'), { recursive: true });
  return root;
}
const append = (root, rel, text) => fs.appendFileSync(path.join(root, rel), text);
const rewrite = (root, rel, fn) => fs.writeFileSync(path.join(root, rel), fn(fs.readFileSync(path.join(root, rel), 'utf8')));
const hits = (errors, needle) => errors.filter((e) => e.includes(needle));

test('AC3 (negative): 「환불 불가」 단정을 심으면 가드가 그 문면을 지목한다', () => {
  const root = cloneRoot();
  append(root, 'docs/policies/refund.md', '\n연 구독은 14일이 지나면 환불 불가.\n');
  assert.equal(hits(checkRefundAbsolutes(root), '환불 불가').length, 1);
});

test('AC3 (negative): en 의 단정(non-refundable)도 같은 가드가 잡는다 — 대소문자 무시', () => {
  const root = cloneRoot();
  append(root, 'docs/policies/locales/en/refund.md', '\nMonthly plans are Non-Refundable.\n');
  assert.equal(hits(checkRefundAbsolutes(root), 'non-refundable').length, 1);
});

test('AC4 (negative): 가격 숫자($)를 심으면 빨갛다 — 심기 전의 14일은 초록이었다', () => {
  const root = cloneRoot();
  assert.deepEqual(checkPriceFigures(root), [], '위반을 심기 전의 사본은 초록이다');
  append(root, 'docs/policies/terms.md', '\n구독의 가격은 저장소당 월 $15 입니다.\n');
  assert.ok(hits(checkPriceFigures(root), '$15').length >= 1);
});

test('AC4 (negative): 통화 낱말(USD)로 적어도 잡는다', () => {
  const root = cloneRoot();
  append(root, 'docs/policies/locales/en/terms.md', '\nThe price is 15 USD per repository.\n');
  assert.ok(checkPriceFigures(root).length >= 1);
});

test('AC5 (negative): ko 정본만 고친 PR 은 번역판의 정본 해시 가드가 빨갛다', () => {
  const root = cloneRoot();
  assert.deepEqual(checkTranslationSync(root), [], '고치기 전에는 해시가 맞는다');
  append(root, 'docs/policies/terms.md', '\n제12조 (신설) 새 조문입니다.\n');
  const errors = checkTranslationSync(root);
  assert.equal(hits(errors, 'en/terms').length, 1);
  assert.match(errors[0], /재전파/, '오류 문면이 고칠 길(재전파·스탬프 갱신)을 가리킨다');
});

test('AC5 (negative): 선언표에서 행을 지우면 그 파일이 「선언 없는 정본」으로 잡힌다', () => {
  const root = cloneRoot();
  rewrite(root, 'docs/policies/canon.md', (s) => s.split('\n').filter((l) => !l.includes('config/allowed-countries.yml')).join('\n'));
  assert.ok(hits(checkCanon(root), 'config/allowed-countries.yml').length >= 1);
});

test('AC6 (negative): locales/ko/ 를 만드는 PR 은 가드가 막는다 — ko 정본은 루트다', () => {
  const root = cloneRoot();
  fs.mkdirSync(path.join(root, 'docs/policies/locales/ko'));
  fs.copyFileSync(path.join(root, 'docs/policies/terms.md'), path.join(root, 'docs/policies/locales/ko/terms.md'));
  const errors = checkPopulation(root);
  assert.ok(hits(errors, 'locales/ko').length >= 1);
  assert.ok(hits(errors, 'AC6').length >= 1, '전용 문면(AC6)으로 운다');
});

test('G2 (negative): 모집단 밖의 고아 파일이 생기면 잡힌다', () => {
  const root = cloneRoot();
  fs.writeFileSync(path.join(root, 'docs/policies/locales/en/extra.md'), '# 고아\n');
  assert.ok(hits(checkPopulation(root), '고아 파일').length >= 1);
});

test('G5 (negative): 옛 벤더가 한 로케일에만 남아도 운다', () => {
  const root = cloneRoot();
  rewrite(root, 'docs/policies/locales/en/refund.md', (s) => s.replaceAll('Polar', 'Paddle'));
  const errors = checkVendor(root);
  assert.ok(hits(errors, '옛 벤더(Paddle)').length >= 1, '옛 이름이 남았다');
  assert.ok(hits(errors, 'Polar').length >= 1, '현 이름을 말하지 않는다');
});

test('G6 (negative): 법인명을 산문에 박으면 운다 — 벤더가 바뀌면 산문이 흔들린다', () => {
  const root = cloneRoot();
  append(root, 'docs/policies/privacy.md', '\n판매자는 Polar Software, Inc. 입니다.\n');
  assert.ok(hits(checkLegalName(root), '표 밖에서').length >= 1);
});

test('G7 (negative): 번역판에 기계 줄(버전:)을 넣으면 운다 — 메타의 출처는 ko 하나다', () => {
  const root = cloneRoot();
  rewrite(root, 'docs/policies/locales/en/terms.md', (s) => s.replace('<!--', '<!--\n버전: 9.9'));
  assert.ok(hits(checkMeta(root), '기계 줄').length >= 1);
});

test('G9 (negative): 우선 조항을 걷어낸 번역판은 운다', () => {
  const root = cloneRoot();
  rewrite(root, 'docs/policies/locales/en/privacy.md', (s) =>
    s.replace('The official version of this document is the Korean version.', ''),
  );
  assert.ok(hits(checkPriorityClause(root), 'en/privacy').length >= 1);
});

/**
 * ⭐⭐ G7 (버전) — 판번호가 사는 자리가 둘이고, **머리말은 발행본에서 걷힌다.** 그래서
 * 둘이 갈라지면 **공개되는 쪽만 틀린다** — 기계는 새 번호를, 방문자는 옛 번호를 본다.
 * 아래 셋이 그 세 방향을 각각 막는다: 머리말만 올림 · 본문만 올림 · 핀 결손.
 */
/** 지금 판번호 — ⛔ 테스트에 수를 적지 않는다. 판이 올라가도 이 대조군이 따라 움직인다. */
const versionOf = (root, kind) =>
  parsePolicyMeta(fs.readFileSync(path.join(root, `docs/policies/${kind}.md`), 'utf8'), kind).version;

/** 자리만 다른 다른 수 — 「1.0.0」 → 「9.0.0」 처럼 첫 마디만 바꾼다. */
const bump = (version) => version.replace(/^[0-9]+/, (n) => String(Number(n) + 8));

test('G7 (negative): 머리말 판번호만 올리면 전 로케일 본문이 지목된다', () => {
  const root = cloneRoot();
  const now = versionOf(root, 'terms');
  rewrite(root, 'docs/policies/terms.md', (t) => t.replace(`버전: ${now}`, `버전: ${bump(now)}`));
  const errors = hits(checkMeta(root), '본문 판번호');
  // ⛔ 수를 적지 않는다 — 분모는 로케일이고, 한 로케일만 울면 나머지는 조용히 통과한 것이다.
  const locales = docLocales(root);
  assert.deepEqual(
    errors.map((e) => e.split('/')[0]).sort(),
    [...locales].sort(),
    '머리말을 올렸는데 울지 않은 로케일이 있다 — 그 독자에게는 문서가 거짓이다',
  );
});

test('G7 (negative): 본문 판번호만 올려도 같은 가드가 운다 — 반대 방향', () => {
  const root = cloneRoot();
  const now = versionOf(root, 'refund');
  const label = loadStrings(root).required.version_label.ko;
  rewrite(root, 'docs/policies/refund.md', (t) => t.replace(`${label} ${now}`, `${label} ${bump(now)}`));
  assert.equal(hits(checkMeta(root), 'ko/refund').filter((e) => e.includes(bump(now))).length, 1);
});

test('G7 (negative): 본문에서 판번호를 지우면 「없다」로 지목된다', () => {
  const root = cloneRoot();
  const now = versionOf(root, 'terms');
  const label = loadStrings(root).required.version_label.en;
  rewrite(root, 'docs/policies/locales/en/terms.md', (t) => t.replaceAll(`${label} ${now}`, label));
  assert.equal(hits(checkMeta(root), 'en/terms').filter((e) => e.includes('판번호')).length, 1);
});

/**
 * ⭐ 발행일도 시행일과 **같은 모양**으로 묶인다 — 핀이 빠지거나 본문이 그 상태를 말하지
 * 않으면 빨갛다. ⚠️ 그리고 효력이 게시보다 먼저 시작될 수 없다(변경 고지 조항의 순서다).
 */
test('G7 (negative): 발행일 상태를 본문이 말하지 않으면 지목된다', () => {
  const root = cloneRoot();
  const pin = loadStrings(root).required.published_unset.ko;
  rewrite(root, 'docs/policies/privacy.md', (t) => t.replace(pin, '발행일은 적지 않습니다'));
  assert.equal(hits(checkMeta(root), 'ko/privacy').filter((e) => e.includes('발행일')).length, 1);
});

test('G7 (negative): 발행일이 시행일보다 늦으면 던진다 — 읽히기 전에 효력이 생길 수 없다', () => {
  const root = cloneRoot();
  rewrite(root, 'docs/policies/terms.md', (t) =>
    t.replace('발행일: 미정', '발행일: 2027-03-02').replace('시행일: 미정', '시행일: 2027-03-01'),
  );
  assert.ok(hits(checkMeta(root), '보다 늦다').length > 0, '뒤집힌 날짜가 초록이다');
});

test('G7 (negative): 로케일의 핀이 config 에서 빠지면 조용히 통과하지 않는다', () => {
  const root = cloneRoot();
  rewrite(root, 'config/policy-strings.yml', (t) => t.replace(/\n    en: version\n/, '\n'));
  assert.ok(hits(checkMeta(root), 'version_label.en').length > 0, '핀이 없는데 초록이다 — 미판정이 통과로 적혔다');
});
