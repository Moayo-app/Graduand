/**
 * ─── 발행 준비 AC — **선언이 실물과 1:1 인가** ───
 *
 * ⭐⭐ 왜 이 파일이 있는가. 선점 스텁에서 `main`·`exports`·`bin` 을 **일부러 비운** 이유가
 * 그것이다: **없는 진입점을 적으면** 설치한 사람이 받는 것은 「모듈이 없다」가 아니라
 * 「우리가 거짓을 선언했다」이고, 그것은 `--open` 결함과 **같은 종류**다 — 광고와
 * 실물이 어긋난 채 초록이다. 그래서 여기서 재는 것은 코드가 아니라 **매니페스트의 참**이다.
 *
 * ⭐ 재는 방식은 하나다 — **실제로 포장해서 푼다.** `npm pack` 이 `prepack` 을 돌려
 * 산출물을 만들고, 그 타르볼을 풀어 그 안에서 진입점을 찾고 그 파일을 **실행한다.**
 * ⛔ 소스 트리를 보고 「있을 것이다」로 단정하지 않는다: 발행되는 것은 소스 트리가 아니다.
 * ⛔ 네트워크를 타지 않는다 — `npm pack` 은 레지스트리를 부르지 않고, 설치도 하지 않는다.
 *
 * ⚠️ **AC5 는 여기 없다.** 「`private` 가 걷힌 PR 이 코드 이사·공개 전환 뒤임을 **본문이**
 * 밝힌다」는 그 PR 의 본문에 관한 단정이라 코드가 질 수 없다 — 여기서 지는 것은 그 짝이다:
 * `private` 가 **아직 서 있는가**, 그리고 걷는 조건이 **적혀 있는가**.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERIFIER } from './version.ts';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  bin?: Record<string, string>;
  exports?: unknown;
  files?: string[];
}
const manifest = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as Manifest;

/**
 * ⭐⭐ **다시 쓸 수 없는 버전 문자열들.** `0.0.1` 은 이름을 선점한 스텁이고
 * `0.0.0-stage` 는 npm 새 파이프라인이 남긴 스테이징 레코드다 — 레지스트리는 **발행이
 * 취소돼도** 그 문자열을 영구히 막는다. `0.0.0` 은 발행된 적이 없지만 이 저장소에서
 * 「아직 발행하지 않았다」의 표식이라 실모듈이 쓸 수 없다.
 *
 * ⭕ **`0.1.0` 이 그 목록에 들어왔다 — 스텁이 아니라 첫 실판이었다.** 2026-10-28 에 나갔고,
 * 그 순간부터 다시 쓸 수 없다. 앞의 셋과 성질이 다르다(저 셋은 쓰이지 못한 채 소진됐고 이것은
 * **쓰였다**) — 그래도 같은 목록에 사는 이유는 이 목록이 재는 것이 「왜 못 쓰는가」가 아니라
 * **「못 쓴다」** 하나이기 때문이다.
 *
 * ⛔ 이 목록은 **줄지 않는다** — 줄이는 변경은 「이미 나간 판을 덮어쓴다」는 뜻이다.
 */
const CONSUMED_VERSIONS: readonly string[] = ['0.0.0', '0.0.1', '0.0.0-stage', '0.1.0'];

/** 매니페스트가 **가리키는** 파일 전부 — `bin` 과 `exports`(조건부 포함)를 평평하게 센다. */
function declaredEntryPoints(from: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      // 조건부 exports 의 값 중 경로가 아닌 것(`null` 로 막은 자리)은 가리키는 것이 없다.
      if (node.startsWith('./')) out.push(node);
      return;
    }
    if (typeof node === 'object' && node !== null) for (const value of Object.values(node)) walk(value);
  };
  walk(from);
  return [...new Set(out)].sort();
}

