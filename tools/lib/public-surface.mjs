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
