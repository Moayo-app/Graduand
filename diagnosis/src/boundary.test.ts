/**
 * 공개 경계의 AC — 공개 배달 범위에 내부 자산이 0 이다.
 * 이 폴더는 공개 배달 범위라서, 경계는 산문이 아니라 이 테스트가 집행한다.
 *
 * 금지 패턴은 이 파일 자신이 걸리지 않도록 조각으로 들고 실행 시 조립한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openCommand } from '../../verifier/src/open.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

type ScopeEntry =
  | { readonly file: string; readonly why: string }
  | { readonly dir: string; readonly ext: string; readonly why: string };

/**
 * ⭐⭐ **AC7 의 분모 — 손으로 쓰는 배달 파일만 열거한다.**
 *
 * ⭐ **왜 분모가 좁은가.** 이 폴더로 **생성물이 들어온다.** 정책 3종 HTML 은 공개 저장소의
 * 정본 산문에서 렌더되고, 그 산문은 **법정 공개 항목**(상호 · 대표자 · 사업자등록번호 ·
 * 주소)을 축자로 품어야 한다. 그 생성물을 분모에 넣으면 AC7 은 「법정 게시 항목이 샜다」고
 * 말한다 — 참이 아니다. 이 테스트의 이름이 「내부 자산 0」인데 **상호는 내부 자산이 아니다.**
 * ⇒ 고치는 것은 **잘못 선언한 분모**이지 금칙이 아니다 — 금칙 여섯은 하나도 걷지 않았다.
 *
 * ⚠️ 좁히는 것은 「**앞으로 생길 생성물을 자동으로 삼키지 않게**」이지 지금 보고 있는 것을
 * 줄이는 것이 아니다. `src/` 는 **디렉터리째로** 들어 있어 새 손글씨가 분모를 자동으로 얻고,
 * `README.md` 와 테스트 파일도 그대로 분모다. 분모를 넓게 둔 채 금칙만 걷는 길은 ⛔ —
 * 그러면 내부 저장소·도메인 누출이 같이 열린다.
 *
 * ⭐ 그리고 아래 완전성 가드가 **분모에도 없고 제외 목록에도 없는 파일**을 판정 실패로
 * 만든다 — 조용히 빠져나가는 자리를 남기지 않는 것이 좁은 분모의 전제다.
 */
const judgedScope: readonly ScopeEntry[] = [
  { file: 'index.html', why: '화면 — 손으로 쓴다' },
  { file: 'styles.css', why: '화면 — 손으로 쓴다' },
  { file: 'README.md', why: '배달되는 산문 — 내부 근거가 새기 가장 쉬운 자리다' },
  { file: 'package.json', why: '배달되는 손글씨 설정 — 이름·설명·스크립트가 내부 이름을 품을 수 있다' },
  { file: 'tsconfig.json', why: '배달되는 손글씨 설정' },
  { file: 'tsconfig.build.json', why: '배달되는 손글씨 설정' },
  { dir: 'src', ext: '.ts', why: '화면 코드 전부 — 테스트까지 디렉터리째로 센다. 새 파일이 분모를 자동으로 얻는다' },
];

