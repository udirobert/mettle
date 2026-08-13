'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Eye,
  FileText,
  Inbox,
  MessageCircle,
  Scale,
  ShieldCheck,
  Swords,
} from 'lucide-react';

import { SAMPLE_ELENA_THREAD, extractBriefFromPaste } from '@/lib/extract-evidence';
import { useConversationState } from '@/hooks/use-conversation-state';
import type {
  CoachAnalysis,
  ContextBrief,
  PerspectiveResult,
} from '@/hooks/use-conversation-state';
import styles from './coach-disclosure.module.css';

function counterpartName(state: { counterpart_profile?: Record<string, unknown> }): string {
  return typeof state.counterpart_profile?.name === 'string'
    ? state.counterpart_profile.name
    : 'Elena Park';
}

/** Pre-conversation briefing surface, owned by the proactive track. */
export function CoachPanel() {
  const { state, setPhase } = useConversationState();
  const analysis = state.coach_analysis;
  const brief = state.context_brief;
  const name = counterpartName(state);
  const needsPaste = !brief || brief.status === 'empty' || brief.status === 'rejected';
  const needsApproval = brief?.status === 'draft';
  const approved = brief?.status === 'approved';

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">2 days · prep incomplete until the council speaks</p>
        <h2 className="mettle-headline">Walk in with a point of view.</h2>
        <p className="mettle-copy">
          Paste the thread with {name}. Approve what is true. Then let three adversaries attack the
          position — and keep the disagreement.
        </p>
      </header>

      {needsPaste && !analysis && <PasteEvidencePanel />}
      {needsApproval && <ContextApprovalPanel brief={brief} />}

      {analysis && (
        <>
          <DisagreementHero analysis={analysis} counterpart={name} />
          <PerspectiveStrip perspectives={analysis.perspectives ?? []} />
          <button className="mettle-action" onClick={() => setPhase('rehearsal')} type="button">
            Rehearse this with {name}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <PressureTest analysis={analysis} />
        </>
      )}

      {approved && !analysis && <RunCoachCard />}
      {approved && <EvidenceRecap brief={brief} />}
      {needsPaste && analysis && <PasteEvidencePanel />}
    </div>
  );
}

function PasteEvidencePanel() {
  const { state, setPartial, runCoach, isAgentRunning } = useConversationState();
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = counterpartName(state);

  const extract = async (source: string) => {
    const cleaned = source.trim();
    if (!cleaned || extracting) return;
    setExtracting(true);
    setError(null);
    try {
      const response = await fetch('/api/extract-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned, counterpart_name: name }),
      });
      const brief = response.ok
        ? ((await response.json()) as ContextBrief)
        : extractBriefFromPaste(cleaned, name);
      if (!brief.claims?.length) {
        setError(
          'Nothing extractable yet. Paste the actual thread — numbers, objections, promises.',
        );
        setExtracting(false);
        return;
      }
      setPartial({ context_brief: { ...brief, status: 'draft', user_approved_at: null } });
    } catch {
      const brief = extractBriefFromPaste(cleaned, name);
      if (!brief.claims.length) {
        setError('Could not extract claims from that paste.');
        setExtracting(false);
        return;
      }
      setPartial({ context_brief: { ...brief, status: 'draft', user_approved_at: null } });
    }
    setExtracting(false);
  };

  return (
    <section className={`mettle-card mettle-card--accent ${styles.pasteCard}`}>
      <p className="mettle-kicker">
        <Inbox size={13} /> Evidence
      </p>
      <strong>Forward or paste the thread with {name}.</strong>
      <p className="mt-2">
        We will pull claims from what you paste. Nothing reaches Coach until you approve it.
      </p>
      <textarea
        className="mettle-textarea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={`From: ${name}\nSubject: Re: Q3…\n\nPaste the emails here.`}
        rows={10}
        aria-label={`Paste correspondence with ${name}`}
      />
      {error && <p className={styles.pasteError}>{error}</p>}
      <div className={styles.pasteActions}>
        <button
          className="mettle-action"
          disabled={extracting || !text.trim()}
          onClick={() => void extract(text)}
          type="button"
        >
          {extracting ? 'Extracting…' : 'Extract claims'}
        </button>
        <button
          className="mettle-icon-action"
          disabled={extracting}
          onClick={() => setText(SAMPLE_ELENA_THREAD)}
          type="button"
        >
          Use sample thread
        </button>
        <button
          className={styles.skipBtn}
          disabled={isAgentRunning}
          onClick={() => void runCoach(state.scenario_id || 'lp_renewal')}
          type="button"
        >
          Skip paste — use the scenario file
        </button>
      </div>
    </section>
  );
}

