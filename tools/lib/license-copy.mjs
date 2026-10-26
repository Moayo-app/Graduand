// 증서 가드의 공유 모듈 — 재는 것 셋.
//
//   ⑴ **선언된 미러가 제 정본과 바이트까지 같은가** (checkMirrors)
//   ⑵ **Terms 블록의 칸들이 서 있고 Change Date 칸이 읽히는 모양인가** (checkTermsBlock)
//   ⑶ **증서가 부르는 경로와 선언이 BSL 을 적은 경로가 같은가** (checkLicensedWorkScope)
//
// ⭐⭐ **증서의 정본은 `verifier/LICENSE` 다.** 작업장이 그것을 들고 배달이 나른다 — 루트
//    `LICENSE` 는 저장소의 **공개 얼굴**이고 선언의 `mirrors` 축이 그 사본임을 적는다.
//    ⚠️ 이 방향을 거꾸로 적으면 가드가 **발행 스탬프를 되돌리라고** 지시한다: 발행마다
//    Change Date 가 다시 박히는 자리는 정본 쪽이고, 루트는 날짜를 **가장 늦게** 아는 쪽이다.
//
// ⭐ 그래서 바이트 비교의 짝을 여기에 **박지 않는다** — 선언에서 읽는다. 사본이 하나 더
//    생기는 날(다른 패키지의 증서) 가드가 자동으로 그것을 센다.
//
// 각 check* 는 위반 문자열 배열을 돌려준다 — 빈 배열이 초록이다. root 를 받는 이유는
// negative 테스트가 사본 트리에 갈라짐을 심고 빨간불을 확인하기 위해서다.
import fs from 'node:fs';
import path from 'node:path';

import { SCOPE_PATH, scopeEntries, mirrorPairs } from './public-scope.mjs';

/** 증서의 정본 — 발행본이 싣는 그 파일이고, 발행마다 Change Date 가 여기 박힌다.
 *
 * ⭐ BSL 축자가 「You must conspicuously display this License on each original or modified
 * copy of the Licensed Work」 이고, 발행되는 npm 패키지가 그 copy 다. npm 은 패키지
 * 루트(`verifier/`) 밖의 파일을 실을 수 없으므로 증서는 그 안에 **있어야** 한다. */
export const CERTIFICATE = 'verifier/LICENSE';

/** Covenants 가 요구하는 칸들 — 이름이 하나 사라지면 증서가 칸을 잃는다. */
export const TERMS_FIELDS = ['Licensor:', 'Licensed Work:', 'Additional Use Grant:', 'Change Date:', 'Change License:'];

/**
 * Change Date 칸이 읽히는 **모양**.
 *
 * ⭐⭐ 여기가 **상태가 아니라 모양**을 적는 자리다. 전에는 「`UNSET` 이어야 한다」였고, 그것은
 * 「아직 발행하지 않았다」는 **상태**였다 — 상태는 만기가 온다: 날짜가 박히는 날 그 단정은
 * 거짓이 되므로 **발행 중에 가드를 느슨하게 하는** 일이 생겼다(단정을 지우는 손). 모양은
 * 만기가 오지 않는다. ⇒ 「미결이거나 ISO 날짜 하나」로 적으면 발행일에 지울 것이 없고,
 * **빈 칸과 지어낸 모양은 여전히 빨강**이다.
 *
 * ⛔ 「그 날짜가 맞는 값인가」는 재지 않는다 — 값은 「그 판의 발행일 + 4년」이고 발행일을
 *    저장소가 알지 못한다. 재지 않는 자리는 「옳다」가 아니라 이 가드의 모집단 밖이다.
 */
export const CHANGE_DATE = /^Change Date:[ \t]+(UNSET|\d{4}-\d{2}-\d{2})\./m;

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** 증서로 보기에 너무 짧은가 — 분모가 비면 아래 비교들이 아무것도 재지 않는다. */
const TOO_SHORT = 2000;

/**
 * ⑴ 선언된 미러가 제 정본과 **바이트까지** 같은가.
 *
 * ⭐ 짝이 선언(`mirrors` 축)에서 온다. 이 가드의 표적은 막연한 「언젠가의 드리프트」가
 * 아니다 — Change Date 는 **발행마다** 그 판의 값으로 다시 박히므로(증서 자신이 「the
 * Change Date may vary for each version」을 허용한다), 한쪽만 박고 넘어가는 그 한 번이
 * 이 가드가 기다리는 사건이다.
 *
 * ⛔ 분모가 빈 채로 초록이 되지 않는다 — 선언에 미러가 0 이어도, 둘 다 비어도 「같다」는 참이다.
 */
export function checkMirrors(root) {
  const pairs = mirrorPairs(root);
  if (pairs.length === 0) return [`${SCOPE_PATH}: mirrors 축을 쓰는 행이 0 이다 — 분모가 비면 이 가드는 아무것도 재지 않는다`];
  const errors = [];
  for (const [mirror, canon] of pairs) {
    const text = read(root, canon);
    if (text.length < TOO_SHORT) {
      errors.push(`${canon} 가 증서로 보기에 너무 짧다 (${text.length}바이트) — 분모가 비면 아래 비교는 아무것도 재지 않는다`);
      continue;
    }
    if (read(root, mirror) !== text)
      errors.push(
        `${mirror} 가 정본 ${canon} 와 갈라졌다 — ⛔ ${mirror} 를 손으로 고치지 않는다(다음 배달이 되돌린다). 고칠 자리는 작업장의 증서이고, 배달이 선언된 미러를 따라 쓴다`,
      );
  }
  return errors;
}

