// 정책 문서 가드의 공유 모듈 — [ISSUE-12] (가드 명세 정본 moayo-hq #211 §3 G1–G10 — 비공개, 포인터만).
//
// G1 **모집단 단일화**: policyFiles() 한 함수가 [path, locale, kind][] 를 내고 모든 가드가
// 그것만 쓴다. 로케일 분모는 config/allowed-countries.yml 에서 **유도**하고, 테스트에 수를
// 적지 않는다 — 자매 제품에서 두 테스트가 서로 다른 모집단을 세어 3벌이 가드 틈에 빠졌고,
// 하드코딩한 로케일 하한이 분모 축소 때 뜻 없이 깨졌다. 둘 다 여기서 구조로 없앤다.
//
// G8 **본문만 본다**: 머리말 주석(<!-- … -->) 걷기는 policyBody 한 벌이다 — 작업 메모는
// 과거를 적는 자리라 판정 대상이 아니다.
//
// 각 check* 함수는 위반 문자열 배열을 돌려준다 — 빈 배열이 초록이다. root 를 받는 이유는
// negative 테스트가 사본 트리에 위반을 심고 빨간불을 확인하기 위해서다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const POLICY_KINDS = ['terms', 'refund', 'privacy'];

/** 정본 로케일 — 세 문서 자체가 한국어판이고 루트에 산다. ⛔ locales/ko/ 를 만들지 않는다. */
export const MASTER_LOCALE = 'ko';

/** 모집단 밖이지만 docs/policies/ 에 사는 단 하나의 예외 — 저장소 간 정본 선언표. */
export const CANON_PATH = 'docs/policies/canon.md';

/** 가드가 읽는 config 두 벌 — 이 둘도 선언표의 행이다. */
export const CONFIG_PATHS = ['config/allowed-countries.yml', 'config/policy-strings.yml'];

export const policyBody = (markdown) => markdown.replace(/<!--[\s\S]*?-->/g, '').trim();

export const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

export const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

export const loadStrings = (root) => yaml.load(read(root, 'config/policy-strings.yml'));

export const loadCountries = (root) => yaml.load(read(root, 'config/allowed-countries.yml')).countries ?? [];

/** 문서 로케일 분모 — 개방 목록의 doc_locale 합집합. 수를 적지 않고 유도한다. */
export function docLocales(root) {
  const locales = [];
  for (const c of loadCountries(root)) {
    if (!c.doc_locale) throw new Error(`allowed-countries: ${c.code ?? '?'} 행에 doc_locale 이 없다 — 로케일 분모가 이 파일에서 유도된다`);
    if (!locales.includes(c.doc_locale)) locales.push(c.doc_locale);
  }
  if (!locales.includes(MASTER_LOCALE)) throw new Error(`개방 목록이 정본 로케일(${MASTER_LOCALE})을 유도하지 않는다 — 본국 행이 빠졌다`);
  return [MASTER_LOCALE, ...locales.filter((l) => l !== MASTER_LOCALE)];
}

/** G1 — 모집단: [상대경로, 로케일, 종류][]. ko 정본은 루트, 번역판은 locales/<L>/. */
export function policyFiles(root) {
  const files = POLICY_KINDS.map((k) => [`docs/policies/${k}.md`, MASTER_LOCALE, k]);
  for (const locale of docLocales(root).filter((l) => l !== MASTER_LOCALE))
    for (const k of POLICY_KINDS) files.push([`docs/policies/locales/${locale}/${k}.md`, locale, k]);
  return files;
}

