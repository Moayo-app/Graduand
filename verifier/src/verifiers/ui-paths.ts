/**
 * `ui-paths` — 선언된 UI 경로의 실재성 판정기. 선언층 probe 의 원형이다:
 * **선언을 믿지 않고 실재를 묻는다.**
 *
 * 분모는 `graduand.json` 의 `ui` 선언이다. 상태를 섞지 않는다:
 * - 선언 파일/`ui` 키 부재 → `unjudged(no-declaration)` — 「위반 0」이 아니다.
 * - `ui: []` → 「UI 없음」이라는 **선언** — 판정 대상 0 으로 통과. 부재와 다른 음성이다.
 * - 선언된 경로가 없다 → `violation` — 분모가 허공을 가리킨다.
 */

import type { CheckResult, Evidence } from '../schema.ts';
import type { PathIndex } from '../snapshot.ts';
import type { DeclarationResult } from '../declaration.ts';
import { capEvidence } from './evidence.ts';
import type { VerifierId } from './registry.ts';

export type Presence = 'missing' | 'not-a-dir';

export const UI_PATHS_CHECK_ID = 'ui-paths' satisfies VerifierId;

/**
 * @param declaration 검증을 통과한 선언, 또는 그 부재. `invalid` 는 여기 오기 전에
 *                    판정 실패로 멈춘다(judge 층의 몫). `'unreadable'` 은 선언 파일이
 *                    추적되는데 본문을 읽지 못한 상태 — 잘림이지 부재가 아니다.
 */
export function judgeUiPaths(
  index: PathIndex,
  declaration: Exclude<DeclarationResult, { state: 'invalid' }> | 'unreadable',
): CheckResult {
  if (declaration === 'unreadable') {
    return {
      id: UI_PATHS_CHECK_ID,
      status: 'unjudged',
      reason: 'collection-truncated',
      counts: { declared: 0 },
      evidence: [],
    };
  }
  if (declaration.state === 'absent' || declaration.ui === null) {
    return {
      id: UI_PATHS_CHECK_ID,
      status: 'unjudged',
      reason: 'no-declaration',
      counts: { declared: 0 },
      evidence: [],
    };
  }

  const declared = declaration.ui;
  const absent: { path: string; presence: Presence }[] = [];
  let present = 0;
  for (const path of declared) {
    // 뒤 `/` 로 끝나면 디렉터리 선언이다 — 같은 이름의 파일은 실재가 아니라 `not-a-dir` 다.
    if (path.endsWith('/')) {
      if (index.hasDir(path)) present += 1;
      else absent.push({ path, presence: index.hasFile(path.replace(/\/+$/, '')) ? 'not-a-dir' : 'missing' });
    } else if (index.has(path)) {
      present += 1;
    } else {
      absent.push({ path, presence: 'missing' });
    }
  }

  const { evidence, omitted } = capEvidence(
    absent.map((a): Evidence => ({ path: a.path, presence: a.presence })),
  );

  return {
    id: UI_PATHS_CHECK_ID,
    status: absent.length > 0 ? 'violation' : 'pass',
    reason: null,
    counts: {
      declared: declared.length,
      present,
      absent: absent.length,
      evidenceOmitted: omitted,
    },
    evidence,
  };
}
