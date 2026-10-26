/**
 * 디자인 토큰 값 박제 — 한지 바탕 + 먹 램프 6색(공유 디자인 토큰의 사본)과 탭 타깃
 * 하한. 값을 바꾸려면 이 spec 을 같은 변경으로 함께 바꾼다 — 코드 선언만으로 두면
 * 사본이 조용히 갈라진다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');

test('먹 램프 6색 + 한지 바탕 — hex 값이 그대로 있다', () => {
  const pinned: Record<string, string> = {
    base: '#F7F6F3',
    'ink-burnt': '#1A1D2E',
    'ink-dense': '#2D3142',
    'ink-heavy': '#6B6E80',
    'ink-light': '#C8CAD2',
    'ink-clear': '#EFEFF2',
  };
  for (const [name, hex] of Object.entries(pinned)) {
    assert.match(css, new RegExp(`--${name}:\\s*${hex};`), `${name} 토큰이 ${hex} 가 아니다`);
  }
});

test('탭 타깃 하한 — 44, 누를 수 있는 것이 이 아래로 내려가지 않는다', () => {
  assert.match(css, /--tap-min:\s*44px;/);
  assert.match(css, /min-height:\s*var\(--tap-min\)/);
});