// ── ko 정본 머리말 메타 — 「버전: N[.N…] (메모)」 · 「발행일 | 시행일: 미정 | YYYY-MM-DD」 ──
//
// ⭐ **날짜가 둘인 이유.** 발행일은 그 판이 **게시된 날**이고 시행일은 **효력이 시작되는 날**이다.
// 이 판은 둘이 같은 날이지만(결제가 열리는 날), 그것은 **이 판의 사실**이지 둘이 같은 칸이라는
// 뜻이 아니다 — 변경 고지 조항이 「시행 7일/30일 전까지 알린다」라, 다음 판부터는 발행이
// 시행보다 **앞선다**. ⇒ 칸을 둘로 두고, 아래 가드가 **발행 ≤ 시행**만 불변으로 잰다.
const HEAD_RE = /^\s*<!--([\s\S]*?)-->/;
const VERSION_RE = /^[ \t]*버전:[ \t]*([0-9]+(?:\.[0-9]+)*)[ \t]*(?:\(([^)]*)\))?/m;
const PUBLISHED_RE = /^[ \t]*발행일:[ \t]*(\S+)/m;
const EFFECTIVE_RE = /^[ \t]*시행일:[ \t]*(\S+)/m;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EFFECTIVE_UNSET = '미정';

export const headComment = (markdown) => markdown.match(HEAD_RE)?.[1] ?? null;

/** 머리말 두 줄 → {version, version_note, effective_date}. 규칙을 못 맞추면 던진다 —
 * 조용히 null 을 내보내면 「버전 미상」이 정상처럼 보인다. */
export function parsePolicyMeta(markdown, label = '정책 문서') {
  const head = headComment(markdown);
  if (head === null) throw new Error(`${label}: 머리말 HTML 주석이 없다 — 버전 메타가 사는 자리다`);
  const v = head.match(VERSION_RE);
  if (!v) throw new Error(`${label}: 머리말에 「버전: <N.N> (<상태 메모>)」 줄이 없다`);
  const dateLine = (re, name) => {
    const m = head.match(re);
    if (!m) throw new Error(`${label}: 머리말에 「${name}: 미정」 또는 「${name}: <YYYY-MM-DD>」 줄이 없다`);
    if (m[1] !== EFFECTIVE_UNSET && !ISO_DATE_RE.test(m[1])) {
      throw new Error(`${label}: 「${name}: ${m[1]}」 — 「미정」이거나 YYYY-MM-DD 여야 한다`);
    }
    return ISO_DATE_RE.test(m[1]) ? m[1] : null;
  };
  const published_date = dateLine(PUBLISHED_RE, '발행일');
  const effective_date = dateLine(EFFECTIVE_RE, '시행일');
  // ⛔ 효력이 게시보다 먼저 시작될 수 없다 — 변경 고지 조항(시행 7일/30일 전 고지)이
  //    요구하는 순서이기도 하다. ⚠️ 「같은 날」은 이 판의 사실이라 불변으로 적지 않는다.
  if (published_date !== null && effective_date !== null && published_date > effective_date) {
    throw new Error(`${label}: 발행일(${published_date})이 시행일(${effective_date})보다 늦다 — 읽히기 전에 효력이 생길 수 없다`);
  }
  return {
    version: v[1],
    version_note: (v[2] ?? '').trim() || null,
    published_date,
    effective_date,
  };
}

// ── 가드 — 각 함수가 위반 문자열 배열을 낸다 ──────────────────────────────────

/** G2 + AC6 — 셈과 전수 실재, 고아 파일, locales/ko 금지. */
export function checkPopulation(root) {
  const errors = [];
  const files = policyFiles(root);
  for (const [f] of files) if (!fs.existsSync(path.join(root, f))) errors.push(`없는 문서: ${f}`);

  // AC6 — ko 정본은 루트다. 고아 검사보다 먼저, 빈 디렉터리여도 전용 문면으로 운다.
  if (fs.existsSync(path.join(root, 'docs/policies/locales', MASTER_LOCALE)))
    errors.push(`docs/policies/locales/${MASTER_LOCALE}/ 를 만들지 않는다 — ko 정본은 루트다 (AC6)`);

  // 고아 검사 — 디렉터리 실주사 ∖ 기대집합 ≠ ∅ 이면 실패. 기대집합 = 모집단 + 선언표.
  const expected = new Set([...files.map(([f]) => f), CANON_PATH]);
  const actual = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else actual.push(rel);
    }
  };
  if (fs.existsSync(path.join(root, 'docs/policies'))) walk('docs/policies');
  for (const f of actual) if (!expected.has(f)) errors.push(`고아 파일: ${f} — 모집단(개방 목록 유도) 밖이고 선언표에도 없다`);
  return errors;
}

