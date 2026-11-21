import type { GlassesNudge } from '@/fixtures/glasses-nudges';
import type { Nudge } from '@/hooks/use-conversation-state';

/**
 * Whisper-tier shaping for the M6 contract (docs/WORN_M6.md):
 * headline ≤ 60 chars, body ≤ 80 (reactive only). Client- and
 * server-safe — used by the live bridge and by /api/glasses to
 * sanitize whatever a caller pushes.
 */

export const GLASSES_LIMITS = { headline: 60, body: 80 } as const;

const DEFAULT_TTL = { phase: 3000, proactive: 8000, reactive: 12000 } as const;

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Trim to `max` chars at a word boundary; ellipsis only if room allows. */
export function fit(text: string, max: number): string {
  const t = clean(text);
  if (t.length <= max) return t;
  const window = t.slice(0, max - 1);
  const space = window.lastIndexOf(' ');
  const cut = space > max * 0.5 ? space : max - 1;
  return window.slice(0, cut).replace(/[\s,;:\-—–]+$/, '') + '…';
}

/** Sanitize an arbitrary pushed card into the contract. */
export function fitGlassesCard(card: Partial<GlassesNudge> & { headline: string }): GlassesNudge {
  const kind = card.kind === 'reactive' || card.kind === 'phase' ? card.kind : 'proactive';
  return {
    kind,
    headline: fit(card.headline, GLASSES_LIMITS.headline),
    body: card.body ? fit(card.body, GLASSES_LIMITS.body) : undefined,
    ttl_ms: card.ttl_ms ?? DEFAULT_TTL[kind],
  };
}

/** Proactive nudge → headline-only card (glasses show no chrome). */
export function nudgeToGlassesCard(nudge: Pick<Nudge, 'kind' | 'message'>): GlassesNudge {
  return fitGlassesCard({ kind: 'proactive', headline: nudge.message });
}

/** Reactive reply → two-line card: headline wraps into body at a word cut. */
export function replyToGlassesCard(reply: string): GlassesNudge {
  const t = clean(reply);
  if (t.length <= GLASSES_LIMITS.headline) {
    return fitGlassesCard({ kind: 'reactive', headline: t });
  }
  const window = t.slice(0, GLASSES_LIMITS.headline);
  const space = window.lastIndexOf(' ');
  const cut = space > GLASSES_LIMITS.headline * 0.5 ? space : GLASSES_LIMITS.headline;
  const headline = t.slice(0, cut).replace(/[\s,;:\-—–]+$/, '');
  return fitGlassesCard({
    kind: 'reactive',
    headline,
    body: t.slice(cut).trim(),
  });
}

const PHASE_MARKERS: Record<string, string> = {
  prep: 'BRIEF',
  rehearsal: 'REHEARSAL',
  live: 'LIVE',
  debrief: 'DEBRIEF READY',
};

export function phaseToGlassesCard(phase: string): GlassesNudge {
  return fitGlassesCard({ kind: 'phase', headline: PHASE_MARKERS[phase] ?? phase.toUpperCase() });
}
