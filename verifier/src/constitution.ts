/**
 * 헌법 조립 — 「헌법을 만든다」의 **규범 저작** 쪽 입구.
 *
 * ⭐⭐ **「헌법을 만든다」는 둘이고**(규범 저작 1회 · 편입 저장소마다) 지금까지 선 것은
 * **둘째**였다 — 빈 스캐폴드 하나(`scaffold.ts`). 이 모듈이 첫째를 세운다. 갈래가 둘이고
 * **자리가 다르다**:
 *
 * - **생성**(`canon`) — 이 저장소가 **정본이다.** 선언이 드는 것은 어댑터 트리오
 *   (`adapter`·`files`·`scope`) 하나이고 `pinned`·`canon` 은 **0** 이다. 교차 축의 축자가
 *   그 자리를 이미 적는다: 「자기가 정본이면 박제하지 않는다」.
 * - **연결**(`link`) — 정본은 **남의 저장소**다. 선언이 드는 것은 `canon` 포인터와 `pinned`
 *   이고, ⭐⭐ **박제 값을 손으로 받지 않는다 — 정본에서 읽는다.** 손으로 적게 두면 그
 *   순간 사본이고, 저장소 N 개에 같은 값을 손으로 옮기는 그 행위가 바로 이 제품이 재는
 *   갈라짐의 생산 공정이다.
 *
 * ⛔ **스키마를 늘리지 않는다** — 최상위 키 넷 그대로이고 `SCHEMA_VERSION` 도 그대로다.
 * 이 모듈이 더하는 것은 **그 필드를 쓰는 손**이지 새 필드가 아니다: 읽는 코드 없는 필드는
 * 거짓 초록이라는 규율의 반대편이라, 쓰는 손이 없는 필드도 같은 성질이었다(`palette.canon`
 * 은 검증만 되고 **짓는 입구가 0** 이었다).
 *
 * ⛔ **덮어쓰지 않는다.** `init` 이 덮어쓰기를 기각한 사유가 축자로 「**병합도 보존도
 * 추측이다**」이고, 갈래가 둘 늘어도 그 사유는 그대로다 — 선언이 이미 있으면 **쓰지 않고**
 * 조립한 것을 말한다(고객이 옮긴다). ⛔ 커밋도 하지 않는다: 쓰는 것과 이력에 넣는 것은
 * 다른 행위이고 둘째는 고객의 몫이다 — 그래서 이 모듈은 git 도 node 도 모른다.
 *
 * ⛔ **견본 헌법을 담지 않는다** — 도메인 규칙이 든 예시의 트리거는 **1호 고객 접촉**이다
 * (`scaffold.ts` 와 같은 결의). 조립이 내는 편입 기록은 비어 있고, 「아직 아무 규칙도
 * 편입하지 않았다」는 **참인 선언**이다.
 *
 * ⭐ **이 모듈은 브라우저에서 그대로 돈다** — 화면이 같은 함수로 선언을 조립해 **내보내고**
 * (쓰지 않는다), CLI 가 같은 함수의 산출을 **쓴다**. 「조립은 화면, 쓰기는 CLI」가 그
 * 결정이고(Henry 2026-10-27), 스캐폴드가 입구 둘에 같은 상수 하나를 준 그 선례와 같은 모양
 * 이다 — 조립기가 둘이면 두 표면이 다른 선언을 내고, 그 둘은 갈라진다.
 */

import { adapterById, VALUE_ADAPTERS } from './adapters/adapter.ts';
import {
  axisNameProblem,
  declarationJson,
  SHARED_VALUES_KEY,
  validateDeclaration,
  type CanonPointer,
  type SharedValuesAxis,
  type ValidDeclaration,
} from './declaration.ts';
import type { RepoSnapshot } from './snapshot.ts';
import { readCanon } from './verifiers/shared-values.ts';

/**
 * 어댑터 트리오 — **셋이 한 몸이다**(어댑터가 무엇을 어느 스코프에서 읽는가). 선언 검증이
 * 이미 그 동반을 집행하므로 조립도 셋을 함께 받는다: 반쪽을 받아 반쪽 선언을 지으면,
 * 조립기가 자기 산출로 검증 실패를 만든다.
 */
export interface AdapterTrio {
  adapter: string;
  files: readonly string[];
  scope: string;
}

