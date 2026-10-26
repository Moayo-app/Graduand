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
        dismiss_stale_reviews_on_push: DECL.dismiss_stale_reviews_on_push,
        dismissal_restriction: { ...DECL.dismissal_restriction },
        require_code_owner_review: DECL.require_code_owner_review,
        require_last_push_approval: DECL.require_last_push_approval,
        required_review_thread_resolution: DECL.required_review_thread_resolution,
        required_reviewers: [...DECL.required_reviewers],
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        required_status_checks: DECL.required_status_checks.map((context) => ({ context })),
        strict_required_status_checks_policy: DECL.strict_required_status_checks_policy,
        do_not_enforce_on_create: DECL.do_not_enforce_on_create,
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
  assert.ok(n.pass >= 19, `재는 축이 ${n.pass}개다 — 분모가 얇으면 위 초록이 아무것도 말하지 않는다`);
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
  //
  // ⭐ 지금은 실물의 칸이 전부 선언에 들려 있으므로, 심을 것은 **GitHub 이 나중에 더하는
  //    칸**이다 — 이 주사가 앞으로 지키는 자리가 정확히 그것이다(새 칸이 기본값으로 나타나는
  //    날, 그 값이 결정된 적 없음을 말해 준다).
  const live = bent((l) => (l.rules[0].parameters.require_sacrifice_to_the_gods = true));
  const hits = undeclared(live);
  // ⚠️ 미판정은 `reason` 에 까닭을 담는다(통과·위반은 `detail`) — 호스트가 `detail ?? reason` 으로 찍는다.
  assert.equal(hits.length, 1, hits.map((h) => h.reason).join(' · '));
  assert.ok(hits[0].reason.includes('require_sacrifice_to_the_gods'), hits[0].reason);
  assert.ok(hits[0].reason.includes('true'), '값까지 말한다 — 사람이 그것을 보고 결정한다');
  assert.deepEqual(violations(live), [], '⛔ 미선언은 위반이 아니다 — 선언이 그 칸을 들지 않았을 뿐이다');
});

test('미선언 칸은 규칙 종류마다 따로 센다 — 어느 규칙의 칸인지 말한다', () => {
  const live = bent((l) => {
    l.rules[0].parameters.future_pr_knob = false;
    l.rules[1].parameters.future_checks_knob = false;
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
  // 축을 더하면서 이 지도를 깜빡하면 그 칸이 **두 번** 불린다(제 축에서, 미선언으로 또).
  // 시끄럽지만 조용하지 않다 — 틀리는 방향이 안전한 쪽이라는 것을 여기서 잰다.
  const narrowed = COVERED.pull_request.filter((k) => k !== 'allowed_merge_methods');
  const uncovered = Object.keys(liveFromDecl().rules[0].parameters).filter((k) => !narrowed.includes(k));
  assert.ok(uncovered.includes('allowed_merge_methods'), '지도에서 빠진 칸은 미선언 주사에 걸린다');
  // 실제 지도는 그 칸을 들고 있으므로 지금은 한 번만 불린다.
  assert.ok(COVERED.pull_request.includes('allowed_merge_methods'));
  assert.deepEqual(undeclared(liveFromDecl()), []);
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
    'do_not_enforce_on_create',
    'dismiss_stale_reviews_on_push',
    'dismissal_restriction',
    'require_code_owner_review',
    'require_last_push_approval',
    'required_review_thread_resolution',
    'required_reviewers',
    'bypass_actors',
  ])
    assert.ok(field in DECL, `${DECL_PATH}: 「${field}」 이 없다 — 그 축의 분모가 비어 돈다`);
});

// ── 「승인 수 0」의 파생 다섯 + 생성 때 집행 ──────────────────────────────────

test('⭐ 선언이 「승인 수 0」의 파생 다섯을 **함께** 들고 있다 — 그날 하나만 켜지 않게', () => {
  // 지금은 다섯 다 무의미하다(승인이 0 이라 매달릴 승인이 없다). 적어 두는 값은 그래서
  // 「지금 옳다」가 아니라 **「승인을 켜는 날 함께 재어진다」**다.
  assert.equal(DECL.required_approving_review_count, 0, '파생들의 전제');
  assert.equal(DECL.dismiss_stale_reviews_on_push, false);
  assert.deepEqual(DECL.dismissal_restriction, { enabled: false, allowed_actors: [] });
  assert.equal(DECL.require_code_owner_review, false);
  assert.deepEqual(DECL.required_reviewers, []);
  assert.equal(DECL.required_review_thread_resolution, false);
});

