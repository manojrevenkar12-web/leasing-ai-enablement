// Team rules: fast, deterministic checks of the conventions in AGENTS.md. They run before the model
// and need no network. Each rule looks only at what the pull request changed.
import type { ChangedFile, Finding, Note, ReviewInput, Severity } from '../types.js';

export interface RuleResult {
  findings: Finding[];
  notes: Note[];
}

export interface Rule {
  id: string;
  category: string;
  describe: string;
  run(input: ReviewInput): RuleResult;
}

const PHP_APP = (p: string) => p.startsWith('apps/api/app/') && p.endsWith('.php');
const PHP_ANY = (p: string) => p.startsWith('apps/api/') && p.endsWith('.php');
const MIGRATION = (p: string) => p.startsWith('apps/api/database/migrations/');
const WEB_TS = (p: string) => p.startsWith('apps/web/') && /\.(ts|tsx)$/.test(p);

function addedLines(input: ReviewInput, match: (path: string) => boolean): { file: ChangedFile; line: number; text: string }[] {
  const out: { file: ChangedFile; line: number; text: string }[] = [];
  for (const f of input.files) {
    if (!match(f.diff.path) || f.diff.status === 'deleted') continue;
    for (const [line, text] of f.diff.added) out.push({ file: f, line, text });
  }
  return out;
}