/** G3 — 금칙·필수 문자열 config 의 형태. 값은 config 가 정본이고 여기서는 모양만 묻는다. */
export function checkStringsConfig(root) {
  const errors = [];
  const s = loadStrings(root);
  const locales = docLocales(root);
  if (!/^[a-z][a-z0-9-]*$/.test(s?.product?.name ?? '')) errors.push('config: product.name 이 소문자 한 단어 식별자가 아니다');
  if (!Array.isArray(s?.product?.former_names)) errors.push('config: product.former_names 목록이 없다');
  if (!s?.vendor?.brand) errors.push('config: vendor.brand 가 없다');
  if (!s?.vendor?.legal_name) errors.push('config: vendor.legal_name 이 없다');
  if (!(s?.vendor?.contact ?? '').includes('@')) errors.push('config: vendor.contact 가 이메일 모양이 아니다');
  if (!Array.isArray(s?.vendor?.former_brands)) errors.push('config: vendor.former_brands 목록이 없다');
  for (const l of locales.filter((x) => x !== MASTER_LOCALE))
    if (!s?.required?.priority_clause?.[l]) errors.push(`config: required.priority_clause.${l} 이 없다 — 번역판 로케일마다 우선 조항이 선다`);
  for (const l of locales) {
    if (!Array.isArray(s?.forbidden?.refund_absolutes?.[l]) || s.forbidden.refund_absolutes[l].length === 0)
      errors.push(`config: forbidden.refund_absolutes.${l} 이 비었다`);
    if (!s?.required?.effective_unset?.[l]) errors.push(`config: required.effective_unset.${l} 이 없다`);
  }
  return errors;
}

/** G4 — 제품 이름 일관성: 전 로케일 본문이 현 이름을 말하고 옛 이름을 말하지 않는다. */
export function checkProductName(root) {
  const errors = [];
  const { product } = loadStrings(root);
  for (const [f, locale, kind] of policyFiles(root)) {
    const body = policyBody(read(root, f));
    if (!body.includes(product.name)) errors.push(`${locale}/${kind}: 본문이 제품 이름(${product.name})을 말하지 않는다`);
    for (const old of product.former_names)
      if (body.toLowerCase().includes(String(old).toLowerCase())) errors.push(`${locale}/${kind}: 옛 제품 이름(${old})이 남아 있다`);
  }
  return errors;
}

/** G5 + AC1 — 벤더 일관성: 전 로케일이 현 벤더를 말하고, 한 로케일에도 옛 벤더가 없다. */
export function checkVendor(root) {
  const errors = [];
  const { vendor } = loadStrings(root);
  for (const [f, locale, kind] of policyFiles(root)) {
    const body = policyBody(read(root, f));
    if (!body.includes(vendor.brand)) errors.push(`${locale}/${kind}: 판매자(${vendor.brand})를 말하지 않는다 — 빠뜨린 번역이 조용히 통과하지 않는다`);
    for (const old of vendor.former_brands)
      if (new RegExp(String(old), 'i').test(body)) errors.push(`${locale}/${kind}: 옛 벤더(${old})가 남아 있다 — 한 로케일만 남아도 그 이용자에게는 문서가 거짓이다`);
  }
  return errors;
}

