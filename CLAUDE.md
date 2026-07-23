# Mettle — High-Stakes Conversation Agent

## Purpose

Mettle is a stakes-aware calendar and live counsel layer for conversations
people can't afford to get wrong — a founder pitching a skeptical investor, a
fund manager in an LP renewal meeting, a rough board update.

See `docs/NORTH_STAR.md` before making major product or frontend changes. Mettle
should not be positioned as a generic AI meeting assistant, meeting-notes tool,
or chat interface. The product starts from consequential calendar events and
moves the user through brief, pressure test, rehearsal, live support, and
debrief.

The agent operates in four phases:

- **Coach** — prepares the user before the conversation (stress-tests position,
  surfaces blind spots, gives concrete moves).
- **Opponent** — roleplays the other side for rehearsal, in character, not as a
  friendly sparring partner.
- **Wingman (reactive)** — supports the user during the real conversation; user
  types a fragment, gets a fast targeted response.
- **Wingman (proactive)** — watches the live transcript, surfaces nudges
  unprompted when a pattern is worth flagging (repetition, long monologue,
  conceded number), rate-limited to avoid noise.
- **Debrief** — post-conversation summary of commitments, changed assumptions,
  and next actions.

## Architecture

Flat project with a Next.js frontend in `frontend/` and a Python LangGraph
backend in `backend/`. CopilotKit (CoAgents / AG-UI) shares the graph's state
live with the React UI.

```
/backend
  /graph
    state.py              # shared LangGraph state schema — the contract
    scenarios.py          # deterministic scenario loader (lp_renewal)
    coach.py              # Coach node — Person B
    opponent.py           # Opponent node — Person A
    wingman_reactive.py   # reactive Wingman nodes (interrupt + answer) — Person A
    wingman_proactive.py  # proactive trigger evaluation + A2UI surface emit — Person B
    debrief.py            # post-conversation node
    graph.py              # top-level phase router wiring all nodes
  /triggers
    rules.py              # deterministic proactive nudge rules — Person B
  /voice
    livekit_adapter.py    # LiveKit LLMAdapter seam — stretch goal, Person B
  /tests                  # pytest specs — run with: python -m pytest
  main.py                 # LangGraph server entrypoint (graph id: conversation_agent)
  serve.py                # local FastAPI AG-UI endpoint for dev
  server_config.py        # CORS / environment guards
  langgraph.json
/frontend
  /src
    /app
      page.tsx            # phase switcher + workspace (phase rail, signal desk, side panel)
      layout.tsx          # CopilotKit provider wiring
      api/copilotkit/     # CopilotKit runtime route → HttpAgent
    /components
      coach-panel.tsx          # Coach UI shell — Person B
      opponent-chat.tsx        # Opponent rehearsal UI shell — Person A
      wingman-side-panel.tsx   # reactive replies (A) + proactive A2UI nudges (B)
      debrief-view.tsx         # debrief UI shell
      event-list.tsx           # calendar-style scenario / event selector
      welcome-overlay.tsx      # onboarding / scenario picker overlay
      nudge-card.tsx           # kind-aware nudge card (panel + signal variants)
      a2ui-catalog.tsx         # A2UI catalog definition for NudgeCard
      a2ui-nudge-host.tsx      # consume AG-UI a2ui-surface messages and render NudgeCard
      ui/                      # reusable shadcn primitives (button, card, input, …)
    /fixtures
      evidence-fixtures.ts     # static imported-context + external-research fixtures
    /hooks
      use-conversation-state.ts  # typed wrapper around CopilotKit shared state
      use-theme.tsx              # dark/light theme provider
/scenarios
  lp_renewal.md           # first vertical-slice demo scenario
```

## Testing

```bash
cd backend && uv run python -m pytest tests/ -q
```

83 tests pass. `test_coach.py` covers scenario loading + fallback analysis content;
`test_proactive.py` covers trigger rules, ingestion, enrichment fallback,
empty text, counterpart turns, and A2UI emit.

Frontend type-check and build:

```bash
cd frontend
npx tsc --noEmit
npm run build
```

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
    awaiting_reactive_query: bool
    phase: Literal["prep", "rehearsal", "live", "debrief"]
    reactive_reply: NotRequired[str | None]
    reactive_query_prefill: NotRequired[str | None]
    debrief_notes: NotRequired[list[str]]
    coach_analysis: NotRequired[CoachAnalysis]
    context_brief: NotRequired[ContextBrief]
