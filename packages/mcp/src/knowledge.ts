// What the server knows about the codebase, read from files in the repository, so it never drifts
// from them: AGENTS.md, the glossary, the API routes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Section {
  title: string;
  body: string;
}

/** Split markdown into "## " sections. */
export function sections(md: string): Section[] {
  const out: Section[] = [];
  for (const block of md.split(/^## /m).slice(1)) {
    const [title = '', ...rest] = block.split('\n');
    out.push({ title: title.trim(), body: rest.join('\n').trim() });
  }
  return out;
}

const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);

/** Glossary entries matching a term in English or German, best match first. */
export function lookup(glossary: Section[], term: string): Section[] {
  const q = words(term);
  if (!q.length) return [];
  return glossary
    .map((s) => {
      const t = words(s.title);
      const b = words(s.body);
      const score = q.reduce((n, w) => n + (t.some((x) => x.startsWith(w)) ? 3 : 0) + (b.includes(w) ? 1 : 0), 0);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/** Bullet points of the AGENTS.md conventions that mention a topic, with their heading. */
export function conventions(agentsMd: string, topic?: string): string {
  const conv = sections(agentsMd).find((s) => s.title.startsWith('Conventions'));
  if (!conv) return '';
  if (!topic) return conv.body;
  const q = words(topic);
  const out: string[] = [];
  let heading = '';
  let bullet: string[] = [];
  const flush = () => {
    const text = bullet.join(' ');
    if (text && q.some((w) => words(text).some((x) => x.startsWith(w)) || words(heading).includes(w))) out.push(`${heading ? `${heading}: ` : ''}${text}`);
    bullet = [];
  };
  for (const line of conv.body.split('\n')) {
    const h = /^\*\*(.+)\*\*$/.exec(line.trim());
    if (h) {
      flush();
      heading = h[1] ?? '';
    } else if (line.startsWith('- ')) {
      flush();
      bullet = [line.slice(2).trim()];
    } else if (line.trim() && bullet.length) bullet.push(line.trim());
  }
  flush();
  return out.join('\n');
}

export interface Route {
  method: string;
  path: string;
  action: string;
  name: string | null;
  middleware: string[];
}

/** The API routes, read statically from routes/api.php (no PHP needed). */
export function routes(php: string): Route[] {
  const out: Route[] = [];
  let prefix = '';
  let groupMiddleware: string[] = [];
  // one statement per entry: a route call may span several lines
  const statements = php.replace(/\s*\n\s*->/g, '->').split('\n');
  for (const line of statements) {
    const group = /Route::prefix\('([^']+)'\)(?:->middleware\(\[([^\]]*)\]\))?->group/.exec(line);
    if (group) {
      prefix = `/${group[1]}`;
      groupMiddleware = (group[2] ?? '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
      continue;
    }
    if (/^\}\);/.test(line.trim())) {
      prefix = '';
      groupMiddleware = [];
      continue;
    }
    const r = /Route::(get|post|put|patch|delete)\('([^']+)',\s*(\[[^\]]+\]|[\w\\]+::class)/.exec(line);
    if (!r) continue;
    const action = (r[3] ?? '').replace(/[[\]]/g, '').replace(/::class,\s*'/, '@').replace(/::class/, '').replace(/'/g, '');
    out.push({
      method: (r[1] ?? '').toUpperCase(),
      path: `/api${prefix}${r[2] === '/' ? '' : r[2]}`,
      action,
      name: /->name\('([^']+)'\)/.exec(line)?.[1] ?? null,
      middleware: [...groupMiddleware, ...((/->middleware\('([^']+)'\)/.exec(line)?.[1] ?? '') ? [/->middleware\('([^']+)'\)/.exec(line)?.[1] ?? ''] : [])],
    });
  }
  return out;
}

export const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');
