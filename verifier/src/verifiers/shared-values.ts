/**
 * `shared-values` · `shared-values-cross` — 공유값 드리프트 판정기(헌법층). 축이 표면을 가른다:
 *
 * - **CI 축(`shared-values`)** — 이 저장소 워크스페이스만 본다. 어댑터가 코드에서 읽은 값을
 *   기준(소비 저장소 = 박제 `pinned` · 정본 저장소 = 자기 파일의 등록부)과 비교한다.
 * - **교차 축(`shared-values-cross`)** — 「박제 == 정본」. 선언의 정본 포인터(그 축의 `canon`)
 *   를 따라 **다른 체크아웃**의 정본을 읽고 박제와 비교한다. 값과 박제를 한 PR 에서 함께
 *   바꾸면 이 저장소의 모든 가드가 초록인 채 저장소 간 갈라짐이 성립하므로, 워크스페이스
 *   하나만 보는 표면은 그것을 원리상 못 본다 — 그 표면에서는 칸이 남고 사유가 붙는다
 *   (`single-repo-surface`). 칸을 비우면 「위반 0」으로 읽힌다.
 *
 * ⭐⭐ **개정 4 — 그 둘이 공유값 축마다 선다.** 선언이 공유값 축을 **이름으로 여럿** 들고
 * (`shared-values.<축>`), 이 판정기는 축마다 칸 둘을 낸다: `shared-values:<축>` ·
 * `shared-values-cross:<축>`. ⭐ **축마다 정본이 따로**이므로 한 저장소가 디자인 정본과 API
 * 정본에 동시에 답할 수 있다 — 저장소가 여럿이고 규율이 갈래로 파편화된 조직이 그 모양이다.
 * ⛔ 축이 **하나도** 선언되지 않았으면 접미 없는 맨 이름 둘이 미판정으로 남는다(칸이 빠지지
 * 않는다 — 분모는 선언 여부와 무관하게 고정이다).
 * ⛔ 축 사이를 **합치지 않는다**: 디자인 축의 위반이 API 축의 통과를 가리거나 그 반대가 되는
 * 산술이 여기 없다. 칸은 축마다 따로 서고, 수를 모으는 것은 격자의 몫이다(규칙이 그 판정기를
 * 편입했으면 그 규칙 줄이 축 전부를 접지 않고 합친다 — `grid.ts`).
 *
 * ⭐ **분모가 정본이다** — 정본이 든 토큰은 박제되어야 한다. 박제에서 조용히 빠진 토큰은
 * 「이 값은 나에게 공유값이 아니다」를 **침묵으로** 주장하는 것이고, 그 침묵이 성립하면
 * 선언은 시간이 지나면서 반드시 틀린다. 그래서 정본이 보이는 표면에서 박제되지 않은 정본
 * 토큰은 **위반**이다. ⭐ 그 침묵의 **반대편**이 그 축의 `diverged` 다: 사유를 달아 「이 값의
 * 정본은 여기다」를 말하면 그 칸은 교차 축에서 「**밖 — 미판정(선언된 갈라짐)**」으로 옮겨가고,
 * 사유 문장은 증거를 타고 칸마다 찍힌다(새 필드 0 — 코드는 기계가 · 문장은 증거가).
 * ⚠️ **면제는 판정을 없애고, 선언된 갈라짐은 기준을 옮긴다** — 그래서 빠지는 것은 이 축
 * 하나뿐이고, CI 축(「코드 == 박제」)은 갈라짐 선언을 **읽지 않는다**(그대로 판정한다).
 *
 * 선언을 믿지 않는다: 선언된 파일이 실재하지 않거나 선언된 스코프가 실재와 어긋나면
 * 미판정으로 접지 않고 **판정 실패**로 멈춘다. 반대로 코드가 들고 있는 모호함
 * (`var()` 간접 참조 · 같은 스코프의 중복 정의)은 해석하지 않는다 — 그 토큰은 위반도
 * 통과도 아닌 **미판정**이고, 수로 따로 센다.
 *
 * 증거는 토큰 이름 · 파일 · 행 · 사유뿐이다 — **값은 싣지 않는다.** 보고는 fragment ·
 * PR 코멘트로 복제되는 표면이라, 고객 파일의 내용은 수와 좌표로만 남긴다.
 */

