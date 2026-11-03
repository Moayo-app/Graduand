/**
 * 문의 모달의 AC — **발행본에는 평 `mailto:` 하나뿐이고, 모달은 런타임의 것이다.**
 *
 * ⭐⭐ **이 파일이 지키는 한 문장**: 스크립트를 끈 방문자가 받는 바이트에 **죽은 컨트롤이
 * 0** 이다. 모달의 요소가 발행본에 섞이면 그 방문자는 **눌리는데 아무 일도 일어나지 않는
 * 폼**을 받는다 — 그 실패는 화면에 아무 표시도 남기지 않는다(우리 화면은 멀쩡해 보인다).
 *
 * ⭐ **금칙의 사본을 만들지 않는다** — 네트워크 원시 0 · 밖으로 나가는 주소 0 · 이동 쥐기 0 ·
 * 하드코딩 한글 0 은 `boundary.test.ts` 와 `i18n.test.ts` 의 분모가 **이 모듈을 자동으로
 * 받는다**(`src/` 를 디렉터리째로 센다). 같은 금칙을 두 자리에서 재면 한쪽만 고쳐지는 날
 * 둘 다 자기 기준으로는 옳다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canOpenModal,
  composeMailto,
  CONTACT_FIELDS,
  dataAttr,
  LABEL_KEYS,
  labelsOf,
  TRIGGER_SELECTOR,
} from './contact-modal.ts';
import { publishedPath, readSources, renderSite } from './generate.ts';
import { PUBLISHER } from './publisher.ts';
import { DOCUMENTS } from './site.ts';
import { CATALOG, LOCALES } from './strings.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_SOURCE = readFileSync(join(HERE, 'contact-modal.ts'), 'utf8');

/** 발행본 전수 — 문서 × 로케일. ⛔ 수를 적지 않는다(선언에서 유도한다). */
const site = (): Readonly<Record<string, string>> => renderSite(readSources());

/** `data-contact-<키>` 의 값 — 발행본에서 **속성으로** 읽는다. */
const attrOf = (html: string, key: (typeof LABEL_KEYS)[number]): string | null => {
  const found = new RegExp(`${dataAttr(key)}="([^"]*)"`).exec(html);
  return found === null ? null : found[1]!;
};

/** 그 로케일 카탈로그의 모달 자구 — 가드가 **값까지** 대조하는 분모다. */
const expected = (locale: (typeof LOCALES)[number]): Readonly<Record<string, string>> => {
  const modal = CATALOG[locale].page.footer.contactModal;
  return {
    title: modal.title,
    lede: modal.lede,
    subject: modal.subjectLabel,
    body: modal.bodyLabel,
    submit: modal.submit,
    close: modal.close,
  };
};

/* ───────────────── 발행본을 보는 자리 ───────────────── */

test('AC1 — 문서 × 로케일 전수에 트리거가 서고, 그 주소가 법정 게시의 문의와 같은 **평** 주소다', () => {
  const triggerClass = TRIGGER_SELECTOR.replace('a.', '');
  for (const doc of DOCUMENTS) {
    for (const locale of LOCALES) {
      const name = publishedPath(locale, doc);
      const html = site()[name]!;
      const anchor = new RegExp(`<a[^>]*class="${triggerClass}"[\\s\\S]*?>`).exec(html);
      assert.ok(anchor !== null, `${name}: 문의 트리거가 없다 — 크롬 한 벌이 모든 문서에 세운다`);

      const href = /href="([^"]*)"/.exec(anchor[0]);
      assert.ok(href !== null, `${name}: 트리거에 href 가 없다 — 평 링크가 퇴화의 전부다`);
      // ⭐ **질의가 붙어 있지 않다** — 제목·본문을 붙인 주소는 런타임의 것이고, 발행본에
      //   박히면 그 바이트가 조립 전의 한 경우를 **영구히** 고른 셈이 된다.
      assert.equal(
        href[1],
        `mailto:${PUBLISHER.contact}`,
        `${name}: 트리거의 주소가 법정 게시의 문의와 다르거나 질의가 붙었다`,
      );
    }
  }
});

test('AC2 — 모달의 자구 전수가 `data-…` 로 실리고, 값이 그 로케일 카탈로그의 것이다', () => {
  for (const doc of DOCUMENTS) {
    for (const locale of LOCALES) {
      const name = publishedPath(locale, doc);
      const html = site()[name]!;
      const want = expected(locale);
      for (const key of LABEL_KEYS) {
        const got = attrOf(html, key);
        assert.ok(got !== null, `${name}: 자구 ${key} 가 발행본에 없다 — 스크립트가 쥐면 사본이다`);
        assert.equal(got, want[key], `${name}: 자구 ${key} 가 카탈로그와 갈렸다`);
      }
    }
  }
});