/**
 * 무엇을 조립하는가 — 갈래 둘. ⭐ `link` 의 트리오는 **선택**이다: 그것은 **이 저장소의**
 * 코드를 읽는 손이고(CI 축 「코드 == 박제」), 없으면 그 축만 미판정으로 남는다(폴백 선언).
 * 교차 축은 트리오 없이도 선다 — 비교의 양변이 **정본의 읽기와 박제**이기 때문이다.
 */
export type ConstitutionIntent =
  | { kind: 'canon'; axis: string; trio: AdapterTrio; self: RepoSnapshot | null; base: ValidDeclaration | null }
  | {
      kind: 'link';
      axis: string;
      canon: CanonPointer;
      trio: AdapterTrio | null;
      self: RepoSnapshot | null;
      base: ValidDeclaration | null;
    };

/**
 * ⭐⭐ **`axis` 는 「어느 헌법인가」다** — 개정 4 가 더한 칸이고, 이름은 **고객이 짓는다**:
 * 「디자인 · API · 카피」 중 무엇이 그 조직의 규율 갈래인지를 우리가 고르면 선언은 우리가
 * 상상한 조직의 것이 된다. ⛔ 기본값을 두지 않는다 — `"palette"` 든 `"default"` 든 우리가
 * 고른 이름이 저장소 N 개에 조용히 박히고, 그 이름은 고객의 말이 아니다.
 *
 * ⭐⭐ **`base` 는 「무엇에 더하는가」다.** null 이면 **새 선언**을 짓고(선언이 없거나, 이
 * 표면이 묻지 않았다), 선언이 들어오면 **그 선언에 축 하나를 더한다** — 같은 이름의 축이
 * 이미 있으면 거부한다.
 *
 * ⚠️ **이 칸이 없으면 「헌법 여럿」이 도구로는 불가능했다**: 디자인 헌법을 선언한 저장소가
 * API 헌법을 더하려면 조립은 매번 **축 하나뿐인 새 선언**을 내고, 고객은 그 둘을 손으로
 * 합쳐야 한다 — 손으로 합치는 그 행위가 이 제품이 재는 갈라짐의 생산 공정이다.
 *
 * ⛔ **깨진 선언·못 읽은 선언은 여기 오지 않는다** — 그 둘을 가르는 것은 **호출자**의 몫이고
 * (CLI 는 판정 실패로 멈추고, 화면은 전용 갈래로 보낸다), 조립은 「검증을 통과한 선언」만
 * 받는다. 타입이 `ValidDeclaration` 인 것이 그 경계의 집행이다.
 */

/**
 * ⭐⭐ **`self` 는 「이 저장소를 보았는가」다** — 생략(null)이 「트리오가 참이다」가 아니라
 * 「**묻지 않았다**」이고, 자격의 그 규율과 같은 꼴이다. 스냅샷이 들어오면 조립은 선언을
 * 믿지 않고 **읽어 본다**: 선언한 파일이 실재하는가 · 그 스코프에서 토큰이 하나라도 읽히는가.
 *
 * ⚠️ 이것이 없던 동안 `canon` 갈래는 **추측을 그대로 받았다** — 고객이 적은 트리오가 실물과
 * 어긋나도 조립은 초록이었고, 그 선언을 커밋한 뒤 **판정이** 멈췄다(「포인터와 실물이 서로
 * 다른 말을 한다」). 틀린 선언을 **쓰기 전에** 잡는 것이 조립의 몫이다.
 */

/**
 * 박제하지 **않은** 정본 토큰 하나 — 값이 해석되지 않은 자리다.
 *
 * ⭐⭐ **왜 조용히 건너뛰지 않는가.** 정본이 든 모호함(`var()` 간접 · 같은 스코프의 중복
 * 정의)은 판정이 해석하지 않고 **미판정**으로 둔다. 그 값을 그대로 박제하면 **해석되지 않은
 * 값이 기준이 되고**, 기준이 거짓이면 그 위의 모든 수가 거짓이다. ⇒ 박제하지 않고,
 * **말한다** — 말하지 않으면 그 공백은 선언의 침묵이 되고, 침묵은 시간이 지나면 반드시 틀린다.
 *
 * ⚠️ 그 토큰의 칸은 교차 축에서 **위반이 아니라 미판정**이다(비교 자체가 서지 않는다) —
 * 박제했는지와 무관하다. 그래서 이 목록은 「고치면 수가 는다」는 안내이고 빨강의 예고가 아니다.
 */
