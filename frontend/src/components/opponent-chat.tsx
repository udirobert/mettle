'use client';

import { useEffect, useRef, useState } from 'react';
import { useAgent } from '@copilotkit/react-core/v2';
import { ArrowUp, Flame, Mic, MessageSquareWarning, Square } from 'lucide-react';

import { useConversationState } from '@/hooks/use-conversation-state';
import { DeepgramVoiceSession } from '@/lib/deepgram-voice';
import { EXAMPLE_SCENARIOS } from '@/lib/example-scenarios';

/**
 * Scenario setup lives here too, not only in Coach: the same description (or
 * example chip) is sent through the coach node to synthesize a counterpart
 * persona + opening line, so rehearsal can start standalone.
 *
 * Two input modes against one transcript shape:
 * - Voice (primary demo path): Deepgram Voice Agent in the browser plays the
 *   counterpart; both sides of the exchange stream into state.transcript.
 * - Typed (fallback): a user turn is appended and the LangGraph opponent node
 *   produces the counterpart reply.
 */

type CounterpartProfile = {
  name?: string;
  role?: string;
  style?: string[];
  leverage?: string;
  concerns?: string[];
  opening_line?: string;
};

function buildPersonaPrompt(state: {
  stakes?: string;
  counterpart_profile?: Record<string, unknown>;
}): string {
  const profile = state.counterpart_profile ?? {};
  const concerns = Array.isArray(profile.concerns)
    ? (profile.concerns as string[]).join('; ')
    : '';
  return [
    `You are ${profile.name ?? 'Elena Park'}, ${profile.role ?? 'CIO of Northstar Foundation'},`,
    `in a live meeting about: ${state.stakes ?? 'a $40M LP renewal'}.`,
    `Your style: ${Array.isArray(profile.style) ? (profile.style as string[]).join(', ') : 'analytical, terse, skeptical'}.`,
    `Your leverage: ${profile.leverage ?? 'you can renew at a reduced allocation.'}`,
    `Your concerns: ${concerns}.`,
    'Stay fully in character for the entire conversation. You are not friendly',
    'and not a coach. Keep every reply to one to three spoken sentences. Push',
    'back on vague claims and ask for specifics. Interrupt pleasantries. Do',
    'not concede anything until the user earns it with concrete, dated,',
    'operational answers. Never mention being an AI or that this is practice.',
  ].join(' ');
}

const OPENING_LINE =
  'Before we discuss a new commitment, explain why we should treat the liquidity timeline as credible this time.';

