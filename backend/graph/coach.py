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
from .scenarios import scenario_for_state
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
argument against giving them their full ask (or renewing at full size)? \
Where is the hole they are not seeing?

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
push back, defer, or reduce the ask/allocation? What would make you say \
yes to the full ask (or renew at full size) — and do they have it?

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

SALARY_FALLBACK_PERSPECTIVES: list[PerspectiveResult] = [
    {
        "name": "skeptic",
        "analysis": (
            "$185k sits above the posted band for your current level, and the "
            "unanswered March commitment on team-health metrics gives Dana an "
            "easy reason to pause on cash. If you frame the ask around tenure "
            "or two deferred cycles, she can agree with the frustration while "
            "blaming band policy and VP sign-off."
        ),
    },
    {
        "name": "counterpart",
        "analysis": (
            "I already know this review has been deferred twice, and I am ready "
            "to move on the senior title. What I need from you is a clean scope "
            "and impact case I can take to VP sign-off for $185k — and I need "
            "to know the March team-health metrics are handled before I spend "
            "political capital pushing above band."
        ),
    },
    {
        "name": "negotiator",
        "analysis": (
            "Leading with the number puts Dana on defense about comp bands before "
            "she agrees on the expanded role. Get her to confirm the senior scope "
            "first, own the March metrics in one calm sentence so it cannot derail "
            "the room, and ask what band applies to the role you are actually doing."
        ),
    },
]

SALARY_FALLBACK_ANALYSIS: CoachAnalysis = {
    "blind_spots": [
        "The missed March team-health metrics weaken the reliability case right when Dana needs VP sign-off.",
        "Dana can offer the senior title now to defer the $185k cash decision for a third cycle.",
    ],
    "concrete_moves": [
        "Open with the expanded scope case she asked for, then name $185k as the band for that scope.",
        "Close the March team-health metrics loop in one sentence up front and hand them over today.",
        "If cash cannot move this cycle, lock a specific written review date and milestone before leaving.",
    ],
    "likely_objections": [
        "$185k sits above the posted band for your current level and requires VP sign-off.",
        "We can move on the senior title this cycle, then revisit the cash adjustment next cycle.",
        "What happened to the team-health metrics we agreed on after the March review?",
    ],
    "opening_strategy": (
        "Open with the scope case she asked for — what the role became over the last two cycles — "
        "deliver the March team-health metrics in one sentence, then state $185k as the figure that matches the senior scope."
    ),
    "if_then": [
        {
            "trigger": "She says $185k is above the posted band for your level.",
            "response": (
                "That is why the scope case comes first — once we align on the senior scope, "
                "what does the band for that level look like?"
            ),
        },
        {
            "trigger": "She brings up the March team-health metrics.",
            "response": (
                "I owe you those — they are complete and in your inbox today. "
                "Let's look at how they tie to the expanded scope."
            ),
        },
        {
            "trigger": "She offers the senior title now and asks to revisit cash next cycle.",
            "response": (
                "I appreciate moving on the title. Before we defer the $185k, what specific "
                "date and sign-off criteria can we put in writing today?"
            ),
        },
    ],
    "perspectives": SALARY_FALLBACK_PERSPECTIVES,
    "disagreements": [
        "The Skeptic sees the above-band ask as blocked by the March metrics miss; "
        "the Negotiator sees the title concession as leverage to anchor the $185k band.",
    ],
    "consensus": [
        "All three agree: lead with expanded scope and impact, not tenure or past deferrals.",
        "All three agree: neutralize the March team-health metrics immediately so it cannot be used to delay cash.",
    ],
}


