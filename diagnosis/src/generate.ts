/**
 * 발행 생성기 — 템플릿 한 벌 + 카탈로그 두 벌에서 **로케일마다 문서 하나**를 낸다.
 *
 * ⭐⭐ **왜 생성기인가.** 길이 셋이었다. ⛔ **손글씨 둘**은 구조가 두 벌이 되어 한쪽만
 * 고치는 날 갈라진다 — 이 제품이 파는 바로 그 결함이라 자기에게 먼저 적용한다.
 * ⛔ **런타임 채우기**는 「문구를 런타임에 채우면 **스크립트를 끈 방문자가 받는 바이트에
 * 산문이 0**」에 걸린다(README 축자) — 구독 입구를 JS 없이 눌리게 둔 이유를 정면으로 지운다.
 * ⇒ 남는 것은 **빌드 타임에 바이트로 박는** 길 하나다.
 *
 * ⭕ **「런타임 의존 0」은 깨지지 않는다** — 그것은 **발행본의 성질**이고 빌드 타임 의존은
 * 다른 축이다. 발행본은 여전히 정적 HTML + `dist/` 다. ⚠️ 그리고 이 파일 자신도 **외부
 * 의존 0** 이다(`node:` 표준 모듈뿐) — 이 저장소의 래스터라이저·배달 스크립트와 같은 규율이다.
 *
 * ⭐ **이 파일은 브라우저로 가지 않는다** — `tsconfig.build.json` 이 내는 것은 `src/main.ts`
 * 의 그래프뿐이고, 여기는 그 밖이다. 그래서 공개 경계 가드의 「페이지 코드」 분모에서
 * 사유와 함께 빠진다(`boundary.test.ts`) — 빠지는 것은 **배선 금칙**이고, 내부 자산 ·
 * 밖으로 나가는 주소 · 하드코딩 한글 금칙은 그대로 받는다.
 *
 * ⚠️ **빠뜨림은 조용히 지나가지 않는다.** 템플릿의 자리와 카탈로그의 키는 **1:1 이어야**
 * 하고, 어느 쪽이 어긋나도 생성기가 **던진다** — 모르는 자리(선언되지 않은 산문)도,
 * 쓰이지 않는 키(낡은 선언)도 판정 실패다. 조용히 빈 문자열을 박으면 발행본에 **말이 없는
 * 자리**가 서고, 그것을 알아차릴 길이 없다.
 *
 *   node src/generate.ts [--out <경로>]        # 기본 --out dist
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VALUE_ADAPTERS } from '../../verifier/src/index.ts';
import { LOCALE_NAMES } from './locale-names.ts';
import { copyrightLine, PUBLISHER, PUBLISHER_ROWS } from './publisher.ts';
import {
  alternates,
  DOCUMENTS,
  documentPath,
  documentUrl,
  localeRootPath,
  OG_IMAGE_FILE,
  REDIRECTS_FILE,
  redirectsFile,
  ROBOTS_FILE,
  robotsTxt,
  rootAssetUrl,
  siblingDocumentPath,
  siblingLocalePath,
  SITEMAP_FILE,
  sitemapXml,
  type DocumentId,
} from './site.ts';
import { CATALOG, LOCALES, type Locale, type Strings } from './strings.ts';

/** 원페이지의 틀 — 손으로 쓰는 **본문**이다(산문은 0 이고, 크롬은 아래가 든다). */
export const TEMPLATE_FILE = 'template.html';

/**
 * ⭐⭐ **크롬이 한 자리에 모였다** — head · GNB · 히어로 틀 · 푸터는 **문서 둘이 같이**
 * 쓴다. 틀 둘에 베끼면 한쪽만 고치는 날 갈라지고, 그것이 생성기가 애초에 선 사유다
 * (⛔ 손글씨 둘 기각). 문서의 본문이 들어오는 자리는 `{{raw:body}}` **하나**다.
 */
export const CHROME_FILE = 'chrome.html';

/** 문서마다 본문 틀 하나 — ⛔ 열거는 닫혀 있고 `DOCUMENTS` 가 분모다(`Record` 가 집행한다). */
export const TEMPLATES: Readonly<Record<DocumentId, string>> = {
  page: TEMPLATE_FILE,
  constitution: 'template-constitution.html',
};

/**
 * 문서마다 페이지 스크립트 하나 — ⭐ 경로는 **루트 절대**이고 로케일 불변이다. 둘째 문서가
 * 원페이지의 스크립트를 받으면 없는 `id` 를 찾다 던지므로, 자리를 문서가 고른다.
 */
export const PAGE_SCRIPTS: Readonly<Record<DocumentId, string>> = {
  page: 'main',
  constitution: 'constitution-main',
};

/** 발행본의 이름 — 로케일 디렉터리 하나에 문서 하나. */
export const DOCUMENT_FILE = 'index.html';

/** 손으로 쓰는 것 전수 — 크롬 하나 + 문서마다 본문 하나. ⭐ 가드가 금칙을 심은 벌로 같은 유도를 돌린다. */
export type Sources = Readonly<Record<'chrome' | DocumentId, string>>;

/** 기본 산출 자리 — 이 패키지의 다른 산출(`tsc`)과 같은 폴더다. */
export const DEFAULT_OUT = 'dist';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');


