import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnablementDesk } from '@/features/enablement/EnablementDesk';
import type { Reports } from '@/features/enablement/reports';

const missing = (path: string) => ({ ok: false as const, reason: 'missing' as const, path });

describe('enablement desk', () => {
  it('says what has not been measured instead of showing numbers', () => {
    const reports: Reports = {
      goldenMaster: missing('reports/golden-master.json'),
      mutation: missing('reports/mutation.json'),
      review: missing('benchmarks/review/results/first_run.json'),
      adoption: { ok: false, reason: 'unreadable', path: 'reports/adoption/results.json' },
      approved: missing('apps/api/tests/GoldenMaster/approved-changes.json'),
    };
    render(<EnablementDesk reports={reports} />);
    expect(screen.getAllByRole('heading', { name: 'Not measured yet' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Report unreadable' })).toBeTruthy();
    expect(screen.getByText(/No report at reports\/golden-master\.json/)).toBeTruthy();
  });

  it('shows the gate results, the benchmark and the rollout analysis from the reports', () => {
    const reports: Reports = {
      goldenMaster: { ok: true, data: { total: 10240, identical: 4096, explained: 6144, by_change: { 'AC-1': 4096, 'AC-2': 2048 }, unapproved: [] } },
      mutation: { ok: true, data: { score_percent: 100, tested: 95, timeout: 6, untested: 0, min_percent: 85, target: 'app/Domain' } },
      review: {
        ok: true,
        data: { recordedAt: '2026-10-30T15:00:00Z', model: 'replay:test', cases: 24, lineTolerance: 3, scores: [{ mode: 'rules + model, guardrails (shipped)', defects: 18, caught: 16, recall: 88.9, comments: 19, correctComments: 16, precision: 84.2, commentsOnCleanPRs: 0, cleanPRsWithComments: 0 }] },
      },
      adoption: {
        ok: true,
        data: {
          teams: 24,
          pull_requests: 17222,
          truth: { throughput: 0.194, cycle_time: -0.162 },
          estimates: { throughput: { before_after: 0.326, adopters_vs_rest: 0.632, twfe: 0.132, callaway_santanna: 0.173 }, cycle_time: { before_after: -0.154, adopters_vs_rest: -0.215, twfe: -0.12, callaway_santanna: -0.144 } },
          intervals: { throughput: [0.102, 0.282] },
          rework_phases: { 'first weeks': { estimate: 0.35, truth: 0.45 } },
        },
      },
      approved: { ok: true, data: [{ id: 'AC-1', title: 'Business offers compare net to net', why: 'Because.' }] },
    };
    render(<EnablementDesk reports={reports} />);
    expect(screen.getByText('10,240')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('4,096 cases')).toBeTruthy();
    expect(screen.getByText('16 of 18 (88.9%)')).toBeTruthy();
    expect(screen.getByText(/overstate the throughput gain by 13 to 44 points/)).toBeTruthy();
    expect(screen.getByText('+17.3%')).toBeTruthy();
  });
});