import type { CheckResult, Evidence, ReasonCode } from '../schema.ts';
import { indexPaths, type PathIndex, type RepoSnapshot } from '../snapshot.ts';
import {
  DeclarationInvalidError,
  declarationOf,
  SHARED_VALUES_KEY,
  type CanonPointer,
  type SharedValuesAxis,
  type ResolvedDeclaration,
} from '../declaration.ts';
import { AdapterParseError, adapterById, type ValueAdapter, type ReadToken } from '../adapters/adapter.ts';
import { capEvidence } from './evidence.ts';
import { axisCheckId, type VerifierId } from './registry.ts';

export const SHARED_VALUES_CHECK_ID = 'shared-values' satisfies VerifierId;
export const SHARED_VALUES_CROSS_CHECK_ID = 'shared-values-cross' satisfies VerifierId;

const unjudged = (id: string, reason: ReasonCode, counts: Record<string, number>): CheckResult => ({
  id,
  status: 'unjudged',
  reason,
  counts,
  evidence: [],
});

interface TokenOutcome {
  matched: number;
  mismatched: number;
  missing: number;
  unjudgedTokens: number;
  evidence: Evidence[];
}

/** 기준 한 벌과 읽기 한 벌의 비교 — 증거에 값은 싣지 않는다. */
function compare(basis: ReadonlyMap<string, string>, inScope: ReadToken[]): TokenOutcome {
  const byName = new Map<string, ReadToken[]>();
  for (const t of inScope) {
    const list = byName.get(t.name);
    if (list) list.push(t);
    else byName.set(t.name, [t]);
  }

  const out: TokenOutcome = { matched: 0, mismatched: 0, missing: 0, unjudgedTokens: 0, evidence: [] };
  for (const [token, value] of basis) {
    const reads = byName.get(token) ?? [];
    if (reads.length === 0) {
      // 부재는 공집합이 아니라 소실이다 — 기준이 가리키는 토큰이 코드에 없다.
      out.missing += 1;
      out.evidence.push({ token, why: 'missing' });
      continue;
    }
    if (reads.length > 1) {
      // 같은 스코프에 같은 이름이 여럿 — 어느 읽기가 유효한지는 캐스케이드 해석이고,
      // 이 판정기는 해석하지 않는다. 위반도 통과도 아닌 미판정으로 센다.
      const first = reads[0]!;
      out.unjudgedTokens += 1;
      out.evidence.push({ token, file: first.file, line: first.line, why: 'ambiguous-cascade', occurrences: reads.length });
      continue;
    }
    const read = reads[0]!;
    if (read.value.startsWith('var(')) {
      // var() 간접 참조 — 값을 해석하지 않는다. 3상태의 세 번째 칸이 쓰이는 자리다.
      out.unjudgedTokens += 1;
      out.evidence.push({ token, file: read.file, line: read.line, why: 'var-indirection' });
      continue;
    }
    if (read.value === value) {
      out.matched += 1;
    } else {
      out.mismatched += 1;
      out.evidence.push({ token, file: read.file, line: read.line, why: 'mismatch' });
    }
  }
  return out;
}

/** 판정기가 받는 것 — 이 저장소의 스냅샷과, 같은 잡이 함께 본 다른 체크아웃들. */
export interface SharedValuesInput {
  snapshot: RepoSnapshot;
  index: PathIndex;
  declaration: ResolvedDeclaration;
  /** 교차 축이 정본을 여기서 찾는다. 비면 한 저장소 표면이다. */
  peers: readonly RepoSnapshot[];
}

/**
 * @returns 공유값 축마다 칸 둘 — `shared-values:<축>`(CI 축) · `shared-values-cross:<축>`
 *          (교차 축). 축이 하나도 선언되지 않았으면 접미 없는 맨 이름 둘이다. 분모는 선언 여부와
 *          무관하게 고정이다 — 미선언은 칸이 빠지는 게 아니라 미판정으로 남는다.
 * @throws DeclarationInvalidError 선언과 실재가 어긋날 때(없는 파일 · 실재와 어긋나는
 *         스코프 · 모호한 정본) — 선언을 믿지 않는 probe 의 자리다. 정본으로 지목된
 *         체크아웃의 선언이 깨진 것도 같은 자리다.
 * @throws AdapterParseError 어댑터가 선언된 파일을 읽지 못할 때 — 토큰 0건의 통과가 아니다.
 */
