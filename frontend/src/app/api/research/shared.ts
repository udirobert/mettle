import type { NextRequest } from 'next/server';

export function agentUrl(): string {
  return (
    process.env.AGENT_URL ||
    process.env.LANGGRAPH_DEPLOYMENT_URL ||
    'http://localhost:8123'
  ).replace(/\/$/, '');
}

// Each research run opens a billed cloud browser session, so the limit is far
// tighter than the WebMCP proxy. In-memory is fine for a single instance.
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 1000) {
      for (const [key, value] of hits) if (value.resetAt < now) hits.delete(key);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}
