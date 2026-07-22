"""Scenario loading for deterministic first-pass preparation.

The first vertical slice deliberately keeps scenario interpretation structured
and inspectable. An LLM can enrich this later, but it should not be needed to
make the Coach phase useful or to initialize the shared state correctly.
"""

from __future__ import annotations

from pathlib import Path


SCENARIO_DIRECTORY = Path(__file__).resolve().parents[2] / "scenarios"


def load_scenario(scenario_id: str) -> dict[str, object]:
    """Load the known demo scenario into the state shape used by Coach.

    The markdown remains the human-readable source of truth. This small
    adapter avoids fragile free-form parsing while the first scenario is fixed.
    """
    if scenario_id != "lp_renewal":
        raise ValueError(f"Unknown scenario: {scenario_id}")

    scenario_path = SCENARIO_DIRECTORY / "lp_renewal.md"
    if not scenario_path.is_file():
        raise FileNotFoundError(f"Scenario file is missing: {scenario_path}")

    return {
        "scenario_id": "lp_renewal",
        "stakes": "$40M LP renewal from the fund's second-largest investor.",
        "counterpart_profile": {
            "name": "Elena Park",
            "role": "CIO, Northstar Foundation",
            "style": ["analytical", "terse", "skeptical"],
            "leverage": "Can renew at a reduced allocation before the next close.",
            "concerns": [
                "DPI has lagged the earlier renewal expectation.",
                "Two concentrated positions dominate unrealized value.",
                "The management-fee step-up lacks a clear liquidity case.",
                "Operational changes matter more than another market explanation.",
            ],
        },
        "user_weak_points": [
            "May defend headline return before answering the liquidity question.",
            "May over-explain portfolio detail instead of naming the renewal ask.",
            "May accept a reduced allocation before testing what would unlock full renewal.",
        ],
    }