/** 분모 **밖**임을 사유와 함께 선언한 것들 — 손으로 쓰지 않는 것뿐이다. */
const scopeExclusions: readonly { readonly match: RegExp; readonly why: string }[] = [
  {
    match: /^policies\//,
    why: '정책 3종 HTML 은 공개 저장소의 정본 산문에서 렌더된 생성물이다 — 법정 공개 항목을 축자로 품어야 하고, 그것은 내부 자산이 아니다',
  },
  { match: /^portal\//, why: '고객 포털은 판매자 쪽 화면이다 — 이 패키지가 쓰는 산문이 아니다' },
  { match: /^dist\//, why: '빌드 산출물 — 커밋하지 않는다' },
  { match: /^node_modules\//, why: '의존성 — 우리 손글씨가 아니다' },
  { match: /^package-lock\.json$/, why: 'npm 생성물 — 손으로 쓰지 않는다' },
];

/** 금칙 — 하나도 걷지 않는다. 각 항에 **왜 내부 자산인가**를 적는다. */
const internalPatterns: readonly { readonly id: string; readonly source: string; readonly why: string }[] = [
  { id: 'company', source: ['mo', 'ayo'].join(''), why: '사명 — 내부 조직·저장소·도메인 전부가 이것을 품는다' },
  { id: 'platform', source: ['agent', '-platform'].join(''), why: '내부 저장소 이름' },
  { id: 'decision', source: ['adr', '-\\d'].join(''), why: '결정 기록 번호 — 비공개 산문을 가리킨다' },
  { id: 'issue', source: ['iss', 'ue-\\d'].join(''), why: '내부 이슈 번호' },
  { id: 'local-path', source: ['/Us', 'ers/'].join(''), why: '로컬 절대 경로' },
  { id: 'person', source: ['hen', 'ry'].join(''), why: '내부 사람 — 핸들이 경로와 커밋에 붙어 다닌다' },
];

/**
 * ⭐⭐ **밖으로 나가는 주소 금칙 — 나가는 문은 하나다.**
 *
 * ⭐ **분모가 왜 넓어졌는가.** 이 금칙은 `index.html` 의 `href`·`src` 속성에만 걸려
 * 있었다. 그래서 ⭕ **전송**은 막혀 있었지만(네트워크 원시 금칙) ⛔ 막히지 않던
 * 것은 **이동**이다 — 화면 코드에는 가드가 **0** 이라, 이동을 지시하는 한 줄이
 * 방문자를 아무 호스트로나 보내고도 초록이었다. 가드가 **반만** 집행된 것이다.
 * ⇒ 분모를 속성에서 **화면 코드 전부**(`shippedSrc`)로 넓힌다.
 *
 * ⭐ 그리고 그것이 제품 정의에 맞는 자리다 — 밖으로 나가는 모든 것을 상대 경로 **한
 * 문**(`./`)으로 모으면 ⑴ 「무엇이 나가는가」가 git 에 보이는 목록 하나가 되고
 * ⑵ 그 문이 곧 지정된 리다이렉트가 바라보는 자리다. ⛔ 벤더 주소가 발행된 화면에
 * 박히지 않는다 — 벤더가 주소를 바꾼 날 그 화면이 거짓말을 한다.
 *
 * ⚠️ 테스트 파일은 분모가 아니다 — 입력 해석기의 spec 은 절대 주소를 **축자로
 * 들어야** 한다(그것이 파싱하는 대상이다). 발행되는 것은 `shippedSrc` 이고, 금칙은
 * 거기만큼 넓다 — 더 넓히면 사실이 아닌 말을 하고, 더 좁히면 이동이 다시 열린다.
 */
const outboundPatterns: readonly { readonly id: string; readonly source: string; readonly why: string }[] = [
  {
    id: 'absolute-url',
    source: ['ht', 'tps?:'].join(''),
    why: '절대 주소 — 이동을 지시하는 한 줄이 방문자를 밖으로 보낸다. 나가는 문은 상대 경로 하나다',
  },
  {
    id: 'protocol-relative',
    source: ['[\'"`]', '\\/', '\\/'].join(''),
    why: '프로토콜 상대 주소도 밖이다 — 스킴만 생략된 절대 주소이고, 상대 경로처럼 보여서 더 위험하다',
  },
];

/**
 * `index.html` 의 `href`·`src` 금칙 — **자구 그대로**, 단정 둘을 뿌리를 받는 꼴로만
 * 옮겼다. 화면은 속성으로, 화면 코드는 문자열로 나가서 금칙 둘은 한 목록이 아니다.
 */
const htmlOutboundBans: readonly RegExp[] = [
  new RegExp(`(href|src)="${['ht', 'tps?:'].join('')}`, 'i'),
  new RegExp(`(href|src)="${['\\/', '\\/'].join('')}`, 'i'),
];

type Exemption = {
  readonly file: string;
  readonly region: RegExp;
  readonly patterns: readonly string[];
  readonly why: string;
};

/**
 * ⭐⭐ **면제 — 자리와 사유를 적어 선언한다.** 이 제품이 파는 어휘 그대로다(선언 파일의
 * 최상위 키 `exemptions`): 면제는 **좁고 · 이름이 붙고 · 사유가 있다.**
 *
 * ⭐ **왜 사명 금칙을 걷지 않고 자리만 면제하는가.** 그 금칙이 잡으려던 것은 주석 축자대로
 * 「내부 조직·저장소·도메인」이다 — 공개 저장소가 아닌 사내 저장소 이름과 내부 호스트가
 * 전부 사명을 품는다. 목록에서 걷으면 **그것들이 같이 열린다.** 반면 **상호는 내부 자산이
 * 아니라 게시 의무 항목이다**(🇰🇷 전자상거래법 시행령 §31② — 인터넷 홈페이지에 지속적으로
 * 게재). 그래서 금칙은 그대로 두고, 상호가 **서야 하는 블록 하나**만 면제한다.
 *
 * ⚠️ 면제는 **그 블록 안에서 사명 하나**에만 듣는다 — 나머지 다섯 금칙은 블록 안에서도 그대로
 * 돌고, 사명도 블록 **밖에서는** 그대로 금칙이다(AC2 가 둘 다 심어서 빨강을 확인한다).
 * 그리고 면제가 가리키는 블록이 없어지면 **낡은 선언이므로 판정 실패**다 — 선언하지 않은 것은
 * 미판정, 잘못 선언한 것은 판정 실패.
 */
const exemptions: readonly Exemption[] = [
  {
    file: 'index.html',
    region: /<div class="publisher">[\s\S]*?<\/div>/g,
    patterns: ['company'],
    why: '사업자 신원정보(법정 게시)와 저작권 표시가 서는 블록 — 상호는 게시 의무 항목이지 내부 자산이 아니다',
  },
];

/** 분모에 든 파일 전부, `root` 기준 상대 경로. 열거한 파일은 **있어야 한다** — 없으면 분모가 거짓이다. */
function scopedFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of judgedScope) {
    if ('file' in entry) {
      assert.ok(existsSync(join(root, entry.file)), `분모에 열거된 ${entry.file} 이 없다 — 분모가 거짓이다`);
      files.push(entry.file);
    } else {
      files.push(
        ...readdirSync(join(root, entry.dir))
          .filter((name) => name.endsWith(entry.ext))
          .sort()
          .map((name) => `${entry.dir}/${name}`),
      );
    }
  }
  return files;
}

/** 분모를 돌며 금칙 위반을 센다 — 면제된 자리에서는 **면제된 금칙만** 비켜 간다. */
function internalAssetLeaks(root: string): string[] {
  const leaks: string[] = [];
  for (const file of scopedFiles(root)) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const pattern of internalPatterns) {
      let subject = text;
      for (const exemption of exemptions.filter((e) => e.file === file && e.patterns.includes(pattern.id))) {
        const regions = [...text.matchAll(exemption.region)].map((m) => m[0]);
        assert.ok(regions.length > 0, `${file}: 면제가 가리키는 자리가 없다 — 낡은 면제 선언이다 (${exemption.why})`);
        for (const region of regions) subject = subject.replace(region, '');
      }
      if (new RegExp(pattern.source, 'i').test(subject)) leaks.push(`${file}: ${pattern.id}`);
    }
  }
  return leaks;
}

