"""Coach phase owned by Person B.

Multi-perspective debate pipeline:
  1. Three adversarial perspectives run in parallel (Skeptic, Counterpart,
     Voss Negotiator) — each finds what the others would miss.
  2. Synthesis pass merges them into structured CoachAnalysis, explicitly
     surfacing where they agreed and disagreed.

Falls back to deterministic analysis on any error. The graph never crashes
because the LLM is unavailable.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from .context import format_evidence_for_coach
from .llm import get_llm
from .scenarios import load_scenario
from .state import CoachAnalysis, ContextBrief, ConversationState, PerspectiveResult

# --- Shared scenario context template ---

SCENARIO_CONTEXT_TEMPLATE = """\
Scenario: {scenario_id}
Stakes: {stakes}

Counterpart: {counterpart_name} — {counterpart_role}
Style: {counterpart_style}
Leverage: {counterpart_leverage}
Known concerns:
{counterpart_concerns}

User's self-identified weak points:
{user_weak_points}

{evidence}"""

# --- Perspective prompts (genuinely adversarial, not vague "different views") ---

SKEPTIC_PROMPT = """\
You are a hostile analyst. Your job is NOT to help — it is to attack.

Find the weakest point in this person's position. What is the strongest \
argument against renewing at full size? Where is the hole they are not seeing?

Be specific. Reference the actual facts of the scenario. Do not give \
encouragement. If the position is sound on one dimension, say so briefly \
and move to where it breaks.

Output 3-5 paragraphs of analysis. No headers, no bullet lists — just \
direct prose."""

COUNTERPART_PROMPT = """\
You are {counterpart_name}, {counterpart_role}.

You have heard this person's preparation for the meeting. Now tell them \
what you actually think.

What matters to you that they are not addressing? What would make you \
reduce the allocation? What would make you renew at full size — and do \
they have it?

Speak in first person. Be the person, not an analyst. If you would be \
skeptical, be skeptical. If something would actually convince you, say so.

Output 3-5 paragraphs in your own voice."""

NEGOTIATOR_PROMPT = """\
You are a negotiation coach trained in Chris Voss's methods. Your lens \
is tactical empathy and emotional leverage, not argument quality.

Does this plan make {counterpart_name} feel heard or cornered? Where does \
it trade logic for connection? What calibrated question should they ask \
instead of asserting? Where is the plan technically correct but \
emotionally tone-deaf?

A logically perfect pitch that makes the counterpart defensive still \
loses. Find where this plan does that.

Output 3-5 paragraphs. Be specific about the emotional dynamics, not \
generic negotiation theory."""

SYNTHESIS_PROMPT = """\
You are the principal's chief of staff. Three advisors just attacked \
the principal's position independently. Synthesize their outputs into a \
single briefing the principal can walk in with.

Tone: you work for the principal. Critique the POSITION, never the \
person. Do not grade, lecture, or say "you should have". Write moves \
the principal can say out loud, in their own voice.

CRITICAL: You must surface where they disagreed, not paper over it. \
If the Skeptic says the position is weak and the Negotiator says it is \
emotionally sound, that tension is the most important thing in the \
briefing. Name it.

If all three agree on something, that is high-confidence signal — \
put it in consensus.

Produce:
- blind_spots: what the user is not seeing (from any perspective)
- concrete_moves: specific things to do or say
- likely_objections: what the counterpart will lead with
- opening_strategy: the first 60 seconds, in one paragraph
- if_then: 2-4 lines pairing a likely counterpart move (trigger, e.g. \
"She asks why liquidity will be different this time") with the exact \
words to say back (response, one or two sentences, first person)
- perspectives: preserve each advisor's full analysis (name + text)
- disagreements: where the advisors conflicted — this is NOT a merge, \
it is a list of the actual tensions
- consensus: where all advisors agreed

