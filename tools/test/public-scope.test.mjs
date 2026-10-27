// 공개 범위 가드 — 양성 + negative ([ISSUE-16] AC2·AC3).
// 가드의 본체는 tools/lib/public-scope.mjs, 선언의 정본은 config/public-scope.yml 이다.
//
// ⚠️ negative 가 양성보다 많다. AC2·AC3 둘 다 「가드가 빨갛다」를 요구하므로 실제 트리가
// 초록인 것만으로는 아무것도 검증되지 않는다 — 분모가 비어도 초록이기 때문이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCOPE_PATH,
  ORIGINS,
  LICENSES,
  LICENSE_GROUNDS,
  mirrorPairs,
  ignoredDirs,
  scopeEntries,
  coveringEntry,
  walkFiles,
  workshopFiles,
  checkScopeCoverage,
  checkScopeEntries,
  checkWorkshopProse,
  checkLicenseGrounds,
} from '../lib/public-scope.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const clean = (name, fn) => test(name, () => assert.deepEqual(fn(ROOT), []));
const hits = (errors, needle) => errors.filter((e) => e.includes(needle));

/** 실제 트리의 사본 — 위반을 심는 자리. 설치물과 산출은 빼고 베낀다(주사가 걷어낼 자리다). */
function cloneRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graduand-scope-'));
  fs.cpSync(ROOT, root, {
    recursive: true,
    filter: (src) => !/(^|[/\\])(\.git|node_modules|dist)$/.test(src),
  });
  return root;
}
const plant = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
/** entries 목록의 끝에 행을 더한다 — 파일 끝에 붙이면 뒤따르는 다른 목록의 항이 된다. */
const addEntry = (root, yamlRow) => {
  const file = path.join(root, SCOPE_PATH);
  const text = fs.readFileSync(file, 'utf8');
  const marker = '\n# 배달된 산문에';
  assert.ok(text.includes(marker), 'entries 목록의 끝을 찾을 닻이 선언 파일에 있다');
  fs.writeFileSync(file, text.replace(marker, `${yamlRow}${marker}`));
};
const dropEntry = (root, declaredPath) =>
  fs.writeFileSync(
    path.join(root, SCOPE_PATH),
    fs
      .readFileSync(path.join(root, SCOPE_PATH), 'utf8')
      .replace(new RegExp(`  - path: ${declaredPath}\\n(?:    [^\\n]*\\n)+`), ''),
  );

// ── 양성 ──────────────────────────────────────────────────────────────────────

test('분모가 사본이 아니다 — 걸러낼 자리가 .gitignore 에서 유도된다', () => {
  const { names, paths } = ignoredDirs(ROOT);
  assert.ok(names.length + paths.length > 0, '.gitignore 가 걸러낼 자리를 말한다');
  assert.ok(!walkFiles(ROOT).some((f) => f.split('/').some((seg) => names.includes(seg))), '유도된 이름이 주사에 섞이지 않는다');
});

test('선언 행마다 origin 과 근거가 있다 — 모양이 틀리면 scopeEntries 가 던진다', () => {
  const entries = scopeEntries(ROOT);
  assert.ok(entries.length > 0);
  for (const [p, origin, basis] of entries) {
    assert.ok(ORIGINS.includes(origin), `${p}: origin`);
    assert.ok(basis.trim().length > 0, `${p}: basis`);
  }
});

test('선언 행마다 허가가 있다 — 빈 칸은 「미정」이 아니라 all rights reserved 다', () => {
  for (const [p, , , license] of scopeEntries(ROOT)) assert.ok(LICENSES.includes(license), `${p}: license = ${license}`);
});

test('⭐⭐ 허가 없이 공개되는 파일이 0 이다 — 두 가드의 합성이 그것을 단정한다', () => {
  // AC2 가 「덮는 행이 없는 파일 0」을 주고, scopeEntries 가 「허가 없는 행 0」을 준다 —
  // 그 둘의 합성이 이 단정이다. 합성인 채로 두면 한쪽이 약해질 때 아무도 울지 않으므로,
  // **실물 전수에서** 직접 잰다: 이것이 이 이슈가 닫은 공백 그 자체다.
  const entries = scopeEntries(ROOT);
  const files = walkFiles(ROOT);
  assert.ok(files.length > 50, `분모가 비면 아래 전수는 아무것도 재지 않는다 — ${files.length}건`);
  for (const f of files) assert.ok(LICENSES.includes(coveringEntry(entries, f)?.[3]), `${f}: 허가 없이 공개된다`);
});