export interface UnpinnedToken {
  token: string;
  why: 'ambiguous-cascade' | 'var-indirection';
  /** `file:line` — 정본에서 그 값이 사는 자리. */
  at: string;
}

export type ComposeOutcome =
  /**
   * 조립했다. `json` 이 쓰이거나 내보내질 **바이트**다.
   *
   * ⭐ `added` 는 「있는 선언에 **더했다**」다(새 선언을 지은 것과 다르다) — 보고가 그 둘을
   * 한 문장으로 접으면 「덮어쓴 것 아닌가」라는 질문에 답하지 못한다.
   */
  | {
      kind: 'composed';
      axis: string;
      added: boolean;
      json: string;
      pinned: number;
      unpinned: readonly UnpinnedToken[];
    }
  /**
   * 조립하지 않았다 — 입력이 조립을 세우지 못한다. ⛔ 빈 선언으로 접지 않는다: 지어낸
   * 분모가 들어간 선언은 「선언했는데 집행되지 않음」의 가장 값싼 판이다.
   */
  | { kind: 'refused'; problems: readonly string[] };

const KNOWN_ADAPTERS = VALUE_ADAPTERS.map((a) => a.id);

/**
 * 트리오 하나의 검증 — ⭐ 모르는 어댑터 이름은 **아는 목록과 함께** 거부한다(선언 검증과
 * 같은 자구의 규율: 선언하지 않은 것은 미판정, 잘못 선언한 것은 판정 실패).
 */
function trioProblems(trio: AdapterTrio, at: string): string[] {
  const problems: string[] = [];
  if (!KNOWN_ADAPTERS.includes(trio.adapter)) {
    problems.push(
      `"${at}.adapter" (${JSON.stringify(trio.adapter)}) is not a known adapter (known: ${KNOWN_ADAPTERS.join(', ')})`,
    );
  }
  if (trio.files.length === 0) {
    problems.push(`"${at}.files" must name at least one file — an adapter with nothing to read reads nothing`);
  }
  // ⭐ 경로의 규칙은 **검증기가 정본**이고(`validatePathList`) 조립은 그 앞에서 같은 것을
  //    묻는다 — 묻지 않으면 조립이 검증기가 거부하는 선언을 내고 `sealed` 가 버그로 멈춘다.
  //    고객 입력이 버그 메시지를 받는 자리를 만들지 않는다.
  const seen = new Set<string>();
  trio.files.forEach((file, i) => {
    if (file.trim() === '') problems.push(`"${at}.files"[${i}] must be a non-empty string`);
    else if (file.startsWith('/') || file.startsWith('~')) {
      problems.push(`"${at}.files"[${i}] ("${file}") must be repository-relative — no absolute or home paths`);
    } else if (seen.has(file)) problems.push(`"${at}.files"[${i}] ("${file}") is declared twice`);
    seen.add(file);
  });
  if (trio.scope.trim() === '') {
    problems.push(`"${at}.scope" must be a non-empty string (e.g. ":root" or "@theme")`);
  }
  return problems;
}

/**
 * 선언한 트리오를 **이 저장소에서 읽어 본다** — 선언을 믿지 않는 probe 의 자리다.
 *
 * ⛔ 스냅샷이 없으면(묻지 않은 표면) **아무 말도 하지 않는다** — 「참이다」도 「거짓이다」도
 * 아니고, 그 표면이 보지 않은 것이다. ⚠️ 본문이 실리지 않은 파일은 **읽지 못한 것**이라
 * 거부한다: 못 읽은 것을 「토큰 0」으로도 「통과」로도 접지 않는다.
 */
