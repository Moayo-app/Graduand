/**
 * 보고서 뷰모델의 AC — 두 모드가 같은 컴포넌트로 그린다(AC2), 보고서 머리의 다섯 항목,
 * 3상태 수만 말한다, 증거는 축자, 미판정에는 사유가 붙는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReport, type CheckVM, type ReportVM } from './report.ts';

/** 두 절을 가로질러 한 체크를 찾는다 — 「어느 절인가」는 AC1 이 따로 묻는다. */
const allChecks = (vm: ReportVM): CheckVM[] => [...vm.measured.checks, ...(vm.unmeasured?.checks ?? [])];

import { ko } from './strings-ko.ts';
import { MIN_COPY_LINES, REASON_CODES, SCHEMA_VERSION, type Measurement } from '../../verifier/src/index.ts';

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
  assert.match(notice ?? '', /저장소 이름과 판정 결과가 들어 있습니다/);
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

test('수는 3상태로만 말한다 — 둘로 갈라도 셋이 각자 선다', () => {
  const vm = buildReport(measurement, 'url', ko);
  // ⭐⭐ 「재어진 것」이 생겼다고 셋이 둘로 접히지 않는다 — 위반·통과·미판정이 **각자**
  //    수를 들고 있어야 한다. 그 넷(관할 포함)이 다 보이는지를 수로 묻는다.
  assert.equal(vm.totalsLine, '관할 2 — 재어진 1(위반 1 · 통과 0) · 재지 않은 1');
  assert.ok(!JSON.stringify(vm).includes('%'));
});

test('증거는 축자다 — refs 증거 한 건이 파일:줄·표기·원문·사유·시도 경로를 그대로 든다', () => {
  const vm = buildReport(measurement, 'url', ko);
  const refs = allChecks(vm).find((c) => c.id === 'refs');
  assert.deepEqual(refs?.evidence, ['README.md:2 [markdown-link] docs/missing.md — missing (docs/missing.md)']);
  assert.equal(refs?.omittedLine, null);
  assert.match(refs?.countsLine ?? '', /unresolved 1/);
  assert.ok(!(refs?.countsLine ?? '').includes('evidenceOmitted'));
});

test('미판정에는 사유가 붙는다 — 사유 줄 없는 미판정 뷰모델은 없다', () => {
  const vm = buildReport(measurement, 'url', ko);
  const uiPaths = allChecks(vm).find((c) => c.id === 'ui-paths');
  assert.equal(uiPaths?.status, 'unjudged');
  assert.match(uiPaths?.reasonLine ?? '', /no-declaration/);
  assert.match(uiPaths?.reasonLine ?? '', /위반도 통과도 아닙니다/);
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
  assert.match(dirtyUnknown.head.dirtyLine ?? '', /「모름」은 0 이 아닙니다/);
  const dirtyThree = buildReport({ ...measurement, dirty: 3 }, 'url', ko);
  assert.match(dirtyThree.head.dirtyLine ?? '', /3개/);
});

test('증거 상한 — 41건이면 40건만 싣고 넘침 줄이 전수성을 말한다', () => {
  const many: Measurement = structuredClone(measurement);
  many.judgment.checks[0]!.evidence = Array.from({ length: 41 }, (_, i) => ({ path: `p${i}`, presence: 'missing' }));
  const vm = buildReport(many, 'url', ko);
  const refs = allChecks(vm).find((c) => c.id === 'refs');
  assert.equal(refs?.evidence.length, 40);
  assert.match(refs?.omittedLine ?? '', /외 1건/);
});

/** 교차 축의 판정 결과 하나 — 사유를 단 갈라짐이 칸 하나를 「밖」으로 옮긴 모양. */
const DIVERGENCE_REASON = '우리 지면 값은 우리 것이다 — 이 값의 정본은 이 저장소다';

