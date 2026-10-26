/**
 * 선언 스캐폴드 — 「헌법을 만든다」의 **편입** 쪽 입구.
 *
 * 「헌법을 만든다」는 둘이다: **규범 저작 1회**(정본 저장소에서) · **편입 저장소마다**.
 * 이 모듈은 둘째 쪽이고, 그 입구가 또 둘이다 — 체크아웃이 있는 고객은 `graduand init`
 * 이 **파일을 쓰고**, 공개 경로 방문자(체크아웃이 **없다**)는 페이지가 내보내는
 * **문자열**을 복사해 붙인다. ⭐ 둘이 같은 상수(`SCAFFOLD_JSON`) 하나를 낸다 — 사본이
 * 둘이면 갈라지고, 갈라진 스캐폴드는 이 제품이 파는 명제에 대한 자기모순이다.
 *
 * ⭕ **어느 갈래에서도 우리가 커밋하지 않는다.** 이 모듈은 git 을 모른다 — 파일을 쓰는
 * 것과 그 파일을 저장소 이력에 넣는 것은 다른 행위이고, 둘째는 고객의 몫이다.
 *
 * ⭐ **스캐폴드는 비어 있다.** 담을 수 있는 것은 **참인 선언**뿐이라 편입 기록의 공집합
 * 하나다 — 「아직 아무 규칙도 편입하지 않았다」. 도메인 규칙이 든 견본(예시 헌법)은 여기
 * 없다: 지금 쓰면 우리가 **상상한** 고객의 규범이고, 그것이 견본이 되면 고객이 그 상상을
 * 베낀다. 빈 분모는 결함이 아니라 미판정이다 — 「편입 0」은 선언이지 공백이 아니다.
 *
 * ⛔ **판정기를 켜는 자리는 스캐폴드에 없다.** 개정 2 에서 판정기 선택은
 * `admissions.<규칙 id>.verifiers` 아래 산다 — 규칙 id 없이 켤 수 있는 판정기가 없고,
 * 규칙 id 를 지어내는 것이 바로 위에서 미룬 그 견본이다. 그래서 스캐폴드가 켜는 판정기는
 * **0 개**이고, 고를 수 있는 이름은 등록부가 말한다(`VERIFIER_IDS`) — 아래 안내문은 그
 * 목록을 **읽어서** 적는다. 산문에 박은 개수는 등록부가 늘면 그 자리에서 거짓이 된다.
 *
 * ⛔ **node 를 import 하지 않는다** — 이 모듈은 페이지(브라우저)가 그대로 쓴다. 「파일이
 * 있는가 · 파일을 쓴다」는 호스트의 의미라서 `ScaffoldIo` 로 주입받고, 부작용은 경계
 * (`cli.ts`)에서 들어온다 — `Opener` 와 같은 모양이다.
 */

import { DECLARATION_FILE, PALETTE_KEYS, TOP_KEYS } from './declaration.ts';
import { VERIFIER_IDS } from './verifiers/registry.ts';

/**
 * 스캐폴드가 담는 전부 — 참인 선언 하나. `{}` 와 판정은 같지만 말이 다르다:
 * 빈 객체는 아무것도 말하지 않고, 이것은 「분모가 0 이고 나는 그것을 안다」를 말한다.
 */
export const SCAFFOLD_DECLARATION: { admissions: Record<string, never> } = { admissions: {} };

/**
 * `init` 이 쓰는 **바이트** = 페이지가 내보내는 **문자열**. 들여쓰기와 끝 개행이 이
 * 상수의 일부다 — 손으로 고치는 파일이고, 두 입구의 산출물이 바이트까지 같아야 「같은
 * 스키마, 같은 내용」이 단정이 아니라 사실이 된다.
 */
export const SCAFFOLD_JSON = `${JSON.stringify(SCAFFOLD_DECLARATION, null, 2)}\n`;

/** 호스트가 쥐는 셋 — 자리 · 실재 · 쓰기. 경로의 의미도 파일시스템의 의미도 호스트 몫이다. */
export interface ScaffoldIo {
  pathIn(root: string): string;
  exists(path: string): boolean;
  /** @throws 쓰지 못하면 던진다 — 조용한 실패는 「썼다」로 둔갑한다. */
  write(path: string, text: string): void;
}

