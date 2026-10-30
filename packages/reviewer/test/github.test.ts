import { describe, expect, it } from 'vitest';
import { GitHub, renderComment, summarise } from '../src/github.js';
import type { Finding } from '../src/types.js';

function fakeGitHub() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const routes: Record<string, unknown> = {
    '/repos/o/r/pulls/7': { title: 'Add filter', body: 'Adds a fuel filter', head: { sha: 'abc123' } },
    '/repos/o/r/pulls/7/files?per_page=100&page=1': [
      { filename: 'apps/api/app/X.php', status: 'modified', patch: '@@ -1,2 +1,3 @@\n <?php\n+$a = 1;\n $b = 2;' },
      { filename: 'logo.png', status: 'added' },
      { filename: 'old.php', status: 'removed', patch: '@@ -1 +0,0 @@\n-<?php' },
    ],
    '/repos/o/r/contents/apps/api/app/X.php?ref=abc123': '<?php\n$a = 1;\n$b = 2;',
  };
  const http = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const path = url.replace('https://api.github.com', '');
    if (init?.method === 'POST') return new Response('{}', { status: 200 });
    const body = routes[path];
    if (body === undefined) return new Response('nope', { status: 404 });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { gh: new GitHub('t0ken', 'https://api.github.com', http), calls };
}

describe('GitHub', () => {
  it('reads a pull request into a review input, skipping binaries', async () => {
    const { gh } = fakeGitHub();
    const { input, headSha } = await gh.pullRequest({ owner: 'o', repo: 'r', number: 7 });
    expect(headSha).toBe('abc123');
    expect(input.title).toBe('Add filter');
    expect(input.files.map((f) => [f.diff.path, f.diff.status, f.after])).toEqual([
      ['apps/api/app/X.php', 'modified', '<?php\n$a = 1;\n$b = 2;'],
      ['old.php', 'deleted', null],
    ]);
    expect([...(input.files[0]?.diff.added.keys() ?? [])]).toEqual([2]);
  });

  it('posts a COMMENT review with inline comments on the new side, never an approval', async () => {
    const { gh, calls } = fakeGitHub();
    const c: Finding = { file: 'apps/api/app/X.php', line: 2, category: 'money', severity: 'major', message: 'Use cents.', evidence: '$a = 1;', confidence: 1, source: 'rule', rule: 'money-float' };
    await gh.postReview({ owner: 'o', repo: 'r', number: 7 }, 'abc123', [c], [{ rule: 't', category: 'tests', message: 'No test changed.' }], 'Summary.');
    const post = calls.find((x) => x.init?.method === 'POST');
    const body = JSON.parse(String(post?.init?.body));
    expect(post?.url).toBe('https://api.github.com/repos/o/r/pulls/7/reviews');
    expect(body.event).toBe('COMMENT');
    expect(body.commit_id).toBe('abc123');
    expect(body.body).toBe('Summary.\n- No test changed.');
    expect(body.comments).toEqual([{ path: 'apps/api/app/X.php', line: 2, side: 'RIGHT', body: renderComment(c) }]);
  });

  it('fails loudly when GitHub refuses', async () => {
    const gh = new GitHub('t', 'https://api.github.com', (async () => new Response('bad', { status: 403 })) as typeof fetch);
    await expect(gh.pullRequest({ owner: 'o', repo: 'r', number: 1 })).rejects.toThrow('GitHub 403');
  });

  it('summarises honestly', () => {
    expect(summarise([], 0, null)).toContain('Team rules only');
    expect(summarise([], 3, 'anthropic:x')).toContain('3 model comment(s) removed by the guardrails');
  });
});