function selfProblems(trio: AdapterTrio, self: RepoSnapshot | null, at: string): string[] {
  if (self === null) return [];
  const adapter = adapterById(trio.adapter);
  if (adapter === null) return []; // 모르는 어댑터는 위에서 이미 거부됐다
  const problems: string[] = [];
  const tracked = new Set(self.paths);
  const readable: { path: string; text: string }[] = [];
  for (const file of trio.files) {
    if (!tracked.has(file)) {
      problems.push(`"${at}.files" names "${file}", which this repository does not track — a declaration that points at nothing is a judgment failure, not an unjudged axis`);
      continue;
    }
    const text = self.files.get(file);
    if (typeof text !== 'string') {
      problems.push(`"${file}" is tracked but its body could not be read — a trio verified on a partial read would be optimistic by construction`);
      continue;
    }
    readable.push({ path: file, text });
  }
  if (problems.length > 0 || readable.length === 0) return problems;

  const result = adapter.read(readable);
  if (!result.ok) {
    // 파싱 실패는 「토큰 0」이 아니다 — 눈이 먼 입력이고, 그 위의 선언은 거짓이다.
    return [`"${result.file}" could not be parsed by "${trio.adapter}" — ${result.message}`];
  }
  const inScope = result.tokens.filter((token) => token.scope === trio.scope);
  if (inScope.length === 0) {
    const seen = [...new Set(result.tokens.map((token) => token.scope))].sort();
    problems.push(
      `"${at}.scope" ("${trio.scope}") reads zero values from the declared files${seen.length > 0 ? ` — the adapter sees ${seen.map((scope) => `"${scope}"`).join(', ')}` : ''}`,
    );
  }
  return problems;
}

/** 축 하나를 `AXIS_KEYS` 순으로 짓는다 — 바이트가 결정적이어야 두 입구가 같은 것을 낸다. */
function axisObject(
  trio: AdapterTrio | null,
  canon: CanonPointer | null,
  pinned: Record<string, string> | null,
): Record<string, unknown> {
  const axis: Record<string, unknown> = {};
  if (trio !== null) {
    axis.adapter = trio.adapter;
    axis.files = [...trio.files];
    axis.scope = trio.scope;
  }
  if (canon !== null) axis.canon = { repo: canon.repo, file: canon.file, scope: canon.scope };
  if (pinned !== null) axis.pinned = pinned;
  return axis;
}

/**
 * **이미 있는** 축 하나를 다시 짓는다 — 더하기가 남의 축을 건드리지 않는 자리다.
 *
 * ⚠️ 미선언(null)과 선언된 빈 값은 다르고, 여기서 섞으면 **더하기가 남의 선언을 고친다**:
 * `diverged` 를 빠뜨리면 사유를 달아 옮긴 기준이 조용히 취소되고, `pinned` 를 빠뜨리면
 * 교차 축의 한 변이 사라진다. ⇒ 선언된 것만, 선언된 모양 그대로 다시 적는다.
 */
function axisJson(declared: SharedValuesAxis): Record<string, unknown> {
  const axis = axisObject(
    declared.adapter === null ? null : { adapter: declared.adapter, files: declared.files!, scope: declared.scope! },
    declared.canon,
    declared.pinned,
  );
  if (declared.diverged !== null) axis.diverged = declared.diverged;
  return axis;
}

/**
 * 조립한 축을 **선언에 넣는다** — `base` 가 null 이면 새 선언이고, 있으면 그 선언에 축을
 * 더한다(남의 축·UI 경로·편입 기록·면제는 그대로 다시 적는다).
 *
 * ⚠️ **키 순서가 결정적이다** — 최상위는 `TOP_KEYS` 순, 축은 이름 순. 바이트가 입력의 순서에
 * 매이면 같은 선언이 같은 바이트를 내지 못하고, 그 순간 「두 입구가 같은 것을 낸다」가 우연이 된다.
 *
 * ⛔ **없던 키를 더하지 않는다** — `base` 에 편입 기록 키가 없으면 여기서도 없다. 빈 `{}` 를
 * 끼워 넣는 것은 고객이 적지 않은 선언을 우리가 적는 일이다. ⭕ 새 선언에는 그 키가 선다:
 * 「아직 아무 규칙도 편입하지 않았다」가 **참인 선언**이라서다(스캐폴드와 같은 자구).
 */
function declarationWith(
  base: ValidDeclaration | null,
  axis: string,
  built: Record<string, unknown>,
): Record<string, unknown> {
  const axes: Record<string, unknown> = {};
  for (const name of Object.keys(base?.sharedValues ?? {}).concat(axis).sort()) {
    axes[name] = name === axis ? built : axisJson(base!.sharedValues![name]!);
  }

  const declaration: Record<string, unknown> = {};
  if (base?.ui != null) declaration.ui = [...base.ui];
  declaration[SHARED_VALUES_KEY] = axes;
  if (base === null) declaration.admissions = {};
  else if (base.admissions !== null) declaration.admissions = base.admissions;
  if (base?.exemptions != null) declaration.exemptions = base.exemptions;
  return declaration;
}

