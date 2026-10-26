// 공개 범위 가드의 공유 모듈 — [ISSUE-16] (선언 정본 config/public-scope.yml).
//
// 재는 것 둘. ⑴ **선언 밖 파일이 0** 인가(AC2) ⑵ **배달된 산문에 내부 표기가 0** 인가(AC3).
//
// ⭐ 모집단 단일화 — scopeEntries() 한 함수가 선언을 읽고, 두 가드가 그것만 쓴다. AC3 의
// 분모를 테스트에 적지 않는다: `origin: workshop` 항들이 그 분모이고, 그래서 배달 범위가
// 늘면 스윕 대상도 **자동으로** 늘어난다. 하드코딩한 목록은 범위가 움직일 때 조용히 뒤처진다.
//
// ⭐ 미추적 분모도 사본을 만들지 않는다 — 걸러낼 디렉터리는 .gitignore 에서 **유도**한다.
// 여기 `node_modules/` 를 적으면 .gitignore 와 갈라지고, 갈라진 뒤에도 둘 다 자기 기준으로는
// 옳다. 각 check* 는 위반 문자열 배열을 돌려준다 — 빈 배열이 초록이다. root 를 받는 이유는
// negative 테스트가 사본 트리에 위반을 심고 빨간불을 확인하기 위해서다.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const SCOPE_PATH = 'config/public-scope.yml';

/** 정본이 어디 사는가. workshop 항만 내부 산문 스윕의 대상이다. */
export const ORIGINS = ['local', 'platform', 'workshop'];

/** 어떤 선언에도 들지 않는 이름 — 발행되지 않고 .gitignore 가 말할 대상도 아니다.
 * ⚠️ 디렉터리가 아닐 수 있다: 워크트리에서 `.git` 는 **파일**이다. */
export const NEVER_WALKED = ['.git'];

export const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

export const loadScope = (root) => yaml.load(read(root, SCOPE_PATH));

/** 미추적 분모 — .gitignore 의 디렉터리 줄에서 유도한다. 여기에 목록을 적지 않는다.
 *
 * ⚠️ .gitignore 의 두 모양을 가른다: 가운데 `/` 가 없는 줄(`node_modules/`)은 **어느 깊이의
 * 같은 이름이든** 가리키고, 경로 모양인 줄(`verifier/dist/`)은 루트에 매인 한 자리다.
 * 둘을 같게 다루면 받은 패키지 안의 `node_modules/` 가 주사에 섞여 들어온다. */
export function ignoredDirs(root) {
  const dirs = read(root, '.gitignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.endsWith('/'))
    .map((l) => l.replace(/^\/+/, ''));
  if (dirs.length === 0) throw new Error('.gitignore 에 디렉터리 줄이 없다 — 미추적 분모가 이 파일에서 유도된다');
  return {
    names: dirs.filter((d) => !d.slice(0, -1).includes('/')).map((d) => d.slice(0, -1)),
    paths: dirs.filter((d) => d.slice(0, -1).includes('/')),
  };
}

/** 선언 → [경로, origin, 근거][]. 모양이 틀리면 던진다 — 조용히 건너뛰면 그 행이 없는 것과 같다. */
export function scopeEntries(root) {
  const { entries } = loadScope(root);
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`${SCOPE_PATH}: entries 가 비었다 — 선언이 분모다`);
  return entries.map((e, i) => {
    const label = `${SCOPE_PATH} entries[${i}]`;
    if (typeof e?.path !== 'string' || !e.path) throw new Error(`${label}: path 가 없다`);
    if (e.path.startsWith('/') || e.path.includes('..')) throw new Error(`${label}: path 가 저장소 상대경로가 아니다 — ${e.path}`);
    if (!ORIGINS.includes(e.origin)) throw new Error(`${label}: origin 이 ${ORIGINS.join('·')} 중 하나가 아니다 — ${e.origin}`);
    if (typeof e?.basis !== 'string' || !e.basis.trim()) throw new Error(`${label}: basis 가 없다 — 행마다 근거 필수다`);
    return [e.path, e.origin, e.basis];
  });
}

/** 선언 밖 전수 주사용 파일 목록 — .gitignore 가 유도한 자리를 걷어낸 상대경로들. */
export function walkFiles(root) {
  const ignored = ignoredDirs(root);
  const skipDir = (rel, name) => ignored.names.includes(name) || ignored.paths.some((p) => `${rel}/` === p);
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir === '' ? root : path.join(root, dir), { withFileTypes: true })) {
      const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
      if (NEVER_WALKED.includes(entry.name)) continue;
      if (entry.isDirectory()) {
        if (!skipDir(rel, entry.name)) walk(rel);
      } else {
        out.push(rel);
      }
    }
  };
  walk('');
  return out.sort();
}

/** 한 경로가 어느 선언 항에 덮이는가 — 디렉터리 접두사(`/` 끝)이거나 파일 일치. */
export const coveringEntry = (entries, file) =>
  entries.find(([p]) => (p.endsWith('/') ? file === p.slice(0, -1) || file.startsWith(p) : file === p)) ?? null;

