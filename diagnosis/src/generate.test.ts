/**
 * 생성기의 AC — **두 문서가 한 틀에서 난다 · 틀에 산문이 0 · 발행본에 산문이 바이트로
 * 있다 · 로케일 불변 자산의 사본이 0 · 깨진 참조가 0.**
 *
 * ⭐⭐ **여기서 재는 것은 「무엇이 발행되는가」다.** 기존 금칙들(내부 자산 · 밖으로 나가는
 * 주소 · 협상 코드 · 계정 어휘 · 지표 어휘)은 **분모가 발행본으로 넓어진 채** 제 자리에서
 * 돈다 — `boundary.test.ts` 와 `i18n.test.ts` 다. 사본을 만들지 않으므로 여기 다시 적지
 * 않는다: 같은 금칙을 두 자리에서 재면 한쪽만 고쳐지는 날 둘 다 자기 기준으로는 옳다.
 *
 * ⚠️ **발행 루트가 이 폴더다** — 오늘의 서빙 모양은 「빌드 뒤 이 폴더를 그대로 정적 서빙」
 * 이고, 그래서 `/styles.css` 는 `diagnosis/styles.css` 로 푼다. ⬜ 최종 주소 모양
 * (`/ko/` 가 `dist/ko/` 가 아니라 루트 아래 서는 것)은 **호스팅 쪽 결정**이라 이 이슈 밖이다
 * — 루트 절대 경로를 고른 이유의 절반이 그것이다: 문서가 어느 깊이에 놓여도 그 참조는
 * 움직이지 않는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRAND_LOCKUP,
  CARRIED_ASSETS,
  PACKAGE_ASSETS,
  DEFAULT_OUT,
  DOCUMENT_FILE,
  lockupShapes,
  publishedPath,
  readLockup,
  readChrome,
  readSources,
  renderAll,
  renderDocument,
  renderSite,
  renderSlot,
  substitutions,
  templateOf,
  TEMPLATE_FILE,
  withoutHtmlComments,
} from './generate.ts';
import { PUBLISHER } from './publisher.ts';
import {
  alternates,
  DEFAULT_LOCALE,
  DOCUMENTS,
  documentUrl,
  localeRootPath,
  OG_IMAGE_FILE,
  REDIRECTS,
  REDIRECTS_FILE,
  robotsTxt,
  ROBOTS_FILE,
  rootAssetUrl,
  siblingDocumentPath,
  siblingLocalePath,
  SITE_ORIGIN,
  SITEMAP_FILE,
  sitemapXml,
} from './site.ts';
import { CATALOG, LOCALES, type Locale } from './strings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/g;
const template = (): string => read(TEMPLATE_FILE);
const documents = (): Readonly<Record<Locale, string>> => renderAll(template());

/** 생성기를 **광고된 대로** 돌린다 — 함수를 부르는 것과 명령이 도는 것은 다른 단정이다. */
function generateInto(): string {
  const out = mkdtempSync(join(tmpdir(), 'graduand-publish-'));
  const r = spawnSync(process.execPath, [join(ROOT, 'src', 'generate.ts'), '--out', out], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  assert.equal(r.status, 0, `생성기가 죽었다: ${r.stderr}`);
  return out;
}

/**
 * 발행 루트에 **한 벌로** 서는 것 전수 — 로케일 불변 자산과 색인 선언 셋이다.
 * ⛔ 수를 적지 않는다: 이름을 전부 생성기의 상수에서 받는다.
 */
const rootFiles: readonly string[] = [
  ...CARRIED_ASSETS,
  ...PACKAGE_ASSETS,
  SITEMAP_FILE,
  ROBOTS_FILE,
  REDIRECTS_FILE,
];

/* ───────────────── AC2 — 두 문서가 한 틀에서 난다 ───────────────── */

test('AC2 — 빌드가 로케일마다 문서를 내고, 각자의 lang 이 그 로케일이다', () => {
  // ⭐ **빌드가 이것을 돈다**는 것이 AC 의 절반이다 — 돌지 않는 생성기는 장식이고, 그러면
  //   발행본이 손글씨 시절의 바이트로 남는다. ⛔ 스크립트 자구를 여기 적지 않는다: 생성기의
  //   **경로**가 거기 있는지만 묻는다.
  const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
  assert.match(scripts.build!, /src\/generate\.ts/, 'build 가 생성기를 돌지 않는다');

  const out = generateInto();

  // ⭐⭐ **산출 루트가 곧 사이트다** — 로케일 디렉터리 전수 + 루트 한 벌이고, 그 한 벌이
  //   선언돼 있다. ⛔ 로케일 **수**를 적지 않는다(분모는 `LOCALES`).
  const entries = readdirSync(out, { withFileTypes: true });
  assert.deepEqual(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
    [...LOCALES].sort(),
    '산출의 로케일 디렉터리가 분모와 다르다',
  );
  assert.deepEqual(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(),
    [...rootFiles].sort(),
    '산출 루트의 한 벌이 선언과 다르다 — 늘었거나 선언이 낡았다',
  );

  for (const locale of LOCALES) {
    const html = readFileSync(join(out, locale, DOCUMENT_FILE), 'utf8');
    const lang = /<html[^>]*\blang="([^"]*)"/.exec(html)?.[1];
    assert.equal(lang, locale, `${locale}: 발행본이 다른 언어를 선언했다`);
    // 같은 틀에서 났다 — 함수로 낸 것과 명령으로 낸 것이 **같은 바이트**여야 한다.
    assert.equal(html, documents()[locale], `${locale}: 명령과 함수의 산출이 다르다`);
  }

  // ⭐ 기본 산출 자리가 이 패키지의 다른 산출과 같은 폴더다 — 커밋되지 않는 자리(.gitignore).
  assert.equal(DEFAULT_OUT, 'dist', '기본 산출 자리가 움직였다 — .gitignore 가 함께 움직여야 한다');
});

