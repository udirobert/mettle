'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useConversationState, type ConversationState } from '@/hooks/use-conversation-state';
import { PHASE_LABELS } from '@/lib/phase-labels';
import { demoFailEnabled } from '@/lib/demo';

/**
 * Journey visibility layer.
 *
 * Two primitives that make the four-phase economy legible at all times:
 *  - JourneyTracker: persistent "where am I in the arc" strip. Orientation,
 *    not navigation — the phase rail handles clicks.
 *  - UnlockedToast: announces gate openings the moment they happen, so the
 *    causal link (action → unlock) is felt, not inferred.
 */

export type Phase = 'prep' | 'rehearsal' | 'live' | 'debrief';

const JOURNEY: Array<{ id: Phase; label: string }> = [
  { id: 'prep', label: PHASE_LABELS.prep },
  { id: 'rehearsal', label: PHASE_LABELS.rehearsal },
  { id: 'live', label: PHASE_LABELS.live },
  { id: 'debrief', label: PHASE_LABELS.debrief },
];

export function isPhaseUnlocked(phase: Phase, state: ConversationState): boolean {
  switch (phase) {
    case 'prep':
      return true;
    case 'rehearsal':
      return !!state.coach_analysis;
    case 'live':
      return (state.transcript?.length ?? 0) > 0;
    case 'debrief':
      // A real conversation qualifies even if no nudge ever fired.
      const counterpartTurns = (state.transcript ?? []).filter(
        (turn) => turn.speaker === 'counterpart',
      ).length;
      return (state.nudges_sent?.length ?? 0) > 0 || counterpartTurns >= 2;
    default:
      return true;
  }
}

const UNLOCK_ANNOUNCEMENTS: Record<Phase, string> = {
  prep: '',
  rehearsal: 'Spar is open — take the hardest questions here, privately, before the room.',
  live: 'Live is open — keep it beside you during the real conversation.',
  debrief: 'Close is open — log what you promised before it evaporates.',
};

export function JourneyTracker({ current }: { current: Phase }) {
  const { state } = useConversationState();
  const activeIndex = JOURNEY.findIndex((p) => p.id === current);
  const demoFail = demoFailEnabled();

  return (
    <div className="mettle-journey" aria-label="Conversation journey" role="img">
      {demoFail && (
        <span
          className="mettle-label"
          role="status"
          style={{ color: 'var(--tomato)', marginRight: 12 }}
        >
          Demo: failures simulated
        </span>
      )}
      {JOURNEY.map((phase, index) => {
        const unlocked = isPhaseUnlocked(phase.id, state);
        const done = unlocked && index < activeIndex;
        const active = phase.id === current;
        const stateClass = active
          ? 'mettle-journey-step--active'
          : done
            ? 'mettle-journey-step--done'
            : unlocked
              ? 'mettle-journey-step--open'
              : 'mettle-journey-step--locked';
        return (
          <div key={phase.id} className={`mettle-journey-step ${stateClass}`}>
            <span className="mettle-journey-dot">
              {done ? (
                <Check size={10} strokeWidth={3} aria-hidden="true" />
              ) : !unlocked ? (
                <Lock size={9} aria-hidden="true" />
              ) : null}
            </span>
            <span className="mettle-journey-label">{phase.label}</span>
            {index < JOURNEY.length - 1 && (
              <span className="mettle-journey-link" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function UnlockedToast() {
  const { state } = useConversationState();
  const prev = useRef<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let announced: string | null = null;
    for (const phase of JOURNEY) {
      const unlocked = isPhaseUnlocked(phase.id, state);
      const was = prev.current[phase.id];
      prev.current[phase.id] = unlocked;
      // Only announce transitions the user caused this session (skip the
      // initial render), and only the furthest gate opened.
      if (was === false && unlocked && !announced) {
        announced = UNLOCK_ANNOUNCEMENTS[phase.id] || null;
      }
    }
    if (announced) {
      setToast(announced);
      const timer = window.setTimeout(() => setToast(null), 4500);
      return () => window.clearTimeout(timer);
    }
  }, [state]);

  if (!toast) return null;
  return (
    <div className="mettle-unlock-toast" role="status" aria-live="polite">
      <Check size={13} strokeWidth={3} aria-hidden="true" />
      <span>{toast}</span>
    </div>
  );
}
