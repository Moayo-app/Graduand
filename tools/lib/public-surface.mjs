// 공개 표면 가드 — 외부 독자가 읽는 산문이 비공개 쪽의 이름·내부 티켓 표기를 말하지 않는다.
//
// 정책 가드(policy.mjs)와 모집단이 다르다: 저쪽은 정책 문서 6벌이고 이쪽은 「기여자가 읽는
// 산문」이다. 그래서 겸하지 않고 모듈을 따로 둔다 — 한 함수가 두 모집단을 세면 어느 쪽
// 기준으로도 옳은 회색이 생긴다.
//
// ⭐ 패턴은 **이름을 적지 않고 모양을 적는다.** 이 파일도 공개 표면에 있어서, 금칙 목록에
// 비공개 저장소 이름을 박으면 가드 자신이 누설의 자리가 된다. 모양으로 적으면 형제 저장소가
// 늘어도 같은 가드가 잡는다.
//
// ⚠️ 이 가드는 사람의 눈을 대체하지 않고 고정한다 — 패턴 밖의 누설은 여전히 사람이 읽어야
// 잡힌다. 모양이 평범한 낱말을 물면(예: 「…-platform」) 고칠 곳은 문면이거나 이 목록이고,
// 둘 중 어느 쪽인지는 사람이 정한다.
import fs from 'node:fs';
import path from 'node:path';

/** 모집단 — 외부 독자를 향해 쓴 산문. 세션 부트스트랩(CLAUDE.md)은 작업자용이라 밖이다. */
export const PUBLIC_PROSE = ['CONTRIBUTING.md'];

