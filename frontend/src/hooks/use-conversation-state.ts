'use client';

import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2';
import { findEvent } from '@/fixtures/lp-event';

/**
 * Shared conversation state contract — mirrors backend/graph/state.py.
 *
 * Every phase component reads from and writes to the same agent state object.
 * Do not duplicate this shape in component-local state; call setPartial()
 * to update fields and let CopilotKit sync to the graph.
 */

export type TranscriptTurn = {
  speaker: 'user' | 'counterpart' | 'system';
  text: string;
  timestamp: string;
};

export type Nudge = {
  id: string;
  kind: 'repetition' | 'long_monologue' | 'concession' | 'timing' | 'other';
  message: string;
  timestamp: string;
  source_turn_index: number;
};

export type PerspectiveResult = {
  name: string;
  analysis: string;
};

export type ContextSource = {
  source_id: string;
  provider:
    | 'gmail'
    | 'calendar'
    | 'outlook'
    | 'slack'
    | 'notion'
    | 'drive'
    | 'exa'
    | 'firecrawl'
    | 'tinyfish'
    | 'solari'
    | 'manual';
  title: string;
  author: string | null;
  timestamp: string | null;
  url: string | null;
  /** Solari recorded browser session that gathered this source (replayable). */
  replay_session_id?: string | null;
};

export type EvidenceClaim = {
  claim: string;
  source_ids: string[];
  confidence: 'low' | 'medium' | 'high';
  relevance:
    | 'stakes'
    | 'counterpart'
    | 'objection'
    | 'commitment'
    | 'number'
    | 'timeline'
    | 'market'
    | 'company'
    | 'person'
    | 'risk';
  decision?: 'pending' | 'approved' | 'rejected';
};

export type ContextBrief = {
  status: 'empty' | 'draft' | 'approved' | 'rejected';
  sources: ContextSource[];
  claims: EvidenceClaim[];
  counterpart_history: string[];
  open_commitments: string[];
  sensitive_redactions: string[];
  user_approved_at: string | null;
};

export type CoachAnalysis = {
  blind_spots: string[];
  concrete_moves: string[];
  likely_objections: string[];
  opening_strategy: string;
  perspectives: PerspectiveResult[];
  disagreements: string[];
  consensus: string[];
};

export type NudgeAcknowledgement = {
  nudge_id: string;
  resolution: 'acted' | 'skipped';
  at: string;
};

export type ConversationState = {
  scenario_id: string;
  stakes: string;
  counterpart_profile: Record<string, unknown>;
  user_weak_points: string[];
  transcript: TranscriptTurn[];
  nudges_sent: Nudge[];
  open_reactive_query: string | null;
  awaiting_reactive_query?: boolean;
  phase: 'prep' | 'rehearsal' | 'live' | 'debrief';
  reactive_reply?: string | null;
  debrief_notes?: string[];
  coach_analysis?: CoachAnalysis;
  coach_stage?: 'idle' | 'debating' | 'perspectives' | 'ready';
  context_brief?: ContextBrief;
  reactive_query_prefill?: string | null;
  nudge_acknowledgements?: NudgeAcknowledgement[];
  privacy_mode?: 'private' | 'shared';
  /** How the conversation being debriefed actually happened: last-writer-wins. */
  conversation_source?: 'rehearsal' | 'live';
};

export type ConversationStateUpdate = Partial<ConversationState>;

