// 보호 설정 드리프트 — 양성 + negative.
//
// ⭐⭐ 작업장 쪽은 같은 판정을 `--self-test` 플래그로 들고 있다. 여기서는 **진짜 테스트**로
//    든다: 이 저장소의 `tools/test/*.test.mjs` 는 `정책 가드`(필수 체크)로 **이미 돌므로**,
//    판정의 negative 가 공짜로 required 안에 들어온다. ⇒ 갈라짐을 받는 대신(그 사유는
//    tools/lib/ruleset-drift.mjs 머리에 있다) **검증은 더 세게** 한다.
//
// ⚠️ 실물을 **지어서** 잰다 — 이 테스트는 네트워크를 쓰지 않는다. 살아 있는 룰셋과의 대조는
//    워크플로가 `gh` 로 묻고 tools/ruleset-drift.mjs 가 받는다. 판정이 순수하기에 둘이 같은
//    함수를 쓴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { DECL_PATH, loadDecl, judge, tally, COVERED, UNDECLARED_AXIS } from '../lib/ruleset-drift.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DECL = loadDecl(ROOT);

/** 선언과 **정확히 맞는** 실물을 선언에서 짓는다 — 분모를 테스트에 적지 않는다. */
const liveFromDecl = () => ({
  name: DECL.name,
  target: DECL.target,
  enforcement: DECL.enforcement,
  conditions: { ref_name: { include: [...DECL.conditions.include], exclude: [...DECL.conditions.exclude] } },
  bypass_actors: [],
  rules: [
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: DECL.required_approving_review_count,
        require_extra_approval_for_unattributed_changes: DECL.require_extra_approval_for_unattributed_changes,
        allowed_merge_methods: [...DECL.allowed_merge_methods],
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        required_status_checks: DECL.required_status_checks.map((context) => ({ context })),
        strict_required_status_checks_policy: DECL.strict_required_status_checks_policy,
      },
    },
  ],
});

const violations = (live) => judge(DECL, live).filter((r) => r.status === 'violation');
const axis = (live, name) => judge(DECL, live).find((r) => r.axis === name);
/** 갈라짐을 심는다 — 사본에 심어야 다음 테스트가 깨끗한 분모를 받는다. */
const bent = (fn) => {
  const live = liveFromDecl();
  fn(live);
  return live;
};

// ── 양성 ──────────────────────────────────────────────────────────────────────

test('선언과 같은 실물은 위반 0 이다', () => {
  assert.deepEqual(violations(liveFromDecl()), []);
});

test('⭐ 축이 비어 있지 않다 — 초록이 「안 읽었다」가 아님을 따로 잰다', () => {
  const n = tally(judge(DECL, liveFromDecl()));
  assert.ok(n.pass >= 10, `재는 축이 ${n.pass}개다 — 분모가 얇으면 위 초록이 아무것도 말하지 않는다`);
  assert.equal(n.unjudged, 0, '실물이 bypass_actors 를 들고 오면 그 축은 판정된다');
});

test('선언이 이 저장소의 결정을 **적고 있다** — 가드는 선언을 분모로 쓴다', () => {
  assert.equal(DECL.required_approving_review_count, 0, '승인 강제가 아니라 직접 push 금지가 목적이다');
  assert.deepEqual(DECL.bypass_actors, [], '⚠️ 「우회로 없음」이 이 선언의 핵이다');
  assert.equal(DECL.strict_required_status_checks_policy, false, '최신 상태 요구는 끈다');
  // ⭐ 이 칸은 **결정이 된 뒤에** 선언이 들었다 — 코파일럿 쓰는 계정의 기본값으로 켜져
  //    있었고, 실물을 베껴 적었다면 우연을 결정으로 굳혔을 자리다.
  assert.equal(DECL.require_extra_approval_for_unattributed_changes, false, 'Henry 가 끄기로 정했다');
  assert.ok(DECL.required_status_checks.includes('타입 검사 + 테스트 + 빌드'), '받은 두 패키지도 required 다');
  assert.equal(new Set(DECL.required_status_checks).size, DECL.required_status_checks.length, '중복 0');
});

// ── negative — 심은 갈라짐마다 빨간불이 켜지는가 ───────────────────────────────

test('(negative): 이름 · 표적 · 집행 수준이 어긋나면 빨강', () => {
  assert.equal(axis(bent((l) => (l.name = 'other')), 'name').status, 'violation');
  assert.equal(axis(bent((l) => (l.target = 'tag')), 'target').status, 'violation');
  // ⚠️ evaluate 는 「재기만 하고 막지 않는다」 — 보호가 조용히 내려가는 모양이다.
  assert.equal(axis(bent((l) => (l.enforcement = 'evaluate')), 'enforcement').status, 'violation');
});

