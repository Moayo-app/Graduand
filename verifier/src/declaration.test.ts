import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeclaration, declaredPaletteFiles, type ValidDeclaration } from './declaration.ts';
import { VERIFIER_IDS } from './verifiers/registry.ts';

test('파일 없음 = absent — 실패가 아니다', () => {
  assert.deepEqual(validateDeclaration(null), { state: 'absent' });
});

test('ui 키 부재(선언 없음)와 ui: [] (「UI 없음」 선언)는 다른 상태다', () => {
  const noKey = validateDeclaration('{}');
  assert.equal(noKey.state, 'valid');
  assert.equal((noKey as { ui: unknown }).ui, null);

  const emptyDecl = validateDeclaration('{"ui": []}');
  assert.equal(emptyDecl.state, 'valid');
  assert.deepEqual((emptyDecl as { ui: unknown }).ui, []);
});

test('정상 선언 — ui 경로 목록과 palette 를 읽는다', () => {
  const r = validateDeclaration(
    '{"ui": ["app/", "site/index.html"], "palette": {"adapter": "css-custom-properties", "files": ["app/tokens.css"], "scope": ":root"}}',
  );
  assert.equal(r.state, 'valid');
  assert.deepEqual((r as { ui: string[] }).ui, ['app/', 'site/index.html']);
  assert.deepEqual((r as ValidDeclaration).palette, {
    adapter: 'css-custom-properties',
    files: ['app/tokens.css'],
    scope: ':root',
    canon: null,
    pinned: null,
    diverged: null,
  });
});

test('깨진 JSON = invalid — 미판정으로 접지 않는다', () => {
  const r = validateDeclaration('{"ui": [');
  assert.equal(r.state, 'invalid');
});

test('최상위가 객체가 아니면 invalid', () => {
  assert.equal(validateDeclaration('[]').state, 'invalid');
  assert.equal(validateDeclaration('"ui"').state, 'invalid');
});

test('모르는 최상위 키 = 오타 = invalid — 아는 키 목록과 함께', () => {
  const r = validateDeclaration('{"uipaths": ["app/"]}');
  assert.equal(r.state, 'invalid');
  const problems = (r as { problems: string[] }).problems;
  assert.ok(problems[0]!.includes('uipaths'));
  assert.ok(problems[0]!.includes('ui, palette'));
});

test('ui 형식 위반들 — 배열 아님 · 빈 문자열 · 중복 · 절대/홈 경로', () => {
  assert.equal(validateDeclaration('{"ui": "app/"}').state, 'invalid');
  assert.equal(validateDeclaration('{"ui": [""]}').state, 'invalid');
  assert.equal(validateDeclaration('{"ui": ["app/", "app/"]}').state, 'invalid');
  assert.equal(validateDeclaration('{"ui": ["/abs/path"]}').state, 'invalid');
  assert.equal(validateDeclaration('{"ui": ["~/home"]}').state, 'invalid');
});

test('palette — 객체가 아니거나 모르는 키면 invalid', () => {
  assert.equal(validateDeclaration('{"palette": []}').state, 'invalid');
  assert.equal(validateDeclaration('{"palette": {"adaptor": "x"}}').state, 'invalid');
});

test('palette — 모르는 어댑터는 아는 목록과 함께 invalid 다', () => {
  const r = validateDeclaration('{"palette": {"adapter": "tailwind-v3-config", "files": ["a.css"], "scope": ":root"}}');
  assert.equal(r.state, 'invalid');
  const problems = (r as { problems: string[] }).problems;
  assert.ok(problems[0]!.includes('tailwind-v3-config'));
  assert.ok(problems[0]!.includes('css-custom-properties'));
});

test('palette — adapter·files·scope 는 셋이 한 몸이다: 반쪽 선언은 invalid', () => {
  assert.equal(validateDeclaration('{"palette": {"adapter": "css-custom-properties"}}').state, 'invalid');
  assert.equal(validateDeclaration('{"palette": {"files": ["a.css"], "scope": ":root"}}').state, 'invalid');
  assert.equal(validateDeclaration('{"palette": {"adapter": 1, "scope": null}}').state, 'invalid');
});

test('palette — 아무것도 선언하지 않는 빈 palette 는 invalid', () => {
  assert.equal(validateDeclaration('{"palette": {}}').state, 'invalid');
});