test('⭐ 결정 넷이 선언에 **박혀** 있다 — 묶음의 성질이 다르다는 그 결정이다', () => {
  const entries = scopeEntries(ROOT);
  const licenseOf = (file) => coveringEntry(entries, file)?.[3];
  // 제품 — 증서가 부르는 둘. (증서와의 1:1 은 license-copy 가드가 잰다.)
  assert.equal(licenseOf('verifier/src/cli.ts'), 'BSL-1.1');
  // 운영 — 가드 본체. ⭐ 베껴 쓸 수 있어야 「정본을 보여라」가 논증이 된다.
  assert.equal(licenseOf('tools/lib/public-scope.mjs'), 'Apache-2.0');
  // 정책 — ⚠️ 읽히기 위해 공개하고 재사용 허가는 두지 않는다. 침묵이 아니라 **결정**이다.
  assert.equal(licenseOf('docs/policies/terms.md'), 'reserved');
  // 남의 증서 전문 — 우리가 줄 수 있는 허가가 아니다.
  assert.equal(licenseOf('LICENSE-APACHE-2.0'), 'upstream');
  assert.equal(new Set(entries.map(([, , , l]) => l)).size, LICENSES.length, '네 값이 모두 쓰인다 — 사유 대조의 분모다');
});

clean(`AC2: 선언 밖 파일이 0 이다 — ${'config/public-scope.yml'} 가 분모다`, checkScopeCoverage);
clean('선언 자신이 건강하다 — 중복 0 · 허공을 가리키는 행 0', checkScopeEntries);
clean('AC3: 배달된 파일에 내부 표기가 0 이다', checkWorkshopProse);
clean(`선언이 쓰는 허가마다 사유가 ${LICENSE_GROUNDS} 에 있다`, checkLicenseGrounds);

test('⭐ 피할 수 없는 사본이 **선언으로** 들려 있다 — 손으로 맞추는 자리가 0 이다', () => {
  // ⚠️ 이 축이 배달 접두사 밖의 한 자리를 배달이 건드리게 하는 유일한 길이다. 경로가
  //    스크립트가 아니라 선언에 있다는 것이 요점이라, 그 사실을 여기서 잰다.
  const pairs = mirrorPairs(ROOT);
  assert.ok(pairs.length > 0, '미러가 0 이면 바이트 대조 가드의 분모가 비어 있다');
  for (const [mirror, canon] of pairs) {
    const [, origin, , , declared] = coveringEntry(scopeEntries(ROOT), mirror);
    assert.equal(origin, 'local', `${mirror}: 미러는 배달받는 것이 아니라 유도되는 것이다`);
    assert.equal(declared, canon);
    assert.ok(coveringEntry(scopeEntries(ROOT), canon), `${canon}: 정본이 선언 밖이면 미러는 제 바이트를 못 받는다`);
  }
});

test('⭐ AC3 의 분모가 비어 있지 않다 — 초록이 「안 읽었다」가 아님을 따로 잰다', () => {
  const swept = workshopFiles(ROOT);
  assert.ok(swept.length > 0, '배달 범위에 덮이는 파일이 0 이면 위 초록은 미판정이다');
  assert.ok(
    swept.some((f) => f.endsWith('.ts')),
    '스윕이 실제 소스에 닿는다',
  );
});

test('⭐⭐ 증서는 **배달된다** — 정본이 작업장이고 `verifier/` 가 그것을 덮는다', () => {
  // ⭐ 증서의 정본이 작업장으로 올라갔다 — 그래서 이 파일은 더 이상 **이 저장소가 쓰는 것**이
  // 아니라 **배달받는 것**이다. 예외 행(`verifier/LICENSE` = local)은 그 사실과 함께 사라졌다:
  // 예외가 있던 이유가 「작업장에 없다」였고, 이제 있다.
  //
  // ⚠️ 예외 행이 되살아나면 배달은 이 파일을 **보내지도 지우지도 않고**, 루트 증서와 조용히
  // 갈라질 길이 열린다(사본 가드가 그때 운다). 그래서 「무엇이 덮는가」를 여기서 잰다.
  const found = coveringEntry(scopeEntries(ROOT), 'verifier/LICENSE');
  assert.ok(found, '증서를 덮는 선언 행이 없다');
  const [declared, origin] = found;
  assert.equal(declared, 'verifier/', `증서가 「${declared}」 로 덮인다 — 예외 행이 되살아났다면 배달이 증서를 더 이상 나르지 않는다`);
  assert.equal(origin, 'workshop');

  // ⇒ 그래서 이 파일은 배달 산문 스윕의 **모집단 안**이다. 영문 전문이라 위반은 0 이지만,
  //    모집단에 있다는 것이 「배달된다」의 다른 쪽 얼굴이다 — 아래 negative 가 그쪽을 잰다.
  assert.ok(workshopFiles(ROOT).includes('verifier/LICENSE'), '증서가 배달 모집단에 없다');
});

