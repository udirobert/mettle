# Holistic pass — two-dev split

Date: 2026-10-05. Branches: Slice A `feat/holistic-pass`, Slice B `feat/trust-pass`.
Both start from the contract commit. Merge A first, then B.

Goal: close the gap between the product story (the agent has an inbox, does
research, remembers) and what the demo shows (fixtures that look like real
work). Strengthen the trust story that is already Mettle's best asset.

## Slice A — Scout and the docket (agent work becomes visible)

| #   | Work                                                                                                                                                         | Files                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1   | Live / degraded / sample status chips on the docket and Scout log, driven by `GET /scout/status`. The fixture `SALARY_SCOUT_LOG` stops passing as real work. | `event-list.tsx`, `scout-log.tsx`                      |
| 2   | Inbox-driven docket: a forwarded thread becomes a draft event card ("From your inbox · Dana") that opens into prep.                                          | `event-list.tsx`, `app/api/scout/*`                    |
| 5   | Memory panel: "What I remember about Dana" + Forget. Moves the browser-local carry-forward into backend memory.                                              | `dossier.tsx`, `context/memory.py`, `app/api/memory/*` |
| 8   | Scout release UI: approval card for the briefing gate (`alertdialog`), states what happens before and after the decision.                                    | new component, `app/api/scout/*`                       |

## Slice B — Trust and evidence (the user decides what to believe)

| #   | Work                                                                                                                                                                                                                          | Files                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 4   | Claim citations: quoted snippet, highlighted phrase, link, fetch time. Ingestion and research write the fields below.                                                                                                         | `coach-panel.tsx`, `context/ingestion.py`, `context/research_client.py`          |
| 6   | "Council is using 7 of 12 claims" + per-claim include toggles. Replaces blind "approve all".                                                                                                                                  | `coach-panel.tsx`                                                                |
| 3   | Quote-backed commitments: a debrief commitment must carry a verbatim transcript line, string-matched; fail closed if absent.                                                                                                  | `graph/debrief.py`, `debrief-view.tsx`                                           |
| 7   | Push-to-talk for live turns via browser speech recognition; "them / me" toggle; disclose that audio goes to the browser vendor.                                                                                               | `wingman-side-panel.tsx`, `opponent-chat.tsx`                                    |
| —   | Hardening: redact `String(err)` in `/api/agent` degraded responses; "copy debug report"; focus traps and claim-specific labels; first frontend tests (share-link round trip, pending claims never reach Coach); `?demo=fail`. | `app/api/agent/[...path]/route.ts`, `welcome-overlay.tsx`, `journey-tracker.tsx` |

Not doing: social preview cards for share links. The link is URL-fragment-only
so the server cannot read it; a preview would mean storing content server-side,
which contradicts the privacy promise.

## Pinned contracts (already on `feat/holistic-pass` — branch from it)

### 1. Claim citation fields

Added to `EvidenceClaim` in `backend/graph/state.py` and mirrored in
`frontend/src/hooks/use-conversation-state.ts`. All optional.

```
quote?: string        // verbatim passage the claim rests on
source_url?: string   // http/https only
fetched_at?: string   // ISO-8601
```

Slice B writes them (ingestion + research) and renders them. Slice A never
touches these. Absent on pasted/stated claims — render nothing, not a blank.

### 2. Memory routes (built, tested, always 200)

```
GET    /memory/{ref} -> { ref, found: bool, history?: {ref, counterpart_name,
                          commitments[], assumptions[], notes[]}, degraded?, reason? }
DELETE /memory/{ref} -> { ref, deleted: int, degraded?, reason? }
```

`ref` is the normalized counterpart name (`dana-reyes`); a raw name also works.
No database = `degraded: true`, never a 500. `found:false` without `degraded`
means "nothing remembered yet".

### 3. Scout endpoints (Mastra, `:4111`) — Slice A proxies these

```
GET  /scout/status                      -> { storage, models[], backend:{reachable,url}, summary }
POST /scout/run                         -> { scout_log: ScoutEvent[] }        (LLM-free)
POST /scout/brief                       -> { runId, status:"awaiting_approval", title, summary, scout_log }
POST /scout/brief/:runId/decision {approved:boolean}
                                        -> { runId, status:"done", released, scout_log }
```

`ScoutEvent.action` values: `read_thread | flagged_commitment | researched |
skipped | quarantined | released_brief | discarded_brief`.

## Status (updated 2026-10-05)

**Slice A: done, committed `f31f011` on `feat/holistic-pass`.** Verified in an
isolated checkout: typecheck clean, 14 frontend + 119 backend tests, production
build passes, and the flow was exercised in a real browser (status chip,
sample-thread card, Scout approval card with focus moving into it, release
adding the log). Dry-run merge against `feat/trust-pass`: no conflicts.

Known limits of Slice A:

- The docket's inbox card calls `POST /context/import` on load, so it shows the
  bundled sample thread until AgentMail is configured. It says so.
- Opening an inbox draft uses `scenario_id: "inbox_thread"`; the Coach falls
  back to the stakes/profile already in state (`scenario_for_state`).

### Memory identity (follow-up to Slice A)

A counterpart is a **name plus an organisation**, so two different "Dana"s no
longer share a memory.

- Key: `dana-whitfield--meridianlabs`. The organisation part normalises a
  company name _or_ an email domain to one token: "Meridian Labs, Inc." and
  `dana@meridianlabs.com` both give `meridianlabs`. Free-mail domains identify
  nobody. Logic lives in `backend/context/memory.py` and
  `frontend/src/lib/counterpart-identity.ts`, tested against one shared table.
- Where the organisation comes from: the sender's email domain at inbox import;
  `counterpart_organization` in a scenario file; `counterpartProfile.organization`
  in a frontend fixture. It travels in `counterpart_profile.organization`.
- Lookup at ingest and in the panel tries the qualified record first. Older
  name-only records (written before this) are still found but are marked
  _unconfirmed_ — the panel and the "you previously committed" claim both say
  "matched by name only". Nothing is migrated or deleted automatically.
- `GET/DELETE /memory/{ref}` is unchanged in shape; `ref` may now be qualified.
  It is exact-match: no fallback happens server-side.
- **Forget** removes the record on screen and the browser-local copies for that
  person (saved debrief + carried-over open items), and says how many of each.
  It leaves other people's local data alone.
- Still open: a counterpart with no known organisation can only be matched by
  name (that is what the caveat is for).

## Rules

- **One checkout per dev.** Two devs editing the same working directory
  tangle each other's staging and can commit each other's half-finished work.
  Use `git worktree add .agents/worktrees/<name> <branch>` (exclude it locally
  with `echo .agents/worktrees/ >> .git/info/exclude`), run installs there, and
  commit only from your own worktree.

- File ownership above is strict. Need a change in the other slice's file? Post
  the signature in chat; don't edit it.
- Shared, and therefore careful: `use-conversation-state.ts`. Add fields only;
  never reorder or rename. Rebase before you push.
- Degrade, never 500. Label anything simulated as simulated.
- Tests ship with the change. Backend: `cd backend && uv run python -m unittest
discover tests`. Scout: `cd scout && npm test`.
- Merge order: A, then B. Whoever merges second resolves conflicts.
