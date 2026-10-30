import { describe, expect, it } from 'vitest';
import { inDiff, numbered, parseDiff } from '../src/diff.js';

const GIT = `diff --git a/app/A.php b/app/A.php
index 111..222 100644
--- a/app/A.php
+++ b/app/A.php
@@ -1,5 +1,6 @@
 <?php
-$a = 1;
+$a = 2;
+$b = 3;
 $c = 4;
 $d = 5;
 $e = 6;
@@ -20,2 +21,3 @@ function x()
 $y = 1;
+$z = 2;
 $w = 3;
diff --git a/web/new.ts b/web/new.ts
new file mode 100644
--- /dev/null
+++ b/web/new.ts
@@ -0,0 +1,2 @@
+export const a = 1;
+export const b = 2;
diff --git a/old.txt b/old.txt
deleted file mode 100644
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-gone
`;

describe('parseDiff', () => {
  const [a, n, d] = parseDiff(GIT);

  it('finds every file and its status', () => {
    expect([a?.path, n?.path, d?.path]).toEqual(['app/A.php', 'web/new.ts', 'old.txt']);
    expect([a?.status, n?.status, d?.status]).toEqual(['modified', 'added', 'deleted']);
  });

  it('numbers added lines as in the new file', () => {
    expect([...(a?.added.entries() ?? [])]).toEqual([
      [2, '$a = 2;'],
      [3, '$b = 3;'],
      [22, '$z = 2;'],
    ]);
    expect(a?.removed).toEqual([{ beforeNewLine: 2, text: '$a = 1;' }]);
    expect([...(n?.added.keys() ?? [])]).toEqual([1, 2]);
  });

  it('knows which lines the diff shows', () => {
    if (!a) throw new Error();
    expect([1, 6, 21, 23].map((l) => inDiff(a, l))).toEqual([true, true, true, true]);
    expect([7, 20, 24].map((l) => inDiff(a, l))).toEqual([false, false, false]);
  });

  it('parses a bare per-file patch as GitHub sends it', () => {
    const [f] = parseDiff('--- a/x.php\n+++ b/x.php\n@@ -3,2 +3,3 @@\n a\n+b\n c');
    expect(f?.path).toBe('x.php');
    expect([...(f?.added.entries() ?? [])]).toEqual([[4, 'b']]);
  });

  it('renders the diff with new line numbers and removed lines for the model', () => {
    const after = ['<?php', '$a = 2;', '$b = 3;', '$c = 4;', '$d = 5;', '$e = 6;'].join('\n');
    const out = numbered(parseDiff(GIT)[0] ?? (null as never), after);
    expect(out).toContain('    2 + $a = 2;');
    expect(out).toContain('      - $a = 1;');
    expect(out).toContain('    4   $c = 4;');
  });
});