/**
 * 자리의 꼴 — `{{키}}` 는 **산문**(이스케이프 + 인라인 강조), `{{plain:키}}` 는 **속성과
 * `<title>`**(이스케이프만).
 *
 * ⚠️ 두 꼴을 **템플릿이 고른다** — 생성기가 문맥을 추측하면 속성 안에 `<strong>` 이 들어가는
 * 날이 온다. 선언이 분모다.
 */
const PLACEHOLDER = /\{\{(?:(plain|raw):)?([A-Za-z][\w.]*)\}\}/g;

/** 인라인 강조의 표식 둘 — 짝이 맞지 않으면 던진다(한쪽만 쓴 자구는 오타다). */
const MARKERS = ['`', '*'] as const;

/**
 * 자리의 성질 — `prose` 는 본문(강조가 태그로 선다), `plain` 은 속성과 `<title>`,
 * `raw` 는 **생성기가 지은 마크업**이다.
 *
 * ⚠️⚠️ `raw` 는 이스케이프를 **건너뛴다** — 그래서 그 자리는 카탈로그가 채울 수 없다.
 * 아래 `RAW_SLOTS` 에 열거된 키만 raw 로 설 수 있고, 그 넷은 전부 **이 파일이 지은 것**
 * (브랜드 정본에서 읽은 도형 · `LOCALES` 에서 유도한 목록 · 법정 행)이다. 산문이 여기
 * 흘러들면 카탈로그가 발행본의 구조를 바꿀 수 있게 되므로, 생성기가 그것을 막는다.
 */
export type SlotMode = 'prose' | 'plain' | 'raw';

/** `raw` 로 설 수 있는 자리 전수 — ⛔ 카탈로그의 키는 하나도 들어오지 않는다. */
const RAW_SLOTS: readonly string[] = [
  'lockup',
  'localeOptions',
  'localeList',
  'publisherRows',
  'indexing',
  'openGraph',
  // ⭐ 제품 컬럼은 **문서마다 자기 블록을 가리킨다** — 같은 목록을 두 문서에 세우면 둘째
  //   문서의 닻이 없는 `id` 를 가리키고(잘못 선언한 것이라 판정 실패다) 정책 경로도 한 칸
  //   어긋난다. 그래서 생성기가 짓는다 — `publisherRows` 와 같은 급의 자리다.
  'productLinks',
  // 브랜드 링크의 `aria-current` — 원페이지에서는 자기를 가리키고 둘째 문서에서는 **아니다**.
  // 속성 하나를 문서가 고르므로 생성기가 짓는다(카탈로그의 자구가 아니다).
  'homeCurrent',
];

/**
 * 브랜드 정본 — ⭐ **사본을 만들지 않는다.** 락업의 도형은 `docs/brand/` 가 정본이고
 * (수의 정본은 `lib/geometry.mjs`, 자산은 그 함수로 구워진다) 생성기가 **그것을 읽어**
 * 발행본에 인라인한다. 템플릿에 좌표를 적으면 사본이 하나 늘고, 그 사본은 씨값이 움직이는
 * 날 조용히 갈라진다 — 이 제품이 파는 바로 그 결함이다.
 *
 * ⛔ 파일 참조가 아니라 **인라인**인 이유: 배달 범위 선언에 `docs/brand/` 가 없고, 그 폴더는
 * 내부 근거 산문이 같이 든 자리라 범위에 넣지 않는다. 인라인은 발행본에 도형만 남긴다.
 */
export const BRAND_LOCKUP = join('..', 'docs', 'brand', 'dist', 'graduand-lockup.svg');

/**
 * 브랜드가 굽고 생성기가 **이 패키지로 나르는** 자산 — ⭕ 복사가 **선언된 생성물**이면
 * 사본이 아니다. 인라인이 안 되는 것들이다(파비콘은 CSS 맥락 없이 혼자 뜬다).
 *
 * ⭕ **`og.png` 가 여기 있다 — 그 ⬜ 가 닫혔다.** 전에는 없었고 사유가 「Open Graph 의 이미지는
 * **절대 주소**를 요구하는데 이 저장소는 발행본에 절대 주소를 박지 않는다」였다. ⇒ 그 막음을
 * 푼 것은 **절대 주소를 내는 손 하나**다(`rootAssetUrl` — canonical·hreflang·sitemap 과 같은
 * 식에서 난다): 주소가 박히지 않고 **유도되므로** 발행 출처가 움직이는 날 함께 움직인다.
 * ⚠️ 이 주석이 목록보다 늦게 움직였다 — 바로 아래 열거가 이미 그것을 들고 있었는데도
 * 「여기 없다」고 적고 있었다(2026-10-28 실측). 산문은 가드가 없으면 조용히 낡는다.
 */
export const CARRIED_ASSETS: readonly string[] = [
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  OG_IMAGE_FILE,
];

/**
 * 이 패키지가 손으로 쓰고 **발행 루트로 나르는** 것 — 화면 한 벌이다.
 *
 * ⭐⭐ **발행 루트가 이제 실재하는 디렉터리다.** 전에는 「이 패키지 폴더를 그대로 서빙하면
 * 선다」였고 문서가 `dist/<로케일>/` 에 났다 — 그 모양은 `/ko/` 가 아니라 `/dist/ko/` 라서
 * 결의된 주소가 아니었고, 그 폴더를 통째로 서빙하면 `src/`·`package.json` 까지 나간다.
 * ⇒ 산출 디렉터리 하나가 **곧 사이트**이고, 호스팅 선언이 그 디렉터리를 가리킨다.
 */
