import { NextRequest, NextResponse } from 'next/server';

import { hashClientIdentifier } from '@/lib/telemetry';

const AGENT_URL = (process.env.AGENT_URL || 'http://localhost:8123').replace(/\/$/, '');

/**
 * Bridge to the backend's counterpart-memory routes (pinned contract):
 *   GET    /memory/{ref} -> { ref, found, history?, degraded? }
 *   DELETE /memory/{ref} -> { ref, deleted, degraded? }
 *
 * `ref` is the normalized counterpart name. Unreachable backend degrades to
 * 200 `{ degraded: true }` and never leaks the underlying error.
 */
// "dana-whitfield" (name only) or "dana-whitfield--meridianlabs" (name + organisation).
const REF = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$/;

function resolveClientHeader(request: NextRequest): Record<string, string> {
  const sid = request.cookies.get('mettle_sid')?.value;
  if (!sid) return {};
  return { 'x-mettle-client-id': hashClientIdentifier(sid) };
}

async function forward(
  request: NextRequest,
  method: 'GET' | 'DELETE',
  params: Promise<{ ref: string }>,
) {
  const { ref } = await params;
  if (ref.length > 80 || !REF.test(ref)) {
    return NextResponse.json({ error: 'Invalid counterpart reference' }, { status: 400 });
  }
  try {
    const response = await fetch(`${AGENT_URL}/memory/${ref}`, {
      method,
      headers: resolveClientHeader(request),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { ref, found: false, deleted: 0, degraded: true, reason: 'memory unreachable' },
      { status: 200 },
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  return forward(request, 'GET', params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  return forward(request, 'DELETE', params);
}
