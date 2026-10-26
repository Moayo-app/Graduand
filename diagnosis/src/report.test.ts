/**
 * 보고서 뷰모델의 AC — 두 모드가 같은 컴포넌트로 그린다(AC2), 보고서 머리의 다섯 항목,
 * 3상태 수만 말한다, 증거는 축자, 미판정에는 사유가 붙는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReport, type ReportVM } from './report.ts';
import { ko } from './strings-ko.ts';
import { REASON_CODES, SCHEMA_VERSION, type Measurement } from '../../verifier/src/index.ts';

const measurement: Measurement = {
  judgment: {
    v: SCHEMA_VERSION,
    repo: 'acme/widgets',
    commit: 'a3f8c1e2d4b5a6978877665544332211deadbeef',
    checks: [
      {
        id: 'refs',
        status: 'violation',
        reason: null,
        counts: { references: 4, unresolved: 1, excused: 0, external: 1, evidenceOmitted: 0 },
        evidence: [
          {
            file: 'README.md',
            line: 2,
            notation: 'markdown-link',
            raw: 'docs/missing.md',
            why: 'missing',
            tried: 'docs/missing.md',
          },
        ],
      },
      {
        id: 'ui-paths',
        status: 'unjudged',
        reason: 'no-declaration',
        counts: { declared: 0 },
        evidence: [],
      },
    ],
  },
  source: 'github-api',
  measuredAt: '2026-10-25T12:00:00.000Z',
  verifier: { name: 'graduand', version: '0.0.0' },
  dirty: 0,
};

const neutral = (vm: ReportVM): ReportVM => {
  const clone = structuredClone(vm);
  clone.head.sourceLine = '';
  clone.head.fragmentNotice = null;
  return clone;
};

test('AC2 — URL 모드와 fragment 모드는 같은 빌더의 같은 뷰모델이다: 다른 것은 머리의 입력 출처 줄뿐', () => {
  const urlVM = buildReport(measurement, 'url', ko);
  const fragmentVM = buildReport(measurement, 'fragment', ko);

  assert.notEqual(urlVM.head.sourceLine, fragmentVM.head.sourceLine);
  assert.deepEqual(neutral(urlVM), neutral(fragmentVM));
});

test('fragment 모드 보고서에는 고지 한 줄이 선다 — 주소가 무엇을 담는지', () => {
  assert.equal(buildReport(measurement, 'url', ko).head.fragmentNotice, null);
  const notice = buildReport(measurement, 'fragment', ko).head.fragmentNotice;
  assert.equal(notice, ko.report.fragmentNotice);
  assert.match(notice ?? '', /저장소 이름과 판정 결과가 들어 있다/);
});

test('보고서 머리 — repo · 커밋 SHA 전체 · 입력 출처 · 측정 시각 · 판정기 판', () => {
  const vm = buildReport(measurement, 'url', ko);
  assert.equal(vm.head.repo, 'acme/widgets');
  assert.equal(vm.head.commit, 'a3f8c1e2d4b5a6978877665544332211deadbeef');
  assert.match(vm.head.sourceLine, /api\.github\.com/);
  assert.equal(vm.head.measuredAt, '2026-10-25T12:00:00.000Z');
  assert.equal(vm.head.verifierLine, 'graduand 0.0.0');
  assert.equal(vm.head.dirtyLine, null);
});

test('수는 3상태로만 말한다 — 합산 지표·비율 문자가 뷰모델에 없다', () => {
  const vm = buildReport(measurement, 'url', ko);
  assert.equal(vm.totalsLine, '체크 2 — 위반 1 · 통과 0 · 미판정 1');
  assert.ok(!JSON.stringify(vm).includes('%'));
});

test('증거는 축자다 — refs 증거 한 건이 파일:줄·표기·원문·사유·시도 경로를 그대로 든다', () => {
  const vm = buildReport(measurement, 'url', ko);
  const refs = vm.checks.find((c) => c.id === 'refs');
  assert.deepEqual(refs?.evidence, ['README.md:2 [markdown-link] docs/missing.md — missing (docs/missing.md)']);
  assert.equal(refs?.omittedLine, null);
  assert.match(refs?.countsLine ?? '', /unresolved 1/);
  assert.ok(!(refs?.countsLine ?? '').includes('evidenceOmitted'));
});

test('미판정에는 사유가 붙는다 — 사유 줄 없는 미판정 뷰모델은 없다', () => {
  const vm = buildReport(measurement, 'url', ko);
  const uiPaths = vm.checks.find((c) => c.id === 'ui-paths');
  assert.equal(uiPaths?.status, 'unjudged');
  assert.match(uiPaths?.reasonLine ?? '', /no-declaration/);
  assert.match(uiPaths?.reasonLine ?? '', /위반도 통과도 아니다/);
});

test('사유 문구는 전수다 — 판정기의 사유 코드 중 화면이 모르는 것이 0 이다', () => {
  // 이 가드가 없으면 판정기에 사유가 늘어도 테스트는 전부 초록이다 — `node --test` 는
  // 타입을 지우고 돌리므로 표의 구멍을 `tsc` 만 보고, 그 사실을 2일차 머지가 실증했다.
  const lines = ko.reason;
  for (const code of REASON_CODES) {
    const line = lines[code];
    assert.ok(line !== undefined && line !== '', `사유 ${code} 의 화면 문구가 없다`);
    assert.ok(line.includes(code), `사유 ${code} 의 문구가 자기 코드를 적지 않는다`);
  }
  assert.equal(Object.keys(lines).length, REASON_CODES.length);
});

test('미판정 ≠ 위반 0 — 범위 문장이 보고서 본문에 상존한다', () => {
  const vm = buildReport(measurement, 'url', ko);
  assert.ok(vm.scopeLines.some((line) => line.includes('「위반 0」이 아니라 미판정')));
  assert.ok(vm.scopeLines.some((line) => line.includes('markdown-link')));
});

test('측정의 정직성 — dirty 모름과 dirty > 0 은 각자의 경고 줄을 받는다', () => {
  const dirtyUnknown = buildReport({ ...measurement, dirty: null }, 'url', ko);
  assert.match(dirtyUnknown.head.dirtyLine ?? '', /「모름」은 0 이 아니다/);
  const dirtyThree = buildReport({ ...measurement, dirty: 3 }, 'url', ko);
  assert.match(dirtyThree.head.dirtyLine ?? '', /3개/);
});

test('증거 상한 — 41건이면 40건만 싣고 넘침 줄이 전수성을 말한다', () => {
  const many: Measurement = structuredClone(measurement);
  many.judgment.checks[0]!.evidence = Array.from({ length: 41 }, (_, i) => ({ path: `p${i}`, presence: 'missing' }));
  const vm = buildReport(many, 'url', ko);
  const refs = vm.checks.find((c) => c.id === 'refs');
  assert.equal(refs?.evidence.length, 40);
  assert.match(refs?.omittedLine ?? '', /외 1건/);
});

/** 교차 축의 판정 결과 하나 — 사유를 단 갈라짐이 칸 하나를 「밖」으로 옮긴 모양. */
const DIVERGENCE_REASON = '우리 지면 값은 우리 것이다 — 이 값의 정본은 이 저장소다';