/**
 * 조립한 선언을 **검증기로 통과시킨다** — ⭐⭐ 조립기와 검증기가 갈라지는 자리를 여기서
 * 닫는다. 깨진 선언을 내는 조립은 미판정이 아니라 **버그**라서 요란하게 멈춘다: 조용히
 * 내보내면 고객이 그것을 커밋하고, 그 커밋의 판정 실패를 고객이 받는다.
 *
 * @throws Error 조립이 깨진 선언을 냈을 때 — 이 저장소의 버그다.
 */
function sealed(declaration: Record<string, unknown>): string {
  const json = declarationJson(declaration);
  const validated = validateDeclaration(json);
  if (validated.state !== 'valid') {
    const problems = validated.state === 'invalid' ? validated.problems.join('; ') : validated.state;
    throw new Error(`composed a declaration the validator rejects — this is a bug in the composer: ${problems}`);
  }
  return json;
}

/**
 * 조립 — **순수 함수다.** 정본을 읽는 것은 I/O 가 아니라 스냅샷에서 꺼내는 것이고
 * (`peers`), 그 스냅샷을 만드는 손은 호스트다(판정과 같은 경계).
 *
 * @param peers 같은 잡이 함께 본 체크아웃들. `link` 가 정본을 **이 목록에서** 찾는다 —
 *              ⛔ 비슷한 이름으로 맞히지 않는다(교차 축과 같은 규율: 추측으로 고른 정본의
 *              박제는 틀릴 수 있고, 틀린 기준은 없는 기준보다 나쁘다).
 * @throws DeclarationInvalidError 정본 포인터와 실재가 어긋날 때 · 정본 저장소의 선언이
 *         깨졌을 때 — 판정과 **같은 손**(`readCanon`)이 같은 자리에서 멈춘다.
 * @throws AdapterParseError 정본 저장소의 어댑터가 그 파일을 읽지 못할 때.
 */