export const PACKAGE_ASSETS: readonly string[] = ['styles.css'];
/** 브랜드 정본의 락업 — 읽는 자리가 **하나**다(사본이 생기지 않는 조건). */
export const readLockup = (root: string = PACKAGE_ROOT): string =>
  readFileSync(join(root, BRAND_LOCKUP), 'utf8');

/** 크롬 한 벌 — 문서 둘이 같이 쓴다. */
export const readChrome = (root: string = PACKAGE_ROOT): string =>
  readFileSync(join(root, CHROME_FILE), 'utf8');

/** 손으로 쓰는 것 전수를 읽는다 — ⭐ 열거는 `TEMPLATES` 가 들고 여기서 베끼지 않는다. */
export const readSources = (root: string = PACKAGE_ROOT): Sources =>
  ({
    chrome: readChrome(root),
    ...Object.fromEntries(
      DOCUMENTS.map((doc) => [doc, readFileSync(join(root, TEMPLATES[doc]), 'utf8')]),
    ),
  }) as Sources;

/**
 * 틀의 주석을 벗긴 것 — ⭐ 생성기와 가드가 **같은 한 손**을 쓴다. 가드가 자기 벗기기를
 * 따로 짜면 「발행본에 주석이 0」과 「틀에서 벗긴 뒤 한글이 0」이 서로 다른 것을 재게 된다.
 */
export const withoutHtmlComments = (text: string): string =>
  // ⚠️ 주석 **줄**을 통째로 벗긴다 — 앞의 들여쓰기를 남기면 다음 줄이 두 번 들여써진다.
  text.replace(/[ \t]*<!--[\s\S]*?-->\n?/g, '');

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return '&quot;';
    }
  });

/**
 * 표식 쌍을 태그로 — ⭐ **이스케이프한 뒤에** 돈다: 그래서 카탈로그가 마크업을 들고 있는
 * 것이 아니고, 산문에 섞인 `<` 는 발행본에서 글자로 남는다.
 */
function inlineMarkup(escaped: string, path: string): string {
  let out = escaped;
  for (const marker of MARKERS) {
    const count = out.split(marker).length - 1;
    if (count % 2 !== 0) {
      throw new Error(`${path}: unbalanced ${marker} in prose (${count})`);
    }
    const open = marker === '`' ? '<code class="mono">' : '<strong>';
    const close = marker === '`' ? '</code>' : '</strong>';
    let opening = true;
    out = out.replaceAll(marker, () => {
      const tag = opening ? open : close;
      opening = !opening;
      return tag;
    });
  }
  return out;
}

/**
 * 락업 — 정본 SVG 에서 **도형만** 가져온다.
 *
 * ⭐ 바꾸는 것은 **껍데기뿐**이다: 주석을 벗기고, 바깥 `<svg>` 의 속성을 이 자리에 맞게
 * 다시 적는다(이름은 감싸는 `<a>` 가 지므로 도형은 `aria-hidden`). 안쪽 도형은 **한 글자도
 * 건드리지 않는다** — 가드가 정본의 안쪽과 발행본의 안쪽을 그대로 대조한다.
 */
export function inlineLockup(svg: string): string {
  const viewBox = /viewBox="([^"]*)"/.exec(svg)?.[1];
  if (viewBox === undefined) throw new Error('brand lockup has no viewBox');
  const inner = lockupShapes(svg);
  return `<svg class="lockup" viewBox="${viewBox}" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** 정본과 발행본이 **같은 손으로** 뽑히는 안쪽 도형 — 가드가 이 함수로 양쪽을 뽑아 댄다. */
export function lockupShapes(svg: string): string {
  return withoutHtmlComments(svg)
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .trim();
}

/**
 * 로케일 고르개 — ⛔ **협상이 아니다.** 사람이 눌러 주소가 바뀌는 것은 협상이 아니고,
 * 기전은 **평앵커**라 자바스크립트가 0 이다(`<details>` 는 템플릿이 든다).
 *
 * ⚠️ href 가 **형제 상대 경로**(`../<로케일>/`)다 — 로케일 접두를 박지 않으므로 발행본이
 * 어느 깊이에 놓여도 형제를 가리킨다. ⛔ 로케일 **수**를 적지 않는다: `LOCALES` 가 분모다.
 */
function localeLinks(current: Locale, doc: DocumentId): string {
  return LOCALES.map((locale) => {
    const name = escapeHtml(LOCALE_NAMES[locale]);
    const here = locale === current ? ' aria-current="page"' : '';
    const href = siblingLocalePath(locale, doc);
    return `<li><a href="${href}" lang="${locale}" hreflang="${locale}"${here}>${name}</a></li>`;
  }).join('');
}

/**
 * 제품 컬럼의 줄들 — ⭐⭐ **문서마다 자기 블록을 가리킨다.** 원페이지는 같은 문서의 닻 둘
 * (요금제 · FAQ)과 둘째 문서로 가는 줄을, 둘째 문서는 **자기** 블록 둘(헌법 관리 · 관측)과
 * 원페이지로 돌아오는 줄을 든다. 해지 입구는 로케일 불변이라 루트 절대 경로다.
 *
 * ⭐ 그래서 「닻은 실재하는 블록만 가리킨다」가 문서 둘에서 **그대로** 돈다 — 가드를 고치지
 * 않고 분모가 넓어졌다. ⛔ 같은 목록을 두 문서에 세우는 길은 그 단정을 깨뜨린다.
 */
function productLinks(strings: Strings, doc: DocumentId): string {
  const { footer } = strings.page;
  const rows: readonly (readonly [string, string])[] =
    doc === 'page'
      ? [
          ['#cta', footer.pricing],
          ['#faq', strings.page.faq.title],
          [siblingDocumentPath('page', 'constitution'), footer.constitution],
          ['/portal/', footer.portal],
        ]
      : [
          ['#hold', strings.constitution.hold.label],
          // ⭐ 판정은 **루트의 진단**이 보여준다 — 이 문서에 그 자리가 없으므로 링크가 거기로 간다.
          [siblingDocumentPath('constitution', 'page'), footer.diagnosis],
          ['/portal/', footer.portal],
        ];
  return rows
    .map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`)
    .join('\n          ');
}

