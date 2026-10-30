# Playbook: refactoring legacy code with an AI agent

**Worked example:** `apps/api/legacy/rate_calc.php` (procedural PHP from 2017, globals, floats) was
replaced by `app/Domain/Leasing/RateCalculator.php`. An AI agent did the rewrite. The gate below
decided what merged.

## Why a gate

A coding agent rewrites a module in minutes and the result reads better than the original. It
cannot tell which of the old behaviours are bugs and which are promises to dealers who check the
numbers against their own spreadsheets. Review alone does not catch a rounding change in one cent
of 10,000 quotes. The gate does.

## The gate

1. **Record before touching anything.** `php artisan leasing:golden-master --record` ran the legacy
   code over 10,240 inputs: 4 segments, 4 terms, 5 mileages (including one the code does not
   support), 4 down payments, 8 prices, private and business, with and without one-off costs. It is
   recorded once. The Claude Code hook blocks `--record` afterwards.
2. **Refactor.** Keep the arithmetic order where results must match to the cent: the residual value
   is rounded first and the rate last, as before.
3. **Verify.** Every difference is a refactoring mistake (fix it), an old bug to keep (write it
   down), or an old bug to fix (an approved change).
4. **Mutation score.** `composer mutate` (Pest) must kill at least the share of mutants in
   `config/quality.json` (85%).

## What the first verify run found

| | Cases |
| --- | --- |
| Identical to the cent | 4,096 (every private quote with a supported mileage) |
| AC-1: business factors compared net rate to gross price | 4,096 |
| AC-2: an unsupported mileage was silently priced as 10,000 km | 2,048 |
| Unapproved | 0 |

Both findings were real bugs, invisible in review:
- **AC-1:** business offers ranked 19% cheaper than they were.
- **AC-2:** a "TODO other km" priced 25,000 km/year like 10,000.

### Sign-off record

| Change | Decision | Owner |
| --- | --- | --- |
| AC-1 | Fix: net rate against net price; rates unchanged | Pricing owner |
| AC-2 | Fix: reject unsupported mileage; the API never offered it | Pricing owner |

(In this repository the owner is a role, recorded here as the process requires. In a real team it
is a named person and a link to the decision.)

## What mutation testing found that the golden master missed

The first mutation run scored 93.6%. Two surviving mutants multiplied business one-off costs by
VAT instead of dividing. The golden master passed them because **AC-1 allowed any difference** in the
business factor fields.

The fix is in the process, not in the tests:
- An approval now names the exact result it expects (`"expect": "net-basis"`), and verify checks it.
- With that, the score is 100%.
- Two remaining mutants are equivalent (a cast PHP applies anyway). They are marked in the code
  with the reason, not hidden.

**Rule:** an approval that says "these fields may differ" is a blind spot. Approve the new value,
not the difference.

## Checklist for the next AI refactor

- [ ] Inputs recorded from the old code, including the inputs you believe are invalid
- [ ] Fixture committed before the first line of the refactor
- [ ] Every difference classified; approvals name expected values and an owner
- [ ] Mutation score at or above the gate; equivalent mutants marked with a reason
- [ ] PR lists each approved change and how many cases it explains
