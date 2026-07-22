"use client";

import { useEffect, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useConversationState } from "@/hooks/use-conversation-state";
import { DeepgramVoiceSession } from "@/lib/deepgram-voice";

/**
 * Opponent rehearsal UI — owned by Person A (before + after).
 *
 * Two input modes against one transcript shape:
 * - Voice (primary demo path): Deepgram Voice Agent in the browser plays the
 *   counterpart; both sides of the exchange stream into state.transcript.
 * - Typed (fallback): a user turn is appended and the LangGraph opponent node
 *   produces the counterpart reply.
 */

function buildPersonaPrompt(state: {
  stakes?: string;
  counterpart_profile?: Record<string, unknown>;
}): string {
  const profile = state.counterpart_profile ?? {};
  const concerns = Array.isArray(profile.concerns)
    ? (profile.concerns as string[]).join("; ")
    : "";
  return [
    `You are ${profile.name ?? "Elena Park"}, ${profile.role ?? "CIO of Northstar Foundation"},`,
    `in a live meeting about: ${state.stakes ?? "a $40M LP renewal"}.`,
    `Your style: ${Array.isArray(profile.style) ? (profile.style as string[]).join(", ") : "analytical, terse, skeptical"}.`,
    `Your leverage: ${profile.leverage ?? "you can renew at a reduced allocation."}`,
    `Your concerns: ${concerns}.`,
    "Stay fully in character for the entire conversation. You are not friendly",
    "and not a coach. Keep every reply to one to three spoken sentences. Push",
    "back on vague claims and ask for specifics. Interrupt pleasantries. Do",
    "not concede anything until the user earns it with concrete, dated,",
    "operational answers. Never mention being an AI or that this is practice.",
  ].join(" ");
}

const OPENING_LINE =
  "Before we discuss a new commitment, explain why we should treat the liquidity timeline as credible this time.";

export function OpponentChat() {
  const { state, setPartial } = useConversationState();
  const { agent } = useAgent();
  const transcript = state.transcript ?? [];

  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const sessionRef = useRef<DeepgramVoiceSession | null>(null);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  // agent.setState REPLACES state (no merge) — always send the full object.
  const stateRef = useRef(state);
  stateRef.current = state;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript.length]);

  // Stop the mic/socket if the user navigates away mid-session.
  useEffect(() => () => sessionRef.current?.stop(), []);

  const appendLive = (speaker: "user" | "counterpart", text: string) => {
    const next = [
      ...transcriptRef.current,
      { speaker, text, timestamp: new Date().toISOString() } as const,
    ];
    transcriptRef.current = next;
    setPartial({ ...stateRef.current, transcript: next, phase: "rehearsal" });
  };

  const startVoice = async () => {
    const session = new DeepgramVoiceSession();
    sessionRef.current = session;
    const opening =
      String(
        (state.counterpart_profile as { opening_line?: string })?.opening_line ?? "",
      ) || OPENING_LINE;
    try {
      await session.start({
        prompt: buildPersonaPrompt(state),
        greeting: transcriptRef.current.length === 0 ? opening : undefined,
        onTranscript: (role, text) =>
          appendLive(role === "assistant" ? "counterpart" : "user", text),
        onStatus: setVoiceStatus,
      });
    } catch (error) {
      setVoiceStatus(
        error instanceof Error ? error.message : "failed to start voice session",
      );
      sessionRef.current = null;
    }
  };

  const stopVoice = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setVoiceStatus(null);
  };

  const sendUserTurn = (text: string) => {
    appendLive("user", text);
    // Run the graph so the opponent node replies in character (typed fallback).
    (agent as unknown as { runAgent?: () => Promise<unknown> }).runAgent?.();
  };

  const voiceActive = sessionRef.current !== null;

  return (
    <div className="flex flex-col gap-4 h-full p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Opponent — Rehearsal</h2>
          <p className="text-sm opacity-70 mt-1">
            Roleplay the counterpart. They are not your friend.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={voiceActive ? stopVoice : startVoice}
            className={`px-4 py-2 rounded text-sm font-medium border ${
              voiceActive
                ? "border-red-500/50 text-red-500"
                : "border-current/20 hover:bg-current/5"
            }`}
          >
            {voiceActive ? "■ End voice rehearsal" : "🎙 Start voice rehearsal"}
          </button>
          {voiceStatus && (
            <span className="text-xs opacity-60">{voiceStatus}</span>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-3">
        {transcript.length === 0 && (
          <p className="text-sm opacity-50">
            No turns yet. Start the voice rehearsal, or type to begin.
          </p>
        )}
        {transcript.map((turn, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg p-3 max-w-[80%] ${
              turn.speaker === "user"
                ? "self-end bg-current/10"
                : "self-start border border-current/15"
            }`}
          >
            <span className="text-xs opacity-50 block mb-1">{turn.speaker}</span>
            {turn.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "turn",
          ) as HTMLInputElement;
          if (input.value.trim()) {
            sendUserTurn(input.value.trim());
            input.value = "";
          }
        }}
        className="flex gap-2"
      >
        <input
          name="turn"
          placeholder={voiceActive ? "Voice session live — or type…" : "Make your move…"}
          className="flex-1 rounded border border-current/20 px-3 py-2 bg-transparent"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-current/10 text-sm font-medium"
        >
          Send
        </button>
      </form>
    </div>
  );
}