/**
 * 법정 게시 여섯 행 — 값은 로케일 불변(`PUBLISHER_ROWS`)이고 **라벨만** 카탈로그가 든다.
 * ⭐ 문의 한 행만 링크다 — 눌러서 메일을 열 수 있어야 하고, 탭 타깃 하한을 진다.
 */
function publisherRows(strings: Strings): string {
  const labels = strings.page.footer.publisher;
  return PUBLISHER_ROWS.map((row) => {
    const label = escapeHtml(labels[row.labelKey]);
    const value = escapeHtml(row.value);
    const shown =
      row.kind === 'email'
        ? `<a class="publisher-mail" href="mailto:${value}">${value}</a>`
        : `<span class="publisher-value">${value}</span>`;
    return `<span class="publisher-row"><span class="publisher-label">${label}</span>${shown}</span>`;
  }).join('');
}

/**
 * 템플릿이 부를 수 있는 자리 전수 — ⭐⭐ **여기가 타입의 집행 자리다.** 아래 한 줄 한 줄이
 * `Strings` 의 실재하는 자리를 읽으므로, 카탈로그의 키가 움직이면 `tsc` 가 막는다. 템플릿의
 * 문자열과 맞는지는 타입이 볼 수 없어 **생성기가 런타임에** 양방향으로 문다.
 *
 * ⛔ **법정 게시 항목의 값은 로케일을 타지 않는다** — 라벨만 카탈로그에서 오고, 값은
 * `PUBLISHER` 한 벌이다. 그래서 「번역 벌에 한글 0」 가드가 이 값들을 보지 않는다:
 * 카탈로그에 없기 때문이다.
 */
export function substitutions(
  strings: Strings,
  doc: DocumentId,
  lockup: string,
  now: Date = new Date(),
): Readonly<Record<string, string>> {
  return { ...chromeSlots(strings, doc, lockup, now), ...bodySlots(strings, doc) };
}

/**
 * 크롬의 자리들 — **문서 둘이 같이** 받는다. ⭐ 제목 · 설명 · 히어로 둘은 크롬의 자리이되
 * **값은 그 문서의 절**에서 온다: 틀은 하나이고 자구는 문서마다다.
 */
function chromeSlots(
  strings: Strings,
  doc: DocumentId,
  lockup: string,
  now: Date,
): Readonly<Record<string, string>> {
  const { page } = strings;
  // ⭐ 제목·설명·히어로의 자리가 문서마다 다른 절을 읽는다 — `Record` 가 아니라 분기인
  //   이유는 절의 **모양이 다르기** 때문이다(원페이지는 블록 여덟, 둘째 문서는 둘).
  const head = doc === 'page' ? strings.page : strings.constitution;
  return {
    locale: strings.locale,

    lockup: inlineLockup(lockup),
    localeOptions: localeLinks(strings.locale, doc),
    localeList: localeLinks(strings.locale, doc),
    publisherRows: publisherRows(strings),
    indexing: indexingLinks(strings.locale, doc),
    openGraph: openGraph(head, strings.locale, doc),
    productLinks: productLinks(strings, doc),
    // ⭐ 원페이지에서 브랜드 링크는 **자기를 가리킨다**(정지 상태의 홈). 둘째 문서에서는
    //   그 링크가 원페이지로 가므로 `aria-current` 가 **거짓**이 된다 — 속성을 문서가 고른다.
    homeCurrent: doc === 'page' ? ' aria-current="page"' : '',
    // 이 문서에서 **그 로케일의 루트**로 가는 상대 경로 — 정책 문서 셋이 거기 산다.
    localeRoot: localeRootPath(doc),
    scriptPath: `/diagnosis/src/${PAGE_SCRIPTS[doc]}.js`,

    'nav.label': page.nav.label,
    'nav.home': page.nav.home,
    'nav.localeLabel': page.nav.localeLabel,

    title: head.title,
    description: head.description,
    heading: head.heading,
    lede: head.lede,

    'footer.privacy': page.footer.privacy,
    'footer.terms': page.footer.terms,
    'footer.refunds': page.footer.refunds,
    'footer.companyHeading': page.footer.companyHeading,
    'footer.newWindow': page.footer.newWindow,
    'footer.contact': page.footer.contact,
    'footer.productHeading': page.footer.productHeading,
    'footer.legalHeading': page.footer.legalHeading,
    'footer.languagesHeading': page.footer.languagesHeading,
    'footer.publisherLabel': page.footer.publisher.label,

    'publisher.about': PUBLISHER.about,
    'publisher.contactMail': `mailto:${PUBLISHER.contact}`,
    // ⭐ 끝 연도는 **적지 않고 뽑는다** — 리터럴로 박으면 발행본과 가드가 같이 낡는다.
    'publisher.copyright': copyrightLine(now),
  };
}

