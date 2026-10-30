#!/usr/bin/env node
// PostToolUse check for Claude Code: after an agent edits a PHP file, lint it at once; after it edits
// domain code, remind it which gates apply. Exit 2 sends the message back to the agent.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let call;
try {
  call = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const path = String(call?.tool_input?.file_path ?? '');
if (!/^(Edit|Write|MultiEdit)$/.test(call?.tool_name ?? '') || !path.endsWith('.php')) process.exit(0);

const lint = spawnSync(process.env.PHP_BINARY ?? 'php', ['-l', path], { encoding: 'utf8' });
if (lint.error) process.exit(0); // no PHP here: nothing to check
if (lint.status !== 0) {
  process.stderr.write(`PHP syntax error after your edit:\n${(lint.stdout + lint.stderr).trim()}\n`);
  process.exit(2);
}
if (/apps\/api\/app\/Domain\//.test(path)) {
  process.stderr.write('You changed domain code: before you finish, run the golden master (run_check golden-master) and the API tests. The mutation score gate in CI applies to app/Domain.\n');
  process.exit(2);
}
process.exit(0);
