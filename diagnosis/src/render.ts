/**
 * 뷰모델 → DOM. 모든 텍스트는 textContent 로만 들어간다 — 축자 증거가 마크업으로
 * 해석되는 일이 없다. 화면 결정(문구·상태)은 전부 뷰모델 층의 몫이고 여기는 조립만 한다.
 */

import type { CheckVM, ReportVM } from './report.ts';
import type { ScreenVM } from './screens.ts';

function el(tag: string, className: string | null, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className !== null) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCheck(check: CheckVM): HTMLElement {
  const card = el('section', `check check-${check.status}`);
  const head = el('div', 'check-head');
  head.append(el('h3', 'check-id mono', check.id));
  head.append(el('span', `badge badge-${check.status}`, check.statusLabel));
  card.append(head);
  if (check.reasonLine !== null) card.append(el('p', 'reason', check.reasonLine));
  card.append(el('p', 'counts mono', check.countsLine));
  if (check.evidence.length > 0) {
    const list = el('ul', 'evidence mono');
    for (const line of check.evidence) list.append(el('li', null, line));
    card.append(list);
  }
  if (check.omittedLine !== null) card.append(el('p', 'omitted', check.omittedLine));
  return card;
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

  for (const check of vm.checks) root.append(renderCheck(check));
  root.append(el('p', 'totals', vm.totalsLine));
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