test('AC2 — 다시 구우면 같은 바이트다: 생성기에 시계도 난수도 없다', () => {
  const first = documents();
  const second = documents();
  for (const locale of LOCALES) {
    assert.equal(second[locale], first[locale], `${locale}: 두 번 구운 결과가 다르다`);
  }
});

/* ───────────────── AC3 — 틀에 산문이 0 ───────────────── */

/**
 * ⭐⭐ **강조 표식은 하나다 — 겹쳐 쓰면 빈 태그가 발행된다.**
 *
 * 인라인 강조는 표식을 **짝으로** 센다(`*…*`). 그래서 `**…**` 는 「열고 바로 닫은 뒤 다시
 * 열고 닫는」 꼴이 되어 발행본에 **빈 `<strong></strong>` 둘**을 남긴다 — 화면에는 아무
 * 표시도 나지 않고(빈 요소라 보이지 않는다) 바이트에만 남는 종류의 거짓이다.
 *
 * ⚠️ **실측으로 발견했다** — 둘째 문서를 세우며 쓴 산문이 그 꼴이었고, 같은 꼴이 **원페이지의
 * 카탈로그에 이미 여덟 쌍** 있었다(아무 가드도 세지 않았다). ⇒ 자구를 고치고, 그 자리를
 * 다시 열지 않게 이 단정을 세운다.
 */
test('AC3 (negative) — 발행본에 빈 강조 태그가 0 이다: 표식을 겹쳐 쓰면 빨갛다', () => {
  const empties = (html: string): string[] =>
    [...html.matchAll(/<(strong|code)[^>]*><\/\1>/g)].map((match) => match[0]);
  for (const [name, html] of Object.entries(renderSite(readSources()))) {
    assert.deepEqual(empties(html), [], `${name}: 빈 강조 태그가 있다 — 표식을 겹쳐 쓴 자리다`);
  }

  // ⭐ 음성 대조군 — 겹쳐 쓴 **자구**를 표식 손에 직접 먹인다. ⚠️ 틀에 심는 길은 이 자리를
  //   지나지 못한다: 자리를 자구로 바꾸면 그 키가 **쓰이지 않은 키**가 되어 1:1 가드가
  //   먼저 던진다(실측). 겹친 표식은 **카탈로그의 값**에서만 올 수 있으므로, 그 값을 받는
  //   손(`renderSlot`)이 음성 대조군의 자리다.
  const doubled = ['*', '*'].join('');
  assert.notDeepEqual(
    empties(renderSlot(`${doubled}x${doubled}`, 'prose', 'negative-control')),
    [],
    '겹쳐 쓴 자구를 심었는데 초록이다',
  );
});

test('AC3 (negative) — 틀에서 주석을 벗기면 한글이 한 글자도 없다', () => {
  // ⭐ 분모가 **손으로 쓰는 것 전수**다(크롬 + 문서마다의 본문) — 새 틀이 분모를 자동으로 얻는다.
  const sources = readSources();
  for (const [name, text] of Object.entries(sources)) {
    const stripped = withoutHtmlComments(text);
    assert.deepEqual(stripped.match(HANGUL) ?? [], [], `${name}: 틀에 산문이 남아 있다 — 카탈로그로 내려오지 않은 자구다`);
    // ⭐ 벗기기가 **멀쩡한지**를 함께 문다 — 모든 것을 벗기는 고장난 벗기기도 초록이다.
    assert.ok(HANGUL.test(text), `${name}: 벗기기 전에도 한글이 없다 — 주석이 사라졌거나 하네스가 고장났다`);
  }
  // ⭐ 그리고 합친 틀이 **문서의 구조**를 그대로 들고 있다 — 벗기기가 마크업을 먹지 않았다.
  for (const doc of DOCUMENTS) {
    assert.ok(
      templateOf(sources.chrome, sources[doc]).includes('<html'),
      `${doc}: 벗기기가 마크업까지 먹었다`,
    );
  }
  const stripped = withoutHtmlComments(template());
});

/* ───────────────── AC4 — 스크립트 없이도 산문을 받는다 ───────────────── */

/**
 * ⭐⭐ **이것이 생성기를 고른 이유 자체다.** 문구를 런타임에 채우면 「스크립트를 끈 방문자가
 * 받는 바이트에 산문이 0」이 되는데, 그것은 구독 입구를 JS 없이 눌리게 둔 이유를 정면으로
 * 지운다. ⇒ 스크립트를 **전부 지운** 문서에 산문이 남아 있는지를 묻는다.
 *
 * ⚠️ 하한을 500자로 둔다 — 「0 이 아니다」로는 빈 자리 하나만 남아도 초록이다.
 */