export function judgeSharedValues({ snapshot, index, declaration, peers }: SharedValuesInput): CheckResult[] {
  if (declaration === 'unreadable') {
    return [
      unjudged(SHARED_VALUES_CHECK_ID, 'collection-truncated', { files: 0, read: 0 }),
      unjudged(SHARED_VALUES_CROSS_CHECK_ID, 'collection-truncated', { pinned: 0 }),
    ];
  }
  if (declaration.state === 'absent' || declaration.sharedValues === null) {
    // ⛔ 맨 이름 둘이 남는다 — 축이 없으면 접미할 이름도 없고, 칸을 아예 내지 않으면
    //    「위반 0」으로 읽힌다. 선언하지 않은 것은 미판정이다.
    return [
      unjudged(SHARED_VALUES_CHECK_ID, 'no-declaration', { declared: 0 }),
      unjudged(SHARED_VALUES_CROSS_CHECK_ID, 'no-declaration', { pinned: 0 }),
    ];
  }

  // 축 이름 순 — 같은 선언이 같은 순서를 내야 두 표면의 직렬화가 바이트로 같다(결과는
  // 어차피 id 순으로 다시 정렬되지만, 정렬에 기대지 않는 것이 결정성의 값싼 쪽이다).
  const axes = Object.keys(declaration.sharedValues).sort();
  return axes.flatMap((axis) => {
    const declared = declaration.sharedValues![axis]!;
    const at = `${SHARED_VALUES_KEY}.${axis}`;
    return [
      judgeCiAxis(snapshot, index, declared, axis, at),
      judgeCrossAxis(declared, peers, axis, at),
    ];
  });
}

/**
 * 교차 축 — 「박제 == 정본」. 분모는 **정본이 든 토큰**이고, 박제는 그 분모를 전부 받아야
 * 한다. 박제에서 조용히 빠진 토큰(`unpinned`)과 값이 어긋난 토큰(`mismatch`)이 위반이다.
 * 사유를 달아 선언한 갈라짐(`diverged`)은 그 침묵의 반대편이라 위반이 아니고, 분모를 줄이지도
 * 않는다 — 칸은 남고 수(`counts.diverged`)와 사유가 붙는다.
 *
 * 정본을 읽는 어댑터는 **정본 저장소가 선언한 것**이다 — 자기 공유값을 어떻게 읽는지는 그
 * 저장소의 선언이고, 소비 저장소의 어댑터로 남의 파일을 읽는 것은 추측이다. 그래서 어댑터
 * 없는 소비 저장소(폴백 선언)도 이 축은 설 수 있다: 비교의 양변은 정본의 읽기와 박제다.
 */