def _fallback_analysis_for_scenario(scenario: dict) -> CoachAnalysis:
    """Return a scenario-appropriate deterministic CoachAnalysis."""
    scenario_id = str(scenario.get("scenario_id") or "")
    profile = scenario.get("counterpart_profile") or {}
    name = str(profile.get("name") or "the counterpart")

    if scenario_id.startswith("salary") or "dana" in name.lower():
        return SALARY_FALLBACK_ANALYSIS
    if scenario_id.startswith("lp_") or "elena" in name.lower():
        return FALLBACK_ANALYSIS

    concerns = list(profile.get("concerns") or [])
    weak_points = list(scenario.get("user_weak_points") or [])
    stakes = str(scenario.get("stakes") or "the core decision in this meeting")
    first_concern = concerns[0] if concerns else f"the core risk around {stakes}"
    second_concern = (
        concerns[1]
        if len(concerns) > 1
        else "whether commitments will hold on schedule"
    )
    first_weak = (
        weak_points[0]
        if weak_points
        else "Softening the ask before testing their real constraint."
    )

    perspectives: list[PerspectiveResult] = [
        {
            "name": "skeptic",
            "analysis": (
                f"The weak point in this room with {name} is {first_concern} "
                f"Without a direct answer on {second_concern}, {name} has no reason "
                "to commit today."
            ),
        },
        {
            "name": "counterpart",
            "analysis": (
                f"Address what I actually care about: {first_concern} "
                "Do not walk me through background before giving me a concrete, "
                "dated commitment I can hold you to."
            ),
        },
        {
            "name": "negotiator",
            "analysis": (
                f"Lead by naming {name}'s top concern before defending your position. "
                "Ask what would make a yes straightforward today, then tie your ask "
                "to a dated milestone."
            ),
        },
    ]
    return {
        "blind_spots": [
            f"Unaddressed counterpart concern: {first_concern}",
            first_weak,
        ],
        "concrete_moves": [
            f"Address {name}'s top concern in the first 60 seconds before pitching.",
            "State your ask and desired timeline explicitly.",
            "Leave with a dated next step in writing rather than an open-ended follow-up.",
        ],
        "likely_objections": concerns[:3]
        if len(concerns) >= 2
        else [
            first_concern,
            second_concern,
        ],
        "opening_strategy": (
            f"Name {name}'s primary concern up front, state what changed operationally, "
            "and put the concrete ask on the table."
        ),
        "if_then": [
            {
                "trigger": f"{name} pushes back on {first_concern.rstrip('.')}.",
                "response": "Acknowledge the gap directly and offer a specific, dated milestone.",
            },
            {
                "trigger": f"{name} tries to defer the decision without a date.",
                "response": "Before we pause — what specific criteria and date would let us close this?",
            },
        ],
        "perspectives": perspectives,
        "disagreements": [
            f"The Skeptic sees {first_concern.rstrip('.')} as a blocker; "
            "the Negotiator sees it as an opening to trade for a dated commitment.",
        ],
        "consensus": [
            f"All three agree: address {name}'s top concern before defending your ask.",
            "All three agree: do not leave without a dated commitment.",
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
    scenario = scenario_for_state(state)
    weak_points = state.get("user_weak_points") or scenario["user_weak_points"]
    context_brief = state.get("context_brief")

    llm = get_llm(max_tokens=400)
    profile = scenario["counterpart_profile"]

    perspectives: list[PerspectiveResult] = []
    if llm is not None:
        scenario_context = _build_scenario_context(scenario, weak_points, context_brief)
        try:
            perspectives = _run_perspectives(llm, scenario_context, profile["name"])
        except Exception:
            perspectives = []

    fallback_analysis = _fallback_analysis_for_scenario(scenario)
    if not perspectives:
        perspectives = list(
            _ground_fallback_in_evidence(fallback_analysis, context_brief)[
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
    try:
        scenario = scenario_for_state(state)
    except Exception:
        scenario = {"scenario_id": state.get("scenario_id") or "lp_renewal"}
    fallback_analysis = _fallback_analysis_for_scenario(scenario)

    llm = get_llm(max_tokens=900)
    if llm is None or not perspectives:
        analysis = _ground_fallback_in_evidence(fallback_analysis, context_brief)
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
                {**fallback_analysis, "perspectives": perspectives},
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