export function composeConstitution(
  intent: ConstitutionIntent,
  peers: readonly RepoSnapshot[] = [],
): ComposeOutcome {
  const at = `${SHARED_VALUES_KEY}.${intent.axis}`;
  // ⭐ 이름과 **자리**를 먼저 묻는다 — 뒤의 어느 검사도 「이 축을 적을 수 있는가」를 묻지
  //   않으므로, 여기서 빠지면 조립이 쓸 수 없는 선언을 짓거나 남의 축을 덮어쓴다.
  const named = axisNameProblem(intent.axis);
  if (named !== null) {
    return { kind: 'refused', problems: [`axis ${JSON.stringify(intent.axis)} is not usable — ${named}`] };
  }
  if (intent.base !== null && intent.axis in (intent.base.sharedValues ?? {})) {
    // ⛔ 덮어쓰지 않는다 — 더하기는 **없던 축을 더하는** 행위이고, 있는 축을 다시 짓는 것은
    //    고객이 적은 박제·갈라짐 선언을 지우는 일이다(`init` 이 덮어쓰기를 기각한 그 사유).
    return {
      kind: 'refused',
      problems: [
        `"${at}" is already declared — composing it again would overwrite the pins and the declared divergences that live there`,
        'name another axis, or edit that one by hand (a merge would be a guess about which side is the canon)',
      ],
    };
  }

  if (intent.kind === 'canon') {
    const problems = [
      ...trioProblems(intent.trio, at),
      ...selfProblems(intent.trio, intent.self, at),
    ];
    if (problems.length > 0) return { kind: 'refused', problems };
    // ⭐ `pinned`·`canon` 이 **없는** 것이 이 선언의 내용이다 — 자기가 정본이면 박제하지
    //    않는다. 교차 축은 그 자리에서 「미선언 = 미판정」으로 남고, 그것이 참이다.
    return {
      kind: 'composed',
      axis: intent.axis,
      added: intent.base !== null,
      json: sealed(declarationWith(intent.base, intent.axis, axisObject(intent.trio, null, null))),
      pinned: 0,
      unpinned: [],
    };
  }

  const problems =
    intent.trio === null
      ? []
      : [...trioProblems(intent.trio, at), ...selfProblems(intent.trio, intent.self, at)];
  for (const [key, value] of Object.entries(intent.canon)) {
    if (value.trim() === '') problems.push(`"${at}.canon.${key}" must be a non-empty string`);
  }
  if (problems.length > 0) return { kind: 'refused', problems };

  const peer = peers.find((p) => p.repo === intent.canon.repo) ?? null;
  if (peer === null) {
    // ⛔ 빈 박제를 쓰지 않는다 — 박제 없는 `canon` 은 검증이 받지만(포인터만 선 선언),
    //    그것은 「연결했다」가 아니라 **연결의 절반**이고 교차 축은 그대로 미판정이다.
    //    조립이 절반을 내면 고객은 연결된 줄 알고 그 미판정을 영원히 본다.
    return {
      kind: 'refused',
      problems: [
        `the canon "${intent.canon.repo}" is not in this job's sight — pass its checkout too (one job, N checkouts)`,
        `a pin read from nowhere would be invented: this refuses instead of writing an empty "${at}.pinned"`,
      ],
    };
  }

  const read = readCanon(peer, intent.canon, at);
  if (read.state === 'unjudged') {
    // ⭐ 판정에서 **미판정**인 상태가 조립에서는 **거부**다 — 판정은 모르는 것을 모른다고
    //    적고 끝내지만, 조립은 그 위에 기준을 **짓는** 행위라서 모르는 채로는 설 수 없다.
    return {
      kind: 'refused',
      problems: [
        read.reason === 'no-adapter'
          ? `the canon "${intent.canon.repo}" does not declare how its own shared values are read (no "${SHARED_VALUES_KEY}" axis names an adapter) — reading someone else's file with our adapter is a guess`
          : `the canon "${intent.canon.repo}" could not be read in full (${read.reason}) — a pin on a partial read is optimistic by construction`,
      ],
    };
  }

  const byName = new Map<string, typeof read.tokens>();
  for (const token of read.tokens) {
    const list = byName.get(token.name);
    if (list) list.push(token);
    else byName.set(token.name, [token]);
  }

  const pinned: Record<string, string> = {};
  const unpinned: UnpinnedToken[] = [];
  // 이름 순 — 바이트가 읽은 순서에 매이면 같은 정본이 파일 순서만 바뀌어도 다른 선언을 낸다.
  for (const name of [...byName.keys()].sort()) {
    const reads = byName.get(name)!;
    const first = reads[0]!;
    const at = `${first.file}:${first.line}`;
    // ⚠️ 판정이 해석하지 않는 둘을 조립도 해석하지 않는다 — 같은 규칙이 두 곳에 **있는**
    //    것이 아니라, 같은 사실(「이 값은 미판정이다」)에 두 모듈이 각자의 행동을 고른다.
    if (reads.length > 1) {
      unpinned.push({ token: name, why: 'ambiguous-cascade', at });
      continue;
    }
    if (first.value.startsWith('var(')) {
      unpinned.push({ token: name, why: 'var-indirection', at });
      continue;
    }
    pinned[name] = first.value;
  }

  const count = Object.keys(pinned).length;
  if (count === 0) {
    // 빈 박제는 검증이 이미 거부한다(「공유값이 없으면 키를 빼는 것이 그 선언이다」) —
    // 조립이 그 앞에서 멈추고 **왜** 0 인지를 말한다.
    return {
      kind: 'refused',
      problems: [
        `the canon "${intent.canon.repo}" / "${intent.canon.file}" reads no value this composer can pin (${unpinned.length} unresolved)`,
        `an empty "${at}.pinned" is a gap in the declaration, not a pin of zero shared values`,
      ],
    };
  }

  return {
    kind: 'composed',
    axis: intent.axis,
    added: intent.base !== null,
    json: sealed(declarationWith(intent.base, intent.axis, axisObject(intent.trio, intent.canon, pinned))),
    pinned: count,
    unpinned,
  };
}

/** 박제하지 않은 사유의 **문면** — 코드는 기계가, 문장은 보고가 든다. */
const WHY: Readonly<Record<UnpinnedToken['why'], string>> = {
  'ambiguous-cascade': '같은 스코프에 두 번 이상 정의됐다',
  'var-indirection': 'var() 간접 참조라 값이 해석되지 않는다',
};