function judgeCrossAxis(
  declared: SharedValuesAxis,
  peers: readonly RepoSnapshot[],
  axis: string,
  at: string,
): CheckResult {
  const id = axisCheckId(SHARED_VALUES_CROSS_CHECK_ID, axis);
  if (declared.pinned === null) {
    // 박제가 없다 — 「박제 == 정본」의 한 변이 선언되지 않았다. 정본 저장소 자신이 여기
    // 앉는다(자기가 정본이면 박제하지 않는다). 미선언은 미판정이다.
    return unjudged(id, 'no-declaration', { pinned: 0 });
  }
  const pinned = declared.pinned;
  const pinnedCount = Object.keys(pinned).length;
  // 선언 검증이 박제와 정본 주소의 동반을 이미 집행했다 — 여기서 null 이면 그것은 버그다.
  const canon = declared.canon!;

  // 이름이 정확히 같은 체크아웃 하나. ⛔ 비슷한 이름으로 맞히지 않는다 — 정본을 추측으로
  // 고르면 그 판정은 틀릴 수 있고, 틀린 판정은 미판정보다 나쁘다.
  const peer = peers.find((p) => p.repo === canon.repo) ?? null;
  if (peer === null) {
    // 정본이 이 잡의 시야에 없다 — 판정 불가다. 박제 전부가 이 표면의 「밖」이고, 그
    // 사실을 수로 남긴다: 「위반 0」과 같아 보이지 않게.
    return unjudged(id, 'single-repo-surface', {
      pinned: pinnedCount,
      excluded: pinnedCount,
    });
  }

  const read = readCanon(peer, canon, at);
  if (read.state === 'unjudged') {
    return unjudged(id, read.reason, { pinned: pinnedCount, ...read.counts });
  }

  const outcome = compareToCanon(read.tokens, pinned, declared.diverged, read.adapter);
  const canonNames = new Set(read.tokens.map((t) => t.name));
  // 정본이 모르는 박제 — 「판정 대상 아님」이지 위반 0 이 아니다.
  const excluded = Object.keys(pinned).filter((token) => !canonNames.has(token)).length;

  const violations = outcome.mismatched + outcome.unpinned;
  // ⭐ 분모가 전부 갈라짐으로 빠지면 비교가 **한 건도** 서지 않는다 — 그 자리의 ✅ 는
  // 거짓 초록이다(「갈라짐 5건과 0건이 같은 ✅」). 판정이 없으면 통과가 아니라 미판정이고,
  // 사유는 그 자리를 만든 선언이다. 분모와 증거는 그대로 남는다 — 칸을 비우지 않는다.
  const nothingCompared = outcome.matched + violations === 0 && outcome.diverged > 0;

  const { evidence, omitted } = capEvidence(outcome.evidence);
  return {
    id: id,
    status: violations > 0 ? 'violation' : nothingCompared ? 'unjudged' : 'pass',
    reason: violations === 0 && nothingCompared ? 'declared-divergence' : null,
    counts: {
      canon: canonNames.size,
      pinned: pinnedCount,
      matched: outcome.matched,
      mismatched: outcome.mismatched,
      unpinned: outcome.unpinned,
      unjudged: outcome.unjudgedTokens,
      diverged: outcome.diverged,
      excluded,
      evidenceOmitted: omitted,
    },
    evidence,
  };
}

export type CanonRead =
  | { state: 'read'; tokens: ReadToken[]; adapter: ValueAdapter }
  | { state: 'unjudged'; reason: ReasonCode; counts: Record<string, number> };

/**
 * 정본 체크아웃에서 포인터가 가리키는 토큰을 읽는다 — I/O 는 없다(스냅샷이 본문을 들고
 * 있다). 선언을 믿지 않는 probe 는 여기서도 같다: 포인터가 가리키는 파일이 그 저장소에
 * 실재하지 않거나 선언된 스코프에서 토큰이 0 이면 **판정 실패**다.
 *
 * ⭐ **판정만 이 손을 쓰는 것이 아니다** — 헌법 조립(`constitution.ts` 의 연결)이 박제를
 * **정본에서 읽어** 지을 때도 여기를 지난다. 읽는 규칙(어댑터는 정본 저장소가 선언한
 * 것 · 포인터와 실재의 어긋남은 판정 실패)이 두 곳에 적히면 그 순간 사본이고, 조립이
 * 판정보다 느슨해지는 날 「조립해 넣었더니 빨갛다」가 선다.
 *
 * @throws DeclarationInvalidError 포인터와 실재가 어긋날 때, 그리고 정본 저장소의 선언이
 *         깨졌을 때(`declarationOf` — 선언을 읽는 손은 하나다).
 * @throws AdapterParseError 정본 저장소의 어댑터가 그 파일을 읽지 못할 때.
 */