test('(negative): 조건이 넓어지면 빨강 — 보호가 다른 ref 로 번지는 것도 갈라짐이다', () => {
  assert.equal(axis(bent((l) => l.conditions.ref_name.include.push('refs/heads/*')), 'conditions.include').status, 'violation');
  assert.equal(axis(bent((l) => l.conditions.ref_name.exclude.push('refs/heads/tmp')), 'conditions.exclude').status, 'violation');
});

test('(negative): 규칙 하나가 사라지면 그 규칙의 축들이 빨갛다 — 침묵하지 않는다', () => {
  const noPr = bent((l) => (l.rules = l.rules.filter((r) => r.type !== 'pull_request')));
  assert.equal(axis(noPr, 'rule_types').status, 'violation');
  assert.equal(axis(noPr, '승인 수').status, 'violation');
  assert.equal(axis(noPr, '머지 방식').status, 'violation', '규칙이 없으면 그 칸도 「통과」가 아니다');

  const noRsc = bent((l) => (l.rules = l.rules.filter((r) => r.type !== 'required_status_checks')));
  assert.equal(axis(noRsc, '필수 체크').status, 'violation');
  assert.equal(axis(noRsc, '최신 상태 요구').status, 'violation');
});

test('(negative): 승인 수가 올라가도 빨강 — 「더 엄해졌다」도 선언과의 갈라짐이다', () => {
  assert.equal(axis(bent((l) => (l.rules[0].parameters.required_approving_review_count = 1)), '승인 수').status, 'violation');
});

test('(negative): 필수 체크의 이름이 바뀌거나 하나 빠지면 빨강', () => {
  const renamed = bent((l) => (l.rules[1].parameters.required_status_checks[0].context = '이름 바뀜'));
  const r = axis(renamed, '필수 체크');
  assert.equal(r.status, 'violation');
  assert.ok(r.detail.includes('영구 pending'), '고칠 때의 함정을 문면이 말한다');
  assert.equal(axis(bent((l) => l.rules[1].parameters.required_status_checks.pop()), '필수 체크').status, 'violation');
});

test('(negative): 머지 방식이 줄거나 늘면 빨강 — main 의 역사 모양이 조용히 바뀐다', () => {
  assert.equal(axis(bent((l) => (l.rules[0].parameters.allowed_merge_methods = ['merge'])), '머지 방식').status, 'violation');
});

test('(negative): 최신 상태 요구가 켜지면 빨강 — 끈 것이 이 세션의 결정이다', () => {
  assert.equal(
    axis(bent((l) => (l.rules[1].parameters.strict_required_status_checks_policy = true)), '최신 상태 요구').status,
    'violation',
  );
});

test('(negative): ⚠️ 우회 주체가 하나 생기면 빨강 — 「우회로 없음」이 무너지는 자리', () => {
  const r = axis(bent((l) => (l.bypass_actors = [{ actor_type: 'Integration', actor_id: 1 }])), '우회 주체');
  assert.equal(r.status, 'violation');
  assert.ok(r.detail.includes('Integration'), '누가 들어왔는지 말한다');
});

test('⭐⭐ bypass_actors 가 **오지 않으면 미판정이다** — 통과가 아니다', () => {
  // 이 가드의 핵이다. 읽기 권한으로는 이 칸이 응답에 오지 않으므로, 없는 칸을 「우회로 0」으로
  // 읽으면 **부재를 공백으로** 그리는 것이 된다 — 이 제품이 금칙으로 삼는 바로 그 모양이다.
  const live = bent((l) => delete l.bypass_actors);
  const r = axis(live, '우회 주체');
  assert.equal(r.status, 'unjudged');
  assert.ok(r.reason.includes('보지 못한 것'));
  assert.deepEqual(violations(live), [], '⛔ 미판정은 위반으로 세지 않는다 — 빨강의 근거는 위반이다');
  assert.equal(tally(judge(DECL, live)).unjudged, 1, '그러나 요약이 그 수를 말한다');
});

test('⛔ 판정에 적용 경로가 없다 — 쓰기 호출도 fetch 도 한 줄 없다', async () => {
  const fs = await import('node:fs');
  for (const rel of ['tools/lib/ruleset-drift.mjs', 'tools/ruleset-drift.mjs']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const banned of ['fetch(', "'PUT'", "'POST'", "'PATCH'", 'node:https', 'child_process']) {
      // ⚠️ 산문의 언급은 센다 — 주석에서 금칙을 설명하는 줄과 호출을 가르지 않는다. 대신
      //    금칙을 **호출 모양**으로 적어, 설명 산문이 그 모양을 쓰지 않게 한다.
      assert.ok(!src.includes(banned), `${rel}: 「${banned}」 가 있다 — 고치는 길이 열렸다`);
    }
  }
  assert.ok(!fs.readFileSync(path.join(ROOT, DECL_PATH), 'utf8').includes('token'), '선언에 자격이 섞이지 않는다');
});

