import { readFileSync } from 'node:fs';
import { guard } from './guard.js';
import { buildRequest, parseAnswer } from './llm/prompt.js';
import type { ModelProvider } from './llm/provider.js';
import { runRules } from './rules/index.js';
import type { Finding, ReviewConfig, ReviewInput, ReviewResult } from './types.js';

export interface ReviewOptions {
  config: ReviewConfig;
  conventions: string;
  provider?: ModelProvider | null;
  /** turn the guardrails off, to measure what they are worth */
  unguarded?: boolean;
  rules?: boolean;
}

export async function review(input: ReviewInput, opts: ReviewOptions): Promise<ReviewResult> {
  const { findings: ruleFindings, notes } = opts.rules === false ? { findings: [], notes: [] } : runRules(input);
  let modelFindings: Finding[] = [];
  let calls = 0;
  if (opts.provider) {
    calls = 1;
    const answer = await opts.provider.complete(buildRequest(input, opts.conventions));
    const parsed = parseAnswer(answer);
    if (parsed.error) notes.push({ rule: 'model', category: 'model', message: `Model answer ignored: ${parsed.error}` });
    modelFindings = parsed.findings;
  }
  const model = opts.provider ? { provider: opts.provider.name, calls } : null;
  if (opts.unguarded) return { comments: [...ruleFindings, ...modelFindings], notes, dropped: [], model };
  const { comments, dropped } = guard(ruleFindings, modelFindings, input.files, opts.config);
  return { comments, notes, dropped, model };
}

export function loadConfig(path: string): ReviewConfig {
  const q = JSON.parse(readFileSync(path, 'utf8')).reviewer as { comment_must_cite_changed_line: boolean; max_comments_per_pr: number; min_confidence: number };
  return { commentMustCiteChangedLine: q.comment_must_cite_changed_line, maxComments: q.max_comments_per_pr, minConfidence: q.min_confidence };
}

/** The part of AGENTS.md the model is given: the conventions, not the tooling instructions. */
export function conventionsFrom(agentsMd: string): string {
  const start = agentsMd.indexOf('## Conventions');
  const end = agentsMd.indexOf('\n## ', start + 5);
  return start < 0 ? agentsMd : agentsMd.slice(start, end < 0 ? undefined : end);
}
