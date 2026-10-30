import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The desk shows the reports the checks wrote and committed; it computes nothing itself.
const REPO = process.env.LEASING_REPO_ROOT ?? join(/*turbopackIgnore: true*/ process.cwd(), '../..');

export interface GoldenMaster {
  total: number;
  identical: number;
  explained: number;
  by_change: Record<string, number>;
  unapproved: unknown[];
}
export interface Mutation {
  score_percent: number;
  tested: number;
  timeout: number;
  untested: number;
  min_percent: number;
  target: string;
}
export interface ReviewScore {
  mode: string;
  defects: number;
  caught: number;
  recall: number;
  comments: number;
  correctComments: number;
  precision: number;
  commentsOnCleanPRs: number;
  cleanPRsWithComments: number;
}
export interface ReviewRun {
  recordedAt: string;
  model: string | null;
  cases: number;
  lineTolerance: number;
  scores: ReviewScore[];
}
export interface Adoption {
  teams: number;
  pull_requests: number;
  truth: Record<string, number>;
  estimates: Record<string, Record<string, number>>;
  intervals: Record<string, [number, number]>;
  rework_phases: Record<string, { estimate: number; truth: number }>;
}
export interface ApprovedChange {
  id: string;
  title: string;
  why: string;
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: 'missing' | 'unreadable'; path: string };

async function load<T>(path: string): Promise<Loaded<T>> {
  let text: string;
  try {
    text = await readFile(join(REPO, path), 'utf8');
  } catch {
    return { ok: false, reason: 'missing', path };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, reason: 'unreadable', path };
  }
}

export async function loadReports() {
  const [goldenMaster, mutation, review, adoption, approved] = await Promise.all([
    load<GoldenMaster>('reports/golden-master.json'),
    load<Mutation>('reports/mutation.json'),
    load<ReviewRun>('benchmarks/review/results/first_run.json'),
    load<Adoption>('reports/adoption/results.json'),
    load<ApprovedChange[]>('apps/api/tests/GoldenMaster/approved-changes.json'),
  ]);
  return { goldenMaster, mutation, review, adoption, approved };
}

export type Reports = Awaited<ReturnType<typeof loadReports>>;
