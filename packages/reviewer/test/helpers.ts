import { parseDiff } from '../src/diff.js';
import type { ChangedFile, ReviewConfig, ReviewInput } from '../src/types.js';

/**
 * A changed file from its full new content, where lines starting with "+ " are the added ones and
 * lines starting with "- " were removed before the next line.
 */
export function changed(path: string, spec: string, status: 'added' | 'modified' = 'modified'): ChangedFile {
  const after: string[] = [];
  const diffLines: string[] = [];
  for (const raw of spec.replace(/^\n/, '').split('\n')) {
    if (raw.startsWith('+ ')) {
      after.push(raw.slice(2));
      diffLines.push(`+${raw.slice(2)}`);
    } else if (raw.startsWith('- ')) {
      diffLines.push(`-${raw.slice(2)}`);
    } else {
      after.push(raw);
      diffLines.push(` ${raw}`);
    }
  }
  const oldCount = diffLines.filter((l) => !l.startsWith('+')).length;
  const header = `diff --git a/${path} b/${path}\n--- ${status === 'added' ? '/dev/null' : `a/${path}`}\n+++ b/${path}\n@@ -1,${oldCount} +1,${after.length} @@`;
  const [diff] = parseDiff(`${header}\n${diffLines.join('\n')}`);
  if (!diff) throw new Error('bad spec');
  if (status === 'added') diff.status = 'added';
  return { diff, after: after.join('\n') };
}

export const input = (...files: ChangedFile[]): ReviewInput => ({ title: 'Test PR', description: '', files });

export const config: ReviewConfig = { commentMustCiteChangedLine: true, maxComments: 8, minConfidence: 0.6 };
