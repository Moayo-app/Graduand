// 정책 렌더 — 게시 요건이 요구하는 것은 **바이트로 박힌 본문**이다.
//
// ⭐ 분모를 여기 적지 않는다 — 로케일 × 종류는 `policyFiles()` 가 개방 목록에서 유도하고,
// 그래서 나라가 늘면 단정도 따라 는다. ⛔ 테스트에 수가 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { policyFiles, policyBody, read } from '../lib/policy.mjs';
import {
  FILE_BY_KIND,
  OUT_ROOT,
  POLICY_DIR,
  renderAll,
  renderPolicy,
  STYLE_FILE,
  titleOf,
} from '../render-policies.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');

/** 사본 트리에 내고 거기서 잰다 — 저장소의 산출 자리를 테스트가 밟지 않는다. */
const renderInto = () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-render-'));
  return { out, written: renderAll(ROOT, out) };
};

const rel = (out, p) => path.relative(out, p).split(path.sep).join('/');

test('AC4 — 전수가 난다: 로케일 × 종류가 개방 목록에서 유도된 그대로다', () => {
  const { out, written } = renderInto();
  const expected = policyFiles(ROOT)
    .map(([, locale, kind]) => `${locale}/${POLICY_DIR}/${FILE_BY_KIND[kind]}`)
    .sort();
  assert.deepEqual(
    written.map((p) => rel(out, p)).filter((p) => p !== STYLE_FILE).sort(),
    expected,
    '산출이 분모와 다르다 — 빠졌거나 늘었다',
  );
  assert.ok(expected.length > 0, '분모가 비었다 — 아무것도 재지 않고 초록이 될 뻔했다');
});

test('AC1 — 자바스크립트 없이 본문이 보인다: 스크립트가 0 이고 바이트에 본문이 있다', () => {
  const { out, written } = renderInto();
  for (const [source, locale, kind] of policyFiles(ROOT)) {
    const html = fs.readFileSync(path.join(out, locale, POLICY_DIR, FILE_BY_KIND[kind]), 'utf8');
    assert.ok(!html.includes('<script'), `${source}: 발행본에 스크립트가 있다 — 게시가 그것에 걸린다`);
    assert.match(html, new RegExp(`<html lang="${locale}"`), `${source}: 발행본이 다른 언어를 선언했다`);

    // ⭐ 본문이 **바이트로** 있는가 — 제목과 마지막 절의 자구를 원문에서 뽑아 댄다.
    const body = policyBody(read(ROOT, source));
    assert.ok(html.includes(titleOf(body, source)), `${source}: 제목이 발행본에 없다`);
    const headings = [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1]);
    assert.ok(headings.length > 0, `${source}: 원문에 절이 0 이다 — 하네스가 고장났다`);
    for (const heading of headings) {
      assert.ok(html.includes(heading), `${source}: 절 「${heading}」 이 발행본에 없다`);
    }
  }
});

test('AC2 — 표가 <table> 로 서고 열 수가 원문과 같다', () => {
  const { out } = renderInto();
  let seen = 0;
  for (const [source, locale, kind] of policyFiles(ROOT)) {
    const body = policyBody(read(ROOT, source));
    const head = /^\|(.+)\|[ \t]*\n\|[ \t]*:?-+/m.exec(body);
    if (head === null) continue; // 표가 없는 문서는 이 단정의 분모가 아니다
    seen += 1;
    const columns = head[1].split('|').length;
    const html = fs.readFileSync(path.join(out, locale, POLICY_DIR, FILE_BY_KIND[kind]), 'utf8');
    const first = /<table>[\s\S]*?<\/table>/.exec(html);
    assert.ok(first !== null, `${source}: 원문에 표가 있는데 발행본에 <table> 이 없다`);
    assert.equal(
      (first[0].match(/<th[ >]/g) ?? []).length,
      columns,
      `${source}: 첫 표의 열 수가 원문과 다르다 — 표가 하중인 문서다`,
    );
  }
  assert.ok(seen > 0, '표를 가진 문서가 0 이다 — 하네스가 고장났다');
});

