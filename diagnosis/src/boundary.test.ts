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

// ⚠️ `ENTITLEMENT` 는 **공개 표면**(`index.ts`)에서 받는다 — 모듈을 직접 가져오면 순환
//    초기화에 먼저 닿아 상수가 아직 비어 있다(실측: `declaration.ts` 가 그것을 쥔다).
import { ENTITLEMENT, looksLikeFragment } from '../../verifier/src/index.ts';
import { openCommand } from '../../verifier/src/open.ts';
import { VERIFIER_IDS } from '../../verifier/src/verifiers/registry.ts';
import {
  CHROME_FILE,
  DOCUMENT_FILE,
  PAGE_SCRIPTS,
  publishedPath,
  readSources,
  renderAll,
  renderSite,
  TEMPLATE_FILE,
  TEMPLATES,
} from './generate.ts';
import {
  DOCUMENTS,
  documentUrl,
  siblingLocalePath,
  SITE_ORIGIN,
  type DocumentId,
} from './site.ts';
import { copyrightLine, PUBLISHER_ROWS } from './publisher.ts';
import { CATALOG, LOCALES, type Locale } from './strings.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/**
 * ⭐⭐ **발행본이 분모다 — 손글씨가 아니다.** 산문이 카탈로그로 내려오면서 「화면에 무엇이
 * 서 있는가」의 답이 손글씨 하나에서 **틀 + 카탈로그 둘**로 갈렸다. 그래서 「무엇이 서 있는가」를
 * 묻는 단정은 전부 **생성기가 낸 바이트**를 받는다 — 그것이 자바스크립트를 끈 방문자가 받는
 * 전부이고, 틀만 보면 금칙이 반만 집행된다(산문이 틀에 없으므로 **아무 말도 하지 않는다**).
 *
 * ⚠️ 그래서 발행본의 이름은 `<로케일>/index.html` 이다 — ⛔ 로케일 **수**를 적지 않는다:
 * 분모는 `LOCALES` 에서 받는다.
 */
const documentName = (locale: Locale): string => publishedPath(locale, 'page');

/**
 * 발행본 **전수** — 문서 × 로케일. ⭐⭐ **금칙의 분모가 여기서 넓어졌다**: 아래 단정들이
 * 이 목록을 돌므로, 둘째 문서가 서면서 내부 자산 · 밖으로 나가는 주소 · 하드코딩 한글 ·
 * 날짜 금칙이 **가드를 고치지 않고** 그 문서까지 덮는다.
 *
 * ⭐ 원페이지의 틀을 **인자로** 받는 꼴은 유지한다 — 음성 대조군(금칙을 심은 틀)이 그 꼴에
 * 기대 있고, 나머지 손글씨는 디스크에서 온다.
 */
const documentsFrom = (pageTemplate: string): Record<string, string> => ({
  ...renderSite({ ...readSources(ROOT), page: pageTemplate }),
});

const documents = (): Record<string, string> => documentsFrom(read(TEMPLATE_FILE));

/** 정본 로케일의 발행본 — 한국어 **자구**를 무는 단정이 보는 자리(ko 가 정본이다). */
const canonDocument = (): string => documents()[documentName(LOCALES[0])]!;

/**
 * **원페이지만** — 그 문서의 블록을 무는 단정들이 받는다(가격 입구 · 블록 순서 · 안 선 것의
 * 고지 · 광고된 명령). ⭐ 둘째 문서는 블록이 다르므로 **자기 단정을 따로 진다**: 같은 목록을
 * 두 문서에 걸면 어느 쪽도 참이 아닌 단정이 되고, 그러면 고치는 손이 금칙을 걷는다.
 *
 * ⛔ **금칙은 이 좁힘을 받지 않는다** — 내부 자산 · 밖으로 나가는 주소 · 하드코딩 한글 ·
 * 날짜 · 접는 어휘는 여전히 `documents()`(문서 전수)를 분모로 돈다.
 */
const pageDocuments = (): Record<string, string> =>
  Object.fromEntries(LOCALES.map((locale) => [documentName(locale), documents()[documentName(locale)]!]));

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
  { file: TEMPLATE_FILE, why: '원페이지의 본문 틀 — 손으로 쓴다. 구조만 들고 산문은 0 이다(산문은 카탈로그가 든다)' },
  { file: CHROME_FILE, why: '크롬 한 벌 — 손으로 쓴다. 문서 둘이 같이 쓰는 head · GNB · 히어로 틀 · 푸터다' },
  {
    file: 'template-constitution.html',
    why: '둘째 문서의 본문 틀 — 손으로 쓴다. 헌법 관리와 관측 결과의 구조이고 산문은 0 이다',
  },
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
/**
 * 발행본에서 **사명이 설 수 있는 블록 셋** — 각자 사유가 다르다.
 *
 * ⚠️ 하나였던 것이 셋이 됐다. 넓힌 것이 아니라 **블록이 셋으로 나뉘었다**: 법정 게시와
 * 저작권이 한 `<div>` 안에 같이 있던 것이 풀렸고, 회사를 가리키는 컬럼이 새로 섰다.
 * 셋 다 「자기 블록만큼만 넓다」를 그대로 진다 — 합친 수가 문서 전체의 수와 같아야 한다.
 */
const companyRegions: readonly { readonly region: RegExp; readonly why: string }[] = [
  {
    region: /<section class="publisher"[\s\S]*?<\/section>/g,
    why: '사업자 신원정보(법정 게시) — 상호는 게시 의무 항목이지 내부 자산이 아니다',
  },
  {
    region: /<p class="copyright">[\s\S]*?<\/p>/g,
    why: '저작권 표시 — 권리자 이름이 서는 자리다. 법정 게시와 다른 것이고(앞은 의무, 뒤는 관행) 블록도 다르다',
  },
  {
    region: /<nav class="foot-col foot-company"[\s\S]*?<\/nav>/g,
    why: '회사 컬럼 — 제품 표면에서 회사는 마크가 아니라 텍스트로 나타난다. 공개 회사 사이트를 가리키는 말은 내부 자산이 아니다',
  },
];

const exemptions: readonly Exemption[] = [
  {
    file: 'src/site.ts',
    region: /export const COMPANY_SITE = '[^']*';/g,
    patterns: ['company'],
    why: '회사 사이트의 주소가 사는 상수 하나 — 리다이렉트 선언의 **목적지**이고 발행본에는 박히지 않는다(화면은 상대 경로를 가리킨다). 나가는 자리를 한 줄로 모아야 그 목록이 곧 측정 지점이 된다',
  },
  {
    file: 'src/publisher.ts',
    region: /export const PUBLISHER = \{[\s\S]*?\n\} as const;/g,
    patterns: ['company'],
    why: '법정 게시 항목의 값이 사는 상수 하나 — 상호는 게시 의무 항목이지 내부 자산이 아니다. 로케일 불변이라 카탈로그가 아니라 여기 산다',
  },
  // ⭐ 발행본에도 같은 블록들이 선다 — ⛔ 손으로 적지 않고 **문서 × 로케일**에서 유도한다:
  //   크롬이 한 벌이라 푸터의 그 블록 셋이 **모든 문서에** 서고, 문서가 늘면 면제가 따라 는다.
  ...DOCUMENTS.flatMap((doc) =>
    LOCALES.flatMap((locale) =>
      companyRegions.map(
        ({ region, why }): Exemption => ({
          file: publishedPath(locale, doc),
          region,
          patterns: ['company'],
          why,
        }),
      ),
    ),
  ),
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

/** 분모에 든 파일의 이름→본문 — 소스와 발행본이 **같은 금칙 손**을 쓰게 하는 꼴이다. */
const scopedTexts = (root: string): Record<string, string> =>
  Object.fromEntries(scopedFiles(root).map((file) => [file, readFileSync(join(root, file), 'utf8')]));

/**
 * 분모를 돌며 금칙 위반을 센다 — 면제된 자리에서는 **면제된 금칙만** 비켜 간다.
 *
 * ⭐ 받는 것이 경로가 아니라 **이름→본문**이다: 그래서 손으로 쓴 소스와 생성기가 낸 발행본이
 * 같은 금칙·같은 면제 목록 아래 선다(두 손으로 재면 그 둘이 갈라진다).
 */