test('AC4 (negative) — 스크립트를 끈 방문자가 받는 바이트에 산문이 0 이 아니다', () => {
  const canon = documents()[LOCALES[0]];
  const withoutScripts = canon.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(withoutScripts, /<script/, '스크립트를 다 지우지 못했다 — 하네스가 고장났다');
  const letters = (withoutScripts.match(HANGUL) ?? []).length;
  assert.ok(letters > 500, `스크립트 없이 받는 산문이 ${letters}자다 — 500자를 넘지 않는다`);
});

/* ───────────────── AC5 · AC6 — 경로를 성질로 가른다 ───────────────── */

/**
 * ⭐⭐ **자산의 성질 — 선언이고, 각 항에 사유가 붙는다.**
 *
 * `rooted` 가 참이면 **로케일 불변**이다: 루트 하나에 두고 `/…` 로 부른다(복제하면 사본이고,
 * 사본은 갈라진다). 거짓이면 **로케일마다 둘**이다: 문서 기준 상대 경로로 부른다(로케일
 * 접두를 박지 않으므로 접두가 움직여도 틀이 따라 움직이지 않는다).
 *
 * ⚠️ 판정은 **접두를 벗긴 꼴**에 듣는다 — 분류가 `/` 로 시작하는지를 보고 성질을 정하면
 * 그 판정이 순환이 된다(「루트 절대니까 루트 절대가 맞다」).
 */
/**
 * ⭐⭐ **참조의 집합을 선언에서 유도한다.** 문서가 둘이 되면서 같은 성질의 참조가 **문서
 * 깊이만큼 다른 자구**로 선다(`./policies/…` ↔ `../policies/…`). 정규식을 느슨하게 풀면
 * (`(\.\./)*`) 깊이를 틀리게 적은 참조도 초록이 되므로, 자구를 **주소를 내는 그 손**에서
 * 받는다 — 깊이가 틀리면 집합에 없고, 집합에 없으면 「성질이 선언되지 않은 참조」다.
 */
const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (values: readonly string[]): RegExp =>
  new RegExp(`^(${[...new Set(values)].map(escapeRe).join('|')})$`);