test('AC3 (negative) — 발행본에 모달의 요소와 칸이 0 이다: 스크립트를 끈 방문자에게 죽은 컨트롤이 없다', () => {
  for (const [name, html] of Object.entries(site())) {
    assert.doesNotMatch(html, /<dialog/i, `${name}: 발행본에 <dialog> 가 있다 — 모달은 런타임의 것이다`);
    assert.doesNotMatch(html, /<textarea/i, `${name}: 발행본에 <textarea> 가 있다`);
    // ⭐ 칸의 `id` 도 0 이다 — 입력 칸의 선언 분모(`boundary.test.ts`)가 움직이지 않는 것이
    //   이 설계의 결과이고, 여기서 그 **원인**을 적는다.
    for (const field of CONTACT_FIELDS) {
      assert.doesNotMatch(html, new RegExp(`id="contact-${field}"`), `${name}: 모달의 칸이 발행본에 있다`);
    }
  }
});

/* ───────────────── 조립기를 보는 자리 ───────────────── */

test('AC4 — 조립: 빈 칸은 질의를 만들지 않고, 채운 칸만 인코딩되어 붙는다', () => {
  const base = `mailto:${PUBLISHER.contact}`;
  assert.equal(composeMailto(base, { subject: '', body: '' }), base, '빈 칸이 질의를 만든다');
  assert.equal(composeMailto(base, { subject: '  ', body: '' }), base, '공백만 든 칸이 질의를 만든다');
  assert.equal(
    composeMailto(base, { subject: 'a b', body: '' }),
    `${base}?subject=a%20b`,
    '채운 칸 하나만 붙지 않는다',
  );
  const both = composeMailto(base, { subject: 'x&y', body: 'line 1' });
  assert.equal(both, `${base}?subject=x%26y&body=line%201`, '질의가 인코딩되지 않는다');
  // ⛔ 칸의 값이 질의의 구분자를 깨지 못한다 — 인코딩이 그것을 막는다.
  assert.equal(both.split('&').length, 2, '칸의 값이 질의를 쪼갰다');
});

test('AC5 — 가로채기는 **열 수 있을 때만** 선다: `showModal` 이 없으면 거짓이다', () => {
  const view = (shape: unknown): typeof globalThis => shape as typeof globalThis;
  assert.equal(canOpenModal(view({})), false, '요소를 모르는 판에서 참이다');
  assert.equal(canOpenModal(view({ HTMLDialogElement: {} })), false, '프로토타입이 없는데 참이다');
  assert.equal(
    canOpenModal(view({ HTMLDialogElement: { prototype: {} } })),
    false,
    '요소만 알고 모달 열기를 모르는 판에서 참이다 — 그 판에서 가로채면 죽은 링크가 된다',
  );
  assert.equal(
    canOpenModal(view({ HTMLDialogElement: { prototype: { showModal: () => {} } } })),
    true,
  );
});

test('AC6 (negative) — 자구가 하나라도 빠지면 조립하지 않는다: 말 없는 모달을 열지 않는다', () => {
  const full = expected(LOCALES[0]);
  const fake = (have: readonly string[]): Element =>
    ({
      getAttribute: (name: string) => {
        const key = LABEL_KEYS.find((candidate) => dataAttr(candidate) === name);
        return key !== undefined && have.includes(key) ? full[key]! : null;
      },
    }) as unknown as Element;

  assert.notEqual(labelsOf(fake(LABEL_KEYS)), null, '자구 전수를 들었는데 거절한다');
  for (const missing of LABEL_KEYS) {
    const have = LABEL_KEYS.filter((key) => key !== missing);
    assert.equal(labelsOf(fake(have)), null, `${missing} 가 빠졌는데 모달을 연다`);
  }
});

test('AC7 — 주소의 사본이 0 이다: 모듈이 문의 주소를 리터럴로 쥐지 않는다', () => {
  // ⭐ 조립의 밑은 **트리거의 href** 이고, 그 값은 법정 게시의 문의와 같은 한 손에서 났다.
  //   여기 리터럴을 두면 게시된 주소와 조립되는 주소가 갈라질 수 있고, 그 갈라짐은 화면에
  //   아무 표시도 남기지 않는다 — 방문자만 다른 데로 메일을 보낸다.
  assert.ok(
    !MODULE_SOURCE.includes(PUBLISHER.contact),
    '모듈이 문의 주소를 축자로 들었다 — 출처는 트리거의 href 하나다',
  );
  assert.match(MODULE_SOURCE, /getAttribute\('href'\)/, '주소를 트리거에서 읽지 않는다');
});

test('AC8 — 칸의 선언이 분모다: 발신자 칸이 없고, 비밀번호·토큰 칸이 0 이다', () => {
  // ⛔ 이름·회신 주소를 묻지 않는다 — 보내는 것이 방문자의 메일 앱이라 그 둘은 메일 앱이
  //    이미 안다. 처리방침 §8 의 첫 조치가 「수집 최소화의 구조」다.
  assert.deepEqual([...CONTACT_FIELDS], ['subject', 'body'], '칸의 선언이 둘이 아니다');
  for (const banned of ['password', 'token', 'secret', 'key', 'email', 'name']) {
    assert.ok(
      !CONTACT_FIELDS.some((field) => String(field) === banned),
      `칸에 ${banned} 가 들어왔다 — 선언이 분모이고, 늘리려면 처리방침이 함께 움직인다`,
    );
  }
});
