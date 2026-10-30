// Benchmark the reviewer on pull requests with planted defects, written blind (see
// benchmarks/review/WRITING_PRS.md).
//
//   bench prompts            write the model request for every case (for recording answers)
//   bench score [--record]   score every mode; --record pins the first run, which is never rewritten
//
// A comment "catches" a defect when it is on the same file within LINE_TOLERANCE lines of where the
// case's author said a reviewer should comment. Comments on clean cases, and comments that catch
// nothing, are noise.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { parseDiff } from '../diff.js';
import { buildRequest } from '../llm/prompt.js';
import { ReplayProvider, requestKey } from '../llm/provider.js';
import { conventionsFrom, loadConfig, review } from '../review.js';
import type { ChangedFile, Finding, ReviewInput } from '../types.js';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '../../../..');
const BENCH = join(ROOT, 'benchmarks/review');
const LINE_TOLERANCE = 3;

interface Defect {
  file: string;
  line: number;
  category: string;
  explanation: string;
}
interface Case {
  id: string;
  title: string;
  description: string;
  kind: 'defect' | 'clean';
  defects: Defect[];
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

export function loadCase(id: string, base: string): { meta: Case; input: ReviewInput } {
  const dir = join(BENCH, 'cases', id);
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Case;
  const tmp = mkdtempSync(join(tmpdir(), `bench-${id}-`));
  const files: ChangedFile[] = [];
  for (const afterPath of walk(join(dir, 'after'))) {
    const path = relative(join(dir, 'after'), afterPath);
    let before: string | null = null;
    try {
      before = execFileSync('git', ['-C', ROOT, 'show', `${base}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      before = null; // a new file
    }
    const beforeFile = join(tmp, 'before');
    writeFileSync(beforeFile, before ?? '');
    let diffText = '';
    try {
      execFileSync('git', ['diff', '--no-index', '--unified=3', '--no-color', beforeFile, afterPath], { encoding: 'utf8' });
    } catch (e) {
      diffText = String((e as { stdout?: string }).stdout ?? ''); // exit code 1 means "differs"
    }
    const [diff] = parseDiff(diffText);
    if (!diff) continue;
    diff.path = path;
    diff.oldPath = before === null ? null : path;
    diff.status = before === null ? 'added' : 'modified';
    files.push({ diff, after: readFileSync(afterPath, 'utf8') });
  }
  return { meta, input: { title: meta.title, description: meta.description, files } };
}

export function caseIds(): string[] {
  return readdirSync(join(BENCH, 'cases')).filter((d) => existsSync(join(BENCH, 'cases', d, 'meta.json'))).sort();
}

export interface ModeScore {
  mode: string;
  defects: number;
  caught: number;
  recall: number;
  comments: number;
  correctComments: number;
  precision: number;
  commentsOnCleanPRs: number;
  cleanPRsWithComments: number;
  missed: string[];
}

export function score(mode: string, results: { meta: Case; comments: Finding[] }[]): ModeScore {
  let defects = 0;
  let caught = 0;
  let comments = 0;
  let correct = 0;
  let onClean = 0;
  let cleanWith = 0;
  const missed: string[] = [];
  for (const { meta, comments: cs } of results) {
    comments += cs.length;
    const hits = (d: Defect, c: Finding) => c.file === d.file && Math.abs(c.line - d.line) <= LINE_TOLERANCE;
    correct += cs.filter((c) => meta.defects.some((d) => hits(d, c))).length;
    for (const d of meta.defects) {
      defects++;
      if (cs.some((c) => hits(d, c))) caught++;
      else missed.push(`${meta.id}:${d.category}`);
    }
    if (meta.kind === 'clean') {
      onClean += cs.length;
      if (cs.length) cleanWith++;
    }
  }
  const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);
  return { mode, defects, caught, recall: pct(caught, defects), comments, correctComments: correct, precision: pct(correct, comments), commentsOnCleanPRs: onClean, cleanPRsWithComments: cleanWith, missed };
}

async function main(): Promise<void> {
  const [cmd = 'score', ...flags] = process.argv.slice(2);
  const base = readFileSync(join(BENCH, 'BASE'), 'utf8').trim();
  const conventions = conventionsFrom(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8'));
  const config = loadConfig(join(ROOT, 'config/quality.json'));
  const cases = caseIds().map((id) => loadCase(id, base));

  if (cmd === 'prompts') {
    const out = join(BENCH, 'prompts');
    mkdirSync(out, { recursive: true });
    for (const { meta, input } of cases) {
      const req = buildRequest(input, conventions);
      writeFileSync(join(out, `${meta.id}.json`), `${JSON.stringify({ id: meta.id, key: requestKey(req), system: req.system, prompt: req.prompt, schema: req.schema }, null, 2)}\n`);
    }
    console.log(`wrote ${cases.length} prompts to ${relative(ROOT, out)}`);
    return;
  }

  const cassette = join(BENCH, 'cassettes/claude.json');
  const replay = existsSync(cassette) ? ReplayProvider.fromFile(cassette) : null;
  const modes: { name: string; opts: Partial<Parameters<typeof review>[1]> }[] = [
    { name: 'rules only', opts: { provider: null } },
    ...(replay
      ? [
          { name: 'model only, no guardrails', opts: { provider: replay, rules: false, unguarded: true } },
          { name: 'model only, guardrails', opts: { provider: replay, rules: false } },
          { name: 'rules + model, no guardrails', opts: { provider: replay, unguarded: true } },
          { name: 'rules + model, guardrails (shipped)', opts: { provider: replay } },
        ]
      : []),
  ];
  const scores: ModeScore[] = [];
  for (const m of modes) {
    const results = [];
    for (const { meta, input } of cases) {
      const res = await review(input, { config, conventions, ...m.opts });
      results.push({ meta, comments: res.comments });
    }
    scores.push(score(m.name, results));
  }
  console.table(scores.map(({ missed: _, ...s }) => s));

  if (flags.includes('--record')) {
    const status = readFileSync(join(BENCH, 'STATUS'), 'utf8').trim();
    const path = join(BENCH, 'results/first_run.json');
    if (existsSync(path)) throw new Error('results/first_run.json exists; a first run is never rewritten');
    if (status !== 'blind') throw new Error(`the set is ${status}, not blind`);
    mkdirSync(dirname(path), { recursive: true });
    const commit = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    writeFileSync(path, `${JSON.stringify({ recordedAt: new Date().toISOString(), reviewerCommit: commit, base, model: replay?.name ?? null, lineTolerance: LINE_TOLERANCE, cases: cases.length, scores }, null, 2)}\n`);
    console.log(`first run recorded in ${relative(ROOT, path)}`);
  }
}

if (process.argv[1]?.endsWith('run.ts') || process.argv[1]?.endsWith('run.js')) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
