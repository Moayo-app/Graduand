// 발행본의 링크 대조 — **읽는 손**. 판정은 tools/lib/published-links.mjs 가 한다.
//
// ⭐ 빌드의 마지막 걸음이다(`npm run build`). 올리기 **전에** 답이 나와야 하고, 그래야
//    목록이 줄어든 발행본이 배포로 나가지 못한다. ⛔ 네트워크 0 · 자격 0.
//
// 쓰는 법: `node tools/check-published-links.mjs [발행 루트]` (기본값 diagnosis/dist)
// 나가는 수: 0 = 전부 풀린다 · 2 = 풀리지 않는 링크가 있거나 **분모가 비었다**.
import fs from 'node:fs';
import path from 'node:path';

import { judgeLinks } from './lib/published-links.mjs';

export const DEFAULT_ROOT = 'diagnosis/dist';
export const REDIRECTS_FILE = '_redirects';

/** 트리 전수 — 발행 경로(posix)로 돌려준다. */
export function walk(root, at = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, at), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = at === '' ? entry.name : `${at}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

/** 선언이 받는 자리 — `_redirects` 의 첫 칸이다. ⭕ 파일이 없으면 **빈 집합**이지 실패가 아니다. */
export function redirectsOf(root) {
  const at = path.join(root, REDIRECTS_FILE);
  if (!fs.existsSync(at)) return new Set();
  return new Set(
    fs
      .readFileSync(at, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => line.split(/\s+/)[0]),
  );
}

/** 트리 하나를 재서 `{ errors, checked, pages }` 로 낸다. */
export function checkRoot(root) {
  const files = walk(root);
  const pages = Object.fromEntries(
    files.filter((f) => f.endsWith('.html')).map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]),
  );
  return { ...judgeLinks(pages, new Set(files), redirectsOf(root)), pages: Object.keys(pages).length };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const root = process.argv[2] ?? DEFAULT_ROOT;
  if (!fs.existsSync(root)) {
    console.error(`발행본이 없다: ${root} — 먼저 지어라 (npm run build)`);
    process.exit(2);
  }
  const { errors, checked, pages } = checkRoot(root);
  for (const line of errors) console.error(`⛔ ${line}`);
  // ⭐⭐ **분모를 함께 낸다.** 「위반 0」과 「아무것도 안 봤다」는 다른 것이고, 수를 적지
  //    않으면 둘이 같은 초록으로 그려진다 — 이 저장소가 금칙으로 삼는 바로 그 모양이다.
  console.log(`발행본 ${root} — 문서 ${pages} · 잰 링크 ${checked} · 풀리지 않는 링크 ${errors.length}`);
  if (checked === 0) {
    console.error('⛔ 분모가 비었다 — 잰 링크가 0 이다. 발행본이 반쪽이거나 대조가 아무것도 보지 못했다');
    process.exit(2);
  }
  process.exit(errors.length === 0 ? 0 : 2);
}
