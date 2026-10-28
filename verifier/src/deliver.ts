/**
 * 하류 배달 — **정본 → 하류.** 교차 축이 「박제 == 정본」을 **판정만** 하던 자리에서,
 * 갈라진 값을 **다시 쓰는** 손이다.
 *
 * ⭐⭐ **왜 이 손이 필요한가.** 판정은 갈라짐을 보여 주고 끝난다. 그것을 고치는 행위는
 * 지금 사람이고, 저장소 N 개에서 같은 값을 손으로 옮기는 그 행위가 **이 제품이 재는
 * 갈라짐의 생산 공정**이다. 재면서 생산 공정을 그대로 두면 제품이 자기 명제의 절반만 산다.
 *
 * ⭐⭐ **분모는 받는 쪽 선언이다.** 작업장의 배달이 세운 그 모양(allowlist — 선언에 없는
 * 경로는 가지 않는다)과 **같은 성질**이다: 하류가 **박제한 토큰만** 나른다. 그래서
 * 「무엇을 받을지」의 정본이 받는 쪽에 있고, 보내는 쪽은 그 선언을 읽어 따라 쓴다.
 *
 * 건드리지 않는 자리 셋 — 전부 **선언이 말한 것**이다:
 * - ⭐ **`diverged`** — 사유를 달아 **기준을 옮긴** 자리다. 「면제는 판정을 없애고 선언된
 *   갈라짐은 기준을 옮긴다」가 그 구분이고, 기준이 옮겨간 값을 정본으로 되돌리는 것은
 *   그 선언을 **말없이 취소하는** 일이다. 박제와 갈라짐이 토큰 단위로 배타인 것이
 *   이 경계선의 집행이다.
 * - ⭐ **하류가 박제하지 않은 정본 토큰** — 더하지 않는다. 분모를 넓히는 것은 **받는 쪽의
 *   선언 행위**다. ⚠️ 그 자리는 교차 축이 이미 **위반**으로 센다(침묵의 갈라짐) — 배달이
 *   조용히 메우면 그 위반이 영원히 발각되지 않고, 선언은 아무도 고치지 않은 채 참이 된다.
 * - **정본이 모르는 박제** — 저장소 고유값이라 정당하다(「판정 대상 아님」이지 위반 0 이
 *   아니다). 정본에 없는 값을 정본으로 맞출 수는 없다.
 *
 * ⛔ **git 을 모른다** — 쓰는 것과 이력에 넣는 것은 다른 행위이고 둘째는 고객의 몫이다
 * (`init`·조립과 같은 선). ⛔ **우리 인프라가 도는 배달이 아니다** — 고객 조직 안에서
 * 고객 CI 가 돌린다(호스팅 중앙은 칼 ③이라 기각돼 있다).
 *
 * ⛔ **빨강을 내지 않는다** — 더하지 않은 자리도 갈라짐도 **판정**이 센다. 배달이 빨강의
 * 근거를 하나 더 만들면, 같은 사실을 두 손이 세고 그 둘은 갈라진다.
 */

import type { ValueAdapter, ReadToken } from './adapters/adapter.ts';
import { DECLARATION_FILE, declarationOf, SHARED_VALUES_KEY, type CanonPointer } from './declaration.ts';
import type { RepoSnapshot } from './snapshot.ts';
import { readCanon } from './verifiers/shared-values.ts';
import type { UnpinnedToken } from './constitution.ts';

/**
 * 나를 값 하나 — ⚠️ `from` 은 **하류가 적어 둔 자구**이고 `to` 는 정본의 **정규화된** 값이다.
 * 둘을 같은 정규화로 비교해 「이미 같다」를 가르므로(아래), 표기 차이만으로 바이트가
 * 움직이는 일은 없다.
 */
export interface Carry {
  token: string;
  from: string;
  to: string;
}

/**
 * 배달이 **말하는 것** — 나른 것과 나르지 않은 것 전부. ⛔ 점수·백분율 0: 수를 하나로
 * 접는 산술이 이 파일에 없다.
 */
