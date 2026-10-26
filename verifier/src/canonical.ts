/**
 * Canonical JSON — 같은 값은 어디서 직렬화해도 같은 바이트.
 *
 * 고객 CI 와 브라우저가 **같은 판정을 같은 바이트로** 직렬화해야 두 표면의 결과를
 * 비교할 수 있다. 사본이 없다는 약속은 직렬화 층까지 내려와야 지켜진다.
 *
 * 규칙: 객체 키는 코드유닛 순으로 정렬 · 공백 없음 · 비결정 값은 거부.
 * 조용히 건너뛰는 값(undefined · 함수 · 심벌)과 환경 따라 달라질 수 있는 값
 * (NaN · Infinity · bigint · Date 같은 비평범 객체)은 **던진다** — 묵살은
 * 직렬화 차이가 숨는 자리다.
 */

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('canonicalJson: non-finite number');
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }

  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError('canonicalJson: only plain objects are serializable');
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const v = record[key];
    if (v === undefined) {
      // 선택 필드는 undefined 가 아니라 null 로 적는다 — 「없음」도 명시된 값이어야 한다.
      throw new TypeError(`canonicalJson: undefined value at key "${key}"`);
    }
    parts.push(`${JSON.stringify(key)}:${canonicalJson(v)}`);
  }
  return `{${parts.join(',')}}`;
}