test('palette.files — ui 와 같은 경로 규칙: 비어 있음 · 절대 경로 · 중복은 invalid', () => {
  const base = (files: string) =>
    `{"palette": {"adapter": "css-custom-properties", "files": ${files}, "scope": ":root"}}`;
  assert.equal(validateDeclaration(base('[]')).state, 'invalid');
  assert.equal(validateDeclaration(base('["/abs.css"]')).state, 'invalid');
  assert.equal(validateDeclaration(base('["a.css", "a.css"]')).state, 'invalid');
});

test('palette.canon — repo·file·scope 셋 다 비어 있지 않은 문자열, 모르는 키는 invalid', () => {
  const base = (canon: string) =>
    `{"palette": {"adapter": "css-custom-properties", "files": ["a.css"], "scope": ":root", "canon": ${canon}}}`;
  const ok = validateDeclaration(base('{"repo": "acme/design-system", "file": "tokens.css", "scope": ":root"}'));
  assert.equal(ok.state, 'valid');
  assert.equal(validateDeclaration(base('{"repo": "acme/design-system"}')).state, 'invalid');
  assert.equal(validateDeclaration(base('{"repo": "a/b", "file": "t.css", "scope": ":root", "branch": "main"}')).state, 'invalid');
  assert.equal(validateDeclaration(base('"acme/design-system"')).state, 'invalid');
});

test('palette.pinned — 공집합 박제와 문자열 아닌 값은 invalid', () => {
  const canon = '"canon": {"repo": "a/b", "file": "t.css", "scope": ":root"}';
  const base = (pinned: string) => `{"palette": {"pinned": ${pinned}, ${canon}}}`;
  assert.equal(validateDeclaration(base('{"--ink": "#1C1F2E"}')).state, 'valid');
  assert.equal(validateDeclaration(base('{}')).state, 'invalid');
  assert.equal(validateDeclaration(base('{"--ink": 7}')).state, 'invalid');
  assert.equal(validateDeclaration(base('[]')).state, 'invalid');
});

test('폴백 선언 — 어댑터 3종 없이 pinned 만으로 valid 다 (선언 파일이 팔레트를 직접 든다)', () => {
  const r = validateDeclaration('{"palette": {"pinned": {"--ink": "#1C1F2E"}, "canon": {"repo": "a/b", "file": "t.css", "scope": ":root"}}}');
  assert.equal(r.state, 'valid');
  const palette = (r as ValidDeclaration).palette!;
  assert.equal(palette.adapter, null);
  assert.deepEqual(palette.pinned, { '--ink': '#1C1F2E' });
});

test('declaredPaletteFiles — 유효한 선언의 palette.files 만 돌려준다', () => {
  assert.deepEqual(
    declaredPaletteFiles('{"palette": {"adapter": "css-custom-properties", "files": ["src/theme.css"], "scope": ":root"}}'),
    ['src/theme.css'],
  );
  assert.deepEqual(declaredPaletteFiles(null), []);
  assert.deepEqual(declaredPaletteFiles('{"ui": []}'), []);
  assert.deepEqual(declaredPaletteFiles('{"palette": {"files": ["broken.css"]}}'), []); // 깨진 선언 — 더 싣지 않는다
});

test('문제는 전부 모아서 보고한다 — 첫 오타에서 멈추지 않는다', () => {
  const r = validateDeclaration('{"typo": 1, "ui": "x", "palette": {"nope": 1}}');
  assert.equal(r.state, 'invalid');
  assert.equal((r as { problems: string[] }).problems.length, 3);
});

// ── 개정 2 — 편입 기록 · 면제 목록 · diverged · canon 동반 ─────────────

const CANON = '"canon": {"repo": "acme/design-system", "file": "tokens.css", "scope": ":root"}';

const FULL = JSON.stringify({
  ui: ['app/'],
  palette: {
    adapter: 'css-custom-properties',
    files: ['app/tokens.css'],
    scope: ':root',
    canon: { repo: 'acme/design-system', file: 'tokens.css', scope: ':root' },
    pinned: { '--ink': '#1C1F2E' },
    diverged: { '--paper': '이 저장소의 지면 값은 우리 것이다 — 정본은 여기다' },
  },
  admissions: {
    FH11: { verifiers: ['palette', 'palette-cross'] },
    FH14: { verifiers: [] },
    FH20: {},
  },
  exemptions: {
    FH7: { reason: '이 저장소에 폰트 표면이 없다', expires: '2027-01-31' },
  },
});