export interface DeliveryPlan {
  carry: readonly Carry[];
  /** 정규화해서 이미 같다 — 바이트를 건드릴 이유가 없다. */
  same: readonly string[];
  /** 사유를 달고 기준을 옮긴 자리 — 건드리지 않는다. */
  divergedKept: readonly string[];
  /** 정본에 있고 하류가 박제하지 않았다 — **더하지 않는다**(분모는 받는 쪽의 선언이다). */
  notAdded: readonly string[];
  /** 정본이 모르는 박제 — 저장소 고유값이라 맞출 정본이 없다. */
  notInCanon: readonly string[];
  /** 정본의 해석되지 않는 값 — 기준이 될 수 없어 나를 수도 없다. */
  unresolved: readonly UnpinnedToken[];
}

/** 축 하나의 계획 — 배달도 축마다 선다(축마다 정본이 따로이기 때문이다). */
export interface AxisDelivery {
  axis: string;
  plan: DeliveryPlan;
}

/**
 * 계획이 서지 **못한** 축 하나 — ⭐⭐ 이것이 거부와 다른 자리다. 앞 판은 축이 하나라
 * 「박제가 없다 · 정본이 시야에 없다」가 곧 **배달 전체의 거부**였다. 축이 여럿이면 그
 * 접힘이 거짓이다: 디자인 축의 정본이 시야에 없다고 API 축의 배달이 틀려지지 않는다.
 * ⇒ 설 수 있는 축은 서고, 서지 못한 축은 **이름과 사유로 남는다**(조용히 빠지지 않는다).
 * ⛔ 축 **전부**가 서지 못하면 그때는 거부다 — 나를 것이 하나도 없다.
 */
export interface AxisSkip {
  axis: string;
  why: string;
}

export type DeliverOutcome =
  /** 계획이 섰다. `text` 가 null 이면 **바이트가 움직이지 않는다**(나를 것이 0 이다). */
  | {
      kind: 'planned';
      deliveries: readonly AxisDelivery[];
      skipped: readonly AxisSkip[];
      text: string | null;
    }
  /** 배달하지 않았다 — ⛔ 부분 쓰기로 접지 않는다: 절반만 나른 선언은 어느 쪽도 참이 아니다. */
  | { kind: 'refused'; problems: readonly string[] };

/** 호스트가 쥐는 둘 — 자리와 **덮어쓰기**. ⚠️ 이름이 `write` 가 아닌 것이 그 사실의 선언이다. */
export interface DeliverIo {
  pathIn(root: string): string;
  /** @throws 쓰지 못하면 던진다 — 조용한 실패는 「썼다」로 둔갑한다. */
  overwrite(path: string, text: string): void;
}

/** JSON 문자열 안에서 바이트로 찾기 위한 이스케이프 — 값에 `"`·`\` 가 들 수 있다. */
const jsonString = (value: string): string => JSON.stringify(value);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 박제 한 칸을 **바이트로** 고친다 — ⭐⭐ **선언을 다시 직렬화하지 않는다.** 다시 쓰면
 * 고객이 손으로 맞춘 서식 전부가 우리 서식으로 바뀌고, 그 diff 안에서 「무엇이 배달됐는가」가
 * 보이지 않는다. 배달의 diff 는 **나른 값의 줄들**이어야 한다.
 *
 * ⛔ **정확히 한 자리가 아니면 고치지 않는다** — 추측으로 한쪽을 고르면 틀릴 수 있고,
 * 틀린 배달은 안 한 배달보다 나쁘다(선언이 거짓이 된 채 초록이 된다).
 */
function replacePin(text: string, axis: string, token: string, from: string, to: string): string | null {
  const region = axisRegion(text, axis);
  if (region === null) return null;
  const slice = text.slice(region.start, region.end);
  const pattern = new RegExp(`(${escapeRegExp(jsonString(token))}\\s*:\\s*)${escapeRegExp(jsonString(from))}`, 'g');
  const found = slice.match(pattern);
  if (found === null || found.length !== 1) return null;
  return text.slice(0, region.start) + slice.replace(pattern, `$1${jsonString(to)}`) + text.slice(region.end);
}

