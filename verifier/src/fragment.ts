/**
 * Fragment 요약 codec — 측정 결과를 URL fragment 에 싣는다 (gzip + base64url).
 *
 * fragment 는 서버로 전송되지 않는다(RFC 3986 §3.5 — 해석은 전적으로 user agent 의
 * 몫이다). 로컬에서 판정하고 브라우저를 **보고 페이지 루트 + `#<요약>`** 으로 열면
 * (주소는 `open.ts` 가 쥔다 — 전용 경로가 아니라 루트다), 보고서를 그리는 쪽은 페이지
 * 요청 하나(IP·UA)만 보고 판정 결과는 받지 않는다.
 *
 * **자기검증이 선두에 선다** — `g1.<바이트 길이>.<crc32>.<본문>`. 어느 경로에서든
 * fragment 는 조용히 잘릴 수 있고, 잘린 fragment 를 그대로 그리면 **거짓 보고서**가
 * 된다. 길이·체크섬이 안 맞으면 그리지 않고 폴백을 안내하는 것이 렌더러의 계약이다 —
 * 위험을 「거짓 보고서」에서 「보이는 실패」로 바꾼다.
 */

import { crc32, fromBase64Url, toBase64Url, utf8Decode, utf8Encode } from './bytes.ts';
import { parseMeasurement, serializeMeasurement, VersionMismatchError, type Measurement } from './schema.ts';

export const FRAGMENT_VERSION = 'g1';

/**
 * 권고 상한 — fragment 를 포함한 **URL 전체** 길이. 실측된 안전 천장의 작은 비율로
 * 잡아 환경 변동에 내성을 둔 값이다. 넘으면 fragment 경로를 쓰지 말고 폴백(파일 임베드)
 * 으로 가라 — 이 모듈은 측정 도구가 아니라 상한의 소비자다.
 */
export const RECOMMENDED_URL_MAX = 65_536;

export class FragmentIntegrityError extends Error {}

/**
 * 이 해시가 **요약을 자처하는가** — 모양만 본다(해석하지 않는다).
 *
 * ⭐⭐ **왜 이것이 모듈의 일인가.** 보고 페이지의 주소는 루트 + `#<요약>` 이라, 그 페이지의
 * 해시는 **요약과 페이지 앵커가 한 자리를 나눠 쓴다.** 둘을 가르는 규칙은 요약의 **모양**이
 * 정하므로, 그 모양을 아는 유일한 자리인 여기가 든다 — 소비자가 자기 판단으로 가르면 그
 * 판단이 형식과 갈라지고, 갈라진 날 **요약이 조용히 앵커로 읽힌다.**
 *
 * ⭐ 판정의 근거는 **선두의 판 이름**이다(`g1.`). 이 모듈의 자기검증이 선두에 서는 성질을
 * 그대로 쓴다 — 그래서:
 *   ⑴ **잘린 요약도 요약이다** — `g1.…` 로 시작하면 점이 몇 개든 요약으로 받아 **보이는
 *      실패**(무결성 오류)로 간다. ⛔ 조용히 앵커로 접지 않는다: 접으면 잘린 보고서가
 *      아무 표시 없이 사라지고, 그것이 이 모듈이 막으려는 바로 그 위험이다.
 *   ⑵ **모르는 판도 요약이다** — `g9.…` 는 여기서 참이고, 「모르는 보고서 판」 화면으로 간다.
 *      ⛔ 조용히 무시하면 그 사람은 자기 보고서가 왜 안 뜨는지 알 길이 없다.
 *
 * ⇒ 거짓이 되는 것은 **판 이름을 자처하지 않는 해시**뿐이고, 그것은 페이지 앵커다.
 */
export const looksLikeFragment = (hash: string): boolean => /^g\d+\./.test(hash);

// dom 과 node 의 전역 스트림 타입이 chunk 폭을 서로 다르게 잡는다(BufferSource vs
// Uint8Array) — 양쪽 lib 에서 같은 소스가 검사를 통과하도록 기본 타입 매개변수로 받고,
// 읽는 쪽에서 좁힌다. 브라우저 소비자(진단 페이지)가 dom lib 로 함께 검사한다.
type ByteTransform = { readable: ReadableStream; writable: WritableStream };

async function pipe(bytes: Uint8Array, transform: ByteTransform): Promise<Uint8Array> {
  const source = new ReadableStream({
    start(controller): void {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = (source.pipeThrough(transform) as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

const gzip = (bytes: Uint8Array): Promise<Uint8Array> => pipe(bytes, new CompressionStream('gzip'));

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    return await pipe(bytes, new DecompressionStream('gzip'));
  } catch {
    throw new FragmentIntegrityError('fragment: payload does not decompress — truncated or corrupted');
  }
}

export async function encodeFragment(measurement: Measurement): Promise<string> {
  const json = utf8Encode(serializeMeasurement(measurement));
  const checksum = crc32(json).toString(16).padStart(8, '0');
  const packed = await gzip(json);
  return `${FRAGMENT_VERSION}.${json.length}.${checksum}.${toBase64Url(packed)}`;
}

/**
 * @throws VersionMismatchError 모르는 fragment 버전 — 조용히 해석하지 않는다.
 * @throws FragmentIntegrityError 길이·체크섬 불일치 — 그리지 말고 폴백을 안내하라.
 */
export async function decodeFragment(fragment: string): Promise<Measurement> {
  const parts = fragment.split('.');
  if (parts.length !== 4) {
    throw new FragmentIntegrityError(`fragment: expected 4 dot-separated parts, got ${parts.length}`);
  }
  const [version, lengthText, checksumText, payload] = parts as [string, string, string, string];
  if (version !== FRAGMENT_VERSION) throw new VersionMismatchError('fragment', version);
  if (!/^\d+$/.test(lengthText) || !/^[0-9a-f]{8}$/.test(checksumText)) {
    throw new FragmentIntegrityError('fragment: malformed self-check header');
  }

  let packed: Uint8Array;
  try {
    packed = fromBase64Url(payload);
  } catch (e) {
    throw new FragmentIntegrityError(`fragment: ${(e as Error).message}`);
  }
  const json = await gunzip(packed);

  if (json.length !== Number(lengthText)) {
    throw new FragmentIntegrityError(
      `fragment: self-check failed — declared ${lengthText} bytes, decompressed ${json.length}`,
    );
  }
  if (crc32(json).toString(16).padStart(8, '0') !== checksumText) {
    throw new FragmentIntegrityError('fragment: self-check failed — checksum mismatch');
  }
  return parseMeasurement(utf8Decode(json));
}
