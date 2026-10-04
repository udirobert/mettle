# Mettle — The Personal Agent for Conversations You Can't Afford to Get Wrong

## Purpose

Mettle is a personal counsel agent for the conversations only you can have —
asking for the raise, the landlord dispute, the co-founder reset, a rough
board update. Where every other personal agent delegates tasks _for_ you,
Mettle stands _next to_ you in the moments you can't delegate.

See `docs/NORTH_STAR.md` before making major product or frontend changes.
Mettle should not be positioned as a meeting assistant, inbox manager,
life-admin tool, or generic chat interface. The product starts from
consequential conversations and moves the user through brief, pressure test,
rehearsal, live support, and debrief.

The **demo wedge** is one personal-life event: a salary negotiation with the
user's manager (`salary_review` scenario). Progressive disclosure: Coach and
Rehearse are primary; Live and Debrief are later rooms.

The agent has its own identity: its own AgentMail inbox (forward a thread to
add a conversation), its own homework (claim extraction + Exa research before
you arrive), its own memory (Neon Postgres — commitments and counterpart
history persist), and its own voice (it emails you the debrief memo).

The agent operates in five modes:

- **Scout** — watches the agent's own AgentMail inbox for forwarded threads,
  triages them into docket events, extracts evidence claims, and runs scoped
  Exa research. Implemented as a separate Mastra agent (AG-UI via
  `@mastra/agui`) alongside the main graph. Drafts only — the user approves
  every claim.
- **Coach** — adversarial council (Skeptic, Counterpart, Negotiator) then
  synthesis that surfaces disagreement; grounded only in human-kept claims.
- **Opponent** — roleplays the counterpart for rehearsal, in character,
  persona built from the real thread + research.
- **Wingman (reactive)** — supports the user during the real conversation; user
  types a fragment, gets a fast targeted response.
- **Wingman (proactive)** — watches the live transcript, surfaces nudges
  unprompted when a pattern is worth flagging (repetition, long monologue,
  conceded number), rate-limited to avoid noise.
- **Debrief** — post-conversation summary of commitments, changed assumptions,
  and next actions. Closes the loop twice: emails the memo via AgentMail, and
  writes counterpart memory to Neon Postgres.

## Architecture

Flat project with a Next.js frontend in `frontend/` and a Python LangGraph
backend in `backend/`. CopilotKit (CoAgents / AG-UI) shares the graph's state
live with the React UI. A second agent (the Mastra Scout) registers beside the
main agent in the CopilotKit runtime.

```
/backend
  /graph
    state.py              # shared LangGraph state schema — the contract
    scenarios.py          # deterministic scenario loader (salary_review, lp_renewal)
    context.py            # paste → draft evidence brief (deterministic extract)
    coach.py              # Coach council — perspectives then synthesize
    opponent.py           # Opponent node — in-character counterpart
    wingman_reactive.py   # reactive Wingman nodes (interrupt + answer)
    wingman_proactive.py  # proactive trigger evaluation + A2UI surface emit
    debrief.py            # post-conversation node (+ memo, memory write)
    graph.py              # top-level phase router wiring all nodes
    checkpoint.py         # PostgresSaver via DATABASE_URL (Neon) + memory fallback
  /context                # ingestion stack (planned)
    agentmail_client.py   # agent inbox: fetch threads, send debrief memo
    research_client.py    # Exa scoped search → research claims
    ingestion.py          # forwarded thread → normalized sources
    memory.py             # counterpart history via Neon Postgres
    safety.py             # prompt-injection filtering + redaction
  /triggers
    rules.py              # deterministic proactive nudge rules
  /voice
    livekit_adapter.py    # LiveKit LLMAdapter seam — stretch goal
  /tests                  # pytest specs — run with: python -m pytest
  main.py                 # LangGraph server entrypoint (graph id: conversation_agent)
  serve.py                # local FastAPI AG-UI endpoint + /extract-context + /context/*
  server_config.py        # CORS / environment guards
  langgraph.json
/scout                    # Mastra agent (planned) — inbox watch + triage, AG-UI
/frontend
  /src
    /app
      page.tsx            # event docket + phase rail (Coach/Rehearse now;
                          # Live/Debrief later) + slim signal desk
      layout.tsx          # CopilotKit provider wiring
      api/copilotkit/     # CopilotKit runtime route → HttpAgent(s)
      api/extract-context/# paste extract proxy → agent /extract-context
    /components
      coach-panel.tsx          # claim HITL + staged council
      opponent-chat.tsx        # Opponent rehearsal
      wingman-side-panel.tsx   # one intervention hero; transcript folded
      debrief-view.tsx         # next move hero; record folded; memo send
      event-list.tsx           # docket: salary-review hero; scout log surface
      nudge-card.tsx           # kind-aware nudge card (panel + signal variants)
      a2ui-catalog.tsx         # A2UI catalog definition for NudgeCard
      a2ui-nudge-host.tsx      # consume AG-UI a2ui-surface messages
      ui/                      # reusable shadcn primitives
    /fixtures
      salary-event.ts          # default Dana salary-review event (planned)
      lp-event.ts              # Elena Park event (kept as contrast)
      evidence-fixtures.ts     # legacy static research fixtures
    /lib
      extract-evidence.ts      # local paste extract fallback
      share-artifacts.ts       # council split + follow-up memo
    /hooks
      use-conversation-state.ts  # typed wrapper around CopilotKit shared state
      use-theme.tsx
/scenarios
  salary_review.md        # primary demo scenario (planned)
  lp_renewal.md           # original scenario, kept as contrast
```

