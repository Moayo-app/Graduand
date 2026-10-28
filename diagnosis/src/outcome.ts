/**
 * 진단 오케스트레이션 — 입력 하나에서 Outcome 하나로.
 *
 * 네트워크는 판정기 모듈의 GitHub 로더 하나다: 이 파일은 fetch 를 **만들지 않고**
 * 주입만 한다(기본은 로더가 쥔 전역 fetch — 로더가 가는 호스트는 api.github.com
 * 하나다). 「미판정 ≠ 위반 0」의 화면 쪽 절반이 여기 선다: 읽을 수 없음·한도·버전
 * 불일치·손상은 보고서로 접히지 않고 각자의 kind 로 돌아온다.
 */

import {
  admissionGrid,
  candidateFiles,
  composeConstitution,
  DECLARATION_FILE,
  decodeFragment,
  declaredCanons,
  judgeSnapshot,
  loadGithubSnapshot,
  readUndeclared,
  validateDeclaration,
  scopesIn,
  DeclarationInvalidError,
  FragmentIntegrityError,
  RateLimitedError,
  RepoUnreadableError,
  SchemaParseError,
  VersionMismatchError,
  VERIFIER,
  type AdmissionGrid,
  type ComposeOutcome,
  type ConstitutionIntent,
  type Entitlement,
  type Measurement,
  type CanonPointer,
  type RepoSnapshot,
  type ScopeProbe,
  type ValidDeclaration,
} from '../../verifier/src/index.ts';
import type { RepoRef } from './github-url.ts';
import type { ReportOrigin } from './report.ts';

export type Outcome =
  /**
   * 보고서 하나. `entitlement` 는 **이 표면이 본 자격**이고 생략은 「보지 않았다」다 —
   * 판정의 인자와 **같은 값**이라 보고가 말하는 자격과 수를 막은 자격이 갈라질 수 없다.
   * ⚠️ fragment 로 들어온 측정에는 없다: 봉투에 실리는 것이 아니라 **묻는 표면**의 것이다.
   */
  | {
      kind: 'report';
      origin: ReportOrigin;
      measurement: Measurement;
      entitlement?: Entitlement;
    }
  | { kind: 'unreadable'; code: 'private-or-missing' | 'tree-truncated' }
  | { kind: 'rate-limited'; resetAt: number | null }
  | { kind: 'version-mismatch'; axis: 'schema' | 'fragment'; found: string }
  | { kind: 'fragment-unreadable'; message: string }
  | { kind: 'declaration-invalid'; problems: string[] }
  | { kind: 'error'; message: string };

/**
 * 판정 불가 상태 각각의 안정된 사유 코드 — 위 갈래에서 report 를 뺀 것을 평평하게
 * 접은 것이다. `unreadable` 은 코드 둘을 그대로 펴므로 갈래 여섯에 사유 일곱이다.
 *
 * ⚠️ 판정기 모듈의 미판정 사유(`no-verifier` 따위)와 **다른 어휘다** — 그쪽은 체크
 * 하나가 수를 내지 못한 이유이고, 이쪽은 진단 자체가 돌지 못한 이유다. 합치지 않는다.
 */
export const UNJUDGEABLE_REASONS = [
  'private-or-missing',
  'tree-truncated',
  'rate-limited',
  'version-mismatch',
  'fragment-unreadable',
  'declaration-invalid',
  'error',
] as const;
export type UnjudgeableReason = (typeof UNJUDGEABLE_REASONS)[number];

/** 보고서로 서지 못한 결과 — 전용 화면이 붙는 갈래 전부. */
export type Unjudgeable = Exclude<Outcome, { kind: 'report' }>;

