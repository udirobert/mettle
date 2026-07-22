"""Scenario loading for deterministic first-pass preparation.

Scenarios are markdown files with structured YAML frontmatter. The parser
extracts stakes, counterpart profile, and user weak points. The Coach phase
uses this to initialize shared state without requiring an LLM.
"""

from __future__ import annotations

import re
from pathlib import Path


SCENARIO_DIRECTORY = Path(__file__).resolve().parents[2] / "scenarios"


def list_scenarios() -> list[dict[str, str]]:
    """Return available scenarios with their IDs and display names."""
    scenarios = []
    for path in SCENARIO_DIRECTORY.glob("*.md"):
        try:
            data = load_scenario(path.stem)
            scenarios.append(
                {
                    "id": path.stem,
                    "name": data.get("counterpart_profile", {}).get("name", path.stem),
                    "stakes": str(data.get("stakes", "")),
                }
            )
        except Exception:
            continue
    return scenarios


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from markdown content."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if not match:
        return {}

    yaml_text = match.group(1)
    result = {}
    current_key = None
    current_list = []

    for line in yaml_text.split("\n"):
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue

        # Top-level key
        if not line.startswith(" ") and ":" in line:
            if current_key and current_list:
                result[current_key] = current_list
                current_list = []

            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip("\"'")

            if value:
                result[key] = value
                current_key = None
            else:
                current_key = key
        # List item
        elif line.strip().startswith("- "):
            item = line.strip()[2:].strip().strip("\"'")
            if current_key:
                current_list.append(item)

    if current_key and current_list:
        result[current_key] = current_list

    return result


def _parse_counterpart_profile(frontmatter: dict) -> dict:
    """Extract counterpart profile from frontmatter."""
    style = frontmatter.get("counterpart_style", [])
    if isinstance(style, str):
        style = [s.strip() for s in style.split(",")]

    return {
        "name": frontmatter.get("counterpart_name", "The counterpart"),
        "role": frontmatter.get("counterpart_role", ""),
        "style": style,
        "leverage": frontmatter.get("counterpart_leverage", ""),
        "concerns": frontmatter.get("counterpart_concerns", []),
    }


def load_scenario(scenario_id: str) -> dict[str, object]:
    """Load a scenario from markdown into the state shape used by Coach.

    The markdown remains the human-readable source of truth. The parser
    extracts YAML frontmatter for structured data.
    """
    scenario_path = SCENARIO_DIRECTORY / f"{scenario_id}.md"
    if not scenario_path.is_file():
        raise FileNotFoundError(f"Scenario file is missing: {scenario_path}")

    content = scenario_path.read_text()
    frontmatter = _parse_frontmatter(content)

    return {
        "scenario_id": scenario_id,
        "stakes": frontmatter.get("stakes", ""),
        "counterpart_profile": _parse_counterpart_profile(frontmatter),
        "user_weak_points": frontmatter.get("user_weak_points", []),
    }
