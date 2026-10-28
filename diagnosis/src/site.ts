/**
 * 발행 자리 — ⭐⭐ **절대 주소가 사는 유일한 자리다.**
 *
 * ⭐⭐ **왜 여기만 절대 주소를 쥐는가.** 이 패키지의 금칙은 「밖으로 나가는 주소를 발행본에
 * 박지 않는다」이고, 그 사유는 **벤더가 주소를 바꾼 날 그 화면이 거짓말을 한다**였다.
 * ⭕ 자기 출처는 **밖으로 나가는 주소가 아니다** — 그 문서가 **이미 있는 자리**이고, 색인
 * 선언(canonical · hreflang · sitemap · OG)은 상대 경로로는 **적을 수 없다**(규격이 절대
 * 주소를 요구한다). ⇒ 금칙을 걷지 않고 **자리를 하나로 모은다**: 절대 주소가 설 수 있는
 * 곳이 이 파일의 상수 하나뿐이면, 벤더 주소가 들어올 길이 없다. 가드가 그 하나만 면제한다.
 *
 * ⭐⭐ **주소를 내는 손이 하나다** — canonical 과 hreflang 이 **같은 식**에서 난다. 둘이
 * 따로 지어지면 서로 다른 주소를 가리키는 사고가 설 자리가 생기고, 그 사고는 화면에 아무
 * 표시도 남기지 않는다(색인만 조용히 갈라진다). ⇒ `documentUrl` 하나를 통과하지 않고
 * 문서 주소를 적을 수 있는 경로가 없다.
 *
 * ⛔ **협상이 0 이다** — 루트는 **무조건** 기본 로케일로 보낸다. 헤더 분기를 세우면
 * 「우리 코드가 도는 서버가 0」이 거짓이 되고, `strings.ts`·`main.ts` 의 협상 기각 근거
 * 하나가 함께 움직인다. ⭕ 발견은 리다이렉트에 기대지 않는다 — sitemap 이 **두 로케일을
 * 전부 열거하는 것**이 그 집행이다.
 */

import { LOCALES, type Locale } from './strings.ts';

/**
 * 발행 출처 — ⚠️ 이 값이 움직이면 색인 선언 전부가 함께 움직인다. 그것이 요점이다.
 * ⬜ 이 주소에 아직 A·AAAA·CNAME 가 0 건이다(2026-10-27 실측) — 선언은 서고, 서빙은
 * 도메인이 붙는 날 선다. ⛔ 그 전에 선 것처럼 적지 않는다.
 */
export const SITE_ORIGIN = 'https://graduand.dev';

/**
 * 루트가 **무조건** 보내는 자리이자 `x-default` 의 대상.
 *
 * ⭐ 영문인 사유가 둘이다 — ⑴ Googlebot 은 `Accept-Language` 를 보내지 않고 미국 IP 에서
 * 돌아 **어차피 `/en/` 을 본다**: 루트 · `x-default` · 크롤러가 보는 것이 **전부 한 곳**으로
 * 모인다. ⑵ 맨 도메인의 외부 링크가 `/en/` 로 해석되는 것이 **의도한 바**가 된다.
 * ⚠️ 비용을 지는 사람은 **맨 도메인을 직접 치는 한국어 방문자**뿐이고(셀렉터를 한 번 누른다),
 * 검색 유입은 hreflang 이 `/ko/` 로 **직접** 보낸다.
 */
export const DEFAULT_LOCALE: Locale = 'en';

/** 로케일 접두는 **대칭**이다 — `/ko/` 도 `/en/` 도 접두를 받는다. */
/** 리다이렉트가 받는 자리들 — ⭐ 화면이 가리키는 그 경로와 **같은 상수**다(두 번 적으면 갈라진다). */
export const ROOT_PATH = '/';
export const COMPANY_PATH = '/company/';
export const CHECKOUT_PATH = '/checkout/';

