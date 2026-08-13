'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Eye,
  FileText,
  Inbox,
  MessageCircle,
  RefreshCw,
  Scale,
  Share2,
  ShieldCheck,
  Swords,
  X,
} from 'lucide-react';

import { SAMPLE_ELENA_THREAD, extractBriefFromPaste } from '@/lib/extract-evidence';
import { buildCouncilSplitText, copyText } from '@/lib/share-artifacts';
import { useConversationState } from '@/hooks/use-conversation-state';
import type {
  CoachAnalysis,
  ContextBrief,
  EvidenceClaim,
  PerspectiveResult,
} from '@/hooks/use-conversation-state';
import styles from './coach-disclosure.module.css';

function counterpartName(state: { counterpart_profile?: Record<string, unknown> }): string {
  return typeof state.counterpart_profile?.name === 'string'
    ? state.counterpart_profile.name
    : 'Elena Park';
}

function isCouncilReady(analysis: CoachAnalysis | undefined, stage?: string): boolean {
  if (stage === 'ready') return true;
  return !!analysis?.opening_strategy?.trim();
}

/** Pre-conversation briefing: claim-level HITL, then a staged adversarial council. */
export function CoachPanel() {
  const { state, setPhase, runCoach, isAgentRunning } = useConversationState();
  const analysis = state.coach_analysis;
  const brief = state.context_brief;
  const name = counterpartName(state);
  const stage = state.coach_stage;
  const needsPaste = !brief || brief.status === 'empty' || brief.status === 'rejected';
  const needsApproval = brief?.status === 'draft';
  const approved = brief?.status === 'approved';
  const ready = isCouncilReady(analysis, stage);
  const debating = isAgentRunning || stage === 'debating' || (stage === 'perspectives' && !ready);
  const showCouncil = debating || !!analysis;

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">2 days · the council only sees what you keep</p>
        <h2 className="mettle-headline">Walk in with a point of view.</h2>
        <p className="mettle-copy">
          Approve claims from the thread with {name}. Then watch three adversaries attack — and keep
          the split.
        </p>
      </header>

      {needsPaste && !showCouncil && <PasteEvidencePanel />}
      {needsApproval && <ClaimApprovalPanel brief={brief} />}

      {showCouncil && (
        <CouncilChamber
          analysis={analysis}
          counterpart={name}
          stakes={state.stakes}
          debating={debating}
          ready={ready}
        />
      )}

      {ready && analysis && (
        <>
          <button className="mettle-action" onClick={() => setPhase('rehearsal')} type="button">
            Rehearse this with {name}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <PressureTest analysis={analysis} />
        </>
      )}

      {approved && (
        <EvidenceRecap
          brief={brief}
          onReDebate={() => void runCoach(state.scenario_id || 'lp_renewal')}
          isAgentRunning={isAgentRunning}
        />
      )}
      {needsPaste && showCouncil && <PasteEvidencePanel />}
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
      const withDecisions: ContextBrief = {
        ...brief,
        status: 'draft',
        user_approved_at: null,
        claims: brief.claims.map((claim) => ({
          ...claim,
          decision: claim.decision ?? 'pending',
        })),
      };
      setPartial({ context_brief: withDecisions, coach_analysis: undefined, coach_stage: 'idle' });
    } catch {
      const brief = extractBriefFromPaste(cleaned, name);
      if (!brief.claims.length) {
        setError('Could not extract claims from that paste.');
        setExtracting(false);
        return;
      }
      setPartial({
        context_brief: { ...brief, status: 'draft', user_approved_at: null },
        coach_analysis: undefined,
        coach_stage: 'idle',
      });
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
        The agent will propose claims. You keep or reject each one before the council runs.
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

function ClaimApprovalPanel({ brief }: { brief: ContextBrief }) {
  const { state, setPartial, runCoach, isAgentRunning } = useConversationState();
  const name = counterpartName(state);
  const claims = brief.claims ?? [];
  const approvedCount = claims.filter((claim) => claim.decision === 'approved').length;
  const pendingCount = claims.filter(
    (claim) => !claim.decision || claim.decision === 'pending',
  ).length;

  const setDecision = (index: number, decision: EvidenceClaim['decision']) => {
    const nextClaims = claims.map((claim, i) => (i === index ? { ...claim, decision } : claim));
    setPartial({ context_brief: { ...brief, claims: nextClaims } });
  };

  const approveAllPending = () => {
    setPartial({
      context_brief: {
        ...brief,
        claims: claims.map((claim) =>
          claim.decision === 'rejected' ? claim : { ...claim, decision: 'approved' },
        ),
      },
    });
  };

  const debate = async () => {
    const kept = claims.filter((claim) => claim.decision === 'approved');
    if (kept.length === 0) return;
    const approved: ContextBrief = {
      ...brief,
      status: 'approved',
      claims: kept,
      user_approved_at: new Date().toISOString(),
    };
    await runCoach(state.scenario_id || 'lp_renewal', { contextBrief: approved });
  };

  const discard = () => {
    setPartial({ context_brief: undefined, coach_analysis: undefined, coach_stage: 'idle' });
  };

  return (
    <section className="mettle-card" aria-label="Approve evidence claims">
      <p className="mettle-kicker">
        <ShieldCheck size={13} /> Human in the loop
      </p>
      <strong>Keep the claims that are true. Reject the rest. Then re-debate.</strong>
      <p className="mt-2">
        {approvedCount} kept · {pendingCount} pending · Coach only sees what you approve.
      </p>
      <ul className={styles.claimList}>
        {claims.map((claim, index) => {
          const decision = claim.decision ?? 'pending';
          return (
            <li
              key={`${claim.claim}-${index}`}
              className={`${styles.claimRow} ${styles[`claim_${decision}`]}`}
            >
              <div className={styles.claimBody}>
                <span className={styles.claimRelevance}>{claim.relevance}</span>
                <span>{claim.claim}</span>
              </div>
              <div className={styles.claimActions} role="group" aria-label="Claim decision">
                <button
                  className={`${styles.claimBtn} ${decision === 'approved' ? styles.claimBtnOn : ''}`}
                  onClick={() => setDecision(index, 'approved')}
                  type="button"
                  title="Keep for Coach"
                >
                  <Check size={14} aria-hidden="true" />
                  Keep
                </button>
                <button
                  className={`${styles.claimBtn} ${styles.claimBtnReject} ${decision === 'rejected' ? styles.claimBtnOnReject : ''}`}
                  onClick={() => setDecision(index, 'rejected')}
                  type="button"
                  title="Reject claim"
                >
                  <X size={14} aria-hidden="true" />
                  Reject
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className={styles.pasteActions}>
        <button
          className="mettle-action"
          disabled={isAgentRunning || approvedCount === 0}
          onClick={() => void debate()}
          type="button"
        >
          <Swords size={14} aria-hidden="true" /> Debate with {approvedCount} claim
          {approvedCount === 1 ? '' : 's'}
        </button>
        {pendingCount > 0 && (
          <button className="mettle-icon-action" onClick={approveAllPending} type="button">
            Keep all pending
          </button>
        )}
        <button className="mettle-icon-action" onClick={discard} type="button">
          Discard thread
        </button>
      </div>
      <p className={styles.skipHint}>
        The Skeptic, {name}, and the Negotiator will only cite kept claims.
      </p>
    </section>
  );
}

const PERSPECTIVE_ORDER = ['skeptic', 'counterpart', 'negotiator'] as const;

const PERSPECTIVE_META: Record<string, { label: string; icon: typeof Eye; role: string }> = {
  skeptic: { label: 'The Skeptic', icon: Eye, role: 'Finds the hole' },
  counterpart: { label: 'The Counterpart', icon: MessageCircle, role: "Speaks from Elena's seat" },
  negotiator: { label: 'The Negotiator', icon: Scale, role: 'Tests whether she feels cornered' },
};

function CouncilChamber({
  analysis,
  counterpart,
  stakes,
  debating,
  ready,
}: {
  analysis: CoachAnalysis | undefined;
  counterpart: string;
  stakes?: string;
  debating: boolean;
  ready: boolean;
}) {
  const perspectives = analysis?.perspectives ?? [];
  const byName = Object.fromEntries(perspectives.map((p) => [p.name, p]));

  return (
    <section className={styles.council} aria-label="Adversarial council" aria-busy={debating}>
      <div className={styles.councilHead}>
        <p className="mettle-kicker">
          <Swords size={13} /> Council
        </p>
        <strong>
          {ready
            ? 'Synthesis locked. Disagreement preserved.'
            : perspectives.length > 0
              ? 'Perspectives in. Synthesizing the split…'
              : 'Convening three adversaries…'}
        </strong>
      </div>

      <div className={styles.perspectiveGrid}>
        {PERSPECTIVE_ORDER.map((name) => {
          const perspective = byName[name];
          return (
            <PerspectiveSeat
              key={name}
              name={name}
              perspective={perspective}
              waiting={!perspective}
            />
          );
        })}
      </div>

      {ready && analysis ? (
        <DisagreementHero analysis={analysis} counterpart={counterpart} stakes={stakes} />
      ) : (
        <div className={styles.synthesisPending} aria-live="polite">
          {perspectives.length === 0
            ? 'Waiting for the first lens…'
            : 'Holding synthesis until all three have spoken.'}
        </div>
      )}
    </section>
  );
}

function PerspectiveSeat({
  name,
  perspective,
  waiting,
}: {
  name: string;
  perspective?: PerspectiveResult;
  waiting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = PERSPECTIVE_META[name];
  const Icon = meta.icon;

  if (waiting) {
    return (
      <article className={`${styles.perspectiveCard} ${styles.perspectiveWaiting}`}>
        <div className={styles.perspectiveHead}>
          <Icon size={15} aria-hidden="true" />
          <strong>{meta.label}</strong>
        </div>
        <p className={styles.perspectiveRole}>{meta.role}</p>
        <p className={styles.perspectiveBody}>Listening…</p>
      </article>
    );
  }

  const text = perspective!.analysis;
  const truncated = text.length > 280 && !open ? `${text.slice(0, 280).trim()}…` : text;

  return (
    <article className={`${styles.perspectiveCard} ${styles.perspectiveLive}`}>
      <div className={styles.perspectiveHead}>
        <Icon size={15} aria-hidden="true" />
        <strong>{meta.label}</strong>
      </div>
      <p className={styles.perspectiveRole}>{meta.role}</p>
      <p className={styles.perspectiveBody}>{truncated}</p>
      {text.length > 280 && (
        <button className={styles.moreBtn} onClick={() => setOpen((value) => !value)} type="button">
          {open ? 'Show less' : 'Read the rest'}
        </button>
      )}
    </article>
  );
}

function DisagreementHero({
  analysis,
  counterpart,
  stakes,
}: {
  analysis: CoachAnalysis;
  counterpart: string;
  stakes?: string;
}) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const agreed = analysis.consensus?.[0];
  const split = analysis.disagreements?.[0];
  const move = analysis.opening_strategy || analysis.concrete_moves?.[0];

  const share = async (anonymize: boolean) => {
    const text = buildCouncilSplitText({ analysis, counterpart, stakes, anonymize });
    const ok = await copyText(text);
    setShareStatus(
      ok ? (anonymize ? 'Anonymized split copied' : 'Council split copied') : 'Copy failed',
    );
    window.setTimeout(() => setShareStatus(null), 2200);
  };

  return (
    <div className={styles.heroWrap}>
      <div className={styles.hero} aria-label="Council disagreement">
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
      </div>

      <div className={styles.shareBar}>
        <p className={styles.shareHint}>
          <Share2 size={12} aria-hidden="true" /> Share the split — no thread, no evidence
        </p>
        <div className={styles.shareActions}>
          <button className="mettle-action" onClick={() => void share(false)} type="button">
            <Copy size={14} aria-hidden="true" /> Copy split
          </button>
          <button className="mettle-icon-action" onClick={() => void share(true)} type="button">
            Copy anonymized
          </button>
        </div>
        {shareStatus && (
          <p className={styles.shareStatus} role="status">
            {shareStatus}
          </p>
        )}
      </div>
    </div>
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

function EvidenceRecap({
  brief,
  onReDebate,
  isAgentRunning,
}: {
  brief: ContextBrief;
  onReDebate: () => void;
  isAgentRunning: boolean;
}) {
  if (!brief.claims.length) return null;

  return (
    <CollapsibleSection
      title="Approved evidence"
      summary={`${brief.claims.length} kept claims · re-debate anytime`}
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
      <button
        className="mettle-action"
        disabled={isAgentRunning}
        onClick={onReDebate}
        type="button"
        style={{ marginTop: 14 }}
      >
        <RefreshCw size={14} aria-hidden="true" /> Re-debate with this brief
      </button>
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
