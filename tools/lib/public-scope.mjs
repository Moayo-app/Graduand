// 공개 범위 가드의 공유 모듈 — [ISSUE-16] (선언 정본 config/public-scope.yml).
//
// 재는 것 셋 + 하나. ⑴ **선언 밖 파일이 0** 인가(AC2) ⑵ **배달된 산문에 내부 표기가 0** 인가(AC3)
// ⑶ **허가 없이 공개되는 경로가 0** 인가 — 행마다 `license` 가 서 있고, 그 값이 사유 문서에
// 불리는가. ⚠️ 셋째는 침묵을 겨냥한다: 기본값은 all rights reserved 라서 **적지 않으면 닫힌다.**
// 그리고 `mirrors` 축이 **사본을 선언으로 들고 있다** — 그 대조는 license-copy.mjs 가 한다.
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

/** 그 경로에 붙는 허가. ⛔ 닫힌 목록이다 — 모르는 값은 던진다(새 허가는 사유와 함께 들어온다).
 *
 * ⚠️ `reserved` 가 「아직 안 정했다」가 아니다. **정해서 닫은 것**이고, 그 둘을 한 값으로
 * 적으면 미판정이 결정으로 읽힌다 — 이 저장소가 파는 바로 그 혼동이다. 미정은 값이 없고,
 * 값이 없으면 scopeEntries 가 던진다. */
export const LICENSES = ['BSL-1.1', 'Apache-2.0', 'reserved', 'upstream'];

/** 허가 묶음마다의 **사유**. 배정(선언의 license 축)과 사유를 나눠 둔 쪽. */
export const LICENSE_GROUNDS = 'docs/licensing/repository-licensing.md';

/** 묶음 이름의 정본 — §1 의 표. ⚠️ 여기 적는 것은 **어느 문서인가**뿐이고, 표를 읽는 일은
 * scope-groups.mjs 가 한다. 파서가 산문을 읽기 시작하면 둘이 한 몸이 된다. */
export const SCOPE_GROUPS_DOC = 'CLAUDE.md';

/** 선언된 미러 → [[사본 경로, 정본 경로]].
 *
 * ⭐⭐ 사본을 피할 수 없는 자리를 **선언으로** 들고 있는 축이다. 루트 `LICENSE` 는 저장소의
 * 공개 얼굴이라 루트에 있어야 하고, 증서의 정본은 발행본이 싣는 `verifier/LICENSE` 다.
 * ⇒ 손으로 맞추는 대신 **적는다**: 배달이 이것을 읽어 따라 쓰고, 가드가 바이트까지 댄다.
 *
 * ⚠️ 배달이 `origin: workshop` 접두사 **밖**을 건드리는 유일한 길이므로, 경로가 스크립트가
 * 아니라 여기 있는 것이 요점이다 — 예외가 선언 안에 있어야 「선언이 분모」가 깨지지 않는다. */
export const mirrorPairs = (root) =>
  scopeEntries(root)
    .filter(([, , , , mirrors]) => mirrors)
    .map(([p, , , , mirrors]) => [p, mirrors]);

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

/** 선언 → [경로, origin, 근거, 허가, 미러, 묶음][]. 모양이 틀리면 던진다 — 조용히 건너뛰면 그 행이 없는 것과 같다.
 *
 * ⭐ `license` 가 **필수**인 것이 이 축의 요점이다: 새 경로는 행을 요구하고, 행은 허가를
 * 요구한다 ⇒ 어떤 파일도 「허가 없이 공개」로 **조용히 떨어질 수 없다**. `group` 도 같은
 * 이유로 필수다 — 빠지면 그 경로가 **범위 정의 밖에서** 공개된다.
 *
 * ⚠️ `group` 은 **모양만** 여기서 본다(빈 칸 금지). 값이 §1 의 묶음인지는 scope-groups.mjs
 * 가 묻는다 — 뜻의 정본이 산문이라, 그것을 읽는 일을 파서에 넣으면 파서가 문서에 매인다
 * (`license` 의 닫힌 목록 ↔ checkLicenseGrounds 와 같은 나눔이다). */