/**
 * 발행되는 문서 — ⭐⭐ **닫힌 목록이고 첫 자리가 원페이지다**(루트가 보내는 자리이자
 * `x-default` 의 대상). 분모가 「로케일」 하나에서 **「문서 × 로케일」**로 넓어진 자리이고,
 * 색인 선언 전부가 그 곱을 받는다.
 *
 * ⭐ **왜 둘째 문서인가** — 원페이지는 **영업 화면**이고(블록 여덟 + 순서까지 가드가 문다)
 * 그 자리의 사유가 전부 「무료·즉시·오늘 서는 칼」이다. 헌법 관리와 관측 결과는 **고객이
 * 쓰는 도구**라 성질이 다르다: 섞으면 한 분모가 두 성질을 담아 어느 블록이 늘어도 사유를
 * 말할 수 없게 된다. ⛔ 그래도 호스팅 대시보드가 아니다 — 서버 0 · 계정 0 이고, 판정은
 * 여전히 이 브라우저에서 돈다.
 */
export const DOCUMENTS = ['page', 'constitution'] as const;

export type DocumentId = (typeof DOCUMENTS)[number];

/**
 * 문서의 경로 조각 — 원페이지는 **로케일 디렉터리 자신**이고 나머지는 그 아래 한 칸이다.
 * ⭐ 로케일이 **위**인 것이 요점이다: 한 문서의 형제 로케일이 서로의 이웃이라 셀렉터의
 * 상대 경로(`../<로케일>/`)가 문서마다 다시 지어지지 않는다.
 */
const SEGMENT: Readonly<Record<DocumentId, string>> = {
  page: '',
  constitution: 'constitution/',
};

/**
 * ⛔ **`doc` 에 기본값을 두지 않는다** — 두면 새 문서가 자기 주소를 적는 자리를 빠뜨리고도
 * **조용히 원페이지의 주소**를 얻는다. 그 사고는 화면에 아무 표시도 남기지 않고 색인만
 * 갈라지며, 그것이 이 파일의 머리말이 막으려는 바로 그 실패다. 선언이 분모다.
 */
export const documentPath = (locale: Locale, doc: DocumentId): string => `/${locale}/${SEGMENT[doc]}`;

/**
 * 문서의 **절대 주소** — ⭐ canonical · hreflang · sitemap · `og:url` 이 전부 이 하나를
 * 통과한다. ⛔ 다른 식으로 문서 주소를 지을 수 있는 자리를 만들지 않는다.
 */
export const documentUrl = (locale: Locale, doc: DocumentId): string =>
  `${SITE_ORIGIN}${documentPath(locale, doc)}`;

/** 그 문서가 로케일 디렉터리 아래로 몇 칸 들어가 있는가 — 상대 경로 둘이 이 수에서 난다. */
const depthOf = (doc: DocumentId): number =>
  documentPath(LOCALES[0], doc).split('/').filter(Boolean).length;

/**
 * 같은 문서의 **형제 로케일** — 문서 기준 상대 경로다. ⚠️ 접두를 박지 않으므로 발행본이
 * 어느 깊이에 놓여도 형제를 가리키고, 둘째 문서의 셀렉터가 한 칸 더 올라간다.
 */
export const siblingLocalePath = (locale: Locale, doc: DocumentId): string =>
  `${'../'.repeat(depthOf(doc))}${locale}/${SEGMENT[doc]}`;

/**
 * 이 문서에서 **그 로케일의 루트**로 가는 상대 경로 — 원페이지와 정책 문서가 거기 산다.
 * ⭐ 정책 링크가 문서마다 한 칸씩 달라지는 자리이고, 이 손 하나가 그것을 든다.
 */
export const localeRootPath = (doc: DocumentId): string =>
  depthOf(doc) === 1 ? './' : '../'.repeat(depthOf(doc) - 1);

/**
 * 이 문서에서 **다른 문서**(같은 로케일)로 가는 상대 경로 — ⭐ 경로 조각을 손으로 적지
 * 않는다: `SEGMENT` 가 그 정본이고, 베끼면 문서를 옮긴 날 링크만 옛 자리를 가리킨다.
 */
export const siblingDocumentPath = (from: DocumentId, to: DocumentId): string =>
  `${localeRootPath(from)}${SEGMENT[to]}`;

