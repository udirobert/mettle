"""The Fund III raise scenarios load into the shape Coach and Spar rely on."""

import pytest

from graph.scenarios import list_scenarios, load_scenario

RAISE_SCENARIOS = [
    "lp_renewal",
    "lp_endowment_followup",
    "lp_family_office",
    "lp_first_meeting",
    "lp_bad_news",
]


@pytest.mark.parametrize("scenario_id", RAISE_SCENARIOS)
def test_raise_scenario_has_counterpart_and_pressure_points(scenario_id):
    scenario = load_scenario(scenario_id)
    profile = scenario["counterpart_profile"]

    assert scenario["stakes"]
    assert profile["name"] != "The counterpart"
    assert profile["leverage"]
    assert len(profile["style"]) >= 2
    assert len(profile["concerns"]) >= 3
    assert len(scenario["user_weak_points"]) >= 3


def test_raise_scenarios_are_listed():
    listed = {scenario["id"] for scenario in list_scenarios()}
    assert set(RAISE_SCENARIOS) <= listed
