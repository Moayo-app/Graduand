// 화면 로케일 분모 가드 — 진단 화면의 카탈로그가 **개방 목록**과 같은 분모 위에 선다.
//
// ⭐⭐ **왜 이 가드가 여기 사는가.** 로케일 분모의 정본은 `config/allowed-countries.yml`
// 하나이고(그 파일 축자: 「테스트에 로케일 수를 적지 않는다」), 정책 문서는 이미 그
// 분모를 쓴다(policy.mjs docLocales). ⛔ 그런데 **화면은 쓰지 않았다** — 자기 상수
// (`LOCALES`)를 손으로 들고 있었다. ⇒ 나라가 하나 열리는 날 정책 문서는 빨갛고 화면은
// **조용히 초록**이다. 그 비대칭이 이 모듈이 선 자리다.
//
// ⚠️ **사본을 만들지 않는다.** 화면 코드의 정본은 비공개 작업장이고 이 트리의
// `diagnosis/` 는 배달받은 것이다. 그래서 이쪽이 하는 일은 **베끼는 것이 아니라 묻는 것**
// 이다 — 배달된 상수와 이 저장소의 선언이 1:1 인가. 어느 쪽도 상대를 고쳐 쓰지 않는다.
//
// ⭐ **소스를 파싱하지 않고 값을 받는다.** 정규식으로 튜플 리터럴을 읽으면 파서가 하나
// 더 생기고, 그 파서는 카탈로그가 모양을 바꾸는 날 조용히 틀린다. Node 가 타입을 벗겨
// 모듈을 실행하므로 **출하되는 그 값**을 그대로 묻는다(그 패키지 자신이 같은 전제 위에
// 선다 — `node src/generate.ts`). ⚠️ 그래서 이 잡의 Node 는 타입 벗기기를 하는 판이어야
// 한다(.github/workflows/policy-guards.yml 이 그것을 선언한다).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MASTER_LOCALE, docLocales } from './policy.mjs';

/** 배달된 화면 카탈로그 — 출하되는 로케일 열거와 벌이 사는 자리. */
export const SCREEN_CATALOG = 'diagnosis/src/strings.ts';

/**
 * 화면이 출하하는 로케일 — **값으로** 받는다. 모양이 틀리면 **던진다.**
 *
 * ⚠️⚠️ 빈 배열을 돌려주지 않는다. 분모가 비면 아래 비교가 「위반 0」으로 초록이 되는데,
 * 그것은 「다 맞다」가 아니라 **아무것도 읽지 않았다**이다 — 미판정을 통과로 그리는 그
 * 모양이라 이 저장소의 규율이 금지한다.
 */
export async function screenLocales(root) {
  const href = pathToFileURL(path.join(root, SCREEN_CATALOG)).href;
  let mod;
  try {
    mod = await import(href);
  } catch (e) {
    throw new Error(`${SCREEN_CATALOG}: 읽을 수 없다 — ${e.message.split('\n')[0]}`);
  }
  if (!Array.isArray(mod.LOCALES) || mod.LOCALES.length === 0)
    throw new Error(`${SCREEN_CATALOG}: LOCALES 가 비었거나 배열이 아니다 — 화면의 로케일 분모가 그 상수다`);
  if (!mod.CATALOG || typeof mod.CATALOG !== 'object')
    throw new Error(`${SCREEN_CATALOG}: CATALOG 가 없다 — 열거만 있고 벌이 없으면 열거는 약속일 뿐이다`);
  return { locales: [...mod.LOCALES], shipped: Object.keys(mod.CATALOG) };
}

const missing = (a, b) => a.filter((x) => !b.includes(x));

/**
 * 화면의 로케일 집합이 개방 목록이 유도한 분모와 **양방향으로** 같다.
 *
 * ⭐ 두 방향의 뜻이 다르므로 메시지도 다르다:
 *   ⑴ 목록에 있는데 화면에 없다 — **그 나라를 열어 놓고 화면이 그 말을 못 한다.**
 *   ⑵ 화면에 있는데 목록에 없다 — **닫힌 나라의 벌이 출하된다.** 조용히 넓히는 쪽이다.
 * 한 방향만 재면 둘 중 하나가 영영 안 불린다.
 */
export async function checkScreenLocales(root) {
  const errors = [];
  const open = docLocales(root);
  const { locales, shipped } = await screenLocales(root);

  for (const l of missing(shipped, locales))
    errors.push(`${SCREEN_CATALOG}: 벌 「${l}」 이 LOCALES 에 없다 — 출하된 벌과 열거가 어긋난다`);
  for (const l of missing(locales, shipped))
    errors.push(`${SCREEN_CATALOG}: LOCALES 의 「${l}」 에 벌이 없다 — 열거가 없는 것을 약속한다`);

  for (const l of missing(open, locales))
    errors.push(
      `화면에 로케일 「${l}」 이 없다 — 개방 목록(config/allowed-countries.yml)이 그 나라를 열었는데 화면이 그 말을 못 한다`,
    );
  for (const l of missing(locales, open))
    errors.push(
      `화면의 로케일 「${l}」 이 개방 목록에 없다 — 닫힌 나라의 벌이 출하된다 (config/allowed-countries.yml 에 행을 더하거나 벌을 걷어라)`,
    );

  // ⭐ 정본이 첫 자리인 것도 같은 규율이다 — docLocales 가 그렇게 돌려주고, 화면의 열거도
  //    같은 순서여야 「첫 벌이 정본」이라는 말이 두 곳에서 같은 뜻이 된다.
  if (locales[0] !== MASTER_LOCALE)
    errors.push(`${SCREEN_CATALOG}: LOCALES 의 첫 자리가 정본(${MASTER_LOCALE})이 아니다 — ${locales[0]} 이 앞에 있다`);

  return errors;
}
