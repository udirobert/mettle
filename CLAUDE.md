# Mettle — High-Stakes Conversation Agent

## Purpose

An agent for high-stakes conversations people can't afford to get wrong — a
founder pitching a skeptical investor, a fund manager in an LP renewal meeting,
a rough board update. The agent operates in four phases:

- **Coach** — prepares the user before the conversation (stress-tests position,
  surfaces blind spots, gives concrete moves).
- **Opponent** — roleplays the other side for rehearsal, in character, not as a
  friendly sparring partner.
- **Wingman (reactive)** — supports the user during the real conversation; user
  types a fragment, gets a fast targeted response.
- **Wingman (proactive)** — watches the live transcript, surfaces nudges
  unprompted when a pattern is worth flagging (repetition, long monologue,
  conceded number), rate-limited to avoid noise.
- **Debrief** — post-conversation summary.

## Architecture

Flat project with a Next.js frontend in `frontend/` and a Python LangGraph
backend in `backend/`. CopilotKit (CoAgents / AG-UI) shares the graph's state
live with the React UI.

```
/backend
  /graph
    state.py              # shared LangGraph state schema — the contract
    scenarios.py          # deterministic scenario loader (lp_renewal default)
    coach.py              # Coach node — Person A (scenario resolution + stress
                           # test) + Person B (multi-perspective debate)
    opponent.py           # Opponent node — Person A
    wingman_reactive.py   # reactive Wingman nodes (interrupt + answer) — Person B
    wingman_proactive.py  # proactive trigger evaluation + turn ingestion — Person B
    debrief.py            # post-conversation node — Person A
    graph.py              # top-level phase router wiring all nodes
  /triggers
    rules.py              # deterministic proactive nudge rules — Person B
  /voice
    livekit_adapter.py    # LiveKit LLMAdapter seam — stretch goal, Person B
  /tests                  # unittest specs — run with: python -m pytest
  main.py                 # LangGraph server entrypoint (graph id: conversation_agent)
  langgraph.json
/frontend
  /src
    /app
      page.tsx            # phase switcher + CopilotChat side panel
      layout.tsx          # CopilotKit provider wiring
      api/copilotkit/     # CopilotKit runtime route → LangGraph agent
    /components
      coach-panel.tsx          # Coach UI shell — Person B
      opponent-chat.tsx        # Opponent rehearsal UI shell — Person A
      wingman-side-panel.tsx   # reactive replies (A) + proactive nudge cards (B)
      debrief-view.tsx         # debrief UI shell
      ui/                      # reusable shadcn primitives (button, card, input, …)
    /hooks
      use-conversation-state.ts  # typed wrapper around CopilotKit shared state
      use-theme.tsx              # dark/light theme provider
/scenarios
  lp_renewal.md           # first vertical-slice demo scenario
```

## Testing

```bash
cd backend && uv run python -m pytest tests/ -v
```

11 tests pass (4 coach, 7 proactive). Tests are executable specs:
`test_coach.py` covers scenario loading + fallback analysis content;
`test_proactive.py` covers trigger rules, ingestion, enrichment fallback,
empty text, and counterpart turns.

## Key Pattern: Shared State as the Contract

`backend/graph/state.py` defines `ConversationState` — the single LangGraph
state object every node reads from and writes to. This is what lets Coach's prep
context carry into Wingman, and the live transcript feed straight into Debrief.

```python
class ConversationState(TypedDict):
    scenario_id: str
    stakes: str
    counterpart_profile: dict
    user_weak_points: list[str]
    transcript: list[TranscriptTurn]
    nudges_sent: list[Nudge]
    open_reactive_query: str | None
    phase: Literal["prep", "rehearsal", "live", "debrief"]
    reactive_reply: NotRequired[str | None]
    debrief_notes: NotRequired[list[str]]
```

The frontend mirrors this shape in
`frontend/src/hooks/use-conversation-state.ts` and reads/writes via CopilotKit's
`useAgent()` hook (`agent.state` / `agent.setState()`). Do not duplicate state in
component-local state.

## Interrupt Points

- **Reactive Wingman**: `wait_for_reactive_query` uses LangGraph's native
  `interrupt()` to pause until the UI resumes with the user's quick question,
  then `answer_reactive_query` produces the response.
- **Proactive Wingman**: two-stage pipeline — cheap rules pass
  (`triggers/rules.py`, no LLM per turn) → LLM enrichment only when a candidate
  nudge fires. Enrichment reads `coach_analysis` and `counterpart_profile` to
  produce context-aware nudge text. Falls back to rules message on any error.

## LLM Integration

All LLM calls go through `backend/graph/llm.py` (`get_llm()` / `get_chat_model()`
/ `complete()`), which returns `None` when no provider key is set. Provider
resolution order: `OPENROUTER_API_KEY` (OpenAI-compatible endpoint, model via
`OPENROUTER_MODEL`) then `OPENAI_API_KEY` (model via `OPENAI_MODEL`, default
gpt-4o). Every call site wraps invocations in try/except with deterministic
fallback — the graph never crashes because the LLM is unavailable.

**Coach** (`coach.py`): loads scenario deterministically, then runs an LLM
stress-test via `with_structured_output(CoachAnalysis)` producing blind spots,
concrete moves, likely objections, and opening strategy. Falls back to
`FALLBACK_ANALYSIS` on any error.