/**
 * 말하는 것 — **조립한 것 · 쓴 것 · 쓰지 않은 것 · 박제하지 않은 것.** 보고 표면과 같은
 * 규율이다: 상태를 숨기지 않고, 대안 경로를 함께 말한다.
 *
 * ⭐ 선언이 이미 있는 갈래에서 조립한 선언이 **stdout 으로** 나간다 — 쓰지 않았다는 사실은
 * stderr 가 말하고, 고객이 손으로 옮길 바이트는 파이프로 받을 수 있어야 한다.
 */
export function formatCompose(
  intent: ConstitutionIntent['kind'],
  composed: Extract<ComposeOutcome, { kind: 'composed' }>,
  write: { kind: 'written' | 'already-declared' | 'write-failed'; path: string; message?: string },
): { stdout: string[]; stderr: string[] } {
  const axisLine = `   축 「${composed.axis}」 — 이 선언 안에서 그 이름이 곧 체크 id 의 뒷칸이다(\`<판정기>:${composed.axis}\`).`;
  const pinnedLine =
    intent === 'canon'
      ? '   이 저장소가 **정본**이다 — 박제하지 않았다(자기 값을 자기에게 박제하는 자리는 없다).'
      : `   박제 ${composed.pinned} 건을 **정본에서 읽어** 적었다 — 손으로 옮긴 값이 0 이다.`;
  const unpinnedLines =
    composed.unpinned.length === 0
      ? []
      : [
          `   ⚠️ 박제하지 않은 정본 토큰 ${composed.unpinned.length} 건 — 값이 해석되지 않아 기준이 될 수 없다:`,
          ...composed.unpinned.map((u) => `     · ${u.token} (${u.at}) — ${WHY[u.why]}`),
          '      그 칸은 교차 축에서 **미판정**이다(위반이 아니다) — 정본에서 모호함을 풀면 수가 는다.',
        ];

  switch (write.kind) {
    case 'written':
      return {
        stdout: [
          `✅ ${write.path} 을 썼다.`,
          axisLine,
          pinnedLine,
          ...unpinnedLines,
          '   편입 기록은 비어 있다 — 「아직 아무 규칙도 편입하지 않았다」는 참인 선언이고, 그 칸은 전부 미판정이다.',
          '   ⛔ 커밋하지도 스테이징하지도 않았다 — 이 명령은 git 을 건드리지 않는다.',
          '   ⚠️ 판정의 표본은 git 이 추적하는 파일이다 — 이 파일을 저장소에 넣기 전까지 판정은 「선언 없음」으로 미판정이다.',
        ],
        stderr: [],
      };
    case 'already-declared':
      return {
        // ⭐ 조립한 바이트가 stdout 이다 — 쓰지 못한 것을 말하면서 **옮길 것은 주는** 자리다.
        stdout: [composed.json.trimEnd()],
        stderr: [
          `❌ 선언이 이미 있다 — 덮어쓰지 않았다: ${write.path}`,
          // ⭐⭐ **더한 것과 지은 것을 가른다.** `added` 면 stdout 의 바이트는 **당신의 선언
          //   전부 + 축 하나**다 — 「옮길 칸을 손으로 고르라」가 더는 참이 아니고(고를 것이
          //   없다), 그 한 문장을 남겨 두면 고객은 자기 선언을 두 번 합친다.
          composed.added
            ? `   그래서 stdout 은 **당신의 선언에 축 하나를 더한 전문**이다 — 그 파일을 이것으로 바꾸면 된다(다른 칸은 선언된 모양 그대로 다시 적혔다).`
            : '   병합도 보존도 추측이다 — 조립한 선언을 stdout 으로 냈으니, 옮길 칸을 손으로 고르는 것은 당신이다.',
          axisLine,
          pinnedLine,
          ...unpinnedLines,
        ],
      };
    case 'write-failed':
      return {
        stdout: [],
        stderr: [
          `❌ ${write.path} 을 쓰지 못했다: ${write.message ?? ''}`,
          '   쓰지 못한 것을 썼다고 말하지 않는다.',
        ],
      };
  }
}

/** 조립이 서지 않았을 때의 말 — ⛔ 조용한 빈 선언으로 접지 않는다. */
export const formatRefusal = (refused: Extract<ComposeOutcome, { kind: 'refused' }>): string[] => [
  '❌ 조립하지 않았다 — 지어낸 분모가 든 선언을 쓰지 않는다:',
  ...refused.problems.map((p) => `   - ${p}`),
];