export function useConversationState() {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const state = (agent.state ?? {}) as ConversationState;

  const setPartial = (update: ConversationStateUpdate) => {
    // AG-UI state updates replace the full object. Preserve fields owned by
    // other phases when applying a partial UI update.
    agent.setState({ ...(agent.state ?? {}), ...update });
  };

  const setPhase = (phase: ConversationState['phase']) => {
    setPartial({ phase });
  };

  const setScenarioId = (scenarioId: string) => {
    setPartial({ scenario_id: scenarioId });
  };

  const appendTranscriptTurn = (turn: TranscriptTurn) => {
    setPartial({ transcript: [...(state.transcript ?? []), turn] });
  };

  const runLiveTurn = async (speaker: TranscriptTurn['speaker'], text: string) => {
    const cleanText = text.trim();
    if (!cleanText || agent.isRunning) return;

    const transcript = [
      ...(state.transcript ?? []),
      {
        speaker,
        text: cleanText,
        timestamp: new Date().toISOString(),
      },
    ];

    setPartial({
      phase: 'live',
      transcript,
      awaiting_reactive_query: false,
      conversation_source: 'live',
    });
    await copilotkit.waitForPendingFrameworkUpdates();
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Evaluate the latest finalized live transcript turn.',
    });
    await copilotkit.runAgent({ agent });
  };

  const startReactiveSession = async (prefillQuery?: string) => {
    if (agent.isRunning) return;

    setPartial({
      phase: 'live',
      awaiting_reactive_query: true,
      open_reactive_query: null,
      reactive_query_prefill: prefillQuery ?? null,
    });
    await copilotkit.waitForPendingFrameworkUpdates();
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Open a quick-answer prompt for the live conversation.',
    });
    await copilotkit.runAgent({ agent });
  };

  const runOpponentTurn = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || agent.isRunning) return;

    const transcript = [
      ...(state.transcript ?? []),
      {
        speaker: 'user' as const,
        text: cleanText,
        timestamp: new Date().toISOString(),
      },
    ];

    setPartial({
      phase: 'rehearsal',
      transcript,
      conversation_source: 'rehearsal',
    });
    await copilotkit.waitForPendingFrameworkUpdates();
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Respond to the latest rehearsal turn as the counterpart.',
    });
    await copilotkit.runAgent({ agent });
  };

  const runDebrief = async () => {
    if (agent.isRunning) return;

    setPartial({ phase: 'debrief' });
    await copilotkit.waitForPendingFrameworkUpdates();
    const source = state.conversation_source === 'rehearsal' ? 'rehearsal' : 'live';
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `Produce a post-conversation debrief from the transcript. This conversation was a ${source === 'rehearsal' ? 'REHEARSAL against the simulated counterpart' : 'LIVE conversation transcribed in real time'} — calibrate commitment language accordingly.`,
    });
    await copilotkit.runAgent({ agent });
  };

  const openEvent = (scenarioId: string) => {
    const event = findEvent(scenarioId);
    if (!event) return;

    setPartial({
      scenario_id: event.id,
      phase: 'prep',
      stakes: event.stakes,
      counterpart_profile: event.counterpartProfile,
      user_weak_points: event.userWeakPoints,
      coach_analysis: undefined,
      coach_stage: 'idle',
      context_brief: undefined,
      transcript: [],
      nudges_sent: [],
      nudge_acknowledgements: [],
      reactive_reply: null,
      debrief_notes: [],
      conversation_source: undefined,
    });
  };

  const acknowledgeNudge = (nudgeId: string, resolution: 'acted' | 'skipped') => {
    const acknowledgements = state.nudge_acknowledgements ?? [];
    if (acknowledgements.some((ack) => ack.nudge_id === nudgeId)) return;
    setPartial({
      nudge_acknowledgements: [
        ...acknowledgements,
        { nudge_id: nudgeId, resolution, at: new Date().toISOString() },
      ],
    });
  };

  const setPrivacyMode = (mode: 'private' | 'shared') => {
    setPartial({ privacy_mode: mode });
  };

  const runCoach = async (
    scenarioId: string,
    options?: { contextBrief?: ContextBrief },
  ) => {
    if (agent.isRunning) return;

    setPartial({
      scenario_id: scenarioId,
      phase: 'prep',
      coach_analysis: undefined,
      coach_stage: 'debating',
      ...(options?.contextBrief ? { context_brief: options.contextBrief } : {}),
    });
    await copilotkit.waitForPendingFrameworkUpdates();
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content:
        'Prepare this conversation: load the scenario and run the Coach council debate.',
    });
    await copilotkit.runAgent({ agent });
  };

  return {
    state,
    setPartial,
    setPhase,
    setScenarioId,
    appendTranscriptTurn,
    runCoach,
    openEvent,
    runLiveTurn,
    runOpponentTurn,
    runDebrief,
    startReactiveSession,
    acknowledgeNudge,
    setPrivacyMode,
    isAgentRunning: agent.isRunning,
  };
}
