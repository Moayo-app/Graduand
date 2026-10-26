/**
 * `refs` — 참조 간선 해소 판정기. 선언 0 으로 수를 낸다: 마크다운만 있으면 돈다.
 *
 * 판정 기준은 「작성자 디스크에 있는가」가 아니라 **「이 저장소를 클론한 사람이 따라갈
 * 수 있는가」**다. 그래서 존재의 분모는 추적되는 파일이다 — 추적되지 않는 파일은
 * 실재해도 클론한 사람에게는 없다.
 *
 * 수집이 잘리면(읽기 실패) **수를 내지 않는다** — 부분 수집 위에 얹은 수는 언제나
 * 낙관적이다. 그 경우 이 체크는 `unjudged(collection-truncated)` 다.
 */

import type { CheckResult, Evidence } from '../schema.ts';
import type { RepoSnapshot, PathIndex } from '../snapshot.ts';
import { extract, NOTATIONS, type Reference } from './notations.ts';
import { capEvidence } from './evidence.ts';
import type { VerifierId } from './registry.ts';

export type Why = 'outside-repo' | 'missing' | 'wrong-base' | 'absolute-prefix';

export interface Unresolved extends Reference {
  why: Why;
  /** 해소를 시도한 경로 (상대 참조는 정규화된 형태). */
  tried: string;
}

/**
 * 유예 표기 — 참조 **바로 앞 줄**에만 놓는다.
 *
 * ```
 * <!-- graduand-excuse until: TICKET-123 remove: delete this line with the reference -->
 * ```
 *
 * 요건 셋: **적힘**(표기 자체) · **만료 조건**(`until:`) · **자기 제거 지시**(`remove:`).
 * 하나라도 없으면 유예가 아니라 그냥 위반이다. **줄 단위로만 받는다** — 파일·저장소
 * 단위 유예는 allowlist 이고 allowlist 는 침식한다. 유예로 통과한 수는 따로 센다.
 */
const EXCUSE = /<!--\s*graduand-excuse\b/;
const UNTIL = /until\s*:\s*(\S+)/i;
const REMOVE = /remove\s*:\s*(\S.*?)\s*(?:-->|$)/i;

export const isExcuse = (line: string): boolean =>
  EXCUSE.test(line) && UNTIL.test(line) && REMOVE.test(line);

/**
 * 참조 대상에서 가리키는 자리(`#앵커` · `?쿼리` · `:줄번호`)를 떼어 파일 경로만 남긴다.
 * 접미사를 안 떼면 흔한 `파일:줄` 인용이 `missing` 으로 오분류된다 — 잘못된 사유로
 * 보고된 위반은 고쳐지지 않는다.
 */
const strip = (t: string): string =>
  t.split('#')[0]!.split('?')[0]!.replace(/:\d+(?:-\d+)?$/, '').replace(/\/+$/, '');