/** 누설의 모양 — [정규식, 무엇으로 읽히는가]. */
export const LEAK_PATTERNS = [
  [/[A-Za-z0-9]+[_-]dev\b/i, '비공개 작업장으로 읽히는 저장소 이름'],
  [/[A-Za-z0-9]+[_-]hq\b/i, '비공개 회사 저장소로 읽히는 이름'],
  [/[A-Za-z0-9]+[_-]platform\b/i, '내부 플랫폼 저장소로 읽히는 이름'],
  [/\bADR-\d/i, '내부 결정 기록 번호'],
  [/\bISSUE-\d/i, '내부 티켓 번호'],
  [/[\w.-]+\/[\w.-]+#\d+/, '저장소를 건너가는 티켓 참조'],
  [/(?:^|[\s(\[])#\d+/m, '맨 이슈 번호 — 외부 독자에게 어느 저장소의 것인지 말해주지 않는다'],
];

/** 한 문면의 누설 — 위반 문자열 배열을 낸다. 빈 배열이 초록이다. */
export function checkProseLeaks(text, label = '공개 산문') {
  const errors = [];
  for (const [re, what] of LEAK_PATTERNS) {
    const m = text.match(re);
    if (m) errors.push(`${label}: ${what} — 「${m[0].trim()}」`);
  }
  return errors;
}

/**
 * ⛔⛔ **비공개 작업장의 이름 — 모집단이 저장소 전수다.** 위 `PUBLIC_PROSE` 는 「외부 독자를
 * 향해 쓴 산문」이라 좁고, 그래서 **세션 부트스트랩이 밖**이었다(축자: 「작업자용이라 밖이다」).
 *
 * ⚠️⚠️ **그 면제의 전제가 공개 전환에서 깨진다** — 작업자용 파일이 외부 독자 앞에 놓인다.
 * 누출 심사(2026-10-27)가 실제로 그 구멍에서 세 줄을 찾았고, 상류 결의 축자가 그 모양을
 * **단독 기각 사유**로 부른다. ⇒ 이 한 모양만은 **분모를 전수로** 올린다.
 *
 * ⛔ **면제가 없다.** 비공개의 존재를 공개 표면이 이름으로 부르면 그 이름이 곧 공격 면이고,
 * 「개발이 여기서 일어나지 않는다」는 사실은 이름 없이도 전부 선다. ⚠️ 나머지 모양
 * (`…-hq` · `…-platform` · 내부 티켓)은 **아직 이 분모에 올리지 않는다** — 그 자리들은 결정이
 * 남아 있고, 안 정한 것을 가드로 굳히면 가드가 결정을 대신하게 된다.
 */
export const WORKSHOP_NAME = /[A-Za-z0-9]+_dev\b/;

/** 저장소 전수에서 그 이름을 센다 — 바이너리와 미추적 자리는 분모가 아니다. */
export function checkWorkshopName(root, files) {
  const errors = [];
  for (const rel of files) {
    if (/\.(png|jpg|jpeg|ico|woff2?|svg|lock)$/.test(rel)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    for (const [i, line] of text.split('\n').entries()) {
      const m = line.match(WORKSHOP_NAME);
      if (m) errors.push(`${rel}:${i + 1}: 비공개 작업장의 이름 — 「${m[0]}」 (이름 없이 적는다)`);
    }
  }
  return errors;
}

/**
 * ⭐⭐ **비공개 쪽을 가리키는 포인터의 꼴** — 누출 심사(2026-10-27)가 정한 규칙을 집행한다.
 *
 * 규칙: **「비공개」와 「무엇의 정본인가」만 적는다** — 저장소 이름 · 티켓 번호 · 링크는
 * 적지 않는다. 사유 둘: ⑴ 이름은 **공격 면**이다(작업장 이름을 걷은 것과 같은 사유)
 * ⑵ 번호는 공개 독자에게 **404 로 끝나는 포인터**다 — 있는데 못 보는 것은 외부 사실도
 * 계약도 아니다. ⭕ 포인터 **자체**는 남는다: 「정본이 여기 없다」는 이 저장소가 선언한
 * 규율이고(정본 선언표), 그 사실은 이름 없이 선다.
 *
 * ⛔ **`…-platform` 은 이 목록에 없다 — 막을 수 없어서가 아니라 막으면 거짓이 되기 때문이다.**
 * 워크플로가 그 저장소의 액션을 `uses:` 로 부른다(`…/shared-block-guard@main`) — **기능
 * 참조**라 지우면 잡이 돌지 않는다. 금칙을 걸고 면제로 빼면 그 면제가 금칙을 삼킨다.
 */
const POINTER_PATTERNS = [
  [/[A-Za-z0-9]+-hq\b/i, '회사 층 저장소의 이름'],
  [/\[ISSUE-\d+\]/i, '내부 티켓 번호 — 공개 독자가 누르면 404 다'],
  [/\bADR-\d/i, '내부 결정 기록 번호'],
];

/**
 * 분모 — **손으로 고칠 수 있는 자리**. ⚠️ `origin: platform` 항은 드리프트 가드가 손편집을
 * 막으므로(그 파일들의 머리가 축자로 「손으로 고치지 말 것」) 이 모집단 밖이다. ⛔ 그것은
 * 「위반 0」이 아니라 **고칠 자리가 다른 저장소**라는 뜻이고, 누출 심사가 그 셋을 따로 든다.
 */
export function editableFiles(root, files, originOf) {
  return files.filter((rel) => originOf(rel) !== 'platform');
}

/** 손으로 고칠 수 있는 자리에 내부 포인터가 0 이다. */
export function checkInternalPointers(root, files) {
  const errors = [];
  for (const rel of files) {
    if (/\.(png|jpg|jpeg|ico|woff2?|svg|lock)$/.test(rel)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    for (const [i, line] of text.split('\n').entries()) {
      for (const [re, what] of POINTER_PATTERNS) {
        const m = line.match(re);
        if (m) errors.push(`${rel}:${i + 1}: ${what} — 「${m[0]}」 (「비공개」와 무엇의 정본인가만 적는다)`);
      }
    }
  }
  return errors;
}

/** 모집단 전수. root 를 받는 이유는 negative 테스트가 사본에 누설을 심기 위해서다. */
export function checkPublicProse(root, files = PUBLIC_PROSE) {
  const errors = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      errors.push(`없는 문서: ${rel} — 공개 생성물의 머리말이 이 경로를 가리킨다`);
      continue;
    }
    errors.push(...checkProseLeaks(fs.readFileSync(abs, 'utf8'), rel));
  }
  return errors;
}
