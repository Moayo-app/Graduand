/**
 * 조립 결과의 뷰모델 — **조립한 것과 조립하지 않은 것**.
 *
 * ⭐⭐ **문장은 여기서 짓고 사실은 판정기 모듈이 낸다** — 조립기가 내는 것은 수와 코드
 * (`pinned` · `unpinned[].why` · `problems`)이고, 그것을 **이 로케일의 문장**에 끼우는 것이
 * 이 층의 일이다. 자격 고지가 사실로 내려온 그 규율 그대로다: 완성된 문장을 모듈이 내면
 * 로케일이 둘인 화면에 영문 한 줄이 서거나 두 표면의 「같은 한 문장」이 갈라진다.
 *
 * ⛔ **거부의 `problems` 는 번역하지 않는다** — 그 문장들은 **선언 검증의 자구**이고(모르는
 * 키 · 아는 어댑터 목록 · 정본 주소) 기계가 읽는 손잡이를 품는다. 자구를 로케일마다 다시
 * 쓰면 고객이 검색할 수 있는 말이 둘이 된다. ⇒ 머리말만 로케일이 들고 목록은 축자다.
 */

import type { ComposeOutcome, UnpinnedToken } from '../../verifier/src/index.ts';
import type { Strings } from './strings.ts';

export interface ComposedVM {
  /** 조립의 사실을 말하는 줄들 — 박제 수 · 박제하지 않은 것 · 편입 기록이 비었다는 사실. */
  lines: string[];
  /** 박제하지 않은 정본 토큰 — 토큰 · 자리 · 사유. ⛔ 조용히 빠지지 않는다. */
  unpinned: { token: string; at: string; why: string }[];
  /** 조립된 선언의 **바이트**. 거부면 null 이다(쓸 것이 없다). */
  json: string | null;
  /** 거부의 머리말 — 조립이 서지 않았을 때만 non-null. */
  refusedHead: string | null;
  /** 거부의 사유 목록 — **축자**다(위 머리말 참조). */
  problems: string[];
}

const whyOf = (why: UnpinnedToken['why'], strings: Strings): string =>
  strings.constitution.result.unpinnedWhy[why];

export function buildComposed(
  outcome: ComposeOutcome,
  intent: 'canon' | 'link',
  strings: Strings,
): ComposedVM {
  const { result } = strings.constitution;
  if (outcome.kind === 'refused') {
    return {
      lines: [],
      unpinned: [],
      json: null,
      refusedHead: result.refused,
      problems: [...outcome.problems],
    };
  }
  const lines = [
    // ⭐ 어느 헌법의 조립인지가 **첫 줄**이다 — 축이 여럿인 선언에서 「박제 3 건」만 적히면
    //   그것이 어느 축의 수인지 말하지 못한다.
    result.axis(outcome.axis),
    // ⭐ 「이 저장소가 정본이다」와 「정본에서 읽었다」는 **다른 사실**이라 한 문장으로 접지
    //   않는다 — 전자는 박제가 0 인 것이 정상이고, 후자는 0 이면 조립이 거부된다.
    intent === 'canon' ? result.canonSelf : result.pinned(outcome.pinned),
  ];
  // ⭐⭐ **더한 것과 지은 것을 가른다** — 더했으면 조각은 「당신의 선언 + 축 하나」의 전문이고,
  //   고객이 옮길 칸을 고르지 않는다. 그 사실을 말하지 않으면 고객은 자기 선언을 두 번 합친다.
  if (outcome.added) lines.push(result.added);
  if (outcome.unpinned.length > 0) lines.push(result.unpinned(outcome.unpinned.length));
  lines.push(result.admissionsEmpty);
  return {
    lines,
    unpinned: outcome.unpinned.map((token) => ({
      token: token.token,
      at: token.at,
      why: whyOf(token.why, strings),
    })),
    json: outcome.json,
    refusedHead: null,
    problems: [],
  };
}
