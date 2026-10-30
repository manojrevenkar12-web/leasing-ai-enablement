import { describe, expect, it } from 'vitest';
import { score } from '../src/bench/run.js';
import type { Finding } from '../src/types.js';

const c = (file: string, line: number): Finding => ({ file, line, category: 'x', severity: 'major', message: 'm', evidence: 'e', confidence: 1, source: 'rule' });

describe('benchmark scoring', () => {
  it('counts a defect as caught within three lines of where its author pointed', () => {
    const s = score('t', [
      { meta: { id: 'P-01', title: '', description: '', kind: 'defect', defects: [{ file: 'a.php', line: 10, category: 'money', explanation: '' }] }, comments: [c('a.php', 13), c('a.php', 30)] },
      { meta: { id: 'P-02', title: '', description: '', kind: 'defect', defects: [{ file: 'b.php', line: 5, category: 'sql', explanation: '' }] }, comments: [c('b.php', 9), c('a.php', 5)] },
      { meta: { id: 'P-03', title: '', description: '', kind: 'clean', defects: [] }, comments: [c('c.php', 1)] },
      { meta: { id: 'P-04', title: '', description: '', kind: 'clean', defects: [] }, comments: [] },
    ]);
    expect(s).toMatchObject({ defects: 2, caught: 1, recall: 50, comments: 5, correctComments: 1, precision: 20, commentsOnCleanPRs: 1, cleanPRsWithComments: 1, missed: ['P-02:sql'] });
  });
});