/**
 * 터미널 걸음의 **실례 한 벌** — ⭐⭐ 값이 자리표(`<이름>`)가 아니라 **실물**인 것이 결정이다.
 *
 * ⚠️⚠️ **사유가 가드다.** 둘째 문서의 명령 틀은 전까지 **0 건**이었고, 그 0 을 단정으로 쥔
 * 가드의 사유가 축자로 「쓰는 명령의 한 줄은 고객의 값(플래그)을 품어야 해서 이 가드가
 * **돌려 볼 수 없다**」였다. 걸음을 세우려면 그 사유를 풀어야 하고, 푸는 길은 둘뿐이었다 —
 * ⛔ 자리표를 적고 가드를 걷는 길(그러면 광고와 실물이 어긋날 수 있다), ⭕ **실물 값을 적고
 * 가드가 그 값으로 픽스처를 짓는 길**. 뒤를 골랐다: 가드는 이 명령들을 **뽑아서 돌린다**.
 *
 * ⭐ **어댑터 이름은 등록부에서 읽는다** — 적으면 사본이고, 사본은 등록부가 움직이는 날
 * 조용히 갈라진다(화면이 그 이름을 적지 않는 그 규율과 같은 자리다).
 *
 * ⛔ 자리를 카탈로그에 두지 않는다 — 로케일 불변이고, 두 벌이 같은 명령을 각자 적으면 그
 * 둘이 갈라지는 날 한쪽 독자가 받는 한 줄이 실물과 어긋난다.
 */
const CLI_EXAMPLE = {
  axis: 'design',
  adapter: VALUE_ADAPTERS[0]!.id,
  file: 'tokens.css',
  scope: ':root',
  canonRepo: 'acme/design',
  /** 정본 체크아웃의 **상대 경로** — 연결 걸음의 시야가 거기서 온다. */
  canonRoot: '../design',
} as const;

/** 걸음 넷의 명령 — ⭐ 한 벌에서 짓는다(위 상수가 분모다). */
const CLI_COMMANDS = {
  canon: `npx graduand canon --axis ${CLI_EXAMPLE.axis} --adapter ${CLI_EXAMPLE.adapter} --file ${CLI_EXAMPLE.file} --scope ${CLI_EXAMPLE.scope}`,
  link: `npx graduand link --axis ${CLI_EXAMPLE.axis} --canon ${CLI_EXAMPLE.canonRepo} --canon-file ${CLI_EXAMPLE.file} --canon-scope ${CLI_EXAMPLE.scope} --root . --root ${CLI_EXAMPLE.canonRoot}`,
  rules: 'npx graduand rules',
  judge: `npx graduand --root . --root ${CLI_EXAMPLE.canonRoot}`,
} as const;

/**
 * 그 문서의 본문 자리들 — ⭐ **문서마다 자기 것만** 낸다. 둘을 합쳐 내면 어느 문서를 짓든
 * 「쓰이지 않는 키」가 남고, 그 단정이 죽으면 낡은 선언이 조용히 산다.
 *
 * ⛔ 제품 컬럼의 자구(`footer.pricing` · `footer.portal` · 문서 둘을 잇는 줄)는 여기 없다 —
 * 그 줄들은 생성기가 짓는 raw 자리(`productLinks`)가 **읽어서** 쓴다. 자리로도 두면 사본이다.
 */