// ── 미선언 칸 — 손으로 고른 축 목록의 구멍을 보이게 한다 ───────────────────────

const undeclared = (live) => judge(DECL, live).filter((r) => r.axis === UNDECLARED_AXIS);

test('⭐⭐ 선언이 들지 않는 칸은 **미판정으로 불린다** — 조용하지 않다', () => {
  // ⚠️ 이 축이 없던 동안 실제로 일어난 일: 보호 설정이 바뀌었는데 가드가 「위반 0 · 통과 11
  //    · 미판정 0」, 완벽한 초록을 냈다. 손으로 고른 축 목록은 구멍을 보이게 하지 못한다.
  const live = bent((l) => (l.rules[0].parameters.require_code_owner_review = true));
  const hits = undeclared(live);
  // ⚠️ 미판정은 `reason` 에 까닭을 담는다(통과·위반은 `detail`) — 호스트가 `detail ?? reason` 으로 찍는다.
  assert.equal(hits.length, 1, hits.map((h) => h.reason).join(' · '));
  assert.ok(hits[0].reason.includes('require_code_owner_review'), hits[0].reason);
  assert.ok(hits[0].reason.includes('true'), '값까지 말한다 — 사람이 그것을 보고 결정한다');
  assert.deepEqual(violations(live), [], '⛔ 미선언은 위반이 아니다 — 선언이 그 칸을 들지 않았을 뿐이다');
});

test('미선언 칸은 규칙 종류마다 따로 센다 — 어느 규칙의 칸인지 말한다', () => {
  const live = bent((l) => {
    l.rules[0].parameters.require_last_push_approval = false;
    l.rules[1].parameters.do_not_enforce_on_create = false;
  });
  const reasons = undeclared(live).map((r) => r.reason);
  assert.equal(reasons.length, 2, reasons.join(' · '));
  assert.ok(reasons.some((d) => d.startsWith('pull_request.')));
  assert.ok(reasons.some((d) => d.startsWith('required_status_checks.')));
});

test('재는 칸은 미선언으로 두 번 불리지 않는다 — COVERED 지도가 분모다', () => {
  assert.deepEqual(undeclared(liveFromDecl()), [], '선언에서 지은 실물에는 미선언 칸이 0 이다');
  for (const [type, keys] of Object.entries(COVERED)) {
    const rule = liveFromDecl().rules.find((r) => r.type === type);
    assert.ok(rule, `${type} 규칙이 실물 짓기에 있다`);
    for (const key of keys)
      assert.ok(key in rule.parameters, `${type}.${key} — COVERED 가 부르는 칸이 실물 짓기에 없다`);
  }
});

test('⚠️ COVERED 가 뒤처지면 **시끄러운 쪽으로** 틀린다 — 구멍을 숨기는 쪽이 아니다', () => {
  // 지도에서 한 칸을 빼면 그 칸은 제 축에서 한 번, 미선언으로 또 한 번 불린다.
  // 시끄럽지만 조용하지 않다 — 틀리는 방향이 안전한 쪽이라는 것을 여기서 잰다.
  const narrowed = { ...COVERED, pull_request: COVERED.pull_request.filter((k) => k !== 'allowed_merge_methods') };
  const live = liveFromDecl();
  const keys = Object.keys(live.rules[0].parameters).filter((k) => !narrowed.pull_request.includes(k));
  assert.ok(keys.includes('allowed_merge_methods'), '빠진 칸이 미선언 주사에 걸리는 모양이다');
  // 실제 지도는 그 칸을 들고 있으므로 지금은 조용하다.
  assert.ok(COVERED.pull_request.includes('allowed_merge_methods'));
});

test('선언이 **축이 요구하는 칸을 전부** 들고 있다 — 분모가 반쯤 비지 않는다', () => {
  for (const field of [
    'name',
    'target',
    'enforcement',
    'conditions',
    'rule_types',
    'required_approving_review_count',
    'require_extra_approval_for_unattributed_changes',
    'allowed_merge_methods',
    'required_status_checks',
    'strict_required_status_checks_policy',
    'bypass_actors',
  ])
    assert.ok(field in DECL, `${DECL_PATH}: 「${field}」 이 없다 — 그 축의 분모가 비어 돈다`);
});