const divergedMeasurement = (): Measurement => {
  const m = structuredClone(measurement);
  m.judgment.checks = [
    {
      id: 'palette-cross',
      status: 'pass',
      reason: null,
      counts: {
        canon: 3,
        pinned: 2,
        matched: 2,
        mismatched: 0,
        unpinned: 0,
        unjudged: 0,
        diverged: 1,
        excluded: 0,
        evidenceOmitted: 0,
      },
      evidence: [
        {
          token: '--paper',
          file: 'tokens/tokens.css',
          line: 2,
          why: 'declared-divergence',
          reason: DIVERGENCE_REASON,
        },
      ],
    },
  ];
  return m;
};

test('AC4 — 선언된 갈라짐의 사유 문장이 보고 화면에 축자로 선다: 읽지 않는 사유를 만들지 않는다', () => {
  const vm = buildReport(divergedMeasurement(), 'url', ko);
  const cross = vm.checks.find((c) => c.id === 'palette-cross');
  assert.equal(cross?.evidence.length, 1);
  const line = cross!.evidence[0]!;
  // ⭐ 문장이 **그대로** 보인다 — 요약도 코드 치환도 없다. 화면 문구는 뷰모델의 몫이고
  // 렌더러는 이 줄을 textContent 로만 넣는다(`render.test.ts` 가 그 줄을 DOM 에서 집는다).
  assert.ok(line.includes(DIVERGENCE_REASON), '사유 문장이 화면 줄에 없다 — 읽지 않는 사유는 통과료다');
  assert.match(line, /--paper/); // 어느 칸의 사유인지
  assert.match(line, /tokens\/tokens\.css:2/); // 공유값이 사는 자리
  // ⚠️ 갈라짐은 수로도 남는다 — 「갈라짐 1건」이 「0건」과 같은 통과로 보이지 않는다.
  assert.match(cross?.countsLine ?? '', /diverged 1/);
});