/**
 * 그 축의 선언이 바이트로 사는 **구간** — `"<축>": { … }` 의 여닫는 괄호 사이.
 *
 * ⭐⭐ **왜 구간이 필요한가.** 「파일 전체에서 정확히 한 자리」로 찾으면, 축 둘이 **같은
 * 토큰을 같은 값으로** 박제한 순간(한 조직이 같은 값을 두 헌법에서 쓰는 것은 평상시다) 두
 * 자리가 걸려 배달이 **전부** 멈춘다 — 틀리지는 않지만 할 수 있는 일을 못 한다. ⇒ 축의
 * 구간으로 좁힌 뒤 그 안에서 「정확히 한 자리」를 묻는다.
 *
 * ⛔ **다시 직렬화하지 않는 규율은 그대로다** — 여기서 하는 일은 괄호를 **세는** 것뿐이고,
 * 문자열 안의 괄호는 세지 않는다(이스케이프까지 본다). ⛔ 같은 모양이 둘 이상이면 null 이고,
 * 그러면 배달은 아무 바이트도 쓰지 않는다 — 추측으로 한쪽을 고르면 남의 축을 고칠 수 있다.
 */
function axisRegion(text: string, axis: string): { start: number; end: number } | null {
  const opener = new RegExp(`${escapeRegExp(jsonString(axis))}\\s*:\\s*\\{`, 'g');
  const found = [...text.matchAll(opener)];
  if (found.length !== 1) return null;
  const open = found[0]!.index + found[0]![0].length - 1;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start: open, end: i + 1 };
    }
  }
  // 닫히지 않았다 — JSON 으로 읽힌 파일에서 이것은 버그이되, 추측으로 끝을 정하지 않는다.
  return null;
}

/** 정본의 읽기를 이름으로 모은다 — 모호함의 규칙은 판정과 같다(해석하지 않는다). */
function resolve(tokens: readonly ReadToken[]): {
  values: Map<string, string>;
  unresolved: UnpinnedToken[];
} {
  const byName = new Map<string, ReadToken[]>();
  for (const token of tokens) {
    const list = byName.get(token.name);
    if (list) list.push(token);
    else byName.set(token.name, [token]);
  }
  const values = new Map<string, string>();
  const unresolved: UnpinnedToken[] = [];
  for (const name of [...byName.keys()].sort()) {
    const reads = byName.get(name)!;
    const first = reads[0]!;
    const at = `${first.file}:${first.line}`;
    if (reads.length > 1) unresolved.push({ token: name, why: 'ambiguous-cascade', at });
    else if (first.value.startsWith('var(')) unresolved.push({ token: name, why: 'var-indirection', at });
    else values.set(name, first.value);
  }
  return { values, unresolved };
}

/**
 * 배달 계획 — **순수 함수다.** 정본을 읽는 것은 스냅샷에서 꺼내는 것이고(`peers`), 바이트를
 * 쓰는 것은 호스트의 몫이다. 계획과 쓰기가 갈라져 있어야 「무엇이 움직이는가」를 쓰기 전에
 * 말할 수 있다.
 *
 * @throws DeclarationInvalidError 하류나 정본의 선언이 깨졌을 때 · 정본 포인터와 실재가
 *         어긋날 때 — 판정과 **같은 손**이 같은 자리에서 멈춘다. ⛔ 미판정으로 접지
 *         않는다: 깨진 선언 위에 쓴 바이트는 고객이 되돌려야 하는 것이다.
 * @throws AdapterParseError 정본의 어댑터가 그 파일을 읽지 못할 때.
 */
