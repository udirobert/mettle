import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = (process.env.AGENT_URL || 'http://localhost:8123').replace(/\/$/, '');

/**
 * Bridge to the backend's counterpart-memory routes (pinned contract):
 *   GET    /memory/{ref} -> { ref, found, history?, degraded? }
 *   DELETE /memory/{ref} -> { ref, deleted, degraded? }
 *
 * `ref` is the normalized counterpart name. Unreachable backend degrades to
 * 200 `{ degraded: true }` and never leaks the underlying error.
 */
const REF = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function forward(
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  return forward('GET', params);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  return forward('DELETE', params);
}