function ContextApprovalPanel({ brief }: { brief: ContextBrief }) {
  const { state, setPartial, runCoach, isAgentRunning } = useConversationState();
  const name = counterpartName(state);

  const approve = async () => {
    const approved: ContextBrief = {
      ...brief,
      status: 'approved',
      user_approved_at: new Date().toISOString(),
    };
    setPartial({ context_brief: approved });
    await runCoach(state.scenario_id || 'lp_renewal');
  };

  const reject = () => {
    setPartial({ context_brief: undefined });
  };

  return (
    <section className="mettle-card">
      <p className="mettle-kicker">
        <ShieldCheck size={13} /> Approve before Coach sees this
      </p>
      <strong>
        {brief.claims.length} claim{brief.claims.length === 1 ? '' : 's'} from{' '}
        {brief.sources.length} source{brief.sources.length === 1 ? '' : 's'}
      </strong>
      <p className="mt-2">
        These stay out of the debate until you say they are true. Reject and paste again if anything
        is wrong.
      </p>
      <ul className={styles.claimList}>
        {brief.claims.map((claim, index) => (
          <li key={`${claim.claim}-${index}`}>
            <span className={styles.claimRelevance}>{claim.relevance}</span>
            <span>{claim.claim}</span>
          </li>
        ))}
      </ul>
      <div className={styles.pasteActions}>
        <button
          className="mettle-action"
          disabled={isAgentRunning}
          onClick={() => void approve()}
          type="button"
        >
          <ShieldCheck size={14} aria-hidden="true" /> Approve and run Coach
        </button>
        <button className="mettle-icon-action" onClick={reject} type="button">
          Discard
        </button>
      </div>
      <p className={styles.skipHint}>Coach will attack the position using {name}&apos;s thread.</p>
    </section>
  );
}

function RunCoachCard() {
  const { state, runCoach, isAgentRunning } = useConversationState();
  return (
    <section className="mettle-card mettle-card--signal">
      <p className="mettle-kicker">
        <Swords size={13} /> Ready
      </p>
      <strong>Evidence is approved. Run the council.</strong>
      <p>Three adversaries, then a synthesis that keeps the split.</p>
      <button
        className="mettle-action"
        disabled={isAgentRunning}
        onClick={() => void runCoach(state.scenario_id || 'lp_renewal')}
        type="button"
        style={{ marginTop: 12 }}
      >
        {isAgentRunning ? 'Running Coach…' : 'Run Coach'}
      </button>
    </section>
  );
}

function DisagreementHero({
  analysis,
  counterpart,
}: {
  analysis: CoachAnalysis;
  counterpart: string;
}) {
  const agreed = analysis.consensus?.[0];
  const split = analysis.disagreements?.[0];
  const move = analysis.opening_strategy || analysis.concrete_moves?.[0];

  return (
    <section className={styles.hero} aria-label="Council disagreement">
      <div className={`${styles.heroBlock} ${styles.heroAgree}`}>
        <p className="mettle-kicker">They agreed</p>
        <strong>{agreed || 'The council has not named a shared point yet.'}</strong>
      </div>
      <div className={`${styles.heroBlock} ${styles.heroSplit}`}>
        <p className="mettle-kicker" style={{ color: 'var(--tomato)' }}>
          They split
        </p>
        <strong>{split || 'No material conflict in the three lenses.'}</strong>
      </div>
      <div className={`${styles.heroBlock} ${styles.heroMove}`}>
        <p className="mettle-kicker">The move</p>
        <strong>{move || `Ask ${counterpart} what would make renewal simple.`}</strong>
        <p>Two sentences you can actually say. Then stop.</p>
      </div>
    </section>
  );
}

const PERSPECTIVE_META: Record<string, { label: string; icon: typeof Eye; role: string }> = {
  skeptic: { label: 'The Skeptic', icon: Eye, role: 'Finds the hole' },
  counterpart: { label: 'The Counterpart', icon: MessageCircle, role: "Speaks from Elena's seat" },
  negotiator: { label: 'The Negotiator', icon: Scale, role: 'Tests whether she feels cornered' },
};

function PerspectiveStrip({ perspectives }: { perspectives: PerspectiveResult[] }) {
  if (perspectives.length === 0) return null;

  return (
    <div className={styles.perspectiveGrid}>
      {perspectives.map((perspective) => (
        <PerspectiveCard key={perspective.name} perspective={perspective} />
      ))}
    </div>
  );
}

