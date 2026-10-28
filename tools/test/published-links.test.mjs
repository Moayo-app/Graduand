// 발행본의 링크 대조 — 양성 + negative.
//
// ⭐⭐ **이 테스트가 재는 것은 판정이지 발행본이 아니다.** 발행본은 `.gitignore` 가 통째로
//    무시하는 자리라 CI 에는 **없다** — 있을 때만 도는 단정으로 두면 정작 막아야 할 자리에서
//    아무것도 재지 않는다. ⇒ 트리를 **지어서** 재고, 실물 발행본이 있을 때는 거기서 한 번 더
//    잰다. 그리고 「빌드가 이 대조를 지난다」는 **배선 자체**를 따로 단정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { judgeLinks, linksOf, targetOf } from '../lib/published-links.mjs';
import { checkRoot, DEFAULT_ROOT, redirectsOf } from '../check-published-links.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');

/** 발행본을 **지어서** 잰다 — 트리의 모양만 같으면 판정은 같다. */
const tree = (files) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'published-links-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(out, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), text);
  }
  return out;
};

/** 실물 발행본이 거는 것과 **같은 꼴**의 문서 — 정책 링크 · 리다이렉트 자리 · 형제 로케일. */
const PAGE = [
  '<a href="./policies/terms.html">약관</a>',
  '<a href="./policies/refunds.html">환불</a>',
  '<a href="/portal/">해지</a>',
  '<a href="#cta">요금</a>',
  '<a href="https://example.test/">밖</a>',
  '<a href="mailto:a@example.test">메일</a>',
  '<a href="../en/">English</a>',
  '<link href="/styles.css" rel="stylesheet">',
].join('\n');

const FULL = {
  'ko/index.html': PAGE,
  'en/index.html': '<a href="../ko/">한국어</a>',
  'ko/policies/terms.html': '<p>약관</p>',
  'ko/policies/refunds.html': '<p>환불</p>',
  'styles.css': 'body{}',
  _redirects: '/    /en/    302\n/portal/    https://example.test/portal    302\n',
};

const without = (key) => Object.fromEntries(Object.entries(FULL).filter(([k]) => k !== key));

test('양성 — 지은 발행본의 링크가 전부 풀린다. 밖·조각·메일은 모집단이 아니다', () => {
  const { errors, checked } = checkRoot(tree(FULL));
  assert.deepEqual(errors, []);
  // ⭐ 분모를 함께 단정한다 — 「위반 0」과 「아무것도 안 봤다」는 다른 것이다.
  assert.ok(checked >= 5, `잰 링크가 ${checked} 개다 — 분모가 비었다`);
});

test('⚠️⚠️ (negative) — **사고의 재현**: 정책 문서가 발행본에서 빠지면 그 링크가 지목된다', () => {
  // 실물: 빌드의 절반(진단 생성기)만 돌린 발행본이 정책 6벌 없이 올라갔고, 푸터의
  // `./policies/*.html` 이 전부 404 가 됐다. 가드는 전부 초록이었다 — 발행본을 본 것이
  // 없었기 때문이다. 이 단정이 그 자리를 막는다.
  const { errors } = checkRoot(tree(without('ko/policies/refunds.html')));
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('ko/index.html'), '어느 문서가 거는지 말한다');
  assert.ok(errors[0].includes('policies/refunds.html'), '무엇이 없는지 말한다');
});

test('(negative) — 리다이렉트 선언이 사라지면 파일 아닌 자리도 지목된다', () => {
  const { errors } = checkRoot(tree({ ...FULL, _redirects: '/    /en/    302\n' }));
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('/portal/'), '선언이 받던 자리가 불린다');
});

test('(negative) — 꾸밈이 빠져도 운다: 재는 것이 `href` 만이 아니다', () => {
  const { errors } = checkRoot(tree(without('styles.css')));
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('styles.css'));
});

