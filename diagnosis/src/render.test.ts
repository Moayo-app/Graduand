/**
 * 렌더러의 AC — 뷰모델의 줄이 **화면 텍스트로** 선다.
 *
 * ⚠️ 이 패키지에는 의존성이 없다(배달되는 정적 화면이다) — DOM 구현을 받아 오지 않고,
 * 렌더러가 실제로 쓰는 것만 세운 최소 노드로 **진짜 `renderReport` 를** 돌린다 —
 * `createElement` · `createElementNS` · `createTextNode` · `className` · `textContent` ·
 * `setAttribute` · `append`. ⚠️ 글리프가 서면서 **넷이 일곱이 됐다**: 스텁이 렌더러보다
 * 좁으면 「돌았다」가 거짓이 되므로, 렌더러가 쓰는 것이 늘면 여기도 함께 넓어진다. 스텁이 거짓말을 해도 같은 줄을
 * 뷰모델 층에서 무는 단정이 `report.test.ts` 에 함께 서 있다 — 한쪽만으로 초록이 되지 않는다.
 */

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { buildReport } from './report.ts';
import { ko } from './strings-ko.ts';
import { renderReport } from './render.ts';
import { unjudgeableScreen } from './screens.ts';
import type { Unjudgeable } from './outcome.ts';
import { SCHEMA_VERSION, type Measurement } from '../../verifier/src/index.ts';

const DIVERGENCE_REASON = '우리 지면 값은 우리 것이다 — 이 값의 정본은 이 저장소다';

/** 교차 축의 판정 결과 하나 — 사유를 단 갈라짐이 칸 하나를 「밖」으로 옮긴 모양. */
const measurement: Measurement = {
  judgment: {
    v: SCHEMA_VERSION,
    repo: 'acme/widgets',
    commit: 'a3f8c1e2d4b5a6978877665544332211deadbeef',
    checks: [
      {
        id: 'shared-values-cross:design',
        status: 'pass',
        reason: null,
        counts: { canon: 3, pinned: 2, matched: 2, mismatched: 0, unpinned: 0, unjudged: 0, diverged: 1, excluded: 0, evidenceOmitted: 0 },
        evidence: [
          { token: '--paper', file: 'tokens/tokens.css', line: 2, why: 'declared-divergence', reason: DIVERGENCE_REASON },
        ],
      },
    ],
  },
  source: 'github-api',
  measuredAt: '2026-10-25T12:00:00.000Z',
  verifier: { name: 'graduand', version: '0.0.0' },
  dirty: 0,
  // 개정 3 — 봉투가 격자와 시야를 든다(빈 격자는 사유를 들고, 빈 시야는 한 저장소 표면이다).
  grid: { surfaces: [], rules: [], reason: 'no-declaration' },
  undeclared: {
    copies: [],
    copiesOmitted: 0,
    blocks: 0,
    diverged: [],
    divergedOmitted: 0,
    divergedPairs: 0,
    divergedTruncated: false,
    documents: { tracked: 0, read: 0 },
    surfaces: [],
  },
  peers: [],
};

interface StubNode {
  tag: string;
  className: string;
  textContent: string;
  /** 글리프의 도형 — ⭐ 색을 빼고 **꼴만** 비교할 수 있게 속성을 그대로 든다. */
  attrs: Record<string, string>;
  children: StubNode[];
  append(...nodes: StubNode[]): void;
  setAttribute(name: string, value: string): void;
}

const stubNode = (tag: string): StubNode => ({
  tag,
  className: '',
  textContent: '',
  attrs: {},
  children: [],
  append(...nodes: StubNode[]): void {
    this.children.push(...nodes);
  },
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  },
});

/** 트리의 모든 텍스트 — 방문자가 화면에서 읽는 것. */
const textOf = (node: StubNode): string =>
  [node.textContent, ...node.children.map(textOf)].filter((t) => t !== '').join('\n');

function withStubDocument<T>(run: () => T): T {
  const host = globalThis as { document?: unknown };
  const previous = host.document;
  host.document = {
    createElement: (tag: string) => stubNode(tag),
    createElementNS: (_ns: string, tag: string) => stubNode(tag),
    createTextNode: (text: string) => ({ ...stubNode('#text'), textContent: text }),
  };
  try {
    return run();
  } finally {
    host.document = previous;
  }
}

