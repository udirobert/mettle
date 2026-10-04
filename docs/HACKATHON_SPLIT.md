# Hackathon Work Split — Build Personal Agents

Three devs, one repo, ~5 hours of hacking, submissions 4:30 PM.

**The one rule:** the demo must never depend on the riskiest item. Every rung
of the build is a complete, demoable product on its own — see the fallback
ladder at the bottom.

## The product

Mettle — the personal agent for the conversations you can't afford to get
wrong. Demo wedge: a salary negotiation with your manager (Dana). The agent
has its own inbox (AgentMail), does its own homework (Exa research), remembers
your last hard conversation (Neon Postgres), and emails you the debrief
(AgentMail). LangGraph counsel agent + Mastra scout agent, both over AG-UI.

Pitch hook: the event description jokes "manage your relationships... ok maybe
not that one." We built that one.

## Kickoff — first 30 min, all hands

1. **Claim credits** at build-personal-agents.com → `.env` (root, gitignored):
   - `OPENAI_API_KEY` = `NEON_AI_GATEWAY_TOKEN` (`nt_live_...`)
   - `OPENAI_BASE_URL` = `<NEON_AI_GATEWAY_BASE_URL>/v1` (append `/v1` to the
     bare branch host)
   - `OPENAI_MODEL=gpt-5-mini`
   - `DATABASE_URL` = Neon Postgres connection string
   - `EXA_API_KEY`, `AGENTMAIL_API_KEY`
2. **Devin lands the state contract commit** — adds to `state.py` and mirrors
   in `use-conversation-state.ts`:
   - `EvidenceClaim.provenance: "inbox" | "paste" | "web" | "memory" | "stated"`
   - `scout_log: list[ScoutEvent]`
   - `agent_inbox_address: str`
   - `counterpart_history_ref: str`
     Everyone pulls before branching. Per COLLABORATION.md protocol.
3. **Devin stubs all three routes** returning the pinned shapes below with
   fixture data — Dev B builds against stubs immediately, real services land
   later without the UI noticing.

## Pinned contracts (build against these, not each other)

```
POST /context/import
  → { event: { scenario_id, stakes, counterpart_profile },
      brief: ContextBrief }          # all claims decision:"pending", provenance:"inbox"
  degraded: { event: null, brief: null, degraded: true, reason: "no AGENTMAIL_API_KEY" }

POST /context/research   body: { topic, counterpart_name?, organization? }
  → { claims: EvidenceClaim[] }      # provenance:"web", source_ids = Exa URLs
  degraded: { claims: [], degraded: true }

POST /debrief/memo   body: { to: string }
  → { sent: true, message_id: string }
  degraded: { sent: false, degraded: true }

ScoutEvent = { ts: string, actor: "scout", action: string,
               detail: string, sources?: string[] }
```

Scenario contract: `scenarios/salary_review.md` — markdown + YAML frontmatter
matching `lp_renewal.md` exactly: `stakes`, `counterpart_name`,
`counterpart_role`, `counterpart_style`, `counterpart_leverage`,
`counterpart_concerns` (list), `user_weak_points` (list). The loader picks it
up automatically by filename.

## Lane A — Devin: backend ingestion ("the pipes")

Branch: `hack/ingestion`. **Owns:** `backend/context/**`, new routes in
`serve.py`, `scenarios/salary_review.md` (draft), seed Dana thread fixture.

- `agentmail_client.py` — provision/read inbox; `messages.list` **polling**
  (no webhooks — survives venue wifi, no public URL needed)
- `ingestion.py` — forwarded thread → normalized `ContextSource`s
- `research_client.py` — Exa `search(auto, contents={"highlights": True})`
  → `EvidenceClaim`s, `provenance="web"`
- Routes: `/context/import`, `/context/research`, `/debrief/memo`
- Debrief memo: `client.inboxes.messages.send(...)`
- **Every function returns None/empty on missing creds.** Routes return 200
  with `degraded: true`, never 500. Match `llm.py`'s pattern.

## Lane B — Dev 2: frontend & scenario ("the product")

Branch: `hack/product`. **Owns:** `frontend/src/**` (except
`api/copilotkit/route.ts`, shared with Dev C at merge window).

