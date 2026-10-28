/**
 * 「선언이 무엇을 분모로 세웠는가」 — `graduand rules` 가 내는 것.
 *
 * ⭐⭐ **왜 판정 보고로 부족한가.** 판정은 **수**를 낸다(관할 N — 위반 k · 통과 p · 미판정 m).
 * 그 수를 읽는 사람도 에이전트도 그다음에 묻는 것은 늘 같다 — 「그 분모는 **무엇이고 어디서
 * 왔는가**」. 편입된 규칙의 이름, 그 규칙이 고른 판정기, 그리고 개정 4 가 만든 **축마다의
 * 정본 주소**가 그 답이고, 판정 보고에는 그 주소가 없다(판정은 정본을 **읽고** 비교하지만
 * 어디서 읽었는지를 적지 않는다). ⇒ 묻는 자리를 따로 둔다.
 *
 * 규율 넷 — 이 모듈이 **하지 않는** 것이 그 전부다:
 *
 * ⛔ **판정하지 않는다.** 그 자리는 기본 명령이다. 그래서 이 모듈의 산출에 `pass`·`violation`
 *    이 없다: 상태는 **판정의** 산출이고 분모는 **선언의** 산출이다. 둘을 한 화면에 섞으면
 *    「선언했다」와 「통과했다」가 같은 줄에서 읽히고, 그 혼동이 이 제품이 파는 결함이다.
 *
 * ⛔ **세는 손을 하나 더 만들지 않는다.** 행·열·칸은 `grid.ts` 가 읽고 세며
 *    (`admissionShape` · `cellCount`), 축과 면제는 `declaration.ts` 가 읽는다
 *    (`declarationOf`). 이 모듈에 `Object.entries(…)` 로 선언을 다시 뜯는 자리가 **없다** —
 *    사본이 생기는 순간 두 손이 갈라지고, 갈라진 사본은 둘 다 자기 기준으로는 옳다.
 *
 * ⛔ **시계가 없다.** 면제의 만기는 **날짜**로 적지만 「넘겼는가」는 적지 않는다. 적으면 같은
 *    선언이 날마다 다른 바이트를 내고, 그러면 ⑴ 에이전트가 이 산출을 diff 로 쥘 수 없고
 *    ⑵ 「넘김」을 판정하는 손이 둘이 된다. 그 손은 봉투 하나다(`expiry.ts` — `measuredAt`
 *    기준 · UTC 절단 · 당일은 넘긴 것이 아니다). ⇒ 여기 적히는 날짜는 **선언의 사실**이고,
 *    그 날짜가 지났는지는 판정의 보고가 말한다.
 *
 * ⛔ **빨강을 내지 않는다.** 종료 코드는 0 아니면 2(판정 실패 — 선언이 깨졌다)다. 1 은 쓰지
 *    않는다: 그 자리는 「위반 ≥ 1 또는 넘긴 만기 ≥ 1」의 몫이고, 분모를 **묻는** 행위는
 *    무엇도 위반하지 않는다. ⭕ 선언이 **없어도** 0 이다 — 「분모가 선언되지 않았다」는
 *    사유와 함께 보고되는 미판정이고, 미판정은 빨강이 아니다.
 */

import { admissionShape, cellCount, type ShapeRule } from './grid.ts';
import { canonicalJson } from './canonical.ts';
import { declarationOf, SHARED_VALUES_KEY, type CanonPointer } from './declaration.ts';
import { SCHEMA_VERSION, SchemaParseError, VersionMismatchError, type ReasonCode } from './schema.ts';
import type { RepoSnapshot } from './snapshot.ts';

/**
 * 공유값 축 하나가 **선언한 것** — 「어느 헌법이고, 그 정본은 어디이며, 무엇을 읽는가」.
 *
 * ⛔ 토큰의 **값**은 싣지 않는다 — 수만 싣는다. 공유값 증거가 좌표(토큰 · 파일 · 행 · 사유)
 * 뿐인 그 규율과 같은 자리다: 고객 파일의 값은 어느 보고 표면으로도 나가지 않는다.
 */
export interface AxisRules {
  axis: string;
  /**
   * 그 축의 정본 주소. ⭕ **null 이 「이 저장소가 정본이다」다** — 주소를 적지 않은 축은
   * 자기가 정본인 축이고(`canon` 은 가리키는 자리다), 그 사실은 부재로 말해진다.
   */
  canon: CanonPointer | null;
  /** 어댑터 트리오 — 비교의 **왼변**. null = 미선언이면 그 축의 CI 축은 `no-adapter` 다. */
  adapter: string | null;
  files: string[];
  scope: string | null;
  /** 박제한 토큰 **수**. null = `pinned` 키 미선언(기준이 없어 그 축은 미판정이다). */
  pinned: number | null;
  /** 사유를 달아 「정본은 여기다」를 선언한 토큰 **수**. null = 키 미선언. */
  diverged: number | null;
}