function bodySlots(strings: Strings, doc: DocumentId): Readonly<Record<string, string>> {
  if (doc === 'constitution') {
    const { hold } = strings.constitution;
    return {
      'hold.label': hold.label,
      'hold.title': hold.title,
      'hold.body': hold.body,
      'hold.writeNote': hold.writeNote,

      'hold.tabsLabel': hold.tabsLabel,
      // ⭐ 탭 **둘 다** 발행본에 선다 — 가르는 것은 라디오와 CSS 이고 스크립트가 아니다.
      'hold.tabWeb': hold.tabWeb,
      'hold.tabCli': hold.tabCli,

      'hold.axisLabel': hold.axisLabel,
      'hold.axisPlaceholder': hold.axisPlaceholder,
      'hold.axisNote': hold.axisNote,

      'hold.canonHeading': hold.canonHeading,
      'hold.canonNote': hold.canonNote,
      'hold.repoLabel': hold.repoLabel,
      'hold.repoPlaceholder': hold.repoPlaceholder,
      'hold.read': hold.read,
      'hold.readNote': hold.readNote,
      'hold.fileLabel': hold.fileLabel,
      'hold.filePlaceholder': hold.filePlaceholder,
      'hold.fileNote': hold.fileNote,
      'hold.scopeLabel': hold.scopeLabel,
      'hold.scopePlaceholder': hold.scopePlaceholder,
      'hold.scopeNote': hold.scopeNote,

      'hold.linkHeading': hold.linkHeading,
      'hold.linkNote': hold.linkNote,
      'hold.linkRepoLabel': hold.linkRepoLabel,
      'hold.linkRepoPlaceholder': hold.linkRepoPlaceholder,
      'hold.linkAdd': hold.linkAdd,
      // ⭐ 런타임에 태어나는 자리의 자구 — 발행본의 **속성**으로 서고 스크립트가 읽는다.
      //   스크립트가 쥐면 그것이 사본이고, 사본은 카탈로그가 움직이는 날 갈라진다.
      'hold.linkRemove': hold.linkRemove,
      'hold.linkEmpty': hold.linkEmpty,

      'hold.compose': hold.compose,

      'hold.resultLabel': hold.resultLabel,
      'hold.snippetLabel': hold.snippetLabel,
      'hold.copy': hold.copy,
      'hold.download': hold.download,
      'hold.nextNote': hold.nextNote,

      'hold.cliTitle': hold.cliTitle,
      'hold.cliBody': hold.cliBody,
      'hold.cliExampleNote': hold.cliExampleNote,
      'hold.cliCanonStep': hold.cliCanonStep,
      'hold.cliCanonNote': hold.cliCanonNote,
      'hold.cliLinkStep': hold.cliLinkStep,
      'hold.cliLinkNote': hold.cliLinkNote,
      'hold.cliRulesStep': hold.cliRulesStep,
      'hold.cliRulesNote': hold.cliRulesNote,
      'hold.cliJudgeStep': hold.cliJudgeStep,
      'hold.cliJudgeNote': hold.cliJudgeNote,

      // ⭐⭐ 명령의 바이트 — **카탈로그가 아니라 여기서 짓는다**(로케일 불변). 아래 상수
      //   하나가 분모이고, 두 벌이 같은 명령을 각자 적는 자리를 만들지 않는다.
      'cli.canon': CLI_COMMANDS.canon,
      'cli.link': CLI_COMMANDS.link,
      'cli.rules': CLI_COMMANDS.rules,
      'cli.judge': CLI_COMMANDS.judge,
    };
  }
  const { page } = strings;
  return {
    activated: page.activated,

    'entry.label': page.entry.label,
    'entry.publicTitle': page.entry.publicTitle,
    'entry.publicBody': page.entry.publicBody,
    'entry.inputLabel': page.entry.inputLabel,
    'entry.inputPlaceholder': page.entry.inputPlaceholder,
    'entry.submit': page.entry.submit,
    'entry.privateTitle': page.entry.privateTitle,
    'entry.privateBody': page.entry.privateBody,
    'entry.privateNote': page.entry.privateNote,

    // ⭐ 기능 카드 — **수를 적지 않고 열거에서 받는다**: 틀의 카드 수와 카탈로그의 열거가
    //   어긋나면 아래 1:1 단정이 「모르는 자리」/「쓰이지 않는 키」로 던진다.
    'features.label': page.features.label,
    'features.title': page.features.title,
    'features.lede': page.features.lede,
    ...Object.fromEntries(
      page.features.items.flatMap((item, at) => [
        [`features.item${at}.title`, item.title],
        [`features.item${at}.body`, item.body],
      ]),
    ),

    'scaffold.label': page.scaffold.label,
    'scaffold.title': page.scaffold.title,
    'scaffold.body': page.scaffold.body,
    'scaffold.snippetLabel': page.scaffold.snippetLabel,
    'scaffold.copy': page.scaffold.copy,
    'scaffold.emptyNote': page.scaffold.emptyNote,
    'scaffold.canonNote': page.scaffold.canonNote,
    'scaffold.workingCopyNote': page.scaffold.workingCopyNote,

    'cta.label': page.cta.label,
    'cta.title': page.cta.title,
    'cta.boundary': page.cta.boundary,
    'cta.price': page.cta.price,
    'cta.priceNote': page.cta.priceNote,
    'cta.tax': page.cta.tax,
    'cta.choiceNote': page.cta.choiceNote,
    'cta.start': page.cta.start,

    'activation.title': page.activation.title,
    'activation.body': page.activation.body,
    'activation.naming': page.activation.naming,

    'faq.title': page.faq.title,
    'faq.knivesQ': page.faq.knivesQ,
    'faq.knivesA1': page.faq.knivesA1,
    'faq.knivesA2': page.faq.knivesA2,
    'faq.knivesA3': page.faq.knivesA3,
    'faq.freeQ': page.faq.freeQ,
    'faq.freeA1': page.faq.freeA1,
    'faq.freeA2': page.faq.freeA2,
    'faq.freeA3': page.faq.freeA3,
  };
}

/**
 * 색인 선언 — ⭐⭐ **canonical 과 hreflang 이 한 식에서 난다.** 둘이 따로 지어지면 서로
 * 다른 주소를 가리키는 사고가 설 자리가 생기고, 그 사고는 화면에 아무 표시도 남기지 않는다.
 * ⇒ 둘 다 `documentUrl` 하나를 통과한다 — 다른 주소를 넣을 경로가 없다.
 */
function indexingLinks(locale: Locale, doc: DocumentId): string {
  // ⭐ 묶음이 **문서별로** 닫힌다 — 다른 문서의 로케일을 같은 hreflang 묶음에 넣으면 그 둘이
  //   서로의 번역판이라고 말하는 것이고, 그 거짓은 화면에 아무 표시도 남기지 않는다.
  const canonical = `<link rel="canonical" href="${documentUrl(locale, doc)}">`;
  const links = alternates(doc).map(
    ({ hreflang, url }) => `\n  <link rel="alternate" hreflang="${hreflang}" href="${url}">`,
  );
  return canonical + links.join('');
}

