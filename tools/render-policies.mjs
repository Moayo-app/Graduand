// 정책 문서 렌더러 — md 를 **빌드 시점에** HTML 로 낸다 ([ISSUE-18]).
//
// ⭐⭐ **왜 빌드 시점인가.** 게시 요건이 「인터넷 홈페이지에 **지속적으로 게재**」이고, 미국
// 쪽 요건도 「홈페이지 또는 진입 후 첫 유의미 페이지에 **privacy 를 포함하는 링크**」다.
// ⛔ md 를 그대로 서빙하고 브라우저가 렌더하는 길은 **`<noscript>` 에서 약관이 사라지는
// 사이트**를 만든다 — 게시 요건이 자바스크립트에 걸린다. ⇒ 바이트로 박는다.
//
// ⛔ **HTML 을 손으로 쓰지 않는다** — 정본 선언표 축자: 「선언되지 않은 정책 파일이 이
// 저장소에 생기면 가드가 막습니다 — **선언 없는 파일은 조용히 두 번째 정본이 되기**
// 때문입니다.」 ⇒ 정본은 md 하나이고 HTML 은 그 함수다.
//
// ⭐⭐ **산출물은 선언표의 행이 아니다.** 이 스크립트가 내는 것은 전부 생성물이고, 정본
// 선언표(`docs/policies/canon.md`)와 정책 금칙 가드의 분모(`docs/policies/**`)를 **건드리지
// 않는 자리**에 난다 — 발행 루트(`diagnosis/dist/`)는 `.gitignore` 가 통째로 무시한다.
// ⇒ 선언표는 이 변경으로 **한 줄도 움직이지 않는다**.
//
// ⚠️ **자가 변환기를 쓰지 않는다** — 이 문서들은 **표가 하중**이다(수탁자 표 · 국외이전 표).
// 손으로 짠 변환기는 금방 작지 않게 되고, **그 버그는 법정 게시물의 오류**다. ⇒ 의존성
// 하나를 들인다. ⭕ 「런타임 의존성 0」은 **페이지의 성질**이라 깨지지 않는다 — 이것은 빌드가
// 쓰고 발행본에는 바이트만 남는다. ⭐ 고른 것은 전이 의존성이 **0** 인 쪽이다(실측: 잠금
// 파일이 이 패키지 하나만 받았다).
//
//   node tools/render-policies.mjs [--out <경로>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { marked } from 'marked';

import { policyBody, policyFiles, POLICY_KINDS, read } from './lib/policy.mjs';

/** 발행 루트 — 진단 페이지의 생성기가 짓는 그 디렉터리다. 정책 문서는 그 **형제**로 난다. */
export const OUT_ROOT = 'diagnosis/dist';

/** 문서 기준 상대 경로의 그 한 칸 — 진단 페이지의 푸터가 `./policies/…` 로 부른다. */
export const POLICY_DIR = 'policies';

/**
 * 종류 → 발행본의 파일 이름.
 *
 * ⚠️ **`refund` 가 `refunds.html` 로 난다** — 정본 파일은 단수이고 화면의 링크는 복수다.
 * 둘 중 하나를 고치는 대신 **여기 한 줄로 적는다**: 정본 이름을 바꾸면 선언표·가드·번역판이
 * 같이 움직이고, 링크를 바꾸면 발행된 주소가 깨진다. ⇒ 가르는 자리를 **선언으로** 둔다.
 * ⛔ 종류를 빠뜨릴 수 없다 — 아래가 전수와 1:1 인지 던져서 묻는다.
 */
export const FILE_BY_KIND = { terms: 'terms.html', privacy: 'privacy.html', refund: 'refunds.html' };

/** 표의 꼴만 세우는 한 벌 — ⭐ 루트 한 자리에 나고 모든 정책 문서가 `/policies.css` 로 부른다. */
export const STYLE_FILE = 'policies.css';

/**
 * ⭐ **값을 베끼지 않는다** — 색은 전부 발행 루트의 `/styles.css` 가 `:root` 에 세운 토큰을
 * 부른다. 여기 hex 를 적으면 사본이 하나 늘고, 그 사본은 램프가 움직이는 날 갈라진다.
 */