## Testing

```bash
cd backend && uv run python -m pytest tests/ -q
```

90 tests pass. `test_coach.py` covers scenario loading, debate fields, and the
perspectives→synthesize stage; `test_context.py` covers paste extract, claim
decisions, and evidence grounding; `test_proactive.py` covers trigger rules,
ingestion, enrichment fallback, and A2UI emit.

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
    coach_stage: NotRequired[Literal["idle", "debating", "perspectives", "ready"]]
    context_brief: NotRequired[ContextBrief]
    # Scout additions (planned)
    scout_log: NotRequired[list[ScoutEvent]]
    agent_inbox_address: NotRequired[str]
```

`EvidenceClaim` includes `decision: pending | approved | rejected` and gains
`provenance: inbox | paste | web | memory | stated`. Coach prompts only receive
kept claims after the brief `status` is `approved`.

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
  `copilotkit.a2ui` and rendered through `A2UINudgeHost` / `NudgeCard`.
- **Coach claim gate (HITL)**: paste extract proposes claims; the user keep/rejects
  each claim; only then does `runCoach` write an approved brief and run the
  council. Re-debate reuses the kept brief. Forwarded threads and Scout
  research land in the same gate.
- **Checkpointer**: `checkpoint.py` uses `PostgresSaver` when `DATABASE_URL`
  (Neon) is set, `MemorySaver` otherwise. Interrupts require a checkpointer;
  Postgres makes them durable across restarts.

## LLM Integration

All LLM calls go through `backend/graph/llm.py` (`get_llm()`), which returns
`None` when no `OPENAI_API_KEY` is set. Every call site wraps invocations in
try/except with deterministic fallback — the graph never crashes because the
LLM is unavailable.

Provider: **Neon AI Gateway** (OpenAI-compatible). Map its credentials onto
the existing env wiring — no code changes:

```bash
OPENAI_API_KEY=$NEON_AI_GATEWAY_TOKEN           # nt_live_...
OPENAI_BASE_URL=${NEON_AI_GATEWAY_BASE_URL}/v1  # append /v1 to bare branch host
OPENAI_MODEL=gpt-5-mini
```

Node behavior:

- **Coach** (`coach.py`): `coach_perspectives` → `coach_synthesize`. Three
  adversarial perspectives run in parallel (`llm.batch`), then synthesis
  produces structured `CoachAnalysis`. Falls back to `FALLBACK_ANALYSIS`.
  Approved evidence from `context_brief` is injected into perspective prompts.
- **Context** (`context.py`): deterministic paste extract (no LLM required).
  `POST /extract-context` on `serve.py`; frontend proxies via
  `/api/extract-context` with a local fallback.
- **Opponent** (`opponent.py`): in-character counterpart turn conditioned on
  the scenario profile, approved counterpart history, and recent transcript.
- **Proactive** (`wingman_proactive.py`): rules pass → LLM enrichment (max 2
  sentences, references the specific turn and counterpart concerns). Falls
  back to rules message.
- **Debrief** (`debrief.py`): reads transcript + nudges → commitments, changed
  assumptions, next actions → memo via AgentMail + memory write.

## Context Ingestion

See `docs/CONTEXT_INGESTION.md`. Ranked sources:

1. **Forward a thread → AgentMail** (primary). The user forwards correspondence
   to the agent's own address; Scout pulls it via `messages.list` or webhook,
   drafts the event and claims.
2. **Paste → `/extract-context`** (fallback, shipped). Deterministic extract.
3. **Scenario fixtures** for instant demos.

Public research via **Exa** (`exa-py`, `search` with `auto` type +
`contents={"highlights": True}`) produces provenance-labeled claims that join
the same keep/reject gate. Never an always-on scanner or free-roaming browser.

## Team Split

- **Person A (reactive + opponent + live UX)**: `wingman_reactive.py`,
  `opponent.py`, `wingman-side-panel.tsx`, pocket-wingman live surface.
- **Person B (scout + coach + context + memory)**: `coach.py`, `context/`,
  `wingman_proactive.py`, `triggers/rules.py`, `/scout` Mastra agent,
  AgentMail + Exa integration, Neon memory, Coach/evidence UI, scout log UI.

Both work against the same `state.py` contract and `scenarios/salary_review.md`.

## Development

```bash
cd frontend
npm install
npm run install:agent   # explicit: uv sync in backend/
npm run dev             # Next.js (3000) + AG-UI endpoint via serve.py (8123)
```

`npm run dev:agent` now runs `backend/serve.py` (uvicorn + FastAPI + LangGraphAGUIAgent)
instead of `langgraph-cli dev`. The `HttpAgent` in `api/copilotkit/[[...slug]]/route.ts`
points at `http://localhost:8123/`. When the Scout ships, a second `HttpAgent`
(or Mastra's own AG-UI endpoint) registers beside it.

Backend deps to add for the new stack: `exa-py`, `agentmail`. Credentials in
`.env` (gitignored): `NEON_AI_GATEWAY_*`→`OPENAI_*`, `DATABASE_URL`,
`EXA_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, `TAVILY_API_KEY`.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4, CopilotKit v2 (AG-UI)
- **Backend**: LangGraph (Python), FastAPI/uvicorn via `serve.py`
- **Scout agent**: Mastra (TypeScript) over AG-UI — separate process/agent
- **LLM**: Neon AI Gateway (OpenAI-compatible chat completions)
- **Persistence**: Neon Postgres (`PostgresSaver` + counterpart memory)
- **Ingestion**: AgentMail (agent inbox) + Exa (public research)
- **Transport**: AG-UI protocol via CopilotKit runtime
- **Stretch**: Executor (MCP gateway), Assistant UI, Fly sprites, LiveKit voice

## Build Order

1. **Done** — graph skeleton + state contract + scenario + frontend shells.
2. **Done** — Coach stress-test + proactive nudge enrichment with fallback.
3. **Done** — reactive Wingman interrupt/answer + opponent roleplay + debrief.
4. **Done** — kind-aware nudge cards, A2UI generative nudge surface, reactive
   prompt pre-fill from "Get a reframe".
5. **Done** — multi-perspective Coach debate + paste claim-level HITL +
   progressive disclosure + shareable council split and debrief memo.
6. **Now — hackathon reposition (personal agent)**:
   - a. Neon AI Gateway env swap + Neon Postgres `DATABASE_URL` (env only)
   - b. `scenarios/salary_review.md` + `salary-event.ts` fixture + docket copy
   - c. AgentMail inbox → `/context/import` → draft claims (same HITL gate)
   - d. Exa `research_client.py` → research claims (same gate)
   - e. Scout log UI + claim `provenance` labels
   - f. Debrief memo send via AgentMail
   - g. Mastra Scout agent over AG-UI beside `conversation_agent`
   - h. Counterpart memory via Neon Postgres
7. **Stretch** — Executor MCP gateway, Assistant UI surfaces, Fly sprites,
   LiveKit voice. Additive — the demo is complete without them.

## Multi-Perspective Coach Debate (shipped)

The Coach phase has time budget — the user is preparing, not in the moment.
This is where multiple adversarial perspectives earn their cost. Wingman (live)
is the wrong place for debate: latency matters and the two-stage rules→LLM
pipeline already provides a cheap "second perspective."

### Why not a single agent

A single LLM agent tends to anchor on one framing and toward encouragement
(because that feels helpful). Multiple perspectives force the system to
confront failure modes a single agent would miss.

### Design: three fixed adversarial perspectives + synthesis

No free-form back-and-forth rounds. Three parallel perspectives, then one
synthesis pass — all in Coach where latency is acceptable.

1. **The Skeptic** — finds the strongest argument against the position.
2. **The Counterpart** — speaks in first person as the real person from your
   thread (persona built from approved claims + research); tests whether the
   plan survives contact with their priorities.
3. **The Negotiator** — tactical empathy; catches the case where a logically
   perfect ask still makes them defensive.

**Synthesis** surfaces agreement and disagreement explicitly. UI hero:
they agreed / they split / the move.

## Known Gaps

- **Scout agent (Mastra)** — inbox watch currently planned as a FastAPI poll
  in `serve.py` first; the Mastra AG-UI agent takes over when it lands.
- **Counterpart memory** — schema for persisted commitments/history in Neon
  not yet defined.
- **A2UI action forwarding** — "Get a reframe" is handled locally in the UI;
  not yet forwarded to the agent as an `a2uiAction`.
- **LiveKit voice** — not wired; typed turns are the supported input path.