export function planDelivery(
  snapshot: RepoSnapshot,
  peers: readonly RepoSnapshot[],
): DeliverOutcome {
  const declaration = declarationOf(snapshot);
  if (declaration === 'unreadable') {
    return {
      kind: 'refused',
      problems: [`${DECLARATION_FILE} is tracked but could not be read — a delivery onto a partial read would overwrite what it never saw`],
    };
  }
  if (declaration.state === 'absent' || declaration.sharedValues === null) {
    return {
      kind: 'refused',
      problems: [
        `${DECLARATION_FILE} declares no shared values — the denominator of a delivery is the receiving declaration, and there is none`,
        'declare the canon pointer and the pins first (graduand link), then deliver',
      ],
    };
  }

  const deliveries: AxisDelivery[] = [];
  const skipped: AxisSkip[] = [];
  // 축 이름 순 — 같은 선언이 같은 순서로 나르고 같은 순서로 말한다.
  for (const axis of Object.keys(declaration.sharedValues).sort()) {
    const declared = declaration.sharedValues[axis]!;
    const at = `${SHARED_VALUES_KEY}.${axis}`;
    if (declared.pinned === null || declared.canon === null) {
      // 포인터 없는 박제는 선언 검증이 이미 막는다 — 남는 경우는 「박제가 아예 없다」다.
      // ⭐ 정본 저장소 **자신의** 축이 여기 앉는다(자기가 정본이면 박제하지 않는다).
      skipped.push({
        axis,
        why: `"${at}.pinned" is not declared — a delivery carries the values the receiving side asked for, and this axis asked for none`,
      });
      continue;
    }
    const canon: CanonPointer = declared.canon;
    const peer = peers.find((p) => p.repo === canon.repo) ?? null;
    if (peer === null) {
      skipped.push({
        axis,
        why: `the canon "${canon.repo}" is not in this job's sight — pass its checkout too (one job, N checkouts); a value read from nowhere would be invented`,
      });
      continue;
    }
    const read = readCanon(peer, canon, at);
    if (read.state === 'unjudged') {
      skipped.push({
        axis,
        why:
          read.reason === 'no-adapter'
            ? `the canon "${canon.repo}" does not declare how its own shared values are read (no "shared-values" axis names an adapter) — reading someone else's file with our adapter is a guess`
            : `the canon "${canon.repo}" could not be read in full (${read.reason}) — a delivery on a partial read drops values silently`,
      });
      continue;
    }
    // 모호함을 가르는 것은 **읽기 쪽**이고, 그 목록은 계획을 타고 보고까지 간다 — 나를 수
    // 없는 이유를 말하지 않으면 그 공백이 「정본에 없다」로 읽힌다.
    const { values, unresolved } = resolve(read.tokens);
    deliveries.push({
      axis,
      plan: { ...compare(values, declared.pinned, declared.diverged, read.adapter), unresolved },
    });
  }

  if (deliveries.length === 0) {
    // 축 전부가 서지 못했다 — 나를 것이 하나도 없으므로 그것은 거부다. ⭐ 축 이름을 달고
    // 사유를 그대로 낸다: 축이 하나뿐인 저장소에서는 앞 판과 같은 한 줄이 된다.
    return { kind: 'refused', problems: skipped.map((s) => `"${SHARED_VALUES_KEY}.${s.axis}": ${s.why}`) };
  }

  const carried = deliveries.filter((d) => d.plan.carry.length > 0);
  if (carried.length === 0) return { kind: 'planned', deliveries, skipped, text: null };

  const before = snapshot.files.get(DECLARATION_FILE);
  if (typeof before !== 'string') {
    // 위의 `unreadable` 분기가 이미 막는다 — 여기 오면 그것은 버그다.
    return { kind: 'refused', problems: [`${DECLARATION_FILE} has no body to rewrite`] };
  }
  let text = before;
  const unplaceable: string[] = [];
  for (const { axis, plan } of carried) {
    for (const { token, from, to } of plan.carry) {
      // ⚠️ 구간을 **갈아 쓸 때마다 다시 찾는다** — 앞 치환이 바이트 수를 바꾸므로 한 번
      //    구한 구간은 그다음 치환에서 이미 낡았다. 다시 찾는 값은 싸고, 낡은 구간에 쓰는
      //    것은 남의 축에 쓰는 일이다.
      const next = replacePin(text, axis, token, from, to);
      if (next === null) unplaceable.push(`${SHARED_VALUES_KEY}.${axis}.pinned."${token}"`);
      else text = next;
    }
  }
  if (unplaceable.length > 0) {
    // ⛔ 절반만 나른 선언을 남기지 않는다 — 어느 칸이 정본이고 어느 칸이 낡은 것인지
    //    말할 수 없는 파일이 된다. 전부 나르거나 아무것도 쓰지 않는다.
    return {
      kind: 'refused',
      problems: unplaceable.map(
        (slot) =>
          `${slot} could not be placed in ${DECLARATION_FILE} by bytes (its slot is not exactly one place inside that axis) — nothing was written`,
      ),
    };
  }
  return { kind: 'planned', deliveries, skipped, text };
}