// ── negative ─────────────────────────────────────────────────────────────────

test('AC2 (negative): 선언 밖 파일을 심으면 가드가 그 경로를 지목한다', () => {
  const root = cloneRoot();
  assert.deepEqual(checkScopeCoverage(root), [], '심기 전의 사본은 초록이다');
  plant(root, 'notes/internal-memo.md', '내부 메모\n');
  assert.equal(hits(checkScopeCoverage(root), 'notes/internal-memo.md').length, 1);
});

test('AC2 (negative): ⚠️ 선언 행을 지우면 그 아래 전부가 빨갛다 — 조용히 공개되지 않는다', () => {
  const root = cloneRoot();
  dropEntry(root, 'verifier/');
  const errors = checkScopeCoverage(root);
  assert.ok(errors.length > 10, `선언이 빠진 디렉터리 전수가 운다 — ${errors.length}건`);
  assert.ok(errors.every((e) => e.includes('verifier/')));
});

test('AC2 (negative): 루트에 심은 파일도 잡는다 — 접두사 없이 선언을 피해갈 수 없다', () => {
  const root = cloneRoot();
  plant(root, 'SCRATCH.md', '작업 메모\n');
  assert.equal(hits(checkScopeCoverage(root), 'SCRATCH.md').length, 1);
});

test('(negative): 허공을 가리키는 선언 행은 범위를 조용히 넓힌다 — 그래서 빨갛다', () => {
  const root = cloneRoot();
  // ⚠️ `license`·`group` 을 함께 적는다 — 축이 없으면 scopeEntries 가 먼저 던져 이 테스트의
  // 표적(허공을 가리키는 행)이 가려진다. 축 자체의 negative 는 각자 따로 있다.
  addEntry(
    root,
    '  - path: telemetry/\n    origin: workshop\n    license: Apache-2.0\n    group: "저장소 운영"\n    basis: "아직 서지 않은 것을 가리키는 행"\n',
  );
  assert.equal(hits(checkScopeEntries(root), 'telemetry/').length, 1);
});

test('AC3 (negative): 배달된 파일에 내부 표기를 심으면 그 줄을 지목한다', () => {
  const root = cloneRoot();
  plant(root, 'verifier/src/leak.ts', 'export const WHY = 1; // 근거: ISSUE-99\n');
  const errors = checkWorkshopProse(root);
  assert.equal(hits(errors, 'verifier/src/leak.ts:1').length, 1);
  assert.ok(errors[0].includes('ISSUE-99'));
});

test('AC3 (negative): 비공개 쪽 저장소 이름 모양도 같은 가드가 잡는다', () => {
  const root = cloneRoot();
  plant(root, 'verifier/src/leak.ts', '// 정본은 저쪽-hq 가 아니라 여기 산다\n');
  assert.equal(checkWorkshopProse(root).length, 0, '한글 앞뒤의 낱말은 모양에 맞지 않는다');
  plant(root, 'verifier/src/leak.ts', '// canon lives in acme-hq, not here\n');
  assert.equal(hits(checkWorkshopProse(root), 'acme-hq').length, 1);
});

test('(negative): ⚠️ 증서도 배달 산문 스윕을 받는다 — 모집단 안이라는 사실의 다른 쪽', () => {
  // ⭐ 양성은 `workshopFiles` 에 이름이 있는지를 봤다. 여기서는 **가드 쪽에서** 잰다 —
  // 모집단에 이름만 있고 스윕이 그 파일을 읽지 않으면 초록은 「위반 0」이 아니라
  // 「안 읽었다」다. 증서에 내부 표기를 심어 그 줄이 불리는지 본다.
  const root = cloneRoot();
  plant(root, 'verifier/LICENSE', 'Business Source License 1.1\n\nParameters\n\nLicensor:  근거 ISSUE-99\n');
  const errors = checkWorkshopProse(root);
  assert.equal(hits(errors, 'verifier/LICENSE:5').length, 1, '증서가 모집단 밖이면 이 단정이 비어 돈다');
  assert.ok(errors.some((e) => e.includes('ISSUE-99')));
});

