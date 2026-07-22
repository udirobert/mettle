"use client";

import { useEffect, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { useConversationState } from "@/hooks/use-conversation-state";
import { DeepgramVoiceSession } from "@/lib/deepgram-voice";
import { EXAMPLE_SCENARIOS } from "@/lib/example-scenarios";

/**
 * Opponent rehearsal UI — owned by Person A (before + after).
 *
 * Scenario setup lives here too, not only in Coach: the same description
 * (or example chip) is sent through the coach node to synthesize a
 * counterpart persona + opening line, so rehearsal can start standalone.
 *
 * Two input modes against one transcript shape:
 * - Voice (primary demo path): Deepgram Voice Agent in the browser plays the
 *   counterpart; both sides of the exchange stream into state.transcript.
 * - Typed (fallback): a user turn is appended and the LangGraph opponent node
 *   produces the counterpart reply.
 */

type CounterpartProfile = {
  name?: string;
  role?: string;
  style?: string[];
  leverage?: string;
  concerns?: string[];
  opening_line?: string;
};

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
  const profile = (state.counterpart_profile ?? {}) as CounterpartProfile;

  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const sessionRef = useRef<DeepgramVoiceSession | null>(null);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [editingScenario, setEditingScenario] = useState(!profile.name);
  const [description, setDescription] = useState("");
  const [settingScenario, setSettingScenario] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript.length]);

  // Stop the mic/socket if the user navigates away mid-session.
  useEffect(() => () => sessionRef.current?.stop(), []);
  // Leave edit mode once a scenario lands (e.g. set from the Coach tab).
  useEffect(() => {
    if (profile.name && !settingScenario) setEditingScenario(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.name]);

  const appendLive = (speaker: "user" | "counterpart", text: string) => {
    const next = [
      ...transcriptRef.current,
      { speaker, text, timestamp: new Date().toISOString() } as const,
    ];
    transcriptRef.current = next;
    setPartial({ transcript: next, phase: "rehearsal" });
  };

  const setOpponent = async () => {
    stopVoice();
    setSettingScenario(true);
    const newTranscript = description.trim()
      ? [
          {
            speaker: "user" as const,
            text: `My situation: ${description.trim()}`,
            timestamp: new Date().toISOString(),
          },
        ]
      : [];
    setPartial({
      phase: "prep",
      transcript: newTranscript,
      scenario_id: newTranscript.length > 0 ? "custom" : "lp_renewal",
    });
    try {
      await (
        agent as unknown as { runAgent?: () => Promise<unknown> }
      ).runAgent?.();
    } finally {
      // Hand control back to rehearsal with a clean transcript against the
      // freshly synthesized opponent.
      setPartial({ phase: "rehearsal", transcript: [] });
      setDescription("");
      setEditingScenario(false);
      setSettingScenario(false);
    }
  };

  const startVoice = async () => {
    const session = new DeepgramVoiceSession();
    sessionRef.current = session;
    const opening = profile.opening_line || OPENING_LINE;
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
            disabled={settingScenario}
            className={`px-4 py-2 rounded text-sm font-medium border disabled:opacity-50 ${
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

      {!editingScenario && profile.name && (
        <div className="rounded border border-current/10 p-3 flex items-start justify-between gap-4">
          <div className="text-sm">
            <span className="font-medium">{profile.name}</span>
            {profile.role && (
              <span className="opacity-70"> — {profile.role}</span>
            )}
            {profile.concerns && profile.concerns.length > 0 && (
              <p className="opacity-60 mt-1">
                Concerned about: {profile.concerns.slice(0, 2).join("; ")}
              </p>
            )}
          </div>
          <button
            onClick={() => setEditingScenario(true)}
            className="text-xs px-2.5 py-1 rounded-full border border-current/20 hover:bg-current/5 shrink-0"
          >
            Change opponent
          </button>
        </div>
      )}

      {editingScenario && (
        <div className="rounded border border-current/10 p-3 flex flex-col gap-2">
          <span className="text-sm font-medium">
            Who are you rehearsing against?
          </span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SCENARIOS.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setDescription(example.text)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  description === example.text
                    ? "border-current/60 bg-current/10"
                    : "border-current/20 hover:bg-current/5"
                }`}
              >
                {example.label}
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe who you're facing and what's at stake. Leave empty for the demo scenario (LP renewal)."
            rows={3}
            className="w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex gap-2 self-end">
            {profile.name && (
              <button
                onClick={() => setEditingScenario(false)}
                className="px-3 py-1.5 rounded text-sm border border-current/20 hover:bg-current/5"
              >
                Cancel
              </button>
            )}
            <button
              onClick={setOpponent}
              disabled={settingScenario}
              className="px-3 py-1.5 rounded text-sm font-medium border border-current/20 hover:bg-current/5 disabled:opacity-50"
            >
              {settingScenario ? "Setting up…" : "Set opponent"}
            </button>
          </div>
        </div>
      )}

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
