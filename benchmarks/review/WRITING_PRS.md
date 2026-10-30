# Writing a held-out set of pull requests for the reviewer

The AI reviewer is measured on pull requests it has never seen, written by someone who has not seen
the reviewer. Write them from this guide, `AGENTS.md` and the code in `apps/api` only. Do not open
`packages/reviewer`, `benchmarks/review/results` or any prompt or cassette files.

## What a case is

A realistic pull request against `apps/api` at the base commit named in your task: one to three
files changed, the kind of change a developer on a leasing marketplace makes in a normal week (a
new filter, a new field, a fix, a small refactor, a new endpoint, a migration).

- **Defect cases** contain exactly one real defect a careful senior reviewer should flag. The rest
  of the change is good and plausible. Hide the defect the way it happens in real life: inside a
  useful change, not as an obviously broken line.
- **Clean cases** are good changes with no defect. A reviewer that comments on them is adding noise.

Defects come from the conventions in `AGENTS.md` and from ordinary bugs. Spread them; do not use any
kind more than three times:

- money as floats, a rate or factor accepted from the client, net/gross mix-ups
- a write without the ownership check, an endpoint that leaks a dealer's data
- an N+1 query (a relation used without eager loading), a query in a loop
- SQL built from strings with user input
- a cache key that misses a filter, so two different searches share a result
- validation that silently defaults or accepts values it should reject
- a destructive migration (drop or rename on a live table in the same release)
- a token, request body, name or email in a log line
- a behaviour change in pricing without a test or an approved change
- off-by-one, wrong comparison, wrong rounding, wrong sort direction, inverted condition
- an error swallowed so the client sees success

## Format

For each case `cases/<id>/` (ids `P-01`, `P-02`, …):

- `after/<path>` — the full new content of every file the PR changes or adds, at the same path as in
  the repository (e.g. `after/apps/api/app/Http/Controllers/QuoteController.php`).
- `meta.json`:

```json
{
  "id": "P-01",
  "title": "Add fuel filter to the makes list",
  "description": "What the PR description would say, written by its author (no hint of the defect).",
  "kind": "defect",
  "defects": [
    { "file": "apps/api/app/Http/Controllers/OfferSearchController.php", "line": 57,
      "category": "cache-key", "explanation": "one or two sentences" }
  ]
}
```

`line` is the line number in the **after** file where the defect is (the line a reviewer should
comment on). Clean cases have `"kind": "clean"` and `"defects": []`.

Write 24 cases: 18 defect cases and 6 clean cases. When done, write `STATUS` in this folder with the
single word `blind`.
