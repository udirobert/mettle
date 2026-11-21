import { SALARY_REVIEW_GLASSES_SEQUENCE, type GlassesNudge } from '@/fixtures/glasses-nudges';
import { fitGlassesCard } from '@/lib/glasses-card';

/**
 * Demo relay state for the Worn × M6 glasses channel (docs/WORN_M6.md).
 *
 * Two modes:
 *   canned — the /glasses page directs; POSTs its index, consumers render
 *            SALARY_REVIEW_GLASSES_SEQUENCE[index].
 *   live   — a real agent nudge wins; the GlassesLiveBridge POSTs a shaped
 *            card (proactive nudge / reactive answer / phase marker) and it
 *            stays up until the next card or a clear.
 * Any canned command (index/dir/reset) clears live mode — the director
 * retakes control.
 *
 * Module-scoped — fine for the single-process dev/demo server; not a
 * durable store.
 */

let index = 0;
let liveCard: GlassesNudge | null = null;
let liveSince = 0;
const sequence = SALARY_REVIEW_GLASSES_SEQUENCE;

const clamp = (n: number) => Math.min(Math.max(Math.trunc(n), 0), sequence.length - 1);

export function setGlassesIndex(n: number) {
  index = clamp(n);
  liveCard = null;
  return index;
}

export function setLiveCard(card: GlassesNudge) {
  liveCard = card;
  liveSince = Date.now();
}

export function clearLiveCard() {
  liveCard = null;
}

export function sanitizeGlassesCard(card: Partial<GlassesNudge> & { headline: string }) {
  return fitGlassesCard(card);
}

export function getGlassesPayload(): {
  mode: 'live' | 'canned';
  index: number;
  total: number;
  card: GlassesNudge;
} {
  // Latest-card semantics: an expired live card reverts to the canned
  // sequence rather than pinning a stale nudge to every consumer.
  if (liveCard && Date.now() - liveSince > liveCard.ttl_ms) liveCard = null;
  return {
    mode: liveCard ? 'live' : 'canned',
    index,
    total: sequence.length,
    card: liveCard ?? sequence[index],
  };
}

/* ------------------------------------------------------------------ */
/* Push-sink registry — the first half of per-sink routing              */
/* (docs/WORN_M6.md, "Long-term direction"). Polling consumers          */
/* (glasses_relay.py, an APK) don't register; push bridges do.          */
/* ------------------------------------------------------------------ */

export type RegisteredSink = {
  id: string;
  url: string;
  capabilities?: {
    max_chars?: number;
    max_lines?: number;
    supports_body?: boolean;
    supports_bitmap?: boolean;
    private_display?: boolean;
    inputs?: string[];
  };
  /** Optional kind filter — sink only receives these card kinds. */
  kinds?: GlassesNudge['kind'][];
  failures: number;
};

const sinks = new Map<string, RegisteredSink>();
const MAX_SINK_FAILURES = 5;

export function registerSink(
  spec: Omit<RegisteredSink, 'failures' | 'id'> & { id?: string },
): RegisteredSink {
  const sink: RegisteredSink = {
    id: spec.id ?? spec.url,
    url: spec.url,
    capabilities: spec.capabilities,
    kinds: spec.kinds,
    failures: 0,
  };
  sinks.set(sink.id, sink);
  return sink;
}

export function removeSink(id: string): boolean {
  return sinks.delete(id);
}

export function listSinks(): Omit<RegisteredSink, 'failures'>[] {
  return [...sinks.values()].map(({ failures: _f, ...s }) => s);
}

export function resetGlassesForTests() {
  index = 0;
  liveCard = null;
  sinks.clear();
}

/** Fire-and-forget POST of the card to every registered sink that accepts
 * its kind. Evicts a sink after repeated failures — a dead bridge must
 * not spam logs forever. Never throws, never awaited by callers. */
export function fanoutCard(card: GlassesNudge): void {
  for (const sink of sinks.values()) {
    if (sink.kinds && !sink.kinds.includes(card.kind)) continue;
    // Non-private surfaces get the redacted card — same rule as
    // scripts/glasses_sinks.py present(). Nudge text is negotiation
    // content; a lock screen or shared display only gets a hint.
    const shown: GlassesNudge =
      sink.capabilities?.private_display === false
        ? { kind: 'proactive', headline: 'Mettle — nudge', ttl_ms: card.ttl_ms }
        : card;
    const body = JSON.stringify({ card: shown });
    fetch(sink.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
      .then((res) => {
        sink.failures = res.ok ? 0 : sink.failures + 1;
      })
      .catch(() => {
        sink.failures += 1;
      })
      .finally(() => {
        if (sink.failures >= MAX_SINK_FAILURES) sinks.delete(sink.id);
      });
  }
}