test('AC3 (negative) — 머리말 주석의 내용이 발행본에 0 이다: 심으면 빨갛다', () => {
  const { out } = renderInto();
  for (const [source, locale, kind] of policyFiles(ROOT)) {
    const html = fs.readFileSync(path.join(out, locale, POLICY_DIR, FILE_BY_KIND[kind]), 'utf8');
    assert.ok(!html.includes('<!--'), `${source}: 발행본에 주석이 남았다 — 작업 메모가 게시물에 실린다`);
  }

  // ⭐ 걷기가 **멀쩡한지**를 함께 묻는다 — 모든 것을 걷는 고장난 걷기도 초록이다.
  const planted = renderPolicy('<!-- 작업 메모 LEAKED -->\n# 제목\n\n본문.\n', 'ko', '심은 사본');
  assert.ok(!planted.includes('LEAKED'), '머리말을 심었는데 발행본에 남았다 — 걷기가 죽었다');
  assert.ok(planted.includes('본문.'), '본문까지 걷혔다 — 걷기가 너무 넓다');
});

test('AC5 (negative) — 산출이 정본의 자리를 침범하지 않는다', () => {
  const { out, written } = renderInto();
  for (const p of written) {
    const r = rel(out, p);
    assert.ok(!r.startsWith('..'), `산출이 지정한 자리 밖으로 났다 — ${r}`);
    assert.ok(!r.includes('docs/'), `산출이 정본의 자리에 났다 — ${r}`);
  }
  // ⭐ 기본 산출 자리가 **발행 루트**다 — `.gitignore` 가 통째로 무시하는 그 자리다.
  assert.equal(OUT_ROOT, 'diagnosis/dist', '기본 산출 자리가 움직였다 — .gitignore 가 함께 움직여야 한다');
  assert.match(read(ROOT, '.gitignore'), new RegExp(`${OUT_ROOT}/`), '발행 루트가 .gitignore 에 없다');
});

test('꾸밈 한 벌이 루트에 난다 — 문서마다 사본을 만들지 않는다', () => {
  const { out, written } = renderInto();
  assert.equal(written.filter((p) => rel(out, p) === STYLE_FILE).length, 1, '꾸밈이 한 벌이 아니다');
  for (const [, locale, kind] of policyFiles(ROOT)) {
    const html = fs.readFileSync(path.join(out, locale, POLICY_DIR, FILE_BY_KIND[kind]), 'utf8');
    assert.ok(html.includes(`href="/${STYLE_FILE}"`), `${locale}/${kind}: 꾸밈을 루트에서 부르지 않는다`);
    assert.ok(!html.includes('<style'), `${locale}/${kind}: 꾸밈이 문서 안에 박혔다 — 벌마다 사본이 된다`);
  }
  // ⛔ 색을 베끼지 않았다 — 램프는 `/styles.css` 의 토큰이고, hex 리터럴이 0 이어야 한다.
  const sheet = fs.readFileSync(path.join(out, STYLE_FILE), 'utf8');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(sheet), '꾸밈에 색 리터럴이 있다 — 램프의 사본이다');
});

/**
 * ⬜ **진단 발행본이 아직 이 저장소에 없다 — 배달이 돌지 않았다.**
 *
 * ⚠️ 그래서 「푸터 링크 셋이 200」을 **여기서는 잴 수 없다.** 안 재는 것이 아니라 **못
 * 재는 것**이고, 그 사실을 조용히 두지 않는다: 아래는 **부재 자체를 단정**해서, 배달이
 * 도는 날 **빨갛게** 된다. 그날 이 테스트가 링크 대조로 바뀐다.
 */
test('⬜ 링크 대조는 배달 뒤다 — 진단 발행본이 서면 이 단정이 빨갛다', () => {
  const published = policyFiles(ROOT)
    .map(([, locale]) => path.join(ROOT, OUT_ROOT, locale, 'index.html'))
    .filter((p) => fs.existsSync(p));
  assert.deepEqual(
    published,
    [],
    '진단 발행본이 섰다 — 이제 푸터의 ./policies/*.html 링크가 실제로 풀리는지 대조하도록 이 단정을 바꾼다',
  );
});
