/**
 * 고객 선언 파일 — 저장소 루트의 `graduand.json`.
 *
 * 파서는 `JSON.parse` 하나다. 이 검증기가 선언의 주인이고, 모든 표면이 판정 전에 돌린다.
 *
 * 상태가 셋이고 셋 다 다른 결과를 낳는다:
 * - **absent** — 파일이 없다. 실패가 아니라 **미판정**이다(선언이 필요 없는 체크는 돈다).
 * - **valid** — 선언을 읽었다. `ui` 키 부재(선언 없음 = 미판정)와 `ui: []`(「UI 없음」이라는
 *   **선언** = 판정 대상 0)는 다른 상태다. 양쪽 다 음성이지만 같은 음성이 아니다.
 * - **invalid** — 선언이 깨졌다. **판정 실패**다: 미판정으로 접지 않고 요란하게 멈춘다.
 *   모르는 키를 조용히 무시하면 오타가 「통과」로 둔갑한다 — 조용한 무시가 간극의 숨는
 *   자리라서, 모르는 키 = 오타 = 판정 실패로 둔다.
 *
 * 최상위 키 넷이 한 파일에 사는 이유: **분모는 선언이고 선언의 주인은 하나여야 한다.**
 * 편입 기록(`admissions`)이 분모 자체이고, 면제 목록(`exemptions`)은 그 분모의 칸을
 * 「밖」에 두는 선언이다 — 파일을 나누면 주인이 둘이 되고, 그것은 이 제품이 파는 명제에
 * 대한 자기모순이다. ⛔ 과금·자격처럼 **판정되지 않는 것**은 여기 살지 않는다:
 * 판정되는 것은 선언에, 판정되지 않는 것은 밖에.
 */

import { PALETTE_ADAPTERS } from './adapters/adapter.ts';
import { ENTITLEMENT } from './entitlement.ts';
import { indexPaths, type PathIndex, type RepoSnapshot } from './snapshot.ts';
import { VERIFIER_IDS, isVerifierId } from './verifiers/registry.ts';

/** 정본 포인터 — 공유값의 정본이 사는 자리. 이 저장소가 정본 자신이면 선언하지 않는다. */
export interface PaletteCanon {
  repo: string;
  file: string;
  scope: string;
}

/**
 * `palette` 선언 — 여섯 키. `adapter`·`files`·`scope` 는 셋이 한 몸이다(어댑터가 무엇을
 * 어느 스코프에서 읽는가). `pinned` 는 공유값의 박제(사본 선언) — CI 축 「코드 == 박제」의
 * 기준이고, 없으면 그 축은 기준이 없어 미판정이다. 박제만 있고 어댑터가 없는 선언은
 * **폴백**이다: 코드를 읽을 수 없어도 선언된 분모는 같은 스키마의 수로 남는다.
 *
 * `canon` 은 박제를 동반한다(아래 검증) — 주소 없는 박제는 「내가 정본이다」를 침묵으로
 * 주장한다. `diverged` 는 그 침묵의 반대편이다: 사유를 달고 「이 값의 정본은 여기다」를
 * **말하는** 자리이고, 같은 토큰을 박제하면서 갈라질 수는 없다(배타).
 */
export interface PaletteDeclaration {
  /** 아는 어댑터의 id. null = 어댑터 3종 키(adapter·files·scope) 미선언. */
  adapter: string | null;
  files: string[] | null;
  scope: string | null;
  canon: PaletteCanon | null;
  pinned: Record<string, string> | null;
  /** 선언된 갈라짐 — 토큰 → 사유. 사유는 필수이고 `pinned` 와 토큰 단위로 배타다. */
  diverged: Record<string, string> | null;
}

/**
 * 편입 기록 한 줄 — 키는 규칙 id(정본 저장소의 규범을 가리킨다). ⛔ `coverage` 를 적는
 * 자리는 없다: 그것은 `verifiers` 에서 **파생**되는 실측값이고, 저작으로 두면 「판정기 0
 * 인데 enforced」가 설 수 있다. ⛔ `enforcement`·`expires`(유예) 도 없다 — 집행 강도 축이
 * 판정기에 아예 없고, 읽는 코드 없는 필드는 거짓 초록이다.
 */
export interface RuleAdmission {
  /**
   * 등록부(`VERIFIER_IDS`)의 판정기 이름들. null = `verifiers` 키 미선언이고, `[]` 는
   * 「판정기 없음」이라는 **선언**이다 — 둘 다 「위반 0」이 아니라 미판정(`no-verifier`)
   * 이라 같은 자리에 앉는다. ⚠️ 모르는 **이름**은 그 자리가 아니라 판정 실패다.
   */
  verifiers: string[] | null;
}