/** G6 — 법인명은 처리방침 §5·§6 표에만 산다. 산문이 법인명을 박으면 벤더가 바뀔 때 흔들린다. */
export function checkLegalName(root) {
  const errors = [];
  const { vendor } = loadStrings(root);
  for (const [f, locale, kind] of policyFiles(root)) {
    const body = policyBody(read(root, f));
    if (kind !== 'privacy') {
      if (body.includes(vendor.legal_name)) errors.push(`${locale}/${kind}: 법인명은 처리방침 표에만 산다 — 이 문서는 브랜드 이름만 쓴다`);
      continue;
    }
    for (const line of body.split('\n'))
      if (line.includes(vendor.legal_name) && !line.trim().startsWith('|'))
        errors.push(`${locale}/${kind}: 표 밖에서 법인명을 쓴다 — ${line.trim().slice(0, 60)}`);
    const rows = body.split('\n').filter((l) => l.trim().startsWith(`| ${vendor.legal_name} |`));
    if (rows.length !== 2) errors.push(`${locale}/${kind}: 법인명 표 행이 ${rows.length}개다 — §5 수탁자 + §6 국외이전, 2개여야 한다`);
    if (!body.includes(vendor.contact)) errors.push(`${locale}/${kind}: 이전받는 자 연락처(${vendor.contact})가 없다`);
  }
  return errors;
}

/** 라벨을 정규식 조각으로 — config 의 값이 그대로 패턴이 되지 않게 막는다. */
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** G7 — 메타는 ko 한 벌: ko 머리말의 버전·시행일이 형식에 맞고, 번역판에는 기계 줄이 없다.
 * 그리고 **버전과 시행일**의 상태가 전 로케일 본문과 1:1 이다.
 *
 * ⭐⭐ **왜 버전까지 묶는가.** 판번호가 사는 자리가 둘이다 — 기계가 읽는 머리말과 사람이
 * 읽는 본문 부칙. 그리고 **머리말은 발행본에서 걷힌다**(작업 메모는 게시물에 싣지 않는다).
 * ⇒ 방문자가 보는 판번호는 본문의 그 자리 하나이고, 둘이 갈라지면 **공개되는 쪽만 틀린다.**
 * 번역판은 ko **본문** 해시로 묶여 있지만(AC5) 그것은 본문끼리의 묶음이라, 머리말↔본문의
 * 이 한 변은 비어 있었다.
 *
 * ⚠️ **본문의 판번호 전수를 본다** — 하나만 맞추고 다른 자리에 옛 번호가 남는 길을 막는다.
 * ⛔ 로케일의 핀이 없으면 **조용히 지나가지 않는다**: 핀 없는 로케일은 아무것도 재지 않은
 * 것이고, 미판정은 통과가 아니다. */
