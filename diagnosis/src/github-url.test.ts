import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRepoInput } from './github-url.ts';

test('받는 형태 — owner/name 과 github.com 주소의 변주', () => {
  assert.deepEqual(parseRepoInput('acme/widgets'), { repo: 'acme/widgets' });
  assert.deepEqual(parseRepoInput('  https://github.com/acme/widgets  '), { repo: 'acme/widgets' });
  assert.deepEqual(parseRepoInput('https://www.github.com/acme/widgets.git'), { repo: 'acme/widgets' });
  assert.deepEqual(parseRepoInput('github.com/acme/widgets/'), { repo: 'acme/widgets' });
  assert.deepEqual(parseRepoInput('https://github.com/acme/widgets?tab=readme'), { repo: 'acme/widgets' });
});

test('ref — tree 는 나머지 전부, blob 은 한 조각만 ref 다', () => {
  assert.deepEqual(parseRepoInput('github.com/acme/widgets/tree/main'), { repo: 'acme/widgets', ref: 'main' });
  assert.deepEqual(parseRepoInput('github.com/acme/widgets/tree/release/v2'), {
    repo: 'acme/widgets',
    ref: 'release/v2',
  });
  assert.deepEqual(parseRepoInput('github.com/acme/widgets/blob/main/docs/guide.md'), {
    repo: 'acme/widgets',
    ref: 'main',
  });
});

test('그 밖은 null — 추측으로 넓히지 않는다', () => {
  assert.equal(parseRepoInput(''), null);
  assert.equal(parseRepoInput('acme'), null);
  assert.equal(parseRepoInput('https://gitlab.example.com/acme/widgets'), null);
  assert.equal(parseRepoInput('ftp://github.com/acme/widgets'), null);
  assert.equal(parseRepoInput('github.com/acme/widgets/pulls'), null);
  assert.equal(parseRepoInput('github.com/-acme/widgets'), null);
  assert.equal(parseRepoInput('a b/c'), null);
  assert.equal(parseRepoInput('github.com/acme'), null);
});
