// Guardrails between the model and the pull request. A comment survives only if it points at a line
// this PR changed and quotes that line correctly, is not a duplicate of a rule finding, is confident
// enough, and fits in the comment budget. Everything dropped is kept with its reason, so the team can
// see what the guardrails removed.
import { inDiff } from './diff.js';
import type { ChangedFile, Dropped, Finding, ReviewConfig, Severity } from './types.js';

const RANK: Record<Severity, number> = { blocker: 0, major: 1, minor: 2 };
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function anchored(f: Finding, files: ChangedFile[], requireChangedLine: boolean): Dropped['reason'] | null {
  const file = files.find((c) => c.diff.path === f.file);
  if (!file || !file.after) return 'not-in-diff';
  if (requireChangedLine ? !file.diff.added.has(f.line) && !nearAdded(file, f.line) : !inDiff(file.diff, f.line)) return 'not-in-diff';
  const lines = file.after.split('\n');
  const evidence = norm(f.evidence);
  if (!evidence) return 'evidence-mismatch';
  // the quoted code must be on the cited line (or the one next to it: models miscount by one)
  for (const n of [f.line, f.line - 1, f.line + 1]) {
    const l = norm(lines[n - 1] ?? '');
    if (l && (l.includes(evidence) || (evidence.length > 12 && evidence.includes(l)))) {
      f.line = n;
      return null;
    }
  }
  return 'evidence-mismatch';
}

function nearAdded(file: ChangedFile, line: number): boolean {
  return file.diff.added.has(line - 1) || file.diff.added.has(line + 1);
}

export function guard(ruleFindings: Finding[], modelFindings: Finding[], files: ChangedFile[], config: ReviewConfig): { comments: Finding[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const kept: Finding[] = [...ruleFindings];

  for (const f of modelFindings) {
    const reason = anchored(f, files, config.commentMustCiteChangedLine);
    if (reason) {
      dropped.push({ finding: f, reason });
      continue;
    }
    if (f.confidence < config.minConfidence) {
      dropped.push({ finding: f, reason: 'low-confidence' });
      continue;
    }
    if (kept.some((k) => k.file === f.file && Math.abs(k.line - f.line) <= 2)) {
      dropped.push({ finding: f, reason: 'duplicate' });
      continue;
    }
    kept.push(f);
  }

  kept.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.confidence - a.confidence || a.file.localeCompare(b.file) || a.line - b.line);
  const comments = kept.slice(0, config.maxComments);
  for (const f of kept.slice(config.maxComments)) dropped.push({ finding: f, reason: 'over-limit' });
  return { comments, dropped };
}