/** 참조에서 선행 `./` 와 루트 `/` 를 뗀 꼴 — 아래 집합들도 같은 손을 지난다. */
const bareOf = (reference: string): string => reference.replace(/^\.?\//, '');

const POLICY_NAMES = ['terms', 'privacy', 'refunds'] as const;

/** 그 로케일의 루트로 가는 상대 경로 전수 — 문서 깊이마다 하나다. */
const LOCALE_ROOTS = DOCUMENTS.map((doc) => bareOf(localeRootPath(doc)));
/** 같은 문서의 형제 로케일 전수 — 문서 × 로케일. */
const SIBLING_LOCALES = DOCUMENTS.flatMap((doc) =>
  LOCALES.map((locale) => bareOf(siblingLocalePath(locale, doc))),
);
/** 문서 → 문서 전수 — 자기 자신(브랜드 링크)도 이 곱에 든다. */
const SIBLING_DOCUMENTS = DOCUMENTS.flatMap((from) =>
  DOCUMENTS.map((to) => bareOf(siblingDocumentPath(from, to))),
);
/**
 * 밖으로 나가는 **지정된 리다이렉트** 전수 — ⭐⭐ `REDIRECTS` 에서 유도한다.
 *
 * ⚠️⚠️ **여기가 손으로 적혀 있어서 404 가 하나 섰다.** 전에는 `(checkout|portal|company)` 를
 * 축자로 적었고, 그것은 **선언을 베낀 사본**이었다: 푸터가 해지 입구를 가리키는데 선언에는
 * 그 행이 없었는데도 이 표가 「지정된 리다이렉트」라고 답했다 — 사본과 선언이 갈라져도
 * 양쪽 다 자기 기준으로는 옳다. 사이트가 공개된 뒤 **해지하려고 누른 고객이 404** 를 받고
 * 나서야 보였다. ⇒ 분모를 선언에서 받는다: 선언 없는 경로를 화면이 가리키면 그 참조는
 * 「성질이 선언되지 않은 참조」가 되고 빨갛다.
 * ⛔ 루트(`/`)는 이 집합에 없다 — 화면이 가리키는 자리가 아니라 **들어오는** 자리다.
 */
const REDIRECT_TARGETS = REDIRECTS.map(({ from }) => bareOf(from)).filter((path) => path !== '');

/** 정책 3종 × 문서 깊이. */
const POLICY_REFS = DOCUMENTS.flatMap((doc) =>
  POLICY_NAMES.map((name) => bareOf(`${localeRootPath(doc)}policies/${name}.html`)),
);

const assetClasses: readonly {
  readonly id: string;
  readonly match: RegExp;
  readonly rooted: boolean;
  readonly why: string;
}[] = [
  { id: 'styles', match: /^styles\.css$/, rooted: true, why: '로케일 불변 — 한 벌이 두 문서를 입힌다. 복제하면 사본이다' },
  {
    id: 'page-script',
    match: /^[a-z]+\/src\/[\w.-]+\.js$/,
    rooted: true,
    why: '로케일 불변 — 같은 번들이 두 문서를 그린다(로케일은 lang 이 고른다). `tsc` 가 발행 루트로 바로 내려앉는다',
  },
  {
    id: 'brand-asset',
    match: /^(favicon\.svg|apple-touch-icon\.png|og\.png)$/,
    rooted: true,
    why: '브랜드가 굽고 생성기가 나르는 자산 — 로케일 불변이고, 파비콘은 루트에서 찾아진다',
  },
  {
    id: 'redirect',
    match: exactly(REDIRECT_TARGETS),
    rooted: true,
    why: '밖으로 나가는 지정된 리다이렉트 — 로케일 불변이고, 벤더·회사 주소를 발행본에 박지 않는다. 집합은 선언(REDIRECTS)이 낸다',
  },
  {
    id: 'policies',
    match: exactly(POLICY_REFS),
    rooted: false,
    why: '로케일마다 둘 — 번역판 정본이 따로 있다. 사본이 아니다. 자구는 문서 깊이가 정한다',
  },
  {
    id: 'sibling-document',
    match: exactly([...SIBLING_DOCUMENTS, ...LOCALE_ROOTS]),
    rooted: false,
    why: '같은 로케일의 다른 문서(와 자기 자신) — 브랜드 링크와 제품 컬럼이 문서를 잇는다. 접두를 박지 않으므로 어느 깊이에서도 형제를 가리킨다',
  },
  {
    id: 'sibling-locale',
    match: exactly(SIBLING_LOCALES),
    rooted: false,
    why: '같은 문서의 형제 로케일 — 로케일 접두를 박지 않으므로 발행본이 어느 깊이에 놓여도 형제를 가리킨다',
  },
];

/**
 * 파일로 **실재하지 않는** 참조 — 선언이고 사유가 붙는다. ⛔ 「아직 없다」를 조용히 넘기지
 * 않는다: 열거되지 않은 깨진 참조는 판정 실패다.
 */
const nonFileTargets: readonly { readonly match: RegExp; readonly why: string }[] = [
  {
    match: exactly(REDIRECT_TARGETS),
    why: '지정된 리다이렉트 자리 — 파일이 아니고, 그 선언은 호스팅 쪽이 든다. 벤더·회사 주소는 발행된 화면에 박지 않는다. 집합은 선언(REDIRECTS)이 낸다',
  },
  {
    match: exactly([...SIBLING_DOCUMENTS, ...LOCALE_ROOTS]),
    why: '같은 로케일의 다른 문서(와 자기 자신) — 같은 빌드가 낸다. 디렉터리라 파일로 풀리지 않는다',
  },
  {
    match: exactly(SIBLING_LOCALES),
    why: '같은 문서의 형제 로케일 — 같은 빌드가 낸다. 가리키는 로케일이 분모와 같은지는 아래가 따로 센다',
  },
  {
    match: exactly(POLICY_REFS),
    why: '정책 3종은 공개 저장소의 정본 산문에서 렌더되는 생성물이다 — 이 패키지가 내지 않고, 로케일 디렉터리로 들어온다',
  },
];

const bare = bareOf;

const referencesOf = (html: string): string[] =>
  [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((match) => match[1]!);

/**
 * 메일 주소는 **경로가 아니다** — 분류 전에 가른다. ⭕ 그리고 금칙도 아니다: 밖으로 나가는
 * 주소 금칙이 잡는 것은 **이동**이고(절대 주소 · 프로토콜 상대 주소), `mailto:` 는 그 둘이
 * 아니다. ⚠️ 값은 법정 게시의 문의와 **같은 한 손**에서 나와야 한다 — 둘이 갈라지면 어느
 * 쪽이 참인지 화면이 말하지 않는다.
 */
const MAILTO = /^mailto:/;

/**
 * 같은 문서 안의 닻도 **경로가 아니다** — 분류 전에 가른다. ⭕ 밖으로 나가지도 않는다.
 * ⚠️ 그 대신 조건 둘을 지는데, 둘 다 **발행본을 보는 자리**가 문다(`boundary.test.ts`):
 * 가리키는 블록이 실재하는가, 그리고 요약을 자처하지 않는가. ⛔ 여기 사본을 만들지 않는다.
 */
const ANCHOR = /^#/;

/**
 * 자기 출처의 **절대 주소**도 경로가 아니다 — 분류 전에 가른다. ⭕ 밖으로 나가지도 않는다:
 * 그 문서가 **이미 있는 자리**이고, 색인 선언은 규격이 절대 주소를 요구한다.
 *
 * ⚠️ 그 대신 조건 하나를 진다 — **주소를 내는 손이 하나**여야 한다. 아래가 그것을 센다:
 * 발행본에 선 자기 출처 주소가 전부 `documentUrl` 이 낸 값과 **같은지**. 다른 값이 설 수
 * 있으면 canonical 과 hreflang 이 갈라질 자리가 생긴다.
 */
const SELF_ORIGIN = new RegExp(`^${SITE_ORIGIN.replaceAll('.', '\\.')}`);

/**
 * 참조 하나의 처분 — 파일로 실재하거나, `tsc` 가 내는 산출이거나, 사유와 함께 선언된
 * 비-파일이거나, **깨진 것**이다.
 *
 * ⭐ `tsc` 산출은 **빌드된 결과가 아니라 소스로** 푼다 — 빌드를 돈 흔적에 기대면 낡은
 * `dist/` 위에서도 초록이 된다. 참조를 소스에 묶는 쪽이 강하다.
 */
function verdictOf(reference: string, out: string): string {
  const path = bare(reference);

  // ⚠️ `tsc` 산출을 **먼저** 본다 — 빌드를 돈 뒤에는 그 파일이 실재해서, 뒤로 돌리면 이
  //    판정이 「빌드를 돌았는가」에 따라 달라진다. 소스에 묶는 쪽이 강하고, 순서가 그 조건이다.
  const built = /^([a-z]+)\/src\/([\w.-]+)\.js$/.exec(path);
  if (built !== null) {
    return existsSync(join(ROOT, '..', built[1]!, 'src', `${built[2]!}.ts`)) ? 'tsc' : 'broken';
  }

  // ⭐ 파일은 **발행 루트**에서 푼다 — 참조가 가리키는 자리가 거기다. ⚠️ 낡은 산출에 기대지
  //    않는다: 분모가 **이 호출이 방금 지은** 디렉터리다.
  if (existsSync(join(out, path)) && statSync(join(out, path)).isFile()) return 'file';

  const declared = nonFileTargets.find((target) => target.match.test(path));
  return declared === undefined ? 'broken' : 'declared';
}

test('AC5 (negative) — 로케일 불변 자산의 사본이 0: 로케일 디렉터리에 문서 하나뿐이다', () => {
  const out = generateInto();
  for (const locale of LOCALES) {
    // ⭐ 기대값을 **발행 경로의 손에서** 받는다 — 문서가 늘면 그 디렉터리가 따라 늘고, 손으로
    //   적은 열거는 그날 거짓이 된다. ⛔ 그래도 **불변 자산**은 여기 설 수 없다: 이 집합에
    //   드는 것은 문서의 자리뿐이다.
    const expected = [
      ...new Set(DOCUMENTS.map((doc) => publishedPath(locale, doc).split('/')[1]!)),
    ].sort();
    assert.deepEqual(
      readdirSync(join(out, locale)).sort(),
      expected,
      `${locale}: 로케일 디렉터리에 문서의 자리 말고 다른 것이 있다 — 불변 자산을 복제한 자리다`,
    );
  }

  // ⭐⭐ 그리고 불변 자산은 발행 산출 트리에 **정확히 한 벌**, 그것도 **루트에** 선다.
  //   ⚠️ 단정이 뒤집힌 것이 아니라 **발행 루트가 생긴 것**이다 — 전에는 「이 패키지 폴더를
  //   그대로 서빙하면 선다」라 자산이 산출 밖(패키지 루트)에 있었고, 그래서 산출 트리에
  //   0 이어야 했다. 이제 산출이 곧 사이트라 그 한 벌이 **산출 안에** 있어야 한다.
  //   명제는 같다: **한 벌이고, 로케일마다 복제되지 않는다.**
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [entry.name],
    );
  const invariant = [...PACKAGE_ASSETS, ...CARRIED_ASSETS];
  for (const name of invariant) {
    assert.deepEqual(
      walk(out).filter((found) => found === name),
      [name],
      `불변 자산 ${name} 이 발행 루트에 한 벌이 아니다 — 복제하면 사본이고, 사본은 갈라진다`,
    );
    assert.ok(existsSync(join(out, name)), `불변 자산 ${name} 이 발행 루트에 없다`);
  }
});

test('AC6 (negative) — 깨진 참조가 0 이고, 성질이 경로의 꼴을 정한다', () => {
  const seen = new Set<string>();
  const out = generateInto();

  for (const [locale, html] of Object.entries(documents())) {
    for (const reference of referencesOf(html)) {
      if (ANCHOR.test(reference)) continue;
      if (SELF_ORIGIN.test(reference)) {
        assert.ok(
          LOCALES.some((other) => documentUrl(other, 'page') === reference),
          `${locale}: 자기 출처 주소가 documentUrl 이 낸 값이 아니다 — ${reference}`,
        );
        continue;
      }
      if (MAILTO.test(reference)) {
        assert.equal(
          reference,
          `mailto:${PUBLISHER.contact}`,
          `${locale}: 메일 주소가 법정 게시의 문의와 다르다`,
        );
        continue;
      }
      const path = bare(reference);
      seen.add(path);

      const asset = assetClasses.find((entry) => entry.match.test(path));
      assert.ok(asset !== undefined, `${locale}: 성질이 선언되지 않은 참조다 — ${reference}`);
      assert.equal(
        reference.startsWith('/'),
        asset.rooted,
        `${locale}: ${reference} 의 꼴이 성질과 다르다 (${asset.id}: ${asset.why})`,
      );
      // ⛔ 프로토콜 상대 주소는 스킴만 생략된 **밖**이다 — 루트 절대 경로처럼 보여서 더 위험하다.
      assert.ok(!reference.startsWith('//'), `${locale}: ${reference} 는 프로토콜 상대 주소다`);

      assert.notEqual(verdictOf(reference, out), 'broken', `${locale}: 깨진 참조다 — ${reference}`);
      // 로케일마다 둘이 되는 것은 **문서 기준**으로 풀린다 — 로케일 접두가 박혀 있지 않다.
      if (!asset.rooted) {
        assert.ok(!path.startsWith(locale), `${locale}: ${reference} 에 로케일 접두가 박혀 있다`);
        // ⚠️ 자기 자신(`./`)은 벗기면 빈 문자열이라 정규화의 대상이 아니다.
        if (path !== '') {
          assert.equal(posix.normalize(path), path, `${locale}: ${reference} 가 정규화되지 않은 경로다`);
        }
      }
    }
  }

  // ⛔ 낡은 선언은 판정 실패다 — 선언한 비-파일이 실제로 불려야 하고, 사유가 붙어 있어야 한다.
  for (const target of nonFileTargets) {
    assert.ok([...seen].some((path) => target.match.test(path)), `선언이 가리키는 참조가 0 건이다: ${target.match.source}`);
    assert.ok(target.why.length >= 8, `비-파일 선언에 사유가 없다: ${target.match.source}`);
  }
  for (const asset of assetClasses) {
    assert.ok([...seen].some((path) => asset.match.test(path)), `성질 선언 ${asset.id} 이 가리키는 참조가 0 건이다`);
    assert.ok(asset.why.length >= 8, `성질 선언 ${asset.id} 에 사유가 없다`);
  }

  // ⭐ 형제 로케일이 **분모 전수**다 — ⛔ 로케일 수를 적지 않는다.
  const siblings = [...seen].filter((path) => /^\.\.\/[a-z]+\/$/.test(path)).sort();
  assert.deepEqual(siblings, LOCALES.map((locale) => `../${locale}/`).sort(), '고르개의 분모가 LOCALES 와 다르다');

  // 음성 대조군 — 깨진 참조를 **실제로 심으면** 빨갛다.
  assert.equal(verdictOf('/styles.css', out), 'file');
  assert.equal(verdictOf('/diagnosis/src/main.js', out), 'tsc');
  assert.equal(verdictOf('/diagnosis/src/nope.js', out), 'broken', '없는 소스를 가리키는 산출이 초록이다');
  assert.equal(verdictOf('/missing.css', out), 'broken', '없는 파일이 초록이다');
});

/* ───────────────── 생성기의 규율 — 빠뜨림이 조용히 지나가지 않는다 ───────────────── */

test('자리와 키는 1:1 이다: 모르는 자리도 쓰이지 않는 키도 판정 실패다', () => {
  const canon = LOCALES[0];

  assert.throws(
    () => renderDocument(readChrome(), `${template()}\n{{nope.nope}}\n`, 'page', canon),
    /unknown slot/,
    '모르는 자리를 조용히 통과시켰다 — 선언되지 않은 산문이 빈 칸으로 발행된다',
  );

  assert.throws(
    // ⭐ `lede` 는 **크롬의 자리**다(히어로는 문서 둘이 같이 쓴다) — 심는 자리가 그쪽이다.
    () => renderDocument(readChrome().replace('{{lede}}', ''), template(), 'page', canon),
    /never calls lede/,
    '쓰이지 않는 키를 조용히 통과시켰다 — 낡은 선언이고, 발행본에는 그 산문이 0 이다',
  );

  // ⭐ 자리의 수가 카탈로그의 키 수와 같다 — 하나라도 어긋나면 위 둘 중 하나가 던진다.
  const keys = Object.keys(substitutions(CATALOG[canon], 'page', readLockup()));
  assert.ok(keys.length > 0, '부를 수 있는 자리가 0 이다');
  // ⭐ 분모는 **크롬 + 그 문서의 본문**이다 — 문서가 받는 자리가 그 합이고, 본문만 보면
  //   크롬의 자리 전부가 「부르지 않는 키」로 세어진다.
  const whole = templateOf(readChrome(), template());
  assert.deepEqual(
    keys.filter((key) => !whole.includes(`${key}}}`)),
    [],
    '틀이 부르지 않는 키가 있다',
  );
});

test('산문은 이스케이프된다: 카탈로그가 발행본의 구조를 바꾸지 못한다', () => {
  // ⭐ 꺾쇠가 섞인 자구는 발행본에서 **글자**로 남는다 — 산문은 구조를 바꾸지 못한다.
  const injected = ['<', 'script>alert(1)</', 'script>'].join('');
  const rendered = renderSlot(injected, 'prose', 'harness');
  assert.doesNotMatch(rendered, /<script/, '산문이 태그로 섰다');
  assert.match(rendered, /&lt;/, '이스케이프가 돌지 않았다');
  assert.equal(renderSlot('a & b', 'plain', 'harness'), 'a &amp; b');
  assert.equal(renderSlot('say "x"', 'plain', 'harness'), 'say &quot;x&quot;');

  // 강조 표식의 짝이 맞지 않으면 던진다 — 한쪽만 쓴 자구는 오타다.
  assert.throws(() => renderSlot('a *b', 'prose', 'harness'), /unbalanced/);
  assert.throws(() => renderSlot('a `b', 'prose', 'harness'), /unbalanced/);
  // 속성 자리는 마크업을 들 수 없다 — 들면 속성 안에 태그가 선다.
  assert.throws(() => renderSlot('a *b* c', 'plain', 'harness'), /plain slot/);
  assert.throws(() => renderDocument(readChrome(), '<p title="{{plain:scaffold.body}}">x</p>', 'page', LOCALES[0]), /plain slot/);
});

test('인라인 강조가 태그로 선다: 문장이 마크업으로 토막나지 않았다', () => {
  // ⭐ 발행본에서 실제로 서 있는지를 함께 문다 — 자리 하나만 돌려 보면 틀의 배선은 미판정이다.
  assert.match(
    documents()[LOCALES[0]],
    /<code class="mono">graduand\.json<\/code>/,
    '코드 조각이 발행본에서 태그로 서지 않았다',
  );

  // 그리고 **두 벌 모두** 강조의 자리를 든다 — 번역이 강조를 잃으면 문장의 무게가 달라진다.
  // ⭐ **수를 적지 않는다**: 정본의 수를 분모로 삼고 번역이 그것과 같은지 묻는다 — 적어 두면
  //    자구가 움직인 날 뜻 없이 깨진다(실제로 한 번 그랬다: 스텁 고지가 걷히며 둘이 하나가 됐다).
  const canonMarks = (renderSlot(CATALOG[LOCALES[0]].page.cta.choiceNote, 'prose', LOCALES[0]).match(/<strong>/g) ?? []).length;
  assert.ok(canonMarks > 0, '정본이 강조의 자리를 하나도 들지 않는다 — 이 단정의 분모가 사라졌다');
  for (const locale of LOCALES) {
    const html = renderSlot(CATALOG[locale].page.cta.choiceNote, 'prose', locale);
    assert.equal((html.match(/<strong>/g) ?? []).length, canonMarks, `${locale}: 강조의 자리가 정본과 다르다`);
    assert.equal((html.match(/<\/strong>/g) ?? []).length, canonMarks, `${locale}: 강조가 닫히지 않았다`);
  }
});

/* ───────────────── 브랜드 — 정본에서 읽고, 사본을 만들지 않는다 ───────────────── */

/**
 * ⭐⭐ **AC2 — 발행본의 심볼이 마스터와 같다.** 그런데 **대조가 아니라 유도**다: 틀에는
 * 좌표가 한 글자도 없고, 생성기가 브랜드 정본을 **읽어** 인라인한다. ⇒ 사본이 애초에
 * 생기지 않는다.
 *
 * ⚠️ 그래도 이 단정이 비어 있지 않다 — 생성기가 껍데기를 다시 적으므로 **안쪽 도형을
 * 상하게 할 수 있다.** 아래가 무는 것이 그 자리다: 정본의 안쪽과 발행본의 안쪽이 같은가.
 * ⭐ 그리고 정본이 작도(수의 정본)와 1:1 인지는 `docs/brand/symbol.test.mjs` 가 이미 문다 —
 * 여기에 그 사본을 만들지 않는다. 둘이 맞물려 「발행본 == 작도」가 선다.
 */
test('AC2 — 발행본의 락업이 브랜드 정본의 도형 그대로다', () => {
  const canon = lockupShapes(readLockup());
  assert.ok(canon.includes('<circle'), '정본에서 도형을 뽑지 못했다 — 추출기가 낡았다');
  assert.doesNotMatch(canon, /<!--/, '정본의 주석이 남았다');

  for (const [locale, html] of Object.entries(documents())) {
    const marks = [...html.matchAll(/<svg class="lockup"[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => m[1]!);
    assert.equal(marks.length, 2, `${locale}: 락업이 둘(GNB · 푸터)이 아니다`);
    for (const mark of marks) {
      assert.equal(mark, canon, `${locale}: 발행본의 도형이 정본과 다르다`);
    }
  }

  // ⛔ 틀에는 좌표가 **없다** — 있으면 그것이 사본이고, 씨값이 움직이는 날 갈라진다.
  assert.doesNotMatch(template(), /<path\b/, '틀이 도형을 들고 있다 — 사본이다');
  assert.doesNotMatch(template(), /<circle\b/, '틀이 도형을 들고 있다 — 사본이다');

  // 음성 대조군 — 정본의 좌표를 **한 값이라도** 바꾸면 빨갛다.
  const tampered = readLockup().replace('r="11"', 'r="12"');
  assert.notEqual(lockupShapes(tampered), canon, '마스터를 바꿨는데 같다고 한다 — 하네스가 고장났다');
  const planted = renderDocument(readChrome(), template(), 'page', LOCALES[0], tampered);
  assert.ok(!planted.includes(canon), '바꾼 마스터로 낸 발행본이 정본과 같다고 한다');
});

test('AC2 — 인라인이 안 되는 브랜드 자산을 빌드가 발행 루트로 나른다', () => {
  const brandDist = join(ROOT, dirname(BRAND_LOCKUP));
  for (const asset of CARRIED_ASSETS) {
    assert.ok(existsSync(join(brandDist, asset)), `브랜드가 굽는 ${asset} 이 없다 — 선언이 낡았다`);
  }
  const out = generateInto();
  for (const asset of CARRIED_ASSETS) {
    assert.ok(existsSync(join(out, asset)), `${asset} 이 발행 루트로 날라지지 않았다`);
    assert.ok(
      readFileSync(join(out, asset)).equals(readFileSync(join(brandDist, asset))),
      `${asset} 이 브랜드 정본과 바이트가 다르다 — 손으로 고쳤거나 낡았다`,
    );
  }

  // ⭐ 손글씨 화면 한 벌도 같은 자리로 간다 — 발행 루트가 곧 사이트다.
  for (const asset of PACKAGE_ASSETS) {
    assert.ok(
      readFileSync(join(out, asset)).equals(readFileSync(join(ROOT, asset))),
      `${asset} 이 이 패키지의 것과 바이트가 다르다`,
    );
  }

  // ⚠️ 나른 것은 **생성물**이라 커밋하지 않는다 — ⭐ 이제 선언이 **한 줄**이다: 발행 루트
  //   하나가 통째로 무시되므로 자산마다 줄을 더하지 않는다(줄이 늘면 낡는 자리도 는다).
  const ignored = readFileSync(join(ROOT, '..', '.gitignore'), 'utf8');
  assert.match(ignored, new RegExp(`diagnosis/${DEFAULT_OUT}/`), '발행 루트가 .gitignore 에 없다');
  for (const asset of [...CARRIED_ASSETS, ...PACKAGE_ASSETS]) {
    // ⛔ 패키지 루트에 **사본이 남아 있지 않다** — 전 모양의 잔재이고, 잔재는 갈라진다.
    const stale = CARRIED_ASSETS.includes(asset) && existsSync(join(ROOT, asset));
    assert.ok(!stale, `${asset} 의 옛 사본이 패키지 루트에 남아 있다`);
  }
});

test('저작권 끝 연도를 빌드가 주입한다: 시계를 옮기면 발행본이 함께 움직인다', () => {
  const [earlier, later] = [new Date('2026-06-01T00:00:00Z'), new Date('2031-06-01T00:00:00Z')];
  const canon = LOCALES[0];
  const before = renderDocument(readChrome(), template(), 'page', canon, readLockup(), earlier);
  const after = renderDocument(readChrome(), template(), 'page', canon, readLockup(), later);
  assert.notEqual(before, after, '시계를 5년 옮겼는데 발행본이 그대로다 — 연도가 리터럴로 박혔다');
  assert.ok(after.includes('2031'), '옮긴 시계의 연도가 발행본에 없다');
  assert.ok(!before.includes('2031'), '옮기기 전 발행본이 미래의 연도를 든다');
});

/* ───────────────── AC1 · AC2 — 색인 선언 ───────────────── */

/**
 * ⭐⭐ **AC2 — canonical 과 hreflang 이 한 식에서 난다.**
 *
 * 단정이 둘이고 층이 다르다. ⑴ **소스에서** — 절대 주소의 출처가 상수 하나이고, 그 상수를
 * 문서 주소로 바꾸는 함수가 하나다. ⑵ **발행본에서** — 그렇게 난 값 말고 다른 주소가
 * canonical·hreflang·`og:url` 에 서 있지 않다. 소스만 보면 「다른 자리에서 손으로 적었는가」를
 * 못 보고, 발행본만 보면 「다음 사람이 두 번째 손을 만들 수 있는가」를 못 본다.
 */
test('AC2 — canonical · hreflang · og:url 이 전부 한 손에서 난다', () => {
  // ⑴ 소스 — 절대 주소의 자구가 **이 패키지에 한 번만** 선다.
  const sources = readdirSync(join(ROOT, 'src'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: read(join('src', name)) }));
  const carrying = sources.filter((file) => file.text.includes(SITE_ORIGIN));
  assert.deepEqual(
    carrying.map((file) => file.name),
    ['site.ts'],
    '절대 주소가 한 자리 밖에서도 선다 — 사본이고, 사본은 갈라진다',
  );

  // ⑵ 발행본 — 선 주소 전수가 그 손에서 난 값이다.
  const fromTheHand = new Set([
    ...LOCALES.map((locale) => documentUrl(locale, 'page')),
    rootAssetUrl(OG_IMAGE_FILE),
  ]);
  for (const [locale, html] of Object.entries(documents())) {
    const absolute = [...html.matchAll(new RegExp(`${SITE_ORIGIN.replaceAll('.', '\\.')}[^"]*`, 'g'))].map(
      (match) => match[0],
    );
    assert.ok(absolute.length > 0, `${locale}: 색인 선언이 0 이다`);
    for (const url of absolute) {
      assert.ok(fromTheHand.has(url), `${locale}: 손에서 나지 않은 주소다 — ${url}`);
    }

    const canonical = /<link rel="canonical" href="([^"]*)">/.exec(html)?.[1];
    assert.equal(canonical, documentUrl(locale as Locale, 'page'), `${locale}: canonical 이 자기 주소가 아니다`);
    assert.equal(
      /<meta property="og:url" content="([^"]*)">/.exec(html)?.[1],
      canonical,
      `${locale}: og:url 과 canonical 이 갈라졌다`,
    );
  }
});

