'use client';

import { ArrowUp, Flame, MessageSquareWarning } from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';

/** Persona-conditioned rehearsal surface, owned by the reactive track. */
export function OpponentChat() {
  const { state, appendTranscriptTurn } = useConversationState();
  const transcript = state.transcript ?? [];

  const sendUserTurn = (text: string) => {
    appendTranscriptTurn({ speaker: 'user', text, timestamp: new Date().toISOString() });
    // TODO(Person A): invoke the opponent graph node and append counterpart response.
  };

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">Rehearsal / no soft balls</p>
        <h2 className="mettle-headline">Make the case to someone who does not need to agree.</h2>
      </header>

      <section className="mettle-card mettle-card--risk">
        <p className="mettle-kicker">
          <Flame size={13} /> In character
        </p>
        <strong>Elena Markova, skeptical LP</strong>
        <p>
          She will test conviction, operating detail, and any implied promise. Expect her to press
          the number you least want to discuss.
        </p>
      </section>

      <section className="mettle-transcript" aria-label="Rehearsal transcript">
        {transcript.length === 0 ? (
          <div className="mettle-card">
            <p className="mettle-kicker">
              <MessageSquareWarning size={13} /> Start the room
            </p>
            <strong>Your opening is your first negotiation.</strong>
            <p>
              Try the opening you plan to use. The opponent should answer with the objection you are
              avoiding.
            </p>
          </div>
        ) : (
          transcript.map((turn, index) => (
            <div
              key={`${turn.timestamp}-${index}`}
              className={`mettle-turn ${turn.speaker === 'user' ? 'mettle-turn--user' : 'mettle-turn--counterpart'}`}
            >
              <span className="mettle-turn-label">{turn.speaker === 'user' ? 'You' : 'Elena'}</span>
              {turn.text}
            </div>
          ))
        )}
      </section>

      <form
        className="flex gap-2 mt-auto"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem('turn') as HTMLInputElement;
          if (input.value.trim()) {
            sendUserTurn(input.value.trim());
            input.value = '';
          }
        }}
      >
        <input className="mettle-input flex-1" name="turn" placeholder="Make your opening move" />
        <button className="mettle-action" type="submit" title="Send rehearsal turn">
          <ArrowUp size={16} aria-hidden="true" />
          Send
        </button>
      </form>
    </div>
  );
}
