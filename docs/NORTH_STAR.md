# Mettle North Star

Mettle is a stakes-aware calendar and live counsel layer for conversations you
cannot afford to get wrong.

It is not a scheduling tool, meeting recorder, transcript archive, or generic AI
chat interface. Mettle exists for the handful of conversations where money,
trust, control, reputation, or career trajectory can change in one hour.

## Category Position

The meeting software market already has strong incumbents:

- Scheduling and routing: Calendly, Chili Piper, SavvyCal, Cal.com.
- Notes, summaries, and action items: Fellow, Otter, Granola, Fathom,
  Fireflies, Read.ai.
- Sales conversation intelligence: Gong, Chorus, Avoma, Clari Copilot.
- Calendar optimization: Reclaim, Motion, Clockwise.

Mettle should not compete on booking links, generic transcription, searchable
meeting archives, collaborative agendas, or action-item extraction for every
meeting.

Mettle should own a narrower and more consequential wedge:

> Private, calendar-native counsel for high-stakes conversations before,
> during, and after the moment.

## The Calendar Insight

Normal calendars flatten reality. A dentist appointment, social coffee, board
meeting, LP renewal, investor pitch, and difficult performance conversation all
receive the same visual treatment.

Mettle unflattens the calendar by identifying which conversations deserve
preparation, rehearsal, live support, and follow-up.

The product should start from:

> Your consequential conversations.

Not all events. Only the ones where the downside or upside justifies a dedicated
prep flow.

## Core Loop

Each important calendar event becomes a strategic workspace:

1. `Triage`: Is this conversation consequential?
2. `Brief`: What are the stakes, evidence, counterpart profile, leverage, and
   prior commitments?
3. `Pressure Test`: Where will the user's position break?
4. `Rehearse`: How will the counterpart push back?
5. `Live`: What should the user notice or avoid in the moment?
6. `Debrief`: What changed, what was promised, and what should happen next?

The four agent modes map into this event loop:

- Coach prepares the event.
- Opponent rehearses the event.
- Wingman supports the event live.
- Debrief closes the event.

## Product Differentiation

Calendly asks: "How do we get the right meeting booked?"

Fellow, Otter, Granola, Fathom, and Fireflies ask: "What happened in the
meeting?"

Gong and Chorus ask: "What happened across revenue conversations?"

Mettle asks:

> Which conversations matter, how do I prepare to win them, and what should I
> not miss or say in the moment?

That question should shape the interface, copy, data model, and roadmap.

## Frontend North Star

The app should feel like a focused conversation flow, not a dashboard.

First screen:

> Your consequential conversations.

Each event card should expose:

- Title and counterpart.
- Time until conversation.
- Stakes.
- Risk level.
- Preparation status.
- Evidence status.
- Recommended next move.

Selecting an event should open one primary flow. Avoid showing every phase and
every panel at equal weight. The UI should feel like moving through a disciplined
preparation room, not monitoring a dashboard.

Suggested demo events:

- `Elena Park - LP renewal`: $40M at risk, second-largest LP, prep incomplete.
- `Board update`: confidence risk, burn extension, hiring miss.
- `Founder investor pitch`: skeptical investor, valuation pressure, crowded
  market objection.

Low-stakes calendar items should be visible only as contrast or not shown at
all. Mettle's first impression should be that it filters noise.

## Form Factor Direction

The web app is the command center, not the whole product.

Longer-term surfaces:

- Calendar layer: detects and ranks consequential meetings.
- Chrome extension: captures context from Gmail, Calendar, LinkedIn, Docs, CRM,
  and decks.
- Live Signal Desk: small focused surface during the call with one high-value
  nudge at a time.
- Wearable or mobile companion: later, only after the live nudge model proves
  valuable.

Onchain and agentic primitives may be useful later for verifiable delegation,
auditable agent actions, paid advisor-agent marketplaces, or evidence
provenance. They should not lead the UX until the high-stakes conversation wedge
is working.

## Design Principles