/** 상태 → 사유 코드. 갈래(와 `unreadable` 의 code)만 접는다 — 메시지·문제 목록은 화면이 쓴다. */
export function reasonOf(outcome: Unjudgeable): UnjudgeableReason {
  switch (outcome.kind) {
    case 'unreadable':
      return outcome.code;
    case 'rate-limited':
      return 'rate-limited';
    case 'version-mismatch':
      return 'version-mismatch';
    case 'fragment-unreadable':
      return 'fragment-unreadable';
    case 'declaration-invalid':
      return 'declaration-invalid';
    case 'error':
      return 'error';
  }
}

export interface DiagnoseOptions {
  /** 테스트가 주입한다. 기본은 전역 fetch — 로더가 쓴다. */
  fetch?: typeof fetch;
  /** 측정 시각 — 테스트가 고정할 수 있게 주입 가능. */
  now?: () => Date;
  /**
   * 자격 — **판정의 인자**이고, 묻는 손은 이 파일이 아니다(판정기 모듈의 호스트가 묻는다:
   * 주입된 네트워크 하나). 여기서는 `now?.()` 와 **같은 꼴로** 받아 그대로 싣는다.
   *
   * ⚠️ 생략은 「이 표면은 자격을 보지 않았다」다 — 「자격 있다」가 아니다. 무료 진단은
   * 자격을 묻지 않으므로 생략이 그 표면의 참이고, 같은 인자를 실으면 CI 와 이 페이지의
   * 판정은 canonical 직렬화까지 바이트 동일하다(시야와 자격이 같을 때다).
   */
  entitlement?: Entitlement;
}

export async function diagnoseUrl(target: RepoRef, options: DiagnoseOptions = {}): Promise<Outcome> {
  try {
    const load = await loadGithubSnapshot({ repo: target.repo, ref: target.ref, fetch: options.fetch });
    // ⭐⭐ **선언이 가리킨 정본까지 읽는다** — 교차 축(「박제 == 정본」)은 저장소 전부가 보이는
    //   표면만 질 수 있고, 여기서 「전부」는 **이 저장소 + 그 선언이 지목한 정본**이다. 지목이
    //   없으면 시야가 비고 그 축은 미판정으로 남는다 — ⛔ 비는 것이 「위반 0」이 아니다.
    // ⛔ 정본을 **우리가 고르지 않는다**: 주소는 고객 선언이 들고, 가리키지 않은 저장소는
    //   읽지도 않는다(추측으로 읽으면 그 요청은 고객이 묻지 않은 것이다).
    // ⭐⭐ 지목이 **축마다 하나**라 시야도 목록이다(개정 4) — 디자인 정본과 API 정본이 다른
    //   상류에 사는 조직이 평상시이고, 첫 하나만 따라가면 나머지 축은 「정본이 시야에 없다」로
    //   영원히 미판정이 된다. ⛔ 저장소마다 **한 번만** 읽는다: 같은 상류를 두 축이 가리키면
    //   요청도 하나다(고객이 묻지 않은 요청을 우리가 늘리지 않는다).
    const wanted = new Map<string, Set<string>>();
    for (const { canon } of declaredCanons(declarationText(load.snapshot))) {
      const files = wanted.get(canon.repo) ?? new Set<string>();
      files.add(canon.file);
      wanted.set(canon.repo, files);
    }
    const peers: RepoSnapshot[] = [];
    for (const repo of [...wanted.keys()].sort()) {
      const peer = await loadGithubSnapshot({
        repo,
        fetch: options.fetch,
        alsoContent: [...wanted.get(repo)!].sort(),
      });
      peers.push(peer.snapshot);
    }
    const judgment = judgeSnapshot(load.snapshot, { peers, entitlement: options.entitlement });
    const measurement: Measurement = {
      judgment,
      source: load.source,
      measuredAt: (options.now?.() ?? new Date()).toISOString(),
      verifier: { name: VERIFIER.name, version: VERIFIER.version },
      dirty: load.dirty,
      // ⭐ 저장소를 읽은 표면이라 **격자를 센다** — 선언 바이트와 판정 결과를 둘 다 쥐었다.
      //   그리고 봉투가 그것을 나르므로, 요약으로 받은 쪽도 같은 수를 그린다.
      grid: admissionGrid(load.snapshot, judgment.checks),
      // ⭐ 선언 0 에서도 보이는 사실 — ⛔ 판정이 아니다. 무료 진단의 방문자 대부분이 선언
      //   없는 저장소를 넣으므로, 이 칸이 비면 그 화면은 네 칸 중 하나만 재어진 보고서다.
      undeclared: readUndeclared(load.snapshot),
      // 이 측정이 함께 본 저장소 — 이름뿐이고, 남의 저장소 내용은 어느 칸으로도 나가지 않는다.
      peers: peers.map((p) => p.repo).filter((repo): repo is string => repo !== null).sort(),
    };
    return { kind: 'report', origin: 'url', measurement, entitlement: options.entitlement };
  } catch (error) {
    return mapError(error);
  }
}

