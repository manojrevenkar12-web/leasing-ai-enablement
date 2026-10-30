"""A simulated engineering organisation that rolls out AI coding tools team by team.

Writes what the organisation would actually record (merged pull requests per team and week, their
cycle times, and which were reworked: reverted or hot-fixed within 14 days, plus the rollout
date of each team) to data/observed/, and the true effects to data/truth/. Only this module and
evaluate.py read world.json or data/truth; the analysis never does.

The world is built so that the easy analyses go wrong in the ways they go wrong in real
organisations:
- faster teams volunteer first (selection),
- the whole org speeds up a little every week (trend),
- holidays cut output for everyone at once (a shock that lands after some teams adopted),
- the tools raise rework until the paved road (review guardrails, conventions, hooks) is in place,
- later cohorts get more out of the tools because the playbook has improved (heterogeneity across
  cohorts, which biases two-way fixed effects).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Team:
    name: str
    engineers: int
    base_rate: float
    base_cycle: float
    base_rework: float
    adopt_week: int | None
    effect_scale: float


def build_teams(cfg: dict, world: dict, rng: np.random.Generator) -> list[Team]:
    n = cfg["teams"]
    lo, hi = cfg["engineers_per_team"]
    b = world["baseline"]
    rates = rng.uniform(*b["prs_per_engineer_week"], size=n)
    # Selection: the fastest teams adopt first, the slowest never.
    order = np.argsort(-rates)
    cohorts = cfg["rollout_weeks"]
    adopters = n - cfg["never_adopt"]
    per = int(np.ceil(adopters / len(cohorts)))
    adopt: dict[int, int | None] = {}
    for rank, idx in enumerate(order):
        adopt[int(idx)] = cohorts[min(rank // per, len(cohorts) - 1)] if rank < adopters else None
    eff = world["true_effects"]
    teams = []
    for i in range(n):
        week = adopt[i]
        cohort_index = cohorts.index(week) if week is not None else 0
        teams.append(
            Team(
                name=f"team-{i + 1:02d}",
                engineers=int(rng.integers(lo, hi + 1)),
                base_rate=float(rates[i]),
                base_cycle=float(rng.uniform(*b["cycle_time_hours_median"])),
                base_rework=float(rng.uniform(*b["rework_share"])),
                adopt_week=week,
                effect_scale=float(1 + eff["later_cohorts_effect_bonus"] * cohort_index + rng.normal(0, eff["team_heterogeneity_sd"])),
            )
        )
    return teams


def true_effects(team: Team, week: int, world: dict) -> tuple[float, float, float]:
    """(throughput multiplier, cycle-time multiplier, rework multiplier) caused by the tools."""
    if team.adopt_week is None or week < team.adopt_week:
        return 1.0, 1.0, 1.0
    e = world["true_effects"]
    since = week - team.adopt_week
    ramp = min(1.0, (since + 1) / e["throughput_ramp_weeks"])
    lift = e["throughput_lift"] * team.effect_scale * ramp
    cycle = 1 + e["cycle_time_change"] * team.effect_scale * ramp
    rework = 1 + (e["rework_lift_before_enablement"] if since < e["enablement_after_weeks"] else e["rework_lift_after_enablement"])
    return 1 + lift, cycle, rework


def simulate(cfg: dict, world: dict) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(cfg["seed"])
    teams = build_teams(cfg, world, rng)
    prs, truth = [], []
    pr_id = 0
    for week in range(1, cfg["weeks"] + 1):
        trend = (1 + world["org_trend_per_week"]) ** week
        holiday = world["holiday_throughput_factor"] if week in world["holiday_weeks"] else 1.0
        for t in teams:
            tp, cy, rw = true_effects(t, week, world)
            expected = t.engineers * t.base_rate * trend * holiday
            n = rng.poisson(expected * tp)
            for _ in range(n):
                pr_id += 1
                prs.append(
                    {
                        "pr": pr_id,
                        "team": t.name,
                        "week": week,
                        "cycle_time_hours": round(float(rng.lognormal(np.log(t.base_cycle * cy), 0.6)), 2),
                        "reworked": bool(rng.random() < min(0.95, t.base_rework * rw)),
                    }
                )
            truth.append(
                {
                    "team": t.name,
                    "week": week,
                    "adopt_week": t.adopt_week,
                    "throughput_effect": tp - 1,
                    "cycle_time_effect": cy - 1,
                    "rework_effect": rw - 1,
                    "counterfactual_prs_per_engineer": expected / t.engineers,
                }
            )
    rollout = pd.DataFrame([{"team": t.name, "engineers": t.engineers, "adopt_week": t.adopt_week} for t in teams])
    return pd.DataFrame(prs), rollout, pd.DataFrame(truth)


def main(out: Path = ROOT / "data") -> None:
    cfg = json.loads((ROOT / "config.json").read_text())
    world = json.loads((ROOT / "world.json").read_text())
    prs, rollout, truth = simulate(cfg, world)
    (out / "observed").mkdir(parents=True, exist_ok=True)
    (out / "truth").mkdir(parents=True, exist_ok=True)
    prs.to_csv(out / "observed/pull_requests.csv", index=False)
    rollout.to_csv(out / "observed/rollout.csv", index=False)
    truth.to_csv(out / "truth/effects.csv", index=False)
    print(f"{len(prs)} pull requests from {rollout.shape[0]} teams over {cfg['weeks']} weeks")


if __name__ == "__main__":
    main()
