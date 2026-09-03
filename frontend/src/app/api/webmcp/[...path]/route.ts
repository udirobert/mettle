import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = (process.env.AGENT_URL || 'http://localhost:8123').replace(/\/$/, '');

// Path allowlist: only known webmcp tool endpoints may be proxied.
const ALLOWED_TOOLS = new Set(['event', 'extract', 'coach', 'opponent', 'wingman', 'debrief']);

// Simple in-memory rate limiter (per-IP, fixed window). Sufficient for a
// single-instance demo; use an edge/upstore limiter when horizontally scaled.
const RATE_LIMIT = 60; // requests per window per IP
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Opportunistic cleanup so the map cannot grow unbounded.
    if (hits.size > 1000) {
      for (const [key, value] of hits) {
        if (value.resetAt < now) hits.delete(key);
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function guard(request: NextRequest, path: string[]): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  // Only single-segment, alphanumeric-dash tool names are allowed.
  if (path.length !== 1 || !/^[\w-]+$/.test(path[0]) || !ALLOWED_TOOLS.has(path[0])) {
    return NextResponse.json({ error: 'Unknown webmcp tool' }, { status: 404 });
  }
  return null;
}

// Spec §6.4.1: cap request bodies at the trust boundary. 128KB comfortably
// covers the 20k-char client text clamp (4 bytes/char worst-case UTF-8) plus
// JSON overhead and short transcripts for coach/debrief.
const MAX_BODY_BYTES = 128 * 1024;

async function proxy(request: NextRequest, path: string[]) {
  const endpoint = path.join('/');
  const url = new URL(`${AGENT_URL}/webmcp/${endpoint}`);

  // Forward query string for GET requests.
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (['content-type', 'authorization'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  let body: BodyInit | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: `Request body exceeds ${MAX_BODY_BYTES} byte limit` },
        { status: 413 },
      );
    }
    body = raw;
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json';
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const blocked = guard(request, path);
  if (blocked) return blocked;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const blocked = guard(request, path);
  if (blocked) return blocked;
  return proxy(request, path);
}