/**
 * 정본의 값과 하류의 박제를 맞춘다 — ⭐ 「이미 같다」는 **정규화로** 가른다(판정이 비교하는
 * 그 기준). 바이트로 가르면 표기 차이(`#abc` ↔ `#AABBCC`)가 배달로 둔갑하고, 판정은 통과인
 * 채 선언의 바이트만 움직인다.
 */
function compare(
  values: Map<string, string>,
  pinned: Record<string, string>,
  diverged: Record<string, string> | null,
  adapter: ValueAdapter,
): DeliveryPlan {
  const carry: Carry[] = [];
  const same: string[] = [];
  const divergedKept: string[] = [];
  const notAdded: string[] = [];

  for (const [token, canonValue] of values) {
    if (diverged?.[token] !== undefined) {
      divergedKept.push(token);
      continue;
    }
    const pin = pinned[token];
    if (pin === undefined) {
      notAdded.push(token);
      continue;
    }
    if (adapter.normalize(pin) === canonValue) same.push(token);
    else carry.push({ token, from: pin, to: canonValue });
  }

  const notInCanon = Object.keys(pinned).filter((token) => !values.has(token));
  return {
    carry,
    same: same.sort(),
    divergedKept: divergedKept.sort(),
    notAdded: notAdded.sort(),
    notInCanon: notInCanon.sort(),
    // 읽기 쪽이 채운다(`planDelivery`) — 비교는 해석된 값만 본다.
    unresolved: [],
  };
}

/**
 * 계획을 **쓴다** — 호스트가 덮어쓰기를 쥔다. ⛔ 나를 것이 0 이면 **파일을 열지도 않는다**:
 * 같은 바이트를 다시 쓰는 것은 「배달이 돌았다」를 mtime 으로 거짓말하게 만든다.
 */
export type DeliverWrite =
  | { kind: 'carried'; path: string }
  | { kind: 'already-current'; path: string }
  | { kind: 'write-failed'; path: string; message: string };

export function deliver(
  root: string,
  io: DeliverIo,
  outcome: Extract<DeliverOutcome, { kind: 'planned' }>,
): DeliverWrite {
  const path = io.pathIn(root);
  if (outcome.text === null) return { kind: 'already-current', path };
  try {
    io.overwrite(path, outcome.text);
  } catch (e) {
    return { kind: 'write-failed', path, message: (e as Error).message };
  }
  return { kind: 'carried', path };
}

/** 박제하지 않은 사유의 문면 — 조립과 **같은 표**를 쓰지 않는다(그쪽은 그쪽 행위를 말한다). */
const UNRESOLVED: Readonly<Record<UnpinnedToken['why'], string>> = {
  'ambiguous-cascade': '정본이 같은 스코프에 두 번 이상 정의했다',
  'var-indirection': '정본의 값이 var() 간접 참조다',
};

/**
 * 말하는 것 — **나른 것 · 이미 같던 것 · 건드리지 않은 것 · 더하지 않은 것.** 어느 줄도
 * 수를 접지 않는다: 「안 나른 이유」가 넷이고 그 넷은 요구하는 행동이 다르다.
 */
export function formatDelivery(
  outcome: Extract<DeliverOutcome, { kind: 'planned' }>,
  write: DeliverWrite,
): { stdout: string[]; stderr: string[] } {
  const said: string[] = [];
  for (const { axis, plan } of outcome.deliveries) said.push(...describePlan(axis, plan));
  if (outcome.skipped.length > 0) {
    said.push(
      `   ⚠️ 계획이 서지 않은 축 ${outcome.skipped.length} 개 — 이 축들은 **아무 값도 나르지 않았다**:`,
      ...outcome.skipped.map((s) => `     · ${s.axis} — ${s.why}`),
    );
  }

  switch (write.kind) {
    case 'carried':
      return {
        stdout: [
          `✅ ${write.path} 의 박제를 정본에 맞췄다.`,
          ...said,
          '   ⛔ 커밋하지도 스테이징하지도 않았다 — 이 명령은 git 을 건드리지 않는다.',
          '   ⛔ 선언의 다른 칸은 바이트로 그대로다 — 다시 직렬화하지 않는다(배달의 diff 는 나른 값의 줄들이다).',
        ],
        stderr: [],
      };
    case 'already-current':
      return {
        stdout: [
          // ⚠️ 「이미 정본과 같다」로 적지 않는다 — 나를 것이 0 인 사유가 **둘**이고
          //    (전부 같다 · 선언이 부른 것이 없다) 뒤쪽은 교차 축에서 **위반**이다.
          //    한 문장으로 접으면 위반을 안은 선언이 「같다」는 말을 받는다.
          `✅ ${write.path} — 나를 값이 0 이라 **바이트를 하나도 쓰지 않았다**.`,
          ...said,
        ],
        stderr: [],
      };
    case 'write-failed':
      return {
        stdout: [],
        stderr: [`❌ ${write.path} 을 쓰지 못했다: ${write.message}`, '   쓰지 못한 것을 썼다고 말하지 않는다.'],
      };
  }
}