/** 스냅샷이 든 선언의 본문 — 추적되는데 못 읽은 것과 부재를 섞지 않는다(둘 다 null 이 아니다). */
const declarationText = (snapshot: RepoSnapshot): string | null => {
  const text = snapshot.files.get(DECLARATION_FILE);
  return typeof text === 'string' ? text : null;
};

/**
 * 탐색 — 조립이 **고를 수 있는 것**을 저장소에서 꺼낸다. 걸음이 둘이고 **비용이 다르다**:
 * 경로는 스냅샷의 목록에 이미 있고(한 번 읽으면 공짜), 스코프는 그 파일의 본문을 읽어야 안다.
 *
 * ⭐⭐ **왜 읽어서 고르게 하는가** — 트리오를 손으로 적게 두면 고객은 세 번 추측하고(어느
 * 파일인지 · 스코프의 자구 · 거기서 값이 읽히는지), 틀린 선언은 **판정을 멈춘다**. 추측을
 * 없애는 길은 하나다: 저장소를 읽어 **고르게** 한다.
 */
export type RepoRead =
  | {
      kind: 'repo';
      snapshot: RepoSnapshot;
      files: string[];
      /**
       * 그 저장소가 **이미 든 선언** — 조립이 축을 더할 자리다(없으면 null). ⭐ 이것이 없던
       * 동안 조립은 매번 **축 하나뿐인 새 선언**을 냈고, 디자인 헌법을 선언한 저장소가 API
       * 헌법을 더하려면 고객이 두 선언을 손으로 합쳐야 했다 — 손으로 합치는 그 행위가 이
       * 제품이 재는 갈라짐의 생산 공정이다.
       */
      base: ValidDeclaration | null;
    }
  | Unjudgeable;

export async function readRepo(
  target: RepoRef,
  adapterId: string,
  options: DiagnoseOptions = {},
): Promise<RepoRead> {
  try {
    const load = await loadGithubSnapshot({ repo: target.repo, ref: target.ref, fetch: options.fetch });
    const declared = validateDeclaration(declarationText(load.snapshot));
    if (declared.state === 'invalid') {
      // ⛔ 깨진 선언 위에 조립하지 않는다 — 전용 갈래가 **무엇이 깨졌는지**를 말한다.
      //   판정이 같은 자리에서 요란하게 멈추는 그 규율이고, 조립은 그보다 느슨할 수 없다.
      return { kind: 'declaration-invalid', problems: declared.problems };
    }
    // ⛔ 꼴을 화면이 고르지 않는다 — 어댑터가 자기가 읽는 꼴을 말한다(사본이 생기지 않는다).
    return {
      kind: 'repo',
      snapshot: load.snapshot,
      files: candidateFiles(load.snapshot, adapterId),
      base: declared.state === 'valid' ? declared : null,
    };
  } catch (error) {
    return mapError(error);
  }
}

export type ScopeRead = { kind: 'scopes'; snapshot: RepoSnapshot; probe: ScopeProbe } | Unjudgeable;

