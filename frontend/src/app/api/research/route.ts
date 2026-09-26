import { NextResponse, type NextRequest } from 'next/server';

import { agentUrl, rateLimited } from './shared';

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  if (rateLimited(request)) {
    return NextResponse.json(
      { error: 'Too many research runs. Try again in a minute.' },
      { status: 429 },
    );
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  try {
    const response = await fetch(`${agentUrl()}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
      signal: AbortSignal.timeout(120_000),
    });
    const body = await response.json().catch(() => ({}));
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Research service unreachable' }, { status: 502 });
  }
}
