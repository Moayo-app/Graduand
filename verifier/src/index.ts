/**
 * 공개 API — 고객 CI 와 브라우저가 import 하는 **하나의 모듈**.
 *
 * 이 표면은 닫혀 있고 테스트가 전수를 집행한다. 여기 없는 것은 약속이 아니다 —
 * 특히 점수·등급·백분율을 내는 API 는 **존재하지 않으며, 추가하지 않는다.**
 * 수는 3상태(통과 · 위반 · 미판정 + 사유)로만 말한다.
 *
 * Node 전용 입력(워크스페이스 로더)은 여기 없다 — `graduand/workspace` 서브패스가
 * 따로 노출한다. 이 모듈 자체는 브라우저에서 그대로 돈다.
 */

export {
  SCHEMA_VERSION,
  CHECK_STATUSES,
  REASON_CODES,
  MEASUREMENT_SOURCES,
  serializeJudgment,
  parseJudgment,
  serializeMeasurement,
  parseMeasurement,
  SchemaParseError,
  VersionMismatchError,
} from './schema.ts';
export type {
  CheckStatus,
  ReasonCode,
  Evidence,
  CheckResult,
  Judgment,
  Measurement,
  MeasurementSource,
} from './schema.ts';

export { validateDeclaration, DeclarationInvalidError, DECLARATION_FILE } from './declaration.ts';
export type {
  DeclarationResult,
  ValidDeclaration,
  PaletteDeclaration,
  PaletteCanon,
  RuleAdmission,
  RuleExemption,
} from './declaration.ts';

/**
 * 선언 스캐폴드 — 두 입구(`graduand init` · 페이지의 조각 내보내기)가 내는 **같은
 * 문자열**. 쓰는 쪽(io · 결과 서술)은 CLI 전용이라 이 표면에 없다.
 */
export { SCAFFOLD_JSON } from './scaffold.ts';

export { VERIFIER_IDS } from './verifiers/registry.ts';
export type { VerifierId } from './verifiers/registry.ts';

export { PALETTE_ADAPTERS, AdapterParseError } from './adapters/adapter.ts';
export type { PaletteAdapter, ReadToken, AdapterResult } from './adapters/adapter.ts';

/**
 * 판정 하나와 그 시야 — `JudgeContext.peers` 는 **같은 잡이 함께 본 체크아웃**이고,
 * 교차 축(「박제 == 정본」)이 정본을 그 목록에서 찾는다. 비면 한 저장소 표면이다.
 */
export { judgeSnapshot } from './judge.ts';
export type { JudgeContext } from './judge.ts';

/**
 * 편입 격자 — 규칙 × 표면. **파생**이라 판정 직렬화에 실리지 않고, 선언과 판정 결과를 둘
 * 다 쥔 표면이 센다(`admissionGrid`). 칸을 세는 함수는 하나다(`gridCounts`) — 보고 표면이
 * 각자 세면 그 순간 사본이다. ⛔ 커버리지를 **값으로** 내는 API 는 여기 없다.
 */
export { admissionGrid, gridCounts, gridTotals } from './grid.ts';
export type { AdmissionGrid, GridRule, GridCounts } from './grid.ts';

/**
 * 면제의 만기 — **봉투가 판정한다**(`measuredAt` 기준 · UTC 날짜 절단). 판정에 들어갈 수
 * 없는 사실이라 `Judgment` 가 아니라 이 자리에 있다. ⛔ 게이트의 종료 코드와 그 서술은
 * 여기 없다 — 빨강을 내는 것은 측정 명령의 행위이고, 스캐폴드의 `initExitCode` 와 같은
 * 자리다. ⛔ 승인자를 적는 API 도 없다 — git 이 갖는다.
 */
export { overdueExemptions, utcDateOf } from './expiry.ts';
export type { OverdueExemption } from './expiry.ts';

/**
 * 자격 — **판정의 인자**다(`JudgeContext.entitlement`). 묻는 손은 호스트이고
 * (`resolveEntitlement` — 주입된 네트워크 하나), 판정은 받는다. ⛔ 자격을 「통과/실패」로
 * 내는 API 는 여기 없다: 자격이 없으면 칸은 **미판정 + 사유**이고 빨강이 아니다.
 * ⛔ 재활성화를 **소비하는** API 도 없다 — 제안까지가 도구의 몫이다.
 *
 * ⭐⭐ **고지의 정본이 여기 있고, 그것은 사실이다**(`entitlementNotice`) — 상태 · 사유 ·
 * 만기일 · 남은 날 · 넘겼는가 · 전환 경로. 두 표면이 같은 고지를 내는 길은 「같은 **사실**을
 * 받아 각자 그린다」다: 문장을 정본으로 두면 페이지의 로케일이 둘이 되는 날 「같은 한 문장」이
 * 로케일마다 갈라지거나 한국어 화면에 영문 한 줄이 선다 — 둘 다 거짓이다.
 * ⭐ `describeEntitlement` · `describeExpiry` 는 **측정 명령의 영문 자구**이고 그 사실에서
 * 유도된다 — 세는 손이 둘이 되지 않는 것이 그 유도의 요점이다(경계값은 만기 **당일**이다).
 * ⛔ 그래서 전환 링크도 상수 하나다(`CHECKOUT_PATH`, 상대 경로) — 벤더 절대 URL 0.
 */
export {
  ENTITLEMENT,
  CHECKOUT_PATH,
  DETAIL_REASONS,
  entitlementGate,
  parseHandle,
  entitlementNotice,
  describeEntitlement,
  describeExpiry,
} from './entitlement.ts';
export type {
  Entitlement,
  EntitlementDetail,
  EntitlementHandle,
  EntitlementNotice,
  ExpiryFact,
  NoticeFacts,
} from './entitlement.ts';
export { resolveEntitlement } from './hosts/entitlement.ts';
export type { EntitlementIo } from './hosts/entitlement.ts';

export { RepoUnreadableError, RateLimitedError } from './snapshot.ts';
export type { RepoSnapshot } from './snapshot.ts';

export { NOTATIONS } from './verifiers/notations.ts';

export { loadGithubSnapshot } from './hosts/github.ts';
export type { GithubLoad, GithubLoadOptions } from './hosts/github.ts';

export {
  encodeFragment,
  decodeFragment,
  FRAGMENT_VERSION,
  RECOMMENDED_URL_MAX,
  FragmentIntegrityError,
} from './fragment.ts';

export { VERIFIER } from './version.ts';