/**
 * 발행 루트에 **한 벌로** 서는 자산의 절대 주소 — OG 이미지와 robots 가 가리키는 sitemap.
 * ⚠️ 문서 주소와 **다른 종류**라 함수가 다르다: 문서는 로케일마다 둘이고 이것은 루트 하나다.
 */
export const rootAssetUrl = (name: string): string => `${SITE_ORIGIN}/${name}`;

/** 색인 선언이 사는 파일들 — 이름도 생성기와 가드가 **한 자리**에서 받는다. */
export const SITEMAP_FILE = 'sitemap.xml';
export const ROBOTS_FILE = 'robots.txt';
export const REDIRECTS_FILE = '_redirects';
export const OG_IMAGE_FILE = 'og.png';

/**
 * hreflang 쌍 + `x-default` — ⭐ 두 문서가 **서로를** 가리키고, `x-default` 가 기본 로케일을
 * 가리킨다. ⛔ 로케일 **수**를 적지 않는다: 분모는 `LOCALES` 다.
 *
 * ⭐ `x-default` 가 리다이렉트의 대상과 **같은 문서**인 것이 이 선언의 요점이다 — 루트 ·
 * `x-default` · 크롤러가 보는 것이 한 곳으로 모인다.
 */
export const alternates = (
  doc: DocumentId,
): readonly { readonly hreflang: string; readonly url: string }[] => [
  ...LOCALES.map((locale) => ({ hreflang: locale, url: documentUrl(locale, doc) })),
  { hreflang: 'x-default', url: documentUrl(DEFAULT_LOCALE, doc) },
];

/**
 * sitemap — ⭐⭐ **발견을 리다이렉트에서 떼어 놓는 자리다.** Google 이 자동 리다이렉트를
 * 권하지 않는 사유가 축자로 「사용자와 검색엔진이 **모든 판에 도달하지 못할 수 있다**」이고,
 * 두 로케일을 전부 열거하는 것이 그것을 막는다.
 *
 * ⭐ 각 URL 이 hreflang 묶음을 **통째로** 들고 간다(규격이 그렇게 요구한다 — 묶음의 각 항이
 * 서로를 가리켜야 한다). ⛔ `lastmod`·`priority`·`changefreq` 를 적지 않는다: 지킬 수 없는
 * 약속이고, 색인에 쓰이지 않는다.
 */