const divergedMeasurement = (): Measurement => {
  const m = structuredClone(measurement);
  m.judgment.checks = [
    {
      id: 'shared-values-cross:design',
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
  const cross = allChecks(vm).find((c) => c.id === 'shared-values-cross:design');
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

/* ──────────────── 두 절 · 접기 — 뷰모델 층의 AC ──────────────── */

/** 미판정 하나가 섞인 봉투(위 `measurement`)와, 전부 재어진 봉투를 따로 쓴다. */
const allMeasured = (): Measurement => {
  const m = structuredClone(measurement);
  m.judgment.checks = m.judgment.checks.filter((c) => c.status !== 'unjudged');
  return m;
};

test('AC1 — 두 절이 뷰모델에서 갈린다: 재어진 것과 재지 않은 것이 다른 목록이다', () => {
  const vm = buildReport(measurement, 'url', ko);
  assert.ok(vm.unmeasured !== null, '미판정이 있는데 절이 없다');
  assert.ok(vm.measured.checks.length > 0 && vm.unmeasured.checks.length > 0, '한쪽이 비면 가름이 아무것도 뜻하지 않는다');

  // ⭐ 가름의 **정의**를 묻는다 — 상태로 갈렸는가. 어느 id 가 어디인지는 적지 않는다.
  for (const check of vm.measured.checks) assert.notEqual(check.status, 'unjudged', `${check.id}: 미판정이 재어진 절에 있다`);
  for (const check of vm.unmeasured.checks) assert.equal(check.status, 'unjudged', `${check.id}: 재어진 칸이 미판정 절에 있다`);

  // ⛔ 어느 칸도 두 절에 동시에 있거나 빠지지 않는다.
  assert.equal(vm.measured.checks.length + vm.unmeasured.checks.length, measurement.judgment.checks.length);

  // 절의 머리는 **카탈로그에서** 온다 — 렌더러도 테스트도 문구를 짓지 않는다.
  assert.equal(vm.measured.heading, ko.report.measuredHeading);
  assert.equal(vm.unmeasured.heading, ko.report.unmeasuredHeading);
});

test('AC3 (negative) — 미판정 0 이면 빈 절을 세우지 않는다: 합계 줄은 그래도 0 을 말한다', () => {
  const vm = buildReport(allMeasured(), 'url', ko);
  assert.equal(vm.unmeasured, null, '재지 않은 것이 0 인데 절이 섰다');
  assert.ok(vm.measured.checks.length > 0);

  // ⭐ 절은 없어도 **수는 침묵하지 않는다** — 「미판정이 없다」도 사실이라 적힌다.
  assert.match(vm.totalsLine, /재지 않은 0/, vm.totalsLine);
});

test('AC6 — 접은 것과 자른 것을 뭉치지 않는다: 보인 수와 자른 수가 따로 선다', () => {
  const many = structuredClone(measurement);
  many.judgment.checks = many.judgment.checks.filter((c) => c.id === 'refs');
  many.judgment.checks[0]!.evidence = Array.from({ length: 52 }, (_, i) => ({ path: `p${i}`, presence: 'missing' }));
  const refs = buildReport(many, 'url', ko).measured.checks[0]!;

  assert.equal(refs.evidence.length, 40, '상한이 움직였다');
  assert.ok(refs.evidenceSummary !== null && refs.omittedLine !== null, '둘 중 하나가 침묵한다');

  // ⭐⭐ **두 수가 한 줄에 뭉쳐 있지 않다** — 요약은 보인 수만, 넘침 줄은 자른 수만 든다.
  assert.match(refs.evidenceSummary, /40/);
  assert.ok(!refs.evidenceSummary.includes('12'), `요약이 자른 수까지 말한다 — ${refs.evidenceSummary}`);
  assert.match(refs.omittedLine, /12/);
  assert.ok(!refs.omittedLine.includes('40'), `넘침 줄이 보인 수까지 말한다 — ${refs.omittedLine}`);
});

test('AC6 (negative) — 증거가 0 건이면 접을 것이 없다: 요약 줄도 없다', () => {
  const none = structuredClone(measurement);
  none.judgment.checks = none.judgment.checks.filter((c) => c.id === 'refs');
  none.judgment.checks[0]!.evidence = [];
  const refs = buildReport(none, 'url', ko).measured.checks[0]!;
  assert.equal(refs.evidenceSummary, null, '빈 접기가 섰다 — 펼치면 아무것도 없는 자리다');
});

// ── 선언 0 에서 보이는 사실 — ⛔ 판정이 아니다 ─────────────────────────────

/** 사본과 표면이 **둘 다** 든 사실 — 빈 사실만 돌리면 이 절에 대해 아무 말도 하지 않는다. */
const withUndeclared = (): Measurement => {
  const copy = structuredClone(measurement);
  copy.undeclared = {
    copies: [
      { head: '## one home per fact', lines: 4, files: ['README.md', 'docs/guide.md', 'docs/ko/guide.md'] },
    ],
    copiesOmitted: 3,
    blocks: 53,
    diverged: [
      { head: 'the same sentence, two versions', files: ['README.md', 'docs/guide.md'], shared: 6, differing: 2 },
    ],
    divergedOmitted: 4,
    divergedPairs: 54,
    divergedTruncated: true,
    documents: { tracked: 9, read: 5 },
    surfaces: [
      { adapter: 'css-custom-properties', files: 6, loaded: 1 },
      { adapter: 'other', files: 0, loaded: 0 },
    ],
  };
  return copy;
};

test('선언 0 의 절은 **절이 없어지지 않는다** — 「사본 0」도 사실이다', () => {
  const vm = buildReport(measurement, 'url', ko);
  // 빈 절을 세우지 않는 규율의 **반대쪽** 자리다 — 분모와 수가 둘 다 있는 절이다.
  assert.equal(vm.undeclared.copies.length, 0);
  assert.match(vm.undeclared.copiesLine, /사본 0/, vm.undeclared.copiesLine);
  // 하한의 수는 판정기 모듈의 상수에서 온다 — 화면이 자기 수를 적지 않는다.
  assert.match(vm.undeclared.copiesLine, new RegExp(`${MIN_COPY_LINES}줄`), vm.undeclared.copiesLine);
});

test('분모가 먼저 선다 — 부분 수집이 「사본 0」으로 접히지 않는다', () => {
  const partial = buildReport(withUndeclared(), 'url', ko).undeclared;
  assert.match(partial.documentsLine, /9/);
  assert.match(partial.documentsLine, /5/);

  const whole = buildReport(measurement, 'url', ko).undeclared;
  // 전부 읽은 측정과 부분 수집은 **다른 문장**이다 — 같으면 둘이 같아 보인다.
  assert.notEqual(whole.documentsLine, partial.documentsLine);
});

test('사본은 집 전부와 손잡이를 들고, 잘린 수는 따로 선다 — 전수는 그대로다', () => {
  const vm = buildReport(withUndeclared(), 'url', ko).undeclared;
  assert.equal(vm.copies.length, 1);
  assert.deepEqual(vm.copies[0]!.files, ['README.md', 'docs/guide.md', 'docs/ko/guide.md']);
  assert.match(vm.copies[0]!.homesLine, /3/);
  // ⭐ 전수(53)와 잘린 수(3)가 **다른 줄**이다 — 한 줄에 뭉치면 「펼치면 다 보인다」로 읽힌다.
  assert.match(vm.copiesLine, /53/);
  assert.ok(vm.omittedLine !== null && vm.omittedLine.includes('3'), String(vm.omittedLine));
  assert.ok(!vm.omittedLine.includes('53'), vm.omittedLine);
});

test('선언할 수 있는 표면 — 꼴이 0 건인 어댑터도 줄을 갖고, 읽지 않은 본문은 「토큰 0」이 아니다', () => {
  const vm = buildReport(withUndeclared(), 'url', ko).undeclared;
  assert.equal(vm.surfaceLines.length, 2, '어댑터 줄이 저장소에 따라 사라졌다');
  assert.ok(vm.surfaceLines.some((line) => line.includes('other')), vm.surfaceLines.join(' | '));
  const partial = vm.surfaceLines.find((line) => line.includes('css-custom-properties'))!;
  assert.match(partial, /6/);
  assert.match(partial, /1/);
});

test('⛔ 이 절에는 상태가 없다 — 글리프를 붙일 자리가 뷰모델에 없다', () => {
  const vm = buildReport(withUndeclared(), 'url', ko).undeclared;
  const serialized = JSON.stringify(vm);
  for (const forbidden of ['"status"', 'statusLabel', 'violation', 'unjudged']) {
    assert.ok(!serialized.includes(forbidden), `선언 0 의 절에 ${forbidden} 이 있다`);
  }
  // 머리말이 그 사실을 **적는다** — 적지 않은 수는 언제든 판정으로 읽힌다.
  assert.ok(vm.noticeLines.some((line) => line.includes('판정이 아닙니다')), vm.noticeLines.join(' | '));
  assert.ok(vm.whyLines.some((line) => line.includes('위반이 아닙니다')), vm.whyLines.join(' | '));
});

test('갈라진 사본은 축자 사본과 **다른 줄**로 선다 — 두 사실을 한 수로 접지 않는다', () => {
  const vm = buildReport(withUndeclared(), 'url', ko).undeclared;
  assert.notEqual(vm.copiesLine, vm.divergedLine, '두 사실이 같은 문장을 쓴다');
  assert.match(vm.divergedLine, /54/);
  assert.equal(vm.diverged.length, 1);
  // ⛔ 비율이 아니라 **수**다 — 집 · 쌍 · 겹친 줄 · 갈라진 줄.
  assert.match(vm.diverged[0]!.countsLine, /6/);
  assert.match(vm.diverged[0]!.countsLine, /2/);
  assert.ok(!/%/.test(vm.diverged[0]!.countsLine), vm.diverged[0]!.countsLine);
  assert.deepEqual(vm.diverged[0]!.files, ['README.md', 'docs/guide.md']);
});

test('⚠️ 「다 보지 못했다」는 잘린 수와 **다른 줄**이다 — 센 뒤와 세지 못한 것', () => {
  const vm = buildReport(withUndeclared(), 'url', ko).undeclared;
  assert.ok(vm.divergedOmittedLine !== null && vm.divergedOmittedLine.includes('4'), String(vm.divergedOmittedLine));
  assert.ok(vm.divergedTruncatedLine !== null, '다 보지 못한 사실이 침묵한다');
  assert.notEqual(vm.divergedOmittedLine, vm.divergedTruncatedLine);

  // 다 본 측정에서는 그 줄이 **없다** — 없는 사실을 적지 않는다.
  const whole = structuredClone(withUndeclared());
  whole.undeclared.divergedTruncated = false;
  assert.equal(buildReport(whole, 'url', ko).undeclared.divergedTruncatedLine, null);
});

test('갈라짐 0 도 **말해진다** — 침묵하면 「보지 않았다」와 같아 보인다', () => {
  const vm = buildReport(measurement, 'url', ko).undeclared;
  assert.equal(vm.diverged.length, 0);
  assert.match(vm.divergedLine, /갈라진 사본 0/, vm.divergedLine);
});

test('같은 손잡이의 쌍은 **가족 하나**로 접힌다 — 집이 N 이면 쌍이 C(N,2) 다', () => {
  const homes = ['a.md', 'b.md', 'c.md', 'd.md'];
  const pairs: Measurement['undeclared']['diverged'] = [];
  for (let i = 0; i < homes.length; i += 1) {
    for (let j = i + 1; j < homes.length; j += 1) {
      pairs.push({ head: '한 사실의 두 판', files: [homes[i]!, homes[j]!], shared: 4, differing: 2 });
    }
  }
  const facts = structuredClone(withUndeclared());
  facts.undeclared.diverged = pairs;
  facts.undeclared.divergedPairs = pairs.length;
  const vm = buildReport(facts, 'url', ko).undeclared;

  assert.equal(vm.diverged.length, 1, `쌍 ${pairs.length} 건이 가족 하나로 접히지 않았다`);
  // 집은 합집합이고, 쌍의 수는 남는다 — 접었다고 수를 잃지 않는다.
  assert.deepEqual(vm.diverged[0]!.files, homes);
  assert.match(vm.diverged[0]!.countsLine, new RegExp(String(pairs.length)));
  // ⭕ 전체 수를 말하는 줄은 여전히 **쌍**을 센다 — 접는 것은 그리는 자리의 일이다.
  assert.match(vm.divergedLine, new RegExp(String(pairs.length)));
});

test('쌍마다 수가 다르면 **범위**로 남고, 같으면 한 수다', () => {
  const facts = structuredClone(withUndeclared());
  facts.undeclared.diverged = [
    { head: '한 사실의 두 판', files: ['a.md', 'b.md'], shared: 4, differing: 2 },
    { head: '한 사실의 두 판', files: ['a.md', 'c.md'], shared: 7, differing: 2 },
  ];
  const vm = buildReport(facts, 'url', ko).undeclared;
  // 겹친 줄은 갈렸고(4–7) 갈라진 줄은 같다(2) — 없는 폭을 적지 않는다.
  assert.match(vm.diverged[0]!.countsLine, /4–7/, vm.diverged[0]!.countsLine);
  assert.ok(!vm.diverged[0]!.countsLine.includes('2–2'), vm.diverged[0]!.countsLine);
});
