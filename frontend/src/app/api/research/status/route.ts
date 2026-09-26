import { NextResponse } from 'next/server';

import { agentUrl } from '../shared';

export async function GET() {
  try {
    const response = await fetch(`${agentUrl()}/research/status`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return NextResponse.json(await response.json());
  } catch {
    /* agent down — research simply isn't offered */
  }
  return NextResponse.json({ available: false, max_urls: 0 });
}
