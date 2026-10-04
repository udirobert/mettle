# Mettle North Star

Mettle is the personal agent for the conversations you cannot afford to get
wrong.

It is not a meeting assistant, a notes tool, an inbox manager, or a generic AI
chat interface. Mettle exists for the handful of conversations in a person's
life where money, trust, relationships, or self-respect can change in one
hour — the raise you finally ask for, the landlord who kept your deposit, the
co-founder talk you have been avoiding, the family conversation with no safe
script.

## Category Position

The personal-agent market is converging on delegation:

- Inbox, calendar, and task managers: agents that do the boring stuff for you.
- Life-admin automation: booking, shopping, scheduling, reminders.
- Meeting software: notes, summaries, action items (Fellow, Otter, Granola,
  Fathom, Fireflies).
- Sales conversation intelligence: Gong, Chorus, Avoma.

All of them share one assumption: the agent acts _instead of_ you.

Mettle owns the opposite wedge:

> Some things cannot be delegated. For those, you get counsel.

The conversations that matter most are the ones only you can have. Mettle is
the agent that stands next to you in them — before, during, and after the
moment.

## The Agent Identity

Mettle is not a workspace you visit. It is a counterpart — a personal counsel
agent with its own identity and its own habits:

- **Its own inbox.** You forward your agent the thread with your manager, your
  landlord, your co-founder. That is how a conversation enters the docket.
- **Its own homework.** Before you arrive, the agent has already read the
  thread, extracted the claims that matter, and pulled public research on the
  counterpart and the stakes.
- **Its own memory.** The agent remembers your last hard conversation — what
  you committed to, what the other side promised, what assumption broke. The
  next event with the same counterpart starts from that history, not zero.
- **Its own counsel room.** Three adversarial perspectives — a skeptic, the
  counterpart's persona, a negotiator — argue about your plan before the real
  person does.
- **Its own voice.** After the conversation, the agent emails you the debrief:
  commitments made, assumptions changed, next move.

The product is the window into what your agent has already done — and the gate
for what it is allowed to use.

## Core Loop

Each consequential conversation becomes a strategic workspace:

1. `Triage`: Is this conversation consequential? What are the stakes?
2. `Brief`: What is the evidence, the counterpart profile, the leverage, the
   prior commitments — and which of it do you approve the agent to use?
3. `Pressure Test`: Where will your position break? The council argues; you
   watch the disagreement.
4. `Rehearse`: How will the actual person push back?
5. `Live`: What should you notice or avoid in the moment?
6. `Debrief`: What changed, what was promised, and what happens next?

The agent modes map into this loop:

- Scout ingests and researches before you arrive.
- Coach pressure-tests the plan.
- Opponent rehearses the counterpart.
- Wingman supports you in the moment.
- Debrief closes the loop — outward by email, inward by memory.

## Product Differentiation

Inbox agents ask: "What can I take off your plate?"

Meeting assistants ask: "What happened in the meeting?"

Mettle asks:

> Which conversation is keeping you up at night — and how do you walk in
> ready?

That question should shape the interface, copy, data model, and roadmap.

## Frontend North Star

The app should feel like a counsel desk, not a dashboard.

First screen:

> The conversations that matter.

Each event card on the docket exposes:

- Title and counterpart.
- Stakes and why it is consequential.
- How the agent learned about it (forwarded thread, paste, scenario).
- What the agent has already done (claims extracted, research pulled,
  commitments remembered).
- Preparation status and recommended next move.

Selecting an event opens one primary flow through the rooms — Coach, Rehearse,
Live, Debrief — with progressive disclosure. Avoid showing every phase at
equal weight.

### The Scout log

A slim, persistent activity surface shows what the agent did before you
arrived:

> Read your forwarded thread with Dana — 9 claims extracted · Pulled 3 public
> sources on comp bands · Flagged 1 open commitment from March

This is the trust surface: agent work is auditable, not magic. Every claim
that can influence the plan is shown, sourced (inbox vs. public web vs.
user-stated), and gated by explicit keep/reject approval before it reaches
Coach.

### Live: a wingman in your pocket

Personal high-stakes conversations happen across a desk, on a phone, at
dinner — not on a recorded call. Live mode is a narrow, restraint-first
surface: type a fragment, get one targeted response; proactive nudges stay
rate-limited. One timely nudge beats ten observations.

### Debrief: the loop closes twice

- Outward: the agent emails you the follow-up memo from its own address.
- Inward: commitments and changed assumptions are remembered, so the next
  conversation with the same counterpart opens with history, not a blank page.

### Privacy is a feature

Personal-life stakes make confidentiality non-negotiable. The Private/Shared
toggle, claim redaction, and the approve-before-use gate are core product
claims: your hard conversations stay yours.

Suggested demo events:

- `Salary review with Dana`: the raise you finally ask for — comp-band
  research, an anchor the council calls too low, a counter on title not cash.
- `Landlord deposit dispute`: $3,200 and a wall of polite deflection.
- `Co-founder reset`: the conversation you have been avoiding for a quarter.

Low-stakes items appear only as contrast. Mettle's first impression is that it
filters noise.

## Form Factor Direction

The web app is the counsel desk, not the whole product.

- The agent's inbox is the front door: forwarding a thread is how most
  conversations should enter.
- The live wingman is a pocket surface, not a second monitor.
- Longer-term: calendar layer that flags consequential conversations,
  mobile companion, voice input for live fragments.

## Design Principles

- Start with consequence, not chat.
- The agent acts first; the UI shows and gates what it did.
- Show fewer things with higher confidence.
- Make the stakes explicit.
- Ground advice in approved evidence — claim-level approval before anything
  reaches the council.
- Label provenance: private evidence, public research, and user-stated facts
  are never silently blended.
- Treat live mode as a restraint exercise.
- Make debriefs action-oriented and remembered: commitments, changed
  assumptions, follow-up memo, next move.
- Memory is the product: the second conversation with the same counterpart
  should feel materially different from the first.
- If a screen could be reused for generic meeting notes or a task list,
  sharpen it until it only makes sense for high-stakes personal counsel.

## Product Language

Preferred positioning:

> Mettle is the personal agent for the conversations you cannot afford to get
> wrong.

Alternate lines:

- Some things you cannot delegate. For those, you get counsel.
- A personal counsel agent with its own inbox, its own homework, and a memory
  of your last hard conversation.
- The wingman for the moments only you can walk into.
- Yes — the agent that manages your relationships. That one.

Avoid:

- AI meeting assistant.
- Meeting notes copilot.
- AI chatbot for conversations.
- Personal assistant / life-admin automation.