export function sitemapXml(): string {
  // ⭐ 분모가 **문서 × 로케일**이다 — 한 문서만 열거하면 나머지 문서가 발견에서 조용히
  //   사라지고(그 화면에는 아무 표시도 남지 않는다), hreflang 묶음은 **문서별로** 닫힌다:
  //   다른 문서의 로케일을 같은 묶음에 넣으면 그 둘이 서로의 번역판이라고 말하는 것이다.
  const entries = DOCUMENTS.flatMap((doc) =>
    LOCALES.map((locale) => {
      const links = alternates(doc)
        .map(({ hreflang, url }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${url}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${documentUrl(locale, doc)}</loc>\n${links}\n  </url>`;
    }),
  ).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * robots — ⭐ **규칙이 로케일 간 동일하다.** 한쪽만 막으면 그 로케일이 조용히 사라지고,
 * 화면에는 아무 표시도 남지 않는다. ⇒ 규칙이 **경로를 가르지 않는다**.
 * ⛔ 숨길 자리가 없다 — 발행 루트에 있는 것은 전부 공개 배달 범위다.
 */
export function robotsTxt(): string {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${rootAssetUrl(SITEMAP_FILE)}`, ''].join('\n');
}

/**
 * 회사 사이트 — ⭐ **발행본에 박지 않는다.** 이 상수는 리다이렉트 선언의 목적지로만 쓰이고,
 * 화면은 상대 경로(`COMPANY_PATH`)를 가리킨다. 그래야 「무엇이 밖으로 나가는가」가 **git 에
 * 보이는 목록 하나**로 남고, 그 목록이 곧 측정 지점이 된다.
 */
export const COMPANY_SITE = 'https://moayo.app/';

/**
 * 구독 입구가 **실제로 열리는 자리** — 벤더의 호스티드 체크아웃이다.
 *
 * ⭐⭐ **면제의 사유가 `COMPANY_SITE` 와 같고 한 겹 더 세다.** 벤더는 주소를 바꾼다(창구를
 * 옮기거나 링크를 다시 낸다). 발행본에 박히면 그 화면이 거짓말을 하고, 그 거짓말은 **붙여넣어
 * 옮겨지며 오래 산다** — 그래서 화면은 상대 경로(`CHECKOUT_PATH`)를 가리키고, 벤더가 움직인
 * 날 고치는 자리는 **이 한 줄**이다.
 *
 * ⛔ 질의를 붙이지 않는다 — 수량도 식별자도 링크가 잠그지 않는다(`checkout.test.ts` 의
 * AC2·AC3 이 그 둘을 각각 문다). 고르는 자리는 **창구의 화면**이다.
 */
export const CHECKOUT_SITE = 'https://buy.polar.sh/polar_cl_CqkLk5OhhfCnMs31sIrL8H';

/**
 * 리다이렉트 선언 — ⭐⭐ **밖으로 나가는 모든 것이 지나는 한 문**이다.
 *
 * ⛔ 사유를 **값으로 적지 않는다** — 이 파일은 발행되는 화면 코드라 한글 리터럴이 금칙이다
 * (주석은 무죄다). 행마다의 사유는 `hosting.test.ts` 의 `redirectReasons` 가 들고, 가드가
 * **1:1** 을 단정한다 — 행이 늘면 사유가 따라오지 않고는 초록이 되지 않는다.
 *
 * ⚠️ **규칙이 둘이 되면서 단정을 쪼갰다.** 전에는 행이 하나라 「전수가 같은 대상」과
 * 「루트가 무조건」이 **겹쳐** 있었고, 그 겹침이 둘째 행을 못 들이는 모양이었다. 지키려던
 * 것은 뒤쪽 하나다 — 루트의 성질은 이제 **루트 행에만** 건다.
 */
export const REDIRECTS: readonly {
  readonly from: string;
  readonly to: string;
  readonly status: string;
}[] = [
  // ⑴ 루트 → 기본 로케일. ⭐ **무조건이다**(헤더를 보지 않으므로 모든 요청이 같은 대상으로
  //    간다). ⚠️ **302 인 이유**: 목적지가 **결정**이고 결정은 움직일 수 있는데, 301 은
  //    브라우저가 오래 캐시해서 그 결정이 바뀐 날 돌아온 방문자에게 보이지 않는다.
  //    ⭕ 색인은 손해 보지 않는다 — 발견이 sitemap 과 hreflang 에 서 있다.
  { from: ROOT_PATH, to: documentPath(DEFAULT_LOCALE, 'page'), status: '302' },
  // ⑵ 회사 → 회사 사이트. ⛔ 절대 주소를 발행본에 박지 않는다 — 나가는 자리는 이 선언이
  //    든다. ⚠️ **302 인 이유**: 그쪽 주소는 우리 결정이 아니라 **남의 자리**이고, 영구로
  //    캐시하면 그쪽이 움직인 날 방문자가 우리 선언을 못 본다. ⭕ 워커는 여전히 0 이다.
  { from: COMPANY_PATH, to: COMPANY_SITE, status: '302' },
  // ⑶ 구독 입구 → 벤더의 체크아웃. ⭐ ⑵ 와 **같은 규율**이다 — 절대 주소는 선언이 들고
  //    발행본은 상대 경로만 든다. ⚠️ **302 인 이유**도 같고 한 겹 더 있다: 벤더가 링크를
  //    다시 내면 주소가 바뀌는데, 301 을 캐시한 방문자는 **죽은 문**을 계속 받는다.
  { from: CHECKOUT_PATH, to: CHECKOUT_SITE, status: '302' },
];

export function redirectsFile(): string {
  return REDIRECTS.map(({ from, to, status }) => `${from}    ${to}    ${status}\n`).join('');
}