/** 분모를 그대로 베낀 깨끗한 사본 — 금칙을 심어 **빨강을 실제로 확인할** 자리. */
function scopeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-scope-'));
  for (const file of scopedFiles(ROOT)) {
    mkdirSync(join(root, dirname(file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(root, file));
  }
  return root;
}

/** 발행되는 화면 코드 — 분모에서 테스트를 뺀 것. 뒤의 하네스가 사본에도 같은 유도를 쓰게 뿌리를 받는다. */
const shippedSrcOf = (root: string): string[] =>
  scopedFiles(root).filter((path) => path.startsWith('src/') && !path.endsWith('.test.ts'));

const shippedSrc = shippedSrcOf(ROOT);

/** 화면 코드를 돌며 밖으로 나가는 주소를 센다 — 속성이 아니라 **문자열**을 본다. */
function outboundAddressLeaks(root: string): string[] {
  const leaks: string[] = [];
  for (const file of shippedSrcOf(root)) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const pattern of outboundPatterns) {
      if (new RegExp(pattern.source, 'i').test(text)) leaks.push(`${file}: ${pattern.id}`);
    }
  }
  return leaks;
}

/** `index.html` 의 `href`·`src` 에 걸린 기존 금칙 — 같은 단정을 사본에도 돌릴 수 있게. */
function htmlOutboundLeaks(root: string): string[] {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  return htmlOutboundBans.filter((ban) => ban.test(html)).map((ban) => `index.html: ${ban.source}`);
}

/**
 * 화면 코드가 체크아웃을 쥐고 있는가 — 해당 id 나 「준비 중」 쪽지 하나도 안 된다.
 * 배선이 없으면 끊길 것도 없다 — 그것이 자바스크립트 없이 눌리는 조건이다.
 */