test('⚠️ 마지막 push 승인은 **구조적 필연**으로 false 다 — 켜면 모든 PR 이 영구 차단된다', () => {
  // 협업자 1명인 저장소에서 「마지막으로 push 한 사람 아닌 누군가의 승인」은 충족될 수 없다.
  assert.equal(DECL.require_last_push_approval, false);
  assert.equal(axis(bent((l) => (l.rules[0].parameters.require_last_push_approval = true)), '마지막 push 승인').status, 'violation');
});

test('⚠️ 생성 때 체크 면제는 부정형이다 — false 가 엄한 쪽이고, true 가 빨강이다', () => {
  assert.equal(DECL.do_not_enforce_on_create, false, 'false = 생성 때도 집행한다');
  assert.equal(axis(bent((l) => (l.rules[1].parameters.do_not_enforce_on_create = true)), '생성 때 체크 면제').status, 'violation');
});

test('(negative): 파생 다섯이 저마다 움직여도 각자의 축이 빨갛다', () => {
  const cases = [
    ['push 때 승인 무효화', (l) => (l.rules[0].parameters.dismiss_stale_reviews_on_push = true)],
    ['코드 소유자 리뷰', (l) => (l.rules[0].parameters.require_code_owner_review = true)],
    ['리뷰 스레드 해결', (l) => (l.rules[0].parameters.required_review_thread_resolution = true)],
    ['지정 리뷰어', (l) => l.rules[0].parameters.required_reviewers.push({ id: 1, type: 'User' })],
  ];
  for (const [name, bend] of cases) assert.equal(axis(bent(bend), name).status, 'violation', name);
});

test('⚠️ 중첩 객체도 모양까지 비교한다 — String() 이면 무엇이든 같아 보인다', () => {
  // 「[object Object]」끼리의 비교는 **언제나 참**이다. 그 자리에 조용한 초록이 생기는 것을 막는다.
  const enabled = bent((l) => (l.rules[0].parameters.dismissal_restriction = { enabled: true, allowed_actors: [] }));
  assert.equal(axis(enabled, '승인 무효화 제한').status, 'violation');
  const actor = bent((l) => (l.rules[0].parameters.dismissal_restriction = { enabled: false, allowed_actors: [{ id: 1 }] }));
  assert.equal(axis(actor, '승인 무효화 제한').status, 'violation', '빈 주체 목록에 하나가 들어오면 빨강이다');
  // ⭐ 키 순서는 의미가 아니다 — 같은 모양이면 초록이어야 한다.
  const reordered = bent((l) => (l.rules[0].parameters.dismissal_restriction = { allowed_actors: [], enabled: false }));
  assert.equal(axis(reordered, '승인 무효화 제한').status, 'pass');
});

test('(negative): pull_request 규칙이 사라지면 그 규칙의 **축 아홉 전부**가 빨갛다', () => {
  // 하나만 울고 나머지가 조용하면 「나머지는 괜찮다」로 읽힌다.
  const noPr = bent((l) => (l.rules = l.rules.filter((r) => r.type !== 'pull_request')));
  const reds = judge(DECL, noPr).filter((r) => r.status === 'violation' && r.detail === 'pull_request 규칙이 실물에 없다');
  assert.equal(reds.length, 9, reds.map((r) => r.axis).join(' · '));
});

test('⭐⭐ 이제 미선언 칸이 0 이다 — 실물의 모든 칸이 선언에 들려 있다', () => {
  assert.deepEqual(undeclared(liveFromDecl()), []);
  for (const rule of liveFromDecl().rules)
    for (const key of Object.keys(rule.parameters))
      assert.ok(COVERED[rule.type].includes(key), `${rule.type}.${key} 가 COVERED 밖이다`);
});