function internalAssetLeaks(subjects: Record<string, string>): string[] {
  const leaks: string[] = [];
  for (const [file, text] of Object.entries(subjects)) {
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

/**
 * ⭐⭐ **빌드 타임에만 도는 손글씨 — 브라우저로 가지 않는다.** 선언이고, 각 항에 사유가 붙는다.
 *
 * ⚠️ **좁히는 선언이라 근거가 기계에 있다** — `tsconfig.build.json` 이 내는 것은
 * `src/main.ts` 의 그래프뿐이고, 그 그래프가 여기 든 파일에 닿지 않는다는 것을 아래
 * 가드가 **import 로** 센다(선언만 두면 다음 사람이 여기 한 줄을 더해 페이지 코드를
 * 금칙 밖으로 빼낼 수 있다).
 *
 * ⛔ 빠지는 것은 **배선·경계 금칙**뿐이다 — 내부 자산 · 밖으로 나가는 주소 · 네트워크 원시 ·
 * 하드코딩 한글은 이 둘도 그대로 받는다.
 */
const buildTimeSrc: readonly { readonly file: string; readonly why: string }[] = [
  {
    file: 'src/generate.ts',
    why: '발행 생성기 — 브라우저가 아니라 빌드가 돌린다. node: 표준 모듈을 쥐므로 페이지 코드의 import 경계 밖이다',
  },
  {
    file: 'src/publisher.ts',
    why: '법정 게시 값 — 생성기만 읽는다. 발행본에는 바이트로 박히고 페이지 코드는 쥐지 않는다',
  },
  {
    file: 'src/locale-names.ts',
    why: '로케일의 자기 이름 — 고르개가 발행 시점에 박히므로 생성기만 읽는다',
  },
];

/** 브라우저가 받는 화면 코드 — 발행되는 손글씨에서 빌드 타임만 도는 것을 뺀 것. */
const browserSrcOf = (root: string): string[] =>
  shippedSrcOf(root).filter((path) => !buildTimeSrc.some((entry) => entry.file === path));

const browserSrc = browserSrcOf(ROOT);

/**
 * 문구 카탈로그 — ⛔ 로케일 **수**를 적지 않는다(이름을 `LOCALES` 에서 유도한다).
 *
 * ⭐⭐ **왜 따로 부르는가.** 아래 배선 금칙은 `checkout` 을 **자구로** 문다. 산문이 카탈로그로
 * 내려온 뒤 그 단어가 **영문 산문에** 선다 — 그리고 그 단어는 두 가지를 말한다: 스캐폴드 절의
 * 그것은 **git 작업 사본**이고(working copy), 가격 절의 그것은 **결제 화면**이다. 단어의 존재가
 * 배선을 뜻하지 않는다. ⇒ 고치는 것은 **잘못 선언한 분모**이지 산문이 아니다 — 카탈로그에는
 * 자구 대신 **배선 자체**(선택자·핸들러)를 0 으로 문다. 금칙은 하나도 걷지 않았다.
 */
const catalogSrc: readonly string[] = LOCALES.map((locale) => `src/strings-${locale}.ts`);

/**
 * ⭐⭐ **절대 주소가 설 수 있는 단 한 자리 — 자기 출처다.**
 *
 * ⚠️ **금칙을 걷은 것이 아니라 자리를 하나로 모은 것이다.** 이 금칙이 잡으려던 것은 주석
 * 축자대로 「**이동**을 지시하는 한 줄이 방문자를 밖으로 보내는 것」이고, 특히 **벤더 주소가
 * 발행본에 박히는 것**이다(벤더가 주소를 바꾼 날 그 화면이 거짓말을 한다). ⭕ 자기 출처는
 * 그 둘이 아니다 — **그 문서가 이미 있는 자리**이고, 색인 선언(canonical · hreflang ·
 * sitemap · OG)은 규격이 절대 주소를 요구해 **상대 경로로는 적을 수 없다.**
 *
 * ⇒ 면제는 **상수 선언 한 줄만큼** 넓다. 그 한 줄 밖에서는 금칙이 그대로 돌고, 발행본에
 * 선 절대 주소가 **전부 그 출처로 시작하는지**는 아래가 따로 센다 — 좁은 면제 + 넓은 단정이
 * 라서, 벤더 주소가 들어올 길이 남지 않는다.
 */
const originExemptions: readonly { readonly file: string; readonly region: RegExp; readonly why: string }[] = [
  {
    file: 'src/site.ts',
    region: /export const SITE_ORIGIN = '[^']*';/g,
    why: '자기 출처 — 밖으로 나가는 주소가 아니라 이 문서가 있는 자리다. 색인 선언이 절대 주소를 요구하고, 자리를 하나로 모아야 벤더 주소가 들어올 길이 없다',
  },
  {
    file: 'src/site.ts',
    region: /export const COMPANY_SITE = '[^']*';/g,
    why: '밖으로 나가는 주소가 맞다 — ⭐ 그래서 **선언 안에** 있다. 화면이 아니라 리다이렉트 규칙이 그것을 쓰고, 발행본의 `href` 는 상대 경로로 남는다(「밖으로 나가는 모든 것이 한 문을 지난다」가 그 뜻이다)',
  },
  {
    file: 'src/site.ts',
    region: /export const CHECKOUT_SITE = '[^']*';/g,
    why: '밖으로 나가는 주소가 맞다 — ⭐ `COMPANY_SITE` 와 **같은 꼴**이고 사유가 한 겹 더 세다: 벤더는 링크를 다시 낸다. 리다이렉트 규칙만 이 값을 쓰고 발행본의 `href` 는 상대 경로로 남는다 — 벤더가 움직여도 발행본은 한 바이트도 움직이지 않는다',
  },
  {
    file: 'src/render.ts',
    region: /const SVG_NS = '[^']*';/g,
    why: 'SVG 의 **이름공간 식별자**다 — 주소의 꼴을 하고 있을 뿐 가져오지도 가지도 않는다(DOM 규격이 이 문자열을 축자로 요구한다: createElementNS 가 이 값이 아니면 도형을 만들지 않는다)',
  },
  {
    file: 'src/site.ts',
    region: /xmlns(?::[a-z]+)?="[^"]*"/g,
    why: 'XML 이름공간의 **식별자**다 — 주소의 꼴을 하고 있을 뿐 가져오지도 가지도 않는다(규격이 이 문자열을 축자로 요구한다). sitemap 이 그 규격이고, 바꾸면 파일이 그 규격이 아니게 된다',
  },
];

/** 화면 코드를 돌며 밖으로 나가는 주소를 센다 — 속성이 아니라 **문자열**을 본다. */
function outboundAddressLeaks(root: string): string[] {
  const leaks: string[] = [];
  for (const file of shippedSrcOf(root)) {
    let text = readFileSync(join(root, file), 'utf8');
    for (const exemption of originExemptions.filter((entry) => entry.file === file)) {
      const regions = [...text.matchAll(exemption.region)].map((match) => match[0]);
      assert.ok(regions.length > 0, `${file}: 면제가 가리키는 자리가 없다 — 낡은 면제 선언이다 (${exemption.why})`);
      for (const region of regions) text = text.replace(region, '');
    }
    for (const pattern of outboundPatterns) {
      if (new RegExp(pattern.source, 'i').test(text)) leaks.push(`${file}: ${pattern.id}`);
    }
  }
  return leaks;
}

/**
 * 문서의 `href`·`src` 에 걸린 기존 금칙 — **자구 그대로**, 분모만 발행본으로 옮겼다.
 *
 * ⚠️ 틀도 함께 받는다 — 손이 닿는 자리에서 막는 것과 방문자가 받는 바이트에서 막는 것은
 * 다른 단정이고, 둘 다 서야 한다(틀에 선 주소는 발행본 **둘**에 간다).
 */
function htmlOutboundLeaks(subjects: Record<string, string>): string[] {
  return Object.entries(subjects).flatMap(([name, html]) => {
    // ⭕ 자기 출처의 주소는 **밖이 아니다** — 벗기고 나서 센다. 벗긴 자리가 거짓이 아님은
    //    아래 「절대 주소 전수가 자기 출처다」가 따로 문다(좁은 면제 + 넓은 단정).
    const outward = html.replaceAll(SITE_ORIGIN, '');
    return htmlOutboundBans.filter((ban) => ban.test(outward)).map((ban) => `${name}: ${ban.source}`);
  });
}

/**
 * 「아직 서지 않았다」를 코드가 쪽지로 말하는 자리 — ⭐ **번역도 분모다**: 산문이 카탈로그로
 * 내려온 뒤 이 쪽지가 설 수 있는 자리가 한국어 하나에서 둘이 됐다. 한쪽만 막으면 금칙이
 * 반만 집행된다.
 */
const pendingNotes: readonly { readonly phrase: string; readonly why: string }[] = [
  { phrase: ['준비', ' 중'].join(''), why: '걷어낸 배선이 쪽지로 돌아오는 자리 — 상태를 말하는 척하며 결과를 숨긴다' },
  { phrase: ['coming', ' soon'].join(''), why: '같은 쪽지의 번역 — 산문이 카탈로그로 내려온 뒤 이 자리도 분모가 됐다' },
];

/**
 * 문구 카탈로그가 **배선을 쥐는** 자리 — 카탈로그가 드는 것은 자구뿐이다.
 *
 * ⭐ `checkout` 자구 대신 이것을 무는 이유가 위 `catalogSrc` 주석에 있다: 영문 산문의 그
 * 단어는 **두 가지**를 말하고, 단어의 존재가 배선을 뜻하지 않는다. 배선은 **선택자와
 * 핸들러**이고 카탈로그에 그것이 0 이면 「배선이 없으니 끊길 것도 없다」가 그대로 선다.
 */
/**
 * ⭐⭐ **자구가 아니라 배선으로 무는 자리들** — 금칙을 걷는 것이 아니라 **분모를 고친다.**
 *
 * ⑴ 문구 카탈로그 — 사유는 위 `catalogSrc` 가 든다(영문 산문의 `checkout` 은 **작업 사본**과
 *    **결제 화면** 둘을 말한다).
 * ⑵ 발행 자리 선언(`src/site.ts`) — ⭐⭐ **밖으로 나가는 문의 정본**이라 경로와 벤더 주소를
 *    이름으로 들 수밖에 없다(`CHECKOUT_PATH` · `CHECKOUT_SITE`). ⛔ 자구로 물면 「선언이
 *    절대 주소를 쥔다」와 「화면 코드에 그 단어가 0」이 **서로를 배제한다** — 둘 다 참이어야
 *    하는 규율이라, 그 모순은 금칙이 아니라 분모의 잘못이다. ⭕ 단어의 존재가 배선을 뜻하지
 *    않는다: 이 파일에 선택자도 핸들러도 0 이고 입구는 여전히 **정적 `<a>`** 다.
 */
const wiringOnlySrc: readonly string[] = [...catalogSrc, 'src/site.ts'];

const wiringTokens: readonly { readonly source: string; readonly why: string }[] = [
  { source: 'addEventListener', why: '핸들러 — 문구 카탈로그가 쥘 것이 아니다' },
  { source: 'querySelector', why: '선택자 — 같은 자리' },
  { source: ['checkout', '-(button|stub|link)'].join(''), why: '체크아웃 입구의 id·클래스 — 카탈로그가 입구를 쥐는 꼴' },
];

/**
 * 화면 코드가 체크아웃을 쥐고 있는가 — 해당 id 나 쪽지 하나도 안 된다.
 * 배선이 없으면 끊길 것도 없다 — 그것이 자바스크립트 없이 눌리는 조건이다.
 *
 * ⚠️ 분모가 **브라우저 코드**다(빌드 타임만 도는 둘은 선언과 함께 밖이다), 그리고 카탈로그는
 * 자구가 아니라 **배선**으로 문다 — 그 둘의 사유는 `buildTimeSrc` · `catalogSrc` 가 든다.
 */