```

The frontend mirrors this shape in
`frontend/src/hooks/use-conversation-state.ts` and reads/writes via CopilotKit's
`useAgent()` hook (`agent.state` / `agent.setState()`). Do not duplicate state in
component-local state.

## Interrupt Points

- **Reactive Wingman**: `wait_for_reactive_query` uses LangGraph's native
  `interrupt()` to pause until the UI resumes with the user's quick question,
  then `answer_reactive_query` produces the response. The UI can pre-fill the
  reactive prompt from a proactive nudge's "Get a reframe" action.
- **Proactive Wingman**: two-stage pipeline — cheap rules pass
  (`triggers/rules.py`, no LLM per turn) → LLM enrichment only when a candidate
  nudge fires. Enrichment reads `coach_analysis` and `counterpart_profile` to
  produce context-aware nudge text. Falls back to rules message on any error.
  The nudge is emitted as an AG-UI `a2ui-surface` activity message via
  `copilotkit.a2ui` and rendered through `A2UINudgeHost`.

## LLM Integration

All LLM calls go through `backend/graph/llm.py` (`get_llm()`), which returns
`None` when no `OPENAI_API_KEY` is set. Every call site wraps invocations in
try/except with deterministic fallback — the graph never crashes because the
LLM is unavailable. Model is configurable via `OPENAI_MODEL` (default: gpt-4o).

**Coach** (`coach.py`): loads scenario deterministically, then runs an LLM
stress-test via `with_structured_output(CoachAnalysis)` producing blind spots,
concrete moves, likely objections, and opening strategy. Falls back to
`FALLBACK_ANALYSIS` on any error.

**Opponent** (`opponent.py`): produces an in-character counterpart turn for
rehearsal, conditioned on the scenario profile and recent transcript. Falls back
to a skeptical, evidence-seeking reply.

**Proactive** (`wingman_proactive.py`): rules pass detects candidate nudges,
then LLM enrichment replaces the generic message with context-aware advice
(max 2 sentences, references the specific turn and counterpart concerns).
Falls back to rules message on any error.

**Debrief** (`debrief.py`): reads the full transcript and nudges to produce
commitments, changed assumptions, and next actions.

## Team Split

- **Person A (reactive + opponent)**: `wingman_reactive.py`, `opponent.py`,
  `wingman-side-panel.tsx` reactive flow.
- **Person B (proactive + coach + context)**: `coach.py`, `wingman_proactive.py`,
  `triggers/rules.py`, proactive nudge UI (`nudge-card.tsx`,
  `a2ui-catalog.tsx`, `a2ui-nudge-host.tsx`), and the LiveKit integration once
  the core graph is stable.

Both work against the same `state.py` contract and `scenarios/lp_renewal.md`.

## Development

```bash
cd frontend
npm install        # also runs setup-agent (uv sync in backend/)
npm run dev        # Next.js (3000) + AG-UI endpoint via serve.py (8123)
```

`npm run dev:agent` now runs `backend/serve.py` (uvicorn + FastAPI + LangGraphAGUIAgent)
instead of `langgraph-cli dev`. The `HttpAgent` in `api/copilotkit/[[...slug]]/route.ts`
points at `http://localhost:8123/`.

Set provider credentials in `.env` before adding LLM-backed node logic.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4, CopilotKit v2
- **Backend**: LangGraph (Python), FastAPI/uvicorn via `serve.py`
- **Transport**: AG-UI protocol via CopilotKit runtime
- **Voice (stretch)**: LiveKit LLMAdapter — additive, not blocking

## Build Order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done (Person B)** — Coach LLM stress-test + proactive nudge enrichment
   with graceful fallback.
3. **Done (Person A)** — reactive Wingman interrupt/answer + opponent roleplay
   - debrief.
4. **Done (shared)** — kind-aware nudge cards, A2UI generative nudge surface in
   Wingman panel and SignalDesk, reactive prompt pre-fill from "Get a reframe".
5. **Done (Person B)** — static context import + approval flow with
   `evidence-fixtures.ts`.
6. **Next (Person B)** — multi-perspective Coach debate (see below) + real
   context ingestion.
7. **Stretch (Person B)** — LiveKit voice adapter. Additive — the demo is
   complete without it.

## Direction: Multi-Perspective Coach Debate

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

## Direction: Context Ingestion

See `docs/CONTEXT_INGESTION.md` for the private import and public research
plan. Treat Composio as a bounded context-ingestion primitive and tools such as
Exa, Firecrawl, and Tinyfish as evidence-retrieval primitives, not live-call
dependencies. The product flow is import/search scoped records, extract an
evidence brief, show it to the user, then write only the approved brief into
shared LangGraph state.

The near-term demo uses static evidence fixtures (`frontend/src/fixtures/evidence-fixtures.ts`
and `backend/graph/context.py` if present) so the Coach and Wingman surfaces can
show the import/approval flow without OAuth or data-retention risk.

## Known Gaps

- **Context ingestion** — static fixtures only; real OAuth/Composio/Exa/Firecrawl
  retrieval is future work.
- **A2UI action forwarding** — the "Get a reframe" action is handled locally in
  the UI (pre-fills and opens the reactive prompt). It is not yet forwarded to
  the agent as an `a2uiAction`.
- **LiveKit voice** — not wired; typed turns are the supported input path.
