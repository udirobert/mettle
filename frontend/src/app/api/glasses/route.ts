import {
  clearLiveCard,
  fanoutCard,
  getGlassesPayload,
  sanitizeGlassesCard,
  setGlassesIndex,
  setLiveCard,
} from '@/lib/glasses-state';
import type { GlassesNudge } from '@/fixtures/glasses-nudges';

export const dynamic = 'force-dynamic';

/** Current whisper-tier card — poll this from any render bridge. */
export function GET() {
  return Response.json(getGlassesPayload());
}

/**
 * Bodies:
 *   { "index": N }        — pin canned card N (clears live mode)
 *   { "dir": 1|-1 }       — step canned sequence (clears live mode)
 *   { "reset": true }     — back to canned card 0 (clears live mode)
 *   { "card": {...} }     — push a live card (kind/headline/body?/ttl_ms?)
 *   { "clear": true }     — drop live mode, back to canned index
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    index?: number;
    dir?: number;
    reset?: boolean;
    clear?: boolean;
    card?: Partial<GlassesNudge> & { headline: string };
  };

  if (body.card?.headline) {
    setLiveCard(sanitizeGlassesCard(body.card));
  } else if (body.clear) {
    clearLiveCard();
  } else {
    const next = body.reset
      ? 0
      : typeof body.index === 'number'
        ? body.index
        : getGlassesPayload().index + (body.dir ?? 1);
    setGlassesIndex(next);
  }
  const payload = getGlassesPayload();
  fanoutCard(payload.card);
  return Response.json(payload);
}
