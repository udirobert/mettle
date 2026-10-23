/**
 * Privacy-safe telemetry for the Keiki × Maritime and ChatGPT Plugin Lane
 * scoreboards.
 *
 * Rules:
 * - Never log pasted threads, transcripts, claims, or counterpart notes.
 * - Emit structured JSON lines (`[mettle:telemetry]`) so Vercel / server logs
 *   and the in-process scoreboard aggregator can count real usage.
 */

export type TelemetryEventName =
  | 'conversation_started'
  | 'mode_session'
  | 'share_artifact_created'
  | 'repeat_user'
  | 'off_platform_click'
  | 'mcp_connect'
  | 'mcp_meeting_brief_call';

export type TelemetryPayload = {
  event: TelemetryEventName;
  clientIdHash?: string;
  mode?: 'prep' | 'rehearsal' | 'live' | 'debrief';
  artifactKind?: 'council_split' | 'followup_memo' | 'share_link';
  utmSource?: string;
  entry?: 'prep' | 'rehearsal' | 'draft';
  scenarioId?: string;
  ts?: string;
};

type ScoreboardState = {
  counts: Record<TelemetryEventName, number>;
  clientSessions: Map<string, number>;
  mcpBriefClients: Map<string, number>;
};

const globalStore = globalThis as unknown as {
  __mettleScoreboard?: ScoreboardState;
};

function getStore(): ScoreboardState {
  if (!globalStore.__mettleScoreboard) {
    globalStore.__mettleScoreboard = {
      counts: {
        conversation_started: 0,
        mode_session: 0,
        share_artifact_created: 0,
        repeat_user: 0,
        off_platform_click: 0,
        mcp_connect: 0,
        mcp_meeting_brief_call: 0,
      },
      clientSessions: new Map<string, number>(),
      mcpBriefClients: new Map<string, number>(),
    };
  }
  return globalStore.__mettleScoreboard;
}

/** Deterministic, non-reversible FNV-1a hash so raw IPs/IDs are never stored. */
export function hashClientIdentifier(raw: string): string {
  const input = raw.trim() || 'anonymous';
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `c_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function recordServerTelemetry(payload: TelemetryPayload): TelemetryPayload {
  const store = getStore();
  const normalized: TelemetryPayload = {
    ...payload,
    ts: payload.ts || new Date().toISOString(),
  };

  if (normalized.event in store.counts) {
    store.counts[normalized.event] += 1;
  }

  if (normalized.clientIdHash) {
    if (normalized.event === 'conversation_started') {
      const prev = store.clientSessions.get(normalized.clientIdHash) ?? 0;
      const next = prev + 1;
      store.clientSessions.set(normalized.clientIdHash, next);
      if (next === 2) {
        store.counts.repeat_user += 1;
      }
    }
    if (normalized.event === 'mcp_meeting_brief_call') {
      const prev = store.mcpBriefClients.get(normalized.clientIdHash) ?? 0;
      store.mcpBriefClients.set(normalized.clientIdHash, prev + 1);
    }
  }

  console.info('[mettle:telemetry]', JSON.stringify(normalized));
  return normalized;
}

export function getScoreboardSnapshot() {
  const store = getStore();
  let repeatMcpBriefers = 0;
  for (const count of store.mcpBriefClients.values()) {
    if (count >= 2) repeatMcpBriefers += 1;
  }
  return {
    counts: { ...store.counts },
    unique_active_clients: store.clientSessions.size,
    repeat_mcp_briefers: repeatMcpBriefers,
  };
}

export function resetScoreboardForTests(): void {
  globalStore.__mettleScoreboard = undefined;
}

const CLIENT_ID_STORAGE_KEY = 'mettle.client_id';
const SESSION_COUNT_KEY = 'mettle.session_count';

export function getOrCreateClientIdHash(): string {
  if (typeof window === 'undefined') return 'c_server';
  try {
    let raw = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!raw) {
      raw =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, raw);
    }
    return hashClientIdentifier(raw);
  } catch {
    return 'c_ephemeral';
  }
}

export function trackClientEvent(
  event: TelemetryEventName,
  details: Omit<TelemetryPayload, 'event' | 'clientIdHash' | 'ts'> = {},
): void {
  if (typeof window === 'undefined') return;
  const clientIdHash = getOrCreateClientIdHash();

  if (event === 'conversation_started') {
    try {
      const prev = Number.parseInt(window.localStorage.getItem(SESSION_COUNT_KEY) || '0', 10) || 0;
      window.localStorage.setItem(SESSION_COUNT_KEY, String(prev + 1));
    } catch {
      /* ignore storage errors */
    }
  }

  const body: TelemetryPayload = {
    event,
    clientIdHash,
    ...details,
    ts: new Date().toISOString(),
  };

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry', blob);
      return;
    }
    void fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* telemetry must never interrupt user flow */
  }
}
