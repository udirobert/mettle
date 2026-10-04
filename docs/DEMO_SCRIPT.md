# Demo Script — Mettle

Two minutes, one browser tab, four beats. Every beat is a rung on the fallback
ladder, so if a service is down you say so and move down a rung — the demo never
stops.

## Setup before you present

- `hack/product` merged, `AGENT_URL` pointing at the live backend.
- Have the AgentMail inbox address on screen (it shows in the Coach room header
  once `/context/import` has run).
- The seed Dana thread is already bundled server-side, so the inbox beat works
  with **no** credentials. If `AGENTMAIL_API_KEY` is set, forward the thread
  first so it is genuinely in the inbox.

## Beat 1 — The docket (0:00)

Open the app. The docket reads:

> Your docket — **The conversations that matter.**
> A long-deferred raise: $185k base and the senior title — and it lands Thursday.

Dana Whitfield is the hero. Elena is one card down under "Everything else on the
calendar" — that contrast is deliberate: it shows the product ranks conversations
instead of listing them.

**Say:** "The invite joked about an agent that manages your relationships — ok,
maybe not that one. We built that one."

## Beat 2 — The agent already worked (0:20)

The Scout log sits under the hero card: thread received → claims extracted →
homework done → memory checked → **flagged for you**.

The last line is the hook: _"You committed to sending March team-health metrics.
They never arrived — expect this to come up."_

**Say:** "I have a salary review Thursday. I forwarded my manager's email thread
to my agent's own inbox. Its scout read the thread before I opened the app, and
it flagged a commitment I had forgotten I made."

_If AgentMail is unconfigured:_ "No credentials wired — so it's running on the
bundled seed thread. Same pipeline, same output."

## Beat 3 — The keep/reject gate (0:45)

Open Coach. Click **Check my inbox**. Eight claims land, every one badged with
where it came from — inbox, web, memory, pasted, you.

Keep the ones that matter. One is the March metrics commitment. One is the
$185k-above-band objection. Hit **Debate**.

The council lands: Skeptic, Dana, Negotiator. Then the hero card — **They
agreed / They split / The move.**

**Say:** "Its council just told me my anchor is too low and she'll counter on
title, not cash. Title is cheap for her this cycle. That's the insight."

## Beat 4 — Rehearse, then close (1:30)

Rehearse against Dana. Say something you'd actually say. The wingman flags the
concession before you make it.

Then Debrief → generate. Commitments, what's still open, one next move.

Hit **Send me the memo**. With AgentMail configured, it arrives in your inbox
from the agent's own address. Without, it degrades to your mail client and says
so out loud.

**Say:** "After the real conversation, it emails me the debrief. It remembers
everything. Some things you can't delegate — for those, you get counsel."

## If something is down

| Down              | Do this                                                              |
| ----------------- | -------------------------------------------------------------------- |
| AgentMail         | "Running on the bundled seed thread." Inbox beat still lands.        |
| Exa               | Skip the web badge; the rest of the claims are inbox/memory.         |
| Postgres          | Scout log and memory lines go quiet. Say "it's stateless right now." |
| The whole backend | The paste path still works — paste the seed thread. Rung 1.          |

Never debug on screen. Name the missing rung and keep going.

## Rehearsal checklist

- [ ] Both runs done back to back, timing the first at 2:00
- [ ] Inbox address visible before you click Check my inbox
- [ ] `localStorage` cleared so the walkthrough overlay appears for the open
- [ ] Memo recipient address typed before you present
- [ ] Deck line about fallback ladder ready if asked
