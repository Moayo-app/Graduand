/**
 * 뷰모델 → DOM. 모든 텍스트는 textContent 로만 들어간다 — 축자 증거가 마크업으로
 * 해석되는 일이 없다. 화면 결정(문구·상태)은 전부 뷰모델 층의 몫이고 여기는 조립만 한다.
 */

import type { CheckStatus } from '../../verifier/src/index.ts';
import type { ComposedVM } from './composed.ts';
import type { ObservationVM } from './observation.ts';
import type { CheckVM, ReportSection, ReportVM, UndeclaredVM } from './report.ts';
import type { ScreenVM } from './screens.ts';

function el(tag: string, className: string | null, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className !== null) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string>): SVGElement => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

/**
 * 상태의 **글리프** — ⭐⭐ 담채가 꺼져도 셋이 갈린다.
 *
 * 판정 규율 2 가 「판정 불가는 위반 0 과 다르다」인데, 그 차이가 **색 하나**로만 서면 색을
 * 못 보는 사람에게는 서지 않는다. ⇒ 꼴을 셋으로 가른다 — 심볼이 쓰는 장치 그대로다:
 *   통과   = 채운 원 (재어졌고 막은 것이 없다)
 *   위반   = 채운 원을 **자가 가로지른다** (재어졌고 걸렸다 — 자의 색은 **바탕색**이다)
 *   미판정 = **빈 고리** (칸이 비었다 — 통과가 아니라 **아직 아무것도 없다**)
 * ⛔ 색을 셋 다 같게 바꿔도 셋이 구별된다 — 그것이 이 글리프가 서는 조건이다.
 */
