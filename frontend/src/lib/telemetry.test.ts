import { beforeEach, describe, expect, it } from 'vitest';

import {
  getScoreboardSnapshot,
  hashClientIdentifier,
  recordServerTelemetry,
  resetScoreboardForTests,
} from '@/lib/telemetry';

describe('telemetry scoreboard', () => {
  beforeEach(() => {
    resetScoreboardForTests();
  });

  it('hashes client identifiers deterministically without exposing raw input', () => {
    const first = hashClientIdentifier('192.0.2.15');
    const second = hashClientIdentifier('192.0.2.15');
    expect(first).toBe(second);
    expect(first).toMatch(/^c_[0-9a-f]{8}$/);
    expect(first).not.toContain('192.0.2.15');
  });

  it('tracks repeat users and repeat MCP briefers', () => {
    const clientA = hashClientIdentifier('user-a');
    recordServerTelemetry({ event: 'conversation_started', clientIdHash: clientA });
    expect(getScoreboardSnapshot().counts.repeat_user).toBe(0);

    recordServerTelemetry({ event: 'conversation_started', clientIdHash: clientA });
    expect(getScoreboardSnapshot().counts.conversation_started).toBe(2);
    expect(getScoreboardSnapshot().counts.repeat_user).toBe(1);
    expect(getScoreboardSnapshot().unique_active_clients).toBe(1);

    recordServerTelemetry({ event: 'mcp_meeting_brief_call', clientIdHash: clientA });
    expect(getScoreboardSnapshot().repeat_mcp_briefers).toBe(0);
    recordServerTelemetry({ event: 'mcp_meeting_brief_call', clientIdHash: clientA });
    expect(getScoreboardSnapshot().repeat_mcp_briefers).toBe(1);
  });
});
