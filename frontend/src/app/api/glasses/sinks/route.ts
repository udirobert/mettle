import { listSinks, registerSink, removeSink } from '@/lib/glasses-state';

export const dynamic = 'force-dynamic';

/** Registered push sinks — each gets POSTed {card} on every card change. */
export function GET() {
  return Response.json({ sinks: listSinks() });
}

/**
 * Register:  { "url": "http://...", "id"?, "capabilities"?, "kinds"? }
 * Remove:    { "id": "...", "remove": true }
 * `kinds` filters which card kinds the sink receives; `capabilities` is
 * stored for routing/refinement (private_display-aware rendering lands
 * when a second provider makes it load-bearing).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    remove?: boolean;
    kinds?: ('proactive' | 'reactive' | 'phase')[];
    capabilities?: Record<string, unknown>;
  };

  if (body.remove && body.id) {
    return Response.json({ removed: removeSink(body.id), sinks: listSinks() });
  }
  if (!body.url) {
    return Response.json({ error: 'url required' }, { status: 400 });
  }
  // http(s) only — a sink URL is fetched server-side on every card, so
  // file:, data:, gopher: etc. would be SSRF surface. For the demo that
  // means localhost / LAN bridges, which is all we need.
  try {
    const u = new URL(body.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
  } catch {
    return Response.json({ error: 'url must be http(s)' }, { status: 400 });
  }
  const sink = registerSink({
    id: body.id,
    url: body.url,
    kinds: body.kinds,
    capabilities: body.capabilities,
  });
  return Response.json({ registered: sink.id, sinks: listSinks() });
}

/** Remove a sink: DELETE /api/glasses/sinks?id=... */
export function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  return Response.json({ removed: removeSink(id), sinks: listSinks() });
}
