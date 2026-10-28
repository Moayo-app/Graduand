/**
 * 탐색 — 조립이 **고를 수 있는 것**을 저장소에서 꺼낸다.
 *
 * ⭐⭐ **왜 이 모듈이 생겼는가.** 조립의 트리오(`adapter`·`files`·`scope`)를 **손으로 적게**
 * 두면 고객은 세 번 추측한다: 어느 파일인지 · 스코프의 자구가 `:root` 인지 `@theme` 인지 ·
 * 그 스코프에서 실제로 값이 읽히는지. 그리고 틀린 선언은 **조용하지 않다** — 판정이 멈춘다
 * (「포인터와 실물이 서로 다른 말을 한다」). ⇒ 추측을 없애는 길은 하나다: **저장소를 읽어
 * 고르게 한다.**
 *
 * ⭐ 두 걸음이고 비용이 다르다 — ⑴ **경로**는 스냅샷의 목록에 이미 있다(공짜) ⑵ **스코프**는
 * 그 파일의 본문을 읽어야 안다(호스트가 한 번 더 간다). 그래서 함수도 둘이고, 화면은 고객이
 * 파일을 고른 **뒤에** 둘째를 부른다.
 *
 * ⛔ **판정이 이 모듈을 쓰지 않는다** — 판정의 분모는 **선언된 파일 목록**이고 꼴이 아니다.
 * 여기서 거르는 것은 **보여 줄 후보**이지 읽을 수 있는 것의 전부가 아니다(선언이 다른 꼴의
 * 경로를 들어도 어댑터는 그것을 읽는다).
 *
 * ⛔ **node 를 import 하지 않는다** — 화면이 그대로 쓴다. I/O 는 호스트가 하고 이 모듈은
 * 스냅샷과 문자열만 받는다(조립기·판정기와 같은 경계).
 */

import { adapterById, type ValueAdapter } from './adapters/adapter.ts';
import type { RepoSnapshot } from './snapshot.ts';

/**
 * 그 어댑터가 읽을 **꼴**의 경로들 — 스냅샷의 목록에서 거른다(본문을 읽지 않는다).
 *
 * ⚠️ **힌트이지 판정이 아니다** — 꼴이 맞아도 토큰은 0 일 수 있고, 그것은 읽어 본 뒤에야
 * 안다(`scopesIn`). 비어 있으면 「이 저장소에 그 어댑터가 읽을 꼴의 파일이 없다」이고,
 * 그것도 **참인 답**이다: 지어내지 않는다.
 */
export function candidateFiles(snapshot: RepoSnapshot, adapterId: string): string[] {
  const adapter = adapterById(adapterId);
  if (adapter === null) return [];
  return snapshot.paths
    .filter((path) => adapter.extensions.some((extension) => path.endsWith(extension)))
    .sort();
}

/** 한 스코프에서 읽힌 수 — ⛔ 값은 싣지 않는다(고객 파일의 내용은 화면 밖으로 나가지 않는다). */
export interface ScopeReading {
  scope: string;
  tokens: number;
}

export type ScopeProbe =
  /** 읽었다. `scopes` 는 **읽힌 수 내림차순**이고, 비어 있으면 그 파일에 토큰이 0 이다. */
  | { kind: 'read'; scopes: ScopeReading[] }
  /** 어댑터가 못 읽었다 — ⛔ 「토큰 0 건」과 같은 자리가 아니다(눈이 먼 입력이다). */
  | { kind: 'unreadable'; message: string };

/**
 * 그 파일에서 어댑터가 본 **스코프들** — 조립의 셋째 칸을 추측하지 않게 하는 자리다.
 *
 * ⭐ 수를 함께 낸다 — 같은 파일에 `:root` 와 `.dark` 가 같이 사는 것이 팔레트의 평상시이고,
 * 「어느 쪽이 공유값의 자리인가」는 **읽힌 수**가 가장 잘 말한다. ⛔ 우리가 고르지는 않는다:
 * 고르는 것은 고객이고, 이 함수는 사실만 낸다.
 *
 * ⚠️ 파싱 실패를 **토큰 0 으로 접지 않는다** — 어댑터 계약의 성질 3 이 여기서도 그대로다.
 */
export function scopesIn(adapterId: string, file: string, text: string): ScopeProbe {
  const adapter: ValueAdapter | null = adapterById(adapterId);
  if (adapter === null) return { kind: 'unreadable', message: `unknown adapter: ${adapterId}` };
  const result = adapter.read([{ path: file, text }]);
  if (!result.ok) return { kind: 'unreadable', message: result.message };

  const counted = new Map<string, number>();
  for (const token of result.tokens) counted.set(token.scope, (counted.get(token.scope) ?? 0) + 1);
  const scopes = [...counted.entries()]
    .map(([scope, tokens]) => ({ scope, tokens }))
    // 읽힌 수 내림차순 · 같으면 이름 순 — 같은 파일이 같은 순서를 내야 고객이 다시 봐도 같다.
    .sort((a, b) => (b.tokens - a.tokens) || (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
  return { kind: 'read', scopes };
}
