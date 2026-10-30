#!/usr/bin/env node
// PreToolUse guard for Claude Code. Reads the tool call as JSON on stdin; exit 2 blocks it and the
// message on stderr goes back to the agent, so it can choose another way. Rules from AGENTS.md.
//
//   Edit/Write/MultiEdit: protected files (pricing reference, pricing config, quality gates, legacy
//   code, env files) and content that looks like a credential.
//   Bash: piping downloads into a shell, re-recording the golden master, destructive git and
//   database commands.
//
// A person can allow a protected edit for one session with LEASING_ALLOW_PROTECTED=1.
import { readFileSync } from 'node:fs';

const PROTECTED = [
  [/(^|\/)apps\/api\/legacy\//, 'legacy code is the reference the new calculator is checked against'],
  [/(^|\/)apps\/api\/tests\/GoldenMaster\/legacy-quotes\.json$/, 'the golden master is never re-recorded to make a test pass'],
  [/(^|\/)apps\/api\/tests\/GoldenMaster\/approved-changes\.json$/, 'an approved change needs the pricing owner\'s sign-off'],
  [/(^|\/)apps\/api\/config\/leasing\.php$/, 'pricing settings are a pricing decision, not a refactor'],
  [/(^|\/)config\/quality\.json$/, 'quality gates are changed by people, not by the code they gate'],
  [/(^|\/)\.env(\.|$)(?!example)/, 'environment files hold secrets'],
];

const SECRET = /(sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,})/;

const COMMANDS = [
  [/(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|fi)?sh\b/, 'never pipe a download into a shell; ask a person to install tools'],
  [/(iex|Invoke-Expression)\b.*(DownloadString|Invoke-WebRequest|iwr)/i, 'never run a downloaded script; ask a person to install tools'],
  [/leasing:golden-master\b.*--record/, 'the golden master is recorded once, from the legacy code, and never again'],
  [/git\s+push\b.*(--force\b|-f\b|--force-with-lease)/, 'no force pushes'],
  [/git\s+(reset\s+--hard|clean\s+-[a-z]*f)/, 'this throws work away; ask a person'],
  [/artisan\s+(migrate:(fresh|reset|rollback)|db:wipe)\b(?!.*--env=testing)/, 'destroys database data; tests use an in-memory database already'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.\s*$|\*)/, 'refusing a recursive delete of a whole tree'],
];

function decide(call) {
  const tool = call.tool_name ?? '';
  const input = call.tool_input ?? {};
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
    const path = String(input.file_path ?? input.notebook_path ?? '');
    if (process.env.LEASING_ALLOW_PROTECTED !== '1') {
      for (const [re, why] of PROTECTED) if (re.test(path)) return `${path} is protected: ${why}. If a person asked for exactly this change, they can allow it with LEASING_ALLOW_PROTECTED=1.`;
    }
    const content = [input.content, input.new_string, ...(input.edits ?? []).map((e) => e.new_string)].filter(Boolean).join('\n');
    if (SECRET.test(content)) return 'This content looks like a real credential. Read secrets from the environment; never write them into files.';
  }
  if (tool === 'Bash') {
    const cmd = String(input.command ?? '');
    for (const [re, why] of COMMANDS) if (re.test(cmd)) return `Blocked: ${why}.`;
  }
  return null;
}

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}
let call;
try {
  call = JSON.parse(raw);
} catch {
  process.exit(0); // not a tool call we understand: do not get in the way
}
const reason = decide(call);
if (reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}
process.exit(0);
