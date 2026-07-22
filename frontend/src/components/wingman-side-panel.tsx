'use client';

import { FormEvent, useState } from 'react';
import { useInterrupt } from '@copilotkit/react-core/v2';
import { AlertTriangle, ArrowUp, Radio, Send, Zap } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';

/** Live transcript, proactive nudge cards, and native reactive interrupt UI. */
export function WingmanSidePanel() {
  const { state, runLiveTurn, startReactiveSession, isAgentRunning } = useConversationState();
  const [speaker, setSpeaker] = useState<'user' | 'counterpart'>('user');
  const nudges = state.nudges_sent ?? [];
  const reactiveReply = state.reactive_reply ?? null;

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
        className="flex gap-2 mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          const query = new FormData(event.currentTarget).get('query');
          if (typeof query === 'string' && query.trim()) resolve(query.trim());
        }}
      >
        <input
          autoFocus
          className="mettle-input flex-1"
          name="query"
          placeholder="What should I say next?"
        />
        <button className="mettle-action" type="submit">
          <Send size={15} aria-hidden="true" /> Ask
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
    <div className="mettle-phase">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mettle-kicker">Live conversation support</p>
          <h2 className="mettle-headline">Stay in the room. We will watch the pattern.</h2>
        </div>
        <div
          className="mettle-card mettle-card--signal shrink-0"
          style={{ minWidth: 133, padding: 11 }}
        >
          <p className="mettle-kicker">
            <Radio size={13} /> Wingman
          </p>
          <strong>{isAgentRunning ? 'Thinking' : 'Listening'}</strong>
        </div>
      </header>

      <section className="mettle-card mettle-card--accent">
        <p className="mettle-kicker">
          <Zap size={13} /> Say this next
        </p>
        <strong>
          {reactiveReply || 'Get the question, then answer the concern underneath it.'}
        </strong>
        <p>
          {reactiveReply
            ? 'A targeted response from the live context.'
            : 'Use Quick Answer when you need a short, specific line in the moment.'}
        </p>
        {reactiveInterrupt ?? (
          <button
            className="mettle-action"
            disabled={isAgentRunning}
            onClick={() => void startReactiveSession()}
            type="button"
            style={{ marginTop: 12 }}
          >
            <Zap size={14} aria-hidden="true" /> Quick answer
          </button>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="mettle-section-title flex-1">Live transcript</h3>
          <div
            className="flex border border-[var(--line)] bg-[#fffdf7] p-1"
            role="group"
            aria-label="Transcript speaker"
          >
            <button
              className={`px-2 py-1 text-[10px] font-mono uppercase ${speaker === 'user' ? 'bg-[var(--cobalt)] text-white' : 'text-[var(--ink-soft)]'}`}
              onClick={() => setSpeaker('user')}
              type="button"
            >
              Me
            </button>
            <button
              className={`px-2 py-1 text-[10px] font-mono uppercase ${speaker === 'counterpart' ? 'bg-[var(--tomato)] text-white' : 'text-[var(--ink-soft)]'}`}
              onClick={() => setSpeaker('counterpart')}
              type="button"
            >
              {String(state.counterpart_profile?.name?.split(' ')[0] ?? 'Counterpart')}
            </button>
          </div>
        </div>
        <form className="flex gap-2 mt-3" onSubmit={submitTranscript}>
          <input
            className="mettle-input flex-1"
            disabled={isAgentRunning}
            name="transcript"
            placeholder="Add the latest finalized turn"
          />
          <button className="mettle-action" disabled={isAgentRunning} type="submit">
            <ArrowUp size={16} aria-hidden="true" /> Add
          </button>
        </form>
      </section>

      <section>
        <h3 className="mettle-section-title">Signals worth interrupting for</h3>
        <div className="grid gap-2 mt-3">
          {nudges.length === 0 ? (
            <div className="mettle-card">
              <p className="mettle-kicker">
                <AlertTriangle size={13} /> Standing by
              </p>
              <strong>No pattern has crossed the threshold.</strong>
              <p>
                Wingman only interrupts for repetition, a long answer, a concession, or a material
                timing signal.
              </p>
            </div>
          ) : (
            nudges.map((nudge) => (
              <div className="mettle-card mettle-card--risk" key={nudge.id}>
                <p className="mettle-kicker">
                  <AlertTriangle size={13} /> {nudge.kind.replace('_', ' ')}
                </p>
                <strong>{nudge.message}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