export const STYLE_SHEET = `/* 정책 문서 — 생성물이다. 손으로 고치면 다음 빌드가 되돌린다. */
.policy-doc { max-width: 46rem; margin: 0 auto; padding: 1.6rem 1.2rem 4rem; }
.policy-doc h1 { font-size: 1.5rem; margin: 0 0 1rem; }
.policy-doc h2 { font-size: 1.1rem; margin: 2rem 0 0.6rem; }
.policy-doc h3 { font-size: 1rem; margin: 1.4rem 0 0.5rem; }
.policy-doc p, .policy-doc li { color: var(--ink-dense); }
.policy-doc table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.88rem; }
.policy-doc th, .policy-doc td {
  border: 1px solid var(--ink-light);
  padding: 0.45rem 0.6rem;
  text-align: left;
  vertical-align: top;
}
.policy-doc th { background: var(--ink-clear); color: var(--ink-burnt); }
.policy-doc code { font-family: var(--mono); font-size: 0.92em; }
.policy-doc hr { border: 0; border-top: 1px solid var(--ink-clear); margin: 2rem 0; }
`;

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** 문서의 제목 — 본문의 첫 `# ` 줄이다. ⛔ 지어내지 않는다: 없으면 던진다. */
export function titleOf(body, label) {
  const found = /^#[ \t]+(.+?)[ \t]*$/m.exec(body);
  if (found === null) throw new Error(`${label}: 본문에 제목(# …) 이 없다 — 발행본의 <title> 이 설 자리다`);
  return found[1];
}

/**
 * 문서 한 장. ⭐ **머리말 주석을 걷는 손이 가드와 같다**(`policyBody`) — 따로 짜면 「게시물에
 * 작업 메모가 0」과 「가드가 보는 본문」이 서로 다른 것을 재게 된다. 작업 메모는 과거를 적는
 * 자리라 판정 대상이 아니고, **게시물에 실리지도 않는다.**
 */
export function renderPolicy(markdown, locale, label) {
  const body = policyBody(markdown);
  const title = titleOf(body, label);
  const html = marked.parse(body, { gfm: true, async: false });
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/${STYLE_FILE}">
</head>
<body>
<header class="gnb"><nav class="gnb-in"><a class="brand-link" href="../">graduand</a></nav></header>
<main class="policy-doc">
${html.trim()}
</main>
</body>
</html>
`;
}

/** 종류 전수가 이름을 갖는가 — ⛔ 낡은 선언은 미판정이 아니라 판정 실패다. */
export function checkFileMap() {
  const named = Object.keys(FILE_BY_KIND).sort();
  const kinds = [...POLICY_KINDS].sort();
  if (named.join() !== kinds.join()) {
    throw new Error(`종류와 파일 이름이 1:1 이 아니다 — 선언 ${named.join('·')} vs 종류 ${kinds.join('·')}`);
  }
}

/**
 * 전수를 낸다 — 분모는 **개방 목록에서 유도된** 로케일 × 종류다(`policyFiles`).
 * ⛔ 수를 적지 않는다: 나라가 늘면 벌이 따라 는다.
 */
export function renderAll(root, out = path.join(root, OUT_ROOT)) {
  checkFileMap();
  const written = [];
  for (const [rel, locale, kind] of policyFiles(root)) {
    const target = path.join(out, locale, POLICY_DIR, FILE_BY_KIND[kind]);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderPolicy(read(root, rel), locale, rel));
    written.push(target);
  }
  const style = path.join(out, STYLE_FILE);
  fs.mkdirSync(path.dirname(style), { recursive: true });
  fs.writeFileSync(style, STYLE_SHEET);
  written.push(style);
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--out');
  const root = process.cwd();
  const out = at === -1 ? path.join(root, OUT_ROOT) : process.argv[at + 1];
  if (!out) {
    console.error('❌ --out 에 경로가 필요하다');
    process.exit(2);
  }
  for (const p of renderAll(root, out)) console.log(p);
}