export function scopeEntries(root) {
  const { entries } = loadScope(root);
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`${SCOPE_PATH}: entries 가 비었다 — 선언이 분모다`);
  return entries.map((e, i) => {
    const label = `${SCOPE_PATH} entries[${i}]`;
    if (typeof e?.path !== 'string' || !e.path) throw new Error(`${label}: path 가 없다`);
    if (e.path.startsWith('/') || e.path.includes('..')) throw new Error(`${label}: path 가 저장소 상대경로가 아니다 — ${e.path}`);
    if (!ORIGINS.includes(e.origin)) throw new Error(`${label}: origin 이 ${ORIGINS.join('·')} 중 하나가 아니다 — ${e.origin}`);
    if (typeof e?.basis !== 'string' || !e.basis.trim()) throw new Error(`${label}: basis 가 없다 — 행마다 근거 필수다`);
    if (typeof e?.group !== 'string' || !e.group.trim())
      throw new Error(`${label}: group 이 없다 — 행마다 묶음 필수다 (${SCOPE_GROUPS_DOC} §1 의 표가 그 이름의 정본이다)`);
    if (!LICENSES.includes(e.license))
      throw new Error(
        `${label}: license 가 ${LICENSES.join('·')} 중 하나가 아니다 — ${e.license} (빈 칸은 「미정」이 아니라 all rights reserved 다)`,
      );
    if (e.mirrors !== undefined) {
      // ⛔ 모양이 틀린 미러는 **조용히 무시하지 않는다** — 무시된 미러는 배달이 따라 쓰지
      //    않는 사본이 되고, 그 사본은 손으로 맞춰지지도 않으면서 초록으로 남는다.
      if (typeof e.mirrors !== 'string' || !e.mirrors.trim()) throw new Error(`${label}: mirrors 가 경로가 아니다`);
      if (e.mirrors.startsWith('/') || e.mirrors.includes('..')) throw new Error(`${label}: mirrors 가 저장소 상대경로가 아니다 — ${e.mirrors}`);
      if (e.mirrors === e.path) throw new Error(`${label}: mirrors 가 자기 자신을 가리킨다 — ${e.path}`);
      if (e.path.endsWith('/')) throw new Error(`${label}: 디렉터리 접두사는 미러가 될 수 없다 — 바이트 사본은 파일 하나다 (${e.path})`);
      // ⚠️ 미러는 배달받는 것이 아니라 배달이 **유도하는** 파생물이다 — origin 이 그 사실을 말한다.
      if (e.origin !== 'local') throw new Error(`${label}: 미러 행의 origin 은 local 이다 — 배달받는 것이 아니라 유도되는 것이다 (${e.origin})`);
    }
    return [e.path, e.origin, e.basis, e.license, e.mirrors ?? null, e.group];
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
  // 미러가 가리키는 정본도 선언에 덮여 있어야 한다 — 선언 밖 정본은 배달이 나르지 않으므로
  // 그 미러는 영원히 제 바이트를 못 받는다.
  for (const [mirror, canon] of mirrorPairs(root)) {
    if (!fs.existsSync(path.join(root, canon)))
      errors.push(`${SCOPE_PATH}: 「${mirror}」 의 정본 「${canon}」 이 실재하지 않는다`);
    else if (!coveringEntry(entries, canon))
      errors.push(`${SCOPE_PATH}: 「${mirror}」 의 정본 「${canon}」 이 선언 밖이다 — 배달이 나르지 않는 것을 정본으로 삼았다`);
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

/**
 * 선언이 쓰는 허가마다 **사유가 적혀 있는가** — 배정과 사유가 갈라지지 않게.
 *
 * ⭐⭐ 왜 이 방향만 재는가. 배정의 정본은 선언이고 사유의 정본은 문서다 — 같은 사실을 두 번
 * 적지 않으므로 둘을 바이트로 비교할 수 없다. 대신 **쓰이는 값의 집합**이 문서에 전수
 * 등장하는지를 잰다: 새 허가를 선언에 적고 사유를 안 적는 그 한 번이 이 가드의 표적이다.
 *
 * ⚠️ 반대 방향(문서에만 있고 선언에 없는 값)은 **재지 않는다** — 쓰지 않게 된 허가의 사유가
 * 문서에 남는 것은 결함이 아니고, 이 저장소는 선언된 갈라짐을 사유와 함께 남긴다.
 */
export function checkLicenseGrounds(root) {
  const used = [...new Set(scopeEntries(root).map(([, , , license]) => license))].sort();
  if (used.length === 0) throw new Error(`${SCOPE_PATH}: 쓰이는 허가가 0 이다 — 분모가 비면 아래 비교는 아무것도 재지 않는다`);
  const grounds = read(root, LICENSE_GROUNDS);
  return used
    .filter((license) => !grounds.includes(license))
    .map((license) => `${LICENSE_GROUNDS}: 허가 「${license}」 의 사유가 없다 — ${SCOPE_PATH} 가 그 값을 쓰고 있다`);
}
