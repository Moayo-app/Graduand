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
/**
 * 선언이 지목한 정본의 주소 — ⭐ **호스트가 쓰는 손이다.** 교차 축은 **다른 체크아웃의**
 * 파일을 읽어야 하는데 그 지목은 선언에 적혀 있어, 읽는 쪽(워크스페이스 로더 · 브라우저)이
 * 그것을 먼저 알아야 한다. 두 호스트가 각자 선언을 뜯으면 그 순간 사본이다.
 */
export { declaredCanons } from './declaration.ts';
/**
 * 공유값 축 — ⭐ **스키마의 키이고 표면이 그 이름을 적지 않는다**(`SHARED_VALUES_KEY`).
 * 선언의 모양을 아는 모듈이 그 키의 자구도 안다 — 화면이 `'shared-values'` 를 박으면 그
 * 순간 사본이고, 키가 움직이는 날 그 사본이 먼저 거짓이 된다. `axisNameProblem` 은 축
 * 이름을 **묻는 손 하나**다(조립과 선언 검증이 같은 답을 받는다).
 */
export { SHARED_VALUES_KEY, AXIS_KEYS, axisNameProblem } from './declaration.ts';
export type {
  DeclarationResult,
  DeclaredCanon,
  ValidDeclaration,
  SharedValuesAxis,
  CanonPointer,
  RuleAdmission,
  RuleExemption,
} from './declaration.ts';

/**
 * 선언 스캐폴드 — 두 입구(`graduand init` · 페이지의 조각 내보내기)가 내는 **같은
 * 문자열**. 쓰는 쪽(io · 결과 서술)은 CLI 전용이라 이 표면에 없다.
 */
export { SCAFFOLD_JSON } from './scaffold.ts';

/**
 * 헌법 조립 — 「헌법을 만든다」의 **규범 저작** 쪽. ⭐ 표면에 서는 것은 **조립기 하나**이고
 * 문장은 없다: 화면이 조립해 **내보내고**(쓰지 않는다) 측정 명령이 같은 산출을 **쓴다**.
 * ⛔ 쓰는 손(`writeDeclaration`)도 그 말(`formatCompose`)도 여기 없다 — 파일시스템의 의미는
 * 호스트 몫이고, 문장은 표면이 **자기 로케일로** 그린다(고지가 사실로 내려온 그 규율).
 */
export { composeConstitution } from './constitution.ts';
/**
 * 탐색 — 조립이 **고를 수 있는 것**을 저장소에서 꺼낸다(경로는 목록에서, 스코프는 읽어서).
 * ⭐ 어댑터가 자기 꼴을 말하므로 화면에 「`.css` 는 이 어댑터의 것」이라는 사본이 생기지 않는다.
 */
export { candidateFiles, scopesIn } from './probe.ts';
export type { ScopeProbe, ScopeReading } from './probe.ts';
export type {
  AdapterTrio,
  ComposeOutcome,
  ConstitutionIntent,
  UnpinnedToken,
} from './constitution.ts';

/**
 * 판정기 닫힌 등록부와 **축 접미의 규율** — 체크 id 가 `<판정기>:<축>` 이라(개정 4) 보고
 * 표면이 「이 칸은 어느 판정기의 것인가」를 물을 손이 필요하다. ⭐ 그 술어가 **하나**여야
 * 한다: 표면이 접두사 규칙을 따로 적으면 id 를 짓는 손과 갈라진다.
 */
export {
  VERIFIER_IDS,
  VERIFIER_BASIS,
  FREE_VERIFIER_IDS,
  PAID_VERIFIER_IDS,
  AXIS_SEPARATOR,
  axisCheckId,
  isCheckOf,
} from './verifiers/registry.ts';
export type { VerifierId } from './verifiers/registry.ts';

export { VALUE_ADAPTERS, AdapterParseError } from './adapters/adapter.ts';
export type { ValueAdapter, ReadToken, AdapterResult } from './adapters/adapter.ts';

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
 * 선언 0 에서도 **보이는 사실** — ⛔ 판정이 아니다. 격자와 같은 성질이라 같은 봉투에 타고
 * (스냅샷을 쥔 쪽만 읽을 수 있다), 읽는 손도 하나다(`readUndeclared`). ⛔ 상태를 내는
 * API 가 여기 없다 — 이 칸에서 통과나 위반을 읽을 수 있는 필드가 하나도 없는 것이 그
 * 규율의 집행이고, 두께를 거짓 양성으로 사지 않겠다는 결정이 그 빈자리다.
 *
 * ⭐ 사본의 칸은 **둘**이다 — 「갈라질 자리」(축자로 같다)와 「갈라진 자리」(겹친 줄이
 * 갈라진 줄보다 많되 같지는 않다). 둘을 한 수로 접지 않는다: 요구하는 행동이 다르다
 * (앞은 집을 하나로 모을 수 있고, 뒤는 **이미 두 말을 하고 있다**).
 */
// ⭐ 하한을 **표면에 둔다** — 보고 표면이 「2 줄 이상」을 자기 문구에 박으면 그 수가 이
// 모듈의 하한과 갈라지고, 갈라진 날 화면이 세지 않은 것을 셌다고 말한다. 상한(`COPY_CAP`)
// 은 반대로 표면의 것이 아니다 — 잘린 수는 봉투가 적어 오고, 화면은 그 수를 읽는다.
export { readUndeclared, foldDiverged, MIN_COPY_LINES } from './undeclared.ts';
export type {
  UndeclaredFacts,
  DocumentCopy,
  DivergedCopy,
  DivergedFamily,
  Span,
  AdapterSurface,
} from './undeclared.ts';

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

/**
 * ⭐⭐ **구독과 자격 사이의 한 걸음** — 키 하나를 자리 하나로 바꾸고, 그 핸들을 파일로
 * 쓴다. 묻는 손(`resolveEntitlement`) 바로 옆에 서는 것이 맞다: 같은 벤더이고 같은
 * 상수이며, 다른 것은 **쓰는가**뿐이다.
 * ⛔ 자동으로 부르는 자리를 내보내지 않는다 — 자리를 쓰는 일은 고객이 친 명령에만 있다.
 */
export {
  ACTIVATION_ACTIONS,
  activateExitCode,
  composeHandle,
  formatActivation,
  writeHandle,
} from './activate.ts';
export type { Activation, ActivationRefusal, HandleIo, HandleWrite } from './activate.ts';
export { activateEntitlement } from './hosts/entitlement.ts';

export { RepoUnreadableError, RateLimitedError } from './snapshot.ts';
export type { RepoSnapshot } from './snapshot.ts';

export { NOTATIONS } from './verifiers/notations.ts';

export { loadGithubSnapshot } from './hosts/github.ts';
export type { GithubLoad, GithubLoadOptions } from './hosts/github.ts';

export {
  encodeFragment,
  decodeFragment,
  looksLikeFragment,
  FRAGMENT_VERSION,
  RECOMMENDED_URL_MAX,
  FragmentIntegrityError,
} from './fragment.ts';

export { VERIFIER } from './version.ts';