/**
 * ⭐⭐ **AC1 — 색인 선언이 두 문서를 가리킨다.** ⛔ 로케일 **수**를 적지 않는다: 분모가
 * `LOCALES` 이고, `x-default` 가 루트 리다이렉트의 대상과 **같은 문서**인지까지 센다.
 */
test('AC1 — 두 문서가 서로를 hreflang 으로 가리키고 x-default 가 기본 로케일이다', () => {
  assert.ok(LOCALES.includes(DEFAULT_LOCALE), '기본 로케일이 분모 밖이다');

  const expected = alternates('page').map(({ hreflang, url }) => `${hreflang} ${url}`).sort();
  for (const [locale, html] of Object.entries(documents())) {
    const declared = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g)]
      .map((match) => `${match[1]!} ${match[2]!}`)
      .sort();
    assert.deepEqual(declared, expected, `${locale}: hreflang 묶음이 분모와 다르다`);
  }

  // sitemap 이 **둘을 전부** 열거한다 — 발견이 리다이렉트에 기대지 않는 자리다.
  const sitemap = sitemapXml();
  for (const locale of LOCALES) {
    assert.ok(sitemap.includes(`<loc>${documentUrl(locale, 'page')}</loc>`), `sitemap 에 ${locale} 이 없다`);
  }
  assert.ok(
    sitemap.includes(`hreflang="x-default" href="${documentUrl(DEFAULT_LOCALE, 'page')}"`),
    'sitemap 의 x-default 가 기본 로케일이 아니다',
  );
  assert.ok(robotsTxt().includes(rootAssetUrl(SITEMAP_FILE)), 'robots 가 sitemap 을 가리키지 않는다');
});
