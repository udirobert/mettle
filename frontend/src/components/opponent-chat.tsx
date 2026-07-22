"use client";

import { useConversationState } from "@/hooks/use-conversation-state";

/**
 * Opponent rehearsal UI — owned by Person A (reactive).
 *
 * Persona-conditioned roleplay surface. Person A implements the in-character
 * skeptical counterpart; this shell renders the transcript and an input that
 * appends user turns to shared state. The opponent's replies come back through
 * agent state (transcript turns with speaker "counterpart").
 */
export function OpponentChat() {
  const { state, appendTranscriptTurn } = useConversationState();
  const transcript = state.transcript ?? [];

  const sendUserTurn = (text: string) => {
    appendTranscriptTurn({
      speaker: "user",
      text,
      timestamp: new Date().toISOString(),
    });
    // TODO(Person A): trigger the opponent node to produce an in-character
    // counterpart reply and append it as a "counterpart" transcript turn.
  };

  return (
    <div className="flex flex-col gap-4 h-full p-6">
      <header>
        <h2 className="text-xl font-semibold">Opponent — Rehearsal</h2>
        <p className="text-sm opacity-70 mt-1">
          Roleplay the counterpart. They are not your friend.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {transcript.length === 0 && (
          <p className="text-sm opacity-50">No turns yet. Say something to begin.</p>
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
            <span className="text-xs opacity-50 block mb-1">
              {turn.speaker}
            </span>
            {turn.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem(
            "turn",
          ) as HTMLInputElement);
          if (input.value.trim()) {
            sendUserTurn(input.value.trim());
            input.value = "";
          }
        }}
        className="flex gap-2"
      >
        <input
          name="turn"
          placeholder="Make your move…"
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
