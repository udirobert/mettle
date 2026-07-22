'use client';

import {
  CircleAlert,
  Eye,
  Flame,
  Handshake,
  MessageCircleQuote,
  Plus,
  Scale,
  ShieldCheck,
  Swords,
  Target,
} from 'lucide-react';
import { useConversationState } from '@/hooks/use-conversation-state';
import type { PerspectiveResult } from '@/hooks/use-conversation-state';

/** Pre-conversation briefing surface, owned by the proactive track. */
export function CoachPanel() {
  const { state, setPartial } = useConversationState();
  const weakPoints = state.user_weak_points ?? [];
  const analysis = state.coach_analysis;

  const addWeakPoint = () => {
    setPartial({ user_weak_points: [...weakPoints, 'New weak point - edit me'] });
  };

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">Position before performance</p>
        <h2 className="mettle-headline">Walk in with a point of view.</h2>
        <p className="mettle-copy">
          Mettle has loaded the pressure points. Build the case before the room starts setting the
          terms.
        </p>
      </header>

      <div className="mettle-grid">
        <section className="mettle-card mettle-card--risk">
          <p className="mettle-kicker">
            <CircleAlert size={13} /> Stakes
          </p>
          <strong>{state.stakes || '$40M LP renewal'}</strong>
          <p>Second-largest investor. This is an expectation-setting meeting, not a status call.</p>
        </section>
        <section className="mettle-card mettle-card--signal">
          <p className="mettle-kicker">
            <Target size={13} /> Win condition
          </p>
          <strong>Protect the renewal standard</strong>
          <p>Leave with a credible path to a full renewal, not a premature concession.</p>
        </section>
      </div>

      <section className="mettle-card mettle-card--accent">
        <p className="mettle-kicker">
          <Swords size={13} /> Opening move
        </p>
        <strong>
          {analysis?.opening_strategy ||
            'Lead with the portfolio evidence, then ask what would make renewal simple.'}
        </strong>
        <p>
          Put the operating picture on the table before Elena can frame the discussion around a
          number.
        </p>
      </section>

      <section>
        <h3 className="mettle-section-title">Pressure test</h3>
        <div className="mettle-grid" style={{ marginTop: 12 }}>
          <AnalysisCard title="Blind spots" items={analysis?.blind_spots} tone="risk" />
          <AnalysisCard title="Concrete moves" items={analysis?.concrete_moves} tone="signal" />
          <AnalysisCard
            title="Likely objections"
            items={analysis?.likely_objections}
            tone="accent"
          />
          <div className="mettle-card">
            <p className="mettle-kicker">
              <ShieldCheck size={13} /> Your weak points
            </p>
            <ul className="mettle-list" style={{ marginTop: 11 }}>
              {weakPoints.length === 0 ? (
                <li>No weak points surfaced yet.</li>
              ) : (
                weakPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)
              )}
            </ul>
            <button
              className="mettle-action"
              onClick={addWeakPoint}
              type="button"
              style={{ marginTop: 12 }}
            >
              <Plus size={14} aria-hidden="true" /> Add weak point
            </button>
          </div>
        </div>
      </section>

      {analysis?.perspectives && analysis.perspectives.length > 0 && (
        <section>
          <h3 className="mettle-section-title">Three advisors weighed in</h3>
          <p className="mettle-copy" style={{ marginBottom: 12 }}>
            The Skeptic attacks the position. The Counterpart speaks from their seat. The Negotiator
            checks the emotional leverage. They ran independently — the synthesis surfaced where
            they clashed.
          </p>
          <div className="mettle-grid" style={{ marginTop: 12 }}>
            {analysis.perspectives.map((p) => (
              <PerspectiveCard key={p.name} perspective={p} />
            ))}
          </div>
        </section>
      )}

      {analysis?.disagreements && analysis.disagreements.length > 0 && (
        <section className="mettle-card mettle-card--risk">
          <p className="mettle-kicker">
            <Flame size={13} /> Where they disagreed
          </p>
          <ul className="mettle-list" style={{ marginTop: 11 }}>
            {analysis.disagreements.map((d, i) => (
              <li key={`${d}-${i}`}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      {analysis?.consensus && analysis.consensus.length > 0 && (
        <section className="mettle-card mettle-card--signal">
          <p className="mettle-kicker">
            <Handshake size={13} /> Where they agreed
          </p>
          <ul className="mettle-list" style={{ marginTop: 11 }}>
            {analysis.consensus.map((c, i) => (
              <li key={`${c}-${i}`}>{c}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AnalysisCard({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[];
  tone: 'risk' | 'signal' | 'accent';
}) {
  const fallback: Record<typeof tone, string> = {
    risk: 'No blind spots are loaded yet.',
    signal: 'No concrete moves are loaded yet.',
    accent: 'No objections are loaded yet.',
  };

  return (
    <div className={`mettle-card mettle-card--${tone}`}>
      <p className="mettle-kicker">{title}</p>
      <ul className="mettle-list" style={{ marginTop: 11 }}>
        {items?.length ? (
          items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
        ) : (
          <li>{fallback[tone]}</li>
        )}
      </ul>
    </div>
  );
}

const PERSPECTIVE_META: Record<
  string,
  { label: string; icon: typeof Eye; tone: 'risk' | 'accent' | 'signal' }
> = {
  skeptic: { label: 'The Skeptic', icon: Eye, tone: 'risk' },
  counterpart: { label: 'The Counterpart', icon: MessageCircleQuote, tone: 'accent' },
  negotiator: { label: 'The Negotiator', icon: Scale, tone: 'signal' },
};

function PerspectiveCard({ perspective }: { perspective: PerspectiveResult }) {
  const meta = PERSPECTIVE_META[perspective.name] ?? {
    label: perspective.name,
    icon: Eye,
    tone: 'risk' as const,
  };
  const Icon = meta.icon;

  return (
    <div className={`mettle-card mettle-card--${meta.tone}`}>
      <p className="mettle-kicker">
        <Icon size={13} /> {meta.label}
      </p>
      <p style={{ marginTop: 11, whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.5 }}>
        {perspective.analysis}
      </p>
    </div>
  );
}