/**
 * Open Graph — 공유된 링크가 **무엇인지 말한다.** 자구는 카탈로그가 들고(`title` ·
 * `description` — `<title>` 과 설명 메타가 쓰는 **같은 키**다) 주소는 `documentUrl` 이 든다.
 *
 * ⛔ **`og:locale` 을 적지 않는다** — 규격이 `ko_KR` 꼴의 **지역**까지 요구하는데 우리는
 * 지역을 정한 적이 없다(`en_US` 인지 `en_GB` 인지). 지어내지 않는다. ⭕ 문서의 `lang` 과
 * hreflang 이 이미 언어를 말한다.
 * ⛔ **이미지의 치수를 적지 않는다** — 자산이 그 수의 정본이고, 여기 적으면 사본이 하나 는다.
 * 치수는 선택 힌트이고, 긁는 쪽이 이미지를 읽는다.
 */
function openGraph(
  head: { readonly title: string; readonly description: string },
  locale: Locale,
  doc: DocumentId,
): string {
  const tags: readonly [string, string][] = [
    ['og:type', 'website'],
    ['og:title', head.title],
    ['og:description', head.description],
    ['og:url', documentUrl(locale, doc)],
    ['og:image', rootAssetUrl(OG_IMAGE_FILE)],
  ];
  const og = tags.map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}">`);
  // ⭐ 큰 카드 한 줄 — 없으면 같은 이미지가 작은 썸네일로 선다(나머지는 og: 를 그대로 읽는다).
  og.push('<meta name="twitter:card" content="summary_large_image">');
  return og.join('\n  ');
}

/**
 * 발행본 한 장.
 *
 * ⚠️ **주석을 벗긴다** — 템플릿의 주석은 다음 사람에게 쓰는 것이고, 발행본은 **공개 배달
 * 범위**다: 내부 근거가 주석으로 나가는 자리를 아예 만들지 않는다.
 *
 * @throws Error 템플릿이 모르는 자리를 부를 때 · 카탈로그의 키가 쓰이지 않을 때 ·
 *   속성 자리의 자구가 인라인 표식을 들 때 · 강조 표식의 짝이 맞지 않을 때.
 */
/**
 * 자리 하나의 값 — ⭐ **이스케이프가 먼저**다: 그래서 산문은 발행본의 구조를 바꿀 수 없고,
 * 카탈로그가 마크업을 들고 있는 것도 아니다.
 *
 * @throws Error 속성 자리의 자구가 인라인 표식을 들 때 · 강조 표식의 짝이 맞지 않을 때.
 */
export function renderSlot(value: string, mode: SlotMode, path: string): string {
  // ⚠️ `raw` 는 이스케이프를 건너뛴다 — 들어올 수 있는 키는 `RAW_SLOTS` 뿐이고, 그 판정은
  //    부르는 쪽(`renderDocument`)이 **자리의 이름으로** 한다. 값으로 판정하지 않는다.
  if (mode === 'raw') return value;
  const escaped = escapeHtml(value);
  if (mode === 'plain') {
    for (const marker of MARKERS) {
      if (value.includes(marker)) {
        throw new Error(`${path}: carries ${marker} but stands in a plain slot`);
      }
    }
    return escaped;
  }
  return inlineMarkup(escaped, path);
}

/**
 * 크롬에 **본문이 들어오는 자리** — ⛔ 하나다. 없거나 둘이면 본문이 조용히 사라지거나 두 번
 * 서므로 던진다: 발행본에 아무 표시도 남지 않는 실패를 생성기가 받는다.
 */
const BODY_SLOT = '{{raw:body}}';

/**
 * 크롬 + 그 문서의 본문 = 그 문서의 틀. ⭐ 손으로 쓰는 것이 둘이고 **구조는 한 벌**이다.
 *
 * ⚠️ **주석을 먼저 벗긴다** — 그래야 자리를 세는 수가 참이다: 머리말이 그 자리의 이름을
 * **설명으로** 적는 것이 정상이고(다음 사람에게 쓰는 글이다), 세는 쪽이 주석을 보면 그
 * 설명이 둘째 자리로 세어진다(실측: 크롬 머리말 때문에 「둘」이 났다). 벗기는 손은
 * 생성기와 가드가 **같은 하나**다(`withoutHtmlComments`).
 */
export function templateOf(chrome: string, body: string): string {
  const bare = withoutHtmlComments(chrome);
  const found = bare.split(BODY_SLOT).length - 1;
  if (found !== 1) {
    throw new Error(`${CHROME_FILE}: the body slot ${BODY_SLOT} stands exactly once (found ${found})`);
  }
  return bare.replace(BODY_SLOT, withoutHtmlComments(body));
}

