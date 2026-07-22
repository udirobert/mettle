"use client";

import { useConversationState } from "@/hooks/use-conversation-state";

/**
 * Wingman side panel — renders BOTH reactive replies and proactive nudge cards.
 *
 * Ownership split:
 *  - Reactive reply section (Person A): renders state.reactive_reply and the
 *    input that sets state.open_reactive_query, which the reactive node
 *    consumes via interrupt.
 *  - Proactive nudge cards (Person B): renders state.nudges_sent as
 *    generative-UI cards, not chat bubbles. These are surfaced unprompted by
 *    the proactive evaluation node.
 *
 * Both halves read/write the same shared state — no local duplication.
 */
export function WingmanSidePanel() {
  const { state, setPartial } = useConversationState();
  const nudges = state.nudges_sent ?? [];
  const reactiveReply = state.reactive_reply ?? null;

  const submitReactiveQuery = (query: string) => {
    // Person A: this resumes the interrupted reactive_wait node.
    setPartial({ open_reactive_query: query });
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
      <header>
        <h2 className="text-xl font-semibold">Wingman — Live</h2>
        <p className="text-sm opacity-70 mt-1">
          Reactive answers + proactive nudges.
        </p>
      </header>

      {/* Proactive nudges (Person B) */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Nudges
        </h3>
        <div className="mt-2 flex flex-col gap-2">
          {nudges.length === 0 && (
            <p className="text-sm opacity-50">No nudges yet.</p>
          )}
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="rounded-lg border-l-4 border-amber-400 bg-amber-400/10 p-3 text-sm"
            >
              <span className="text-xs uppercase tracking-wide opacity-60 block mb-1">
                {nudge.kind.replace("_", " ")}
              </span>
              {nudge.message}
            </div>
          ))}
        </div>
      </section>

      {/* Reactive reply (Person A) */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Quick answer
        </h3>
        {reactiveReply ? (
          <div className="mt-2 rounded border border-current/15 p-3 text-sm">
            {reactiveReply}
          </div>
        ) : (
          <p className="mt-2 text-sm opacity-50">
            Ask a quick question to get a fast targeted answer.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem(
              "query",
            ) as HTMLInputElement);
            if (input.value.trim()) {
              submitReactiveQuery(input.value.trim());
              input.value = "";
            }
          }}
          className="mt-2 flex gap-2"
        >
          <input
            name="query"
            placeholder="Quick question…"
            className="flex-1 rounded border border-current/20 px-3 py-2 bg-transparent text-sm"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded bg-current/10 text-sm"
          >
            Ask
          </button>
        </form>
      </section>
    </div>
  );
}