Do not invent disagreements that are not in the source material. Do not \
smooth over real ones."""

# --- Fallback (deterministic, used when LLM is unavailable or all perspectives fail) ---

FALLBACK_PERSPECTIVES: list[PerspectiveResult] = [
    {
        "name": "skeptic",
        "analysis": (
            "The liquidity timeline is the core vulnerability. DPI is a proxy — "
            "Elena's real question is whether the fund can deliver liquidity on "
            "schedule, and the prior cycle did not. Two concentrated positions "
            "doing most of the unrealized value means the liquidity case rests "
            "on a narrow base. If either position unwinds, the story breaks."
        ),
    },
    {
        "name": "counterpart",
        "analysis": (
            "I have heard this pitch before. The operational change matters more "
            "than another market explanation. Show me what is different this time, "
            "not why the portfolio is good. I can renew at a reduced allocation "
            "and that is a credible outcome for me — you need to show me why "
            "full renewal is the better decision, not why it is the fair one."
        ),
    },
    {
        "name": "negotiator",
        "analysis": (
            "The plan leads with evidence. That is logical but it makes Elena "
            "feel like she is being presented to, not consulted. She needs to "
            "feel heard first. Ask her what would make renewal simple this time "
            "before showing the portfolio. The fee step-up is a trust issue, "
            "not a math issue — address the trust, not the fee."
        ),
    },
]

FALLBACK_ANALYSIS: CoachAnalysis = {
    "blind_spots": [
        "The liquidity timeline is the real objection — DPI is the proxy, not the root.",
        "A reduced allocation is the counterpart's BATNA, not their floor. They may test it.",
    ],
    "concrete_moves": [
        "Open with the operational change that addresses liquidity, not the return number.",
        "Name the full $40M renewal ask explicitly in the first 90 seconds.",
        "Pre-commit to a specific liquidity milestone with a date, not a range.",
    ],
    "likely_objections": [
        "Why should we believe the liquidity timeline this time?",
        "The fee step-up doesn't match the liquidity delivered so far.",
        "Two positions are doing all the work — what happens if one unwinds?",
    ],
    "opening_strategy": (
        "Acknowledge the prior gap, state the operational change, then name the ask. "
        "Do not lead with portfolio performance."
    ),
    "if_then": [
        {
            "trigger": "She asks why the liquidity timeline is credible this time.",
            "response": (
                "We changed how we exit, not just when. Here is the dated milestone "
                "we will report against."
            ),
        },
        {
            "trigger": "She floats renewing at a reduced allocation.",
            "response": (
                "Before we size it — what would make the full $40M an easy decision "
                "for your committee?"
            ),
        },
        {
            "trigger": "She calls the fee step-up unjustified.",
            "response": (
                "Fair. Tie the step-up to the liquidity milestone — if we miss it, "
                "the step-up waits."
            ),
        },
    ],
    "perspectives": FALLBACK_PERSPECTIVES,
    "disagreements": [
        "The Skeptic sees the position as fundamentally weak on liquidity; "
        "the Negotiator sees it as emotionally tone-deaf but fixable. These "
        "are different problems requiring different moves.",
    ],
    "consensus": [
        "All three agree: lead with the operational change, not the return number.",
        "All three agree: the fee step-up is a trust issue, not a math issue.",
    ],
}

PERSPECTIVE_CONFIG = [
    ("skeptic", SKEPTIC_PROMPT),
    ("counterpart", COUNTERPART_PROMPT),
    ("negotiator", NEGOTIATOR_PROMPT),
]


def _format_concerns(concerns: list[str]) -> str:
    return "\n".join(f"  - {c}" for c in concerns)


def _format_weak_points(weak_points: list[str]) -> str:
    return "\n".join(f"  - {w}" for w in weak_points)


def _build_scenario_context(
    scenario: dict,
    weak_points: list[str],
    context_brief: ContextBrief | None = None,
) -> str:
    profile = scenario["counterpart_profile"]
    return SCENARIO_CONTEXT_TEMPLATE.format(
        scenario_id=scenario["scenario_id"],
        stakes=scenario["stakes"],
        counterpart_name=profile["name"],
        counterpart_role=profile["role"],
        counterpart_style=", ".join(profile["style"]),
        counterpart_leverage=profile["leverage"],
        counterpart_concerns=_format_concerns(profile["concerns"]),
        user_weak_points=_format_weak_points(weak_points),
        evidence=format_evidence_for_coach(context_brief),
    )


def _run_perspectives(
    llm,
    scenario_context: str,
    counterpart_name: str,
) -> list[PerspectiveResult]:
    """Run all three perspectives in parallel via llm.batch()."""
    message_sets = []
    for name, system_prompt in PERSPECTIVE_CONFIG:
        prompt = system_prompt.format(counterpart_name=counterpart_name)
        message_sets.append(
            [
                SystemMessage(content=prompt),
                HumanMessage(content=scenario_context),
            ]
        )

    results = llm.batch(message_sets)
    perspectives: list[PerspectiveResult] = []
    for (name, _), response in zip(PERSPECTIVE_CONFIG, results, strict=False):
        text = response.content.strip() if response.content else ""
        if text:
            perspectives.append({"name": name, "analysis": text})
    return perspectives


def _synthesize(llm, perspectives: list[PerspectiveResult]) -> CoachAnalysis:
    """Merge perspectives into structured CoachAnalysis via LLM synthesis."""
    perspective_text = "\n\n---\n\n".join(
        f"## {p['name'].upper()}\n\n{p['analysis']}" for p in perspectives
    )

    structured_llm = llm.with_structured_output(CoachAnalysis)
    result = structured_llm.invoke(
        [
            SystemMessage(content=SYNTHESIS_PROMPT),
            HumanMessage(content=perspective_text),
        ]
    )
    return result  # type: ignore[return-value]


def _ground_fallback_in_evidence(
    analysis: CoachAnalysis,
    context_brief: ContextBrief | None,
) -> CoachAnalysis:
    """Keep the fallback usable when the user pasted a thread but no LLM ran."""
    from .context import approved_claims

    if not context_brief or context_brief.get("status") != "approved":
        return analysis
    claims = [claim["claim"] for claim in approved_claims(context_brief)]
    if not claims:
        return analysis
    grounded = dict(analysis)
    grounded["blind_spots"] = [
        f"The thread shows: {claims[0]}",
        *list(analysis["blind_spots"]),
    ]
    if len(claims) > 1:
        grounded["likely_objections"] = [
            claims[1],
            *list(analysis["likely_objections"]),
        ]
    return grounded  # type: ignore[return-value]


def _empty_partial_analysis(perspectives: list[PerspectiveResult]) -> CoachAnalysis:
    return {
        "blind_spots": [],
        "concrete_moves": [],
        "likely_objections": [],
        "opening_strategy": "",
        "if_then": [],
        "perspectives": perspectives,
        "disagreements": [],
        "consensus": [],
    }


def run_coach_perspectives(state: ConversationState) -> dict:
    """Stage 1: load scenario and land the three adversarial perspectives.

    Writes a partial coach_analysis so the UI can stage the council before
    synthesis arrives.
    """
    scenario = load_scenario(state.get("scenario_id", "lp_renewal"))
    weak_points = state.get("user_weak_points") or scenario["user_weak_points"]
    context_brief = state.get("context_brief")

    llm = get_llm()
    profile = scenario["counterpart_profile"]

    perspectives: list[PerspectiveResult] = []
    if llm is not None:
        scenario_context = _build_scenario_context(scenario, weak_points, context_brief)
        try:
            perspectives = _run_perspectives(llm, scenario_context, profile["name"])
        except Exception:
            perspectives = []

    if not perspectives:
        perspectives = list(
            _ground_fallback_in_evidence(FALLBACK_ANALYSIS, context_brief)[
                "perspectives"
            ]
        )

    return {
        **scenario,
        "phase": "prep",
        "user_weak_points": weak_points,
        "coach_stage": "perspectives",
        "coach_analysis": _empty_partial_analysis(perspectives),
    }


def run_coach_synthesize(state: ConversationState) -> dict:
    """Stage 2: synthesize disagreement into the structured brief."""
    existing = state.get("coach_analysis") or _empty_partial_analysis([])
    perspectives = existing.get("perspectives") or []
    context_brief = state.get("context_brief")

    llm = get_llm()
    if llm is None or not perspectives:
        analysis = _ground_fallback_in_evidence(FALLBACK_ANALYSIS, context_brief)
        if perspectives:
            analysis = {**analysis, "perspectives": perspectives}
        return {
            "coach_stage": "ready",
            "coach_analysis": analysis,
        }

    try:
        analysis = _synthesize(llm, perspectives)
        if not analysis.get("perspectives"):
            analysis["perspectives"] = perspectives
        return {
            "coach_stage": "ready",
            "coach_analysis": analysis,
        }
    except Exception:
        return {
            "coach_stage": "ready",
            "coach_analysis": _ground_fallback_in_evidence(
                {**FALLBACK_ANALYSIS, "perspectives": perspectives},
                context_brief,
            ),
        }


def run_coach(state: ConversationState) -> dict:
    """Initialize prep from the scenario, then run the multi-perspective debate.

    Used by unit tests and as a single-shot convenience. The live graph uses
    run_coach_perspectives → run_coach_synthesize so the UI can stage the council.
    """
    mid = run_coach_perspectives(state)
    final = run_coach_synthesize({**state, **mid})
    return {
        **mid,
        **final,
        "coach_stage": "ready",
    }
