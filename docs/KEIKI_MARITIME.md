# Keiki × Maritime — Mettle entry

## Programme

| Field                | Value                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Programme**        | Keiki × Maritime — build an always-on personal or business agent                        |
| **Goal**             | Reach 1,000 users in six weeks                                                          |
| **Programme starts** | October 20, 2026                                                                        |
| **Programme ends**   | December 1, 2026                                                                        |
| **Duration**         | Six weeks                                                                               |
| **Prize**            | Up to $20,000 LLM credits + three-day trip to San Francisco (top 3 qualifying projects) |
| **Application**      | Completed — accepted into the programme                                                 |
| **Competition**      | https://competition.maritime.sh/                                                        |

## User baseline (transparent)

| Metric                                | Value |
| ------------------------------------- | ----- |
| **Users at programme start (Oct 20)** | 0     |
| **Users as of today**                 | 0     |
| **Target by Dec 1**                   | 1,000 |

We are starting from zero. Every user count below is real, instrumented via `/api/telemetry` and `[mettle:telemetry]` structured logs (`utm_source=chatgpt_mcp` attribution + one-way hashed client IDs), and updated weekly.

## Weekly tracking

| Week | Starts | Users at start | Users at end | New this week | Cumulative | Milestone                                             |
| ---- | ------ | -------------- | ------------ | ------------- | ---------- | ----------------------------------------------------- |
| 1    | Oct 20 | 0              |              |               |            | First conversation live                               |
| 2    | Oct 27 |                |              |               |            | Coach + Rehearse + Wingman flows instrumented         |
| 3    | Nov 3  |                |              |               |            | Share artifacts (council splits / debrief memos) live |
| 4    | Nov 10 |                |              |               |            | Repeat users ≥ 10% of base                            |
| 5    | Nov 17 |                |              |               |            | 500 cumulative users                                  |
| 6    | Nov 24 |                |              |               |            | 1,000 cumulative users                                |

Update this table every Friday. The "Users at end" for a week becomes "Users at start" for the next.

## Project-specific metrics (feed the weekly table)

| #   | Metric                         | What good looks like                                                                |
| --- | ------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | Conversations started / week   | First meaningful user action — a brief pasted or scenario loaded                    |
| 2   | Mode sessions / week           | Coach, Rehearse (Opponent), Wingman, Debrief — which rooms get used                 |
| 3   | Share artifacts created / week | Council splits + debrief follow-up memos (`share-artifacts.ts`) — the viral surface |
| 4   | Repeat users / week            | ≥2 sessions in 7 days (same user / stable client id if logged)                      |
| 5   | Off-platform clicks / week     | Deep-link to rehearsal / debrief / plans page (not checkout)                        |

## Mapping to existing docs

- `docs/CHATGPT_PLUGIN_PLAYBOOK.md` — "Usage → monetisation scoreboard (Plugin Lane)" tracks the ChatGPT MCP wedge (`meeting_brief` tool). This Keiki × Maritime board is the **user-growth** board; the plugin board is the **distribution** board. Both roll up into the same weekly user count.
- `docs/NORTH_STAR.md` — the personal agent for conversations you can't afford to get wrong. The Keiki × Maritime goal is a growth forcing function on that north star, not a pivot.
- `frontend/AGENTS.md` — Next.js breaking-changes notice; unrelated to this initiative.

## Notes

- This file is the single source of truth for Keiki × Maritime user tracking in Mettle. Do not restate the user-count table elsewhere.
- Update weekly. If a week is missed, note the gap honestly rather than backfilling.