export function renderDocument(
  chrome: string,
  body: string,
  doc: DocumentId,
  locale: Locale,
  lockup: string = readLockup(),
  now: Date = new Date(),
): string {
  const strings = CATALOG[locale];
  const values = substitutions(strings, doc, lockup, now);
  const used = new Set<string>();
  const at = `${locale}/${doc}`;

  // ⚠️ 주석은 `templateOf` 가 **이미** 벗겼다 — 발행본은 공개 배달 범위이고, 내부 근거가
  //    주석으로 나가는 자리를 아예 만들지 않는다(벗기는 손은 하나다).
  const document = templateOf(chrome, body)
    .replace(PLACEHOLDER, (whole: string, mode: string | undefined, key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`${at}: template calls an unknown slot ${whole}`);
      used.add(key);
      // ⛔ **열거된 키만 raw 로 설 수 있다** — 그래야 카탈로그의 자구가 이스케이프를
      //    건너뛸 길이 없다. 둘 중 어느 쪽이 어긋나도 판정 실패다(조용히 바꾸지 않는다).
      if (RAW_SLOTS.includes(key) !== (mode === 'raw')) {
        throw new Error(`${at}: ${key} and the raw slot declaration disagree`);
      }
      return renderSlot(value, (mode as SlotMode | undefined) ?? 'prose', `${at}: ${key}`);
    });

  if (document.includes('{{')) {
    throw new Error(`${at}: an unresolved slot is left in the document`);
  }
  // ⭐ 1:1 이 **문서별로** 선다 — 각 문서가 받는 자리는 「크롬 + 자기 본문」이고, 그 전부가
  //   쓰여야 한다. 그래서 둘째 문서가 늘어도 이 단정이 느슨해지지 않는다.
  const unused = Object.keys(values).filter((key) => !used.has(key));
  if (unused.length > 0) {
    throw new Error(`${at}: the template never calls ${unused.join(', ')} — a stale declaration`);
  }
  return document;
}

/**
 * **원페이지만** — 로케일마다 하나. ⭐ 틀을 **인자로** 받는 꼴을 유지한다: 가드가 금칙을
 * 심은 틀로 같은 유도를 돌려야 「심으니 빨갛다」가 증거가 된다(음성 대조군 규율).
 *
 * ⚠️ 발행본 **전수**는 아래 `renderSite` 다 — 이 함수는 그것의 **투영**이고, 두 손이 각자
 * 그리는 것이 아니다(둘 다 `renderDocument` 하나를 지난다).
 */
export function renderAll(
  template: string,
  lockup: string = readLockup(),
  now: Date = new Date(),
): Readonly<Record<Locale, string>> {
  const chrome = readChrome();
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, renderDocument(chrome, template, 'page', locale, lockup, now)]),
  ) as Record<Locale, string>;
}

/**
 * 발행본의 **이름** — 발행 루트 기준 경로다. ⭐ `documentPath` 하나를 지난다: 주소를 내는
 * 손과 파일을 두는 손이 갈라지면 색인이 가리키는 자리에 파일이 없는 날이 온다.
 */
export const publishedPath = (locale: Locale, doc: DocumentId): string =>
  `${documentPath(locale, doc).slice(1)}${DOCUMENT_FILE}`;

/**
 * 발행본 **전수** — 분모가 **문서 × 로케일**이다. ⛔ 수를 적지 않는다(상수 둘의 곱이다).
 */
export function renderSite(
  sources: Sources,
  lockup: string = readLockup(),
  now: Date = new Date(),
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    DOCUMENTS.flatMap((doc) =>
      LOCALES.map((locale) => [
        publishedPath(locale, doc),
        renderDocument(sources.chrome, sources[doc], doc, locale, lockup, now),
      ]),
    ),
  );
}

/**
 * 발행 루트를 **통째로** 짓는다 — 문서 넷(문서 × 로케일) · 화면 한 벌 · 브랜드 자산 ·
 * 색인 선언 셋.
 *
 * ⭐⭐ **이 디렉터리가 곧 사이트다.** 호스팅 선언이 가리키는 자리가 여기이고, 그래서 문서가
 * `/<로케일>/` 과 그 아래 한 칸에 선다. ⚠️ 커밋하지 않는다(전부 생성물이다).
 * ⛔ `tsc` 의 산출(`<패키지>/src/*.js`)은 여기서 나르지 않는다 — 같은 디렉터리로 **이미**
 * 내려앉는다(`tsconfig.build.json`). 나르면 사본이 하나 는다.
 */
export function generate(out: string, root: string = PACKAGE_ROOT): string[] {
  const documents = renderSite(readSources(root), readLockup(root));
  const written = Object.entries(documents).map(([name, html]) => {
    const path = join(out, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, html);
    return path;
  });

  mkdirSync(out, { recursive: true });

  const brandDist = dirname(join(root, BRAND_LOCKUP));
  for (const asset of CARRIED_ASSETS) {
    const path = join(out, asset);
    copyFileSync(join(brandDist, asset), path);
    written.push(path);
  }
  for (const asset of PACKAGE_ASSETS) {
    const path = join(out, asset);
    copyFileSync(join(root, asset), path);
    written.push(path);
  }

  // ⭐ 색인 선언 셋 — 발견이 리다이렉트에 기대지 않게 하는 자리(sitemap)와, 로케일을 가르지
  //   않는 규칙(robots)과, 헤더를 보지 않는 루트 한 줄(`_redirects`)이다.
  for (const [name, body] of [
    [SITEMAP_FILE, sitemapXml()],
    [ROBOTS_FILE, robotsTxt()],
    [REDIRECTS_FILE, redirectsFile()],
  ] as const) {
    const path = join(out, name);
    writeFileSync(path, body);
    written.push(path);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--out');
  const out = at === -1 ? join(PACKAGE_ROOT, DEFAULT_OUT) : (process.argv[at + 1] ?? '');
  if (out === '') {
    console.error('❌ --out needs a path');
    process.exit(2);
  }
  for (const path of generate(out)) console.log(path);
}
