/**
 * 팔레트 어댑터 계약 — 고객의 기존 디자인 시스템에서 팔레트를 읽는 층.
 *
 * 어댑터는 유형이 유한하고 재사용된다. 계약의 성질 넷:
 * 1. **입력은 파일 내용(문자열)이다.** I/O 는 껍데기(CLI · Action · 브라우저)가 하고,
 *    어댑터는 순수 함수다 — 의존 0 · 브라우저 안전이 구조로 성립한다.
 * 2. **읽기마다 스코프와 행을 든다.** 같은 이름이 `:root` 와 `.dark` 에 두 번 정의되는
 *    것이 팔레트 파일의 평상시다 — 어느 스코프에서 읽었는지가 판정의 일부다.
 *    판정은 선언된 스코프만 보고, 스코프 밖 읽기는 수로 따로 센다.
 * 3. **파싱 실패는 판정 실패다** — 「토큰 0건 = 통과」로 접지 않는다. 어댑터가 못 읽는
 *    파일은 토큰이 없는 파일이 아니라 눈이 먼 입력이고, 눈먼 채 낸 수는 전부 낙관이다.
 * 4. **배제도 센다.** 판정 기준 밖의 토큰(서비스 고유값 등)은 위반 0 에 접히지 않고
 *    「판정 대상 아님 N건」으로 남는다.
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

export interface PaletteAdapter {
  /** 선언 파일의 `palette.adapter` 가 이 id 를 지목한다. */
  id: string;
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
export const PALETTE_ADAPTERS: readonly PaletteAdapter[] = [cssCustomProperties];

export const adapterById = (id: string): PaletteAdapter | null =>
  PALETTE_ADAPTERS.find((a) => a.id === id) ?? null;

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
