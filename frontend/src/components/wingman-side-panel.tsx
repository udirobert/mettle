'use client';

import { FormEvent, useState } from 'react';

import { useInterrupt } from '@copilotkit/react-core/v2';

import { useConversationState } from '@/hooks/use-conversation-state';

/**
 * The live panel owns transcript submission and proactive cards. The reactive
 * prompt is rendered from LangGraph's native interrupt, not a local form.
 */
export function WingmanSidePanel() {
  const { state, runLiveTurn, startReactiveSession, isAgentRunning } = useConversationState();
  const nudges = state.nudges_sent ?? [];
  const reactiveReply = state.reactive_reply ?? null;
  const [speaker, setSpeaker] = useState<'user' | 'counterpart'>('user');

  const reactiveInterrupt = useInterrupt({
    agentId: 'default',
    renderInChat: false,
    enabled: (event) =>
      typeof event.value === 'object' &&
      event.value !== null &&
      'kind' in event.value &&
      event.value.kind === 'reactive_query',
    render: ({ resolve }) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const query = new FormData(event.currentTarget).get('query');
          if (typeof query === 'string' && query.trim()) resolve(query.trim());
        }}
        className="mt-2 flex gap-2"
      >
        <input
          autoFocus
          name="query"
          placeholder="What do you need to say next?"
          className="min-w-0 flex-1 rounded border border-current/20 bg-transparent px-3 py-2 text-sm"
        />
        <button type="submit" className="px-3 py-2 rounded bg-current/10 text-sm">
          Send
        </button>
      </form>
    ),
  });

  const submitTranscript = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get('transcript');
    if (typeof text !== 'string' || !text.trim()) return;
    await runLiveTurn(speaker, text);
    event.currentTarget.reset();
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h2 className="text-xl font-semibold">Wingman - Live</h2>
        <p className="mt-1 text-sm opacity-70">Reactive answers + proactive nudges.</p>
      </header>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
            Live transcript
          </h3>
          <div className="flex gap-1" role="group" aria-label="Transcript speaker">
            <button
              type="button"
              onClick={() => setSpeaker('user')}
              className={`px-2 py-1 text-xs ${speaker === 'user' ? 'bg-current/10' : 'opacity-60'}`}
            >
              Me
            </button>
            <button
              type="button"
              onClick={() => setSpeaker('counterpart')}
              className={`px-2 py-1 text-xs ${speaker === 'counterpart' ? 'bg-current/10' : 'opacity-60'}`}
            >
              Elena
            </button>
          </div>
        </div>
        <form onSubmit={submitTranscript} className="mt-2 flex gap-2">
          <input
            name="transcript"
            placeholder="Add a finalized transcript turn"
            disabled={isAgentRunning}
            className="min-w-0 flex-1 rounded border border-current/20 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isAgentRunning}
            className="px-3 py-2 rounded bg-current/10 text-sm disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </section>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">Nudges</h3>
        <div className="mt-2 flex flex-col gap-2">
          {nudges.length === 0 && <p className="text-sm opacity-50">No nudges yet.</p>}
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="rounded-lg border-l-4 border-amber-400 bg-amber-400/10 p-3 text-sm"
            >
              <span className="mb-1 block text-xs uppercase tracking-wide opacity-60">
                {nudge.kind.replace('_', ' ')}
              </span>
              {nudge.message}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">Quick answer</h3>
        {reactiveReply ? (
          <div className="mt-2 rounded border border-current/15 p-3 text-sm">{reactiveReply}</div>
        ) : (
          <p className="mt-2 text-sm opacity-50">
            Ask a quick question to get a fast targeted answer.
          </p>
        )}
        {reactiveInterrupt ?? (
          <button
            type="button"
            onClick={() => void startReactiveSession()}
            disabled={isAgentRunning}
            className="mt-2 px-3 py-2 rounded bg-current/10 text-sm disabled:opacity-50"
          >
            Ask Wingman
          </button>
        )}
      </section>
    </div>
  );
}
