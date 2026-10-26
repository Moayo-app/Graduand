#!/usr/bin/env node
// 보호 설정 드리프트 — **묻는 손**. 판정은 tools/lib/ruleset-drift.mjs 가 한다.
//
//   gh api repos/<owner>/<repo>/rulesets/<id> | node tools/ruleset-drift.mjs
//
// ⭐ 이 파일에 판정이 한 줄도 없는 것이 요점이다 — 실물을 표준입력으로 **받아** 넘기고,
//    받은 축을 찍는다. 자격이 필요한 쪽(`gh`)과 판정하는 쪽을 가른 자리다.
//
// 종료코드: 위반이 있으면 1, 없으면 0. ⚠️ **미판정은 1 로 만들지 않는다** — 빨강의 근거는
// 위반이다. 대신 요약 줄이 미판정 수를 **말하고**, 그 줄이 「통과가 아니다」를 덧붙인다.
import fs from 'node:fs';
import path from 'node:path';

import { DECL_PATH, loadDecl, judge, MARK, tally, UNDECLARED_AXIS } from './lib/ruleset-drift.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

const die = (...lines) => {
  for (const l of lines) console.error(l);
  process.exit(1);
};

const raw = fs.readFileSync(0, 'utf8').trim();
if (!raw)
  die('실물이 비었다 — 표준입력으로 룰셋 JSON 을 넣어라:', '  gh api repos/<owner>/<repo>/rulesets/<id> | node tools/ruleset-drift.mjs');

let live;
try {
  live = JSON.parse(raw);
} catch (err) {
  die(`실물이 JSON 이 아니다 — ${err.message}`, '⛔ 읽지 못한 것을 「어긋남 0」으로 세지 않는다.');
}
if (!Array.isArray(live.rules)) die('실물에 rules 가 없다 — 룰셋 하나의 JSON 인지 확인해라(목록이 아니라 단건).');

const results = judge(loadDecl(ROOT), live);
console.log(`선언 ${DECL_PATH} ↔ 실물 「${live.name ?? '(이름 없음)'}」`);
for (const r of results) console.log(`  ${MARK[r.status]} ${r.axis.padEnd(20)} ${r.detail ?? r.reason}`);

const n = tally(results);
console.log(`\n위반 ${n.violation} · 통과 ${n.pass} · 미판정 ${n.unjudged}`);

// ⚠️ 미판정의 **까닭이 둘이라 따로 센다.** 한 줄로 뭉치면 「이 자격으로는 못 본다」가 「선언이
//    아직 안 정했다」를 덮어, 사람이 할 일(결정)을 권한 문제로 읽는다.
const undeclared = results.filter((r) => r.axis === UNDECLARED_AXIS).length;
const unseen = n.unjudged - undeclared;
if (undeclared > 0) console.log(`⬜ 선언이 들지 않는 칸 ${undeclared}개 — 통과가 아니다. 정한 뒤 ${DECL_PATH} 로 옮겨라.`);
if (unseen > 0) console.log(`⬜ 이 자격으로 판정할 수 없는 축 ${unseen}개 — 통과가 아니다. 그 축은 사람이 본다.`);
process.exit(n.violation === 0 ? 0 : 1);