/**
 * 축 하나가 말하는 것 — **나른 것 · 이미 같던 것 · 건드리지 않은 것 · 더하지 않은 것.**
 * 어느 줄도 수를 접지 않는다: 「안 나른 이유」가 넷이고 그 넷은 요구하는 행동이 다르다.
 *
 * ⭐ 줄마다 축 이름이 선다 — 축이 여럿인 선언에서 「나른 값 3 건」만 적히면 그것이 어느
 * 헌법의 값인지 말하지 못하고, 고객은 diff 를 열어야 안다.
 */
function describePlan(axis: string, plan: DeliveryPlan): string[] {
  const said: string[] = [];
  if (plan.carry.length > 0) {
    said.push(`   [${axis}] 나른 값 ${plan.carry.length} 건:`);
    for (const { token } of plan.carry) said.push(`     · ${token}`);
  }
  said.push(`   [${axis}] 이미 같던 값 ${plan.same.length} 건 — 표기 차이만으로는 바이트를 움직이지 않는다.`);
  if (plan.divergedKept.length > 0) {
    said.push(
      `   [${axis}] ⭐ 건드리지 않은 갈라짐 ${plan.divergedKept.length} 건 — 사유를 달아 기준을 옮긴 자리다(배달이 그 선언을 말없이 취소하지 않는다):`,
      ...plan.divergedKept.map((token) => `     · ${token}`),
    );
  }
  if (plan.notAdded.length > 0) {
    said.push(
      `   [${axis}] ⚠️ 더하지 않은 정본 토큰 ${plan.notAdded.length} 건 — 분모를 넓히는 것은 **받는 쪽의 선언 행위**다:`,
      ...plan.notAdded.map((token) => `     · ${token}`),
      '      그 자리는 **판정**이 위반으로 센다(침묵의 갈라짐) — 배달이 조용히 메우면 그 위반이 발각되지 않는다.',
    );
  }
  if (plan.notInCanon.length > 0) {
    said.push(
      `   [${axis}] 정본이 모르는 박제 ${plan.notInCanon.length} 건 — 저장소 고유값이라 맞출 정본이 없다(「판정 대상 아님」이지 위반 0 이 아니다).`,
    );
  }
  if (plan.unresolved.length > 0) {
    said.push(
      `   [${axis}] ⚠️ 정본에서 해석되지 않는 값 ${plan.unresolved.length} 건 — 기준이 될 수 없어 나를 수도 없다:`,
      ...plan.unresolved.map((u) => `     · ${u.token} (${u.at}) — ${UNRESOLVED[u.why]}`),
    );
  }
  return said;
}

/** 0 = 나르거나 이미 같다 · 2 = 쓰지 못했다. ⛔ 1 은 쓰지 않는다 — 그 자리는 판정의 몫이다. */
export const deliverExitCode = (write: DeliverWrite): 0 | 2 => (write.kind === 'write-failed' ? 2 : 0);

/** 배달이 서지 않았을 때의 말 — ⛔ 부분 쓰기로 접지 않는다. */
export const formatDeliverRefusal = (
  refused: Extract<DeliverOutcome, { kind: 'refused' }>,
): string[] => ['❌ 배달하지 않았다 — 아무 바이트도 쓰지 않았다:', ...refused.problems.map((p) => `   - ${p}`)];
