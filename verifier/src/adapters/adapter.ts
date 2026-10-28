/**
 * 값 어댑터 계약 — 고객의 기존 시스템에서 **공유값**을 읽는 층.
 *
 * ⚠️ 이름이 `ValueAdapter` 인 것이 개정 4 의 결과다 — 선언이 공유값 축을 여럿 들고 그 축이
 * 디자인 토큰에 한정되지 않으므로(개발 헌법 · API 헌법), 「팔레트」는 **이 어댑터 하나의**
 * 도메인이지 계약의 도메인이 아니다. ⭐ 그래서 v1 어댑터가 CSS 커스텀 속성인 것은 무게
 * 중심의 선택이고, 계약에는 CSS 가 한 글자도 없다.
 *
 * 어댑터는 유형이 유한하고 재사용된다. 계약의 성질 **다섯**:
 * 1. **입력은 파일 내용(문자열)이다.** I/O 는 껍데기(CLI · Action · 브라우저)가 하고,
 *    어댑터는 순수 함수다 — 의존 0 · 브라우저 안전이 구조로 성립한다.
 * 2. **읽기마다 스코프와 행을 든다.** 같은 이름이 `:root` 와 `.dark` 에 두 번 정의되는
 *    것이 팔레트 파일의 평상시다 — 어느 스코프에서 읽었는지가 판정의 일부다.
 *    판정은 선언된 스코프만 보고, 스코프 밖 읽기는 수로 따로 센다.
 * 3. **파싱 실패는 판정 실패다** — 「토큰 0건 = 통과」로 접지 않는다. 어댑터가 못 읽는
 *    파일은 토큰이 없는 파일이 아니라 눈이 먼 입력이고, 눈먼 채 낸 수는 전부 낙관이다.
 * 4. **배제도 센다.** 판정 기준 밖의 토큰(서비스 고유값 등)은 위반 0 에 접히지 않고
 *    「판정 대상 아님 N건」으로 남는다.
 * 5. ⭐ **자기가 읽는 파일의 꼴을 안다**(`extensions`). 조립하는 표면은 저장소의 경로
 *    전수에서 **고를 수 있는 것**을 보여야 하는데, 그 판단을 화면이 하면 「`.css` 는
 *    이 어댑터의 것」이라는 지식이 어댑터 **밖에** 사본으로 생긴다 — 어댑터가 늘면 그
 *    사본이 먼저 거짓이 된다. ⇒ 어댑터가 말한다. ⚠️ 이것은 **힌트이지 판정이 아니다**:
 *    꼴이 맞아도 토큰은 0 일 수 있고, 그때는 읽어 본 뒤에야 안다(그 자리는 3 이 든다).
 */

import { cssCustomProperties } from './css-custom-properties.ts';

/** 어댑터가 읽은 값 하나 — 어디서(파일 · 스코프 · 행) 읽었는지가 값과 한 몸이다. */
export interface ReadToken {
  name: string;
  /** 어댑터의 `normalize` 를 이미 지난 값. */
  value: string;
  scope: string;
  file: string;
  line: number;
}

/** 파싱 실패는 결과의 한 갈래다 — 던지는 쪽(판정 층)이 요란함을 책임진다. */
export type AdapterResult =
  | { ok: true; tokens: ReadToken[] }
  | { ok: false; file: string; message: string };

export interface ValueAdapter {
  /** 선언 파일에서 공유값 축의 `adapter` 가 이 id 를 지목한다. */
  id: string;
  /**
   * 이 어댑터가 읽는 파일의 확장자 — ⭐ **고를 수 있는 것을 보여 주는 자리**(조립의 탐색)에
   * 쓰인다. ⚠️ 판정에는 쓰이지 않는다: 판정의 분모는 **선언된 파일 목록**이고, 꼴이 아니다.
   * 선언이 어떤 경로를 들든 어댑터는 그것을 읽는다 — 여기 없는 확장자를 선언했다고 판정이
   * 거부하지 않는다(그 거부는 선언을 믿지 않는 probe 가 **읽어 본 뒤** 한다).
   */
  extensions: readonly string[];
  /** 입력은 파일 내용뿐 — 경로는 보고에 쓸 이름이지 읽기 지시가 아니다. */
  read(files: ReadonlyArray<{ path: string; text: string }>): AdapterResult;
  /**
   * 값 정규화 — 비교의 양변(읽은 값 · 선언된 기준값)이 같은 정규화를 지나야
   * 표기 차이가 드리프트로 오인되지 않는다.
   */
  normalize(value: string): string;
}

/**
 * 아는 어댑터의 닫힌 목록. 모르는 어댑터 id 는 선언 검증이 이 목록과 함께 거부한다 —
 * 고객 오설정이 「조용한 미판정」으로 새지 않는다.
 */
export const VALUE_ADAPTERS: readonly ValueAdapter[] = [cssCustomProperties];

export const adapterById = (id: string): ValueAdapter | null =>
  VALUE_ADAPTERS.find((a) => a.id === id) ?? null;

/**
 * 파싱 실패 = 판정 실패. 미판정으로 접지 않고 요란하게 멈춘다 — 어댑터가 못 읽는
 * 파일을 조용히 지나치면 「파일 형식이 바뀐 날」이 영원히 초록으로 남는다.
 */
export class AdapterParseError extends Error {
  readonly file: string;
  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.file = file;
  }
}