/** `a/b/../c` → `a/c`. 루트를 벗어나면 `null`. */
function normalize(base: string, target: string): string | null {
  const parts = target.startsWith('/') ? [] : base.split('/').filter(Boolean);
  for (const seg of target.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null; // 루트 밖으로 나갔다
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join('/');
}

/** 저장소를 클론한 사람이 따라갈 수 없는 형태인가. */
const outsideRepo = (t: string): boolean => t.startsWith('~') || t.startsWith('/');

/** 저장소 참조가 아니다 — 해소도 위반도 아니고 판정 대상 밖이다. 따로 센다. */
const EXTERNAL = Symbol('not a repository reference');

/** 경로의 접미사 중 저장소에서 해소되는 첫 번째. 없으면 `null`. */
function suffixHit(t: string, index: PathIndex): string | null {
  const segs = t.replace(/^\/+/, '').split('/').filter(Boolean);
  for (let i = 0; i < segs.length; i += 1) {
    const cand = segs.slice(i).join('/');
    if (index.has(cand)) return cand;
  }
  return null;
}

function resolveOne(
  ref: Reference,
  dir: string,
  byName: Set<string>,
  index: PathIndex,
): Unresolved | null | typeof EXTERNAL {
  const t = strip(ref.raw);
  if (t === '') return null;

  if (outsideRepo(t)) {
    // 선행 `/` 는 두 종류다: 이 저장소와 무관한 웹 라우트·외부 경로가 대부분이지만,
    // 개중에 절대 접두사가 잘못 붙은 진짜가 섞인다. **꼬리 매칭이 둘을 가른다** —
    // 꼬리가 저장소에서 해소되면 위반(처방 = 접두사 제거), 아니면 판정 대상 밖이다.
    // `~` 는 이 완화를 받지 않는다 — 홈 경로는 모호하지 않게 저장소 밖이다.
    if (ref.notation === 'backtick-path' && t.startsWith('/')) {
      const tail = suffixHit(t, index);
      if (tail) return { ...ref, why: 'absolute-prefix', tried: `${t} → ${tail}` };
      return EXTERNAL;
    }
    return { ...ref, why: 'outside-repo', tried: t };
  }

  // 경로가 아니라 이름인 표기 — 저장소 안 어딘가에 그 이름의 마크다운이 있으면 해소된다.
  if (!t.includes('/') && (ref.notation === 'wiki' || ref.notation === 'bare-bracket')) {
    const name = t.replace(/\.[^.]+$/, '');
    return byName.has(name) ? null : { ...ref, why: 'missing', tried: `**/${name}.*` };
  }

  const abs = normalize(dir, t);
  if (abs === null) return { ...ref, why: 'outside-repo', tried: t };
  if (abs === '') return null; // 저장소 루트 자신
  if (index.has(abs)) return null;

  // 대상은 있는데 기준이 틀린 경우는 따로 가른다 — 마크다운 링크는 **파일 기준**으로
  // 풀리는데 루트 기준으로 적는 실수가 흔하다. 대상이 루트에 실재하면 처방이 다르다:
  // 지우는 게 아니라 경로를 고치는 것이다. 사유를 나눠야 보고가 행동으로 이어진다.
  if (ref.notation === 'markdown-link' && index.has(t)) {
    return { ...ref, why: 'wrong-base', tried: `${abs} — exists at root-relative ${t}` };
  }

  // 백틱 경로는 「이 저장소의 파일」이라는 주장이 아닐 수 있다 — 다른 저장소의 경로를
  // 인용하는 문장이 흔하다. **부모 디렉터리가 이 저장소에 실재할 때만** 센다: 부모가
  // 있는데 파일이 없으면 끊어진 지역 참조, 부모부터 없으면 남의 저장소 이야기다.
  // 링크 표기는 「따라가라」고 적은 것이라 이 완화를 받지 않는다.
  if (ref.notation === 'backtick-path') {
    const parent = abs.slice(0, abs.lastIndexOf('/'));
    if (parent === '' || !index.has(parent)) return null;
  }
  return { ...ref, why: 'missing', tried: abs };
}

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

export const REFS_CHECK_ID = 'refs' satisfies VerifierId;

export function judgeRefs(snapshot: RepoSnapshot, index: PathIndex): CheckResult {
  const mdFiles = snapshot.paths.filter((p) => p.endsWith('.md'));

  // 본문을 먼저 전부 확인한다. 하나라도 못 읽었으면 수를 내지 않는다.
  const texts = new Map<string, string>();
  const unread: string[] = [];
  for (const f of mdFiles) {
    const t = snapshot.files.get(f);
    if (typeof t === 'string') texts.set(f, t);
    else unread.push(f);
  }
  if (unread.length > 0) {
    const { evidence, omitted } = capEvidence(unread.map((file): Evidence => ({ file })));
    return {
      id: REFS_CHECK_ID,
      status: 'unjudged',
      reason: 'collection-truncated',
      counts: { files: mdFiles.length, read: texts.size, evidenceOmitted: omitted },
      evidence,
    };
  }

  // 이름 → 실재 여부. `[[name]]` · `[name]` 은 경로가 아니라 이름이다.
  const byName = new Set<string>();
  for (const f of mdFiles) {
    const base = f.split('/').pop()!;
    byName.add(base.replace(/\.[^.]+$/, ''));
  }

  const unresolved: Unresolved[] = [];
  let scanned = 0;
  let excused = 0;
  let external = 0;

  for (const [file, text] of texts) {
    const lines = text.split('\n');
    const dir = dirOf(file);
    for (const ref of extract(file, text)) {
      scanned += 1;
      if (ref.line >= 2 && isExcuse(lines[ref.line - 2] ?? '')) {
        excused += 1;
        continue;
      }
      const verdict = resolveOne(ref, dir, byName, index);
      if (verdict === EXTERNAL) external += 1;
      else if (verdict) unresolved.push(verdict);
    }
  }

  const { evidence, omitted } = capEvidence(
    unresolved.map((u): Evidence => ({
      file: u.file,
      line: u.line,
      notation: u.notation,
      raw: u.raw,
      why: u.why,
      tried: u.tried,
    })),
  );

  return {
    id: REFS_CHECK_ID,
    status: unresolved.length > 0 ? 'violation' : 'pass',
    reason: null,
    counts: {
      files: mdFiles.length,
      read: texts.size,
      notations: NOTATIONS.length,
      scanned,
      unresolved: unresolved.length,
      excused,
      external,
      evidenceOmitted: omitted,
    },
    evidence,
  };
}