test('AC4 — 보고를 렌더하면 선언된 갈라짐의 사유 문장이 화면 텍스트에 보인다', () => {
  const vm = buildReport(measurement, 'url', ko);
  const line = vm.measured.checks[0]!.evidence[0]!;
  const screen = withStubDocument(() => textOf(renderReport(vm) as unknown as StubNode));

  assert.ok(screen.includes(line), '증거 줄이 화면 텍스트에 없다 — 렌더러가 증거를 그리지 않았다');
  assert.ok(screen.includes(DIVERGENCE_REASON), '사유 문장이 화면 텍스트에 없다 — 읽지 않는 사유는 통과료다');
  // 대조군 — 하네스가 아무 문장이나 초록으로 만들지 않는다.
  assert.ok(!screen.includes('적지 않은 사유'));
  // 수도 같은 화면에 선다 — 「갈라짐 1건」이 「0건」과 같은 통과로 보이지 않는다.
  assert.ok(screen.includes('diverged 1'));
});

/* ──────────────── 글리프 · 접기 · 스캐폴드 — 조립 층의 AC ──────────────── */

/**
 * 트리에서 class 로 노드를 찾는다 — 렌더러가 붙인 그 이름으로.
 *
 * ⚠️ **두 자리를 본다**: HTML 노드는 `className` 으로 받고 SVG 노드는 `class` **속성**으로
 * 받는다(`createElementNS` 가 낸 것에는 `className` 이 그 뜻이 아니다). 한쪽만 보면 글리프가
 * 조용히 안 걸리고, 그 침묵은 「도형이 없다」와 같은 초록으로 그려진다.
 */
const findAll = (node: StubNode, className: string): StubNode[] => {
  const names = `${node.className} ${node.attrs.class ?? ''}`.split(' ');
  return [
    ...(names.includes(className) ? [node] : []),
    ...node.children.flatMap((child) => findAll(child, className)),
  ];
};

/**
 * 글리프의 **꼴** — 색을 지우고 도형만 남긴다.
 *
 * ⭐⭐ 색을 지우는 것이 이 함수의 전부다: AC 가 묻는 것이 「색을 모두 같게 바꿔도 셋이
 * 구별되는가」이고, 그 질문은 **꼴만 비교**해야 답이 나온다.
 */
const shapeOf = (glyph: StubNode): string =>
  glyph.children
    .map((part) => {
      const attrs = Object.entries(part.attrs)
        .filter(([name]) => name !== 'fill' && name !== 'stroke')
        .map(([name, value]) => `${name}=${value}`)
        .sort()
        .join(',');
      // `fill="none"` 은 색이 아니라 **채우지 않는다는 꼴**이라 남긴다.
      return `${part.tag}(${attrs}${part.attrs.fill === 'none' ? ',unfilled' : ''})`;
    })
    .join('+');

const threeStates = (): Measurement => {
  const m = structuredClone(measurement);
  const base = m.judgment.checks[0]!;
  m.judgment.checks = [
    base,
    { ...structuredClone(base), id: 'refs', status: 'violation', reason: null },
    { ...structuredClone(base), id: 'ui-paths', status: 'unjudged', reason: 'no-declaration', evidence: [] },
  ];
  return m;
};

test('AC2 — 글리프 셋이 서로 다른 꼴이다: 색을 모두 같게 해도 셋이 구별된다', () => {
  const vm = buildReport(threeStates(), 'url', ko);
  const root = withStubDocument(() => renderReport(vm) as unknown as StubNode);
  const glyphs = findAll(root, 'glyph');
  assert.equal(glyphs.length, 3, '배지마다 글리프가 하나씩 서지 않았다');

  const shapes = glyphs.map(shapeOf);
  assert.equal(new Set(shapes).size, 3, `꼴이 겹친다 — ${shapes.join(' | ')}`);
  for (const shape of shapes) assert.notEqual(shape, '', '빈 글리프가 있다 — 도형 없는 배지다');
});

test('AC6 (negative) — 증거는 접히고 스크롤 상자는 0 개다', () => {
  const many = structuredClone(measurement);
  many.judgment.checks[0]!.evidence = Array.from({ length: 52 }, (_, i) => ({
    token: `--t${i}`, file: 'tokens/tokens.css', line: i, why: 'declared-divergence', reason: DIVERGENCE_REASON,
  }));
  const root = withStubDocument(() => renderReport(buildReport(many, 'url', ko)) as unknown as StubNode);

  const folds = findAll(root, 'evidence-fold');
  assert.equal(folds.length, 1, '증거가 접히지 않았다');
  assert.equal(folds[0]!.tag, 'details', `접는 자리가 details 가 아니다 — ${folds[0]!.tag}`);
  assert.ok(folds[0]!.children.some((child) => child.tag === 'summary'), '요약 줄이 없다 — 펼치기 전에 아무것도 말하지 않는다');

  // ⚠️ 자른 수는 **접힌 밖**에 선다 — 펼치지 않아도 보여야 하는 사실이다.
  const omitted = findAll(root, 'omitted');
  assert.equal(omitted.length, 1);
  assert.equal(findAll(folds[0]!, 'omitted').length, 0, '자른 수가 접힌 안에 들어갔다');

  // ⛔ 스크롤 상자 0 — 상자 안의 것은 인쇄에도 검색에도 안 걸린다.
  assert.equal(findAll(root, 'scroll').length + findAll(root, 'scrollbox').length, 0);
});

