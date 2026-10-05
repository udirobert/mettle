'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useInterrupt } from '@copilotkit/react-core/v2';
import { ArrowUp, ArrowRight, Check, Mic, Play, Radio, Send, ThumbsDown, Zap } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import { useSpeechInput } from '@/hooks/use-speech-input';
import { NudgeCard } from '@/components/nudge-card';
import { Fold } from '@/components/fold';
import { readUserName, USER_NAME_EVENT } from '@/lib/user-name';

/** Live: one intervention, then the transcript. Restraint over inventory. */
export function WingmanSidePanel() {
  const {
    state,
    runLiveTurn,
    startReactiveSession,
    setPartial,
    acknowledgeNudge,
    setPhase,
    isAgentRunning,
  } = useConversationState();
  const [speaker, setSpeaker] = useState<'user' | 'counterpart'>('user');
  // The name typed on the docket ("Walking in as…") replaces the generic "Me".
  const [userFirst, setUserFirst] = useState('');
  useEffect(() => {
    const read = () => setUserFirst(readUserName().split(' ')[0] ?? '');
    read();
    window.addEventListener(USER_NAME_EVENT, read);
    return () => window.removeEventListener(USER_NAME_EVENT, read);
  }, []);
  const userLabel = userFirst || 'Me';
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const speech = useSpeechInput(
    useCallback((text: string) => {
      const input = transcriptInputRef.current;
      if (input) input.value = input.value ? `${input.value} ${text}` : text;
    }, []),
  );
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

  const quickAnswer = reactiveInterrupt ?? (
    <button
      className="mettle-action"
      disabled={isAgentRunning}
      onClick={() => void startReactiveSession()}
      type="button"
      style={{ marginTop: 12 }}
    >
      <Zap size={14} aria-hidden="true" /> Quick answer
    </button>
  );

  const submitTranscript = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get('transcript');
    if (typeof text !== 'string' || !text.trim()) return;
    await runLiveTurn(speaker, text);
    event.currentTarget.reset();
  };

  return (
    <div className="mettle-phase mettle-backstage">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="mettle-kicker">Backstage · live</p>
          <h2 className="mettle-headline">Stay in the room.</h2>
        </div>
        <span className="mettle-label inline-flex items-center gap-2">
          <span className="mettle-spike mettle-spike--them mettle-spike--live" aria-hidden="true" />
          <Radio size={12} className="sr-only" aria-hidden="true" />
          {isAgentRunning ? 'Thinking' : 'Listening'}
        </span>
      </header>

      {transcript.length === 0 && (
        <p className="mettle-premise">
          Log each turn. You&apos;ll only hear from us when it matters.
        </p>
      )}

      {reactiveReply ? (
        <section className="mettle-card mettle-card--accent" aria-label="Current intervention">
          <p className="mettle-kicker">
            <Zap size={13} /> Say this next
          </p>
          <strong>{reactiveReply}</strong>
          <p>Two sentences. Then stop and listen.</p>
          {quickAnswer}
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
          {quickAnswer}
        </section>
      ) : (
        <section className="mettle-card mettle-card--accent" aria-label="Current intervention">
          <p className="mettle-kicker">
            <Zap size={13} /> Standing by
          </p>
          <strong>Quiet until something matters.</strong>
          <p>Wingman interrupts only for a concession, monologue, repetition, or timing slip.</p>
          <div className="flex flex-wrap gap-2">
            {quickAnswer}
            {transcript.length === 0 && (
              <button
                className="mettle-icon-action"
                onClick={simulateOpening}
                type="button"
                style={{ marginTop: 12 }}
              >
                <Play size={13} aria-hidden="true" /> Simulate {counterpartFirst}&apos;s opening
              </button>
            )}
          </div>
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
            {userLabel}
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
          ref={transcriptInputRef}
          className="mettle-input flex-1"
          disabled={isAgentRunning}
          name="transcript"
          placeholder="Add the latest turn"
        />
        {speech.supported && (
          <button
            aria-label={
              speech.listening
                ? `Stop dictating (as ${speaker === 'user' ? 'you' : counterpartFirst})`
                : `Dictate the turn as ${speaker === 'user' ? 'you' : counterpartFirst}`
            }
            aria-pressed={speech.listening}
            className="mettle-icon-action"
            disabled={isAgentRunning}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            title="Push to talk — transcribed by your browser's speech service"
            type="button"
          >
            <Mic size={14} aria-hidden="true" />
            {speech.listening ? 'Listening…' : 'Talk'}
          </button>
        )}
        <button className="mettle-action" disabled={isAgentRunning} type="submit">
          <ArrowUp size={16} aria-hidden="true" /> Add
        </button>
      </form>
      {speech.supported && (
        <p
          className="mettle-label"
          style={{ color: 'var(--ink-soft)', marginTop: -4, fontSize: 9 }}
        >
          Dictation is transcribed by your browser&apos;s speech service — audio goes to the browser
          vendor, and the turn is attributed to whoever the {userLabel} / {counterpartFirst} toggle
          is set to.
        </p>
      )}

      <div>
        <Fold
          label="Transcript"
          meta={`${transcript.length} turn${transcript.length === 1 ? '' : 's'}`}
        >
          <section className="mettle-transcript" aria-label="Live transcript">
            {transcript.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">
                No turns yet. Add what was just said.
              </p>
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
        </Fold>

        {nudges.length > 1 && (
          <Fold label="Earlier signals" meta={`${nudges.length - 1}`}>
            {nudges
              .slice(0, -1)
              .reverse()
              .map((nudge) => (
                <NudgeCard key={nudge.id} nudge={nudge} />
              ))}
          </Fold>
        )}
      </div>

      {/* Exit path: once the conversation is real, offer the handoff to Debrief. */}
      {(() => {
        const counterpartTurns = transcript.filter((turn) => turn.speaker === 'counterpart').length;
        const debriefable = (state.nudges_sent?.length ?? 0) > 0 || counterpartTurns >= 2;
        if (!debriefable) return null;
        return (
          <button
            className="mettle-action"
            onClick={() => setPhase('debrief')}
            type="button"
            style={{ marginTop: 4 }}
          >
            <ArrowRight size={14} aria-hidden="true" /> Conversation done — go to Debrief
          </button>
        );
      })()}
    </div>
  );
}
