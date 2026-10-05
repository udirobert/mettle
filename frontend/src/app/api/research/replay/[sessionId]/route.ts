import { NextResponse, type NextRequest } from 'next/server';

import { agentUrl } from '../../shared';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!/^[\w-]{6,128}$/.test(sessionId)) {
    return NextResponse.json({ error: 'Unknown session' }, { status: 404 });
  }

  try {
    const response = await fetch(`${agentUrl()}/research/replay/${sessionId}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Replay not available yet' }, { status: response.status });
    }
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Research service unreachable' }, { status: 502 });
  }
}