/** AC2 — 선언에 없는 경로가 이 저장소에 0 이다. ⚠️ allowlist 라서 빠뜨림이 빨강이다. */
export function checkScopeCoverage(root) {
  const entries = scopeEntries(root);
  const errors = [];
  for (const file of walkFiles(root))
    if (!coveringEntry(entries, file))
      errors.push(`선언 밖 파일: ${file} — ${SCOPE_PATH} 에 행을 더하거나 이 파일을 공개 범위에서 빼라 (AC2)`);
  return errors;
}

/** 선언 자신의 건강 — 중복 행 0, 그리고 **허공을 가리키는 행 0.**
 *
 * ⭐ 이 방향도 재는 이유: 실물 없는 행은 범위를 **조용히 넓힌다**(배달 쪽이 그 경로를 열어
 * 둔 채 아무것도 보내지 않으므로 아무도 눈치채지 못한다). allowlist 가 안전한 쪽으로
 * 깨지려면 선언과 실물이 양방향으로 1:1 이어야 한다. */
export function checkScopeEntries(root) {
  const entries = scopeEntries(root);
  const errors = [];
  const paths = entries.map(([p]) => p);
  for (const dup of paths.filter((p, i) => paths.indexOf(p) !== i)) errors.push(`${SCOPE_PATH}: 「${dup}」 가 두 번 선언됐다`);
  const files = walkFiles(root);
  for (const [p] of entries) {
    if (p.endsWith('/')) {
      if (!fs.existsSync(path.join(root, p))) errors.push(`${SCOPE_PATH}: 「${p}」 디렉터리가 실재하지 않는다`);
      else if (!files.some((f) => f.startsWith(p))) errors.push(`${SCOPE_PATH}: 「${p}」 아래에 추적되는 파일이 없다 — 빈 선언은 범위를 조용히 넓힌다`);
    } else if (!fs.existsSync(path.join(root, p))) {
      errors.push(`${SCOPE_PATH}: 「${p}」 가 실재하지 않는다 — 허공을 가리키는 선언이다`);
    }
  }
  return errors;
}

/** AC3 의 분모 — `origin: workshop` 항에 덮이는 실제 파일들.
 *
 * ⭐⭐ 따로 내놓는 이유. 분모가 빈 채로 스윕이 도는 날, checkWorkshopProse 는 **초록**이다 —
 * 「내부 산문 0」이 아니라 **아무것도 읽지 않았다**인데 같은 초록으로 그려진다. 이 제품이
 * 파는 규율(미판정은 통과가 아니다)을 이 저장소의 가드 자신이 어기는 자리라, 분모를 세는
 * 함수를 내놓고 테스트가 「0 이 아니다」를 따로 단정한다.
 *
 * ⚠️⚠️ **묻는 순서가 뜻을 바꾼다.** 먼저 workshop 항만 골라 놓고 묻으면, 그 파일을 **더
 * 앞에서 덮는 `local` 행이 경쟁에 끼지 못한다** — 배달 디렉터리 안에 이 저장소가 쓴 파일이
 * 하나라도 있으면(증서 사본이 그렇다) 그 파일이 「배달된 것」으로 읽힌다. 그래서 **전수
 * 선언에 먼저 묻고**(coveringEntry 의 「먼저 매칭되는 행이 이긴다」) 그 **이긴 행의** origin
 * 을 본다. ⇒ 덮는 규칙이 라이브러리 전체에서 **하나**다: 두 함수가 다른 답을 주면, 둘 다
 * 자기 기준으로는 옳으면서 갈라진다. */
export function workshopFiles(root) {
  const entries = scopeEntries(root);
  if (!entries.some(([, origin]) => origin === 'workshop')) return [];
  return walkFiles(root).filter((f) => coveringEntry(entries, f)?.[1] === 'workshop');
}

/** AC3 — 배달된 파일(`origin: workshop`)에 내부 표기가 0 이다.
 *
 * ⚠️ 분모가 선언에서 온다 — `local`·`platform` 산문은 내부 포인터를 당연히 들고, 같은
 * 잣대로 재면 이 가드가 저장소 전체를 빨갛게 하고 뜻을 잃는다. 재지 않는 자리는
 * 「위반 0」이 아니라 **이 가드의 모집단 밖**이다. */
export function checkWorkshopProse(root) {
  const { forbidden_prose: forbidden } = loadScope(root);
  if (!Array.isArray(forbidden) || forbidden.length === 0) throw new Error(`${SCOPE_PATH}: forbidden_prose 가 비었다 — 금칙의 정본이 이 파일이다`);
  const errors = [];
  for (const file of workshopFiles(root)) {
    const text = read(root, file);
    for (const { pattern, why } of forbidden) {
      const re = new RegExp(pattern);
      for (const [i, line] of text.split('\n').entries()) {
        const m = line.match(re);
        if (m) errors.push(`${file}:${i + 1}: 내부 표기 「${m[0]}」 — ${why} (AC3)`);
      }
    }
  }
  return errors;
}