export function checkMeta(root) {
  const errors = [];
  const { required } = loadStrings(root);
  const metas = {};
  for (const [f, locale, kind] of policyFiles(root)) {
    const raw = read(root, f);
    if (locale === MASTER_LOCALE) {
      try {
        metas[kind] = parsePolicyMeta(raw, f);
      } catch (e) {
        errors.push(e.message);
      }
      continue;
    }
    const head = headComment(raw) ?? '';
    if (VERSION_RE.test(head) || PUBLISHED_RE.test(head) || EFFECTIVE_RE.test(head))
      errors.push(`${locale}/${kind}: 번역판 머리말에 기계 줄(버전:/발행일:/시행일:)이 있다 — 메타의 출처는 ko 정본 하나다`);
  }
  for (const [f, locale, kind] of policyFiles(root)) {
    const meta = metas[kind];
    if (!meta) continue;
    const body = policyBody(read(root, f));

    // ⭐ 판번호 — 머리말의 그 수가 본문에 **그대로** 서 있고, 다른 수가 섞여 있지 않다.
    const label = required.version_label?.[locale];
    if (!label) {
      errors.push(`${locale}/${kind}: config 에 required.version_label.${locale} 이 없다 — 본문 판번호를 묶을 핀이 없다`);
    } else {
      const found = [
        ...body.matchAll(new RegExp(`${escapeRe(String(label))}[ \t]*([0-9]+(?:\\.[0-9]+)*)`, 'gi')),
      ].map((m) => m[1]);
      if (found.length === 0) {
        errors.push(`${locale}/${kind}: 본문에 판번호(「${label} ${meta.version}」)가 없다 — 머리말은 발행본에서 걷히므로 방문자가 보는 판번호는 본문 하나다`);
      } else {
        const diverged = [...new Set(found)].filter((v) => v !== meta.version);
        if (diverged.length > 0)
          errors.push(`${locale}/${kind}: 본문 판번호(${diverged.join('·')})가 머리말(${meta.version})과 갈렸다 — 공개되는 쪽만 틀린다`);
      }
    }

    // ⭐ 발행일 — 시행일과 **같은 모양**으로 묶는다. ⛔ 핀이 없으면 조용히 지나가지 않는다.
    const publishedPin = required.published_unset?.[locale];
    if (meta.published_date === null) {
      if (!publishedPin)
        errors.push(`${locale}/${kind}: config 에 required.published_unset.${locale} 이 없다 — 발행일 상태를 묶을 핀이 없다`);
      else if (!body.includes(publishedPin))
        errors.push(`${locale}/${kind}: 발행일이 미정인데 본문이 그 상태(「${publishedPin}」)를 말하지 않는다`);
    } else if (!body.includes(meta.published_date.split('-')[0])) {
      errors.push(`${locale}/${kind}: 본문이 머리말의 발행일(${meta.published_date})을 말하지 않는다`);
    }

    if (meta.effective_date === null) {
      const pin = required.effective_unset[locale];
      // ⛔ 핀이 없으면 **조용히 지나가지 않는다** — 안 잰 것을 통과로 적지 않는다.
      if (!pin) errors.push(`${locale}/${kind}: config 에 required.effective_unset.${locale} 이 없다 — 시행일 상태를 묶을 핀이 없다`);
      else if (!body.includes(pin)) errors.push(`${locale}/${kind}: 시행일이 미정인데 본문이 그 상태(「${pin}」)를 말하지 않는다`);
    } else {
      const [y, m, d] = meta.effective_date.split('-');
      const ok = locale === MASTER_LOCALE ? body.includes(`${y}년 ${Number(m)}월 ${Number(d)}일`) : body.includes(y) && body.includes(String(Number(d)));
      if (!ok) errors.push(`${locale}/${kind}: 본문 시행일이 머리말(${meta.effective_date})과 갈렸다`);
    }
  }
  return errors;
}

/** AC5 — 로케일 간 대조: 번역판 머리말의 정본 해시가 ko 본문의 지금 해시와 같다.
 * ko 만 고친 PR 은 여기서 빨갛다 — 재전파 없이 정본만 움직이는 길을 막는다. */
export function checkTranslationSync(root) {
  const errors = [];
  for (const [f, locale, kind] of policyFiles(root)) {
    if (locale === MASTER_LOCALE) continue;
    const want = sha256(policyBody(read(root, `docs/policies/${kind}.md`)));
    const stamp = (headComment(read(root, f)) ?? '').match(/정본 해시: sha256:([0-9a-f]{64})/);
    if (!stamp) errors.push(`${locale}/${kind}: 머리말에 「정본 해시: sha256:<64hex>」 스탬프가 없다 — 재전파 대조의 닻이다`);
    else if (stamp[1] !== want)
      errors.push(`${locale}/${kind}: 정본 해시가 ko 본문과 갈렸다 — ko 가 개정됐으면 이 판을 재전파하고 스탬프를 ${want.slice(0, 12)}… 로 올려라`);
  }
  return errors;
}