const isComment = (t: string) => /^\s*(\/\/|\*|\/\*|#)/.test(t);

function finding(rule: Rule, file: string, line: number, text: string, severity: Severity, message: string): Finding {
  return { file, line, category: rule.category, severity, message, evidence: text.trim(), confidence: 1, source: 'rule', rule: rule.id };
}

/** Line-by-line rule over added lines. */
function lineRule(
  id: string,
  category: string,
  describe: string,
  match: (p: string) => boolean,
  test: (text: string, path: string) => boolean,
  severity: Severity,
  message: string,
): Rule {
  const rule: Rule = {
    id,
    category,
    describe,
    run(input) {
      const findings = addedLines(input, match)
        .filter(({ text, file }) => !isComment(text) && test(text, file.diff.path))
        .map(({ file, line, text }) => finding(rule, file.diff.path, line, text, severity, message));
      return { findings, notes: [] };
    },
  };
  return rule;
}

const MONEY_NAME = /(cents|price|rate|amount|down_?payment|eur|total)/i;

export const rules: Rule[] = [
  lineRule(
    'money-float',
    'money',
    'Money handled as a float outside the rate calculator',
    (p) => PHP_APP(p) && !p.endsWith('Domain/Leasing/RateCalculator.php'),
    (t) =>
      (/\(float\)|floatval\(|\bfloat\s+\$|:\s*float\b|'float'|"float"|'decimal:\d'/.test(t) && MONEY_NAME.test(t)) ||
      /\w*_cents\w*\s*\/\s*100(?!\d)/.test(t) ||
      /_cents\b[^;]*\*\s*1\.19|\*\s*1\.19[^;]*_cents/.test(t),
    'major',
    'Money is integer cents here (AGENTS.md): this turns it into a float outside RateCalculator, which is where rounding errors start. Keep cents, and convert only for display.',
  ),
  lineRule(
    'client-rate',
    'pricing-input',
    'A computed price field accepted from the client',
    PHP_APP,
    (t) =>
      /['"](monthly_rate_cents|leasing_factor|total_cost_factor|residual_value_cents)['"]/.test(t) &&
      !/prohibited|=>\s*\$(this|offer|quote)|->(monthly|leasing|total|residual)|'net'|toArray|resolve/.test(t) &&
      /\$fillable|=>\s*\[|request|input\(|validated|only\(/.test(t),
    'blocker',
    'Rates are computed by RateCalculator, never accepted from a client (AGENTS.md). Accepting this field lets a dealer publish a rate that does not follow from its terms.',
  ),
  {
    id: 'missing-authorization',
    category: 'authorization',
    describe: 'A controller writes to a model without an authorization check',
    run(input) {
      const findings: Finding[] = [];
      for (const f of input.files) {
        if (!f.diff.path.startsWith('apps/api/app/Http/Controllers/') || !f.after) continue;
        for (const m of methods(f.after)) {
          const touched = [...f.diff.added.keys()].some((l) => l >= m.start && l <= m.end);
          if (!touched) continue;
          const body = m.lines.join('\n');
          const writes = /\$(?!this\b)\w+->(update|delete|forceDelete|fill|save|restore)\(|::(destroy|whereKey)\(/.test(body);
          const checked = /authorize\(|Gate::|->can\(|->cannot\(|abort_unless\(\s*\$\w+->(dealer_id|user_id)|policy/i.test(body);
          const creates = /new\s+\w+\(|::create\(/.test(body) && !/->(update|delete)\(/.test(body);
          if (writes && !checked && !creates) {
            const idx = m.lines.findIndex((l) => /->(update|delete|forceDelete|fill|save|restore)\(|::destroy\(/.test(l));
            const line = m.start + Math.max(idx, 0);
            findings.push(
              finding(this, f.diff.path, line, m.lines[Math.max(idx, 0)] ?? '', 'blocker', 'This writes to a record without checking who owns it. Dealer writes go through OfferPolicy (Gate::forUser(...)->authorize), or one dealer can change another\'s offers.'),
            );
          }
        }
      }
      return { findings, notes: [] };
    },
  },
  lineRule(
    'raw-sql-interpolation',
    'sql-injection',
    'SQL built from strings with variables',
    PHP_ANY,
    (t) =>
      /(whereRaw|orWhereRaw|selectRaw|orderByRaw|havingRaw|groupByRaw|DB::raw|DB::select|DB::statement|DB::unprepared)\s*\(/.test(t) &&
      (/\(\s*"[^"]*\$\w/.test(t) || /\(\s*"[^"]*\{\$/.test(t) || /['"]\s*\.\s*\$\w|\$\w+\s*\.\s*['"]/.test(t)),
    'blocker',
    'This builds SQL from a string with a variable in it. Bind the value instead (whereRaw("lower(x) = ?", [$value])); otherwise input reaches the database as SQL.',
  ),
  {
    id: 'eager-loading-removed',
    category: 'n-plus-one',
    describe: 'Eager loading removed, or a query inside a loop',
    run(input) {
      const findings: Finding[] = [];
      for (const f of input.files) {
        if (!PHP_APP(f.diff.path) || !f.after) continue;
        const removedWith = f.diff.removed.filter((r) => /->(with|load|loadMissing)\(/.test(r.text) && !isComment(r.text));
        for (const r of removedWith) {
          const nearAdded = [...f.diff.added.entries()].filter(([l]) => Math.abs(l - r.beforeNewLine) <= 3);
          if (!nearAdded.some(([, t]) => /->(with|load|loadMissing)\(/.test(t))) {
            const [line, text] = nearAdded[0] ?? [r.beforeNewLine, ''];
            findings.push(finding(this, f.diff.path, line, text, 'major', `Eager loading was removed here (\`${r.text.trim()}\`). Offers are rendered with their vehicle and dealer, so every row now costs extra queries (N+1); lazy loading throws outside production.`));
          }
        }
        const lines = f.after.split('\n');
        let loopDepth = 0;
        let braces = 0;
        lines.forEach((text, i) => {
          if (/^\s*(foreach|for|while)\s*\(/.test(text) || /->(each|map|filter)\(\s*(static\s+)?(fn|function)/.test(text)) loopDepth = braces + 1;
          braces += (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length;
          if (loopDepth && braces < loopDepth && !/^\s*(foreach|for|while)/.test(text)) loopDepth = 0;
          const n = i + 1;
          if (loopDepth && f.diff.added.has(n) && /(::query\(\)|::where\(|::find\(|->first\(\)|->get\(\)|->count\(\))/.test(text) && !isComment(text)) {
            findings.push(finding(this, f.diff.path, n, text, 'major', 'A query inside a loop runs once per item. Load what the loop needs before it (with(), whereIn(), or a keyed collection).'));
          }
        });
      }
      return { findings, notes: [] };
    },
  },
  {
    id: 'destructive-migration',
    category: 'migration',
    describe: 'A migration drops or renames on a live table',
    run(input) {
      const findings: Finding[] = [];
      for (const f of input.files) {
        if (!MIGRATION(f.diff.path) || !f.after) continue;
        const downAt = f.after.split('\n').findIndex((l) => /function\s+down\s*\(/.test(l)) + 1 || Number.POSITIVE_INFINITY;
        for (const [line, text] of f.diff.added) {
          if (line < downAt && /(dropColumn|renameColumn|dropIfExists|Schema::drop\(|Schema::rename\(|->change\(\)|dropForeign|dropIndex)/.test(text) && !isComment(text)) {
            findings.push(finding(this, f.diff.path, line, text, 'blocker', 'This drops or renames on a live table in the same release. Old app servers keep using it during the deploy. Expand-then-contract (AGENTS.md): add, backfill, switch reads, and drop in a later release.'));
          }
        }
      }
      return { findings, notes: [] };
    },
  },
  lineRule(
    'pii-in-logs',
    'logging',
    'Tokens, request bodies or personal data in a log line',
    PHP_ANY,
    (t) =>
      /(Log::|logger\(|->(info|warning|error|debug|notice|critical)\()/.test(t) &&
      /(\$request->(all|input|post|json|getContent|bearerToken|header)\(|bearerToken|password|api_token|token\b|email|->toArray\(\)|\$request\b(?!->route))/.test(t),
    'major',
    'Logs must not contain tokens, request bodies, names or emails (AGENTS.md). Log ids, counts and timings; the request id links a log line to everything else.',
  ),
  {
    id: 'filter-missing-from-cache-key',
    category: 'cache-key',
    describe: 'A search filter that is validated but not part of the cache key',
    run(input) {
      const findings: Finding[] = [];
      for (const f of input.files) {
        if (!f.diff.path.endsWith('SearchOffersRequest.php') || !f.after) continue;
        const rulesBody = section(f.after, /function\s+rules\s*\(/);
        const filtersBody = section(f.after, /function\s+filters\s*\(/);
        if (!rulesBody || !filtersBody) continue;
        const ruleKeys = [...rulesBody.text.matchAll(/^\s*'(\w+)'\s*=>/gm)].map((m) => m[1]);
        const filterKeys = new Set([...filtersBody.text.matchAll(/'(\w+)'\s*=>/g)].map((m) => m[1]));
        for (const key of ruleKeys) {
          if (!key || filterKeys.has(key)) continue;
          const line = rulesBody.start + rulesBody.text.split('\n').findIndex((l) => l.includes(`'${key}'`));
          if (!f.diff.added.has(line)) continue;
          findings.push(finding(this, f.diff.path, line, f.after.split('\n')[line - 1] ?? '', 'blocker', `'${key}' is validated but not returned by filters(), which is what the cache key is built from. Two searches that differ only in '${key}' will share one cached result.`));
        }
      }
      return { findings, notes: [] };
    },
  },
  lineRule(
    'literal-cache-key',
    'cache-key',
    'A cache key that does not depend on the request',
    PHP_APP,
    (t) => /(Cache::|->)(remember|rememberForever|get|put|forever)\(\s*['"][^'"$]*['"]\s*,/.test(t) && !/catalog-version|offers:catalog/.test(t),
    'major',
    'This cache key is a fixed string, so every request shares one entry whatever its parameters. Build it with OfferCatalog::key() from all the inputs that change the result.',
  ),
  {
    id: 'swallowed-error',
    category: 'error-handling',
    describe: 'An exception caught and turned into success',
    run(input) {
      const findings: Finding[] = [];
      for (const f of input.files) {
        if (!PHP_ANY(f.diff.path) || !f.after) continue;
        const lines = f.after.split('\n');
        lines.forEach((text, i) => {
          const n = i + 1;
          if (!f.diff.added.has(n) || !/\bcatch\s*\(/.test(text)) return;
          const block: string[] = [];
          let depth = 0;
          for (let j = i; j < Math.min(lines.length, i + 12); j++) {
            const l = lines[j] ?? '';
            depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
            block.push(l);
            if (j > i && depth <= 0) break;
          }
          const body = block.join('\n');
          if (!/throw|report\(|Log::|logger\(|abort\(|->json\([^)]*,\s*[45]\d\d|Response::HTTP_(UNPROCESS|BAD|INTERNAL|NOT_FOUND|CONFLICT)/.test(body)) {
            findings.push(finding(this, f.diff.path, n, text, 'major', 'This catches the exception and carries on as if nothing failed: the caller gets a success and nobody is told. Rethrow, report it, or answer with an error status.'));
          }
        });
      }
      return { findings, notes: [] };
    },
  },
  lineRule('no-dangerous-html', 'security', 'dangerouslySetInnerHTML in the web app', WEB_TS, (t) => /dangerouslySetInnerHTML/.test(t), 'blocker', 'No dangerouslySetInnerHTML (AGENTS.md): render text, or sanitise in one shared component.'),
  lineRule('no-any', 'types', '`any` in TypeScript', WEB_TS, (t) => /(:\s*any\b|as\s+any\b|<any>)/.test(t), 'minor', 'No `any` (AGENTS.md): type it, or use `unknown` and narrow.'),
  lineRule(
    'secret-in-code',
    'security',
    'A credential committed in code',
    () => true,
    (t) => /(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,})/.test(t),
    'blocker',
    'This looks like a real credential. Remove it, rotate it, and read it from the environment.',
  ),
  {
    id: 'pricing-behaviour',
    category: 'pricing-behaviour',
    describe: 'Pricing behaviour or its recorded reference changed',
    run(input) {
      const notes: Note[] = [];
      const findings: Finding[] = [];
      for (const f of input.files) {
        const p = f.diff.path;
        if (p.endsWith('tests/GoldenMaster/legacy-quotes.json') || p.startsWith('apps/api/legacy/')) {
          const [line, text] = [...f.diff.added.entries()][0] ?? [1, ''];
          findings.push(finding(this, p, line, text, 'blocker', 'This changes the recorded behaviour of the legacy calculator. The golden master is never re-recorded to make a test pass; a behaviour change is an entry in approved-changes.json with the pricing owner\'s sign-off.'));
        }
        if (p.endsWith('config/leasing.php') || p.endsWith('tests/GoldenMaster/approved-changes.json')) {
          notes.push({ rule: this.id, category: this.category, message: `${p} changed: this is a pricing decision. Link the pricing owner's sign-off in the PR description.` });
        }
      }
      return { findings, notes };
    },
  },
  {
    id: 'tests-not-changed',
    category: 'tests',
    describe: 'Application code changed without a test',
    run(input) {
      const app = input.files.filter((f) => PHP_APP(f.diff.path));
      const tests = input.files.filter((f) => f.diff.path.startsWith('apps/api/tests/'));
      return {
        findings: [],
        notes: app.length && !tests.length ? [{ rule: this.id, category: this.category, message: 'Application code changed but no test did. A change to app/ comes with a test that fails without it (AGENTS.md).' }] : [],
      };
    },
  },
];

export function runRules(input: ReviewInput, only?: string[]): RuleResult {
  const findings: Finding[] = [];
  const notes: Note[] = [];
  for (const r of rules) {
    if (only && !only.includes(r.id)) continue;
    const res = r.run(input);
    findings.push(...res.findings);
    notes.push(...res.notes);
  }
  return { findings, notes };
}

// --- small PHP structure helpers ------------------------------------------------------------------

interface Method {
  name: string;
  start: number;
  end: number;
  lines: string[];
}

/** Top-level methods of a PHP class, by brace matching (good enough for reviewing diffs). */
export function methods(php: string): Method[] {
  const lines = php.split('\n');
  const out: Method[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(public|protected|private)?\s*(static\s+)?function\s+(\w+)\s*\(/.exec(lines[i] ?? '');
    if (!m) continue;
    let depth = 0;
    let opened = false;
    let j = i;
    for (; j < lines.length; j++) {
      const l = lines[j] ?? '';
      for (const ch of l) {
        if (ch === '{') {
          depth++;
          opened = true;
        } else if (ch === '}') depth--;
      }
      if (opened && depth <= 0) break;
      if (!opened && /;\s*$/.test(l)) break; // abstract / interface method
    }
    out.push({ name: m[3] ?? '', start: i + 1, end: j + 1, lines: lines.slice(i, j + 1) });
    i = j;
  }
  return out;
}

function section(php: string, header: RegExp): { start: number; text: string } | null {
  const m = methods(php).find((x) => header.test(x.lines[0] ?? ''));
  return m ? { start: m.start, text: m.lines.join('\n') } : null;
}