function PerspectiveCard({ perspective }: { perspective: PerspectiveResult }) {
  const [open, setOpen] = useState(false);
  const meta = PERSPECTIVE_META[perspective.name] ?? {
    label: perspective.name,
    icon: Eye,
    role: 'Adversarial review',
  };
  const Icon = meta.icon;
  const truncated =
    perspective.analysis.length > 280 && !open
      ? `${perspective.analysis.slice(0, 280).trim()}…`
      : perspective.analysis;

  return (
    <article className={styles.perspectiveCard}>
      <div className={styles.perspectiveHead}>
        <Icon size={15} aria-hidden="true" />
        <strong>{meta.label}</strong>
      </div>
      <p className={styles.perspectiveRole}>{meta.role}</p>
      <p className={styles.perspectiveBody}>{truncated}</p>
      {perspective.analysis.length > 280 && (
        <button className={styles.moreBtn} onClick={() => setOpen((value) => !value)} type="button">
          {open ? 'Show less' : 'Read the rest'}
        </button>
      )}
    </article>
  );
}

function PressureTest({ analysis }: { analysis: CoachAnalysis }) {
  const { state, setPartial } = useConversationState();
  const weakPoints = state.user_weak_points ?? [];

  return (
    <CollapsibleSection
      title="Pressure test detail"
      summary={`${analysis.blind_spots?.length || 0} blind spots · ${analysis.concrete_moves?.length || 0} moves · ${analysis.likely_objections?.length || 0} objections`}
      icon={Swords}
    >
      <div className="mettle-grid" style={{ marginTop: 12 }}>
        <AnalysisCard title="Blind spots" items={analysis.blind_spots} tone="risk" />
        <AnalysisCard title="Concrete moves" items={analysis.concrete_moves} tone="signal" />
        <AnalysisCard title="Likely objections" items={analysis.likely_objections} tone="accent" />
      </div>
      <div className="mettle-card" style={{ marginTop: 12 }}>
        <p className="mettle-kicker">
          <CircleAlert size={13} /> Your weak points
        </p>
        <ul className="mettle-list" style={{ marginTop: 11 }}>
          {weakPoints.length === 0 ? (
            <li>No weak points surfaced yet.</li>
          ) : (
            weakPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)
          )}
        </ul>
        <button
          className="mettle-icon-action"
          onClick={() =>
            setPartial({ user_weak_points: [...weakPoints, 'New weak point - edit me'] })
          }
          type="button"
          style={{ marginTop: 12 }}
        >
          Add weak point
        </button>
      </div>
    </CollapsibleSection>
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

function EvidenceRecap({ brief }: { brief: ContextBrief }) {
  if (!brief.claims.length) return null;

  return (
    <CollapsibleSection
      title="Approved evidence"
      summary={`${brief.claims.length} claims from the pasted thread`}
      icon={Inbox}
      className="border-[var(--lime)]"
    >
      <ul className="space-y-3">
        {brief.claims.map((claim, index) => (
          <li
            key={index}
            className="border-l-2 border-[var(--lime)] bg-white px-3 py-2 text-xs leading-relaxed"
          >
            <div className="font-semibold text-[var(--ink)]">{claim.claim}</div>
            <div className="mt-1 font-mono text-[10px] uppercase text-[var(--ink-soft)]">
              {claim.relevance} · {claim.confidence} confidence
            </div>
          </li>
        ))}
      </ul>
      {brief.open_commitments.length > 0 && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--tomato)]">
            Open commitments
          </p>
          <ul className="mt-2 space-y-1">
            {brief.open_commitments.map((commitment, index) => (
              <li key={index} className="flex items-start gap-2 text-xs">
                <FileText size={12} className="mt-0.5 text-[var(--tomato)]" />
                <span>{commitment}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  );
}

type CollapsibleSectionProps = {
  title: string;
  summary?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  summary,
  icon: Icon,
  className = '',
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`${styles.collapsible} ${className}`}>
      <button
        type="button"
        className={styles.collapsibleHeader}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className={styles.collapsibleLeft}>
          {Icon && <Icon size={16} className={styles.collapsibleIcon} aria-hidden="true" />}
          <div>
            <h3 className={styles.collapsibleTitle}>{title}</h3>
            {summary && <p className={styles.collapsibleSummary}>{summary}</p>}
          </div>
        </div>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`${styles.collapsibleChevron} ${open ? styles.collapsibleChevronOpen : ''}`}
        />
      </button>
      {open && <div className={styles.collapsibleContent}>{children}</div>}
    </div>
  );
}
