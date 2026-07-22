'use client';

import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2';

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

export type CoachAnalysis = {
  blind_spots: string[];
  concrete_moves: string[];
  likely_objections: string[];
  opening_strategy: string;
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
};

export type ConversationStateUpdate = Partial<ConversationState>;

export function useConversationState() {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const state = (agent.state ?? {}) as ConversationState;

  const setPartial = (update: ConversationStateUpdate) => {
    agent.setState(update);
  };

  const setPhase = (phase: ConversationState['phase']) => {
    agent.setState({ phase });
  };

  const appendTranscriptTurn = (turn: TranscriptTurn) => {
    agent.setState({ transcript: [...(state.transcript ?? []), turn] });
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

    agent.setState({
      phase: 'live',
      transcript,
      awaiting_reactive_query: false,
    });
    await copilotkit.waitForPendingFrameworkUpdates();
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Evaluate the latest finalized live transcript turn.',
    });
    await copilotkit.runAgent({ agent });
  };

  const startReactiveSession = async () => {
    if (agent.isRunning) return;

    agent.setState({
      phase: 'live',
      awaiting_reactive_query: true,
      open_reactive_query: null,
    });
    await copilotkit.waitForPendingFrameworkUpdates();
    agent.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: 'Open a quick-answer prompt for the live conversation.',
    });
    await copilotkit.runAgent({ agent });
  };

  return {
    state,
    setPartial,
    setPhase,
    appendTranscriptTurn,
    runLiveTurn,
    startReactiveSession,
    isAgentRunning: agent.isRunning,
  };
}