/**
 * 선언된 진입점 → **타르볼 안의 경로.**
 *
 * ⚠️⚠️ **두 키의 규격이 다르다.** `exports` 의 값은 **지정자**라 규격이 `./` 를 요구하고,
 * `bin` 의 값은 **그냥 경로**라 npm 이 선두 `./` 를 떼어 버린다 — 발행 때 말없이 고치고
 * 「auto-corrected」 경고 한 줄만 남긴다. 실측: 커밋된 `./dist/cli.js` 가 레지스트리에서는
 * `dist/cli.js` 로 섰다. ⇒ 받는 손은 둘 다 받고, **어느 모양이어야 하는가는 키마다** 아래
 * AC 가 따로 묻는다. ⛔ 한 규칙으로 뭉치면 둘 중 하나가 반드시 거짓이 된다.
 */
const insidePackage = (entry: string): string => entry.replace(/^\.\//, '');

/** 디렉터리 아래 파일 전부 — 저장소 상대 경로, 정렬됨. */
function filesUnder(root: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...filesUnder(join(root, entry.name), `${prefix}${entry.name}/`));
    else out.push(`${prefix}${entry.name}`);
  }
  return out.sort();
}

/**
 * 한 번만 포장한다 — `npm pack` 이 `prepack`(= 빌드)을 돌리므로, 여기서 나온 타르볼이
 * **발행되는 그 바이트**다. 그 비용(tsc 한 번)을 테스트마다 치르지 않는다.
 */
let packedOnce: { dir: string; files: string[] } | null = null;
function packed(): { dir: string; files: string[] } {
  if (packedOnce !== null) return packedOnce;
  const out = mkdtempSync(join(tmpdir(), 'graduand-pack-'));
  const pack = spawnSync('npm', ['pack', '--pack-destination', out, '--loglevel', 'error'], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
  });
  assert.equal(pack.status, 0, `npm pack 이 실패했다: ${pack.stderr}`);
  const tgz = readdirSync(out).find((name) => name.endsWith('.tgz'));
  assert.ok(tgz, `타르볼이 없다: ${readdirSync(out).join(' ')}`);

  const extracted = join(out, 'extracted');
  mkdirSync(extracted);
  const untar = spawnSync('tar', ['-xzf', join(out, tgz), '-C', extracted], { encoding: 'utf8' });
  assert.equal(untar.status, 0, untar.stderr);
  // npm 타르볼의 모든 경로는 `package/` 아래 한 겹이다.
  const dir = join(extracted, 'package');
  packedOnce = { dir, files: filesUnder(dir) };
  return packedOnce;
}

/** 발행되는 모듈의 분모 — `src` 의 TS 에서 테스트를 뺀 것. 기대값을 여기서 **유도한다**. */
const shippedModules = filesUnder(join(PKG_ROOT, 'src')).filter(
  (path) => path.endsWith('.ts') && !path.endsWith('.test.ts'),
);