/** Persona-conditioned rehearsal surface, owned by Person A (before + after). */
export function OpponentChat() {
  const { state, setPartial } = useConversationState();
  const { agent } = useAgent();
  const transcript = state.transcript ?? [];
  const profile = (state.counterpart_profile ?? {}) as CounterpartProfile;

  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const sessionRef = useRef<DeepgramVoiceSession | null>(null);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [editingScenario, setEditingScenario] = useState(!profile.name);
  const [description, setDescription] = useState('');
  const [settingScenario, setSettingScenario] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript.length]);

  // Stop the mic/socket if the user navigates away mid-session.
  useEffect(() => () => sessionRef.current?.stop(), []);
  // Leave edit mode once a scenario lands (e.g. set from the Coach tab).
  useEffect(() => {
    if (profile.name && !settingScenario) setEditingScenario(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.name]);

  const appendLive = (speaker: 'user' | 'counterpart', text: string) => {
    const next = [
      ...transcriptRef.current,
      { speaker, text, timestamp: new Date().toISOString() } as const,
    ];
    transcriptRef.current = next;
    setPartial({ transcript: next, phase: 'rehearsal' });
  };

  const setOpponent = async () => {
    stopVoice();
    setSettingScenario(true);
    const newTranscript = description.trim()
      ? [
          {
            speaker: 'user' as const,
            text: `My situation: ${description.trim()}`,
            timestamp: new Date().toISOString(),
          },
        ]
      : [];
    setPartial({
      phase: 'prep',
      transcript: newTranscript,
      scenario_id: newTranscript.length > 0 ? 'custom' : 'lp_renewal',
    });
    try {
      await (agent as unknown as { runAgent?: () => Promise<unknown> }).runAgent?.();
    } finally {
      // Hand control back to rehearsal with a clean transcript against the
      // freshly synthesized opponent.
      setPartial({ phase: 'rehearsal', transcript: [] });
      setDescription('');
      setEditingScenario(false);
      setSettingScenario(false);
    }
  };

  const startVoice = async () => {
    const session = new DeepgramVoiceSession();
    sessionRef.current = session;
    const opening = profile.opening_line || OPENING_LINE;
    try {
      await session.start({
        prompt: buildPersonaPrompt(state),
        greeting: transcriptRef.current.length === 0 ? opening : undefined,
        onTranscript: (role, text) =>
          appendLive(role === 'assistant' ? 'counterpart' : 'user', text),
        onStatus: setVoiceStatus,
      });
    } catch (error) {
      setVoiceStatus(
        error instanceof Error ? error.message : 'failed to start voice session',
      );
      sessionRef.current = null;
    }
  };

  const stopVoice = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setVoiceStatus(null);
  };

  const sendUserTurn = (text: string) => {
    appendLive('user', text);
    // Run the graph so the opponent node replies in character (typed fallback).
    (agent as unknown as { runAgent?: () => Promise<unknown> }).runAgent?.();
  };

  const voiceActive = sessionRef.current !== null;
  const counterpartLabel = profile.name || 'Counterpart';

  return (
    <div className="mettle-phase">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mettle-kicker">Rehearsal / no soft balls</p>
          <h2 className="mettle-headline">Make the case to someone who does not need to agree.</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            className="mettle-action"
            onClick={voiceActive ? stopVoice : startVoice}
            disabled={settingScenario}
            type="button"
          >
            {voiceActive ? (
              <>
                <Square size={14} aria-hidden="true" /> End voice rehearsal
              </>
            ) : (
              <>
                <Mic size={14} aria-hidden="true" /> Start voice rehearsal
              </>
            )}
          </button>
          {voiceStatus && (
            <span style={{ fontSize: 11, opacity: 0.6 }}>{voiceStatus}</span>
          )}
        </div>
      </header>

      {!editingScenario && profile.name ? (
        <section className="mettle-card mettle-card--risk">
          <p className="mettle-kicker">
            <Flame size={13} /> In character
          </p>
          <strong>
            {profile.name}
            {profile.role ? `, ${profile.role}` : ''}
          </strong>
          <p>
            {profile.concerns && profile.concerns.length > 0
              ? `Concerned about: ${profile.concerns.slice(0, 2).join('; ')}`
              : 'They will test conviction, operating detail, and any implied promise.'}
          </p>
          <button
            className="mettle-icon-action"
            style={{ marginTop: 8 }}
            onClick={() => setEditingScenario(true)}
            type="button"
          >
            Change opponent
          </button>
        </section>
      ) : (
        <section className="mettle-card mettle-card--accent">
          <p className="mettle-kicker">Who are you rehearsing against?</p>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
            {EXAMPLE_SCENARIOS.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setDescription(example.text)}
                className="mettle-icon-action"
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                {example.label}
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe who you're facing and what's at stake. Leave empty for the demo scenario (LP renewal)."
            rows={3}
            className="mettle-input"
            style={{ width: '100%', marginTop: 10, resize: 'vertical' }}
          />
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            {profile.name && (
              <button
                className="mettle-icon-action"
                onClick={() => setEditingScenario(false)}
                type="button"
              >
                Cancel
              </button>
            )}
            <button
              className="mettle-action"
              onClick={setOpponent}
              disabled={settingScenario}
              type="button"
            >
              {settingScenario ? 'Setting up…' : 'Set opponent'}
            </button>
          </div>
        </section>
      )}

      <section className="mettle-transcript" aria-label="Rehearsal transcript" ref={scrollRef}>
        {transcript.length === 0 ? (
          <div className="mettle-card">
            <p className="mettle-kicker">
              <MessageSquareWarning size={13} /> Start the room
            </p>
            <strong>Your opening is your first negotiation.</strong>
            <p>Start the voice rehearsal, or type your opening below.</p>
          </div>
        ) : (
          transcript.map((turn, index) => (
            <div
              key={`${turn.timestamp}-${index}`}
              className={`mettle-turn ${turn.speaker === 'user' ? 'mettle-turn--user' : 'mettle-turn--counterpart'}`}
            >
              <span className="mettle-turn-label">
                {turn.speaker === 'user' ? 'You' : counterpartLabel}
              </span>
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
        <input
          className="mettle-input flex-1"
          name="turn"
          placeholder={voiceActive ? 'Voice session live — or type…' : 'Make your opening move'}
        />
        <button className="mettle-action" type="submit" title="Send rehearsal turn">
          <ArrowUp size={16} aria-hidden="true" />
          Send
        </button>
      </form>
    </div>
  );
}