export function readCanon(peer: RepoSnapshot, canon: CanonPointer, at: string): CanonRead {
  const peerDeclaration = declarationOf(peer);
  if (peerDeclaration === 'unreadable') {
    // 정본 저장소의 선언이 추적되는데 못 읽혔다 — 부재가 아니라 잘림이다.
    return { state: 'unjudged', reason: 'collection-truncated', counts: { files: 1, read: 0 } };
  }
  const adapter = canonAdapter(peerDeclaration, canon, at);
  if (adapter === null) {
    // 정본 저장소가 자기 공유값을 어떻게 읽는지 선언하지 않았다 — 읽을 손이 없다.
    return { state: 'unjudged', reason: 'no-adapter', counts: { canon: 0 } };
  }

  if (!indexPaths(peer.paths).hasFile(canon.file)) {
    throw new DeclarationInvalidError([
      `"${at}.canon.file" ("${canon.file}") does not exist in "${canon.repo}" — a canon pointer that resolves to nothing is a judgment failure, not an unjudged axis`,
    ]);
  }
  const text = peer.files.get(canon.file);
  if (typeof text !== 'string') {
    return { state: 'unjudged', reason: 'collection-truncated', counts: { files: 1, read: 0 } };
  }

  const result = adapter.read([{ path: canon.file, text }]);
  if (!result.ok) throw new AdapterParseError(result.file, result.message);

  const inScope = result.tokens.filter((t) => t.scope === canon.scope);
  if (inScope.length === 0) {
    throw new DeclarationInvalidError([
      `"${at}.canon.scope" ("${canon.scope}") reads zero tokens from "${canon.repo}" / "${canon.file}" — the canon pointer and the real file disagree`,
    ]);
  }
  return { state: 'read', tokens: inScope, adapter };
}

/**
 * 정본의 파일을 읽을 **손** — 정본 저장소가 선언한 어댑터다.
 *
 * ⭐⭐ **축 이름을 포인터에 적게 하지 않는다 — 유도한다.** 정본 저장소도 축이 여럿이라
 * 「어느 축의 어댑터인가」를 알아야 하는데, 그 답을 `canon` 에 **적게** 두면 하류 선언이
 * 상류의 축 이름을 **베껴** 들고(사본이다) 상류가 축을 개명하는 날 하류 N 개가 조용히
 * 틀린다. ⇒ 포인터는 **물리 주소**(저장소 · 파일 · 스코프)로 두고, 손은 그 파일을 선언한
 * 축에서 찾는다.
 *
 * 고르는 순서 둘 — ⑴ 그 **파일을 선언한** 축들, 없으면 ⑵ 어댑터를 선언한 축 전부. 둘째가
 * 있는 이유는 하류가 상류의 선언 **밖** 파일을 가리킬 수 있기 때문이다(그것 자체는 금지가
 * 아니다 — 정본은 그 저장소에 실재하고, 「선언된 공유값 축의 파일인가」는 상류의 사정이다).
 *
 * ⚠️ **어댑터 id 가 둘 이상 남으면 판정 실패다** — 추측으로 한쪽을 고르면 틀린 기준이 서고,
 * 틀린 기준 위의 수는 전부 거짓이다. ⭐ 축이 여럿이어도 **어댑터가 하나면 모호함이 없다**:
 * 모으는 것은 축이 아니라 **읽는 손**이라, 디자인 축과 API 축이 같은 어댑터를 쓰면 그대로 선다.
 *
 * ⚠️ **그 마지막 갈래는 오늘 실물 선언으로 닿지 않는다** — 등록부에 어댑터가 하나뿐이라
 * (`VALUE_ADAPTERS`) 서로 다른 **아는** 이름 둘을 선언할 수 없고, 모르는 이름은 선언 검증이
 * 먼저 거부한다. ⇒ 테스트가 이 함수를 **직접** 부른다(선언을 손으로 지어). 둘째 어댑터가
 * 출하되는 날 그 갈래가 실물 경로로 서고, 그때 이 자리는 이미 집행되고 있다.
 * ⛔ 그래서 이 함수는 `index.ts` 에 없다 — 공개 약속이 아니라 이 모듈의 이음새다.
 */
export function canonAdapter(
  peerDeclaration: Exclude<ResolvedDeclaration, 'unreadable'>,
  canon: CanonPointer,
  at: string,
): ValueAdapter | null {
  if (peerDeclaration.state !== 'valid' || peerDeclaration.sharedValues === null) return null;
  const axes = Object.entries(peerDeclaration.sharedValues).filter(([, a]) => a.adapter !== null);
  if (axes.length === 0) return null;
  const naming = axes.filter(([, a]) => (a.files ?? []).includes(canon.file));
  const chosen = naming.length > 0 ? naming : axes;
  const ids = [...new Set(chosen.map(([, a]) => a.adapter!))].sort();
  if (ids.length === 1) return adapterById(ids[0]!)!;
  throw new DeclarationInvalidError([
    `"${at}.canon" points at "${canon.repo}" / "${canon.file}", which that repository's shared-value axes read with ${ids.length} different adapters (${ids.join(', ')}) — picking one would be a guess, and a wrong basis is worse than none`,
    `name the file in exactly one axis of "${canon.repo}", or point at a file only one axis declares`,
  ]);
}

