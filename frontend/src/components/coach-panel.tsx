"use client";

import { useEffect, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useConversationState } from "@/hooks/use-conversation-state";
import { DeepgramVoiceSession } from "@/lib/deepgram-voice";

/**
 * Coach phase UI — owned by Person A (before + after).
 *
 * Two steps:
 * 1. Voice interview (optional): the coach asks what's at stake and what the
 *    user fears; the exchange accumulates in state.transcript with the coach
 *    as speaker "system".
 * 2. "Run prep" executes the coach node, which distills scenario + interview
 *    into personalized weak points and clears the transcript for rehearsal.
 */

const COACH_PROMPT = [
  "You are Mettle, a preparation coach for high-stakes conversations. The",
  "user is a fund manager preparing for tomorrow's meeting with Elena Park,",
  "CIO of Northstar Foundation, about renewing a $40M LP commitment. Elena is",
  "analytical, terse, and skeptical; her concerns are lagging DPI, two",
  "concentrated positions, and a management-fee step-up with no liquidity",
  "case. Interview the user briefly and directly: ask what outcome they need,",
  "what question they are most afraid of, and how they plan to answer it.",
  "One question at a time, one to two sentences per turn. Push past vague",
  "answers. After four or five exchanges, give them your sharpest three",
  "observations about where they will slip, then tell them to hit Run prep",
  "and go rehearse against Elena.",
].join(" ");

const COACH_GREETING =
  "Let's get you ready for Elena. First: walk me into the room — what outcome do you need from tomorrow, and what question are you hoping she doesn't ask?";

export function CoachPanel() {
  const { state, setPartial } = useConversationState();
  const { agent } = useAgent();
  const [running, setRunning] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const sessionRef = useRef<DeepgramVoiceSession | null>(null);
  const transcriptRef = useRef(state.transcript ?? []);
  transcriptRef.current = state.transcript ?? [];
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => () => sessionRef.current?.stop(), []);

  const interview = (state.transcript ?? []).filter(
    (t) => t.speaker === "system" || t.speaker === "user",
  );

  const appendInterview = (speaker: "user" | "system", text: string) => {
    const next = [
      ...transcriptRef.current,
      { speaker, text, timestamp: new Date().toISOString() } as const,
    ];
    transcriptRef.current = next;
    setPartial({ ...stateRef.current, transcript: next, phase: "prep" });
  };

  const startVoice = async () => {
    const session = new DeepgramVoiceSession();
    sessionRef.current = session;
    try {
      await session.start({
        prompt: COACH_PROMPT,
        greeting: COACH_GREETING,
        voice: "aura-2-apollo-en",
        onTranscript: (role, text) =>
          appendInterview(role === "assistant" ? "system" : "user", text),
        onStatus: setVoiceStatus,
      });
    } catch (error) {
      setVoiceStatus(
        error instanceof Error ? error.message : "failed to start coach session",
      );
      sessionRef.current = null;
    }
  };

  const stopVoice = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setVoiceStatus(null);
  };

  const runPrep = async () => {
    stopVoice();
    setRunning(true);
    // agent.setState replaces state wholesale — send the full object.
    setPartial({
      ...stateRef.current,
      phase: "prep",
      scenario_id: state.scenario_id || "lp_renewal",
    });
    try {
      await (
        agent as unknown as { runAgent?: () => Promise<unknown> }
      ).runAgent?.();
    } finally {
      setRunning(false);
    }
  };

  const weakPoints = state.user_weak_points ?? [];
  const voiceActive = sessionRef.current !== null;

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Coach — Prep</h2>
          <p className="text-sm opacity-70 mt-1">
            Scenario: {state.scenario_id || "lp_renewal"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <button
              onClick={voiceActive ? stopVoice : startVoice}
              className={`px-4 py-2 rounded text-sm font-medium border ${
                voiceActive
                  ? "border-red-500/50 text-red-500"
                  : "border-current/20 hover:bg-current/5"
              }`}
            >
              {voiceActive ? "■ End session" : "🎙 Talk to your coach"}
            </button>
            <button
              onClick={runPrep}
              disabled={running}
              className="px-4 py-2 rounded text-sm font-medium border border-current/20 hover:bg-current/5 disabled:opacity-50"
            >
              {running ? "Preparing…" : "Run prep"}
            </button>
          </div>
          {voiceStatus && (
            <span className="text-xs opacity-60">{voiceStatus}</span>
          )}
        </div>
      </header>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Stakes
        </h3>
        <p className="mt-2">{state.stakes || "Not set yet — run prep."}</p>
      </section>

      {interview.length > 0 && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
            Coaching session
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {interview.map((turn, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg p-3 max-w-[80%] ${
                  turn.speaker === "user"
                    ? "self-end bg-current/10"
                    : "self-start border border-current/15"
                }`}
              >
                <span className="text-xs opacity-50 block mb-1">
                  {turn.speaker === "user" ? "you" : "coach"}
                </span>
                {turn.text}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Your weak points
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {weakPoints.length === 0 && (
            <li className="text-sm opacity-50">
              No weak points surfaced yet. Talk to your coach, then run prep.
            </li>
          )}
          {weakPoints.map((point, i) => (
            <li key={i} className="text-sm rounded border border-current/10 p-3">
              {point}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