test('AC3 (negative) — 미판정 0 이면 그 절이 DOM 에 없다', () => {
  const root = withStubDocument(() => renderReport(buildReport(measurement, 'url', ko)) as unknown as StubNode);
  assert.equal(findAll(root, 'report-measured').length, 1);
  assert.equal(findAll(root, 'report-unmeasured').length, 0, '빈 절이 DOM 에 섰다');

  const both = withStubDocument(() => renderReport(buildReport(threeStates(), 'url', ko)) as unknown as StubNode);
  assert.equal(findAll(both, 'report-unmeasured').length, 1, '미판정이 있는데 절이 없다 — 통제가 죽었다');
});

test('AC7 (negative) — 스캐폴드는 선언이 틀린 화면에만 남는다', () => {
  const shows = (outcome: Unjudgeable): boolean => unjudgeableScreen(outcome, ko, () => new Date(0)).showsScaffold;

  // ⭕ 고칠 자리가 **고객의 선언**인 하나.
  assert.equal(shows({ kind: 'declaration-invalid', problems: ['ui 키가 없다'] }), true);

  // ⛔ 나머지 전수 — 명령을 든 다섯과 `error`. ⚠️ 갈래를 손으로 세지 않는다: 명령이 있는
  //    화면은 대안이 이미 명령이고, `error` 는 고칠 자리가 우리 쪽이거나 네트워크다.
  const others: Unjudgeable[] = [
    { kind: 'unreadable', code: 'private-or-missing' },
    { kind: 'unreadable', code: 'tree-truncated' },
    { kind: 'rate-limited', resetAt: null },
    { kind: 'version-mismatch', axis: 'fragment', found: '0' },
    { kind: 'fragment-unreadable', message: 'bad fragment' },
    { kind: 'error', message: 'boom' },
  ];
  for (const outcome of others) assert.equal(shows(outcome), false, `${outcome.kind}: 스캐폴드가 남았다`);

  // ⭐ 그 사실을 **화면이 적용한다** — main.ts 가 그 축을 읽어 숨김을 정한다.
  const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
  assert.match(main, /scaffold\.hidden = !screen\.showsScaffold/, 'main 이 그 갈래를 적용하지 않는다');
});

test('선언 0 의 절은 화면에 서고 **배지가 0** 이다 — 상태 없는 수가 판정처럼 그려지지 않는다', () => {
  const facts = structuredClone(measurement);
  facts.undeclared = {
    copies: [{ head: '## one home per fact', lines: 4, files: ['README.md', 'docs/guide.md'] }],
    copiesOmitted: 0,
    blocks: 1,
    diverged: [
      { head: 'the same sentence, two versions', files: ['a.md', 'docs/b.md'], shared: 5, differing: 2 },
    ],
    divergedOmitted: 0,
    divergedPairs: 1,
    divergedTruncated: false,
    documents: { tracked: 3, read: 3 },
    surfaces: [{ adapter: 'css-custom-properties', files: 2, loaded: 0 }],
  };
  const vm = buildReport(facts, 'url', ko);
  const tree = withStubDocument(() => renderReport(vm) as unknown as StubNode);
  const section = findAll(tree, 'report-undeclared');
  assert.equal(section.length, 1, '절이 하나가 아니다');

  const screen = textOf(section[0]!);
  // 집 둘이 화면 텍스트에 **그대로** 선다 — 사본의 집이 접히면 찾아갈 수 없다.
  assert.ok(screen.includes('README.md') && screen.includes('docs/guide.md'), screen);
  assert.ok(screen.includes('## one home per fact'), screen);
  // 머리말이 수보다 **먼저** 선다 — 뒤에 두면 수를 먼저 읽고 판정으로 센다.
  assert.ok(screen.indexOf(vm.undeclared.noticeLines[0]!) < screen.indexOf(vm.undeclared.copiesLine), screen);

  // ⛔⛔ 이 절 안에 상태 배지도 글리프도 없다 — 붙일 자리가 **뷰모델에** 없다.
  assert.deepEqual(findAll(section[0]!, 'glyph'), []);
  for (const status of ['pass', 'violation', 'unjudged']) {
    assert.deepEqual(findAll(section[0]!, `badge-${status}`), [], `${status} 배지가 섰다`);
  }
  // 대조군 — 같은 트리의 **재어진** 절에는 글리프가 있다(하네스가 아무것도 못 찾는 게 아니다).
  assert.ok(findAll(tree, 'glyph').length > 0, '하네스가 글리프를 아예 못 찾는다');
});
