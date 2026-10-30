// Build a review input from the local git repository: the diff between two refs and the files as
// they are at the second one (or in the working tree).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseDiff } from './diff.js';
import type { ReviewInput } from './types.js';

export function localInput(root: string, base: string, head?: string): ReviewInput {
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const diffText = git('diff', '--unified=3', '--no-color', base, ...(head ? [head] : []));
  const files = parseDiff(diffText).map((diff) => {
    let after: string | null = null;
    if (diff.status !== 'deleted') {
      after = head ? git('show', `${head}:${diff.path}`) : existsSync(join(root, diff.path)) ? readFileSync(join(root, diff.path), 'utf8') : null;
    }
    return { diff, after };
  });
  const title = head ? git('log', '-1', '--format=%s', head).trim() : 'working tree';
  return { title, description: '', files };
}
