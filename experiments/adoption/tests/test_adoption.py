import copy
import json
import re
from pathlib import Path

import pandas as pd
import pytest

from adoption import analysis, sim

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "config.json").read_text())
WORLD = json.loads((ROOT / "world.json").read_text())


def run(cfg=CFG, world=WORLD):
    prs, rollout, truth = sim.simulate(cfg, world)
    return analysis.panel(prs, rollout, cfg["weeks"]), truth


def treated_truth(truth: pd.DataFrame, col: str) -> float:
    t = truth[truth["adopt_week"].notna() & (truth["week"] >= truth["adopt_week"])]
    return float(t[col].mean())


def test_the_analysis_never_reads_the_simulated_truth():
    src = (ROOT / "adoption/analysis.py").read_text()
    assert not re.search(r"world\.json|data/truth|truth/|import sim|from adoption import sim", src)


def test_the_simulation_is_reproducible():
    a, _ = run()
    b, _ = run()
    pd.testing.assert_frame_equal(a, b)


def test_the_panel_keeps_weeks_without_merged_pull_requests():
    prs = pd.DataFrame([{"pr": 1, "team": "a", "week": 2, "cycle_time_hours": 10.0, "reworked": False}])
    rollout = pd.DataFrame([{"team": "a", "engineers": 5, "adopt_week": None}])
    p = analysis.panel(prs, rollout, 3)
    assert p["throughput"].tolist() == [0.0, 0.2, 0.0]


def test_faster_teams_adopt_first():
    _, truth = run()
    first = truth.drop_duplicates("team").set_index("team")
    rollout = first["adopt_week"]
    rate = first["counterfactual_prs_per_engineer"]
    assert rate[rollout == min(CFG["rollout_weeks"])].mean() > rate[rollout.isna()].mean()


def test_callaway_santanna_recovers_throughput_where_the_naive_estimates_do_not():
    p, truth = run()
    true = treated_truth(truth, "throughput_effect")
    cs = analysis.callaway_santanna(p, "throughput").relative
    naive = analysis.before_after(p, "throughput").relative
    vs_rest = analysis.adopters_vs_rest(p, "throughput").relative
    assert abs(cs - true) < 0.05
    assert naive - true > 0.08  # trend and selection inflate before/after
    assert vs_rest - true > 0.25  # selection inflates adopters vs the rest


def test_without_confounding_or_shocks_every_estimator_agrees_with_the_truth():
    world = copy.deepcopy(WORLD)
    world["org_trend_per_week"] = 0.0
    world["holiday_weeks"] = []
    world["true_effects"]["later_cohorts_effect_bonus"] = 0.0
    world["true_effects"]["team_heterogeneity_sd"] = 0.0
    world["true_effects"]["throughput_ramp_weeks"] = 1
    # A large organisation, so the test measures the estimator and not weekly noise (24 teams give
    # an interval of about plus or minus 9 points, see reports/adoption/RESULTS.md).
    big = {**CFG, "teams": 120, "never_adopt": 24}
    p, truth = run(cfg=big, world=world)
    true = treated_truth(truth, "throughput_effect")
    assert abs(analysis.callaway_santanna(p, "throughput").relative - true) < 0.05
    assert abs(analysis.twfe(p, "throughput").relative - true) < 0.05


def test_the_interval_covers_the_true_throughput_effect():
    p, truth = run()
    lo, hi = analysis.bootstrap(p, "throughput", reps=60, seed=1)
    assert lo < treated_truth(truth, "throughput_effect") < hi


def test_rework_rises_first_and_falls_once_the_paved_road_is_in():
    p, _ = run()
    es = analysis.event_study(p, "rework")
    enable = WORLD["true_effects"]["enablement_after_weeks"]
    early = es[es["e"] < enable]["relative"].mean()
    late = es[es["e"] >= enable]["relative"].mean()
    assert early > 0.15
    assert late < early - 0.2


@pytest.mark.parametrize("estimator", list(analysis.ESTIMATORS))
def test_every_estimator_runs_on_every_outcome(estimator):
    p, _ = run()
    for y in analysis.OUTCOMES:
        assert isinstance(analysis.ESTIMATORS[estimator](p, y).relative, float)