/** 선언 파일의 상태 셋 — 「없다」와 「있는데 분모가 비었다」는 **다른 사실**이다. */
export type DeclarationPresence = 'absent' | 'unreadable' | 'declared';

/** 한 체크아웃의 분모 전부. ⛔ 상태도 수(3상태)도 없다 — 그 자리는 판정의 몫이다. */
export interface RulesView {
  /** `owner/name`. 대상에서 읽지 못했으면 null — 추정으로 채우지 않는다. */
  repo: string | null;
  commit: string;
  presence: DeclarationPresence;
  /** 열 — 선언된 UI 표면. */
  surfaces: string[];
  /** 행 — 규칙 id 코드유닛 순(편입과 면제가 같은 목록에 산다 — 분모는 줄지 않는다). */
  rules: ShapeRule[];
  /** 축 이름 순. 선언이 축을 들지 않으면 빈 목록이다. */
  axes: AxisRules[];
  /** 칸 = 행 × 열. 세는 손은 `cellCount` 하나다. */
  cells: number;
  /** 칸이 0 일 때의 사유. 칸이 있으면 null — 「빈 분모는 미판정이다」가 이 필드다. */
  reason: ReasonCode | null;
}

/**
 * 스냅샷에서 분모를 읽는다 — **읽는 손은 둘 다 남의 것이다**(`admissionShape` ·
 * `declarationOf`). 이 함수가 하는 일은 그 둘을 한 봉투에 담는 것뿐이다.
 *
 * @throws DeclarationInvalidError 선언이 깨졌을 때 — 깨진 선언 위에서 분모를 내지 않는다.
 *   조용히 빈 분모를 내면 「아무것도 편입하지 않았다」와 「오타 하나로 전부 못 읽었다」가
 *   같은 화면이 되고, 둘째는 요란하게 멈춰야 하는 자리다.
 */
export function readRules(snapshot: RepoSnapshot): RulesView {
  const shape = admissionShape(snapshot);
  const declaration = declarationOf(snapshot);
  const presence: DeclarationPresence =
    declaration === 'unreadable' ? 'unreadable' : declaration.state === 'absent' ? 'absent' : 'declared';
  const declared = declaration !== 'unreadable' && declaration.state === 'valid' ? declaration.sharedValues : null;
  const axes: AxisRules[] = Object.entries(declared ?? {})
    .map(([axis, read]) => ({
      axis,
      canon: read.canon,
      adapter: read.adapter,
      files: [...(read.files ?? [])],
      scope: read.scope,
      // 수를 세는 자리이지 값을 읽는 자리가 아니다 — 키 부재(null)와 「0 개」는 다른 사실이다.
      pinned: read.pinned === null ? null : Object.keys(read.pinned).length,
      diverged: read.diverged === null ? null : Object.keys(read.diverged).length,
    }))
    .sort((a, b) => (a.axis < b.axis ? -1 : a.axis > b.axis ? 1 : 0));
  return {
    repo: snapshot.repo,
    commit: snapshot.commit,
    presence,
    surfaces: shape.surfaces,
    rules: shape.rules,
    axes,
    cells: cellCount(shape),
    reason: shape.reason,
  };
}

/** 선언의 상태를 말하는 한 줄 — 「없다」와 「못 읽었다」와 「있다」는 요구하는 행동이 다르다. */
function presenceLine(view: RulesView): string {
  switch (view.presence) {
    case 'absent':
      return '  declaration: absent — the denominator is not declared, which is unjudged, not "0 violations"';
    case 'unreadable':
      return '  declaration: tracked but unreadable — a truncated read, not an absent file; no numbers stand on it';
    case 'declared':
      return '  declaration: declared';
  }
}

/**
 * 축 하나의 줄들 — 정본 주소가 **한 줄로** 선다. ⭐ 그 한 줄이 이 명령의 요점이다: 개정 4 가
 * 만든 「한 저장소가 헌법 여럿에 답한다」는 선언 안에만 있었고, 사람이 그것을 보는 자리가
 * 없었다.
 */
function describeAxis(axis: AxisRules): string[] {
  const canon =
    axis.canon === null
      ? 'canon: this repository (no pointer declared)'
      : `canon: ${axis.canon.repo} · ${axis.canon.file} · ${axis.canon.scope}`;
  const lines = [`    ${axis.axis} — ${canon}`];
  lines.push(
    axis.adapter === null
      ? '      reads: no adapter declared — the left-hand side of the comparison is missing (unjudged: no-adapter)'
      : `      reads: ${axis.adapter} · ${axis.scope ?? '(no scope)'} · ${axis.files.join(' · ')}`,
  );
  // 키 부재와 「0 개」를 가른다 — 앞은 기준이 없는 것이고 뒤는 기준이 빈 것이다.
  const count = (n: number | null): string => (n === null ? 'not declared' : `${n}`);
  lines.push(`      pinned: ${count(axis.pinned)} · declared divergences: ${count(axis.diverged)}`);
  return lines;
}