test('편입 기록 · 면제 목록 · diverged 를 담은 선언은 valid 다 (AC1)', () => {
  const r = validateDeclaration(FULL);
  assert.equal(r.state, 'valid', JSON.stringify((r as { problems?: string[] }).problems));
  const decl = r as ValidDeclaration;
  assert.deepEqual(decl.admissions, {
    FH11: { verifiers: ['palette', 'palette-cross'] },
    FH14: { verifiers: [] }, // 「판정기 없음」이라는 선언 — 미판정의 자리다
    FH20: { verifiers: null }, // 키 부재 — 같은 자리에 앉는다
  });
  assert.deepEqual(decl.exemptions, {
    FH7: { reason: '이 저장소에 폰트 표면이 없다', expires: '2027-01-31' },
  });
  assert.deepEqual(decl.palette!.diverged, { '--paper': '이 저장소의 지면 값은 우리 것이다 — 정본은 여기다' });
});

test('한 규칙이 편입과 면제에 둘 다 있으면 invalid — 두 칸을 동시에 주장한다 (AC2)', () => {
  const r = validateDeclaration(
    JSON.stringify({
      admissions: { FH11: { verifiers: ['palette'] } },
      exemptions: { FH11: { reason: '적용하지 않는다', expires: '2027-01-31' } },
    }),
  );
  assert.equal(r.state, 'invalid');
  assert.ok((r as { problems: string[] }).problems[0]!.includes('FH11'));
});

test('pinned 이 있고 canon 이 없으면 invalid — 주소 없는 박제는 침묵의 주장이다 (AC3)', () => {
  assert.equal(validateDeclaration('{"palette": {"pinned": {"--ink": "#1C1F2E"}}}').state, 'invalid');
  assert.equal(validateDeclaration(`{"palette": {"pinned": {"--ink": "#1C1F2E"}, ${CANON}}}`).state, 'valid');
  // canon 만 있는 포인터 선언은 그대로 valid 다 — 동반은 박제 쪽에 걸린다.
  assert.equal(validateDeclaration(`{"palette": {${CANON}}}`).state, 'valid');
});

test('같은 토큰이 pinned 과 diverged 에 둘 다 있으면 invalid (AC4)', () => {
  const both = `{"palette": {"pinned": {"--ink": "#1C1F2E"}, ${CANON}, "diverged": {"--ink": "우리 값이다"}}}`;
  const r = validateDeclaration(both);
  assert.equal(r.state, 'invalid');
  assert.ok((r as { problems: string[] }).problems[0]!.includes('--ink'));
  // 서로 다른 토큰이면 valid — 배제가 아니라 배타다.
  const apart = `{"palette": {"pinned": {"--ink": "#1C1F2E"}, ${CANON}, "diverged": {"--paper": "우리 값이다"}}}`;
  assert.equal(validateDeclaration(apart).state, 'valid');
});

test('등록부에 없는 판정기 이름은 invalid — 미판정이 아니다 (AC5)', () => {
  const r = validateDeclaration('{"admissions": {"FH11": {"verifiers": ["palete"]}}}');
  assert.equal(r.state, 'invalid');
  const problems = (r as { problems: string[] }).problems;
  assert.ok(problems[0]!.includes('palete'));
  for (const known of VERIFIER_IDS) assert.ok(problems[0]!.includes(known));
  // 등록부 안의 이름은 통과하고, 같은 이름을 두 번 적는 것은 오타다.
  assert.equal(validateDeclaration('{"admissions": {"FH11": {"verifiers": ["refs"]}}}').state, 'valid');
  assert.equal(validateDeclaration('{"admissions": {"FH11": {"verifiers": ["refs", "refs"]}}}').state, 'invalid');
  assert.equal(validateDeclaration('{"admissions": {"FH11": {"verifiers": "refs"}}}').state, 'invalid');
});