/**
 * ⑵ Terms 블록의 칸 전수, 그리고 Change Date 칸이 **읽히는 모양인가.**
 *
 * ⚠️ **정본을 읽는다.** 루트 미러를 읽으면 발행 내내 거짓 초록이 된다 — 날짜는 정본에 먼저
 * 박히고 미러는 배달이 따라 쓴 **뒤에야** 안다. 그 사이 「미결이다」가 참으로 그려지는 것이
 * 바로 미판정을 통과로 읽는 일이다.
 */
export function checkTermsBlock(root) {
  const errors = [];
  const text = read(root, CERTIFICATE);
  for (const field of TERMS_FIELDS)
    if (!text.includes(field)) errors.push(`${CERTIFICATE}: 「${field}」 칸이 없다 — Covenants of Licensor 가 요구하는 칸이다`);
  if (!CHANGE_DATE.test(text))
    errors.push(`${CERTIFICATE}: Change Date 칸이 「UNSET」 도 ISO 날짜(YYYY-MM-DD)도 아니다 — 빈 칸은 조용하고 지어낸 모양은 거짓이다`);
  return errors;
}

/** 선언이 「제품」이라고 적는 허가. 증서의 `Licensed Work` 가 그 모집단의 다른 쪽 얼굴이다. */
export const PRODUCT_LICENSE = 'BSL-1.1';

/**
 * 증서의 `Licensed Work` 칸 본문 — 다음 Terms 칸이 시작되기 전까지.
 *
 * ⚠️ 칸 이름은 **열 0 에서** 시작하고 본문은 들여쓰인다. 그 모양으로 끊는 이유는 칸의
 * **순서에 기대지 않기** 위해서다 — 「Additional Use Grant 까지」로 적으면 칸 순서가 바뀌는
 * 날 이 가드가 조용히 너무 많이(또는 너무 적게) 읽는다.
 */
export function licensedWorkBlock(text) {
  const m = text.match(/^Licensed Work:([\s\S]*?)(?=^[A-Z][A-Za-z][A-Za-z ]*:)/m);
  if (!m) throw new Error(`${CERTIFICATE}: 「Licensed Work:」 칸을 읽을 수 없다 — 이 가드의 분모가 그 칸이다`);
  return m[1];
}

/**
 * ⑶ 증서가 부르는 경로와 선언의 `license: BSL-1.1` 행이 **양방향 1:1** 인가.
 *
 * ⭐⭐ 왜 이 축이 필요한가. 같은 사실이 두 자리에 적힌다 — 증서는 법률 산문으로 디렉터리를
 * 부르고, 선언은 행마다 허가를 적는다. 둘 중 하나만 움직이는 날의 뜻이 **양쪽으로 나쁘다**:
 * 선언에만 BSL 을 적으면 증서가 덮지 않는 코드를 덮는다고 **주장**하게 되고(허가 없는 코드가
 * 유료 층으로 읽힌다), 증서에만 적으면 그 디렉터리는 선언에서 다른 허가를 받아 **두 증서가
 * 동시에** 걸린다. ⇒ 사본을 피할 수 없으면 갈라짐을 **잰다**.
 *
 * ⛔ 분모가 빈 채로 초록이 되지 않는다 — 양쪽 다 0 이어도 「같다」는 참이다.
 */
export function checkLicensedWorkScope(root) {
  const errors = [];
  const block = licensedWorkBlock(read(root, CERTIFICATE));
  const named = [...block.matchAll(/`([^`\n]+\/)`/g)].map((m) => m[1]);
  const declared = scopeEntries(root)
    .filter(([, , , license]) => license === PRODUCT_LICENSE)
    .map(([p]) => p);

  if (named.length === 0) errors.push(`${CERTIFICATE}: Licensed Work 가 경로를 하나도 부르지 않는다 — 아래 대조가 아무것도 재지 않는다`);
  if (declared.length === 0) errors.push(`${SCOPE_PATH}: license: ${PRODUCT_LICENSE} 행이 0 이다 — 아래 대조가 아무것도 재지 않는다`);
  if (errors.length > 0) return errors;

  for (const p of declared)
    if (!named.includes(p))
      errors.push(`${SCOPE_PATH}: 「${p}」 가 ${PRODUCT_LICENSE} 인데 ${CERTIFICATE} 의 Licensed Work 가 부르지 않는다 — 증서 없이 유료 층으로 읽힌다`);
  for (const p of named)
    if (!declared.includes(p))
      errors.push(`${CERTIFICATE}: Licensed Work 가 「${p}」 를 부르는데 ${SCOPE_PATH} 가 ${PRODUCT_LICENSE} 로 적지 않았다 — 두 허가가 동시에 걸린다`);
  return errors;
}