/** G9 + AC2 — 번역판 선두(첫 절 제목 앞)에 한국어판 우선 조항이 축자로 선다. */
export function checkPriorityClause(root) {
  const errors = [];
  const { required } = loadStrings(root);
  for (const [f, locale, kind] of policyFiles(root)) {
    if (locale === MASTER_LOCALE) continue;
    const body = policyBody(read(root, f));
    const lead = body.split(/^## /m)[0];
    if (!lead.includes(required.priority_clause[locale]))
      errors.push(`${locale}/${kind}: 선두에 한국어판 우선 조항이 없다 (AC2)`);
  }
  return errors;
}

/** G10 + AC4 — 본문에 금액 패턴이 없다. 기간(14일·14 days)은 가격이 아니라 조건이라 허용된다. */
const PRICE_PATTERNS = [/[$€£¥₩]\s*\d[\d,.]*/, /\d[\d,.]*\s*(?:USD|KRW|달러|dollars?)/i, /\b(?:USD|KRW)\s*[\d,.]*\d/];
export function checkPriceFigures(root) {
  const errors = [];
  for (const [f, locale, kind] of policyFiles(root)) {
    const body = policyBody(read(root, f));
    for (const re of PRICE_PATTERNS) {
      const m = body.match(re);
      if (m) errors.push(`${locale}/${kind}: 본문에 가격 숫자가 있다 — 「${m[0]}」. 금액은 결제 화면 위임이다 (AC4)`);
    }
  }
  return errors;
}

/** AC3 — 「환불 불가」류 단정이 0건이다. 금칙의 정본은 config 다. */
export function checkRefundAbsolutes(root) {
  const errors = [];
  const { forbidden } = loadStrings(root);
  for (const [f, locale, kind] of policyFiles(root)) {
    const body = policyBody(read(root, f));
    const haystack = locale === MASTER_LOCALE ? body : body.toLowerCase();
    for (const phrase of forbidden.refund_absolutes[locale] ?? [])
      if (haystack.includes(locale === MASTER_LOCALE ? phrase : String(phrase).toLowerCase()))
        errors.push(`${locale}/${kind}: 「환불 불가」류 단정이 있다 — 「${phrase}」 (AC3)`);
  }
  return errors;
}

/** 저장소 간 — 정본 선언표: Graduand 행의 경로는 실재하고, 이 저장소의 정책 파일 전수는
 * 표에 선언돼 있다. 선언 없는 파일은 조용히 두 번째 정본이 된다. */
export function checkCanon(root) {
  const errors = [];
  if (!fs.existsSync(path.join(root, CANON_PATH))) return [`선언표가 없다: ${CANON_PATH}`];
  const body = policyBody(read(root, CANON_PATH));
  const rows = body
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && !/^\|[\s|:-]*\|?$/.test(l.trim()))
    .map((l) => l.split('|').map((c) => c.trim()).filter(Boolean))
    .filter((cells) => cells.length === 3 && cells[0] !== '문서');
  if (rows.length === 0) return [`선언표에 행이 없다: ${CANON_PATH}`];

  const names = rows.map(([doc]) => doc);
  for (const dup of names.filter((n, i) => names.indexOf(n) !== i))
    errors.push(`선언표: 「${dup}」 가 두 번 선언됐다 — 정본은 하나다`);

  const ours = rows.filter(([, repo]) => repo === 'Moayo-app/Graduand');
  for (const [doc, , p] of ours)
    if (!fs.existsSync(path.join(root, p))) errors.push(`선언표: 「${doc}」 의 경로(${p})가 실재하지 않는다`);

  const covered = (file) => ours.some(([, , p]) => p === file || (p.endsWith('/') && file.startsWith(p)));
  for (const f of [...policyFiles(root).map(([f]) => f), ...CONFIG_PATHS, CANON_PATH])
    if (!covered(f)) errors.push(`선언표에 없는 정책 파일: ${f} — 선언 없는 파일은 조용히 두 번째 정본이 된다 (AC5)`);
  return errors;
}