**Proactive** (`wingman_proactive.py`): rules pass detects candidate nudges,
then LLM enrichment replaces the generic message with context-aware advice
(max 2 sentences, references the specific turn and counterpart concerns).
Falls back to rules message on any error.

## Team Split

- **Person A (before + after)**: `coach.py`, `opponent.py`, `debrief.py`, and
  their UI panels (`coach-panel.tsx`, `opponent-chat.tsx`, `debrief-view.tsx`).
- **Person B (during)**: `wingman_reactive.py`, `wingman_proactive.py`,
  `triggers/rules.py`, both sections of `wingman-side-panel.tsx`, and the voice
  integration for the live call once the core graph is stable.

Both work against the same `state.py` contract and `scenarios/lp_renewal.md`.

## Development

```bash
cd frontend
npm install        # also runs setup-agent (uv sync in backend/)
npm run dev        # Next.js (3000) + LangGraph dev server (8123)
```

Set provider credentials in `.env` before adding LLM-backed node logic.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4, CopilotKit v2
- **Backend**: LangGraph (Python), LangGraph Platform dev server
- **Transport**: AG-UI protocol via CopilotKit runtime
- **Voice (stretch)**: LiveKit LLMAdapter — additive, not blocking

## Build Order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person A)** — Coach scenario resolution (custom scenario from a
   typed description or voice interview, LP renewal default) + weak-point
   stress test. Opponent voice rehearsal (Deepgram Voice Agent) and typed
   fallback. Debrief analysis. 11+ backend tests passing.
3. **Done (Person B)** — Coach multi-perspective debate (see below) +
   proactive nudge enrichment, both with graceful fallback.
4. **In progress (Person B)** — reactive Wingman answer (`answer_reactive_query`
   still stubbed).
5. **Stretch (Person B)** — LiveKit voice adapter for the live call. Additive —
   the demo is complete without it.

## Design: Multi-Perspective Coach Debate

This runs as the second stage of `run_coach`, after scenario resolution (the
custom-scenario synthesis or `lp_renewal` default) and the weak-point stress
test — it consumes that resolved scenario, so it is grounded in whatever
counterpart the user is actually facing, not only the demo's Elena.

The Coach phase has time budget — the user is preparing, not in the moment.
This is where multiple adversarial perspectives earn their cost. Wingman (live)
is the wrong place for debate: latency matters and the two-stage rules→LLM
pipeline already provides a cheap "second perspective."

### Why not a single agent

A single LLM agent tends to anchor on one framing and toward encouragement
(because that feels helpful). Multiple perspectives force the system to
confront failure modes a single agent would miss.

### The risk: LLMs converge

If three agents get vague "different perspective" prompts, they often produce
similar advice with different wording — the debate is theater. The architecture
only earns its complexity if prompts are genuinely adversarial and the
synthesis surfaces disagreement, not averages it out.

### Design: three fixed adversarial perspectives + synthesis (not a swarm)

No free-form back-and-forth rounds (expensive, rarely changes minds). Three
parallel perspectives, then one synthesis pass — 4 LLM calls total, all in
Coach where latency is acceptable.

1. **The Skeptic** — "Where is the hole in this position? What's the strongest
   argument against renewing at full size?" Devil's advocate. Finds what's weak.
2. **The Counterpart (Elena)** — "You are Elena. You've heard this pitch. What
   do you actually think? What do you say next?" Tests whether the plan survives
   contact with the counterpart's priorities. (Distinct from Opponent roleplay —
   this is analysis input, not rehearsal.)
3. **The Negotiator (Voss)** — "Does this plan make Elena feel heard or
   cornered? Where does it trade logic for tactical empathy? What calibrated
   question should the user ask instead of asserting?" Catches the failure mode
   where a logically perfect pitch still loses because it makes the counterpart
   defensive. This is the genuinely additive perspective — without it, the other
   two both optimize for argument quality and miss the trust dimension.

**Synthesis** — "Three advisors analyzed this position. They agreed on X.
They disagreed on Y. Here's what to do." Must surface disagreement explicitly.
If all three agree, say so — that's signal too.

### Framing notes

- **Netflix (sports team vs family)**: the argument is that the agent should
  not be a cheerleader. A family protects feelings; a sports team fields the
  best players and gives honest feedback. The debate architecture forces this
  by construction — the Skeptic is explicitly not on the user's side.
- **Voss (negotiation)**: high-stakes conversations are won by making the other
  side feel heard and in control, not by having better arguments. The Voss
  agent catches the trust/emotional dimension that the Skeptic and Counterpart
  miss because they optimize for logic.

### Implementation constraints

- Build as three named perspectives with hardcoded prompts, not a general
  framework. A framework invites adding more agents → convergence + cost.
- Run in parallel, not sequentially.
- Fallback: if any perspective fails, synthesize from the ones that succeeded.
  If all fail, fall back to `FALLBACK_ANALYSIS`.
- Output feeds into the existing `CoachAnalysis` shape (or an extended version
  that includes `perspectives` and `disagreements` fields).

## Known Gaps

- **Stubbed node**: `wingman_reactive.py` (`answer_reactive_query`) still
  returns placeholder text with a TODO — Person B's work item.
- **A2UI surface**: the demo catalog was removed. Nudge-specific generative UI
  components should be added when the Wingman proactive surface matures.
