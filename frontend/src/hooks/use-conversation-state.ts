"use client";

import { useAgent } from "@copilotkit/react-core/v2";

/**
 * Shared conversation state contract — mirrors backend/graph/state.py.
 *
 * Every phase component reads from and writes to the same agent state object.
 * Do not duplicate this shape in component-local state; call setPartial()
 * to update fields and let CopilotKit sync to the graph.
 */

export type TranscriptTurn = {
  speaker: "user" | "counterpart" | "system";
  text: string;
  timestamp: string;
};

export type Nudge = {
  id: string;
  kind: "repetition" | "long_monologue" | "concession" | "timing" | "other";
  message: string;
  timestamp: string;
  source_turn_index: number;
};

export type ConversationState = {
  scenario_id: string;
  stakes: string;
  counterpart_profile: Record<string, unknown>;
  user_weak_points: string[];
  transcript: TranscriptTurn[];
  nudges_sent: Nudge[];
  open_reactive_query: string | null;
  phase: "prep" | "rehearsal" | "live" | "debrief";
  reactive_reply?: string | null;
  debrief_notes?: string[];
};

export type ConversationStateUpdate = Partial<ConversationState>;

export function useConversationState() {
  const { agent } = useAgent();
  const state = (agent.state ?? {}) as ConversationState;

  // agent.setState REPLACES the state object wholesale (AG-UI semantics, no
  // merge). Spread the current agent state so partial updates behave as the
  // contract documents — otherwise a tab switch or single-field update wipes
  // the transcript and prep context.
  const setPartial = (update: ConversationStateUpdate) => {
    agent.setState({ ...(agent.state ?? {}), ...update });
  };

  const setPhase = (phase: ConversationState["phase"]) => {
    setPartial({ phase });
  };

  const appendTranscriptTurn = (turn: TranscriptTurn) => {
    setPartial({ transcript: [...(state.transcript ?? []), turn] });
  };

  return {
    state,
    setPartial,
    setPhase,
    appendTranscriptTurn,
    isAgentRunning: agent.isRunning,
  };
}