test('만기 없는 면제 항은 invalid — 만기 필수가 그 값이다 (AC6)', () => {
  const noExpiry = '{"exemptions": {"FH7": {"reason": "폰트 표면이 없다"}}}';
  assert.equal(validateDeclaration(noExpiry).state, 'invalid');
  const r = validateDeclaration(noExpiry);
  assert.ok((r as { problems: string[] }).problems.some((p) => p.includes('expires')));
  // 형식도 값이다 — 만기 비교는 UTC 날짜 절단이므로 실재하는 YYYY-MM-DD 만 받는다.
  const base = (expires: string) => `{"exemptions": {"FH7": {"reason": "없다", "expires": ${expires}}}}`;
  assert.equal(validateDeclaration(base('"2027-01-31"')).state, 'valid');
  assert.equal(validateDeclaration(base('"2027-02-30"')).state, 'invalid');
  assert.equal(validateDeclaration(base('"2027-1-1"')).state, 'invalid');
  assert.equal(validateDeclaration(base('"2027-01-31T00:00:00Z"')).state, 'invalid');
  assert.equal(validateDeclaration(base('20270131')).state, 'invalid');
});

test('면제의 사유도 필수다 — 읽히는 문장이라 빈 사유는 invalid 다', () => {
  assert.equal(validateDeclaration('{"exemptions": {"FH7": {"reason": "  ", "expires": "2027-01-31"}}}').state, 'invalid');
  assert.equal(validateDeclaration('{"exemptions": {"FH7": {"expires": "2027-01-31"}}}').state, 'invalid');
});

test('diverged — 사유 없는 항과 빈 갈라짐은 invalid 다', () => {
  const base = (diverged: string) => `{"palette": {"diverged": ${diverged}}}`;
  assert.equal(validateDeclaration(base('{"--paper": "우리 값이다"}')).state, 'valid');
  assert.equal(validateDeclaration(base('{"--paper": ""}')).state, 'invalid');
  assert.equal(validateDeclaration(base('{"--paper": 7}')).state, 'invalid');
  assert.equal(validateDeclaration(base('{}')).state, 'invalid');
  assert.equal(validateDeclaration(base('[]')).state, 'invalid');
});

test('편입 기록 · 면제 목록의 모르는 키는 invalid — 파생값과 승인자를 저작할 자리가 없다', () => {
  assert.equal(validateDeclaration('{"admissions": {"FH11": {"verifiers": [], "coverage": "enforced"}}}').state, 'invalid');
  assert.equal(validateDeclaration('{"admissions": {"FH11": {"verifiers": [], "enforcement": "warn"}}}').state, 'invalid');
  assert.equal(
    validateDeclaration('{"exemptions": {"FH7": {"reason": "없다", "expires": "2027-01-31", "approvedBy": "henry"}}}').state,
    'invalid',
  );
  assert.equal(validateDeclaration('{"admissions": []}').state, 'invalid');
  assert.equal(validateDeclaration('{"admissions": {"FH11": "palette"}}').state, 'invalid');
  assert.equal(validateDeclaration('{"exemptions": "FH7"}').state, 'invalid');
});

test('`coverage` 는 적을 자리가 없다고 말한다 — 오타가 아니라 파생값이기 때문이다', () => {
  // 최상위든 편입 기록 안이든 같은 판정 실패이고, 문장이 **왜** 없는지를 말한다:
  // 다른 제품에서 보고 옮겨 적는 이름이라 「이런 키는 없다」로는 고칠 수 없다.
  for (const text of [
    '{"coverage": "enforced"}',
    '{"admissions": {"FH11": {"verifiers": ["refs"], "coverage": "enforced"}}}',
  ]) {
    const r = validateDeclaration(text);
    assert.equal(r.state, 'invalid');
    const problems = (r as { problems: string[] }).problems;
    assert.ok(problems.some((p) => p.includes('coverage') && p.includes('derived')), problems.join(' | '));
  }
  // 집행 강도는 파생이 아니라 **축이 없다** — 읽는 코드 0 인 필드는 거짓 초록이다.
  const enforcement = validateDeclaration('{"admissions": {"FH11": {"enforcement": "warn"}}}');
  assert.equal(enforcement.state, 'invalid');
  assert.ok(
    (enforcement as { problems: string[] }).problems.some((p) => p.includes('no axis')),
  );
});

test('키 부재와 빈 기록 — 편입 0 은 정당한 상태다(선언 없음도, 「편입 0」 선언도)', () => {
  const noKey = validateDeclaration('{}') as ValidDeclaration;
  assert.equal(noKey.admissions, null);
  assert.equal(noKey.exemptions, null);
  const empty = validateDeclaration('{"admissions": {}, "exemptions": {}}') as ValidDeclaration;
  assert.deepEqual(empty.admissions, {});
  assert.deepEqual(empty.exemptions, {});
});
