// 보호 설정 드리프트의 공유 모듈 — 커밋된 선언(config/ruleset.json)과 실물을 대조한다.
//
// ⭐⭐ **순수 판정이다 — 네트워크도 자격도 없다.** 실물은 **받는다**(묻는 손은 tools/ruleset-drift.mjs
//    또는 사람의 `gh`). 선례가 이 저장소가 받는 제품 코드에 있다: verifier/src/judge.ts 가
//    자격과 시야를 **인자로** 받고 읽는 손은 hosts/ 다. 그래서 이 가드는 **자격 0** 으로 돌고,
//    같은 함수가 사람의 터미널과 CI 에서 같은 수를 낸다.
//
// ⛔ **적용 경로가 없다.** 쓰기 호출(PUT·POST·PATCH)도 fetch 도 한 줄 없다. 고치려면
//    `Administration: write` 가 필요한데, 그 권한을 CI 에 주는 것은 선언의 `bypass_actors: []`
//    (「우회로 없음」)가 배제한 **바로 그 주체**를 만드는 일이다 — 판정은 하고 고치지 않는다.
//
// ⭐ **3상태로 낸다 — 위반 · 통과 · 미판정.** 미판정이 오는 자리가 **둘** 있다:
//
//   ⑴ `bypass_actors` 는 읽기 권한으로 **오지 않는다**. 없는 칸을 「우회로 0」으로 읽으면
//      **부재를 공백으로** 그리는 것이고, 이 제품이 금칙으로 삼는 그 모양이다.
//   ⑵ ⭐⭐ **선언이 들지 않는 칸** — 실물에 있는데 어느 축도 재지 않는 파라미터다. 전에는
//      그런 칸이 **조용했고**, 그래서 보호 설정이 실제로 바뀌어도 가드가 **완벽한 초록**을
//      냈다(실측: `require_extra_approval_for_unattributed_changes` 가 바뀐 날 「위반 0 ·
//      통과 11 · 미판정 0」). ⇒ 축 목록을 손으로 고르면 **구멍이 보이지 않는다.**
//
// ⚠️ 그 구멍을 「실물을 그대로 베껴 선언」으로 막지 않는다. 바로 그 칸이 **코파일럿 쓰는
//    계정의 기본값**으로 켜져 있었고, 베꼈다면 **우연을 결정으로 굳혔을** 것이다. ⇒ 적지
//    않은 칸은 ⬜ 로 **남아 보이고**, 사람이 하나씩 결정해 선언으로 옮긴다.
//
// ⚠️⚠️ **이 파일은 선언된 갈라짐이다** — 비공개 작업장이 같은 판정을 따로 든다([ISSUE-38]).
//    공유가 옳지만(선례: 배달이 받는 쪽 public-scope.mjs 를 체크아웃에서 불러 쓴다) 그 길은
//    한쪽이 다른 쪽 체크아웃을 가져야 하고, 그러려면 App 토큰이 든다 — 이 가드의 **자격 0**
//    을 잃는 값이다. ⭐ **그 사유는 공개 전환 뒤에 사라진다**: 이 저장소가 누구나 읽을 수
//    있게 되면 형제의 `GITHUB_TOKEN` 이 자격 0 으로 이 체크아웃을 가질 수 있고, 그때 판정을
//    **여기 하나로** 합친다. 그래서 **축 이름을 양쪽이 같게 둔다** — 합치기가 기계적이도록.
import fs from 'node:fs';
import path from 'node:path';

export const DECL_PATH = 'config/ruleset.json';

export const loadDecl = (root) => JSON.parse(fs.readFileSync(path.join(root, DECL_PATH), 'utf8'));

/**
 * 축마다 **실물의 어느 칸을 재는가** — 이 지도가 「미선언 칸」 주사의 분모다.
 *
 * ⚠️⚠️ **축을 더하면 여기도 더한다.** 안 더하면 그 칸이 두 번 불린다(제 축에서 한 번,
 * 미선언으로 또 한 번) — 시끄럽지만 **조용한 쪽으로는 틀리지 않는다**: 이 지도가 뒤처지는
 * 방향의 결과는 「없는 구멍을 있다고 말한다」이고, 그 반대(있는 구멍을 숨긴다)가 아니다.
 */
export const UNDECLARED_AXIS = '미선언 칸';

