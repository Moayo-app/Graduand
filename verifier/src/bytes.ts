/**
 * 바이트 유틸리티 — 의존성 0 · 브라우저/Node 공용.
 *
 * Buffer · atob/btoa 를 쓰지 않는다 — 한쪽 런타임에만 있는 전역에 기대면 「같은 모듈을
 * 양쪽이 쓴다」가 코드 경로에서부터 깨진다. TextEncoder/TextDecoder 만 쓴다(양쪽 전역).
 */

export const utf8Encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** fatal: 깨진 UTF-8 을 조용히 U+FFFD 로 바꾸지 않는다 — 잘림을 숨기는 자리가 된다. */
export const utf8Decode = (bytes: Uint8Array): string =>
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE). 암호 무결성이 아니라 **잘림·오타 검출**용이다 — fragment 자기검증이 쓴다. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const B64_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodeWith(alphabet: string, text: string, label: string): Uint8Array {
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < alphabet.length; i += 1) lookup[alphabet.charCodeAt(i)] = i;

  // GitHub blob API 는 base64 본문에 줄바꿈을 끼워 보낸다 — 공백류만 걷는다.
  const clean = text.replace(/[\s=]+/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let at = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i);
    const value = code < 128 ? lookup[code]! : -1;
    if (value < 0) throw new Error(`${label}: invalid character at index ${i}`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at] = (buffer >> bits) & 0xff;
      at += 1;
    }
  }
  return out.subarray(0, at);
}

export const fromBase64 = (text: string): Uint8Array => decodeWith(B64_STD, text, 'base64');
export const fromBase64Url = (text: string): Uint8Array => decodeWith(B64_URL, text, 'base64url');

/** 패딩 없는 base64url — URL fragment 에 그대로 실린다. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64_URL[a >> 2]! + B64_URL[((a & 3) << 4) | (b >> 4)]!;
    if (i + 1 < bytes.length) out += B64_URL[((b & 15) << 2) | (c >> 6)]!;
    if (i + 2 < bytes.length) out += B64_URL[c & 63]!;
  }
  return out;
}