test('발행 AC1 — 타르볼에 담기는 것이 의도와 같고, 비공개 산출물이 0 이다', () => {
  // ⛔ 파일 수를 적지 않는다 — 산출은 모듈 하나당 `.js` 와 `.d.ts` 하나씩이다.
  assert.ok(shippedModules.length > 10, '분모가 비면 이 테스트는 아무것도 재지 않는다');
  const expected = [
    // ⭐ 증서가 **실린다** — BSL 축자가 「each original or modified copy」에 라이선스를
    // 걸라고 요구하고, 발행되는 타르볼이 그 copy 다. 표준 이름이라 npm 이 자동으로
    // 싣지만 `files` 에도 적혀 있다: 선언이 실물과 1:1 이라는 이 파일의 규율이,
    // 「도구 기본값이 그렇다」에 기대는 것을 허락하지 않는다.
    'LICENSE',
    'README.md',
    'package.json',
    ...shippedModules.flatMap((path) => [
      `dist/${path.replace(/\.ts$/, '.js')}`,
      `dist/${path.replace(/\.ts$/, '.d.ts')}`,
    ]),
  ].sort();

  assert.deepEqual(packed().files, expected);

  // ⛔ 그리고 **담기지 않는 것**을 따로 단정한다 — 위 목록이 넓어지는 날 조용히 새지 않게.
  for (const banned of [/\.test\./, /^tsconfig/, /^src\//, /package-lock/, /node_modules/, /^\./]) {
    assert.deepEqual(
      packed().files.filter((file) => banned.test(file)),
      [],
      `발행본에 담기지 않아야 하는 것이 담겼다: ${banned.source}`,
    );
  }
});

test('발행 AC2 (negative) — 버전이 소진된 문자열 중 어느 것도 아니다', () => {
  assert.ok(
    !CONSUMED_VERSIONS.includes(manifest.version),
    `${manifest.version} 은 다시 쓸 수 없다 — 소진된 문자열이다`,
  );
  // 읽을 수 있는 판이어야 한다 — 「올렸다」는 비교가 되는 문자열에만 뜻이 있다.
  assert.match(manifest.version, /^\d+\.\d+\.\d+(-[0-9a-z.]+)?$/);

  // ⭐ 봉투와 보고 머리에 실리는 그 문자열과 **같이 움직인다** — 둘이 갈라지면 고객이
  // 받은 보고가 어느 판에서 나왔는지 말할 수 없다.
  assert.equal(VERIFIER.version, manifest.version);
  assert.equal(VERIFIER.name, manifest.name);
  // 그리고 타르볼의 매니페스트도 같은 값이다(포장이 버전을 바꾸지 않는다).
  const inside = JSON.parse(readFileSync(join(packed().dir, 'package.json'), 'utf8')) as Manifest;
  assert.equal(inside.version, manifest.version);
});

test('발행 AC3 — package.json 이 가리키는 진입점 전부가 타르볼 안에 실재한다', () => {
  // 선점 스텁이 **비워 둔** 세 키가 이제 다 차 있다 — 비어 있던 것이 결격이 아니었고,
  // 채우는 것이 선언이 되는 순간부터 그 선언은 **참이어야** 한다.
  assert.ok(manifest.bin !== undefined && Object.keys(manifest.bin).length > 0, 'bin 이 비었다');
  assert.ok(manifest.exports !== undefined, 'exports 가 비었다');
  assert.ok(manifest.files !== undefined && manifest.files.length > 0, 'files 가 비었다');

  // ⛔ `bin` 은 **걷지 않는다** — 평평한 `이름 → 경로` 이고, 그 값은 `./` 로 시작하지 않는다.
  //    `declaredEntryPoints` 의 걸러내는 규칙(`./` 로 시작하는 문자열)에 넣으면 그 순간
  //    **분모에서 조용히 빠진다** — 가드가 재는 척하며 아무것도 재지 않는 자리가 된다.
  const fromBin = Object.values(manifest.bin);
  const fromExports = declaredEntryPoints(manifest.exports);
  assert.ok(fromBin.length > 0 && fromExports.length > 0, `${fromBin.length} · ${fromExports.length}`);

  // ⭐ 모양은 **키마다** 다르다(위 `insidePackage` 의 사유) — 그래서 따로 묻는다.
  for (const entry of fromExports)
    assert.ok(entry.startsWith('./'), `exports 의 값은 지정자다 — './' 로 시작해야 한다: ${entry}`);
  for (const entry of fromBin)
    assert.ok(!entry.startsWith('./'), `bin 의 값에 './' 가 붙었다 — npm 이 발행 때 떼어 간다: ${entry}`);

  for (const entry of [...fromBin, ...fromExports]) {
    const at = join(packed().dir, insidePackage(entry));
    assert.ok(existsSync(at) && statSync(at).isFile(), `선언된 진입점이 발행본에 없다: ${entry}`);
    assert.ok(statSync(at).size > 0, `선언된 진입점이 빈 파일이다: ${entry}`);
  }

  // ⭐⭐ **가드가 살아 있다** — 없는 자리를 적으면 빨갛다. 깨끗한 선언이 초록인 것이 대조군이다.
  for (const planted of ['./dist/nope.js', './dist/hosts/nope.js']) {
    const at = join(packed().dir, insidePackage(planted));
    assert.ok(!existsSync(at), `${planted} 가 실재한다 — 이 대조군이 고장났다`);
  }
});

test('발행 AC4 — bin 으로 설치되는 그 파일이 **실제로 돈다**: `--help` 가 exit 0', () => {
  const targets = Object.values(manifest.bin ?? {});
  assert.ok(targets.length > 0);
  for (const target of targets) {
    const at = join(packed().dir, insidePackage(target));
    // npm 이 만드는 shim 이 하는 일은 `node <이 파일>` 하나다 — 그 한 가지를 그대로 한다.
    const said = spawnSync(process.execPath, [at, '--help'], { encoding: 'utf8' });
    assert.equal(said.status, 0, `${target}: exit ${said.status}\n${said.stderr}`);
    assert.match(said.stdout, /^usage: graduand/m, said.stdout);
    // 물어서 받은 답은 오류가 아니다 — stderr 로 가면 파이프라인이 그것을 실패로 읽는다.
    assert.equal(said.stderr, '', said.stderr);
    // shim 없이 직접 실행되는 길도 남아 있다 — 산출에서 shebang 이 지워지지 않았다.
    assert.match(readFileSync(at, 'utf8'), /^#!/);

    // ⭐ **섞여도 이긴다** — 사용법을 묻는 사람은 플래그를 모르는 사람이라, 「올바르게
    // 물었을 때만 알려 준다」는 아무것도 알려 주지 않는다. 그 예외가 이 플래그 하나다.
    const mixed = spawnSync(process.execPath, [at, 'init', '--json', '--help'], { encoding: 'utf8' });
    assert.equal(mixed.status, 0, `섞인 사용법 요청이 ${mixed.status} 로 죽었다\n${mixed.stderr}`);
    assert.match(mixed.stdout, /^usage: graduand/m);
    // 그리고 **판정하지 않았다** — 사용법을 물었고 사용법만 받았다.
    assert.doesNotMatch(mixed.stdout, /verifier report/);
  }
});

test('발행 — `private` 가 걷혔고, 증서의 Change Date 가 **박혀 있다**', () => {
  // ⚠️⚠️ **이 단정이 뒤집혔다.** 전에는 「private 가 **아직** 서 있는가」를 물었고, 그 조건
  //    (코드 이사 · 공개 전환)이 둘 다 끝나면서 묻는 것이 바뀌었다. ⛔ 단정을 지운 것이
  //    아니라 **분모를 옮겼다**: 되살아나는 것도 사고이므로 여전히 센다.
  assert.equal(manifest.private, undefined, 'private 가 되살아났다 — 되돌렸다면 그 사유가 본문에 있어야 한다');

  // ⛔⛔ **Change Date 가 비어 있으면 발행하지 않는다.** 비워 두면 효력이 「Change Date 또는
  //    그 판의 최초 배포 4주년 중 **먼저** 오는 날」의 뒤쪽으로 넘어가고, 그 순간 이 판의
  //    유료층 보호가 증서의 기본값에 맡겨진다. ⭐ 박는 값은 고르는 것이 아니다 — 증서가
  //    축자로 「publication date **plus four years**」라고 적는다.
  const license = readFileSync(join(PKG_ROOT, 'LICENSE'), 'utf8');
  assert.doesNotMatch(license, /Change Date:\s+UNSET/, 'Change Date 가 UNSET 이다 — 박지 않은 판은 발행하지 않는다');
  assert.match(license, /Change Date:\s+\d{4}-\d{2}-\d{2}\./, 'Change Date 가 ISO 날짜로 서지 않았다');

  // 그리고 조건의 **산문은 남는다** — 다음 판이 같은 길을 가고, 조건을 기억에 두면 갈라진다.
  const readme = readFileSync(join(PKG_ROOT, 'README.md'), 'utf8');
  for (const must of ['Change Date', '공개 전환']) {
    assert.ok(readme.includes(must), `README 가 발행 조건의 「${must}」를 적지 않았다`);
  }
});

/**
 * ⭐⭐ **날짜의 꼴을 묻는 것과 그 날짜가 무엇의 것인지 묻는 것은 다른 질문이다.**
 *
 * 위 단정은 Change Date 가 `UNSET` 이 아니고 ISO 꼴인지만 물었다. 그 분모로는 **전 판의
 * 값이 그대로 남은 판**도 초록이다 — 그리고 실제로 그런 일이 있었다: `1.0.0` 이 나간 증서가
 * 「stamp is for version **0.1.0**」이라고 적고 있었고, 그 줄이 작업장 · 받는 쪽 루트 사본 ·
 * **npm 에 실린 타르볼** 셋에 다 실렸다(2026-10-28 실측). ⭕ 날짜는 맞았고 **판 이름이**
 * 틀렸다 — 그래서 어느 가드도 울지 않았다.
 *
 * ⇒ 두 끈을 맨다: ⑴ 스탬프가 **이 판**을 가리키는가 ⑵ Change Date 가 그 스탬프의 발행일에서
 * **유도되는가**. ⭐ ⑵ 의 식은 우리가 고른 것이 아니라 증서의 축자다 — 「publication date
 * **plus four years**」. ⛔ 그래서 가드가 날짜를 리터럴로 들지 않는다: 들면 발행본과 가드가
 * **같이** 낡고, 그것은 낡음을 잡는 게 아니라 **고정하는** 것이다.
 */
const STAMP = /stamp is for version (\S+), published (\d{4}-\d{2}-\d{2})\./;
const CHANGE_DATE = /Change Date:\s+(\d{4}-\d{2}-\d{2})\./;

/**
 * 발행일 + 4년. ⭐ 문자로 더한다 — `Date` 로 가면 시간대가 하루를 옮길 수 있고, 증서의
 * 날짜는 벽시계 날짜다. ⬜ 2096-02-29 는 이 식에서 없는 날이 된다(2100 이 윤년이 아니다) —
 * 재지 않았고, 그날의 사람이 볼 일이다.
 */
const plusFourYears = (iso: string): string => {
  const [year, rest] = [iso.slice(0, 4), iso.slice(4)];
  return `${Number(year) + 4}${rest}`;
};

/**
 * 증서와 판을 받아 **어긋난 것을 센다** — ⭐ 순수해서 **심어 볼 수 있다**(아래 음성 통제).
 * ⛔ 모듈로 내보내지 않는다: 공개 표면은 닫힌 목록이고(AC6) 이 질문은 **발행 가드의 것**이다.
 */
function stampProblems(license: string, version: string): string[] {
  const stamp = STAMP.exec(license);
  if (stamp === null) return ['증서가 「이 스탬프는 어느 판의 것인가」를 적지 않았다'];
  const [, stamped, published] = stamp as unknown as [string, string, string];

  const problems: string[] = [];
  if (stamped !== version) {
    problems.push(`스탬프가 ${stamped} 를 가리키는데 이 판은 ${version} 이다`);
  }
  const changeDate = CHANGE_DATE.exec(license);
  if (changeDate === null) problems.push('Change Date 가 ISO 날짜로 서지 않았다');
  else if (changeDate[1] !== plusFourYears(published)) {
    problems.push(`Change Date 가 ${changeDate[1]} 인데 ${published} + 4년은 ${plusFourYears(published)} 다`);
  }
  return problems;
}

test('발행 — 증서의 스탬프가 **이 판**을 가리키고, Change Date 가 그 발행일에서 난다', () => {
  const license = readFileSync(join(PKG_ROOT, 'LICENSE'), 'utf8');
  assert.deepEqual(stampProblems(license, manifest.version as string), []);

  // ⭐⭐ **음성 통제 둘 — 분모가 비어 있지 않다는 증거다.** 심은 위반이 빨개지지 않으면
  //   위의 초록은 「재서 괜찮다」가 아니라 「아무것도 재지 않았다」다.
  const wrongVersion = license.replace('stamp is for version 1.0.0', 'stamp is for version 0.1.0');
  assert.notDeepEqual(stampProblems(wrongVersion, manifest.version as string), []);

  const staleDate = license.replace(/Change Date:\s+\d{4}-\d{2}-\d{2}\./, 'Change Date:          2029-10-28.');
  assert.notDeepEqual(stampProblems(staleDate, manifest.version as string), []);

  // ⛔ 그리고 **스탬프가 아예 없는 증서**도 통과가 아니다 — 적지 않은 것은 「맞다」가 아니다.
  assert.notDeepEqual(stampProblems(license.replace(STAMP, 'no stamp here.'), manifest.version as string), []);
});

/**
 * ⭐⭐ **npm 이 우리 선언을 고쳐 쓰는 자리가 이 파일 밖에 있었다.**
 *
 * 이 파일의 규율은 「선언이 실물과 1:1 인가」인데, 여기서 **실물**은 로컬에서 포장한
 * 타르볼이었다. 그런데 레지스트리가 내주는 매니페스트는 그것과 **또 한 번 다를 수 있다**:
 * `npm publish` 가 매니페스트를 말없이 고치고 경고 한 줄만 남긴다. 실측 — 커밋된
 * `./dist/cli.js` 가 레지스트리에서 `dist/cli.js` 로 섰고, 로컬 포장도 동작도 둘 다
 * 초록이었다. ⇒ 고치는 손이 하나 더 있었고 아무도 묻지 않았다.
 *
 * ⛔ **npm 의 규칙을 베껴 적지 않는다** — 그 사본은 npm 이 바뀌는 날 갈라지고, 갈라진 쪽이
 * 초록을 낸다. 대신 **npm 에게 묻는다**: 고칠 것이 있다고 말하는지.
 *
 * ⛔ **`npm publish --dry-run` 으로 묻지 않는다.** 그 길은 레지스트리를 부르고, 이미 나간
 * 판에서는 「덮어쓸 수 없다」로 **먼저** 실패한다 — 발행 직후부터 이 가드가 영원히 빨갛고,
 * 그 빨강은 매니페스트와 아무 상관이 없다. ⇒ 네트워크도 레지스트리 상태도 타지 않는
 * `npm pkg fix` 를 **사본에** 돌린다.
 *
 * ⚠️ **사본에 돌린다** — `npm pkg fix` 는 제자리에서 고치는 손이라, 저장소의 매니페스트에
 * 돌리면 가드가 **고쳐 놓고 초록**이 된다. 재는 것과 고치는 것이 한 손이면 아무것도 재지 못한다.
 */
const fixedByNpm = (manifest: string): string => {
  const at = mkdtempSync(join(tmpdir(), 'graduand-pkgfix-'));
  writeFileSync(join(at, 'package.json'), manifest);
  const said = spawnSync('npm', ['pkg', 'fix'], { cwd: at, encoding: 'utf8' });
  assert.equal(said.status, 0, `npm pkg fix 가 실패했다: ${said.stderr}`);
  return readFileSync(join(at, 'package.json'), 'utf8');
};

test('발행 — npm 이 고칠 것이 0 이다: 커밋된 선언이 레지스트리에 그대로 선다', () => {
  const committed = readFileSync(join(PKG_ROOT, 'package.json'), 'utf8');
  assert.equal(fixedByNpm(committed), committed, 'npm 이 매니페스트를 고친다 — 커밋된 선언과 발행된 선언이 갈라진다');

  // ⭐⭐ **대조군** — 그 한 칸을 되돌려 심으면 npm 이 실제로 고친다. 이 단정이 없으면 위의
  //    초록은 「npm 이 아무것도 안 고친다」가 아니라 「우리가 묻는 법을 모른다」일 수 있다.
  const planted = committed.replace('"graduand": "dist/cli.js"', '"graduand": "./dist/cli.js"');
  assert.notEqual(planted, committed, '심기가 아무것도 바꾸지 않았다 — 대조군이 분모를 잃었다');
  assert.notEqual(fixedByNpm(planted), planted, 'npm 이 선두 ./ 를 고치지 않았다 — 이 대조군이 낡았다');
});
