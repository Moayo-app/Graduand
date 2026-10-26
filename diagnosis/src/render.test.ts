/**
 * 렌더러의 AC — 뷰모델의 줄이 **화면 텍스트로** 선다.
 *
 * ⚠️ 이 패키지에는 의존성이 없다(배달되는 정적 화면이다) — DOM 구현을 받아 오지 않고,
 * 렌더러가 실제로 쓰는 넷(`createElement` · `className` · `textContent` · `append`)만
 * 세운 최소 노드로 **진짜 `renderReport` 를** 돌린다. 스텁이 거짓말을 해도 같은 줄을
 * 뷰모델 층에서 무는 단정이 `report.test.ts` 에 함께 서 있다 — 한쪽만으로 초록이 되지 않는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReport } from './report.ts';
import { ko } from './strings-ko.ts';
import { renderReport } from './render.ts';
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
        id: 'palette-cross',
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
};

interface StubNode {
  tag: string;
  className: string;
  textContent: string;
  children: StubNode[];
  append(...nodes: StubNode[]): void;
}

const stubNode = (tag: string): StubNode => ({
  tag,
  className: '',
  textContent: '',
  children: [],
  append(...nodes: StubNode[]): void {
    this.children.push(...nodes);
  },
});

/** 트리의 모든 텍스트 — 방문자가 화면에서 읽는 것. */
const textOf = (node: StubNode): string =>
  [node.textContent, ...node.children.map(textOf)].filter((t) => t !== '').join('\n');

function withStubDocument<T>(run: () => T): T {
  const host = globalThis as { document?: unknown };
  const previous = host.document;
  host.document = { createElement: (tag: string) => stubNode(tag) };
  try {
    return run();
  } finally {
    host.document = previous;
  }
}

test('AC4 — 보고를 렌더하면 선언된 갈라짐의 사유 문장이 화면 텍스트에 보인다', () => {
  const vm = buildReport(measurement, 'url', ko);
  const line = vm.checks[0]!.evidence[0]!;
  const screen = withStubDocument(() => textOf(renderReport(vm) as unknown as StubNode));

  assert.ok(screen.includes(line), '증거 줄이 화면 텍스트에 없다 — 렌더러가 증거를 그리지 않았다');
  assert.ok(screen.includes(DIVERGENCE_REASON), '사유 문장이 화면 텍스트에 없다 — 읽지 않는 사유는 통과료다');
  // 대조군 — 하네스가 아무 문장이나 초록으로 만들지 않는다.
  assert.ok(!screen.includes('적지 않은 사유'));
  // 수도 같은 화면에 선다 — 「갈라짐 1건」이 「0건」과 같은 통과로 보이지 않는다.
  assert.ok(screen.includes('diverged 1'));
});
