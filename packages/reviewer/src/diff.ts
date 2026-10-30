// Parse a unified diff (git diff / GitHub's per-file patch) into what a reviewer needs: which lines of
// the new file were added, and which line ranges of the new file the diff shows at all. Comments may
// only point at those lines (GitHub rejects review comments outside the diff, and a comment on code
// the PR did not touch is noise).

export interface Hunk {
  newStart: number;
  newLines: number;
  oldStart: number;
  oldLines: number;
}

export interface FileDiff {
  path: string;
  oldPath: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: Hunk[];
  /** new-file line number -> added text */
  added: Map<number, string>;
  /** removed lines, with the new-file line they were removed before */
  removed: { beforeNewLine: number; text: string }[];
}

const FILE_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null;
  let newLine = 0;

  const start = (oldPath: string | null, path: string): FileDiff => {
    const f: FileDiff = { path, oldPath, status: 'modified', hunks: [], added: new Map(), removed: [] };
    files.push(f);
    return f;
  };

  for (const line of text.split('\n')) {
    const header = FILE_HEADER.exec(line);
    if (header) {
      file = start(header[1] ?? null, header[2] ?? '');
      continue;
    }
    if (!file && (line.startsWith('--- ') || line.startsWith('@@'))) {
      // A bare per-file patch (GitHub API) without a "diff --git" header.
      file = start(null, '');
    }
    if (!file) continue;
    if (line.startsWith('new file mode')) file.status = 'added';
    else if (line.startsWith('deleted file mode')) file.status = 'deleted';
    else if (line.startsWith('rename from ')) file.status = 'renamed';
    else if (line.startsWith('--- ')) {
      const p = line.slice(4).trim();
      if (p === '/dev/null') file.status = 'added';
      else if (!file.oldPath) file.oldPath = p.replace(/^a\//, '');
    } else if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      if (p === '/dev/null') file.status = 'deleted';
      else if (!file.path) file.path = p.replace(/^b\//, '');
    } else {
      const h = HUNK_HEADER.exec(line);
      if (h) {
        const hunk: Hunk = {
          oldStart: Number(h[1]),
          oldLines: h[2] === undefined ? 1 : Number(h[2]),
          newStart: Number(h[3]),
          newLines: h[4] === undefined ? 1 : Number(h[4]),
        };
        file.hunks.push(hunk);
        newLine = hunk.newStart;
      } else if (file.hunks.length) {
        if (line.startsWith('+')) {
          file.added.set(newLine, line.slice(1));
          newLine += 1;
        } else if (line.startsWith('-')) {
          file.removed.push({ beforeNewLine: newLine, text: line.slice(1) });
        } else if (line.startsWith(' ') || line === '') {
          newLine += 1;
        }
      }
    }
  }
  return files.filter((f) => f.path || f.oldPath);
}

/** Is a new-file line inside one of the hunks the diff shows? */
export function inDiff(file: FileDiff, line: number): boolean {
  return file.hunks.some((h) => line >= h.newStart && line < h.newStart + Math.max(h.newLines, 1));
}

/** The diff of one file rendered with new-file line numbers, the way the model sees it. */
export function numbered(file: FileDiff, after: string | null): string {
  const lines = (after ?? '').split('\n');
  const out: string[] = [`### ${file.path} (${file.status})`];
  for (const h of file.hunks) {
    out.push(`@@ new lines ${h.newStart}-${h.newStart + h.newLines - 1} @@`);
    const removedAt = new Map<number, string[]>();
    for (const r of file.removed) removedAt.set(r.beforeNewLine, [...(removedAt.get(r.beforeNewLine) ?? []), r.text]);
    for (let n = h.newStart; n < h.newStart + h.newLines; n++) {
      for (const r of removedAt.get(n) ?? []) out.push(`      - ${r}`);
      const mark = file.added.has(n) ? '+' : ' ';
      out.push(`${String(n).padStart(5)} ${mark} ${lines[n - 1] ?? file.added.get(n) ?? ''}`);
    }
  }
  return out.join('\n');
}