function checkoutWiringLeaks(root: string): string[] {
  const leaks: string[] = [];
  const pending = ['준비', ' 중'].join('');
  for (const file of shippedSrcOf(root)) {
    const text = readFileSync(join(root, file), 'utf8');
    if (/checkout/i.test(text)) leaks.push(`${file}: checkout-배선`);
    if (text.includes(pending)) leaks.push(`${file}: ${pending}`);
  }
  return leaks;
}

/** 구독 입구의 `<a>` 하나 — 푸터의 `policy-link` 와 같은 꼴로, 클래스로 센다. */
function checkoutAnchor(html: string): string {
  const found = [...html.matchAll(/<a\b[^>]*class="[^"]*checkout-link[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(found.length, 1, `체크아웃 입구가 checkout-link 하나가 아니다 (${found.length} 건)`);
  return found[0]!;
}

/**
 * 푸터 저작권 줄의 **자구**. 형식은 「기호 → 연도 → 권리자」고, 그 순서가 고집이다.
 *
 * ⭐ **왜 연도는 남기고 「All rights reserved」는 걷는가.** 둘은 효력이 다르다.
 * 연도는 형식 요건(기호·**발행 연도**·권리자)의 한 칸이고, 고지가 붙은 사본에 접근한
 * 피고의 **innocent-infringement 완화 항변을 차단**하는 실익이 거기서 나온다. ⇒ 연도를
 * 기호 앞으로 옮기면 **유지 비용을 치르면서 그 비용의 근거를 약하게 만든다.**
 * 반면 「All rights reserved」는 부에노스아이레스 협약(1910) 유물이고 그 당사국이
 * 전부 베른에 들어온 뒤로 **아무 일도 하지 않는다** — 집행되지 않는 주문은 두지 않는다.
 *
 * ⭐ **최종 모양은 범위다** — `© {최초}–{최종} …` (구분자는 en dash). 지금 한 해만
 * 적히는 것은 최초 발행이 2026 이라 범위가 `2026–2026` 으로 **접히기 때문**이다 —
 * 시작과 끝이 같으면 한 해만 적는 것이 관행이다.
 *
 * ⚠️ **끝 연도 주입은 여기 없다 — 그래서 이 연도를 무는 것도 0 이다.** 이 패키지의
 * 빌드는 `tsc` 하나이고 `index.html` 은 **빌드를 타지 않는다**(손글씨가 그대로 나간다).
 * 주입을 넣으면 소스에 플레이스홀더가 들어가 **공개 경계 가드가 읽는 파일과 발행되는
 * 파일이 갈라진다** — 분모와 publisher 블록 면제가 둘 다 소스를 읽는다. 게다가
 * 배포 경로가 아직 서지 않았다 — 어디에 주입할지 모르는 채로 기계를 짓지 않는다.
 * ⇒ **해를 넘기면 사람이 이 줄을 고쳐야 하고, 그것을 알려 주는 것은 없다.** 숨기지
 * 않고 적는다 — 「안 재다」가 아니라 「재고, 무는 것이 없다」이다.
 */
function copyrightLine(): string {
  return `© 2026 ${['Mo', 'ayo'].join('')} Inc.`;
}

test('AC7 — 내부 자산 0: 분모의 모든 파일에 내부 조직·저장소·결정 기록·사람이 없다', () => {
  assert.deepEqual(internalAssetLeaks(ROOT), []);
});

test('AC1 — 푸터에 상호가 선 index.html 이 AC7 에 걸리지 않는다', () => {
  const html = read('index.html');
  assert.match(html, /주식회사 모아요/, '푸터에 상호가 없다');
  assert.ok(html.includes(copyrightLine()), '푸터에 저작권 자구가 없다');
  assert.deepEqual(internalAssetLeaks(ROOT).filter((leak) => leak.startsWith('index.html')), []);

  // ⭐ 면제가 **그 블록만큼만** 넓다 — 사명이 블록 밖에 한 글자도 없다.
  const company = new RegExp(['mo', 'ayo'].join(''), 'gi');
  const inside = [...html.matchAll(exemptions[0]!.region)].map((m) => m[0]).join('');
  const count = (text: string): number => (text.match(company) ?? []).length;
  assert.ok(count(inside) > 0, '면제 블록에 상호가 없다 — 면제가 가리키는 자리가 비었다');
  assert.equal(count(html), count(inside), '사명이 면제 블록 밖에 있다');
});

test('AC2 (negative) — 금칙은 살아 있다: 내부 자산을 심으면 AC7 이 빨갛다', () => {
  // 음성 대조군 — 깨끗한 사본이 초록이어야 「심으니 빨갛다」가 금칙의 증거가 된다.
  assert.deepEqual(internalAssetLeaks(scopeFixture()), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  // 금칙 여섯을 전부 심는다 — 이슈가 적은 넷(저장소·이슈 번호·로컬 경로·사람)에 결정 기록과 사명을 더해서.
  const planted = [
    ['agent', '-platform'].join(''),
    ['iss', 'ue-', '12'].join(''),
    ['/Us', 'ers/', 'acct/repo'].join(''),
    ['hen', 'ry'].join(''),
    ['adr', '-0006'].join(''),
    ['mo', 'ayo', '-hq'].join(''),
  ];
  for (const sample of planted) {
    const root = scopeFixture();
    writeFileSync(join(root, 'src', 'leak.ts'), `export const note = '${sample}';\n`);
    assert.notDeepEqual(internalAssetLeaks(root), [], `${sample} 을 심었는데 AC7 이 초록이다 — 금칙이 죽었다`);
  }

  // ⭐⭐ 사명은 **면제 블록 밖에서는** 그대로 금칙이다 — 면제가 파일 전체로 번지지 않았다.
  const root = scopeFixture();
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const bare = `${['Mo', 'ayo'].join('')} Inc.`;
  writeFileSync(join(root, 'index.html'), html.replace('</main>', `  <p>${bare}</p>\n</main>`));
  assert.notDeepEqual(internalAssetLeaks(root), [], '면제 블록 밖의 사명이 초록이다 — 면제가 너무 넓다');
});

test('AC3 — AC7 의 분모·제외·면제·금칙이 전부 열거돼 있고 각 항에 사유가 붙어 있다', () => {
  assert.ok(judgedScope.length > 0, '분모가 비었다');
  const self = read('src/boundary.test.ts');
  for (const entry of judgedScope) {
    const key = 'file' in entry ? entry.file : entry.dir;
    assert.ok(self.includes(`'${key}'`), `분모 항 ${key} 이 소스에 열거돼 있지 않다`);
    assert.ok(entry.why.length >= 8, `분모 항 ${key} 에 사유가 없다 — 좁히는 선언은 사유 없이 두지 않는다`);
  }
  for (const exclusion of scopeExclusions) {
    assert.ok(exclusion.why.length >= 8, `제외 항 ${exclusion.match.source} 에 사유가 없다`);
  }
  for (const exemption of exemptions) {
    assert.ok(exemption.why.length >= 8, `면제 ${exemption.file} 에 사유가 없다`);
    assert.ok(exemption.patterns.length > 0, `면제 ${exemption.file} 이 어느 금칙을 비키는지 적지 않았다`);
  }
  for (const pattern of [...internalPatterns, ...outboundPatterns]) {
    assert.ok(pattern.why.length >= 4, `금칙 ${pattern.id} 에 사유가 없다`);
  }
});

test('AC3 — 분모 완전성: 배달되는 파일이 분모에 있거나 사유와 함께 제외돼 있다', () => {
  // 배달 범위 = 커밋된 것. 분모가 좁아도 **조용히 빠져나가는 자리**는 없다.
  const tracked = spawnSync('git', ['ls-files', '--cached'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(tracked.status, 0, `git ls-files 가 실패했다: ${tracked.stderr}`);
  const scoped = new Set(scopedFiles(ROOT));
  const unaccounted = tracked.stdout
    .split('\n')
    .filter(Boolean)
    .filter((path) => !scoped.has(path) && !scopeExclusions.some((exclusion) => exclusion.match.test(path)));
  assert.deepEqual(unaccounted, [], '분모에도 없고 제외 목록에도 없다 — 선언하지 않은 것은 미판정이다');
});

test('AC7 — import 경계: 페이지 코드는 자기 자신과 판정기 공개 모듈만 가져온다', () => {
  for (const file of shippedSrc) {
    const text = read(file);
    for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
      const spec = match[1]!;
      assert.ok(
        spec.startsWith('./') || spec.startsWith('../../verifier/src/'),
        `${file} 이 경계 밖을 가져온다: ${spec}`,
      );
    }
    assert.doesNotMatch(text, /\bimport\s*\(/, `${file}: 동적 import 금지`);
  }
});

test('판정 결과를 되쏠 수 있는 네트워크 원시가 페이지 코드에 없다', () => {
  const networkPatterns = [
    /XMLHttpRequest/,
    /sendBeacon/,
    /WebSocket/,
    /EventSource/,
    /new\s+Image\s*\(/,
    /\bfetch\s*\(/, // fetch 는 판정기 로더가 쥔다 — 페이지는 주입만 한다
  ];
  for (const file of shippedSrc) {
    const text = read(file);
    for (const pattern of networkPatterns) {
      assert.doesNotMatch(text, pattern, `${file} 에 네트워크 원시가 있다: ${pattern}`);
    }
  }
});

test('입구 — 입력 칸은 저장소 주소 하나다: PAT·비밀번호 입력 칸이 없다', () => {
  const html = read('index.html');
  assert.equal((html.match(/<input/g) ?? []).length, 1);
  assert.doesNotMatch(html, /type="password"/i);
  assert.doesNotMatch(html, /name="(token|pat|secret)"/i);
  assert.deepEqual(advertisedCommands(), ['npx graduand --open', 'npx graduand init']);
});

/**
 * 페이지가 **광고하는** 명령 전부. 입구의 둘째 칸이 파는 것이 이 한 줄이라, 이 목록은
 * 산문이 아니라 아래 테스트의 입력이다.
 */
function advertisedCommands(): string[] {
  const html = read('index.html');
  const found = [...html.matchAll(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>/g)].map((m) =>
    m[1]!.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim(),
  );
  assert.ok(found.length > 0, 'index.html 이 광고하는 명령을 하나도 찾지 못했다 — 표기가 바뀌었다면 이 추출기가 함께 움직인다');
  return found;
}

/**
 * ⭐⭐ **페이지가 광고하는 모든 명령이 CLI 에서 실제로 돈다.**
 *
 * 문자열 단정만으로는 같은 결함이 또 통과한다 — 실제로 통과했다: 이 칸이 `--open` 을
 * 광고하는데 판정기 CLI 는 그 플래그를 몰라 **exit 2(판정 실패)로 죽었고**, 입구
 * 테스트가 「그 문자열이 있다」만 보았으므로 필수 체크 둘이 **초록**이었다. 광고와
 * 실물이 어긋나는 것이 이 제품이 파는 바로 그 결함이라, 여기서는 **뽑아서 돌린다.**
 *
 * 종료 코드는 문서화된 셋 중 둘만 받는다 — 0(위반 0) · 1(위반 ≥ 1). **2 는 0 건이다.**
 */
test('AC5 — 페이지가 광고하는 명령이 전부 CLI 에서 돈다: exit 2 가 0 건', () => {
  const verifierRoot = join(ROOT, '..', 'verifier');
  const bin = (
    JSON.parse(readFileSync(join(verifierRoot, 'package.json'), 'utf8')) as { bin: Record<string, string> }
  ).bin;

  // 「여는 행위」를 PATH 앞의 같은 이름으로 가로챈다 — 테스트가 브라우저를 띄우지 않는다.
  const stubDir = mkdtempSync(join(tmpdir(), 'graduand-opener-'));
  const stub = join(stubDir, openCommand(process.platform).command);
  writeFileSync(stub, '#!/bin/sh\nexit 0\n');
  chmodSync(stub, 0o755);
  const env = { ...process.env, PATH: `${stubDir}${delimiter}${process.env.PATH ?? ''}` };

  const root = gitFixture({ 'README.md': 'ok\n' });
  for (const command of advertisedCommands()) {
    const [runner, name, ...args] = command.split(/\s+/);
    assert.equal(runner, 'npx', `${command}: 이 하네스가 돌릴 수 있는 꼴이 아니다`);
    assert.ok(name !== undefined && name in bin, `${command}: ${String(name)} 은 패키지의 bin 에 없다`);
    // 첫 자리는 하위 명령(`init`)도 올 수 있다 — 그 뒤는 플래그뿐이다.
    args.forEach((arg, i) => {
      const shape = i === 0 ? /^(--[a-z-]+(=\S+)?|[a-z][a-z-]*)$/ : /^--[a-z-]+(=\S+)?$/;
      assert.match(arg, shape, `${command}: ${arg} — 이 하네스가 돌릴 수 있는 꼴이 아니다`);
    });

    const r = spawnSync(process.execPath, [join(verifierRoot, bin[name]!), ...args], {
      cwd: root, // 광고된 대로 — 고객 저장소 안에서 플래그만 주고 돈다
      encoding: 'utf8',
      env,
    });
    assert.notEqual(r.status, 2, `${command} 가 판정 실패(2)로 죽었다: ${r.stderr}`);
    assert.ok([0, 1].includes(r.status!), `${command}: 문서에 없는 종료 코드 ${r.status} — ${r.stderr}`);
  }
});

/** 광고된 명령을 돌릴 최소 저장소 — 추적 파일 하나와 커밋 하나. */
function gitFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'graduand-advertised-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const git = (...args: string[]) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fixture');
  return root;
}

/**
 * ⭐⭐ **한 문 — 밖으로 나가는 것은 상대 경로 하나로 모인다.** 아래 다섯은 이 이슈가 세운 AC1~AC5
 * 그대로다 — 금칙 셋(negative)은 위반을 **실제로 심어** 빨강을 확인하고, 양성 둘은
 * 발행된 바이트만 본다(바이트가 자바스크립트 없는 방문자가 받는 전부다).
 */
test('한 문 AC1 (negative) — 화면 코드에 밖으로 나가는 주소가 0: 심으면 빨갛다', () => {
  assert.deepEqual(outboundAddressLeaks(ROOT), []);

  // 우선 음성 대조군 — 깨끗한 사본이 초록이어야 「심으니 빨갛다」가 금칙의 증거가 된다.
  assert.deepEqual(outboundAddressLeaks(scopeFixture()), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  const planted = [
    // ⛔ 이것이 그전에 가드가 **0** 이던 자리다 — 전송은 막혔고 이동은 열려 있었다.
    `window.location.assign('${['ht', 'tps://', 'pay.example/checkout'].join('')}');`,
    `const vendor = '${['ht', 'tp://', 'pay.example'].join('')}';`,
    `const vendor = ${JSON.stringify(['//', 'pay.example'].join(''))};`,
  ];
  for (const sample of planted) {
    const root = scopeFixture();
    writeFileSync(join(root, 'src', 'outbound.ts'), `export const go = (): void => { ${sample} };\n`);
    assert.notDeepEqual(outboundAddressLeaks(root), [], `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`);
  }
});

test('한 문 AC2 (negative) — index.html 의 href·src 금칙이 그대로 초록이다: 심으면 빨갛다', () => {
  // 기존 단정 둘 — 자구 그대로. 푸터에 새로 선 사업자 부분도 이 단정 아래다.
  const html = read('index.html');
  for (const ban of htmlOutboundBans) assert.doesNotMatch(html, ban);
  assert.deepEqual(htmlOutboundLeaks(ROOT), []);
  assert.deepEqual(htmlOutboundLeaks(scopeFixture()), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  const planted = [
    `<a href="${['ht', 'tps://', 'pay.example/checkout'].join('')}">x</a>`,
    `<img src="${['//', 'cdn.example/x.png'].join('')}" alt="">`,
  ];
  for (const sample of planted) {
    const root = scopeFixture();
    const copy = readFileSync(join(root, 'index.html'), 'utf8');
    writeFileSync(join(root, 'index.html'), copy.replace('</main>', `  ${sample}\n</main>`));
    assert.notDeepEqual(htmlOutboundLeaks(root), [], `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`);
  }
});

test('한 문 AC3 — 체크아웃은 <a> 이고 href 가 상대 경로다', () => {
  const html = read('index.html');
  const cta = /<section id="cta"[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(cta, 'index.html 에 구독 절이 없다');

  // 푸터의 `policy-link` AC 와 같은 꼴 — 클래스를 센다.
  assert.equal((cta.match(/checkout-link/g) ?? []).length, 1, '구독 절의 체크아웃 입구가 하나가 아니다');
  const href = /href="([^"]*)"/.exec(checkoutAnchor(cta))?.[1];
  assert.equal(href, './checkout/', '체크아웃 href 가 지정된 리다이렉트 자리가 아니다');

  // 버튼은 자리를 비웠다 — 같은 입구가 둘이면 어느 것이 문인지 모른다.
  assert.doesNotMatch(html, /id="checkout-button"/);
  assert.doesNotMatch(html, /id="checkout-stub"/);
});

test('한 문 AC4 — 자바스크립트를 끈 브라우저에서도 체크아웃 링크가 눌린다', () => {
  // Given 자바스크립트를 끈 브라우저 ⇒ 방문자가 받는 것은 **발행된 바이트** 하나다.
  const anchor = checkoutAnchor(read('index.html'));

  assert.doesNotMatch(anchor, /\bhidden\b/, '링크가 hidden 이다 — 스크립트가 없으면 보이지 않는다');
  assert.doesNotMatch(anchor, /\son[a-z]+=/i, '링크가 인라인 핸들러에 매달려 있다');

  const href = /href="([^"]*)"/.exec(anchor)?.[1] ?? '';
  assert.ok(href.startsWith('./'), `href 가 상대 경로가 아니다: ${href}`);
  assert.doesNotMatch(href, new RegExp(['jav', 'ascript:'].join(''), 'i'), 'href 가 스크립트 실행이다');

  // Then 화면 코드는 이 링크를 쥐지 않는다 — 배선이 없으니 끊어질 것도 없다.
  assert.deepEqual(checkoutWiringLeaks(ROOT), []);
});

test('한 문 AC5 (negative) — 화면 코드에 체크아웃 핸들러·「준비 중」이 0: 되살리면 빨갛다', () => {
  assert.deepEqual(checkoutWiringLeaks(ROOT), []);
  assert.deepEqual(checkoutWiringLeaks(scopeFixture()), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  const planted = [
    // 걷어낸 배선 그대로 — 클릭을 기다리는 문과 「준비 중」 쪽지.
    `must<HTMLButtonElement>('#checkout-button').addEventListener('click', () => {});`,
    `stub.textContent = '결제 창구는 ${['준비', ' 중'].join('')}이다';`,
  ];
  for (const sample of planted) {
    const root = scopeFixture();
    const main = readFileSync(join(root, 'src', 'main.ts'), 'utf8');
    writeFileSync(join(root, 'src', 'main.ts'), `${main}\n${sample}\n`);
    assert.notDeepEqual(checkoutWiringLeaks(root), [], `${sample} 을 되살렸는데 초록이다 — 가드가 죽었다`);
  }
});

test('수를 접는 말이 화면에 없다 — 3상태 밖의 지표 어휘 0', () => {
  const foldingWords = [
    ['점', '수'].join(''),
    ['등', '급'].join(''),
    ['백분', '율'].join(''),
    ['sco', 're'].join(''),
    ['gra', 'de'].join(''),
    ['perc', 'ent'].join(''),
  ];
  for (const file of [...shippedSrc, 'index.html', 'styles.css']) {
    const text = read(file).toLowerCase();
    for (const word of foldingWords) {
      assert.ok(!text.includes(word), `${file} 에 지표 어휘가 있다: ${word}`);
    }
  }
});

test('CTA — 경계 문장 · 가격(총액) · 세금 한 줄', () => {
  const html = read('index.html');
  assert.match(html, /판정은 고객 쪽에서 돌고/);
  assert.match(html, /월 \$15/);
  assert.match(html, /연 \$150/);
  assert.match(html, /총액/);
  assert.match(html, /세금[^<]*체크아웃에서 확정/);
});

test('AC4 — 푸터: 상호 · 정책 문서 3종(privacy 가 보이는 링크) · 고객 포털 해지 · 갱신 조건 · 저작권 표시를 함께 담는다', () => {
  const footer = /<footer>([\s\S]*)<\/footer>/.exec(read('index.html'))?.[1];
  assert.ok(footer, 'index.html 에 푸터가 없다');
  assert.ok((footer.match(/policy-link/g) ?? []).length >= 3);
  assert.match(footer, /<a[^>]*>[^<]*privacy[^<]*<\/a>/i);
  assert.match(footer, /고객 포털/);
  assert.match(footer, /해지/);
  assert.match(footer, /자동 갱신/);

  // ⭐ 법정 게시(🇰🇷 전자상거래법 시행령 §31② 지속 게재) — 항목과 값은 공개 저장소의 처리방침
  // 정본이 적는 것을 그대로 옮긴다. ⛔ 여기서 새로 지어내지 않는다.
  assert.match(footer, /주식회사 모아요/);
  assert.match(footer, /대표자/);
  assert.match(footer, /사업자등록번호/);
  assert.match(footer, /주소/);

  // ⭐ 저작권 줄은 법정 게시와 **다른 것**이다 — 관행이고, 자구가 확정돼 있다.
  assert.ok(footer.includes(copyrightLine()), '저작권 자구와 문자가 다르다');

  // ⚠️ `includes` 는 **접두사만** 본다 — 「더 붙은」 판이 그대로 통과한다.
  // 걷은 것은 **없다는 것을 따로** 단정한다. ⚠️ 연도는 걷은 것이 아니다 —
  // 형식 요건의 한 칸이라 **있어야** 하고, 그것은 `copyrightLine()` 이 문단단정으로 물고 있다.
  assert.doesNotMatch(footer, /All rights reserved/i, '「All rights reserved」가 남았다');
});