/**
 * 면제 한 줄 — 「이 규칙을 적용하지 않는다」. 칸은 「밖 — 미판정(선언된 면제)」으로
 * 남고 **분모는 줄지 않는다**(분모에서 칸을 빼는 선언이 금지된 것이다).
 *
 * ⭐ **만기가 필수인 것이 그 값이다** — 사유만으로 영구 면제가 되면 사유가 압력을
 * 흡수하고 그 규칙은 영원히 미뤄진다. ⛔ 승인자·요청자 필드는 두지 않는다: 확인 기전이
 * 0 이라 검증될 길이 없고, 그 줄을 넣은 커밋이 요청이며 머지한 사람이 승인이다(git 이
 * 회수 이력까지 공짜로 갖는다).
 */
export interface RuleExemption {
  reason: string;
  /** `YYYY-MM-DD`. 「만기가 지났는가」는 판정이 아니라 `Measurement` 봉투의 몫이다. */
  expires: string;
}

export interface ValidDeclaration {
  state: 'valid';
  /** `ui` 키가 없으면 null — 「선언 없음」. `[]` 는 「UI 없음」 선언이다. */
  ui: string[] | null;
  /** `palette` 키가 없으면 null — 팔레트 축 전체가 「선언 없음 = 미판정」이다. */
  palette: PaletteDeclaration | null;
  /**
   * 편입 기록. 키 부재 = null 이고 `{}` 는 「편입 0」 선언이다 — 둘은 같은 판정을 낳지만
   * (칸 전부가 「밖」) 고객이 적은 것을 지우지 않는다.
   */
  admissions: Record<string, RuleAdmission> | null;
  /** 면제 목록. 같은 규칙 id 가 `admissions` 에도 있으면 판정 실패다. */
  exemptions: Record<string, RuleExemption> | null;
}

export type DeclarationResult =
  | { state: 'absent' }
  | ValidDeclaration
  | { state: 'invalid'; problems: string[] };

