import { getGlassesPayload } from '@/lib/glasses-state';

export const dynamic = 'force-dynamic';

/**
 * SSE variant of GET /api/glasses — emits the card on connect and again
 * whenever the director advances. For bridges that prefer push over poll.
 */
export function GET() {
  let last = -1;
  let closed = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const tick = () => {
        if (closed) return;
        const payload = getGlassesPayload();
        if (payload.index !== last) {
          last = payload.index;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
        setTimeout(tick, 250);
      };
      tick();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
