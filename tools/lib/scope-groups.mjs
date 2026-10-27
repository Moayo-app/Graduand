// 범위 묶음 가드 — 「§1 의 목록」을 **집행되는 선언**으로 만드는 자리.
//
// ⭐⭐ 분모의 사슬이 셋이다. 앞 둘은 이미 기계가 집행했다:
//   ⑴ 파일 전수 → 선언의 행   — checkScopeCoverage(「선언 밖 파일 0」)
//   ⑵ 선언의 행 → 실물        — checkScopeEntries(「허공을 가리키는 행 0」)
//   ⑶ 선언의 행 → §1 의 묶음  — **여기**. 그전까지는 사람이 손으로 셌다.
//
// ⚠️ 셋째 칸이 비어 있는 동안 범위 목록은 「이 목록이 범위의 정의다」라고 적으면서 실물과
// 갈라져도 **초록**이었다 — 「선언했는데 집행되지 않음」이고, 이 저장소가 파는 바로 그
// 결함이다. 가드가 자기 집에서 그 결함을 들고 있는 것이 이 모듈이 선 이유다.
//
// ⭐ 뜻의 정본과 배정의 정본을 나눈다 — 묶음 **이름**의 정본은 §1 의 표(산문)이고, 경로 →
// 묶음의 **배정**은 선언의 `group` 축이다. 그래서 이 모듈은 둘을 **양방향으로** 묶는다:
// 표에 없는 이름을 쓰면 빨갛고, 표에 있는데 아무 행도 쓰지 않는 묶음도 빨갛다. 한 방향만
// 재면 둘 중 한쪽이 조용히 낡는다.
//
// 각 check* 는 위반 문자열 배열을 돌려준다 — 빈 배열이 초록이다. root 를 받는 이유는
// negative 테스트가 사본 트리에 위반을 심고 빨간불을 확인하기 위해서다.
import { SCOPE_PATH, SCOPE_GROUPS_DOC, read, scopeEntries, walkFiles, coveringEntry } from './public-scope.mjs';

/** 표를 찾는 닻. ⚠️ 이 줄이 바뀌면 declaredGroups 가 **던진다** — 분모 0 으로 초록이 되지 않는다. */
export const GROUPS_TABLE_HEADER = '| 묶음 | 무엇이 드는가 |';

/** 외부 독자가 읽는 자리. 표를 보러 부트스트랩 문서로 오지 않으므로 열거가 한 벌 더 산다. */
export const GROUPS_ECHO = 'README.md';

/**
 * §1 의 표 → 묶음 이름들. **묶음 이름의 정본이 여기다.**
 *
 * ⚠️⚠️ 표를 못 찾으면 **던진다.** 빈 배열을 돌려주면 아래 모든 검사가 「위반 0」으로
 * 초록이 되는데, 그것은 「묶음이 다 맞다」가 아니라 **아무것도 읽지 않았다**이다 —
 * 미판정을 통과로 그리는 그 모양이라 이 저장소의 규율이 금지한다.
 */
export function declaredGroups(root) {
  const lines = read(root, SCOPE_GROUPS_DOC).split('\n');
  const head = lines.indexOf(GROUPS_TABLE_HEADER);
  if (head === -1)
    throw new Error(`${SCOPE_GROUPS_DOC}: 묶음 표의 머리(「${GROUPS_TABLE_HEADER}」)를 찾지 못했다 — 범위 정의의 정본이 그 표다`);
  const groups = [];
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith('|')) break;
    const cell = line.split('|')[1].trim().replace(/\*\*/g, '').trim();
    if (cell) groups.push(cell);
  }
  if (groups.length === 0) throw new Error(`${SCOPE_GROUPS_DOC}: 묶음 표에 행이 없다 — 분모가 비면 아래 비교는 아무것도 재지 않는다`);
  const dup = groups.filter((g, i) => groups.indexOf(g) !== i);
  if (dup.length) throw new Error(`${SCOPE_GROUPS_DOC}: 묶음 「${dup[0]}」 이 표에 두 번 있다`);
  return groups;
}