export class DeclarationInvalidError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`graduand.json is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.problems = problems;
  }
}

export const DECLARATION_FILE = 'graduand.json';

/**
 * 스키마의 키 목록 — **이 파일이 정본이다.** 선언을 안내하는 표면(스캐폴드 안내문)은
 * 이것을 읽어서 적는다: 산문에 박은 사본은 스키마가 움직이는 날 거짓이 된다.
 */
export const TOP_KEYS = ['ui', 'palette', 'admissions', 'exemptions'] as const;
export const PALETTE_KEYS = ['adapter', 'files', 'scope', 'canon', 'pinned', 'diverged'] as const;
const ADMISSION_KEYS = ['verifiers'] as const;
/**
 * 면제 한 줄의 키 — **닫힌 목록이고, 이것이 승인자 필드를 막는 집행이다.** 다른 이름은
 * 전부 판정 실패다: 확인 기전이 0 인 선언(`approvedBy`)을 받으면 그것은 검증되지 않는
 * 값이 선언에 사는 것이고, 요청·승인·회수의 이력은 git 이 이미 갖는다.
 */
export const EXEMPTION_KEYS = ['reason', 'expires'] as const;

/**
 * 적을 자리가 **없는** 키 — 모르는 키와 같은 판정 실패이되 문장이 다르다. 오타는 「이런
 * 키는 없다」로 끝나지만, 이 둘은 고객이 **다른 제품에서 보고 옮겨 적는** 이름이라 왜
 * 없는지를 말해야 고칠 수 있다.
 *
 * - `coverage` 는 `verifiers` 에서 **파생**된다(격자가 센다 — `grid.ts`). 저작으로 두면
 *   「판정기 0 인데 enforced」가 설 수 있고, 그것을 막을 조항이 제품에 없다.
 * - `enforcement`(집행 강도)는 **판정기에 축이 아예 없다.** 읽는 코드가 0 인 필드는 거짓
 *   초록이다 — 고객은 유예를 걸었다고 믿고 판정은 그것을 모른다.
 * - 자격·과금 키(`activation_id`·`license_key`)는 **판정되지 않는다.** 선언은 분모이고
 *   분모는 판정의 대상인데, 과금 상태는 판정의 대상이 아니다 — 넓히면 ⑴ 과금이 판정
 *   대상 안으로 들어오고 ⑵ 키를 회전할 때마다 선언이 흔들린다. 핸들의 자리는 **별
 *   파일**이고(`ENTITLEMENT.file`), 키의 자리는 **환경**이다(커밋되는 비밀은 비밀이 아니다).
 */
const NO_PLACE: Record<string, string> = {
  coverage: 'is derived from "verifiers" — there is no place to author it: a hand-written coverage can claim "enforced" with zero verifiers',
  enforcement: 'has no axis in this verifier — a field no code reads is a false green, not a grace period',
  [ENTITLEMENT.handleKey]: `belongs in ${ENTITLEMENT.file}, not in this closed schema — a declaration is the denominator of judgment, and billing state is not judged`,
  license_key: `is a secret: it belongs in the ${ENTITLEMENT.keyEnv} environment variable, never in a committed file`,
};

/** 모르는 키 하나의 문장 — 자리가 없는 이유를 아는 키는 그 이유를 말한다. */
const unknownKey = (at: string, key: string, known: readonly string[]): string =>
  key in NO_PLACE ? `"${at}" ${NO_PLACE[key]}` : `"${at}" is not a known key (known: ${known.join(', ')})`;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 저장소 상대 경로 목록 — `ui` 와 `palette.files` 가 같은 규칙을 쓴다. */
function validatePathList(value: unknown, key: string, problems: string[]): string[] | null {
  if (!Array.isArray(value)) {
    problems.push(`"${key}" must be an array of repository-relative paths (got ${typeof value})`);
    return null;
  }
  const paths: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, i) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      problems.push(`"${key}"[${i}] must be a non-empty string`);
      return;
    }
    if (entry.startsWith('/') || entry.startsWith('~')) {
      problems.push(`"${key}"[${i}] ("${entry}") must be repository-relative — no absolute or home paths`);
      return;
    }
    if (seen.has(entry)) {
      problems.push(`"${key}"[${i}] ("${entry}") is declared twice`);
      return;
    }
    seen.add(entry);
    paths.push(entry);
  });
  return paths;
}

const validateUi = (value: unknown, problems: string[]): string[] | null =>
  validatePathList(value, 'ui', problems);

const CANON_KEYS = ['repo', 'file', 'scope'] as const;

function validateCanon(value: unknown, problems: string[]): PaletteCanon | null {
  if (!isPlainObject(value)) {
    problems.push(`"palette.canon" must be an object { repo, file, scope } (got ${Array.isArray(value) ? 'array' : typeof value})`);
    return null;
  }
  const before = problems.length;
  for (const key of Object.keys(value)) {
    if (!(CANON_KEYS as readonly string[]).includes(key)) {
      problems.push(`"palette.canon.${key}" is not a known key (known: ${CANON_KEYS.join(', ')})`);
    }
  }
  for (const key of CANON_KEYS) {
    const v = value[key];
    if (typeof v !== 'string' || v.trim() === '') {
      problems.push(`"palette.canon.${key}" must be a non-empty string`);
    }
  }
  return problems.length > before ? null : (value as unknown as PaletteCanon);
}

function validatePinned(value: unknown, problems: string[]): Record<string, string> | null {
  if (!isPlainObject(value)) {
    problems.push(`"palette.pinned" must be an object of { token: value } (got ${Array.isArray(value) ? 'array' : typeof value})`);
    return null;
  }
  const before = problems.length;
  const entries = Object.entries(value);
  if (entries.length === 0) {
    // 공집합 박제는 「공유값 없음」이 아니라 선언의 공백이다 — 공유값이 없으면 키를 빼는
    // 것이 그 선언이고, 빈 박제는 CI 축을 분모 0 의 거짓 초록으로 만든다.
    problems.push('"palette.pinned" must not be empty — pin the shared values, or drop the key');
    return null;
  }
  for (const [token, v] of entries) {
    if (token.trim() === '' || typeof v !== 'string' || v.trim() === '') {
      problems.push(`"palette.pinned" entries must be non-empty string values ("${token}")`);
    }
  }
  return problems.length > before ? null : (value as Record<string, string>);
}

/**
 * 선언된 갈라짐 — 토큰 → 사유. 사유는 **읽히기 때문에** 필수다: 읽지 않는 사유는
 * 통과료이고, 아무 문장이나 적어도 아무도 틀렸다고 말할 수 없다. 사유 문장은 판정의
 * `evidence` 를 타고 칸마다 찍힌다(새 필드 0 — 평평한 원시값만 싣는 그 자리다).
 */
function validateDiverged(value: unknown, problems: string[]): Record<string, string> | null {
  if (!isPlainObject(value)) {
    problems.push(`"palette.diverged" must be an object of { token: reason } (got ${Array.isArray(value) ? 'array' : typeof value})`);
    return null;
  }
  const before = problems.length;
  const entries = Object.entries(value);
  if (entries.length === 0) {
    // 빈 갈라짐은 「갈라진 것이 없다」가 아니라 선언의 공백이다 — 없으면 키를 뺀다.
    problems.push('"palette.diverged" must not be empty — name the diverged tokens with their reasons, or drop the key');
    return null;
  }
  for (const [token, reason] of entries) {
    if (token.trim() === '' || typeof reason !== 'string' || reason.trim() === '') {
      problems.push(`"palette.diverged" entries must carry a non-empty reason ("${token}") — a divergence without a reason is drift`);
    }
  }
  return problems.length > before ? null : (value as Record<string, string>);
}

/** 등록부 조회 — 모르는 이름은 아는 목록과 함께 거부한다(미지의 어댑터 id 와 같은 규율). */
function validateVerifiers(value: unknown, at: string, problems: string[]): string[] | null {
  if (!Array.isArray(value)) {
    problems.push(`"${at}" must be an array of verifier names (got ${typeof value})`);
    return null;
  }
  const names: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, i) => {
    if (typeof entry !== 'string' || !isVerifierId(entry)) {
      problems.push(`"${at}"[${i}] (${JSON.stringify(entry)}) is not a known verifier (known: ${VERIFIER_IDS.join(', ')})`);
      return;
    }
    if (seen.has(entry)) {
      problems.push(`"${at}"[${i}] ("${entry}") is declared twice`);
      return;
    }
    seen.add(entry);
    names.push(entry);
  });
  return names;
}

function validateAdmissions(value: unknown, problems: string[]): Record<string, RuleAdmission> | null {
  if (!isPlainObject(value)) {
    problems.push(`"admissions" must be an object keyed by rule id (got ${Array.isArray(value) ? 'array' : typeof value})`);
    return null;
  }
  const before = problems.length;
  const admissions: Record<string, RuleAdmission> = {};
  for (const [rule, raw] of Object.entries(value)) {
    if (rule.trim() === '') {
      problems.push('"admissions" keys must be non-empty rule ids');
      continue;
    }
    if (!isPlainObject(raw)) {
      problems.push(`"admissions.${rule}" must be an object { verifiers } (got ${Array.isArray(raw) ? 'array' : typeof raw})`);
      continue;
    }
    for (const key of Object.keys(raw)) {
      if (!(ADMISSION_KEYS as readonly string[]).includes(key)) {
        problems.push(unknownKey(`admissions.${rule}.${key}`, key, ADMISSION_KEYS));
      }
    }
    admissions[rule] = {
      verifiers: 'verifiers' in raw ? validateVerifiers(raw.verifiers, `admissions.${rule}.verifiers`, problems) : null,
    };
  }
  return problems.length > before ? null : admissions;
}

const EXPIRES_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `YYYY-MM-DD` 가 실재하는 날짜인가. 만기 비교는 UTC 날짜 절단이므로 **형식이 곧 값**
 * 이다 — 읽히지 않는 만기는 장식이다. ⛔ 여기서 「오늘」을 묻지 않는다: 현재 시각은
 * 판정이 아니라 측정의 속성이고 `Measurement` 봉투에 산다.
 */
function isCalendarDate(value: string): boolean {
  if (!EXPIRES_SHAPE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

function validateExemptions(value: unknown, problems: string[]): Record<string, RuleExemption> | null {
  if (!isPlainObject(value)) {
    problems.push(`"exemptions" must be an object keyed by rule id (got ${Array.isArray(value) ? 'array' : typeof value})`);
    return null;
  }
  const before = problems.length;
  const exemptions: Record<string, RuleExemption> = {};
  for (const [rule, raw] of Object.entries(value)) {
    if (rule.trim() === '') {
      problems.push('"exemptions" keys must be non-empty rule ids');
      continue;
    }
    if (!isPlainObject(raw)) {
      problems.push(`"exemptions.${rule}" must be an object { reason, expires } (got ${Array.isArray(raw) ? 'array' : typeof raw})`);
      continue;
    }
    for (const key of Object.keys(raw)) {
      if (!(EXEMPTION_KEYS as readonly string[]).includes(key)) {
        problems.push(`"exemptions.${rule}.${key}" is not a known key (known: ${EXEMPTION_KEYS.join(', ')})`);
      }
    }
    const reason = typeof raw.reason === 'string' && raw.reason.trim() !== '' ? raw.reason : null;
    const expires = typeof raw.expires === 'string' && isCalendarDate(raw.expires) ? raw.expires : null;
    if (reason === null) {
      problems.push(`"exemptions.${rule}.reason" must be a non-empty string — it is reported, not stored`);
    }
    if (expires === null) {
      problems.push(`"exemptions.${rule}.expires" must be a YYYY-MM-DD date — an exemption without an expiry is not an exemption`);
    }
    if (reason !== null && expires !== null) exemptions[rule] = { reason, expires };
  }
  return problems.length > before ? null : exemptions;
}

function validatePalette(value: unknown, problems: string[]): PaletteDeclaration | null {
  if (!isPlainObject(value)) {
    problems.push(`"palette" must be an object (got ${Array.isArray(value) ? 'array' : typeof value})`);
    return null;
  }
  const before = problems.length;
  for (const key of Object.keys(value)) {
    if (!(PALETTE_KEYS as readonly string[]).includes(key)) {
      problems.push(`"palette.${key}" is not a known key (known: ${PALETTE_KEYS.join(', ')})`);
    }
  }
  if (Object.keys(value).length === 0) {
    problems.push('"palette" declares nothing — declare the adapter trio (adapter · files · scope), pinned values, or drop the key');
  }

  // adapter · files · scope 는 셋이 한 몸이다 — 어댑터 없는 파일 목록은 읽는 손이 없고,
  // 파일·스코프 없는 어댑터는 읽을 자리가 없다. 반쪽 선언은 미판정으로 새지 않고 실패한다.
  const trio = ['adapter', 'files', 'scope'].filter((k) => k in value);
  if (trio.length > 0 && trio.length < 3) {
    problems.push(`"palette.adapter", "palette.files", "palette.scope" are declared together or not at all (found only: ${trio.join(', ')})`);
  }

  let adapter: string | null = null;
  if ('adapter' in value) {
    const known = PALETTE_ADAPTERS.map((a) => a.id);
    if (typeof value.adapter !== 'string' || !known.includes(value.adapter)) {
      problems.push(`"palette.adapter" (${JSON.stringify(value.adapter)}) is not a known adapter (known: ${known.join(', ')})`);
    } else {
      adapter = value.adapter;
    }
  }

  const files = 'files' in value ? validatePathList(value.files, 'palette.files', problems) : null;
  if (files !== null && files.length === 0) {
    problems.push('"palette.files" must name at least one file — an adapter with nothing to read reads nothing');
  }

  let scope: string | null = null;
  if ('scope' in value) {
    if (typeof value.scope !== 'string' || value.scope.trim() === '') {
      problems.push('"palette.scope" must be a non-empty string (e.g. ":root" or "@theme")');
    } else {
      scope = value.scope;
    }
  }

  const canon = 'canon' in value ? validateCanon(value.canon, problems) : null;
  const pinned = 'pinned' in value ? validatePinned(value.pinned, problems) : null;
  const diverged = 'diverged' in value ? validateDiverged(value.diverged, problems) : null;

  // 박제는 정본의 주소를 동반한다 — adapter·files·scope 트리오와 같은 급의 동반이다.
  // 주소 없는 박제는 「내가 정본이다」를 **침묵으로** 주장하고 아무도 묻지 않는다.
  if ('pinned' in value && !('canon' in value)) {
    problems.push('"palette.pinned" is declared with "palette.canon" or not at all — a pin without the canon address claims to be the canon in silence');
  }

  // 박제하면서 갈라질 수 없다 — 한 토큰이 두 칸을 동시에 주장한다.
  if (pinned !== null && diverged !== null) {
    for (const token of Object.keys(diverged)) {
      if (token in pinned) {
        problems.push(`"${token}" is both pinned and diverged — a token is pinned or diverged, not both`);
      }
    }
  }

  if (problems.length > before) return null;
  return { adapter, files, scope, canon, pinned, diverged };
}

/**
 * 판정기가 받는 선언의 상태 — `invalid` 는 여기 오지 않는다(판정 실패로 멈춘다).
 * `'unreadable'` 은 선언 파일이 추적되는데 본문을 읽지 못한 상태 — 잘림이지 부재가 아니다.
 */
export type ResolvedDeclaration = Exclude<DeclarationResult, { state: 'invalid' }> | 'unreadable';

/**
 * 스냅샷에서 선언을 꺼낸다 — **선언을 읽는 손은 하나다.** 「부재 · 잘림 · 읽음」을 가르는
 * 규칙이 두 곳에 적히면 그 순간 사본이고, 사본은 갈라진다. 판정 · 격자, 그리고 교차 축이
 * **다른 체크아웃의** 선언을 읽을 때까지 전부 이 함수를 지난다.
 *
 * @throws DeclarationInvalidError 선언이 깨졌을 때 — **판정 실패**다. 미판정으로 접지
 *         않는다: 오타를 조용히 통과시키면 선언 규율 전체가 무너진다. 호출자(CLI · 페이지)는
 *         이것을 위반과도 미판정과도 다른, 고쳐야 도는 상태로 요란하게 보여준다.
 */
export function declarationOf(
  snapshot: RepoSnapshot,
  index: PathIndex = indexPaths(snapshot.paths),
): ResolvedDeclaration {
  if (!index.hasFile(DECLARATION_FILE)) return { state: 'absent' };
  const text = snapshot.files.get(DECLARATION_FILE);
  if (typeof text !== 'string') return 'unreadable'; // 추적되는데 못 읽었다 — 부재가 아니라 잘림이다.
  const validated = validateDeclaration(text);
  if (validated.state === 'invalid') throw new DeclarationInvalidError(validated.problems);
  return validated;
}

/**
 * 호스트(워크스페이스 · GitHub API)가 본문을 실어야 하는 선언 경로 — `palette.files`.
 * 선언이 없거나 깨졌으면 빈 목록이다: 깨진 선언은 판정 층이 요란하게 멈추므로,
 * 로더가 그 앞에서 추측으로 더 읽을 이유가 없다.
 */
export function declaredPaletteFiles(text: string | null): string[] {
  const result = validateDeclaration(text);
  if (result.state !== 'valid' || result.palette === null) return [];
  return result.palette.files ?? [];
}

/**
 * 이 선언이 지목한 정본 포인터 — `palette.canon`. 교차 축은 **다른 체크아웃의** 이 파일을
 * 읽어야 하는데, 그 지목은 남의 선언에 적혀 있어 로더가 자기 선언만 보고는 알 수 없다.
 * 선언이 없거나 깨졌으면 null 이다(`declaredPaletteFiles` 와 같은 규율).
 */
export function declaredCanon(text: string | null): PaletteCanon | null {
  const result = validateDeclaration(text);
  if (result.state !== 'valid' || result.palette === null) return null;
  return result.palette.canon;
}

/**
 * @param text `graduand.json` 의 본문. 파일이 없으면 null 을 넘긴다 — 「없음」과
 *             「못 읽음」을 섞지 않는 것은 호출자(스냅샷 층)의 몫이다.
 */
export function validateDeclaration(text: string | null): DeclarationResult {
  if (text === null) return { state: 'absent' };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { state: 'invalid', problems: [`not valid JSON — ${(e as Error).message}`] };
  }
  if (!isPlainObject(raw)) {
    return { state: 'invalid', problems: ['top level must be a JSON object'] };
  }

  const problems: string[] = [];
  for (const key of Object.keys(raw)) {
    if (!(TOP_KEYS as readonly string[]).includes(key)) {
      problems.push(unknownKey(key, key, TOP_KEYS));
    }
  }

  const ui = 'ui' in raw ? validateUi(raw.ui, problems) : null;
  const palette = 'palette' in raw ? validatePalette(raw.palette, problems) : null;
  const admissions = 'admissions' in raw ? validateAdmissions(raw.admissions, problems) : null;
  const exemptions = 'exemptions' in raw ? validateExemptions(raw.exemptions, problems) : null;

  // 편입과 면제는 배타다 — 편입은 칸을 「밖」에서 「관할」로 옮기고 면제는 「밖」에 두므로,
  // 한 레코드가 두 칸을 동시에 주장하는 것이다. 분모는 어느 쪽도 움직이지 않는다.
  if (admissions !== null && exemptions !== null) {
    for (const rule of Object.keys(exemptions)) {
      if (rule in admissions) {
        problems.push(`"${rule}" is both admitted and exempted — a rule claims one cell, not two`);
      }
    }
  }

  if (problems.length > 0) return { state: 'invalid', problems };
  return { state: 'valid', ui, palette, admissions, exemptions };
}
