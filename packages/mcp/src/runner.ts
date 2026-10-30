// Run the project's own checks for an agent, safely: a fixed list of commands, arguments checked
// against a pattern, no shell, a timeout, and only the tail of the output returned.
import { spawn } from 'node:child_process';

export interface RunResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  output: string;
}

export type Runner = (cmd: string, args: string[], cwd: string, timeoutMs: number) => Promise<RunResult>;

export const SAFE_ARG = /^[\w.:\\/ -]{1,120}$/;
const TAIL = 4000;

export const spawnRunner: Runner = (cmd, args, cwd, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, CI: '1', NO_COLOR: '1' } });
    let out = '';
    let timedOut = false;
    const keep = (b: Buffer) => {
      out = (out + b.toString()).slice(-TAIL * 2);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, exitCode: code, timedOut, output: out.slice(-TAIL) });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, timedOut: false, output: String(e) });
    });
  });

export interface Check {
  cwd: string;
  cmd: string;
  args: (arg?: string) => string[];
  timeoutMs: number;
  describe: string;
}

/** The checks an agent may run. Anything else is not available, whatever it asks. */
export const CHECKS: Record<string, Check> = {
  'api-tests': {
    cwd: 'apps/api',
    cmd: 'php',
    args: (filter) => ['artisan', 'test', '--compact', ...(filter ? ['--filter', filter] : [])],
    timeoutMs: 180_000,
    describe: 'Pest tests of the Laravel API, optionally filtered by test name',
  },
  'golden-master': {
    cwd: 'apps/api',
    cmd: 'php',
    args: () => ['artisan', 'leasing:golden-master', '--verify'],
    timeoutMs: 120_000,
    describe: 'Verify the rate calculator against the recorded legacy quotes',
  },
  'api-static-analysis': {
    cwd: 'apps/api',
    cmd: 'php',
    args: () => ['vendor/bin/phpstan', 'analyse', '--no-progress', '--memory-limit=1G'],
    timeoutMs: 180_000,
    describe: 'Larastan (PHPStan level 8) on the API',
  },
  'reviewer-tests': {
    cwd: 'packages/reviewer',
    cmd: 'npx',
    args: (filter) => ['vitest', 'run', ...(filter ? ['-t', filter] : [])],
    timeoutMs: 120_000,
    describe: 'Tests of the AI reviewer, optionally filtered by test name',
  },
  review: {
    cwd: '.',
    cmd: 'npx',
    args: (base) => ['tsx', 'packages/reviewer/src/cli.ts', base ?? 'origin/main'],
    timeoutMs: 120_000,
    describe: 'Run the team reviewer on your local changes against a base ref (default origin/main)',
  },
};
