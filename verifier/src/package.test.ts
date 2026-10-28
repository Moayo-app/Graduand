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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
 * ⛔ 이 목록은 **줄지 않는다** — 줄이는 변경은 「이미 나간 판을 덮어쓴다」는 뜻이다.
 */
const CONSUMED_VERSIONS: readonly string[] = ['0.0.0', '0.0.1', '0.0.0-stage'];

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

  const fromBin = declaredEntryPoints(manifest.bin);
  const fromExports = declaredEntryPoints(manifest.exports);
  assert.ok(fromBin.length > 0 && fromExports.length > 0, `${fromBin.length} · ${fromExports.length}`);

  for (const entry of [...fromBin, ...fromExports]) {
    assert.ok(entry.startsWith('./'), `진입점이 상대 경로가 아니다: ${entry}`);
    const at = join(packed().dir, entry.slice(2));
    assert.ok(existsSync(at) && statSync(at).isFile(), `선언된 진입점이 발행본에 없다: ${entry}`);
    assert.ok(statSync(at).size > 0, `선언된 진입점이 빈 파일이다: ${entry}`);
  }

  // ⭐⭐ **가드가 살아 있다** — 없는 자리를 적으면 빨갛다. 깨끗한 선언이 초록인 것이 대조군이다.
  for (const planted of ['./dist/nope.js', './dist/hosts/nope.js']) {
    const at = join(packed().dir, planted.slice(2));
    assert.ok(!existsSync(at), `${planted} 가 실재한다 — 이 대조군이 고장났다`);
  }
});

test('발행 AC4 — bin 으로 설치되는 그 파일이 **실제로 돈다**: `--help` 가 exit 0', () => {
  const targets = Object.values(manifest.bin ?? {});
  assert.ok(targets.length > 0);
  for (const target of targets) {
    const at = join(packed().dir, target.slice(2));
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