interface CrossOutcome {
  matched: number;
  mismatched: number;
  /** 정본이 든 토큰이 박제에 없다 — 침묵의 갈라짐이다. */
  unpinned: number;
  /** 사유를 달아 선언된 갈라짐 — 「밖 — 미판정」으로 옮겨간 칸. */
  diverged: number;
  unjudgedTokens: number;
  evidence: Evidence[];
}

/**
 * 정본의 읽기와 박제의 비교 — 증거의 좌표는 **정본의** 파일·행이다(공유값이 사는 자리).
 * 값은 싣지 않는다: 양쪽 저장소의 파일 내용이 보고를 타고 나가지 않는다.
 *
 * 정본이 든 모호함(`var()` 간접 · 같은 스코프의 중복 정의)은 해석하지 않는다 — 그 토큰은
 * 미판정이다. ⚠️ 모호한 정본은 **그 저장소의 CI 축**이 판정 실패로 세운다. 여기서 같은
 * 것을 또 던지면, 소비 저장소가 남의 저장소 상태 때문에 수를 못 내게 된다.
 *
 * ⚠️ **분모는 여전히 정본이다** — 정본이 들지 않은 토큰의 갈라짐 선언은 옮길 칸이 없어
 * 수에 들어오지 않는다. 선언이 이 축의 분모를 늘리지 않는다.
 */
function compareToCanon(
  canonTokens: ReadToken[],
  pinned: Record<string, string>,
  diverged: Record<string, string> | null,
  adapter: ValueAdapter,
): CrossOutcome {
  const byName = new Map<string, ReadToken[]>();
  for (const t of canonTokens) {
    const list = byName.get(t.name);
    if (list) list.push(t);
    else byName.set(t.name, [t]);
  }

  const out: CrossOutcome = { matched: 0, mismatched: 0, unpinned: 0, diverged: 0, unjudgedTokens: 0, evidence: [] };
  for (const [token, reads] of byName) {
    const first = reads[0]!;
    const divergenceReason = diverged?.[token];
    if (divergenceReason !== undefined) {
      // 사유를 달아 선언된 갈라짐 — 이 칸은 「밖 — 미판정」으로 옮겨간다. ⭐ 정본의
      // 모호함보다 **먼저** 본다: 선언이 기준을 옮겼으므로 정본과의 비교 자체가 서지
      // 않고, 비교하지 않는 값의 모호함은 이 축이 말할 것이 아니다.
      // 사유 문장은 증거를 타고 칸마다 찍힌다 — 읽지 않는 사유는 통과료다.
      out.diverged += 1;
      out.evidence.push({ token, file: first.file, line: first.line, why: 'declared-divergence', reason: divergenceReason });
      continue;
    }
    if (reads.length > 1) {
      out.unjudgedTokens += 1;
      out.evidence.push({ token, file: first.file, line: first.line, why: 'ambiguous-cascade', occurrences: reads.length });
      continue;
    }
    if (first.value.startsWith('var(')) {
      out.unjudgedTokens += 1;
      out.evidence.push({ token, file: first.file, line: first.line, why: 'var-indirection' });
      continue;
    }
    const pin = pinned[token];
    if (pin === undefined) {
      // 사유 없이 박제에서 빠졌다 — 이것이 침묵의 갈라짐이고, 정본이 보이는 표면에서 위반이다.
      out.unpinned += 1;
      out.evidence.push({ token, file: first.file, line: first.line, why: 'unpinned' });
      continue;
    }
    // 비교의 양변이 같은 정규화를 지난다 — 표기 차이가 드리프트로 오인되지 않는다.
    if (adapter.normalize(pin) === first.value) {
      out.matched += 1;
    } else {
      out.mismatched += 1;
      out.evidence.push({ token, file: first.file, line: first.line, why: 'mismatch' });
    }
  }
  return out;
}

