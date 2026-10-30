# Playbook: measuring what AI coding tools do to a team

The question every engineering leader is asked: did the tools make us faster, and at what cost? The
usual answer, a before/after chart from the teams that volunteered, is wrong in a predictable
direction. This playbook says how to roll out so the question can be answered, and how to answer it.
The numbers come from `experiments/adoption` (`reports/adoption/RESULTS.md`).

## The trap, in numbers

The experiment simulates a realistic organisation of 24 teams over 32 weeks:
- faster teams volunteer first;
- the whole organisation drifts faster every week;
- holidays hit everyone at once;
- rework rises until the paved road is in place;
- later teams benefit more because the playbook improves.

The truth is a +19% throughput gain. What each way of measuring reports:

| How it was measured | Throughput |
| --- | --- |
| Before vs after, adopters only | +33% |
| Adopters vs teams that never adopted | +63% |
| Two-way fixed effects regression | +13% |
| Staggered difference-in-differences (Callaway–Sant'Anna) | **+17%** (95% interval +10% to +28%) |

The first two answers are the ones that end up in slides, and both overstate the gain by 13 to 44
points.

## How to roll out

1. **Stagger on purpose.** Roll out in cohorts on dates you set (here weeks 8, 14 and 20). Keep a
   few teams on the old setup for the measurement window.
2. **Do not let only volunteers go first.** If you must, record it: the analysis then compares each
   cohort with teams that have not started yet.
3. **Measure from what the systems already record:** merged PRs per engineer, cycle time, and rework
   (reverted or hot-fixed within 14 days). No surveys in the numbers.
4. **Say the size of the effect you can detect before you start.** With 24 teams the interval is
   about ±9 points. A 5% effect will not show; do not promise to show it.

## Rework needs its own view

The single average for rework was useless: −3% against a true +17%, with an interval from −21% to
+20%. By phase, the estimate shows what happened and what to do:

| Phase | Estimate | Truth |
| --- | --- | --- |
| First weeks after adoption | +35% | +45% |
| After the paved road (review guardrails, conventions, hooks) | −17% | +5% |

**Rule:** judge rework per phase over longer windows, and roll out the paved road with the tools,
not after them.

## What goes into the decision memo

- Throughput and cycle time effects with their intervals, from the staggered comparison
- Rework by phase
- What the paved road changed (rules added, hooks, reviewer findings)
- What could not be measured, and why
