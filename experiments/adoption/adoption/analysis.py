"""Estimate what the AI tools did, from what the organisation records.

Reads only data/observed (pull requests, rollout dates); never the simulated truth.

Outcomes per team and week:
  throughput   merged pull requests per engineer
  rework       share of merged pull requests reverted or hot-fixed within 14 days
  cycle_time   median hours from first commit to merge (analysed in logs)

Estimators, from the one people reach for first to the one that holds up:
  before_after          adopters after vs before they adopted
  adopters_vs_rest      adopters vs teams that never adopted, after the rollout began
  twfe                  two-way fixed effects regression (team and week), one coefficient
  callaway_santanna     group-time effects against not-yet-treated and never-treated teams,
                        each relative to the week before the cohort adopted, then averaged
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUTCOMES = ("throughput", "rework", "cycle_time")


def panel(prs: pd.DataFrame, rollout: pd.DataFrame, weeks: int) -> pd.DataFrame:
    """One row per team and week, including weeks with no merged pull requests."""
    grid = pd.MultiIndex.from_product([rollout["team"], range(1, weeks + 1)], names=["team", "week"]).to_frame(index=False)
    agg = prs.groupby(["team", "week"]).agg(prs=("pr", "size"), reworked=("reworked", "sum"), cycle=("cycle_time_hours", "median")).reset_index()
    p = grid.merge(agg, on=["team", "week"], how="left").merge(rollout, on="team")
    p["prs"] = p["prs"].fillna(0)
    p["throughput"] = p["prs"] / p["engineers"]
    p["rework"] = np.where(p["prs"] > 0, p["reworked"].fillna(0) / p["prs"].clip(lower=1), np.nan)
    p["cycle_time"] = np.log(p["cycle"])
    p["treated"] = p["adopt_week"].notna() & (p["week"] >= p["adopt_week"].fillna(10**6))
    return p


def _num_den(p: pd.DataFrame, y: str) -> tuple[pd.Series, pd.Series]:
    """Numerator and denominator so that a group's value is sum(num) / sum(den): engineer-weighted
    throughput, rework as all reworked over all merged, cycle time weighted by pull requests."""
    if y == "throughput":
        return p["prs"], p["engineers"]
    if y == "rework":
        return p["reworked"].fillna(0), p["prs"]
    has = p["cycle_time"].notna()
    return (p["cycle_time"].fillna(0) * p["prs"]).where(has, 0), p["prs"].where(has, 0)


def value(p: pd.DataFrame, y: str) -> float:
    num, den = _num_den(p, y)
    return float(num.sum() / den.sum()) if den.sum() else float("nan")


@dataclass
class Estimate:
    """Effect relative to what the treated teams would have done without the tools."""

    relative: float
    level: float


def _relative(outcome: str, level: float, treated_mean: float) -> float:
    if outcome == "cycle_time":
        return float(np.exp(level) - 1)  # log scale: difference of logs
    counterfactual = treated_mean - level
    return float(level / counterfactual) if counterfactual else float("nan")


def before_after(p: pd.DataFrame, y: str) -> Estimate:
    a = p[p["adopt_week"].notna()]
    post, pre = value(a[a["treated"]], y), value(a[~a["treated"]], y)
    return Estimate(_relative(y, post - pre, post), post - pre)


def adopters_vs_rest(p: pd.DataFrame, y: str) -> Estimate:
    start = p["adopt_week"].min()
    later = p[p["week"] >= start]
    treated = value(later[later["treated"]], y)
    never = value(later[later["adopt_week"].isna()], y)
    return Estimate(_relative(y, treated - never, treated), treated - never)


def twfe(p: pd.DataFrame, y: str) -> Estimate:
    d = p.dropna(subset=[y])
    # Demean by team and week (balanced enough here; one iteration of alternating projections).
    yv, dv = d[y].astype(float).copy(), d["treated"].astype(float).copy()
    for _ in range(50):
        for key in ("team", "week"):
            yv -= yv.groupby(d[key]).transform("mean")
            dv -= dv.groupby(d[key]).transform("mean")
    beta = float((dv * yv).sum() / (dv * dv).sum())
    return Estimate(_relative(y, beta, d[d["treated"]][y].mean()), beta)


PRE_WEEKS = 4  # baseline: the last weeks before a cohort adopted, for treated and controls alike


def group_time(p: pd.DataFrame, y: str) -> pd.DataFrame:
    """ATT(g, t) for every cohort g and week t >= g. Controls are the teams not yet treated at t
    (never-treated included). Each group's change is measured from its own average over the
    PRE_WEEKS weeks before g, so a shock or trend that hits everyone cancels out."""
    num, den = _num_den(p, y)
    d = p.assign(_num=num, _den=den)
    tab_num = d.pivot_table(index="team", columns="week", values="_num", aggfunc="sum")
    tab_den = d.pivot_table(index="team", columns="week", values="_den", aggfunc="sum")
    adopt = p.drop_duplicates("team").set_index("team")["adopt_week"]
    pre_of = lambda teams, weeks: tab_num.loc[teams, weeks].to_numpy().sum() / tab_den.loc[teams, weeks].to_numpy().sum()  # noqa: E731
    rows = []
    for g in sorted(adopt.dropna().unique()):
        g = int(g)
        cohort = adopt[adopt == g].index
        base = [w for w in range(g - PRE_WEEKS, g) if w >= 1]
        for t in range(g, int(p["week"].max()) + 1):
            controls = adopt[adopt.isna() | (adopt > t)].index
            if len(controls) == 0 or not base:
                continue
            treated_t = pre_of(cohort, [t])
            att = (treated_t - pre_of(cohort, base)) - (pre_of(controls, [t]) - pre_of(controls, base))
            rows.append({"cohort": g, "week": t, "e": t - g, "att": att, "treated_mean": treated_t, "n": int(tab_den.loc[cohort, t].sum())})
    return pd.DataFrame(rows)


def callaway_santanna(p: pd.DataFrame, y: str) -> Estimate:
    gt = group_time(p, y).dropna(subset=["att"])
    level = float(np.average(gt["att"], weights=gt["n"]))
    return Estimate(_relative(y, level, float(np.average(gt["treated_mean"], weights=gt["n"]))), level)


def event_study(p: pd.DataFrame, y: str, max_e: int = 11) -> pd.DataFrame:
    gt = group_time(p, y).dropna(subset=["att"])
    gt = gt[gt["e"] <= max_e]
    out = gt.groupby("e").apply(lambda d: pd.Series({"att": np.average(d["att"], weights=d["n"]), "treated_mean": np.average(d["treated_mean"], weights=d["n"])}), include_groups=False).reset_index()
    out["relative"] = [_relative(y, a, m) for a, m in zip(out["att"], out["treated_mean"])]
    return out


ESTIMATORS = {
    "before_after": before_after,
    "adopters_vs_rest": adopters_vs_rest,
    "twfe": twfe,
    "callaway_santanna": callaway_santanna,
}


def bootstrap(p: pd.DataFrame, y: str, reps: int, seed: int) -> tuple[float, float]:
    """95% interval of the Callaway-Sant'Anna estimate, resampling whole teams."""
    rng = np.random.default_rng(seed)
    teams = p["team"].unique()
    vals = []
    for _ in range(reps):
        pick = rng.choice(teams, size=len(teams), replace=True)
        parts = [p[p["team"] == t].assign(team=f"{t}#{i}") for i, t in enumerate(pick)]
        s = pd.concat(parts, ignore_index=True)
        if s["adopt_week"].isna().all() or s["adopt_week"].notna().sum() == 0:
            continue
        try:
            vals.append(callaway_santanna(s, y).relative)
        except (ValueError, ZeroDivisionError, KeyError):
            continue
    lo, hi = np.nanpercentile(vals, [2.5, 97.5])
    return float(lo), float(hi)


def load(data: Path = ROOT / "data", weeks: int | None = None) -> pd.DataFrame:
    prs = pd.read_csv(data / "observed/pull_requests.csv")
    rollout = pd.read_csv(data / "observed/rollout.csv")
    return panel(prs, rollout, weeks or int(prs["week"].max()))
