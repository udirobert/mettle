import type {
  ContextBrief,
  ConversationStateUpdate,
  ScoutEvent,
} from '@/hooks/use-conversation-state';

/** Shape returned by POST /context/import, via /api/agent/context/import. */
export type InboxImportResponse = {
  event?: {
    scenario_id?: string;
    stakes?: string;
    counterpart_profile?: Record<string, unknown> & { name?: string; role?: string };
  } | null;
  brief?: ContextBrief | null;
  scout_log?: ScoutEvent[];
  degraded?: boolean;
  source?: 'agentmail' | 'fixture';
  reason?: string;
  agent_inbox_address?: string | null;
  counterpart_history_ref?: string | null;
};

/**
 * What the docket shows for the inbox:
 *  - live:   real mail arrived → a draft event card
 *  - sample: no inbox, the backend served its bundled thread → offered, clearly labelled
 *  - empty:  nothing to show → tell the user how to send something
 */
export type InboxDraft =
  | { kind: 'live' | 'sample'; counterpart: string; role: string; stakes: string; claimCount: number; response: InboxImportResponse }
  | { kind: 'empty'; address: string | null; reason: string };

export function parseInboxImport(response: InboxImportResponse | null | undefined): InboxDraft {
  const address = response?.agent_inbox_address ?? null;
  const claims = response?.brief?.claims ?? [];
  const profile = response?.event?.counterpart_profile;
  const counterpart = String(profile?.name ?? '').trim();

  if (!response || !response.event || claims.length === 0 || !counterpart) {
    return {
      kind: 'empty',
      address,
      reason: response?.reason ?? 'Nothing in the agent inbox yet.',
    };
  }

  return {
    kind: response.source === 'agentmail' && !response.degraded ? 'live' : 'sample',
    counterpart,
    role: String(profile?.role ?? '').trim(),
    stakes: String(response.event.stakes ?? '').trim(),
    claimCount: claims.length,
    response,
  };
}

/**
 * State for opening an inbox-drafted event. Mirrors a fresh `openEvent` reset
 * so nothing from a previous conversation leaks in, and leaves every claim
 * pending — the keep/reject gate is unchanged.
 */
export function draftToState(draft: Extract<InboxDraft, { counterpart: string }>): ConversationStateUpdate {
  const { response } = draft;
  const event = response.event!;
  const brief = response.brief!;
  return {
    scenario_id: event.scenario_id || 'inbox_thread',
    phase: 'prep',
    stakes: draft.stakes,
    counterpart_profile: { ...(event.counterpart_profile ?? {}) },
    user_weak_points: [],
    context_brief: {
      ...brief,
      status: 'draft',
      user_approved_at: null,
      claims: brief.claims.map((claim) => ({ ...claim, decision: claim.decision ?? 'pending' })),
    },
    ...(response.scout_log ? { scout_log: response.scout_log } : {}),
    ...(response.agent_inbox_address ? { agent_inbox_address: response.agent_inbox_address } : {}),
    ...(response.counterpart_history_ref ? { counterpart_history_ref: response.counterpart_history_ref } : {}),
    coach_analysis: undefined,
    coach_stage: 'idle',
    transcript: [],
    nudges_sent: [],
    nudge_acknowledgements: [],
    reactive_reply: null,
    debrief_notes: [],
    conversation_source: undefined,
  };
}