function judgeCiAxis(
  snapshot: RepoSnapshot,
  index: PathIndex,
  declared: SharedValuesAxis,
  axis: string,
  at: string,
): CheckResult {
  const id = axisCheckId(SHARED_VALUES_CHECK_ID, axis);
  if (declared.adapter === null) {
    if (declared.pinned !== null) {
      // 폴백 — 선언 파일이 공유값을 직접 든다. 코드를 읽을 어댑터가 없어 비교는 못
      // 하지만, 선언된 분모는 같은 스키마의 수로 남는다. 미판정이 수를 지우지 않는다.
      return unjudged(id, 'no-adapter', { declared: Object.keys(declared.pinned).length });
    }
    // 정본 포인터만 있고 박제도 어댑터도 없다 — 이 표면에 기준이 선언되지 않았다.
    return unjudged(id, 'no-declaration', { declared: 0 });
  }

  // 선언 검증이 셋의 동반을 이미 집행했다 — 여기서 null 이면 그것은 버그다.
  const files = declared.files!;
  const scope = declared.scope!;
  const adapter = adapterById(declared.adapter)!;

  // probe — 선언을 믿지 않는다: 선언된 파일이 추적 목록에 실재하는가.
  const missing = files.filter((path) => !index.hasFile(path));
  if (missing.length > 0) {
    throw new DeclarationInvalidError(
      missing.map((path) => `"${at}.files" ("${path}") does not exist in the repository — a declared path that resolves to nothing is a judgment failure, not an unjudged axis`),
    );
  }

  const contents: { path: string; text: string }[] = [];
  let read = 0;
  for (const path of files) {
    const text = snapshot.files.get(path);
    if (typeof text !== 'string') continue; // 추적되는데 못 읽었다 — 부재가 아니라 잘림이다.
    read += 1;
    contents.push({ path, text });
  }
  if (read < files.length) {
    return unjudged(id, 'collection-truncated', { files: files.length, read });
  }

  const result = adapter.read(contents);
  if (!result.ok) throw new AdapterParseError(result.file, result.message);

  const inScope = result.tokens.filter((t) => t.scope === scope);
  const outOfScope = result.tokens.length - inScope.length;

  let basis: Map<string, string>;
  if (declared.pinned !== null) {
    // 소비 저장소 — 기준은 박제. 비교의 양변이 같은 정규화를 지난다.
    basis = new Map(Object.entries(declared.pinned).map(([token, value]) => [token, adapter.normalize(value)]));
  } else {
    // 정본 저장소 — 기준은 자기 파일의 등록부. 기준이 성립하지 않으면(스코프가 비거나
    // 모호하면) 그것은 선언과 실재의 어긋남이고, 미판정이 아니라 판정 실패다.
    if (inScope.length === 0) {
      throw new DeclarationInvalidError([
        `"${at}.scope" ("${scope}") reads zero tokens from the declared files — the declared scope and the real files disagree`,
      ]);
    }
    basis = new Map<string, string>();
    const duplicated = new Set<string>();
    for (const t of inScope) {
      if (basis.has(t.name)) duplicated.add(t.name);
      else basis.set(t.name, t.value);
    }
    if (duplicated.size > 0) {
      throw new DeclarationInvalidError(
        [...duplicated].map((name) => `the declared files define "${name}" more than once in "${at}.scope" ("${scope}") — an ambiguous canon cannot serve as a basis`),
      );
    }
  }

  const outcome = compare(basis, inScope);
  const basisNames = new Set(basis.keys());
  // 배제도 센다 — 기준 밖 토큰(서비스 고유값 등)은 「판정 대상 아님」이지 위반 0 이 아니다.
  const excluded = new Set(inScope.filter((t) => !basisNames.has(t.name)).map((t) => t.name)).size;

  const { evidence, omitted } = capEvidence(outcome.evidence);
  return {
    id,
    status: outcome.mismatched + outcome.missing > 0 ? 'violation' : 'pass',
    reason: null,
    counts: {
      files: files.length,
      declared: basis.size,
      matched: outcome.matched,
      mismatched: outcome.mismatched,
      missing: outcome.missing,
      unjudged: outcome.unjudgedTokens,
      excluded,
      outOfScope,
      evidenceOmitted: omitted,
    },
    evidence,
  };
}