/**
 * 그 파일에서 어댑터가 본 스코프들 — ⚠️ 본문을 실어야 하므로 **한 번 더 읽는다**. 지목이
 * 선언에 아직 없으므로(그 선언을 짓는 중이다) 로더가 그것을 인자로 받는다.
 */
export async function readScopes(
  target: RepoRef,
  file: string,
  adapterId: string,
  options: DiagnoseOptions = {},
): Promise<ScopeRead> {
  try {
    const load = await loadGithubSnapshot({
      repo: target.repo,
      ref: target.ref,
      fetch: options.fetch,
      alsoContent: [file],
    });
    const text = load.snapshot.files.get(file);
    if (typeof text !== 'string') {
      // 추적되는데 본문을 못 읽었다 — 잘림이지 「토큰 0」이 아니다.
      return { kind: 'unreadable', code: 'tree-truncated' };
    }
    return { kind: 'scopes', snapshot: load.snapshot, probe: scopesIn(adapterId, file, text) };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * 조립 — 네트워크가 **연결 갈래에만** 있다. 생성 갈래는 입력이 전부 손에 있어 순수 함수
 * 하나로 끝나고, 연결 갈래는 **정본을 읽어야** 박제를 지을 수 있다(손으로 받지 않는다).
 *
 * ⚠️ 읽지 못한 경우는 조립의 거부가 아니라 **판정 불가**다 — 요구하는 행동이 다르다(「선언을
 * 고쳐라」와 「비공개라 이 입구로는 못 읽는다」). 그래서 같은 전용 화면들로 돌아간다.
 */
export type ComposeNetOutcome = { kind: 'compose'; outcome: ComposeOutcome } | Unjudgeable;

export async function composeIntent(
  intent: ConstitutionIntent,
  options: DiagnoseOptions = {},
): Promise<ComposeNetOutcome> {
  if (intent.kind === 'canon') return { kind: 'compose', outcome: composeConstitution(intent) };
  try {
    const canon: CanonPointer = intent.canon;
    const peer = await loadGithubSnapshot({
      repo: canon.repo,
      fetch: options.fetch,
      alsoContent: [canon.file],
    });
    return { kind: 'compose', outcome: composeConstitution(intent, [peer.snapshot]) };
  } catch (error) {
    return mapError(error);
  }
}

export async function openFragment(fragment: string): Promise<Outcome> {
  try {
    const measurement = await decodeFragment(fragment);
    return { kind: 'report', origin: 'fragment', measurement };
  } catch (error) {
    return mapError(error);
  }
}

/**
 * 던져진 것 → 판정 불가 갈래 하나. ⭐ 반환이 `Unjudgeable` 인 것이 **단정**이다: 오류에서
 * 보고서가 날 수는 없고, 그 사실이 타입에 서 있으면 세 오케스트레이션(진단 · 관측 · 조립)이
 * **같은 손**을 쓰면서도 각자의 갈래 집합을 지킬 수 있다.
 */
function mapError(error: unknown): Unjudgeable {
  if (error instanceof RateLimitedError) return { kind: 'rate-limited', resetAt: error.resetAt };
  if (error instanceof RepoUnreadableError) {
    if (error.code === 'private-or-missing' || error.code === 'tree-truncated') {
      return { kind: 'unreadable', code: error.code };
    }
    // 나머지 코드는 워크스페이스 로더의 몫이라 이 페이지에는 오지 않는다 — 와도 접지 않는다.
    return { kind: 'error', message: error.message };
  }
  // VersionMismatchError 가 SchemaParseError 의 하위라서 먼저 본다.
  if (error instanceof VersionMismatchError) {
    return { kind: 'version-mismatch', axis: error.axis, found: error.found };
  }
  if (error instanceof FragmentIntegrityError) return { kind: 'fragment-unreadable', message: error.message };
  if (error instanceof SchemaParseError) return { kind: 'fragment-unreadable', message: error.message };
  if (error instanceof DeclarationInvalidError) return { kind: 'declaration-invalid', problems: error.problems };
  return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
}
