import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGithubSnapshot } from './github.ts';
import { RateLimitedError, RepoUnreadableError } from '../snapshot.ts';
import { judgeSnapshot } from '../judge.ts';

type Route = (url: URL) => Response | undefined;

const asFetch = (route: Route): typeof fetch =>
  ((input: string | URL) => {
    const url = new URL(String(input));
    const rsp = route(url);
    return Promise.resolve(rsp ?? new Response('not found', { status: 404 }));
  }) as typeof fetch;

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const rateLimit = (): Response =>
  new Response('rate limited', {
    status: 403,
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1767225600' },
  });

test('404 — 비공개와 부재를 구분하는 척하지 않는다', async () => {
  await assert.rejects(
    loadGithubSnapshot({ repo: 'acme/hidden', fetch: asFetch(() => undefined) }),
    (e: unknown) => e instanceof RepoUnreadableError && e.code === 'private-or-missing',
  );
});

test('입구에서 한도 초과 — 리셋 시각을 실은 RateLimitedError', async () => {
  await assert.rejects(
    loadGithubSnapshot({ repo: 'acme/widgets', fetch: asFetch(() => rateLimit()) }),
    (e: unknown) => e instanceof RateLimitedError && e.resetAt === 1767225600,
  );
});

test('잘린 tree 는 판정 불가 — 불완전한 분모 위에서 판정하지 않는다', async () => {
  const fetch = asFetch((url) => {
    if (url.pathname === '/repos/acme/widgets') return json({ full_name: 'acme/widgets', default_branch: 'main' });
    if (url.pathname === '/repos/acme/widgets/commits/main') return json({ sha: 'e'.repeat(40) });
    if (url.pathname.startsWith('/repos/acme/widgets/git/trees/')) return json({ truncated: true, tree: [] });
    return undefined;
  });
  await assert.rejects(
    loadGithubSnapshot({ repo: 'acme/widgets', fetch }),
    (e: unknown) => e instanceof RepoUnreadableError && e.code === 'tree-truncated',
  );
});

test('본문을 읽다 한도에 걸리면 — 남은 파일은 잘림으로 남고 해당 체크가 미판정이 된다', async () => {
  let blobCalls = 0;
  const sha = 'f'.repeat(40);
  const fetch = asFetch((url) => {
    if (url.pathname === '/repos/acme/widgets') return json({ full_name: 'acme/widgets', default_branch: 'main' });
    if (url.pathname === '/repos/acme/widgets/commits/main') return json({ sha });
    if (url.pathname === `/repos/acme/widgets/git/trees/${sha}`) {
      return json({
        truncated: false,
        tree: [
          { path: 'a.md', type: 'blob', sha: 'blob-a' },
          { path: 'b.md', type: 'blob', sha: 'blob-b' },
        ],
      });
    }
    if (url.pathname.startsWith('/repos/acme/widgets/git/blobs/')) {
      blobCalls += 1;
      return rateLimit();
    }
    return undefined;
  });

  const load = await loadGithubSnapshot({ repo: 'acme/widgets', fetch });
  assert.equal(blobCalls, 1); // 한도에 걸린 뒤 계속 두드리지 않는다
  const refs = judgeSnapshot(load.snapshot).checks.find((c) => c.id === 'refs')!;
  assert.equal(refs.status, 'unjudged');
  assert.equal(refs.reason, 'collection-truncated');
});
