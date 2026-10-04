import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = (process.env.AGENT_URL || 'http://localhost:8123').replace(/\/$/, '');

// 128KB cap at the trust boundary — same ceiling as the webmcp proxy. The
// memo body is a few KB, so this is pure abuse protection.
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Bridge to the backend's context/debrief routes.
 *
 * The backend answers 200 with `degraded: true` when a credential is missing —
 * never a 5xx — so this proxy surfaces degraded states to the UI as data rather
 * than errors. If the backend is entirely unreachable we degrade too rather
 * than surfacing a 500 to the user mid-demo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join('/');
  if (!/^[\w-]+$/.test(endpoint)) {
    return NextResponse.json({ error: 'Unknown route' }, { status: 404 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  try {
    const response = await fetch(`${AGENT_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw || '{}',
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Backend down (or not yet deployed) — degrade rather than 500 the demo.
    return NextResponse.json(
      { degraded: true, reason: `agent unreachable: ${String(err)}` },
      { status: 200 },
    );
  }
}
