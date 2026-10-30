# Playbook: AI pull-request review

The group already reviews pull requests with AI. The question is not whether the model finds
things; it is what it misses, how much noise it adds, and whether guardrails help. This reviewer
(`packages/reviewer`) was measured once on 24 pull requests written blind: 18 with one planted
defect, 6 clean (`benchmarks/review/results/first_run.json`).

## Results of the first run

| Mode | Defects caught | Precision | Comments on clean PRs |
| --- | --- | --- | --- |
| Team rules only | 3 of 18 | 75% | 0 |
| Model only, no guardrails | 17 of 18 | 89.5% | 0 |
| Model only, guardrails | 16 of 18 | 88.9% | 0 |
| Rules + model, guardrails (shipped) | 16 of 18 | 84.2% | 0 |

## What the results say

- **The model does the catching.** The team rules are fast and free, but they caught only 3 of the
  18 planted defects. Most defects were logic, rounding, ownership and cache mistakes that no regex
  sees.
- **The guardrails did not pay on this set.** They require a comment to cite and quote a changed
  line, and they dedupe, cap and filter by confidence. Here they removed one true finding and no
  noise, because this model made no comments on clean PRs. Guardrails exist for the weeks a model
  is noisy or misquotes lines, and this run does not show they are needed. The next blind set, and
  a cheaper model, will show whether they earn their place.
- **Rules add a little noise.** The rules + model mode loses precision to one rule comment that
  caught nothing.

## How the team uses it

- Every pull request gets a COMMENT review (`.github/workflows/ai-review.yml`). It never approves.
- Rule comments name their rule; model comments say so. A person decides.
- Pricing, authorisation and migrations always get a human reviewer who knows the domain.
- When the reviewer misses a defect or adds noise in real use, the case goes into the next blind
  set via `WRITING_PRS.md`, written by someone who has not seen the reviewer, never into the
  current set.

## Caveats

- The planted defects and the reviewing model are from the same model family.
- 18 defects is a small set: one more catch moves recall by 5.6 points.
