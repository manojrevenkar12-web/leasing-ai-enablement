// Read a pull request from GitHub and post the review back. The reviewer only ever posts a COMMENT
// review: it never approves and never requests changes; people decide.
import { parseDiff } from './diff.js';
import type { ChangedFile, Finding, Note, ReviewInput } from './types.js';

type Fetch = typeof fetch;

export interface PullRef {
  owner: string;
  repo: string;
  number: number;
}

export class GitHub {
  constructor(
    private token: string,
    private api = 'https://api.github.com',
    private http: Fetch = fetch,
  ) {}

  private async get<T>(path: string, accept = 'application/vnd.github+json'): Promise<T> {
    const res = await this.http(`${this.api}${path}`, { headers: { authorization: `Bearer ${this.token}`, accept, 'x-github-api-version': '2022-11-28' } });
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
    return (accept.includes('raw') ? await res.text() : await res.json()) as T;
  }

  async pullRequest(pr: PullRef): Promise<{ input: ReviewInput; headSha: string }> {
    const base = `/repos/${pr.owner}/${pr.repo}`;
    const meta = await this.get<{ title: string; body: string | null; head: { sha: string } }>(`${base}/pulls/${pr.number}`);
    const files: { filename: string; status: string; patch?: string; previous_filename?: string }[] = [];
    for (let page = 1; ; page++) {
      const batch = await this.get<typeof files>(`${base}/pulls/${pr.number}/files?per_page=100&page=${page}`);
      files.push(...batch);
      if (batch.length < 100) break;
    }
    const changed: ChangedFile[] = [];
    for (const f of files) {
      if (!f.patch) continue; // binary or too large: nothing to review line by line
      const old = f.previous_filename ?? f.filename;
      const [diff] = parseDiff(`diff --git a/${old} b/${f.filename}\n--- a/${old}\n+++ b/${f.filename}\n${f.patch}`);
      if (!diff) continue;
      if (f.status === 'added') diff.status = 'added';
      if (f.status === 'removed') diff.status = 'deleted';
      const after = f.status === 'removed' ? null : await this.get<string>(`${base}/contents/${encodeURI(f.filename)}?ref=${meta.head.sha}`, 'application/vnd.github.raw+json');
      changed.push({ diff, after });
    }
    return { input: { title: meta.title, description: meta.body ?? '', files: changed }, headSha: meta.head.sha };
  }

  async postReview(pr: PullRef, headSha: string, comments: Finding[], notes: Note[], summary: string): Promise<void> {
    const body = [summary, ...notes.map((n) => `- ${n.message}`)].join('\n');
    const res = await this.http(`${this.api}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({
        commit_id: headSha,
        event: 'COMMENT',
        body,
        comments: comments.map((c) => ({ path: c.file, line: c.line, side: 'RIGHT', body: renderComment(c) })),
      }),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} posting the review: ${await res.text()}`);
  }
}

export function renderComment(c: Finding): string {
  const who = c.source === 'rule' ? `rule \`${c.rule}\`` : 'model';
  return `**${c.severity}** · ${c.category} · ${who}\n\n${c.message}`;
}

export function summarise(comments: Finding[], dropped: number, model: string | null): string {
  const n = (s: string) => comments.filter((c) => c.severity === s).length;
  return [
    `AI review: ${comments.length} comment(s): ${n('blocker')} blocker, ${n('major')} major, ${n('minor')} minor.`,
    model ? `Model: ${model}. ${dropped} model comment(s) removed by the guardrails (not on a changed line, misquoted, duplicate, low confidence or over the limit).` : 'Team rules only (no model configured).',
    'This review only comments; a person approves.',
  ].join(' ');
}
