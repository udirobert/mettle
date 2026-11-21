'use client';

import { useEffect, useRef } from 'react';
import { useConversationState } from '@/hooks/use-conversation-state';
import {
  nudgeToGlassesCard,
  phaseToGlassesCard,
  replyToGlassesCard,
} from '@/lib/glasses-card';
import type { GlassesNudge } from '@/fixtures/glasses-nudges';

/**
 * Rung 5 of the Worn × M6 ladder (docs/WORN_M6.md): taps the live agent
 * streams — proactive nudges (nudges_sent), reactive answers
 * (reactive_reply), phase markers — and pushes each as a whisper-tier card
 * to /api/glasses, where whatever render bridge is attached picks it up.
 *
 * Renders nothing. Priority per update: reactive answer > nudge > phase.
 * Mount state is seeded, so restored sessions don't replay into the relay.
 */
export function GlassesLiveBridge() {
  const { state } = useConversationState();
  const prev = useRef<{ nudge: string | null; reply: string | null; phase: string | null } | null>(
    null,
  );

  useEffect(() => {
    const nudge = state.nudges_sent?.at(-1);
    const reply = state.reactive_reply ?? null;
    const phase = state.phase ?? null;

    const cur = { nudge: nudge?.id ?? null, reply, phase };
    const last = prev.current;
    prev.current = cur;
    if (!last) return; // seed: don't replay restored state into the relay

    const card: GlassesNudge | null =
      reply && reply !== last.reply
        ? replyToGlassesCard(reply)
        : nudge && nudge.id !== last.nudge
          ? nudgeToGlassesCard(nudge)
          : phase && phase !== last.phase
            ? phaseToGlassesCard(phase)
            : null;

    if (card) {
      fetch('/api/glasses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card }),
      }).catch(() => {});
    }
  }, [state.nudges_sent, state.reactive_reply, state.phase]);

  return null;
}