/** 묶음 → 그 묶음에 드는 파일 수. AC1 의 요약 줄이 읽는 자리다. */
export function groupTally(root) {
  const entries = scopeEntries(root);
  const tally = new Map(declaredGroups(root).map((g) => [g, 0]));
  const orphans = [];
  for (const file of walkFiles(root)) {
    const group = coveringEntry(entries, file)?.[5];
    if (group === undefined || !tally.has(group)) orphans.push([file, group ?? null]);
    else tally.set(group, tally.get(group) + 1);
  }
  return { tally, orphans, total: walkFiles(root).length };
}

/**
 * AC1 — 파일 전수가 묶음을 받는다.
 *
 * ⭐ checkScopeCoverage 와 **겹치는 것이 의도다.** 저쪽은 「선언에 들었는가」를 묻고 이쪽은
 * 「§1 의 말로 무엇인가」를 묻는다 — 선언은 그대로인데 묶음이 움직이는 날, 우는 쪽이 이쪽이다.
 * ⚠️ 그리고 분모를 따로 단정한다: 전수가 0 이면 아래 비교는 전부 공짜로 초록이다.
 */
export function checkFileGroups(root) {
  const { tally, orphans, total } = groupTally(root);
  const errors = [];
  if (total === 0) errors.push(`${SCOPE_GROUPS_DOC}: 잴 파일이 0 이다 — 분모가 비면 「묶음 밖 0」은 아무것도 뜻하지 않는다`);
  for (const [file, group] of orphans)
    errors.push(
      group === null
        ? `묶음 밖 파일: ${file} — 덮는 행이 없다 (${SCOPE_PATH} 에 행을 더하라)`
        : `묶음 밖 파일: ${file} — 덮는 행의 group 「${group}」 이 ${SCOPE_GROUPS_DOC} §1 의 표에 없다`,
    );
  for (const [group, n] of tally)
    if (n === 0) errors.push(`${SCOPE_GROUPS_DOC}: 묶음 「${group}」 에 드는 파일이 0 이다 — 범위 정의가 실물 없는 항을 들고 있다`);
  return errors;
}

/** AC3 — 선언이 쓰는 묶음이 전부 §1 의 표에 있다. (표 → 선언 방향은 checkGroupsUsed 다.) */
export function checkGroupNames(root) {
  const groups = declaredGroups(root);
  return scopeEntries(root)
    .filter(([, , , , , group]) => !groups.includes(group))
    .map(([p, , , , , group]) => `${SCOPE_PATH}: 「${p}」 의 group 「${group}」 이 ${SCOPE_GROUPS_DOC} §1 의 표에 없다`);
}

/**
 * AC4 — 아무 행도 가리키지 않는 묶음이 0 이다.
 *
 * ⭐ 「허공을 가리키는 행 0」(checkScopeEntries)의 **반대 방향**이다. 실물 없는 묶음은 범위를
 * 조용히 넓힌다 — 읽는 사람은 그 항이 담긴다고 읽는데 담기는 것이 아무것도 없다.
 */
export function checkGroupsUsed(root) {
  const used = new Set(scopeEntries(root).map(([, , , , , group]) => group));
  return declaredGroups(root)
    .filter((g) => !used.has(g))
    .map((g) => `${SCOPE_GROUPS_DOC}: 묶음 「${g}」 을 쓰는 행이 ${SCOPE_PATH} 에 없다 — 아무것도 가리키지 않는 묶음이다`);
}

/**
 * AC6 — 외부 독자가 읽는 열거가 표와 같은 묶음을 부른다.
 *
 * ⚠️ **한 방향만 잰다** — 표의 이름이 README 에 있는가. 반대 방향(README 에만 있는 낱말)은
 * 재지 않는다: 산문이 묶음 이름을 다른 문맥에서 쓰는 것은 결함이 아니고, 그것까지 물면
 * 이 가드가 문장을 검열하게 된다. checkLicenseGrounds 가 같은 이유로 같은 선택을 한다.
 *
 * ⚠️ 줄바꿈을 지우고 찾는다 — 이름이 줄 끝에서 접히는 것은 조판이지 갈라짐이 아니다.
 */
export function checkGroupEcho(root) {
  const prose = read(root, GROUPS_ECHO).replace(/\s+/g, ' ');
  return declaredGroups(root)
    .filter((g) => !prose.includes(g.replace(/\s+/g, ' ')))
    .map((g) => `${GROUPS_ECHO}: 묶음 「${g}」 이 불리지 않는다 — ${SCOPE_GROUPS_DOC} §1 의 표가 그것을 범위로 적는다`);
}
