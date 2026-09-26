'use client';

import { ArrowUp, Flame, MessageCircleWarning } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';

const OPENING =
  'Before we discuss a new commitment, explain why I should treat your timeline as credible this time.';

const CONCESSION_PATTERN =
  /\b(sorry|maybe|perhaps|i guess|we could|happy to|of course|absolutely|whatever works|if you want)\b/i;

/**
 * Per-turn read of how the counterpart will hear the answer. Framed as their
 * reaction to the position, never a grade of the person.
 */
function counterpartRead(
  text: string,
  weakPoints: string[],
  firstName: string,
): { headline: string; detail: string } | null {
  const words = text.trim().split(/\s+/).length;
  if (words > 110) {
    return {
      headline: `${firstName} stopped listening halfway.`,
      detail: 'Lead with the ask, then one reason. The rest can wait for the follow-up.',
    };
  }
  if (CONCESSION_PATTERN.test(text)) {
    return {
      headline: `${firstName} hears room to cut.`,
      detail: 'That phrasing signals flexibility before any condition is on the table. Ask first.',
    };
  }
  const numberFree = !/\d/.test(text) && weakPoints.some((p) => /number|detail|data/i.test(p));
  if (numberFree) {
    return {
      headline: `${firstName} has nothing to hold you to.`,
      detail: 'Anchor the next version in one number you own.',
    };
  }
  return null;
}

/** Rehearsal: their pushback and your reply. No soft-ball essay up front. */
export function OpponentChat() {
  const { state, runOpponentTurn, isAgentRunning } = useConversationState();
  const transcript = state.transcript ?? [];
  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';
  const firstName = counterpart.split(' ')[0];
  const openingMove = state.coach_analysis?.opening_strategy;
  const userTurns = transcript.filter((turn) => turn.speaker === 'user').length;
  const watchFor = state.user_weak_points?.[0];

  const lastUserTurn = [...transcript].reverse().find((turn) => turn.speaker === 'user');
  const lastTurnIsLatest =
    transcript.length > 0 && lastUserTurn === transcript[transcript.length - 1];
  const feedback =
    lastTurnIsLatest && lastUserTurn
      ? counterpartRead(lastUserTurn.text, state.user_weak_points ?? [], firstName)
      : null;

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">
          <Flame size={13} className="inline" aria-hidden="true" /> Spar · {counterpart} · private
        </p>
        <h2 className="mettle-headline">Answer {firstName}. Don&apos;t pitch.</h2>
      </header>

      {transcript.length === 0 ? (
        <section className="mettle-card mettle-card--risk" aria-label={`${counterpart}'s opening`}>
          <p className="mettle-kicker">{counterpart}</p>
          <strong>&ldquo;{OPENING}&rdquo;</strong>
          {openingMove && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">Your opening</summary>
              <p className="mt-1">{openingMove}</p>
            </details>
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

      {feedback && (
        <aside className="mettle-card mettle-card--accent" aria-label={`How ${firstName} heard that`}>
          <p className="mettle-kicker">
            <MessageCircleWarning size={13} className="inline" aria-hidden="true" /> How{' '}
            {firstName} heard that
          </p>
          <strong>{feedback.headline}</strong>
          <p className="mt-2">{feedback.detail}</p>
        </aside>
      )}

      {userTurns === 2 && watchFor && !feedback && (
        <aside className="mettle-card mettle-card--accent" aria-label="Pattern to watch">
          <p className="mettle-kicker">Soft spot to protect</p>
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
          placeholder={transcript.length === 0 ? `Answer ${firstName}` : 'Your next line'}
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
