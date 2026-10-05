import { NextRequest, NextResponse } from 'next/server';

const SCOUT_URL = (process.env.SCOUT_URL || 'http://localhost:4111').replace(/\/$/, '');
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Bridge to the Scout service (Mastra, :4111).
 *
 * Only the pinned Scout endpoints are reachable — this is not an open proxy:
 *   GET  status
 *   POST run
 *   POST brief
 *   POST brief/<runId>/decision
 *
 * If the Scout is down we answer 200 `{ degraded: true }` so the UI can say so,
 * and we never echo the underlying error to the browser.
 */
const ROUTES: Array<{ method: 'GET' | 'POST'; pattern: RegExp; timeoutMs: number }> = [
  { method: 'GET', pattern: /^status$/, timeoutMs: 6_000 },
  { method: 'POST', pattern: /^run$/, timeoutMs: 60_000 },
  { method: 'POST', pattern: /^brief$/, timeoutMs: 90_000 },
  { method: 'POST', pattern: /^brief\/[\w-]{8,64}\/decision$/, timeoutMs: 60_000 },
];

async function forward(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: 'GET' | 'POST',
) {
  const { path } = await params;
  const endpoint = path.join('/');
  const route = ROUTES.find((r) => r.method === method && r.pattern.test(endpoint));
  if (!route) return NextResponse.json({ error: 'Unknown route' }, { status: 404 });

  let body: string | undefined;
  if (method === 'POST') {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    body = raw || '{}';
  }

  try {
    const response = await fetch(`${SCOUT_URL}/scout/${endpoint}`, {
      method,
      headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
      body,
      signal: AbortSignal.timeout(route.timeoutMs),
      cache: 'no-store',
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ degraded: true, reason: 'scout unreachable' }, { status: 200 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return forward(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return forward(request, params, 'POST');
}
