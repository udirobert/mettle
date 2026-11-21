/**
 * Canned whisper-tier nudge sequence for the Worn × MicroLumin M6 demo.
 *
 * This is the pinned glasses contract from docs/WORN_M6.md — the same
 * payload the web Wingman emits via a2ui-surface, trimmed to what a
 * mono-green waveguide can hold:
 *
 *   headline ≤ 60 chars (waveguide line limit)
 *   body     ≤ 80 chars (reactive answers only)
 *   ttl_ms   auto-clear; ~8s proactive, sticky reactive
 *
 * The contract is the copy budget, not the transport — any render channel
 * (preview page, SDK push, APK, notification mirror) consumes this shape.
 */

export type GlassesNudge = {
  kind: 'proactive' | 'reactive' | 'phase';
  headline: string;
  body?: string;
  ttl_ms: number;
  /** Operator cue for the scripted demo — never rendered on the glasses. */
  cue?: string;
};

export const GLASSES_NUDGE_TTL = {
  phase: 3000,
  proactive: 8000,
  reactive: 12000,
} as const;

/**
 * Scripted arc for the salary_review scenario (Dana Whitfield).
 * Ordered to mirror the demo: brief marker → live proactive nudges →
 * reactive answers → debrief-ready marker. ~90s at default TTLs.
 */
export const SALARY_REVIEW_GLASSES_SEQUENCE: GlassesNudge[] = [
  {
    kind: 'phase',
    headline: 'BRIEF — DANA WHITFIELD',
    ttl_ms: GLASSES_NUDGE_TTL.phase,
    cue: 'Demo start. Wearer walks in; teammate plays Dana.',
  },
  {
    kind: 'proactive',
    headline: 'March metrics never arrived — she remembers. Own it first.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Dana opens: "Walk me through the scope case."',
  },
  {
    kind: 'proactive',
    headline: 'Anchor at $185k — don’t open lower just to keep it easy.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Wearer states the ask.',
  },
  {
    kind: 'proactive',
    headline: 'Scope and impact, not tenure — she asked for the scope case.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Wearer drifts toward loyalty/effort arguments.',
  },
  {
    kind: 'reactive',
    headline: 'If she cites the band:',
    body: 'VP sign-off exists for above-band. Ask her to take it up.',
    ttl_ms: GLASSES_NUDGE_TTL.reactive,
    cue: 'Dana: "$185k is above the posted band."',
  },
  {
    kind: 'proactive',
    headline: 'She countered on title, not cash — that’s cheap for her.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Dana offers senior title instead of the raise.',
  },
  {
    kind: 'proactive',
    headline: 'Pause — 90 seconds is a monologue. Invite her reaction.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Wearer over-explains the case.',
  },
  {
    kind: 'proactive',
    headline: 'You’ve conceded twice — stop anchoring against yourself.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Wearer says "or whatever works" / drops the number.',
  },
  {
    kind: 'reactive',
    headline: 'If she says "next cycle":',
    body: 'Ask for a dated commitment: number, title, review date.',
    ttl_ms: GLASSES_NUDGE_TTL.reactive,
    cue: 'Dana: "Let’s revisit this next cycle."',
  },
  {
    kind: 'proactive',
    headline: 'That’s a deferral — trade title for a written comp review.',
    ttl_ms: GLASSES_NUDGE_TTL.proactive,
    cue: 'Wearer steers back to a concrete close.',
  },
  {
    kind: 'phase',
    headline: 'DEBRIEF READY',
    ttl_ms: GLASSES_NUDGE_TTL.phase,
    cue: 'Conversation ends; loop closes on the phone.',
  },
];