- Start with consequence, not chat.
- Show fewer things with higher confidence.
- Make the stakes explicit.
- Ground advice in approved evidence.
- Separate private evidence from public research.
- Treat the live mode as a restraint exercise: one timely nudge beats ten
  observations.
- Make debriefs action-oriented: commitments, changed assumptions, follow-up
  memo, next move.
- If a screen could be reused for generic meeting notes or customer support,
  sharpen it until it only makes sense for high-stakes conversations.

### Restraint (from user testing: "verbose, overwhelming")

The answer is the product; the reasoning is there when asked for.

- **One job per screen.** Each screen answers "what do I say or do next?"
- **The walk-in card is the standard output.** Brief, Spar and Close all reduce
  to: one opening, up to three if-then lines, one "don't".
- **One "Show working" per screen.** Adversaries, split, pressure test and
  evidence live behind a single disclosure — never several stacked folds.
- **Word budgets.** Headline ≤ 8 words, any line ≤ 20, lists ≤ 3 items;
  under ~60 visible words on home and ~90 on the brief verdict.
- **Show, don't narrate.** Prefer artefacts and motion to sentences: the raise
  bar ($ committed / target), the pattern dots (objection hit 3 of 4 LPs), the
  card dealt onto the table with lines read out in sequence.
- **Explain once.** Helper copy appears on first use, then gets out of the way.
- **One note per Spar turn.** The conversation breathes between nudges.
- **Motion has one job:** sequence information. All of it respects
  `prefers-reduced-motion`.
- **Test:** a user should be able to say what they'd say first within 5
  seconds on any screen.

### First run (from user testing: "what is this for?")

A new visitor gets three answers, in order, in roughly 20 words each:

1. **What is it?** Promise line + one sub-line, with a real walk-in card as the
   hero artefact — show the output, don't describe it.
2. **Can I feel it?** One-sentence scene ("You're raising a fund…"), labelled
   sample data, and one primary action: a 60-second rehearsal.
3. **Is it for me?** After three rehearsal turns, hand off to a real meeting
   ("Paste a real thread").

Terms are defined on first use (Card / Rehearse / Prep by time-to-meeting).
The intro shows once (`mettle.intro.seen`) and is reopened via "What is
Mettle?". Share previews carry the same promise (title, description, OG image).

### Craft (one world, one kit)

Mettle is a theatre. Each stage of the meeting is a place in it:

| Screen   | Place             | The one thing on stage                 |
| -------- | ----------------- | -------------------------------------- |
| Intro    | The plan          | The room from above, card on the table |
| Home     | Call sheet        | Upcoming meetings, pinned              |
| Prep     | Writers' room     | Three adversaries around the table     |
| Rehearse | Rehearsal floor   | Her seat, yours, the sightline between |
| Live     | Backstage (dim)   | Your lines, within reach               |
| Close    | Notes session     | What landed; the card filed            |

Build from the kit in `globals.css` (Craft kit), never a one-off:

- **Pieces:** `mettle-plan` (floor-plan grid), `mettle-spike` (tape mark —
  "act here next"), `mettle-seat` (--them coral / --you cobalt), `mettle-note`
  (taped director's note for feedback), `mettle-stamp` (step done),
  `mettle-label` (the one mono label voice). Primary buttons press in.
- **Motion — four moves, one job each:** `mettle-deal` (an artefact lands),
  `mettle-line-in` with `--i` (lines read out in order), travel (a turn
  crosses the sightline), tape pulse ("you're up"). Motion only shows order
  or turn-taking — never decoration. One entrance sequence per screen.
  Reduced motion switches it all off.
- **Before building a screen, answer:** where in the theatre are we, and
  what's the one thing on stage?

## Product Language

Preferred positioning:

> Mettle is a stakes-aware calendar for conversations you cannot afford to get
> wrong.

Alternate lines:

- Live counsel for make-or-break business conversations.
- The preparation and judgment layer for consequential meetings.
- A private counsel desk for high-stakes conversations.
- The calendar layer for meetings you cannot afford to wing.

Avoid:

- AI meeting assistant.
- Meeting notes copilot.
- AI chatbot for conversations.
- Sales call summarizer.
