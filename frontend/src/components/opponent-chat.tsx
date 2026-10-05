'use client';

import type { CSSProperties } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import styles from './opponent-chat.module.css';

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

function order(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/** Rehearse: the rehearsal floor. Her seat, yours, and the lines between. */
export function OpponentChat() {
  const { state, runOpponentTurn, isAgentRunning, setPhase } = useConversationState();
  const transcript = state.transcript ?? [];
  const counterpart =
    typeof state.counterpart_profile?.name === 'string'
      ? state.counterpart_profile.name
      : 'Counterpart';
  const firstName = counterpart.split(' ')[0];
  const openingMove = state.coach_analysis?.opening_strategy;
  const userTurns = transcript.filter((turn) => turn.speaker === 'user').length;
  const watchFor = state.user_weak_points?.[0];

  const lastTurn = transcript[transcript.length - 1];
  const lastUserTurn = [...transcript].reverse().find((turn) => turn.speaker === 'user');
  const feedback =
    lastTurn && lastTurn === lastUserTurn
      ? counterpartRead(lastTurn.text, state.user_weak_points ?? [], firstName)
      : null;
  const signalToThem = lastTurn?.speaker === 'user';
  const yourTurn = !isAgentRunning;

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">Rehearse · private</p>
        <h2 className="mettle-headline">Answer {firstName}. Don&apos;t pitch.</h2>
        {transcript.length === 0 && state.stakes && (
          <p className="mettle-copy">
            You&apos;re the fund manager. At stake: {state.stakes.replace(/\.$/, '')}.
          </p>
        )}
      </header>

      <div className={`mettle-plan ${styles.stage}`} aria-hidden="true">
        <div className={`${styles.seatGroup} ${styles.seatThem}`}>
          <span className={`mettle-seat mettle-seat--them ${isAgentRunning ? styles.thinking : ''}`}>
            {firstName.charAt(0)}
          </span>
          <span className={styles.seatName}>
            <strong>{counterpart}</strong>
            <span className="mettle-label">{isAgentRunning ? 'Thinking' : 'Investor'}</span>
          </span>
        </div>
        <span className={styles.sightline}>
          <span
            key={transcript.length}
            className={`${styles.signal} ${
              signalToThem
                ? `${styles.signalToThem} mettle-travel-left`
                : `${styles.signalToYou} mettle-travel-right`
            }`}
          />
        </span>
        <div className={`${styles.seatGroup} ${styles.seatGroupYou} ${styles.seatYou}`}>
          <span className="mettle-seat mettle-seat--you">Y</span>
          <span className={styles.seatName}>
            <strong>You</strong>
            <span className="mettle-label">{yourTurn ? 'Your line' : 'Listening'}</span>
          </span>
        </div>
      </div>

      {transcript.length === 0 ? (
        <section className={styles.opening} aria-label={`${counterpart}'s opening`}>
          <figure className={`${styles.them} mettle-deal`}>
            <figcaption className="mettle-label">{counterpart}</figcaption>
            <blockquote>&ldquo;{OPENING}&rdquo;</blockquote>
          </figure>
          {openingMove && (
            <details className={styles.openingHint}>
              <summary>Your opening</summary>
              <p>{openingMove}</p>
            </details>
          )}
        </section>
      ) : (
        <section className={styles.script} aria-label="Rehearsal transcript" aria-live="polite">
          {transcript.map((turn, index) =>
            turn.speaker === 'user' ? (
              <div
                key={`${turn.timestamp}-${index}`}
                className={`${styles.you} mettle-line-in`}
              >
                <span className="mettle-label">You</span>
                <p>{turn.text}</p>
              </div>
            ) : (
              <figure
                key={`${turn.timestamp}-${index}`}
                className={`${styles.them} mettle-line-in`}
              >
                <figcaption className="mettle-label">{counterpart}</figcaption>
                <blockquote>&ldquo;{turn.text}&rdquo;</blockquote>
              </figure>
            ),
          )}
        </section>
      )}

      {feedback && (
        <aside className="mettle-note mettle-deal" aria-label={`How ${firstName} heard that`}>
          <span className="mettle-label">Director&apos;s note</span>
          <strong>{feedback.headline}</strong>
          <p>{feedback.detail}</p>
        </aside>
      )}

      {userTurns === 2 && watchFor && !feedback && (
        <aside className="mettle-note mettle-deal" aria-label="Soft spot to protect">
          <span className="mettle-label">Protect</span>
          <strong>{watchFor}</strong>
        </aside>
      )}

      {userTurns >= 3 && !feedback && !isAgentRunning && (
        <aside className={`mettle-plan mettle-deal ${styles.handoff}`} aria-label="Use it for real">
          <div className={styles.handoffText}>
            <span className="mettle-stamp mettle-line-in" style={order(2)}>
              Rehearsed
            </span>
            <strong>Now do it for a meeting you actually have.</strong>
          </div>
          <button className="mettle-action" type="button" onClick={() => setPhase('prep')}>
            Paste a real thread <ArrowRight size={14} aria-hidden="true" />
          </button>
        </aside>
      )}

      <form
        className={styles.mark}
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
        <span
          className={`mettle-spike ${yourTurn ? 'mettle-spike--live' : ''}`}
          aria-hidden="true"
        />
        <label htmlFor="rehearse-turn" className="sr-only">
          Your reply to {firstName}
        </label>
        <input
          id="rehearse-turn"
          className={`mettle-input ${styles.markInput}`}
          disabled={isAgentRunning}
          name="turn"
          placeholder={
            isAgentRunning
              ? `${firstName} is weighing that…`
              : transcript.length === 0
                ? `Answer ${firstName}`
                : 'Your next line'
          }
          autoComplete="off"
          autoFocus
        />
        <button className="mettle-action" disabled={isAgentRunning} type="submit">
          <ArrowUp size={16} aria-hidden="true" />
          Send
        </button>
      </form>
    </div>
  );
}
