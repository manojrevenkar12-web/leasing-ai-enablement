#!/usr/bin/env node
// reviewer <base> [head]   review local changes before pushing (rules, plus a model if a key is set)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderComment, summarise } from './github.js';
import { providerFromEnv } from './llm/provider.js';
import { localInput } from './local.js';
import { conventionsFrom, loadConfig, review } from './review.js';

const [base = 'origin/main', head] = process.argv.slice(2);
const root = resolve(process.env.REPO_ROOT ?? process.cwd());
const result = await review(localInput(root, base, head), {
  config: loadConfig(`${root}/config/quality.json`),
  conventions: conventionsFrom(readFileSync(`${root}/AGENTS.md`, 'utf8')),
  provider: providerFromEnv(),
});
for (const c of result.comments) console.log(`${c.file}:${c.line}\n${renderComment(c)}\n`);
for (const n of result.notes) console.log(`note: ${n.message}`);
console.log(summarise(result.comments, result.dropped.length, result.model?.provider ?? null));
process.exit(result.comments.some((c) => c.severity === 'blocker') ? 2 : 0);
