'use client';

import { FormEvent, useState } from 'react';
import { useInterrupt } from '@copilotkit/react-core/v2';
import { ArrowUp, Check, ChevronDown, Play, Radio, Send, ThumbsDown, Zap } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import { NudgeCard } from '@/components/nudge-card';

/** Live: one intervention, then the transcript. Restraint over inventory. */
export function WingmanSidePanel() {
  const { state, runLiveTurn, startReactiveSession, setPartial, acknowledgeNudge, isAgentRunning } =
    useConversationState();
  const [speaker, setSpeaker] = useState<'user' | 'counterpart'>('user');
  const [showTranscript, setShowTranscript] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const nudges = state.nudges_sent ?? [];
  const latestNudge = nudges.at(-1);
  const reactiveReply = state.reactive_reply ?? null;
  const counterpartFirst =
    String(state.counterpart_profile?.name ?? '').split(' ')[0] || 'Counterpart';
  const transcript = state.transcript ?? [];
  const acknowledgements = state.nudge_acknowledgements ?? [];
  const latestAck = latestNudge
    ? acknowledgements.find((ack) => ack.nudge_id === latestNudge.id)
    : undefined;

  /** Empty-room helper: drop in the counterpart's likely opening so Live can be tried solo. */
  const simulateOpening = () => {
    if (transcript.length > 0) return;
    setPartial({
      transcript: [
        {
          speaker: 'counterpart',
          text: `Before we go further — walk me through why I should trust the plan this time.`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  };

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
          key={state.reactive_query_prefill ?? 'empty'}
          autoFocus
          className="mettle-input flex-1"
          defaultValue={state.reactive_query_prefill ?? ''}
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
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="mettle-kicker">Live · one interruption at a time</p>
          <h2 className="mettle-headline">Stay in the room.</h2>
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
          <Radio size={12} className="mr-1 inline" aria-hidden="true" />
          {isAgentRunning ? 'Thinking' : 'Listening'}
        </span>
      </header>

      {reactiveReply ? (
        <section className="mettle-card mettle-card--accent" aria-label="Current intervention">
          <p className="mettle-kicker">
            <Zap size={13} /> Say this next
          </p>
          <strong>{reactiveReply}</strong>
          <p>Two sentences. Then stop and listen.</p>
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
      ) : latestNudge ? (
        <section aria-label="Current intervention">
          <NudgeCard
            nudge={latestNudge}
            actionLabel="Get a reframe"
            onAction={() => {
              acknowledgeNudge(latestNudge.id, 'acted');
              void startReactiveSession(
                `The wingman flagged: "${latestNudge.message}". What should I say next?`,
              );
            }}
          />
          {latestAck ? (
            <p
              className="mettle-kicker"
              role="status"
              style={{ color: 'var(--signal-strong-ink)', marginTop: 8 }}
            >
              <Check size={12} className="inline" aria-hidden="true" />{' '}
              {latestAck.resolution === 'acted' ? 'Handled' : 'Skipped'} — noted for the debrief.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
              <button
                className="mettle-action"
                onClick={() => acknowledgeNudge(latestNudge.id, 'acted')}
                type="button"
              >
                <Check size={13} aria-hidden="true" /> I said it
              </button>
              <button
                className="mettle-icon-action"
                onClick={() => acknowledgeNudge(latestNudge.id, 'skipped')}
                type="button"
              >
                <ThumbsDown size={13} aria-hidden="true" /> Didn't
              </button>
            </div>
          )}
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
      ) : (
        <section className="mettle-card mettle-card--accent" aria-label="Current intervention">
          <p className="mettle-kicker">
            <Zap size={13} /> Standing by
          </p>
          <strong>No pattern has crossed the threshold.</strong>
          <p>
            Wingman only interrupts for a concession, long monologue, repetition, or timing signal.
            Ask when you need a line.
          </p>
          {transcript.length === 0 && (
            <button
              className="mettle-icon-action"
              onClick={simulateOpening}
              type="button"
              style={{ marginTop: 12 }}
            >
              <Play size={13} aria-hidden="true" /> Simulate {counterpartFirst}'s opening
            </button>
          )}
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
      )}

      <form className="flex gap-2" onSubmit={submitTranscript}>
        <div
          className="flex shrink-0 border border-[var(--line)] bg-[var(--surface)] p-1"
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
            {counterpartFirst}
          </button>
        </div>
        <input
          className="mettle-input flex-1"
          disabled={isAgentRunning}
          name="transcript"
          placeholder="Add the latest turn"
        />
        <button className="mettle-action" disabled={isAgentRunning} type="submit">
          <ArrowUp size={16} aria-hidden="true" /> Add
        </button>
      </form>

      <button
        className="mettle-fold"
        onClick={() => setShowTranscript((value) => !value)}
        type="button"
        aria-expanded={showTranscript}
      >
        <span>
          Transcript · {transcript.length} turn{transcript.length === 1 ? '' : 's'}
        </span>
        <ChevronDown
          size={16}
          className={showTranscript ? 'rotate-180 transition-transform' : 'transition-transform'}
          aria-hidden="true"
        />
      </button>
      {showTranscript && (
        <section className="mettle-transcript" aria-label="Live transcript">
          {transcript.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No turns yet. Add what was just said.</p>
          ) : (
            transcript.map((turn, index) => (
              <div
                key={`${turn.timestamp}-${index}`}
                className={`mettle-turn ${turn.speaker === 'user' ? 'mettle-turn--user' : 'mettle-turn--counterpart'}`}
              >
                <span className="mettle-turn-label">
                  {turn.speaker === 'user' ? 'You' : counterpartFirst}
                </span>
                {turn.text}
              </div>
            ))
          )}
        </section>
      )}

      {nudges.length > 1 && (
        <>
          <button
            className="mettle-fold"
            onClick={() => setShowHistory((value) => !value)}
            type="button"
            aria-expanded={showHistory}
          >
            <span>Earlier signals · {nudges.length - 1}</span>
            <ChevronDown
              size={16}
              className={showHistory ? 'rotate-180 transition-transform' : 'transition-transform'}
              aria-hidden="true"
            />
          </button>
          {showHistory && (
            <div className="grid gap-2">
              {nudges
                .slice(0, -1)
                .reverse()
                .map((nudge) => (
                  <NudgeCard key={nudge.id} nudge={nudge} />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
