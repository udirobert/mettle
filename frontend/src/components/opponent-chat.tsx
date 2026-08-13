'use client';

import { ArrowUp, Flame } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';

const ELENA_OPENING =
  'Before we discuss a new commitment, explain why we should treat the liquidity timeline as credible this time.';

/** Rehearsal: her pushback and your reply. No soft-ball essay up front. */
export function OpponentChat() {
  const { state, runOpponentTurn, isAgentRunning } = useConversationState();
  const transcript = state.transcript ?? [];
  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Elena Park';
  const openingMove = state.coach_analysis?.opening_strategy;
  const userTurns = transcript.filter((turn) => turn.speaker === 'user').length;
  const watchFor = state.user_weak_points?.[0];

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">
          <Flame size={13} className="inline" aria-hidden="true" /> Rehearse · {counterpart}
        </p>
        <h2 className="mettle-headline">Answer her. Do not pitch around her.</h2>
      </header>

      {transcript.length === 0 ? (
        <section className="mettle-card mettle-card--risk" aria-label={`${counterpart}'s opening`}>
          <p className="mettle-kicker">{counterpart}</p>
          <strong>&ldquo;{ELENA_OPENING}&rdquo;</strong>
          {openingMove && (
            <p className="mt-2">
              Coach&apos;s first move was: {openingMove} Try it — or find a better one.
            </p>
          )}
        </section>
      ) : (
        <section className="mettle-transcript" aria-label="Rehearsal transcript">
          {transcript.map((turn, index) => (
            <div
              key={`${turn.timestamp}-${index}`}
              className={`mettle-turn ${turn.speaker === 'user' ? 'mettle-turn--user' : 'mettle-turn--counterpart'}`}
            >
              <span className="mettle-turn-label">
                {turn.speaker === 'user' ? 'You' : counterpart}
              </span>
              {turn.text}
            </div>
          ))}
        </section>
      )}

      {userTurns >= 2 && watchFor && (
        <aside className="mettle-card mettle-card--accent" aria-label="Pattern to watch">
          <p className="mettle-kicker">Watch your pattern</p>
          <strong>{watchFor}</strong>
        </aside>
      )}

      <form
        className="flex gap-2 mt-auto"
        onSubmit={async (event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem('turn') as HTMLInputElement;
          const text = input.value.trim();
          if (text) {
            input.value = '';
            await runOpponentTurn(text);
          }
        }}
      >
        <input
          className="mettle-input flex-1"
          disabled={isAgentRunning}
          name="turn"
          placeholder={transcript.length === 0 ? 'Answer Elena' : 'Your next line'}
          autoFocus
        />
        <button
          className="mettle-action"
          disabled={isAgentRunning}
          type="submit"
          title="Send rehearsal turn"
        >
          <ArrowUp size={16} aria-hidden="true" />
          Send
        </button>
      </form>
    </div>
  );
}
