/**
 * 진단 오케스트레이션 — 입력 하나에서 Outcome 하나로.
 *
 * 네트워크는 판정기 모듈의 GitHub 로더 하나다: 이 파일은 fetch 를 **만들지 않고**
 * 주입만 한다(기본은 로더가 쥔 전역 fetch — 로더가 가는 호스트는 api.github.com
 * 하나다). 「미판정 ≠ 위반 0」의 화면 쪽 절반이 여기 선다: 읽을 수 없음·한도·버전
 * 불일치·손상은 보고서로 접히지 않고 각자의 kind 로 돌아온다.
 */

import {
  decodeFragment,
  judgeSnapshot,
  loadGithubSnapshot,
  DeclarationInvalidError,
  FragmentIntegrityError,
  RateLimitedError,
  RepoUnreadableError,
  SchemaParseError,
  VersionMismatchError,
  VERIFIER,
  type Entitlement,
  type Measurement,
} from '../../verifier/src/index.ts';
import type { RepoRef } from './github-url.ts';
import type { ReportOrigin } from './report.ts';

export type Outcome =
  /**
   * 보고서 하나. `entitlement` 는 **이 표면이 본 자격**이고 생략은 「보지 않았다」다 —
   * 판정의 인자와 **같은 값**이라 보고가 말하는 자격과 수를 막은 자격이 갈라질 수 없다.
   * ⚠️ fragment 로 들어온 측정에는 없다: 봉투에 실리는 것이 아니라 **묻는 표면**의 것이다.
   */
  | { kind: 'report'; origin: ReportOrigin; measurement: Measurement; entitlement?: Entitlement }
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
    const measurement: Measurement = {
      judgment: judgeSnapshot(load.snapshot, { entitlement: options.entitlement }),
      source: load.source,
      measuredAt: (options.now?.() ?? new Date()).toISOString(),
      verifier: { name: VERIFIER.name, version: VERIFIER.version },
      dirty: load.dirty,
    };
    return { kind: 'report', origin: 'url', measurement, entitlement: options.entitlement };
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

function mapError(error: unknown): Outcome {
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
