"""Coach phase owned by Person A."""

import json

from .llm import complete
from .scenarios import load_scenario
from .state import ConversationState

_SCENARIO_SYSTEM = (
    "You turn a user's description of an upcoming high-stakes conversation "
    "into a structured scenario. Return ONLY valid JSON, no code fences, with "
    "exactly these keys:\n"
    '{"stakes": "<one sentence, concrete>", "counterpart_profile": {"name": '
    '"<name or a plausible one>", "role": "<their role>", "style": ["<3 '
    'adjectives>"], "leverage": "<what power they hold>", "concerns": ["<3-4 '
    'objections they will raise>"], "opening_line": "<the hard first line '
    'they would open the meeting with, in their voice>"}, "user_weak_points": '
    '["<3 likely failure patterns for the user>"]}'
)

_STRESS_TEST_SYSTEM = (
    "You are a preparation coach for high-stakes conversations. Given a "
    "scenario and, when available, a coaching interview with the user, "
    "produce the 4 most dangerous weak points THIS user is likely to show in "
    "THIS conversation. Ground them in what the user actually said whenever "
    "an interview is provided. Each weak point is one sentence naming the "
    "failure pattern, then ' — ' and a concrete in-the-moment cue to counter "
    "it. Return exactly one weak point per line, no numbering, no extra text."
)


def run_coach(state: ConversationState) -> dict:
    """Initialize prep from the scenario, then sharpen weak points with an LLM.

    If a voice/typed coaching interview happened during prep it lives in
    state.transcript; it is consumed here to personalize the weak points and
    then cleared so rehearsal starts with a clean transcript.
    """
    interview_turns = state.get("transcript") or []
    interview = "\n".join(
        f"{'Coach' if t['speaker'] == 'system' else 'User'}: {t['text']}"
        for t in interview_turns
    )

    scenario_id = state.get("scenario_id", "lp_renewal")
    scenario = None
    if scenario_id == "custom" and interview:
        generated = complete(_SCENARIO_SYSTEM, interview, temperature=0.4)
        if generated:
            try:
                cleaned = generated.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
                data = json.loads(cleaned)
                scenario = {
                    "scenario_id": "custom",
                    "stakes": str(data["stakes"]),
                    "counterpart_profile": dict(data["counterpart_profile"]),
                    "user_weak_points": [str(w) for w in data["user_weak_points"]],
                }
            except (json.JSONDecodeError, KeyError, TypeError):
                scenario = None
    if scenario is None:
        scenario = load_scenario("lp_renewal")

    weak_points = state.get("user_weak_points") or scenario["user_weak_points"]

    profile = scenario["counterpart_profile"]
    stress_test = complete(
        _STRESS_TEST_SYSTEM,
        (
            f"Stakes: {scenario['stakes']}\n"
            f"Counterpart: {profile.get('name')} ({profile.get('role')}), "
            f"style: {', '.join(profile.get('style', []))}.\n"
            f"Counterpart concerns: {'; '.join(profile.get('concerns', []))}\n"
            f"Known tendencies of the user: {'; '.join(weak_points)}\n"
            + (
                f"\nCoaching interview with the user:\n{interview}"
                if interview
                else ""
            )
        ),
        temperature=0.4,
    )
    if stress_test:
        weak_points = [line.strip() for line in stress_test.splitlines() if line.strip()]

    return {
        **scenario,
        "phase": "prep",
        "user_weak_points": weak_points,
        # The interview is consumed; rehearsal starts with a clean transcript.
        "transcript": [],
    }
