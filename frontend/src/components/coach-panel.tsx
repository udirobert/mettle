'use client';

import { useState } from 'react';
import {
  ChevronDown,
  CircleAlert,
  Eye,
  MessageCircle,
  Plus,
  Scale,
  ShieldCheck,
  Swords,
  Target,
} from 'lucide-react';

import { useConversationState } from '@/hooks/use-conversation-state';
import type { CoachAnalysis, PerspectiveResult } from '@/hooks/use-conversation-state';

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

      {analysis && <CouncilBrief analysis={analysis} />}
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

const PERSPECTIVE_META: Record<string, { label: string; icon: typeof Eye; role: string }> = {
  skeptic: { label: 'The Skeptic', icon: Eye, role: 'Finds the argument against you' },
  counterpart: { label: 'The Counterpart', icon: MessageCircle, role: "Speaks from Elena's seat" },
  negotiator: { label: 'The Negotiator', icon: Scale, role: 'Tests tactical empathy' },
};

function CouncilBrief({ analysis }: { analysis: CoachAnalysis }) {
  const [showPerspectives, setShowPerspectives] = useState(false);
  const leadMove = analysis.concrete_moves?.[0] || analysis.opening_strategy;
  const tension = analysis.disagreements?.[0];
  const consensus = analysis.consensus?.slice(0, 2) ?? [];

  return (
    <section className="border border-[var(--ink)] bg-[#fffdf7] shadow-[5px_5px_0_var(--ink)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--ink)] bg-[var(--ink)] px-5 py-4 text-white">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--lime)]">
            Council brief
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-normal leading-none">
            The room has a point of tension.
          </h3>
        </div>
        <span className="border border-white/25 px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.08em]">
          3 lenses
        </span>
      </div>

      <div className="grid gap-px bg-[var(--ink)] md:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-[#e2e8ff] p-5">
          <p className="mettle-kicker">Recommendation</p>
          <strong className="block text-base font-extrabold leading-snug">{leadMove}</strong>
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-soft)]">
            The first move should make the decision criteria visible before a number becomes the
            conversation.
          </p>
        </div>
        <div className="bg-[#fff0eb] p-5">
          <p className="mettle-kicker text-[var(--tomato)]">Point of tension</p>
          <strong className="block text-sm font-extrabold leading-snug">
            {tension || 'The council found no material conflict in the position.'}
          </strong>
        </div>
      </div>

      <div className="p-5">
        <p className="mettle-kicker">High-confidence signal</p>
        {consensus.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {consensus.map((item, index) => (
              <li
                className="border-l-4 border-[#83a600] bg-[#f1fad2] px-3 py-2 text-xs font-semibold leading-relaxed"
                key={`${item}-${index}`}
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">The council has not converged yet.</p>
        )}

        {analysis.perspectives.length > 0 && (
          <>
            <button
              aria-expanded={showPerspectives}
              className="mettle-icon-action mt-5"
              onClick={() => setShowPerspectives((value) => !value)}
              type="button"
            >
              <ChevronDown
                className={`transition-transform duration-200 ${showPerspectives ? 'rotate-180' : ''}`}
                size={16}
                aria-hidden="true"
              />
              {showPerspectives ? 'Hide the three lenses' : 'Inspect the three lenses'}
            </button>
            {showPerspectives && (
              <div className="mt-3 grid gap-2 border-t border-[var(--line)] pt-3">
                {analysis.perspectives.map((perspective) => (
                  <PerspectiveCard key={perspective.name} perspective={perspective} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PerspectiveCard({ perspective }: { perspective: PerspectiveResult }) {
  const meta = PERSPECTIVE_META[perspective.name] ?? {
    label: perspective.name,
    icon: Eye,
    role: 'Adversarial review',
  };
  const Icon = meta.icon;

  return (
    <div className="border border-[var(--line)] bg-[#fffdf7] p-4">
      <div className="flex items-center gap-2">
        <Icon size={15} aria-hidden="true" />
        <strong className="text-sm">{meta.label}</strong>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
          {meta.role}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink-soft)]">
        {perspective.analysis}
      </p>
    </div>
  );
}