function checkoutWiringLeaks(root: string): string[] {
  const leaks: string[] = [];
  for (const file of browserSrcOf(root)) {
    const text = readFileSync(join(root, file), 'utf8');
    const lowered = text.toLowerCase();
    if (wiringOnlySrc.includes(file)) {
      for (const { source } of wiringTokens) {
        if (new RegExp(source, 'i').test(text)) leaks.push(`${file}: ${source}`);
      }
    } else if (/checkout/i.test(text)) {
      leaks.push(`${file}: checkout-배선`);
    }
    for (const { phrase } of pendingNotes) {
      if (lowered.includes(phrase)) leaks.push(`${file}: ${phrase}`);
    }
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
 * ⭐⭐ **기대값이 리터럴이 아니다 — 그래서 이 가드가 낡음을 고정하지 않는다.** 전에는 이
 * 함수가 그해의 자구를 **리터럴로** 지어 돌려줬다. 가드가 리터럴을 기대값으로 들면 **발행본과 가드가
 * 같이 낡아서** 해가 바뀌어도 아무것도 빨개지지 않는다 — 가드가 낡음을 잡은 것이 아니라
 * **고정한다**(형제 저장소 실측에서 같은 병의 자리 여덟 중 **둘이 가드**였다).
 * ⇒ 기대값은 발행본과 **같은 한 손**(`publisher.ts` 의 `copyrightLine`)에서 나온다.
 *
 * ⚠️ **배포의 낡음은 여기서 볼 수 없다** — 정적 발행본의 끝 연도는 빌드 시점에 박히므로
 * 다음 해에 배포가 한 번도 없으면 발행 표면이 지난 연도를 싣는다. 그것은 **소스 가드로는
 * 원리상 볼 수 없고** 발행 표면을 밖에서 읽는 회사 워크플로가 문다. ⛔ 여기 사본을 만들지
 * 않는다 — 숨기지 않고 적는다: 「안 재다」가 아니라 「재고, 이 자리에서는 볼 수 없다」이다.
 */

test('AC7 — 내부 자산 0: 분모의 모든 파일에 내부 조직·저장소·결정 기록·사람이 없다', () => {
  assert.deepEqual(internalAssetLeaks(scopedTexts(ROOT)), []);
  // ⭐ 발행본도 같은 금칙 아래 선다 — 방문자가 받는 바이트가 분모 밖이면 가드가 반만 돈다.
  assert.deepEqual(internalAssetLeaks(documents()), []);
});

test('AC1 — 푸터에 상호가 선 발행본이 AC7 에 걸리지 않는다', () => {
  assert.match(canonDocument(), /주식회사 모아요/, '푸터에 상호가 없다');

  // ⭐ 면제가 **그 블록들만큼만** 넓다 — 사명이 블록 밖에 한 글자도 없다. ⚠️ 파일마다
  //   **합쳐서** 센다: 발행본은 블록이 셋(법정 게시 · 저작권 · 회사 컬럼)이라 하나만 보면
  //   나머지 둘의 사명이 「블록 밖」으로 잘못 세어진다.
  const company = new RegExp(['mo', 'ayo'].join(''), 'gi');
  const count = (text: string): number => (text.match(company) ?? []).length;
  const files = [...new Set(exemptions.map((exemption) => exemption.file))];
  for (const file of files) {
    const subject = file.startsWith('src/') ? read(file) : documents()[file]!;
    let inside = '';
    for (const exemption of exemptions.filter((entry) => entry.file === file)) {
      const found = [...subject.matchAll(exemption.region)].map((m) => m[0]);
      assert.ok(found.length > 0, `${file}: 면제가 가리키는 자리가 없다 — 낡은 선언이다 (${exemption.why})`);
      inside += found.join('');
    }
    assert.ok(count(inside) > 0, `${file}: 면제 블록에 상호가 없다`);
    assert.equal(count(subject), count(inside), `${file}: 사명이 면제 블록 밖에 있다`);
  }

  // ⭐ 저작권 자구는 **발행본 전수**에 선다 — 로케일 불변이라 번역을 타지 않는다.
  for (const [name, html] of Object.entries(documents())) {
    assert.ok(html.includes(copyrightLine()), `${name}: 저작권 자구가 없다`);
    assert.deepEqual(
      internalAssetLeaks({ [name]: html }),
      [],
      `${name}: 발행본이 내부 자산 금칙에 걸린다`,
    );
  }
});

test('AC2 (negative) — 금칙은 살아 있다: 내부 자산을 심으면 AC7 이 빨갛다', () => {
  // 음성 대조군 — 깨끗한 사본이 초록이어야 「심으니 빨갛다」가 금칙의 증거가 된다.
  assert.deepEqual(internalAssetLeaks(scopedTexts(scopeFixture())), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

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
    assert.notDeepEqual(
      internalAssetLeaks(scopedTexts(root)),
      [],
      `${sample} 을 심었는데 AC7 이 초록이다 — 금칙이 죽었다`,
    );
  }

  // ⭐⭐ 사명은 **면제 블록 밖에서는** 그대로 금칙이다 — 면제가 파일 전체로 번지지 않았다.
  //    자리가 둘이라 둘 다 심는다: 값이 사는 소스와, 그 값이 박히는 발행본.
  const bare = `${['Mo', 'ayo'].join('')} Inc.`;

  const root = scopeFixture();
  const source = readFileSync(join(root, 'src', 'publisher.ts'), 'utf8');
  writeFileSync(join(root, 'src', 'publisher.ts'), `${source}\nexport const note = '${bare}';\n`);
  assert.notDeepEqual(
    internalAssetLeaks(scopedTexts(root)),
    [],
    '면제 블록 밖의 사명이 초록이다 — 면제가 너무 넓다',
  );

  const plantedDocuments = documentsFrom(read(TEMPLATE_FILE).replace('</main>', `  <p>${bare}</p>\n</main>`));
  assert.notDeepEqual(
    internalAssetLeaks(plantedDocuments),
    [],
    '발행본의 면제 블록 밖 사명이 초록이다 — 면제가 너무 넓다',
  );
});

test('AC3 — AC7 의 분모·제외·면제·금칙이 전부 열거돼 있고 각 항에 사유가 붙어 있다', () => {
  assert.ok(judgedScope.length > 0, '분모가 비었다');
  const self = read('src/boundary.test.ts');
  for (const entry of judgedScope) {
    const key = 'file' in entry ? entry.file : entry.dir;
    // ⭐ 자구로 적혀 있거나, **그 이름의 정본 상수**로 불려 있어야 한다 — 틀의 이름은
    //   생성기가 갖는다(`TEMPLATE_FILE`). 분모를 손으로 적는다는 뜻은 지키면서 사본은
    //   만들지 않는 쪽이다(파일 이름이 움직이면 생성기와 이 분모가 **함께** 움직인다).
    // ⭐ 틀 이름의 정본은 생성기다(`TEMPLATE_FILE`·`CHROME_FILE`·`TEMPLATES`) — 자구로 적혀
    //   있거나 그 상수로 불려 있으면 된다. 파일 이름이 움직이면 생성기와 이 분모가 **함께**
    //   움직이는 쪽이고, 사본을 만들지 않는 쪽이다.
    const byConstant =
      (key === TEMPLATE_FILE && self.includes('TEMPLATE_FILE')) ||
      (key === CHROME_FILE && self.includes('CHROME_FILE')) ||
      Object.values(TEMPLATES).includes(key);
    const named = self.includes(`'${key}'`) || byConstant;
    assert.ok(named, `분모 항 ${key} 이 소스에 열거돼 있지 않다`);
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

  // ⭐ **좁히는 선언 둘이 새로 섰다** — 사유가 붙고, 가리키는 자리가 실재해야 한다.
  //   ⛔ 낡은 선언은 미판정이 아니라 **판정 실패**다: 가리키는 파일이 사라지면 그 선언이
  //   다음 사람에게 「여기는 금칙 밖」이라고 거짓말한다.
  assert.ok(buildTimeSrc.length > 0, '빌드 타임 선언이 비었다');
  for (const entry of buildTimeSrc) {
    assert.ok(shippedSrc.includes(entry.file), `빌드 타임 선언이 가리키는 ${entry.file} 이 없다 — 낡은 선언이다`);
    assert.ok(entry.why.length >= 8, `빌드 타임 선언 ${entry.file} 에 사유가 없다`);
  }
  for (const file of catalogSrc) {
    assert.ok(shippedSrc.includes(file), `카탈로그 선언이 가리키는 ${file} 이 없다 — 낡은 선언이다`);
  }
  for (const token of [...wiringTokens, ...pendingNotes]) {
    const why = token.why;
    assert.ok(why.length >= 8, `배선 금칙에 사유가 없다: ${JSON.stringify(token)}`);
  }
});

/**
 * ⭐⭐ **좁힌 선언의 근거를 기계가 든다.** `buildTimeSrc` 가 참인 이유는 ⑴ 브라우저 산출이
 * `src/main.ts` 의 그래프뿐이고 ⑵ 그 그래프가 그 파일들에 **닿지 않는다**는 둘이다. 선언만
 * 두면 다음 사람이 여기 한 줄을 더해 **페이지 코드를 금칙 밖으로 빼낼 수 있다** — 그 길을
 * 닫는 것이 아래다.
 */
test('AC3 — 빌드 타임 선언이 참이다: 브라우저 산출이 그 파일들에 닿지 않는다', () => {
  const build = JSON.parse(read('tsconfig.build.json')) as { include: string[] };
  // ⭐ 진입점은 **문서마다 하나**다 — 분모가 `DOCUMENTS` 이고, 손으로 적은 열거는 문서가
  //   늘는 날 거짓이 된다. ⚠️ 빠진 진입점은 **산출되지 않는 스크립트**이고, 그 발행본은
  //   404 를 참조한 채 조용히 아무것도 하지 않는다.
  assert.deepEqual(
    [...build.include].sort(),
    DOCUMENTS.map((doc) => `src/${PAGE_SCRIPTS[doc]}.ts`).sort(),
    '브라우저 산출의 진입점이 문서 전수와 다르다 — 이 선언의 전제가 깨졌다',
  );

  const declared = buildTimeSrc.map(({ file }) => file.replace(/^src\//, './'));
  for (const file of browserSrc) {
    for (const match of read(file).matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(
        !declared.includes(match[1]!),
        `${file} 이 빌드 타임 코드를 가져온다: ${match[1]} — 그러면 그것은 브라우저 코드다`,
      );
    }
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
  for (const file of browserSrc) {
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

  // ⭐ 빌드 타임 코드는 `node:` 표준 모듈을 **더** 받는다 — 그리고 그것뿐이다: 외부 의존 0 이
  //   이 저장소의 생성기 규율이고(래스터라이저·배달 스크립트와 같다), 그 사실을 여기서 문다.
  for (const { file } of buildTimeSrc) {
    const text = read(file);
    for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
      const spec = match[1]!;
      assert.ok(
        spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../../verifier/src/'),
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

/**
 * 입력 칸의 **선언** — 문서마다 자기 칸을 적고 **각자 사유를 든다.**
 *
 * ⭐ 전에는 「입력 칸이 **하나**」였다. 문서가 둘이 되면서 그 수가 둘째 문서에서 거짓이
 * 되는데, ⛔ 그때 수를 늘리면 선언이 아니라 **관찰의 기록**이 된다. ⇒ 칸마다 **왜 그 칸이
 * 있는가**를 적고, 선언에 없는 칸이 서면 판정 실패로 둔다 — 조용히 늘어나는 자리를 두지 않는다.
 *
 * ⛔ 그리고 금칙은 그대로다: 어느 문서에도 **비밀번호 칸 0 · 토큰 칸 0** 이다(PAT 을 받는
 * 제품이 되지 않는 그 선이고, 비공개 저장소의 길은 고객 기계에서 도는 명령 하나다).
 */
const declaredFields: Readonly<
  Record<DocumentId, readonly { readonly id: string; readonly why: string }[]>
> = {
  page: [{ id: 'repo-input', why: '저장소 주소 하나 — 공개 저장소의 무료 진단 입구다' }],
  constitution: [
    { id: 'hold-kind', why: '갈래 고르개 — 입력의 모양은 하나이고, 가르는 것은 「읽은 저장소가 누구의 것인가」다' },
    { id: 'hold-axis', why: '헌법의 이름(공유값 축) — 한 저장소가 헌법 여럿에 답하므로 「어느 헌법인가」를 묻지 않으면 우리가 이름을 고르게 된다' },
    { id: 'hold-repo', why: '읽을 저장소의 주소 하나 — 갈래가 그 저장소의 의미를 정한다(내 것 ↔ 정본)' },
    { id: 'hold-file', why: '그 저장소가 든 후보 파일 — 어댑터가 읽는 꼴만 선다(화면이 꼴을 알지 못한다)' },
    { id: 'hold-scope', why: '그 파일에서 어댑터가 **실제로 본** 스코프 — 자구를 추측하지 않는 자리다' },
  ],
};

test('입구 — 입력 칸이 선언된 그것뿐이다: PAT·비밀번호 입력 칸이 없다', () => {
  for (const [name, html] of Object.entries(documents())) {
    // ⭐ **선언이 분모다** — 칸마다 사유가 붙고, 선언에 없는 칸이 서면 판정 실패다. 「수가
    //   하나」로 두면 문서가 둘이 되는 날 그 단정이 거짓이 되고, 고치는 손이 금칙을 걷는다.
    const doc = DOCUMENTS.find((entry) => publishedPath(LOCALES[0], entry) === name || publishedPath(LOCALES[1]!, entry) === name)!;
    const found = [...html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(
      [...found].sort(),
      declaredFields[doc].map((field) => field.id).sort(),
      `${name}: 입력 칸이 선언과 다르다`,
    );
    // ⛔ 금칙은 하나도 걷지 않았다 — 어느 문서에도 비밀번호 칸·토큰 칸이 0 이다.
    assert.doesNotMatch(html, /type="password"/i, name);
    assert.doesNotMatch(html, /name="(token|pat|secret|key)"/i, name);
  }
  for (const [doc, fields] of Object.entries(declaredFields)) {
    for (const field of fields) {
      assert.ok(field.why.length >= 8, `${doc}: 입력 칸 ${field.id} 에 사유가 없다`);
    }
  }
  assert.deepEqual(advertisedCommands(), ['npx graduand --open', 'npx graduand init']);
});

/**
 * 페이지가 **광고하는** 명령 전부. 입구의 둘째 칸이 파는 것이 이 한 줄이라, 이 목록은
 * 산문이 아니라 아래 테스트의 입력이다.
 */
function advertisedCommands(): string[] {
  // ⭐ **둘째 문서는 명령을 광고하지 않는다** — 그 문서가 내는 것은 붙여 넣을 **선언**이고,
  //   쓰는 명령의 한 줄은 고객의 값(플래그)을 품어야 해서 이 가드가 **돌려 볼 수 없다**.
  //   돌려 볼 수 없는 것을 광고하지 않는 것이 「광고와 실물의 일치」를 지키는 쪽이다.
  //   ⚠️ 그래서 0 임을 **단정으로** 적는다: 누가 한 줄을 넣으면 여기서 빨갛고, 그때 함께
  //   움직이는 것은 이 추출기(돌려 보는 손)다.
  for (const doc of DOCUMENTS) {
    if (doc === 'page') continue;
    for (const locale of LOCALES) {
      const html: string = documents()[publishedPath(locale, doc)]!;
      assert.equal(
        [...html.matchAll(/<pre[^>]*>\s*<code/g)].length,
        0,
        `${publishedPath(locale, doc)}: 돌려 보지 않는 명령을 광고한다`,
      );
    }
  }
  const perDocument = Object.entries(pageDocuments()).map(([name, html]) => {
    const found = [...html.matchAll(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>/g)].map((m) =>
      m[1]!.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim(),
    );
    assert.ok(
      found.length > 0,
      `${name} 이 광고하는 명령을 하나도 찾지 못했다 — 표기가 바뀌었다면 이 추출기가 함께 움직인다`,
    );
    return { name, found };
  });

  // ⭐ **명령은 번역되지 않는다** — 로케일마다 다른 명령을 광고하면 한쪽 독자가 받는 한 줄이
  //   실물과 어긋날 수 있고, 그 어긋남이 이 제품이 재는 결함이다.
  const canon = perDocument[0]!;
  for (const other of perDocument.slice(1)) {
    assert.deepEqual(other.found, canon.found, `${other.name}: 광고하는 명령이 정본과 다르다`);
  }
  return canon.found;
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

test('한 문 AC2 (negative) — 문서의 href·src 금칙이 그대로 초록이다: 심으면 빨갛다', () => {
  // 기존 단정 둘 — 자구 그대로. 분모만 **틀 + 발행본**으로 넓어졌다.
  const template = read(TEMPLATE_FILE);
  for (const ban of htmlOutboundBans) assert.doesNotMatch(template, ban);
  assert.deepEqual(htmlOutboundLeaks({ [TEMPLATE_FILE]: template }), []);
  assert.deepEqual(htmlOutboundLeaks(documents()), []);

  const planted = [
    `<a href="${['ht', 'tps://', 'pay.example/checkout'].join('')}">x</a>`,
    `<img src="${['//', 'cdn.example/x.png'].join('')}" alt="">`,
  ];
  for (const sample of planted) {
    // ⭐ 심는 자리는 **틀**이다 — 틀에 선 주소는 발행본 **둘**에 간다. 그래서 같은 유도로
    //   난 발행본에서 빨강을 확인하는 것이 「심으니 빨갛다」의 올바른 모양이다.
    const leaky = template.replace('</main>', `  ${sample}\n</main>`);
    assert.notDeepEqual(
      htmlOutboundLeaks(documentsFrom(leaky)),
      [],
      `${sample} 을 심었는데 초록이다 — 금칙이 죽었다`,
    );
  }
});

/**
 * ⭐⭐ **주소가 상대에서 루트 절대로 옮겼다 — 그리고 그것이 「한 문」을 깨지 않는다.**
 * 문서가 `/<로케일>/` 로 내려가면 `./checkout/` 은 **로케일 하위**를 가리켜 어긋난다. 그런데
 * `checkout/` 은 로케일 불변이라 로케일마다 복제하면 **사본**이고, 사본은 갈라진다.
 * ⇒ 루트 하나에 두고 `/checkout/` 으로 부른다. ⭕ 루트 절대 경로는 **밖으로 나가는 주소가
 * 아니다** — 금칙 둘(절대 주소 · 프로토콜 상대 주소)은 하나도 걷지 않았고, 나가는 문은
 * 여전히 **지정된 리다이렉트 하나**다.
 */
test('한 문 AC3 — 체크아웃은 <a> 이고 href 가 루트 절대 경로다', () => {
  // ⭐ 가격 블록은 **원페이지의 것**이다 — 둘째 문서에는 그 입구가 없고, 없는 블록을 무는
  //   단정은 참이 아니다(그 문서의 블록은 자기 선언이 진다).
  for (const [name, html] of Object.entries(pageDocuments())) {
    const cta = /<section id="cta"[\s\S]*?<\/section>/.exec(html)?.[0];
    assert.ok(cta, `${name} 에 구독 절이 없다`);

    // 푸터의 `policy-link` AC 와 같은 꼴 — 클래스를 센다.
    assert.equal((cta.match(/checkout-link/g) ?? []).length, 1, `${name}: 구독 절의 체크아웃 입구가 하나가 아니다`);
    const href = /href="([^"]*)"/.exec(checkoutAnchor(cta))?.[1];
    assert.equal(href, '/checkout/', `${name}: 체크아웃 href 가 지정된 리다이렉트 자리가 아니다`);

    // 버튼은 자리를 비웠다 — 같은 입구가 둘이면 어느 것이 문인지 모른다.
    assert.doesNotMatch(html, /id="checkout-button"/, name);
    assert.doesNotMatch(html, /id="checkout-stub"/, name);
  }
});

test('한 문 AC4 — 자바스크립트를 끈 브라우저에서도 체크아웃 링크가 눌린다', () => {
  // Given 자바스크립트를 끈 브라우저 ⇒ 방문자가 받는 것은 **발행된 바이트** 하나다.
  for (const [name, html] of Object.entries(pageDocuments())) {
    const anchor = checkoutAnchor(html);

    assert.doesNotMatch(anchor, /\bhidden\b/, `${name}: 링크가 hidden 이다 — 스크립트가 없으면 보이지 않는다`);
    assert.doesNotMatch(anchor, /\son[a-z]+=/i, `${name}: 링크가 인라인 핸들러에 매달려 있다`);

    const href = /href="([^"]*)"/.exec(anchor)?.[1] ?? '';
    // ⭐ 루트 절대 경로다 — ⛔ 프로토콜 상대(`//`)는 스킴만 생략된 **밖**이라 같은 꼴로
    //   보여도 다른 것이다. 그 둘을 함께 문다.
    assert.ok(href.startsWith('/') && !href.startsWith('//'), `${name}: href 가 루트 절대 경로가 아니다: ${href}`);
    assert.doesNotMatch(href, new RegExp(['jav', 'ascript:'].join(''), 'i'), `${name}: href 가 스크립트 실행이다`);

    // ⭐ 발행본에 산문이 **바이트로** 있다 — 스크립트를 끈 방문자가 받는 것이 이것이다.
    assert.doesNotMatch(html, /\{\{/, `${name}: 채워지지 않은 자리가 남았다`);
  }

  // Then 화면 코드는 이 링크를 쥐지 않는다 — 배선이 없으니 끊어질 것도 없다.
  assert.deepEqual(checkoutWiringLeaks(ROOT), []);
});

test('한 문 AC5 (negative) — 화면 코드에 체크아웃 핸들러·「준비 중」이 0: 되살리면 빨갛다', () => {
  assert.deepEqual(checkoutWiringLeaks(ROOT), []);
  assert.deepEqual(checkoutWiringLeaks(scopeFixture()), [], '깨끗한 사본이 빨갛다 — 하네스가 고장났다');

  const planted = [
    // 걷어낸 배선 그대로 — 클릭을 기다리는 문과 「준비 중」 쪽지.
    { file: 'main.ts', code: `must<HTMLButtonElement>('#checkout-button').addEventListener('click', () => {});` },
    { file: 'main.ts', code: `stub.textContent = '결제 창구는 ${['준비', ' 중'].join('')}이다';` },
    // ⭐ 산문이 카탈로그로 내려온 뒤 **새로 열린 자리 둘** — 카탈로그가 입구를 쥐는 꼴과,
    //   같은 쪽지의 번역. 분모를 넓히지 않았으면 이 둘이 조용히 통과한다.
    { file: 'strings-en.ts', code: `export const wire = '#${['checkout', '-button'].join('')}';` },
    { file: 'strings-en.ts', code: `export const note = '${['coming', ' soon'].join('')}';` },
  ];
  for (const { file, code } of planted) {
    const root = scopeFixture();
    const before = readFileSync(join(root, 'src', file), 'utf8');
    writeFileSync(join(root, 'src', file), `${before}\n${code}\n`);
    assert.notDeepEqual(checkoutWiringLeaks(root), [], `${code} 을 되살렸는데 초록이다 — 가드가 죽었다`);
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
  const subjects = {
    ...Object.fromEntries(
      [...shippedSrc, TEMPLATE_FILE, CHROME_FILE, ...Object.values(TEMPLATES), 'styles.css'].map(
        (file) => [file, read(file)],
      ),
    ),
    ...documents(),
  };
  for (const [name, text] of Object.entries(subjects)) {
    const lowered = text.toLowerCase();
    for (const word of foldingWords) {
      assert.ok(!lowered.includes(word), `${name} 에 지표 어휘가 있다: ${word}`);
    }
  }
});

/**
 * ⚠️ **자구를 무는 단정은 정본(ko)의 발행본을 본다.** 번역 벌의 자구를 여기 적으면 사본이
 * 로케일마다 하나씩 늘고, 그 사본들이 갈라지는 것이 이 제품이 재는 결함이다 — 번역 벌이
 * **비어 있지 않고 옮겨졌는지**는 두 벌 전수로 `i18n.test.ts` 가 문다.
 */
test('CTA — 경계 문장 · 가격(총액) · 세금 한 줄', () => {
  const html = canonDocument();
  // ⚠️ 자구가 **2인칭**으로 옮겨졌다 — 이 줄은 광고 화면이라 읽는 사람이 고객이고, 그를
  //    삼인칭(「고객 쪽」)으로 부르던 꼴이 뒤집힌 판이다. 무는 사실은 그대로다:
  //    **판정이 어느 쪽에서 도는가**.
  assert.match(html, /판정은 여러분 쪽에서 돌고/);
  assert.match(html, /월 \$15/);
  assert.match(html, /연 \$150/);
  assert.match(html, /총액/);
  // ⚠️ **이 줄이 무는 것은 「포함되거나 더해진다」다** — 가격이 `tax_behavior: location` 이라
  //    처리가 구매자의 지역을 따른다(실측: 한국 체크아웃에서 `Taxes (included) $1.36`, 총액
  //    $15 그대로). ⛔ 「더해진다」로 단정하지 않는다 — 그 단정은 한 번 세웠다가 되돌렸다.
  //    ⛔ 설정이 `exclusive` 로 바뀌어도 이 단정은 **여전히 초록**이다: 가드는 발행본만 보고
  //    결제 벤더를 보지 못한다. ⚠️ 그 반쪽짜리 성질은 **실제로 터진 적이 있다** — 선언이
  //    「세금 포함」을 적고 가드가 그 자구를 물며 초록인 채, 벤더 쪽만 가산으로 갈라져 있었다.
  //    ⇒ 설정을 바꾸는 날 이 줄을 **사람이** 함께 본다.
  assert.match(html, /세금[^<]*포함되거나 더해지며[^<]*체크아웃에서 확정/);
});

const footerOf = (html: string): string => {
  const found = /<footer>([\s\S]*)<\/footer>/.exec(html)?.[1];
  assert.ok(found, '발행본에 푸터가 없다');
  return found;
};

/** 법정 게시 블록 하나 — 행은 라벨 + 값 한 쌍이고, 순서까지 정본이 든다. */
const publisherBlockOf = (html: string): string => {
  const found = /<section class="publisher"[\s\S]*?<\/section>/.exec(html)?.[0];
  assert.ok(found, '발행본에 사업자 신원정보 블록이 없다');
  return found;
};

test('AC4 — 푸터: 정책 문서 3종(privacy 가 보이는 링크) · 고객 포털 해지 · 갱신 조건 · 저작권 표시를 함께 담는다', () => {
  const footer = footerOf(canonDocument());
  assert.ok((footer.match(/policy-link/g) ?? []).length >= 3);

  // ⭐ **보이는 링크**여야 한다 — 텍스트로만 있으면 가리키는 자리가 아니다.
  // ⚠️⚠️ **자구는 로케일을 따른다.** 전에는 영문 한 단어(`privacy`)로 양쪽을 물었고, 그래서
  //    한국어 라벨이 「Privacy — 개인정보 처리방침」으로 **번역을 덧댄 꼴**에 고정돼 있었다:
  //    가드가 한국어 화면에 영문 단어 하나를 강제하고 있었던 것이다. ⇒ 분모를 로케일로
  //    가르고 말은 `policyTopics` 의 그 항에서 **읽는다**(사본을 만들지 않는다).
  const privacyTopic = policyTopics.find(({ terms }) => terms.en === 'privacy');
  assert.ok(privacyTopic, '정책 선언에 개인정보 항이 없다 — 이 단정의 분모가 사라졌다');
  for (const locale of LOCALES) {
    const term = privacyTopic!.terms[locale];
    assert.match(
      footerOf(documents()[documentName(locale)]!),
      new RegExp(`<a[^>]*>[^<]*${term}[^<]*</a>`, 'i'),
      `${locale}: 개인정보 처리방침이 **보이는 링크**로 서지 않았다`,
    );
  }
  assert.match(footer, /고객 포털/);
  assert.match(footer, /해지/);
  assert.match(footer, /자동 갱신/);

  // ⭐ 저작권 줄은 법정 게시와 **다른 것**이다 — 관행이고, 자구가 확정돼 있다.
  assert.ok(footer.includes(copyrightLine()), '저작권 자구와 문자가 다르다');

  // ⚠️ `includes` 는 **접두사만** 본다 — 「더 붙은」 판이 그대로 통과한다.
  // 걷은 것은 **없다는 것을 따로** 단정한다. ⚠️ 연도는 걷은 것이 아니다 —
  // 형식 요건의 한 칸이라 **있어야** 하고, 그것은 `copyrightLine()` 이 문단단정으로 물고 있다.
  assert.doesNotMatch(footer, /All rights reserved/i, '「All rights reserved」가 남았다');

});

/**
 * ⭐⭐ **AC1 — 법정 여섯 행이 양쪽 로케일에 선다.** 전에는 가드가 **앞 넷만** 물어서
 * 빠진 둘(문의 · 통신판매업 신고번호)을 발각하지 못했다 — 결정이 아니라 **누락**이었고,
 * 「선언하지 않은 것은 미판정」이 아니라 가드의 분모가 좁았던 것이다.
 *
 * ⭐ **값은 로케일 불변이고 라벨만 번역된다** — 루트가 `/en/` 이라 한국 이용자의 초기화면이
 * 영문이 되므로, 게시가 **그 화면에도** 있어야 한다(🇰🇷 전자상거래법 시행령 §31② 지속 게재).
 * ⚠️ 형제 둘은 ko 에만 싣는다 — 그들의 루트가 `/en/` 이 아니라서다. 사유가 있는 갈라짐이다.
 * ⚠️ 법적 단정은 하지 않는다 — **법무 확인 몫**이다.
 *
 * ⛔ 값도 순서도 여기 적지 않는다 — `PUBLISHER_ROWS` 가 정본이고 그것에서 유도한다.
 */
test('AC1 — 법정 여섯 행이 양쪽 로케일에 서고, 순서가 정본 그대로다', () => {
  for (const [name, html] of Object.entries(documents())) {
    const block = publisherBlockOf(html);
    const rows = block.split('<span class="publisher-row">').slice(1);
    assert.equal(rows.length, PUBLISHER_ROWS.length, `${name}: 행 수가 정본과 다르다`);

    const locale = name.split('/')[0]!;
    const labels = CATALOG[locale as keyof typeof CATALOG].page.footer.publisher;
    PUBLISHER_ROWS.forEach((row, at) => {
      const shown = rows[at]!;
      // 순서까지 정본이 든다 — 라벨이 그 로케일의 것이고 값이 로케일 불변이다.
      assert.ok(shown.includes(labels[row.labelKey]), `${name}: ${at}번째 행의 라벨이 정본과 다르다`);
      assert.ok(shown.includes(row.value), `${name}: ${at}번째 행의 값이 빠졌다 — ${row.value}`);
      if (row.kind === 'email') {
        assert.ok(shown.includes(`mailto:${row.value}`), `${name}: 문의가 눌리는 링크가 아니다`);
      }
    });
  }

  // ⭐ 빠졌던 둘이 **실제로** 있다 — 분모가 넷이던 때 이 둘이 조용히 빠져 있었다.
  const late = PUBLISHER_ROWS.filter((row) => row.labelKey === 'contact' || row.labelKey === 'mailOrderReport');
  assert.equal(late.length, 2, '늦게 선 두 행이 정본에 없다');
});

/**
 * ⚠️ **AC3 — 늘리지 않은 것 둘.** 표시사항 **목록 밖**인 법인등록번호는 싣지 않고,
 * 제품 표면에서 회사는 **마크가 아니라 텍스트로만** 나타난다(한 표면에 회사 워드마크와
 * 제품 워드마크를 함께 두지 않는다).
 */
test('AC3 (negative) — 법인등록번호와 회사 마크가 발행본에 0 건이다', () => {
  for (const [name, html] of Object.entries(documents())) {
    assert.doesNotMatch(html, /법인등록번호/, `${name}: 표시사항 목록 밖의 항목이 실렸다`);
    assert.doesNotMatch(html, /Corporate registration/i, name);

    // 인라인 마크는 **제품 락업 둘**(GNB · 푸터)뿐이다 — 회사 마크가 끼면 수가 는다.
    const marks = html.match(/<svg\b/g) ?? [];
    assert.equal(marks.length, 2, `${name}: 인라인 마크가 둘이 아니다 — ${marks.length}개`);
    assert.equal((html.match(/class="lockup"/g) ?? []).length, 2, `${name}: 그 둘이 제품 락업이 아니다`);

    // 회사는 **텍스트**다 — 사명이 이미지·배경으로 서는 자리가 없다.
    assert.doesNotMatch(html, new RegExp(`<img[^>]*${['mo', 'ayo'].join('')}`, 'i'), name);
  }
});

/**
 * ⭐⭐ **앵커가 설 수 있게 됐다 — 그리고 조건이 둘이다.**
 *
 * ⚠️ 전에 이 자리는 「앵커 0」이었다. 막던 것은 **앵커 자체가 아니라** 해시를 요약과 나눠
 * 쓰지 못한 것이었다 — `main.ts` 가 비어 있지 않은 해시 전부를 요약으로 읽어, 앵커를 누르면
 * 본문 위에 「조각을 읽을 수 없다」 판정 불가 화면이 떴다(실측). 그 규칙이 형식의 몫으로
 * 내려가면서(`looksLikeFragment`) 금칙의 **근거가 사라졌다.** ⇒ 금칙을 **조건 둘로 바꾼다**:
 *
 *   ⑴ **가리키는 블록이 실재한다** — 없는 `id` 를 가리키는 링크는 눌러도 아무 일이 없고,
 *      그것은 「선언하지 않은 것」이 아니라 **잘못 선언한 것**이라 판정 실패다.
 *   ⑵ **앵커가 요약을 자처하지 않는다** — 자처하면 그 링크는 보고서 화면을 연다. 가르는
 *      손은 형식 하나이므로, 여기서 **그 함수로** 묻는다(사본을 만들지 않는다).
 *
 * ⛔ 걷지 않은 것 — GNB 에는 여전히 내비가 0 이다. 그 사유는 앵커가 아니라 **중복**이다
 * (진단 입구가 히어로 바로 아래라 첫 화면에 이미 있다).
 */
test('AC7 (negative) — 앵커는 실재하는 블록만 가리키고 요약을 자처하지 않는다', () => {
  for (const [name, html] of Object.entries(documents())) {
    const anchors = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]!);
    assert.ok(anchors.length > 0, `${name}: 앵커가 0 이다 — 제품 컬럼이 사라졌다면 이 단정이 함께 움직인다`);

    for (const anchor of anchors) {
      assert.ok(
        html.includes(`id="${anchor}"`),
        `${name}: 앵커가 없는 블록을 가리킨다 — #${anchor}. 잘못 선언한 것은 판정 실패다`,
      );
      assert.ok(!looksLikeFragment(anchor), `${name}: 앵커가 요약을 자처한다 — #${anchor} 는 보고서를 연다`);
    }

    const footer = footerOf(html);
    // 컬럼은 **셋**이다(회사 · 제품 · 법률). ⛔ 넷째가 서면 수가 는다.
    assert.equal((footer.match(/class="foot-col[ "]/g) ?? []).length, 3, `${name}: 푸터 컬럼이 셋이 아니다`);
  }
});

/**
 * ⭐⭐ **화면 코드가 그 둘을 한 손으로 가른다.** 가드가 발행본만 보면 「앵커가 눌렸을 때
 * 무엇이 뜨는가」는 **미판정**으로 남는다 — 실제로 그 자리에서 샜다(앵커가 판정 불가 화면을
 * 띄우는데 모든 가드가 초록이었다).
 */
test('AC7 — 해시를 가르는 손이 하나다: 페이지가 자기 판단으로 가르지 않는다', () => {
  const main = read('src/main.ts');
  assert.match(main, /looksLikeFragment/, '페이지가 형식의 판정을 쓰지 않는다');
  assert.match(
    main,
    /if \(!looksLikeFragment\(fragment\)\) return;/,
    '요약이 아닌 해시를 브라우저의 몫으로 두지 않는다',
  );
  // ⛔ 「비어 있지 않으면 요약」으로 되돌리면 빨갛다 — 그것이 앵커를 깨뜨리던 그 한 줄이다.
  assert.doesNotMatch(main, /fragment === ''/, '옛 판정이 되살아났다 — 앵커가 다시 판정 화면을 띄운다');

  // 그리고 그 판정이 **실제로** 앵커와 요약을 가른다 — 발행본의 앵커 전수로 확인한다.
  for (const [name, html] of Object.entries(documents())) {
    for (const anchor of [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]!)) {
      assert.equal(looksLikeFragment(anchor), false, `${name}: #${anchor}`);
    }
  }
});

/**
 * ⭐⭐ **AC6 — 고르개가 협상이 아니다.** 사람이 눌러 주소가 바뀌는 것은 협상이 아니다 —
 * 협상은 **주소가 가리키는 문서와 다른 언어가 그려지는 것**이고, 그러면 그 주소를 공유한
 * 사람과 공유받은 사람이 다른 화면을 받는다. ⇒ 기전은 `<details>` + **평앵커**이고
 * 자바스크립트가 0 이라, 스크립트를 끈 방문자도 그대로 누른다.
 */
test('AC6 (negative) — 로케일 고르개가 평앵커이고 자바스크립트를 쥐지 않는다', () => {
  for (const doc of DOCUMENTS) {
    for (const locale of LOCALES) {
      const name = publishedPath(locale, doc);
      const html: string = documents()[name]!;
      assert.match(html, /<details class="locale-pick">/, `${name}: 고르개가 <details> 가 아니다`);
      // ⭐ **이동하는 고르개는 `<select>` 가 아니다** — 그 꼴은 이동에 스크립트가 들기
      //   때문이다. ⛔ 금칙을 걷지 않고 **자리를 선언한다**: 문서가 쥘 수 있는 `<select>` 는
      //   입력 선언에 이름이 적힌 그것뿐이고(값을 고를 뿐 이동하지 않는다), 그 밖의
      //   `<select>` 는 0 이다.
      const selects = [...html.matchAll(/<select\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]!);
      assert.deepEqual(
        selects.filter((id) => !declaredFields[doc].some((field) => field.id === id)),
        [],
        `${name}: 선언되지 않은 <select> 가 있다 — 이동에 스크립트가 드는 꼴이다`,
      );
      assert.equal(
        (html.match(/<select/gi) ?? []).length,
        selects.length,
        `${name}: 이름 없는 <select> 가 있다 — 선언으로 셀 수 없는 자리다`,
      );

      // ⭐ 기대값을 **주소를 내는 그 손**에서 받는다 — 문서 깊이가 틀리면 집합에 없다.
      const expected = LOCALES.map((other) => siblingLocalePath(other, doc));
      const pattern = new RegExp(`<a href="(${expected.map((href) => href.replace(/[.]/g, '\\.')).join('|')})"[^>]*>`, 'g');
      const links = [...html.matchAll(pattern)].map((m) => m[1]!);
      // 고르개는 **둘**(GNB · 푸터)이고 각자 로케일 전수를 든다 — ⛔ 로케일 수를 적지 않는다.
      assert.equal(links.length, LOCALES.length * 2, `${name}: 고르개의 링크 수가 분모와 다르다`);
      assert.deepEqual([...new Set(links)].sort(), [...expected].sort(), `${name}: 고르개가 가리키는 로케일이 분모와 다르다`);

      for (const link of [...html.matchAll(pattern)].map((m) => m[0])) {
        assert.doesNotMatch(link, /\son[a-z]+=/i, `${name}: 고르개의 링크가 인라인 핸들러에 매달려 있다`);
        assert.match(link, /hreflang="/, `${name}: 고르개의 링크가 가는 언어를 선언하지 않았다`);
      }
      // ⭐ 지금 보고 있는 언어가 표시된다 — 고르개 **둘**에 하나씩. 그리고 브랜드 링크는
      //   **원페이지에서만** 자기를 가리킨다: 둘째 문서에서 그 링크는 원페이지로 가므로
      //   `aria-current` 가 거짓이 된다(그 자리를 문서가 고른다).
      const brand = doc === 'page' ? 1 : 0;
      assert.equal(
        (html.match(/aria-current="page"/g) ?? []).length,
        brand + 2, // 고르개 둘(GNB · 푸터)
        `${name}: 현재 위치 표시가 고르개 둘 + 브랜드(원페이지만)와 다르다`,
      );
    }
  }
});

/**
 * ⭐ **AC4 — 저작권 기대값이 리터럴이 아니다.** 시계를 움직이면 기대값이 **함께** 움직이고,
 * 발행본이 지난해 값을 들고 있으면 빨갛다. 그래서 이 가드는 낡음을 **고정하지 않는다.**
 */
test('AC4 (negative) — 저작권 줄이 시계에서 나온다: 리터럴이면 빨갛다', () => {
  const canon = canonDocument();
  assert.ok(canon.includes(copyrightLine()), '발행본의 저작권 줄이 같은 손에서 나오지 않았다');

  // 시계를 옮기면 자구가 **움직인다** — 움직이지 않으면 어딘가에 리터럴이 박힌 것이다.
  const later = copyrightLine(new Date('2031-06-01T00:00:00Z'));
  assert.notEqual(later, copyrightLine(new Date('2026-06-01T00:00:00Z')), '시계를 옮겼는데 자구가 그대로다');
  assert.ok(!canon.includes(later), '발행본이 미래의 연도를 들고 있다 — 하네스가 고장났다');

  // ⭐ 기록이 생기면 **범위**가 열린다(구분자는 en dash) — 그 전까지는 한 해만 적는다.
  assert.match(copyrightLine(new Date('2031-06-01T00:00:00Z'), 2026), /2026–2031/, '범위가 열리지 않는다');
  assert.doesNotMatch(copyrightLine(new Date('2026-06-01T00:00:00Z'), 2026), /–/, '같은 해인데 범위로 적혔다');

  // ⛔ 소스에 기대값이 박혀 있지 않다 — 박히면 발행본과 가드가 같이 낡는다.
  // ⚠️ 금칙을 조각으로 조립한다 — 자구를 그대로 적으면 **이 단정이 자기 자신에 걸린다**
  //    (이 파일의 다른 금칙들이 같은 자리에 같은 이유로 조각을 쓴다).
  const literal = new RegExp(['©', ' 20\\d\\d'].join(''));
  for (const file of ['src/boundary.test.ts', 'src/publisher.ts', TEMPLATE_FILE]) {
    assert.doesNotMatch(read(file), literal, `${file} 이 저작권 자구를 리터럴로 들고 있다`);
  }
});

/* ════════════════ 원페이지의 블록과 표기 체계 ════════════════ */

/**
 * ⭐⭐ **블록과 조건부 둘 — 순서까지 선언이다.** ⛔ 수를 산문에 적지 않는다: 아래 열거가
 * 곧 그 수이고, 손으로 센 수는 블록이 늘거나 줄면 조용히 낡는다.
 *
 * 자리의 사유가 셋이다. ⑴ **진단 입구가 히어로 바로 아래**인 것은 그것이 무료·즉시이고
 * 오늘 서는 **유일한 칼**이기 때문이다. ⑵ **스캐폴드가 결과 바로 아래**인 것은 미판정을
 * 본 사람의 다음 걸음이 그것뿐이고, 그 블록은 오늘 **전부** 서기 때문이다(스텁이 0 이다).
 * ⑶ **활성화 안내가 가격 뒤**인 것은 그것이 **두 겹으로** 안 섰기 때문이다 — 아무도 할 수
 * 없는 일을 입구 **앞**에 세우지 않는다.
 *
 * ⚠️ 이 목록은 **수를 적은 것이 아니라 순서를 적은 것**이다 — 블록이 늘거나 줄면 빨갛고,
 * 그때 움직이는 것은 이 선언이다(조용히 재배치되지 않는 것이 요점이다).
 */
const blockOrder: readonly { readonly name: string; readonly why: string }[] = [
  { name: 'gnb', why: '양 끝의 하나 — 브랜드 락업(홈)과 로케일 고르개뿐이다' },
  { name: 'masthead', why: '히어로 — 한 문장이 재는 축을 말하고 정본의 소재를 고객 저장소로 둔다' },
  { name: 'entry', why: '진단 입구 — 무료·즉시이고 오늘 서는 유일한 칼이라 히어로 바로 아래다' },
  { name: 'result', why: '결과 — 조건부 블록이고 자리를 지킨다' },
  { name: 'scaffold', why: '선언 스캐폴드 — 미판정을 본 사람의 다음 한 걸음이라 결과 바로 아래다' },
  {
    name: 'features',
    why: '기능 — 「무엇을 받나」가 「얼마인가」 바로 위에 선다. 앞의 셋은 한 번 돌려 본 사람의 길이라 그 사이를 가르지 않는다',
  },
  { name: 'cta', why: '가격 — 스텁 고지가 입구 바로 위에 한 단으로 선다' },
  { name: 'activation', why: '활성화 안내 — 두 겹으로 안 서 있어서 가격 뒤다' },
  { name: 'faq', why: 'FAQ — 안 선 것을 묻는 사람에게 답하는 자리이고, 가격 뒤 · Footer 앞이다' },
  { name: 'footer', why: '양 끝의 나머지 하나' },
];

/**
 * 발행본의 블록을 **문서 순서대로** 거둔다 — 이름은 `id` 가 있으면 그것, 없으면 첫 클래스다.
 * ⚠️ `<footer>` 앞까지만 훑는다: 법정 게시가 그 안에 `<section>` 으로 서 있어서, 끝까지
 * 훑으면 푸터의 **속**이 블록 목록에 섞인다.
 */
function blocksOf(html: string): string[] {
  const at = html.indexOf('<footer');
  assert.ok(at > 0, '발행본에 footer 가 없다');
  const named = [...html.slice(0, at).matchAll(/<(?:header|section)\b([^>]*)>/g)].map((match) => {
    const attrs = match[1]!;
    return /id="([^"]+)"/.exec(attrs)?.[1] ?? /class="([^" ]+)/.exec(attrs)?.[1] ?? '';
  });
  return [...named, 'footer'];
}

/**
 * ⭐⭐ **둘째 문서의 블록 — 둘이고 순서까지 선언이다.**
 *
 * 자리의 사유 하나: **쥐는 것이 먼저다.** 관측은 선언이 있어야 수를 내고(선언이 정본을
 * 가리키지 않으면 교차 축은 미판정이다), 그 선언을 세우는 자리가 위의 블록이다 — 반대로
 * 두면 처음 온 고객이 「미판정」만 보고 다음 걸음을 못 찾는다.
 *
 * ⚠️ 조건부 자리 둘(`hold-result` · `observation`)이 **블록 안에** 있어 이 열거에 든다 —
 * 블록을 세는 손이 중첩을 보지 않는 손이기 때문이고(`blocksOf`), 그 자리가 어디에 서는지가
 * 곧 「결과가 어느 블록의 것인가」다. ⛔ 숨기지 않고 적는다.
 */
const constitutionBlockOrder: readonly { readonly name: string; readonly why: string }[] = [
  { name: 'gnb', why: '양 끝의 하나 — 크롬이 한 벌이라 원페이지와 같은 것이 선다' },
  { name: 'masthead', why: '히어로 — 이 문서가 무엇을 하는 자리인지 한 문장으로 말한다' },
  { name: 'hold', why: '헌법 관리 — 이 문서가 지는 일 하나다(판정은 루트의 진단이 보여준다)' },
  { name: 'hold-result', why: '조립 결과 — 조건부이고, 고르는 자리 바로 아래에서 자리를 지킨다' },
  { name: 'footer', why: '양 끝의 나머지 하나' },
];

const blockOrders: Readonly<
  Record<DocumentId, readonly { readonly name: string; readonly why: string }[]>
> = { page: blockOrder, constitution: constitutionBlockOrder };

test('AC1 — 문서마다 블록과 양 끝이 선언한 순서 그대로 선다', () => {
  // ⭐ 분모가 **문서 × 로케일**이다 — 문서가 늘면 자기 선언을 가져야 하고(`Record` 가
  //   집행한다), 블록이 늘거나 줄거나 자리를 바꾸면 그 선언이 움직인다.
  for (const doc of DOCUMENTS) {
    for (const locale of LOCALES) {
      const name = publishedPath(locale, doc);
      assert.deepEqual(
        blocksOf(documents()[name]!),
        blockOrders[doc].map((entry) => entry.name),
        `${name}: 블록의 순서나 수가 선언과 다르다`,
      );
    }
  }
  for (const [doc, order] of Object.entries(blockOrders)) {
    assert.ok(order.length > 0, `${doc}: 블록 선언이 비었다`);
    for (const { name, why } of order) {
      assert.ok(why.length >= 8, `${doc}/${name} 에 사유가 없다`);
    }
  }
});

/**
 * ⭐⭐ **히어로가 출하된 판정기 전수를 덮는다 — 분모는 등록부다.**
 *
 * ⚠️ 이것이 실측에서 나온 가드다: `VERIFIER_IDS` 는 넷인데 히어로는 **둘만** 적고 있었고,
 * 빠진 둘이 **팔레트 축**이었다 — 무게 중심을 빼고 광고하고 있었다. 가드가 없으면 판정기가
 * 하나 늘어도 히어로는 조용히 그대로다.
 *
 * ⭐ 축과 판정기가 **1:1 이 아니다** — 공유값은 축이 갈려 이름이 둘이다(`shared-values` ·
 * `shared-values-cross`). 그래서 선언이 드는 것은 「축 하나 → 판정기 몇」이고, 합집합이
 * 등록부와 **정확히 같아야** 한다.
 *
 * ⚠️ 자구는 **축의 이름뿐**이다 — 문장 전체를 여기 적으면 산문의 사본이 하나 늘고, 번역이
 * 문장을 다듬는 날 사유 없이 빨개진다. 축의 이름이 사라지는 것은 다듬기가 아니라 **히어로가
 * 그 축을 말하지 않게 된 것**이고, 그것이 이 가드가 잡는 실패다.
 */
const heroAxes: readonly {
  readonly ids: readonly string[];
  readonly names: Readonly<Record<Locale, string>>;
  readonly why: string;
}[] = [
  {
    ids: ['shared-values', 'shared-values-cross'],
    names: { ko: '공유값', en: 'shared-value' },
    why: '축이 갈려 판정기가 둘이다 — 디자인 토큰이 v1 의 무게 중심이고, 빠져 있던 둘이 이것이다',
  },
  {
    ids: ['refs'],
    names: { ko: '참조', en: 'reference' },
    why: '문서의 참조 — 선언 0 으로도 수가 나오는 유일한 축이다',
  },
  {
    ids: ['ui-paths'],
    names: { ko: 'UI 경로', en: 'UI path' },
    why: '선언된 UI 경로 — 선언이 분모인 축이다',
  },
];

/** 히어로 블록 — 한 문장이 사는 자리다. */
function masthead(html: string): string {
  const found = /<section class="masthead">([\s\S]*?)<\/section>/.exec(html);
  assert.ok(found !== null, '발행본에 히어로 블록이 없다');
  return found[1]!;
}

test('AC2 — 히어로가 출하된 판정기 전수의 축을 말한다', () => {
  assert.deepEqual(
    heroAxes.flatMap((axis) => axis.ids).sort(),
    [...VERIFIER_IDS].sort(),
    '축 선언이 등록부와 다르다 — 판정기가 늘었거나 선언이 낡았다',
  );

  for (const locale of LOCALES) {
    const hero = masthead(documents()[documentName(locale)]!).toLowerCase();
    for (const axis of heroAxes) {
      assert.ok(
        hero.includes(axis.names[locale].toLowerCase()),
        `${locale}: 히어로가 ${axis.ids.join(' · ')} 의 축을 말하지 않는다 (${axis.names[locale]})`,
      );
    }
  }
});

/**
 * ⛔ **발행본이 적지 않는 이름 셋** — 핸들 파일 · 핸들 키 · 환경변수다.
 *
 * ⚠️⚠️ **사유가 바뀌었고 분모는 그대로다.** 전에는 「아직 정해지지 않았다」였다(발행본에
 * 적으면 미확정을 확정처럼 말한다). 발행 조직 id 가 서고 측정 명령이 그 셋을 **고객 화면에
 * 적어 주면서** 그 사유는 참이 아니게 됐다 — 이름은 실물이 됐다. ⇒ 남은 사유는 **더 센**
 * 쪽이다: 발행본에 적으면 그것이 **사본**이고, 사본은 이름이 움직이는 날 명령과 갈라진다.
 * ⭐ 고객이 이름을 못 받는 것이 아니다 — 받는 자리가 **하나**일 뿐이다(측정 명령).
 *
 * ⭐ 분모를 **그 상수에서 받는다** — 이름을 여기 적으면 사본이 하나 늘고, 상류가 이름을
 * 정해 상수가 움직이는 날 가드만 옛 이름을 센다.
 */
const unsettledNames: readonly { readonly name: string; readonly why: string }[] = [
  { name: ENTITLEMENT.file, why: '핸들이 사는 파일 — 이름을 아는 자리는 상수 하나이고, 고객에게 말하는 자리는 측정 명령 하나다' },
  { name: ENTITLEMENT.handleKey, why: '핸들 파일의 키 — 벤더 필드 이름을 그대로 쓴다. 번역하면 사본이 하나 는다' },
  { name: ENTITLEMENT.keyEnv, why: '라이선스 키가 오는 환경변수 — 커밋되지 않는 쪽이라 더더욱 한 자리에서만 말한다' },
];

test('AC4 (negative) — 발행본이 적지 않는 이름 셋이 0 건이다', () => {
  for (const { name, why } of unsettledNames) {
    assert.ok(name.length > 0, `분모가 빈 이름이다 — 가드가 아무것도 세지 않는다 (${why})`);
  }
  for (const [document, html] of Object.entries(documents())) {
    for (const { name } of unsettledNames) {
      assert.ok(!html.includes(name), `${document}: 미확정 이름 ${name} 이 발행본에 적혀 있다`);
    }
  }
});

/**
 * ⭐⭐ **날짜를 암시하면서 날짜를 적지 않는 말 다섯** — 하나로 묶이는 성질이 그것이다.
 *
 * ⚠️ **위 `pendingNotes` 와 합치지 않는다.** 그쪽은 「걷어낸 배선이 쪽지로 돌아오는 자리」를
 * 보는 **코드**의 금칙이고 이쪽은 **방문자가 읽는 산문**의 금칙이다 — 사유가 다른 금칙을 한
 * 목록에 두면 걷을 때 함께 걷힌다.
 *
 * ⭐⭐ **분모가 발행본 + 카탈로그의 값이다 — 소스의 주석은 아니다.** 「곧」은 같은 글자가
 * 두 가지를 말한다: 「머지않아」(금칙)와 「A 가 **곧** B 다」(동일시)다. 뒤쪽은 이 저장소의
 * 주석이 실제로 쓰는 말이고, 주석은 **화면에 가지 않는다** — 이 패키지가 한글 가드에서
 * 「주석은 무죄다」로 이미 세운 선과 같은 선이다. ⇒ 방문자에게 닿는 산문의 길은 둘뿐이고
 * (발행본의 바이트 · 카탈로그를 거친 런타임 문구) 분모가 그 둘이다.
 *
 * ⬜ 카탈로그의 **함수 잎**(수·경로·날짜를 끼워 넣는 것들)은 여기 분모가 아니다 — 깨워야
 * 문자열이 되고 깨우는 손은 `i18n.test.ts` 가 든다. 안 재는 것이 아니라 **여기서 안 잰다**고
 * 적는다. ⛔ 그 수를 적지 않는다 — 손으로 센 수는 잎이 늘는 날 **조용히** 낡는다.
 */
const datelessPromises: readonly { readonly phrase: string; readonly why: string }[] = [
  { phrase: ['준비', ' 중'].join(''), why: '상태를 말하는 척하며 결과를 숨긴다 — 눌러 보고서야 안다' },
  { phrase: ['예', '정'].join(''), why: '날짜가 있다는 뜻인데 날짜가 없다' },
  { phrase: ['로드', '맵'].join(''), why: '순서를 약속한다 — 지킬 수 있는 조건이 아니다' },
  { phrase: ['곧'].join(''), why: '가장 짧은 날짜 암시다' },
  { phrase: ['베', '타'].join(''), why: '품질의 단계를 말하는 척하며 출하 상태를 흐린다' },
  { phrase: ['coming', ' soon'].join(''), why: '같은 쪽지의 번역' },
  { phrase: ['roa', 'dmap'].join(''), why: '같은 약속의 번역' },
  { phrase: ['be', 'ta'].join(''), why: '같은 흐림의 번역' },
  { phrase: ['so', 'on'].join(''), why: '「곧」의 번역 — 「coming soon」까지 함께 덮는다' },
  { phrase: ['plan', 'ned'].join(''), why: '「예정」의 번역' },
];

/** 카탈로그의 **문자열 잎 전수** — 런타임 문구가 사는 자리다. */
function catalogValues(value: unknown, path = ''): { readonly path: string; readonly value: string }[] {
  if (typeof value === 'string') return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((item, at) => catalogValues(item, `${path}[${at}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => catalogValues(inner, `${path}.${key}`));
  }
  return [];
}

/** 분모 — 발행본의 바이트와 카탈로그의 값. 틀을 **인자로** 받아 심은 사본에도 같은 유도가 돈다. */
function datelessLeaks(subjects: Record<string, string>): string[] {
  const leaks: string[] = [];
  for (const [name, text] of Object.entries(subjects)) {
    const lowered = text.toLowerCase();
    for (const { phrase } of datelessPromises) {
      if (lowered.includes(phrase)) leaks.push(`${name}: ${phrase}`);
    }
  }
  return leaks;
}

const catalogSubjects = (): Record<string, string> =>
  Object.fromEntries(
    LOCALES.flatMap((locale) =>
      catalogValues(CATALOG[locale]).map(({ path, value }) => [`${locale}${path}`, value]),
    ),
  );

test('AC5 (negative) — 날짜를 암시하는 말 다섯이 0: 하나를 심으면 빨갛다', () => {
  assert.deepEqual(datelessLeaks({ ...documents(), ...catalogSubjects() }), []);

  // ⭐ 심은 사본으로 **같은 유도**를 돌린다 — 하네스를 따로 짜면 그 둘이 갈라진다.
  const planted = documentsFrom(
    read(TEMPLATE_FILE).replace('</main>', `<p>${['베', '타'].join('')}</p>\n  </main>`),
  );
  assert.notDeepEqual(datelessLeaks(planted), [], '금칙 어휘를 심었는데 초록이다 — 가드가 죽었다');

  for (const { phrase, why } of datelessPromises) {
    assert.ok(phrase.length > 0 && why.length >= 4, `금칙 ${phrase} 에 사유가 없다`);
  }
});

/**
 * ⭐⭐ **안 선 자리가 하나로 줄었다 — 그 사실을 적는다.**
 *
 * ⚠️⚠️ 전에는 둘이었다(가격 · 활성화 안내). 가격 쪽의 조건은 **두 번 움직였다**: ⑴ 벤더의
 * 창구 심사 → ⑵ 이 주소를 창구로 보내는 연결. ⑵ 가 `site.ts` 의 리다이렉트 선언으로 서면서
 * 그 고지가 **가리킬 조건이 0** 이 됐고, 고지를 걷었다. ⛔ 조건 없는 「아직 서지 않았다」를
 * 두지 않는다 — 금칙 다섯(「준비 중」류)과 **같은 뿌리**다.
 *
 * ⭐ 남은 하나는 **발행 조직 id** 다 — 사도 자격을 묻지 못한다. ⛔ 날짜는 여전히 적지 않는다:
 * 조건은 참이고 날짜는 거짓이 될 수 있다.
 *
 * ⚠️ **훅이 하나여도 이 표는 남는다** — 둘째가 다시 서는 날 사유와 함께 돌아오는 자리이고,
 * 「문면이 겹치지 않는다」는 그때 다시 일한다. 표를 지우면 그 규율이 사라진다.
 */
const notStanding: readonly { readonly hook: string; readonly why: string }[] = [];

/**
 * 「안 섰다」가 설 수 있는 **클래스 전수** — ⭐⭐ 표가 비었다고 가드까지 비지 않게 하는 자리다.
 *
 * ⚠️ 위 표가 `[]` 가 되면 그것을 **도는** 단정은 0 바퀴를 돌고, 0 바퀴는 아무것도 재지
 * 않는다. ⇒ 분모를 뒤집는다: 꼴의 목록은 닫혀 있고, 화면에 선 훅과 **선언된 훅이 같은지**를
 * 묻는다. 선언 없이 고지가 돌아오면 빨갛고, 선언만 하고 고지가 없어도 빨갛다.
 */
const NOT_STANDING_HOOKS: readonly string[] = ['stub-notice', 'ink-notice'];

/** 「안 섰다」의 고지 문면 — 클래스로 거둔다(꼴이 아니라 **말**이 둘이라 훅도 둘이다). */
function notStandingNotices(html: string): Record<string, string> {
  return Object.fromEntries(
    notStanding.map(({ hook }) => {
      const found = new RegExp(`<p class="${hook}">([\\s\\S]*?)<\\/p>`).exec(html);
      assert.ok(found !== null, `고지 ${hook} 가 없다 — 안 선 것이 산문으로 숨었다`);
      return [hook, found[1]!];
    }),
  );
}

/** 날짜의 꼴 — ⛔ 어느 결에도 지킬 수 있는 날짜가 없다. 금칙이 이 파일 자신을 물지 않게 조립한다. */
const datePatterns: readonly RegExp[] = [
  new RegExp(['2', '0\\d\\d'].join('')),
  new RegExp(['\\d+\\s*', '[년월일]'].join('')),
  new RegExp(['Q', '[1-4]\\b'].join('')),
  new RegExp(['(jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)', '[a-z]*\\s+\\d'].join(''), 'i'),
];

test('AC6 (negative) — 선언한 고지만 서 있고, 선 고지에는 날짜가 없다', () => {
  const declared = new Set(notStanding.map(({ hook }) => hook));
  for (const [document, html] of Object.entries(pageDocuments())) {
    // ⭐⭐ **선언과 화면이 1:1 이다** — 선언 없이 고지가 돌아오면 빨갛고(조건 없는 「아직
    //    서지 않았다」는 금칙 다섯과 같은 뿌리다), 선언만 하고 고지가 없어도 빨갛다.
    for (const hook of NOT_STANDING_HOOKS) {
      assert.equal(
        new RegExp(`<p class="${hook}">`).test(html),
        declared.has(hook),
        `${document}: ${hook} 의 선언과 발행본이 어긋난다`,
      );
    }
  }
  // 선언된 것이 있으면 그 문면은 겹치지 않고 날짜를 들지 않는다 — 표가 비면 0 바퀴이고,
  // 그 0 은 위 1:1 이 이미 물었다.
  for (const [document, html] of Object.entries(pageDocuments())) {
    if (notStanding.length === 0) continue;
    const notices = notStandingNotices(html);
    const texts = Object.values(notices);
    assert.equal(new Set(texts).size, texts.length, `${document}: 두 고지의 문면이 같다 — 한 덩어리로 접혔다`);
    for (const [hook, text] of Object.entries(notices)) {
      for (const pattern of datePatterns) {
        assert.doesNotMatch(text, pattern, `${document}: ${hook} 고지에 날짜가 있다`);
      }
    }
  }
  for (const { hook, why } of notStanding) {
    assert.ok(why.length >= 8, `${hook} 에 사유가 없다`);
  }
});

/**
 * ⭐⭐ **정책은 FAQ 가 답하지 않고 가리킨다.** 정책 금칙 가드의 분모는 공개 배달 저장소의
 * `docs/policies/` 이고 발행본은 그 **밖**이다 — FAQ 가 환불을 답하면 금칙이 걸리지 않는
 * 자리에서 환불을 말하는 것이고, 선언 없는 파일은 조용히 **두 번째 정본**이 된다.
 *
 * ⇒ 「세 줄을 넘으면 정책 문서로」는 길이 규칙이 아니라 **소속 규칙**이었다. 길이는 그 뒤에
 * 남는 보조 기준이다.
 *
 * ⚠️ 자구가 로케일마다 다르므로 **선언이 로케일을 진다** — 히어로 축과 같은 꼴이다.
 */
const policyTopics: readonly {
  readonly terms: Readonly<Record<Locale, string>>;
  /** 발행본이 그것을 **가리키는 자리**를 갖고 있는가 — ⬜ 하나는 아직 없다. */
  readonly pointed: boolean;
  readonly why: string;
}[] = [
  {
    terms: { ko: '환불', en: 'refund' },
    pointed: true,
    why: '환불 정책이 정본이다 — 「권리를 뭉개는 단정」을 그쪽 가드가 막는다',
  },
  { terms: { ko: '약관', en: 'terms of' }, pointed: true, why: '이용약관이 정본이다' },
  { terms: { ko: '개인정보', en: 'privacy' }, pointed: true, why: '개인정보 처리방침이 정본이다' },
  {
    terms: { ko: '라이선스', en: 'licen' },
    pointed: false,
    why: 'BSL 증서가 정본이고 이 패키지에 사본이 없다. ⬜ 가리키는 자리도 아직 없다 — 그 증서는 다른 저장소에 있어 **절대 주소**를 요구하고, 발행본에 절대 주소를 박지 않는다(canonical·hreflang·sitemap 과 같은 한 식이라 그 선언이 서는 날 함께 선다). 그동안 막는 것은 「여기서 답하지 않는다」 하나다',
  },
];

/** FAQ 블록과 그 안의 문항들. */
function faqSection(html: string): string {
  const found = /<section id="faq"[\s\S]*?<\/section>/.exec(html);
  assert.ok(found !== null, '발행본에 FAQ 블록이 없다');
  return found[0];
}

test('AC7 — FAQ 는 정책을 가리키기만 하고, 답이 세 줄을 넘는 문항이 0 이다', () => {
  for (const locale of LOCALES) {
    const html = documents()[documentName(locale)]!;
    const faq = faqSection(html);

    // ⛔ 문항 **수**를 적지 않는다 — 중복 판정이 바뀌면 수가 움직인다. 무는 것은 「0 이 아니다」뿐이다.
    const items = [...faq.matchAll(/<div class="faq-item">([\s\S]*?)<\/div>/g)].map((match) => match[1]!);
    assert.ok(items.length > 0, `${locale}: FAQ 에 문항이 0 이다`);

    for (const [at, item] of items.entries()) {
      const lines = (item.match(/<p>/g) ?? []).length;
      assert.ok(lines > 0, `${locale}: 문항 ${at} 에 답이 없다`);
      assert.ok(lines <= 3, `${locale}: 문항 ${at} 의 답이 ${lines} 줄이다 — 세 줄을 넘으면 정책 문서로 간다`);
    }

    const footer = html.slice(html.indexOf('<footer'));
    for (const { terms, pointed } of policyTopics) {
      const term = terms[locale].toLowerCase();
      assert.ok(!faq.toLowerCase().includes(term), `${locale}: FAQ 가 정책을 답한다 — ${term}`);
      // ⚠️ 가리키는 자리가 **있다고 선언한 것만** 푸터에서 센다 — 없는 것을 세면 가드가
      //    참이 아닌 말을 하고, 안 적으면 ⬜ 가 숨는다. 선언이 그 둘을 가른다.
      assert.equal(
        footer.toLowerCase().includes(term),
        pointed,
        `${locale}: 정책 ${term} 의 선언과 발행본이 다르다 — 가리키는 자리가 생겼거나 사라졌다`,
      );
    }
  }
  for (const { why } of policyTopics) assert.ok(why.length >= 8, '정책 항에 사유가 없다');
});

/**
 * ⭐⭐ **고지는 런타임이 아니라 정적 산문으로 선다.** 문구를 런타임에 채우면 **스크립트를
 * 끈 방문자가 받는 바이트에 산문이 0** 이고, 그것은 구독 입구를 JS 없이 눌리게 둔 이유를
 * 정면으로 지운다.
 */
test('AC8 — 스크립트를 전부 걷어내도 활성화 안내의 산문이 그대로 보인다', () => {
  for (const [document, html] of Object.entries(pageDocuments())) {
    const scriptless = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
    assert.ok(!scriptless.includes('<script'), `${document}: 스크립트가 남았다 — 걷기가 고장났다`);

    // ⚠️ **주어가 옮겨왔다** — 전에는 「안 선 것의 고지」였고 그 고지가 걷히면서(조건이 0 이
    //    됐다) 이 단정의 주어가 사라졌다. 지키려던 성질은 그대로다: **산 사람이 할 일**이
    //    런타임의 것이면 스크립트를 끈 방문자는 그 절차를 받지 못한다.
    for (const { hook } of notStanding) {
      assert.match(scriptless, new RegExp(`<p class="${hook}">`), `${document}: ${hook} 고지가 런타임의 것이다`);
    }
    const activation = /<section class="activation"[\s\S]*?<\/section>/.exec(scriptless)?.[0];
    assert.ok(activation, `${document}: 스크립트를 걷으니 활성화 블록이 사라졌다`);
    assert.ok((activation!.match(/<p[ >]/g) ?? []).length >= 2, `${document}: 활성화 안내의 산문이 런타임의 것이다`);
  }
});
