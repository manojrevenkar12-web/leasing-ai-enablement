#!/usr/bin/env node
// MCP server for coding agents working on this repository (Claude Code, Codex, Cursor, …). It gives
// them what a new team member would ask a colleague: what a leasing term means, which convention
// applies, which endpoints exist, and a safe way to run the team's checks.
import { join, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { conventions, lookup, read, routes, sections } from './knowledge.js';
import { CHECKS, type Runner, SAFE_ARG, spawnRunner } from './runner.js';

export function createServer(root: string, runner: Runner = spawnRunner): McpServer {
  const server = new McpServer({ name: 'leasing-codebase', version: '1.0.0' });
  const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

  server.registerTool(
    'leasing_glossary',
    {
      description: 'Explain a leasing term (English or German) the way this codebase uses it, e.g. "Leasingfaktor", "Sonderzahlung", "residual value".',
      inputSchema: { term: z.string().min(1).max(60) },
    },
    async ({ term }) => {
      const hits = lookup(sections(read(root, 'docs/glossary.md')), term);
      return text(hits.length ? hits.slice(0, 2).map((h) => `## ${h.title}\n${h.body}`).join('\n\n') : `No glossary entry for "${term}". Entries: ${sections(read(root, 'docs/glossary.md')).map((s) => s.title).join('; ')}`);
    },
  );

  server.registerTool(
    'team_conventions',
    {
      description: 'The team conventions from AGENTS.md (money, pricing, API, database, web, tests). Pass a topic such as "cache", "migration", "money" to get only the rules about it.',
      inputSchema: { topic: z.string().max(40).optional() },
    },
    async ({ topic }) => {
      const out = conventions(read(root, 'AGENTS.md'), topic);
      return text(out || `No convention mentions "${topic}".`);
    },
  );

  server.registerTool(
    'api_routes',
    {
      description: 'The leasing API endpoints: method, path, controller action, route name, middleware.',
      inputSchema: {},
    },
    async () => text(JSON.stringify(routes(read(root, 'apps/api/routes/api.php')), null, 2)),
  );

  server.registerTool(
    'run_check',
    {
      description: `Run one of the team's checks and get the result (last 4,000 characters of output). Checks: ${Object.entries(CHECKS)
        .map(([k, c]) => `${k} (${c.describe})`)
        .join('; ')}.`,
      inputSchema: {
        check: z.enum(Object.keys(CHECKS) as [string, ...string[]]),
        argument: z.string().regex(SAFE_ARG, 'letters, digits, spaces and . : \\ / - only').optional(),
      },
    },
    async ({ check, argument }) => {
      const c = CHECKS[check];
      if (!c) return { ...text(`Unknown check ${check}`), isError: true };
      const res = await runner(c.cmd, c.args(argument), join(root, c.cwd), c.timeoutMs);
      const head = res.timedOut ? `${check}: timed out` : `${check}: ${res.ok ? 'passed' : `failed (exit ${res.exitCode})`}`;
      return { ...text(`${head}\n\n${res.output}`), isError: !res.ok };
    },
  );

  server.registerResource(
    'agents-md',
    'leasing://agents.md',
    { description: 'AGENTS.md: fast feedback, conventions and rules for coding agents', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, text: read(root, 'AGENTS.md') }] }),
  );

  return server;
}

if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  const root = resolve(process.env.LEASING_REPO_ROOT ?? join(new URL('.', import.meta.url).pathname, '../../..'));
  await createServer(root).connect(new StdioServerTransport());
}