export const COVERED = {
  pull_request: [
    'required_approving_review_count',
    'allowed_merge_methods',
    'require_extra_approval_for_unattributed_changes',
    'dismiss_stale_reviews_on_push',
    'dismissal_restriction',
    'require_code_owner_review',
    'require_last_push_approval',
    'required_review_thread_resolution',
    'required_reviewers',
  ],
  required_status_checks: [
    'required_status_checks',
    'strict_required_status_checks_policy',
    'do_not_enforce_on_create',
  ],
};

const sorted = (xs) => [...(xs ?? [])].sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const ruleOf = (live, type) => (live.rules ?? []).find((r) => r.type === type);

/**
 * 선언과 실물을 대조한다 — 축마다 한 칸.
 *
 * ⚠️ 축을 쪼개 두는 이유: 「어긋났다」 한 줄로 뭉치면 **무엇이** 어긋났는지 말하지 못하고,
 * 고치는 사람이 설정 화면에서 찾아야 한다. 칸이 곧 **고칠 자리**다.
 */
export function judge(decl, live) {
  const out = [];
  const pass = (axis, detail) => out.push({ axis, status: 'pass', detail });
  const fail = (axis, detail) => out.push({ axis, status: 'violation', detail });
  const unjudged = (axis, reason) => out.push({ axis, status: 'unjudged', reason });
  const eq = (axis, want, got) =>
    String(want) === String(got) ? pass(axis, `${got}`) : fail(axis, `선언 「${want}」 · 실물 「${got}」`);
  // ⚠️ 중첩 객체는 String() 이 「[object Object]」가 되어 **무엇이든 같아 보인다** — 그 자리에
  //    조용한 초록이 생기므로 모양까지 비교한다. 키 순서는 의미가 아니니 정렬해 센다.
  const deep = (axis, want, got) => {
    const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o ?? {}).sort()));
    return norm(want) === norm(got) ? pass(axis, norm(got)) : fail(axis, `선언 「${norm(want)}」 · 실물 「${norm(got)}」`);
  };
  const set = (axis, want, got, shown) =>
    same(want, got) ? pass(axis, shown ?? (got.length === 0 ? '(비어 있다)' : got.join(' · '))) : fail(axis, `선언 「${sorted(want).join(' · ')}」 · 실물 「${sorted(got).join(' · ')}」`);

  eq('name', decl.name, live.name);
  eq('target', decl.target, live.target);
  eq('enforcement', decl.enforcement, live.enforcement);

  set('conditions.include', decl.conditions.include, live.conditions?.ref_name?.include ?? []);
  set('conditions.exclude', decl.conditions.exclude, live.conditions?.ref_name?.exclude ?? []);
  set('rule_types', decl.rule_types, (live.rules ?? []).map((r) => r.type));

  const pr = ruleOf(live, 'pull_request');
  if (!pr) {
    // ⚠️ 규칙이 없으면 그 규칙의 **축 전부**가 빨갛다 — 하나만 울고 나머지가 조용하면
    //    「나머지는 괜찮다」로 읽힌다.
    for (const axis of ['승인 수', '미귀속 변경 추가 승인', '머지 방식', '마지막 push 승인', '지정 리뷰어', '코드 소유자 리뷰', 'push 때 승인 무효화', '승인 무효화 제한', '리뷰 스레드 해결'])
      fail(axis, 'pull_request 규칙이 실물에 없다');
  } else {
    eq('승인 수', decl.required_approving_review_count, pr.parameters?.required_approving_review_count);
    // ⭐ 켜고 끈 것이 **결정**이 된 뒤에 선언이 든 칸이다 — 그 전에는 ⬜ 로 남아 있었다.
    eq(
      '미귀속 변경 추가 승인',
      decl.require_extra_approval_for_unattributed_changes,
      pr.parameters?.require_extra_approval_for_unattributed_changes,
    );
    // ⭐ 머지 방식도 결정이다 — squash 가 이 저장소의 관행이고, 그 칸이 혼자 움직이면
    //    `main` 의 역사 모양이 조용히 바뀐다.
    set('머지 방식', decl.allowed_merge_methods, pr.parameters?.allowed_merge_methods ?? []);

    // ⭐ 아래 다섯은 「승인 수 0」의 파생이다 — 지금은 무의미하고, 승인을 켜는 날 **함께**
    //    재어진다. ⚠️ 마지막 push 승인만은 지금도 뜻이 있다: 켜면 협업자 1명인 저장소에서
    //    모든 PR 이 영구 차단된다(자기 push 를 자기가 승인할 수 없다).
    eq('마지막 push 승인', decl.require_last_push_approval, pr.parameters?.require_last_push_approval);
    set('지정 리뷰어', decl.required_reviewers, pr.parameters?.required_reviewers ?? []);
    // ⛔ CODEOWNERS 가 없다 — 켜 두면 「있는데 비어서 통과」와 「없어서 통과」가 구별되지 않는다.
    eq('코드 소유자 리뷰', decl.require_code_owner_review, pr.parameters?.require_code_owner_review);
    eq('push 때 승인 무효화', decl.dismiss_stale_reviews_on_push, pr.parameters?.dismiss_stale_reviews_on_push);
    deep('승인 무효화 제한', decl.dismissal_restriction, pr.parameters?.dismissal_restriction);
    // ⚠️ 승인자가 필요 없는 유일한 리뷰 계열 칸 — 켜면 「열린 질문 위로 머지하지 않는다」가 된다.
    eq(
      '리뷰 스레드 해결',
      decl.required_review_thread_resolution,
      pr.parameters?.required_review_thread_resolution,
    );
  }

  const rsc = ruleOf(live, 'required_status_checks');
  if (!rsc) {
    for (const axis of ['필수 체크', '최신 상태 요구', '생성 때 체크 면제'])
      fail(axis, 'required_status_checks 규칙이 실물에 없다');
  } else {
    const got = (rsc.parameters?.required_status_checks ?? []).map((c) => c.context);
    same(decl.required_status_checks, got)
      ? pass('필수 체크', got.join(' · '))
      : fail(
          '필수 체크',
          `선언 「${sorted(decl.required_status_checks).join(' · ')}」 · 실물 「${sorted(got).join(' · ')}」` +
            ' — ⚠️ 잡 이름이 곧 context 다. 이름을 바꿨다면 그 PR 은 영구 pending 이다',
        );
    // ⭐ 끈 것이 결정이라 선언이 든다 — 켜지면 열린 PR 전부가 리베이스를 요구한다.
    eq('최신 상태 요구', decl.strict_required_status_checks_policy, rsc.parameters?.strict_required_status_checks_policy);
    // ⚠️ 부정형 이름이다 — false 가 **엄한 쪽**(생성 때도 집행)이다. true 면 ref 를 만드는
    //    경로가 필수 체크를 비켜 간다.
    eq('생성 때 체크 면제', decl.do_not_enforce_on_create, rsc.parameters?.do_not_enforce_on_create);
  }

  // ⚠️⚠️ 미판정 ⑵ — 실물에 있는데 어느 축도 재지 않는 칸. 「선언이 이 칸을 들지 않는다」는
  //    「이 칸이 옳다」가 **아니다**. 손으로 고른 축 목록의 구멍을 보이게 하는 주사다.
  for (const rule of live.rules ?? []) {
    const covered = COVERED[rule.type] ?? [];
    for (const key of Object.keys(rule.parameters ?? {}).sort()) {
      if (covered.includes(key)) continue;
      unjudged(UNDECLARED_AXIS, `${rule.type}.${key} = ${JSON.stringify(rule.parameters[key])} — 선언이 이 칸을 들지 않는다`);
    }
  }

  // ⚠️⚠️ 미판정 ⑴ — 「비어 있다」와 「볼 수 없었다」를 가른다.
  if (!Object.hasOwn(live, 'bypass_actors')) {
    unjudged('우회 주체', '읽기 권한으로는 이 칸이 오지 않는다 — 「우회로 0」이 아니라 보지 못한 것이다');
  } else {
    const got = (live.bypass_actors ?? []).map((a) => `${a.actor_type}:${a.actor_id ?? ''}`);
    same(decl.bypass_actors, got)
      ? pass('우회 주체', got.length === 0 ? '(비어 있다 — 우회로 없음)' : got.join(' · '))
      : fail('우회 주체', `선언 「${decl.bypass_actors.length}건」 · 실물 「${got.join(' · ')}」`);
  }

  return out;
}

export const MARK = { pass: '⭕', violation: '⛔', unjudged: '⬜' };

/** 축의 수를 센다 — 요약 한 줄의 분모. */
export const tally = (results) => ({
  violation: results.filter((r) => r.status === 'violation').length,
  pass: results.filter((r) => r.status === 'pass').length,
  unjudged: results.filter((r) => r.status === 'unjudged').length,
});