- `salary-event.ts` fixture + event-list hero swap → "The conversations that
  matter" docket; Elena demoted to contrast card
- **Scout log component** — renders `state.scout_log` on event card / coach
  room header ("Read your thread with Dana — 9 claims · 3 public sources ·
  1 remembered commitment")
- **Provenance badges** on claims in `coach-panel.tsx` (inbox / web / memory /
  paste icons)
- "Send me the memo" button in `debrief-view.tsx` → `POST /debrief/memo`
- Copy pass: welcome overlay, phase hints, private-mode framing
- **Owns the demo**: 2-min script, submission portal text, and the seed Dana
  email thread (polish Devin's draft — it's the demo's first beat)

## Lane C — Dev 3: agent infrastructure ("the new agent")

Branch: `hack/agent-infra`. **Owns:** `scout/` (new dir), `backend/graph/
checkpoint.py`, `backend/context/memory.py`.

- Verify `DATABASE_URL` → `PostgresSaver` boots; write `memory.py` —
  counterpart-history table (commitments, changed assumptions, counterpart
  name) + read helpers for ingest / write helpers for debrief
- `scout/` — Mastra agent over `@ag-ui/mastra` (verified in-tree): watches
  AgentMail, triages,
  calls Lane A's `/context/import` + `/context/research`, writes `scout_log`
  events into shared state
- Register the scout in the CopilotKit runtime — **not** a second
  `HttpAgent`: Mastra's `/copilotkit` route is a full CopilotKit runtime, so
  use `MastraAgent.getRemoteAgents({ mastraClient })` (needs
  `@mastra/client-js` + `@ag-ui/mastra`; snippet in `scout/README.md`).
  Shared-file touch on `route.ts`; coordinate at merge window 2. Dev B uses
  `scout` as the agent key when rendering the log.
- **Hard checkpoint at 90 min**: Mastra AG-UI streaming or cut. Fallback =
  Lane A's FastAPI poll endpoint _is_ the scout; the log says "Scout" either
  way. A stalled Mastra port costs the demo nothing.

## Timeline

| Time  | Gate                                                            |
| ----- | --------------------------------------------------------------- |
| +0:30 | Contract commit + stub routes merged; everyone on their branch  |
| +1:30 | Merge window 1: stubs + env swap on main; Dev B builds vs stubs |
| +2:00 | Dev C Mastra checkpoint: streaming or fallback                  |
| +3:00 | Merge window 2: feature freeze, everything on main              |
| +3:30 | Integration pass + two full demo rehearsals                     |
| +4:00 | Submission written; buffer for portal                           |

## Merge rules

- Short-lived branches, merge only at the two windows. Push early, push often.
- **File ownership is strict.** If you need a change in someone else's file,
  post the needed signature in the group chat — don't edit it.
- Shared files with an owner: `state.py` (Devin, after contract commit),
  `serve.py` (Devin), `route.ts` (Dev C, merge window 2 only), `page.tsx` +
  components (Dev B).
- `uv add`/`npm i` only in your lane's manifest; flag new deps in chat.
- Broken main > your feature: whoever breaks main fixes main before
  continuing their own work.

## Fallback ladder — every rung is a demo

1. Existing app + `salary_review` scenario + paste path — works today
2. - Neon AI Gateway LLM + Postgres checkpointer (env only)
3. - Exa research claims in the keep/reject gate
4. - AgentMail inbox ingestion + debrief memo by email
5. - Mastra Scout + scout log + counterpart memory

Aim for rung 5. Ship whatever the top working rung is at 4:00.

## Demo arc (Dev B owns; everyone builds toward it)

"The invite joked about an agent that manages your relationships — 'ok maybe
not that one.' We built that one. I have a salary review Thursday. I forwarded
my manager's email thread to my agent's own inbox. Its scout read the thread,
pulled public comp-band research, and flagged a commitment I forgot I made.
Its council — a skeptic, my manager's persona, a negotiator — just told me my
anchor is too low and she'll counter on title, not cash. Watch me rehearse
against her... and after the real conversation, it emails me the debrief.
It remembers everything. Some things you can't delegate — for those, you get
counsel."