test('⭐ AC3 의 분모는 배달 항뿐이다 — local 산문의 같은 표기는 이 가드의 모집단 밖이다', () => {
  const root = cloneRoot();
  plant(root, 'docs/agents/scratch.md', '근거: ISSUE-99\n');
  assert.deepEqual(checkWorkshopProse(root), [], '재지 않은 자리는 「위반 0」이 아니라 모집단 밖이다');
  assert.equal(hits(checkScopeCoverage(root), 'docs/agents/scratch.md').length, 0, 'docs/agents/ 는 선언돼 있다');
});

test('(negative): ⚠️ 행에서 license 를 지우면 scopeEntries 가 **던진다** — 조용히 넘어가지 않는다', () => {
  const root = cloneRoot();
  const file = path.join(root, SCOPE_PATH);
  const text = fs.readFileSync(file, 'utf8');
  // ⚠️ `tools/` 한 행은 더 이상 없다 — 묶음 둘을 걸쳐서 넷으로 쪼갰다([ISSUE-52]).
  const target = '  - path: tools/lib/\n    origin: local\n    license: Apache-2.0\n';
  assert.ok(text.includes(target), '지울 칸을 선언에서 찾는다');
  fs.writeFileSync(file, text.replace(target, '  - path: tools/lib/\n    origin: local\n'));
  assert.throws(() => scopeEntries(root), /license/, '빈 칸이 통과하면 그 경로는 허가 없이 공개된다');
});

test('(negative): 모르는 허가 값도 던진다 — 새 허가는 사유와 함께 들어온다', () => {
  const root = cloneRoot();
  const file = path.join(root, SCOPE_PATH);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('    license: reserved\n', '    license: MIT\n'));
  assert.throws(() => scopeEntries(root), /MIT/);
});

test('(negative): 사유 없는 허가를 쓰면 가드가 그 값을 지목한다 — 배정과 사유가 갈라지는 자리', () => {
  const root = cloneRoot();
  assert.deepEqual(checkLicenseGrounds(root), [], '심기 전의 사본은 초록이다');
  const grounds = path.join(root, LICENSE_GROUNDS);
  fs.writeFileSync(grounds, fs.readFileSync(grounds, 'utf8').replaceAll('reserved', '재사용 금지'));
  const errors = checkLicenseGrounds(root);
  assert.equal(errors.length, 1, errors.join(' · '));
  assert.ok(errors[0].includes('reserved'), errors[0]);
});

test('(negative): 자기 자신을 가리키는 미러는 던진다 — 정본 없는 사본이다', () => {
  const root = cloneRoot();
  const file = path.join(root, SCOPE_PATH);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('    mirrors: verifier/LICENSE\n', '    mirrors: LICENSE\n'));
  assert.throws(() => scopeEntries(root), /자기 자신/);
});

test('(negative): 미러 행의 origin 이 local 이 아니면 던진다 — 배달받는 것과 유도되는 것이 다르다', () => {
  const root = cloneRoot();
  const file = path.join(root, SCOPE_PATH);
  const target = '  - path: LICENSE\n    origin: local\n';
  assert.ok(fs.readFileSync(file, 'utf8').includes(target));
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(target, '  - path: LICENSE\n    origin: workshop\n'));
  assert.throws(() => scopeEntries(root), /origin 은 local/);
});

test('(negative): 선언 밖을 정본으로 삼은 미러는 가드가 지목한다 — 배달이 나르지 않는다', () => {
  const root = cloneRoot();
  const file = path.join(root, SCOPE_PATH);
  plant(root, 'NOTICE-SCRATCH', 'x\n');
  fs.writeFileSync(
    file,
    fs.readFileSync(file, 'utf8').replace('    mirrors: verifier/LICENSE\n', '    mirrors: NOTICE-SCRATCH\n'),
  );
  assert.equal(hits(checkScopeEntries(root), '선언 밖이다').length, 1, '정본이 선언 밖이면 그 미러는 영원히 뒤처진다');
});