test('⛔ 분모가 비면 초록이 아니다 — 「잰 것이 0」을 통과로 읽지 않는다', () => {
  const { errors, checked } = judgeLinks({}, new Set(), new Set());
  assert.deepEqual(errors, []);
  assert.equal(checked, 0, '분모가 0 이고, 부르는 쪽이 그것을 빨강으로 바꾼다');
});

test('조각만 있는 링크와 밖으로 나가는 링크는 대상이 없다 — 대조가 책임지지 않는다', () => {
  for (const href of ['#cta', '', 'https://example.test/', '//example.test/', 'mailto:a@example.test'])
    assert.equal(targetOf('ko/index.html', href), null, href);
  assert.equal(linksOf('<a href="/a/">x</a><img src="/b.png">').length, 2, 'href 와 src 를 함께 센다');
});

/** 빌드가 기대는 것은 **나가는 수**다 — 함수가 아니라 명령으로 한 번 민다. */
const run = (root) => spawnSync(process.execPath, [path.join(ROOT, 'tools/check-published-links.mjs'), root], { encoding: 'utf8' });

test('⭐⭐ 나가는 수 — 빌드를 멈추는 것은 판정이 아니라 이 수다', () => {
  // ⛔ 판정 함수만 재면 「빨갛다고 **말하지만** 빌드는 지나간다」가 보이지 않는다.
  assert.equal(run(tree(FULL)).status, 0, '전부 풀리는 발행본이 0 으로 나가지 않는다');

  const bad = run(tree(without('ko/policies/refunds.html')));
  assert.equal(bad.status, 2, '풀리지 않는 링크가 있는데 0 으로 나갔다 — 빌드가 그대로 배포로 간다');
  assert.match(bad.stderr, /policies\/refunds\.html/, '무엇이 없는지 stderr 가 말한다');

  // ⭐ 분모가 빈 트리도 2 다 — 「아무것도 못 봤다」가 초록으로 나가지 않는다.
  assert.equal(run(tree({ 'note.txt': 'x' })).status, 2, '잰 링크가 0 인데 0 으로 나갔다');
  // ⚠️ 발행본이 아예 없는 자리도 2 다 — 「없어서 통과」를 만들지 않는다.
  assert.equal(run(path.join(os.tmpdir(), 'published-links-none')).status, 2, '없는 루트가 0 으로 나갔다');
});

test('⭐⭐ 배선 — 발행본을 짓는 길이 이 대조를 **반드시 지난다**', () => {
  // ⛔ 이 단정이 이 파일의 핵이다. 판정이 아무리 세도 빌드가 부르지 않으면 아무것도 막지
  //    못하고, 사고는 바로 그 모양이었다(사람이 절반만 돌렸다).
  const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(scripts.build.includes('tools/check-published-links.mjs'), '빌드가 링크 대조를 지나지 않는다');
  assert.ok(
    scripts.build.indexOf('render-policies.mjs') < scripts.build.indexOf('check-published-links.mjs'),
    '대조가 정책 렌더보다 먼저 돈다 — 그러면 아직 없는 파일을 재게 된다',
  );
  assert.equal(DEFAULT_ROOT, 'diagnosis/dist', '기본 발행 루트가 움직였다');
});

test('⭕ 실물 발행본이 서 있으면 거기서도 잰다 — 지은 트리만으로 끝내지 않는다', (t) => {
  const at = path.join(ROOT, DEFAULT_ROOT);
  // ⚠️ CI 에는 발행본이 없다(.gitignore). 그 자리는 위의 **배선 단정**이 지킨다.
  if (!fs.existsSync(at)) return t.skip('발행본이 없다 — 빌드 뒤 로컬에서 돈다');
  const { errors, checked } = checkRoot(at);
  assert.deepEqual(errors, [], '실물 발행본에 풀리지 않는 링크가 있다');
  assert.ok(checked > 0, '실물 발행본에서 잰 링크가 0 이다');
  assert.ok(redirectsOf(at).size > 0, '실물 발행본에 리다이렉트 선언이 없다');
});
