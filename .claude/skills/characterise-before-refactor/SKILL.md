---
name: characterise-before-refactor
description: Refactor legacy or pricing code safely behind a golden master and a mutation-score gate; use before any AI-assisted refactor of code whose behaviour must not change.
---

# Characterise, then refactor

An AI agent can rewrite a legacy module in minutes. What it cannot know is which of the old
behaviours are bugs and which are promises. Record first, then refactor, then let a person decide
every difference.

1. **Record** the old behaviour once, before touching it: a grid of inputs that covers every branch
   (see `GoldenMaster::GRID`), run through the old code, saved as a fixture. Include inputs you think
   are invalid: that is where the surprises are.
2. **Refactor** with the agent. Keep the arithmetic order where results must be identical to the cent.
3. **Verify**: `php artisan leasing:golden-master --verify`. Every difference is either:
   - a refactoring mistake: fix the code;
   - an old bug worth keeping: keep it, and write it down;
   - an old bug to fix: add an entry to `tests/GoldenMaster/approved-changes.json` with `when`,
     `allows` (exact fields or exception), `why`, and the owner's sign-off. Never widen an approval
     beyond what was found, and never re-record the fixture.
4. **Mutation score**: `composer mutate`. The tests must kill at least the share of mutants in
   `config/quality.json`. A refactor that passes the golden master with weak tests is not done.
5. The PR lists the approved changes and how many cases each explains.

The playbook with the worked example is `docs/playbooks/ai-refactoring.md`.