function statusGlyph(status: CheckStatus): SVGElement {
  const root = svg('svg', { class: 'glyph', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' });
  if (status === 'unjudged') {
    root.append(svg('circle', { cx: '8', cy: '8', r: '5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }));
    return root;
  }
  root.append(svg('circle', { cx: '8', cy: '8', r: '5', fill: 'currentColor' }));
  if (status === 'violation') root.append(svg('rect', { x: '1', y: '7', width: '14', height: '2', fill: 'var(--paper)' }));
  return root;
}

function renderCheck(check: CheckVM): HTMLElement {
  const card = el('section', `check check-${check.status}`);
  const head = el('div', 'check-head');
  head.append(el('h3', 'check-id mono', check.id));
  const badge = el('span', `badge badge-${check.status}`);
  badge.append(statusGlyph(check.status));
  badge.append(document.createTextNode(check.statusLabel));
  head.append(badge);
  card.append(head);
  if (check.reasonLine !== null) card.append(el('p', 'reason', check.reasonLine));
  card.append(el('p', 'counts mono', check.countsLine));
  if (check.evidence.length > 0) {
    // ⭐ **접는다, 자르지 않는다** — 접힌 것은 펼치면 다 있고, 자른 것은 없다. 두 사실을
    //   한 줄에 뭉치지 않으려고 요약은 **보인 수만** 말하고 자른 수는 밖에 따로 선다.
    // ⛔ 스크롤 상자를 쓰지 않는다: 상자 안의 것은 인쇄에도 검색에도 안 걸리고, 「더 있다」가
    //   화면 밖 신호(스크롤바)로만 남는다.
    const fold = el('details', 'evidence-fold');
    if (check.evidenceSummary !== null) fold.append(el('summary', null, check.evidenceSummary));
    const list = el('ul', 'evidence mono');
    for (const line of check.evidence) list.append(el('li', null, line));
    fold.append(list);
    card.append(fold);
  }
  // ⚠️ 접힌 안이 아니라 **밖**이다 — 자른 수는 펼치지 않아도 보여야 하는 사실이다.
  if (check.omittedLine !== null) card.append(el('p', 'omitted', check.omittedLine));
  return card;
}

/** 한 절 — 머리와 목록이 한 쌍이다. ⛔ 빈 절은 여기 오지 않는다(뷰모델이 이미 걸렀다). */
function renderSection(section: ReportSection, kind: string): HTMLElement {
  const node = el('section', `report-part report-${kind}`);
  node.append(el('h3', 'part-h', section.heading));
  for (const check of section.checks) node.append(renderCheck(check));
  return node;
}

/**
 * 선언 0 에서 보이는 사실 — ⛔ **글리프가 없다.** 상태 배지를 붙일 자리가 뷰모델에 없고
 * (`UndeclaredVM` 에 `status` 가 없다), 그 부재가 「이것은 판정이 아니다」의 집행이다.
 * 색으로만 가르면 색을 못 보는 사람에게 그 선이 서지 않으므로, 가르는 것은 **절과 머리말**이다.
 */
function renderUndeclared(vm: UndeclaredVM): HTMLElement {
  const node = el('section', 'report-part report-undeclared');
  node.append(el('h3', 'part-h', vm.heading));
  // 「판정이 아니다」가 수보다 **먼저** 선다 — 뒤에 두면 수를 먼저 읽고 판정으로 센다.
  for (const line of vm.noticeLines) node.append(el('p', 'notice', line));
  node.append(el('p', 'counts mono', vm.documentsLine));
  node.append(el('p', 'totals', vm.copiesLine));
  for (const copy of vm.copies) {
    const item = el('section', 'copy');
    item.append(el('p', 'counts mono', copy.homesLine));
    item.append(el('p', 'copy-head mono', copy.head));
    const list = el('ul', 'evidence mono');
    for (const file of copy.files) list.append(el('li', null, file));
    item.append(list);
    node.append(item);
  }
  // ⚠️ 잘린 수는 접힘 밖이다 — 펼치지 않아도 보여야 하는 사실이다(증거의 그 자리와 같다).
  if (vm.omittedLine !== null) node.append(el('p', 'omitted', vm.omittedLine));
  // ⭐ 갈라진 쪽은 **다른 줄**이다 — 「아직 같다」와 「이미 두 말을 한다」를 한 수로 접지 않는다.
  node.append(el('p', 'totals', vm.divergedLine));
  for (const pair of vm.diverged) {
    const item = el('section', 'copy copy-diverged');
    item.append(el('p', 'counts mono', pair.countsLine));
    item.append(el('p', 'copy-head mono', pair.head));
    const list = el('ul', 'evidence mono');
    for (const file of pair.files) list.append(el('li', null, file));
    item.append(list);
    node.append(item);
  }
  if (vm.divergedOmittedLine !== null) node.append(el('p', 'omitted', vm.divergedOmittedLine));
  // ⚠️ 「다 보지 못했다」는 잘린 수와 **다른 사실**이라 줄이 따로 선다.
  if (vm.divergedTruncatedLine !== null) node.append(el('p', 'warn', vm.divergedTruncatedLine));
  for (const line of vm.whyLines) node.append(el('p', null, line));
  node.append(el('h4', 'part-h', vm.surfacesHeading));
  const surfaces = el('ul', 'evidence mono');
  for (const line of vm.surfaceLines) surfaces.append(el('li', null, line));
  node.append(surfaces);
  return node;
}

export function renderReport(vm: ReportVM): HTMLElement {
  const root = el('article', 'report');
  const head = el('header', 'report-head');
  head.append(el('h2', null, vm.title));

  const meta = el('dl', 'report-meta');
  const row = (label: string, value: string, mono: boolean): void => {
    meta.append(el('dt', null, label));
    meta.append(el('dd', mono ? 'mono' : null, value));
  };
  // 항목 이름은 **뷰모델이 든다** — 이 파일의 산문 축자대로 「화면 결정(문구·상태)은 전부
  // 뷰모델 층의 몫이고 여기는 조립만 한다」. 문구가 여기 박히면 그 선이 반만 서 있다.
  row(vm.labels.repo, vm.head.repo, true);
  row(vm.labels.commit, vm.head.commit, true);
  row(vm.labels.source, vm.head.sourceLine, false);
  row(vm.labels.measuredAt, vm.head.measuredAt, true);
  row(vm.labels.verifier, vm.head.verifierLine, true);
  head.append(meta);

  if (vm.head.dirtyLine !== null) head.append(el('p', 'warn', vm.head.dirtyLine));
  if (vm.head.fragmentNotice !== null) head.append(el('p', 'notice', vm.head.fragmentNotice));
  // 자격·만기 줄들은 **봉투의 정직성 줄들 옆**이다 — 판정 결과 절에 섞으면 위반처럼 읽힌다.
  // ⭐ 줄을 축자로 그린다: 어느 로케일의 어느 문장인지는 뷰모델이 이미 정했다. 여기서
  // 문구를 자르거나 이어 붙이면 그 순간 이 표면이 사본 하나를 든다.
  if (vm.head.entitlementLines.length > 0) {
    const notice = el('div', 'entitlement');
    for (const line of vm.head.entitlementLines) notice.append(el('p', null, line));
    head.append(notice);
  }
  root.append(head);

  const scope = el('div', 'report-scope');
  for (const line of vm.scopeLines) scope.append(el('p', null, line));
  root.append(scope);

  // ⭐ 가르는 손은 뷰모델에 있다 — 여기는 **있는 절만** 조립한다.
  root.append(renderSection(vm.measured, 'measured'));
  if (vm.unmeasured !== null) root.append(renderSection(vm.unmeasured, 'unmeasured'));
  root.append(el('p', 'totals', vm.totalsLine));
  // ⭐ 합계 **뒤**다 — 재어진 수를 먼저 말하고, 그 분모가 비어 재지 못한 자리에 대해
  //   「그래도 보이는 것」을 적는다. 앞에 두면 판정의 머리처럼 읽힌다.
  root.append(renderUndeclared(vm.undeclared));
  return root;
}

export function renderScreen(vm: ScreenVM): HTMLElement {
  const root = el('article', 'screen');
  root.append(el('h2', null, vm.title));
  for (const line of vm.lines) root.append(el('p', null, line));
  if (vm.command !== null) {
    const pre = el('pre', 'command');
    pre.append(el('code', null, vm.command));
    root.append(pre);
    if (vm.commandCaption !== null) root.append(el('p', 'note', vm.commandCaption));
  }
  return root;
}

/**
 * 관측 결과 — **격자 먼저, 보고서 뒤다.**
 *
 * ⭐ 순서의 사유: 격자는 「**편입된 규칙이 선언된 표면에서** 무엇을 말하는가」이고 보고서는
 * 「이 저장소의 **축들**이 무엇을 말하는가」다. 고객이 쥔 것은 선언이라 그 수가 먼저 선다.
 * ⛔ 두 수를 합치지 않는다 — 다른 질문의 답이고 둘 다 참이다.
 */
export function renderObservation(vm: ObservationVM): HTMLElement {
  const root = el('article', 'observation');
  root.append(el('p', 'canon-line', vm.canonLine));

  const grid = el('section', 'grid');
  // ⭐ 수가 **없을 수 있다** — 칸이 0 이면 수를 내지 않고 사유를 적는다(「관할 0 — 위반 0」은
  //   읽는 사람에게 「문제 없음」이고, 그 둔갑이 이 제품이 막는 것이다).
  if (vm.jurisdictionLine !== null) grid.append(el('p', 'totals', vm.jurisdictionLine));
  grid.append(el('p', 'shape mono', vm.shapeLine));
  if (vm.emptyLine !== null) grid.append(el('p', 'reason', vm.emptyLine));
  for (const row of vm.rows) {
    const line = el('section', `grid-row grid-${row.status}`);
    const head = el('div', 'check-head');
    head.append(el('h3', 'check-id mono', row.rule));
    const badge = el('span', `badge badge-${row.status}`);
    badge.append(statusGlyph(row.status));
    badge.append(document.createTextNode(row.statusLabel));
    head.append(badge);
    line.append(head);
    if (row.reasonLine !== null) line.append(el('p', 'reason', row.reasonLine));
    line.append(el('p', 'counts mono', row.choseLine));
    grid.append(line);
  }
  root.append(grid);

  // 체크마다의 3상태 · 수 · 증거 — 같은 렌더러가 그린다(사본 0).
  root.append(renderReport(vm.report));
  return root;
}

/**
 * 조립 결과 — ⭐ **조립한 것과 조립하지 않은 것**을 한 화면에 둔다. 박제하지 않은 토큰이
 * 접히면 그 공백이 선언의 침묵이 되고, 침묵은 시간이 지나면 반드시 틀린다.
 */
export function renderComposed(vm: ComposedVM): HTMLElement {
  const root = el('article', 'composed');
  // ⭐ 머리가 **거부에도 선다** — 「어느 저장소에서 조립이 서지 않았는가」가 사유보다 먼저
  //   답해야 하는 질문이다(1+N 벌 중 한 벌만 거부될 수 있다).
  root.append(el('h3', 'card-h', vm.head));
  if (vm.refusedHead !== null) {
    root.append(el('p', 'warn', vm.refusedHead));
    const list = el('ul', 'problems mono');
    for (const problem of vm.problems) list.append(el('li', null, problem));
    root.append(list);
    return root;
  }
  for (const line of vm.lines) root.append(el('p', null, line));
  if (vm.unpinned.length > 0) {
    const list = el('ul', 'evidence mono');
    for (const token of vm.unpinned) {
      list.append(el('li', null, `${token.token} (${token.at}) — ${token.why}`));
    }
    root.append(list);
  }
  return root;
}