export type InitOutcome =
  /** 썼다. `path` 가 쓰인 그 자리다. */
  | { kind: 'written'; path: string }
  /** 이미 선언이 있다 — 쓰지 않았다. ⛔ 덮어쓰기는 이 명령이 할 수 있는 일이 아니다. */
  | { kind: 'already-declared'; path: string }
  /** 쓰려 했고 실패했다 — 쓰지 않았다. */
  | { kind: 'write-failed'; path: string; message: string };

export function initDeclaration(root: string, io: ScaffoldIo): InitOutcome {
  const path = io.pathIn(root);
  // ⛔ 덮어쓰지 않는다 — 선언은 고객이 적은 것이고, 우리가 지울 수 있는 것이 아니다.
  // 「있으면 멈추고 말한다」가 이 분기의 전부다: 병합도 보존도 추측이다.
  if (io.exists(path)) return { kind: 'already-declared', path };
  try {
    io.write(path, SCAFFOLD_JSON);
  } catch (e) {
    return { kind: 'write-failed', path, message: (e as Error).message };
  }
  return { kind: 'written', path };
}

/** 다음에 적을 것 — 스키마에서 **읽어서** 적는다(산문 사본 0: 정본은 `declaration.ts`). */
const nextLines = (): string[] => [
  `   다음에 적을 것 — 최상위 키 ${TOP_KEYS.length} 개 (${TOP_KEYS.join(' · ')}):`,
  `     · admissions.<규칙 id>.verifiers — 고를 수 있는 판정기: ${VERIFIER_IDS.join(' · ')}`,
  `       (키는 규칙 id 다 — 규범 **정본의 규칙을 가리키는 이름**이지 규칙 본문이 아니다)`,
  `     · palette — 키 ${PALETTE_KEYS.length} 개 (${PALETTE_KEYS.join(' · ')})`,
  `     · ui — UI 경로 목록. 적지 않으면 그 축은 미판정이고, 빈 목록은 「UI 없음」이라는 선언이다`,
  '   ⭐ canon 은 가리키는 자리다 — 규범의 정본 주소를 적고, 규범 자체를 저장소마다 베끼지 않는다.',
  '      저장소 10 개에 같은 규범이 10 부 적히면 그것이 바로 이 판정기가 재는 갈라짐이다.',
];

/** 말하는 것 — 쓴 것 · 쓰지 않은 것 · 다음에 적을 것. 보고 표면과 같은 규율: 상태를 숨기지 않는다. */
export function formatInitOutcome(outcome: InitOutcome): { stdout: string[]; stderr: string[] } {
  switch (outcome.kind) {
    case 'written':
      return {
        stdout: [
          `✅ ${DECLARATION_FILE} 을 썼다 — ${outcome.path}`,
          '   편입 기록이 비어 있다 — 「아직 아무 규칙도 편입하지 않았다」는 참인 선언이고, 그 칸은 전부 미판정이다.',
          '   ⛔ 커밋하지도 스테이징하지도 않았다 — 이 명령은 git 을 건드리지 않는다.',
          '   ⚠️ 판정의 표본은 git 이 추적하는 파일이다 — 이 파일을 저장소에 넣기 전까지 판정은 「선언 없음」으로 미판정이다.',
          ...nextLines(),
        ],
        stderr: [],
      };
    case 'already-declared':
      return {
        stdout: [],
        stderr: [
          `❌ ${DECLARATION_FILE} 이 이미 있다 — 덮어쓰지 않았다: ${outcome.path}`,
          '   선언은 고객이 적은 것이다 — 스캐폴드로 되돌리려면 그 파일을 치운 뒤 다시 돌려라.',
        ],
      };
    case 'write-failed':
      return {
        stdout: [],
        stderr: [
          `❌ ${DECLARATION_FILE} 을 쓰지 못했다 — ${outcome.path}: ${outcome.message}`,
          '   쓰지 못한 것을 썼다고 말하지 않는다.',
        ],
      };
  }
}

/** 0 = 썼다 · 2 = 쓰지 않았다. ⛔ 1 은 쓰지 않는다 — 그 자리는 「위반 ≥ 1」의 몫이다. */
export const initExitCode = (outcome: InitOutcome): 0 | 2 => (outcome.kind === 'written' ? 0 : 2);
