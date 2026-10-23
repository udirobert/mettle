import { NextResponse } from 'next/server';

import {
  getScoreboardSnapshot,
  recordServerTelemetry,
  type TelemetryEventName,
  type TelemetryPayload,
} from '@/lib/telemetry';

const VALID_EVENTS = new Set<TelemetryEventName>([
  'conversation_started',
  'mode_session',
  'share_artifact_created',
  'repeat_user',
  'off_platform_click',
  'mcp_connect',
  'mcp_meeting_brief_call',
]);

export async function GET() {
  return NextResponse.json({
    ok: true,
    scoreboard: getScoreboardSnapshot(),
  });
}

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as Partial<TelemetryPayload>;
    if (!raw || typeof raw.event !== 'string' || !VALID_EVENTS.has(raw.event as TelemetryEventName)) {
      return NextResponse.json({ ok: false, error: 'Invalid telemetry event' }, { status: 400 });
    }
    const recorded = recordServerTelemetry({
      event: raw.event as TelemetryEventName,
      clientIdHash: typeof raw.clientIdHash === 'string' ? raw.clientIdHash.slice(0, 32) : undefined,
      mode: raw.mode,
      artifactKind: raw.artifactKind,
      utmSource: typeof raw.utmSource === 'string' ? raw.utmSource.slice(0, 64) : undefined,
      entry: raw.entry,
      scenarioId: typeof raw.scenarioId === 'string' ? raw.scenarioId.slice(0, 64) : undefined,
    });
    return NextResponse.json({ ok: true, recorded });
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed payload' }, { status: 400 });
  }
}
