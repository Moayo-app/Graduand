/**
 * AC4 — 페이지의 **조각 내보내기**와 `graduand init` 의 **산출물**이 같은 스키마로
 * 통과한다. 그런데 「같은 스키마」보다 강한 것을 받는다: **같은 바이트**다.
 *
 * 이유 하나다 — 입구가 둘인데(체크아웃이 있는 고객 · 체크아웃이 없는 방문자) 산출물이
 * 갈라지면, 그 갈라짐이 바로 이 제품이 재는 결함이다. 그래서 문자열의 정본은 판정기
 * 모듈 하나이고, 페이지는 사본을 들지 않는다 — 아래가 그 사실을 소스에서 받는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DECLARATION_FILE, SCAFFOLD_JSON, validateDeclaration } from '../../verifier/src/index.ts';
import { DOCUMENT_FILE, renderAll, TEMPLATE_FILE } from './generate.ts';
import { CATALOG } from './strings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** 페이지가 **내보내는** 문자열 — 페이지 코드가 화면에 넣는 그 값. */
const exported = (): string => {
  const main = read('src/main.ts');
  // 정본에서 가져와 그대로 넣는가. 가공하면 이 단정이 깨지고, 깨지는 것이 맞다.
  assert.match(main, /import \{[^}]*SCAFFOLD_JSON[^}]*\} from '\.\.\/\.\.\/verifier\/src\/index\.ts'/);
  assert.match(main, /#scaffold-snippet.*\n?.*\.textContent = SCAFFOLD_JSON;/);
  return SCAFFOLD_JSON;
};

test('AC4 — 페이지의 조각을 파일로 저장하면 지금 스키마의 검증을 통과한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graduand-snippet-'));
  const path = join(dir, DECLARATION_FILE);
  writeFileSync(path, exported());

  const validated = validateDeclaration(readFileSync(path, 'utf8'));
  assert.equal(validated.state, 'valid');
  // 편입 기록이 비어 있는 것이 정당하다 — 참인 선언이고, 그 칸은 미판정이다.
  assert.deepEqual(validated.state === 'valid' ? validated.admissions : null, {});
});

test('AC4 — 조각과 `init` 산출물은 같은 스키마가 아니라 **같은 바이트**다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graduand-init-page-'));
  const cli = join(ROOT, '..', 'verifier', 'src', 'cli.ts');
  const r = spawnSync(process.execPath, [cli, 'init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);

  assert.equal(readFileSync(join(dir, DECLARATION_FILE), 'utf8'), exported());
});

test('AC4 — 페이지는 조각의 사본을 들지 않는다 (마크업에 박힌 선언 0)', () => {
  // ⭐ 분모가 **발행본**이다 — 방문자가 받는 바이트에 사본이 없어야 하고, 산문이 카탈로그로
  //   내려온 뒤 그 바이트는 틀이 아니라 생성기가 낸다(틀만 보면 카탈로그에 박힌 사본을
  //   아무 말도 하지 않는다).
  const documents = renderAll(read(TEMPLATE_FILE));
  for (const [locale, html] of Object.entries(documents)) {
    const name = `${locale}/${DOCUMENT_FILE}`;
    // 빈 자리 하나 — 내용은 판정기 모듈에서 온다. 마크업이 사본을 들면 스키마가 움직이는
    // 날 페이지만 옛 조각을 내보내고, 그것을 알아차릴 길이 없다.
    assert.match(html, /<pre id="scaffold-snippet"[^>]*><\/pre>/, `${name}: 빈 자리가 없다`);
    for (const key of Object.keys(JSON.parse(SCAFFOLD_JSON) as Record<string, unknown>)) {
      assert.ok(!html.includes(`"${key}"`), `${name} 이 조각의 사본을 든다: ${key}`);
    }
  }
});

test('조각 내보내기는 전송이 아니다 — 클립보드와 화면뿐이다', () => {
  const main = read('src/main.ts');
  assert.match(main, /navigator\.clipboard\.writeText\(SCAFFOLD_JSON\)/);
  // 복사하지 못한 것을 복사했다고 말하지 않는다 — 실패 쪽 분기가 있어야 한다.
  // ⚠️ 무는 것은 **배선**이고 자구가 아니다: 문구는 카탈로그가 들고, 그 자구를 여기 적으면
  //    사본이 하나 늘어 로케일마다 이 단정이 틀린다. 자구가 **비어 있지 않은지**는 두 벌
  //    전수로 `i18n.test.ts` 가 문다.
  assert.match(main, /sayCopy\(strings\.scaffold\.copyFailed\)/);
  for (const strings of Object.values(CATALOG)) {
    assert.ok(strings.scaffold.copyFailed.length > 0, `${strings.locale}: 실패 쪽 문구가 비었다`);
  }
});