/**
 * 분모를 말하는 줄들 — 판정 보고(`formatReport`)와 **같은 영문 자구**를 쓴다: 둘은 같은 급의
 * 보고 표면이고, 하나는 수를 하나는 분모를 낸다. (선언을 **쓰는** 하위 명령들이 한국어인
 * 것과 가르는 축이 그것이다 — 그쪽은 행위의 결과를 말하고 이쪽은 보고다.)
 */
export function formatRules(views: readonly RulesView[]): string {
  const sections = views.map((view) => {
    const lines = [
      'graduand — declared denominator',
      `  repo:   ${view.repo ?? '(no remote found — unknown)'}`,
      `  commit: ${view.commit}`,
      presenceLine(view),
      '',
    ];
    lines.push(`  surfaces ${view.surfaces.length}${view.surfaces.length === 0 ? '' : ` — ${view.surfaces.join(' · ')}`}`);
    if (view.reason === null) {
      lines.push(`  jurisdiction ${view.cells} cells   (rules ${view.rules.length} × surfaces ${view.surfaces.length})`);
    } else {
      lines.push(
        `  jurisdiction 0 cells (${view.reason})   (rules ${view.rules.length} × surfaces ${view.surfaces.length})`,
        '  an empty denominator is a declaration, not a defect — 0 admissions is a legitimate state, and it is not red',
      );
    }
    lines.push('', `  rules ${view.rules.length}`);
    for (const rule of view.rules) {
      if (rule.exemption === null) {
        const chose = rule.verifiers.length > 0 ? rule.verifiers.join(' · ') : 'none declared';
        lines.push(`    ${rule.rule}: verifiers: ${chose}`);
      } else {
        // 만기는 **날짜**로 적는다 — 「넘겼는가」는 봉투가 말한다(이 명령에 시계가 없다).
        lines.push(`    ${rule.rule}: exempt until ${rule.exemption.expires} — ${rule.exemption.reason}`);
      }
    }
    lines.push('', `  ${SHARED_VALUES_KEY} axes ${view.axes.length}`);
    for (const axis of view.axes) lines.push(...describeAxis(axis));
    // ⛔ 상태가 없다는 사실을 **적는다** — 적지 않으면 「위반 0 인 보고」로 읽힌다. 이 제품이
    //    파는 구분(미판정은 통과가 아니다)을 이 명령 자신에 적용하는 자리다.
    lines.push(
      '',
      '  this command declares the denominator — it does not judge: no pass, no violation, no exit 1',
      '  run `graduand` for the numbers, which is the only surface that may be red',
    );
    return lines.join('\n');
  });
  return sections.join('\n\n');
}

/**
 * `--json` 의 바이트 — canonical 직렬화이고 **시계가 없으므로 같은 선언에서 같은 바이트**다.
 *
 * ⭐ `v` 는 **판정 스키마의 그 축**이다(`SCHEMA_VERSION`). 축을 새로 만들지 않는 이유는
 * 이 문서가 묘사하는 것이 바로 **선언의 어휘**라서다 — 선언의 모양이 움직이면(개정 4 가
 * `palette` 를 `shared-values.<축>` 으로 옮긴 그 움직임) 이 산출의 모양도 **함께** 움직인다.
 * 두 축을 두면 그 동반이 선언이 아니라 우연이 되고, 어느 쪽을 올려야 하는지가 매번 판단이 된다.
 */
export const serializeRules = (views: readonly RulesView[]): string =>
  views.map((view) => canonicalJson({ v: SCHEMA_VERSION, ...view })).join('\n');

/**
 * 받는 쪽 — ⚠️ **모르는 `v` 는 던진다.** 읽는 코드가 없으면 `v` 는 장식이고, 장식이 된
 * 버전은 다음 개정에서 **조용히** 오해된다(개정 3 의 요약을 개정 4 가 읽으면 등록부에
 * 없는 판정기 이름이 화면에 서던 그 자리와 같다).
 *
 * ⛔ 수를 다시 세지 않는다 — 「이 바이트가 분모를 자처하는가」만 본다. 「그 수가 맞는가」는
 * **같은 선언에서 다시 읽어** 물어야 하고, 산출만 받은 쪽에는 그 선언이 없다.
 */
export function parseRules(text: string): unknown {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new SchemaParseError(`rules: invalid JSON — ${(e as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SchemaParseError('rules: not an object');
  }
  const v = (raw as Record<string, unknown>).v;
  // 버전을 가장 먼저 본다 — 모르는 v 의 본문을 구조로 판정하는 것 자체가 월권이다.
  if (typeof v !== 'number' || v !== SCHEMA_VERSION) throw new VersionMismatchError('schema', String(v));
  return raw;
}
