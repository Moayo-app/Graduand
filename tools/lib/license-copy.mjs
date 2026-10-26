// 증서 가드의 공유 모듈 — 발행본이 싣는 증서가 루트의 정본과 **같은가**, 그리고 Terms
// 블록의 칸들이 **서 있는가**.
//
// ⭐⭐ 왜 사본이 하나 있는가. BSL 1.1 축자가 「You must conspicuously display this License
// on each original or modified copy of the Licensed Work」 이고, 발행되는 npm 패키지가 그
// copy 다. npm 은 패키지 루트(`verifier/`) 밖의 파일을 실을 수 없으므로 증서는 그 안에
// **있어야** 한다. ⇒ 사본을 피할 수 없으면 **갈라짐을 재는** 것이 답이다 — 이 저장소가
// 생성물에 쓰는 그 규율(사본 금지가 아니라 드리프트 가드)을 증서에 적용한 자리다.
//
// ⭐ 이 가드의 표적은 막연한 「언젠가의 드리프트」가 아니다 — Change Date 는 **발행마다**
// 그 판의 값으로 다시 박히므로(증서 자신이 「the Change Date may vary for each version」을
// 허용한다), 한쪽만 박고 넘어가는 그 한 번이 이 가드가 기다리는 사건이다.
//
// 각 check* 는 위반 문자열 배열을 돌려준다 — 빈 배열이 초록이다. root 를 받는 이유는
// negative 테스트가 사본 트리에 갈라짐을 심고 빨간불을 확인하기 위해서다.
import fs from 'node:fs';
import path from 'node:path';

/** 증서의 정본과, 발행본이 싣는 그 사본. */
export const CANON = 'LICENSE';
export const PACKAGED_COPY = 'verifier/LICENSE';

/** Covenants 가 요구하는 칸들 — 이름이 하나 사라지면 증서가 칸을 잃는다. */
export const TERMS_FIELDS = ['Licensor:', 'Licensed Work:', 'Additional Use Grant:', 'Change Date:', 'Change License:'];

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** 두 증서가 바이트까지 같은가. ⛔ 분모가 빈 채로 초록이 되지 않는다 — 둘 다 비어도 「같다」는 참이다. */
export function checkPackagedCopy(root) {
  const errors = [];
  const canon = read(root, CANON);
  if (canon.length < 2000) return [`${CANON} 가 증서로 보기에 너무 짧다 (${canon.length}바이트) — 분모가 비면 아래 비교는 아무것도 재지 않는다`];
  if (read(root, PACKAGED_COPY) !== canon)
    errors.push(`${PACKAGED_COPY} 가 ${CANON} 와 갈라졌다 — 고치는 자리는 ${CANON} 이고 사본은 그것을 그대로 받는다`);
  return errors;
}

/**
 * Terms 블록의 칸 전수, 그리고 **미결이 미결로 적혀 있는가.**
 *
 * ⭐ Change Date 는 아직 값이 없다 — 실모듈이 발행된 적이 없고 값이 「그 판의 발행일 +
 * 4년」이다. 빈 칸은 조용하고 지어낸 날짜는 거짓이라, 증서에서 `UNSET` 으로 **읽혀야**
 * 한다. 발행 절차가 그 문자열을 찾아 그 판의 값으로 바꾼다. ⇒ 날짜가 박히는 날 이 단정은
 * **지워진다**(그때 이 줄이 그 사실을 말해 준다).
 */
export function checkTermsBlock(root) {
  const errors = [];
  const canon = read(root, CANON);
  for (const field of TERMS_FIELDS)
    if (!canon.includes(field)) errors.push(`${CANON}: 「${field}」 칸이 없다 — Covenants of Licensor 가 요구하는 칸이다`);
  if (!/^Change Date:\s+UNSET\./m.test(canon))
    errors.push(`${CANON}: Change Date 칸이 UNSET 로 읽히지 않는다 — 날짜가 박혔다면 이 단정을 지운다`);
  return errors;
}
