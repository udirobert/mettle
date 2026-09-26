'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Eye,
  FileText,
  Inbox,
  MessageCircle,
  Pencil,
  PlayCircle,
  RefreshCw,
  Scale,
  Share2,
  ShieldCheck,
  Swords,
  Undo2,
  X,
} from 'lucide-react';

import { SAMPLE_ELENA_THREAD, extractBriefFromPaste } from '@/lib/extract-evidence';
import { buildCouncilSplitText, copyText } from '@/lib/share-artifacts';
import { findSource, mergeBriefs, replayHref } from '@/lib/research';
import { Fold } from '@/components/fold';
import { ResearchSourcesForm, useResearchAvailable } from '@/components/research-sources-form';
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
    : 'your counterpart';
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

  // Coach stepper: the three sub-moves made explicit, so the paste→keep→council
  // sequence reads as one path rather than three stacked panels.
  const steps = [
    { label: 'Paste', done: !!brief && brief.status !== 'empty' && brief.status !== 'rejected' },
    { label: 'Keep', done: approved },
    { label: 'Council', done: ready && !!analysis },
  ];
  const activeStep = steps.findIndex((step) => !step.done);
  const atStart = needsPaste && !showCouncil;

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">2 days out · you decide what Mettle sees</p>
        <h2 className="mettle-headline">
          {ready && analysis ? 'Your point of view.' : 'Walk in with a point of view.'}
        </h2>
        {atStart && (
          <p className="mettle-copy">
            Paste the thread, keep the claims you trust, and three adversaries attack your position
            — so {name} can&apos;t surprise you.
          </p>
        )}
        <div className="mettle-coach-steps" aria-label="Coach progress">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`mettle-coach-step ${
                step.done
                  ? 'mettle-coach-step--done'
                  : index === activeStep
                    ? 'mettle-coach-step--active'
                    : ''
              }`}
            >
              <span className="mettle-coach-step-num">{step.done ? '✓' : index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>
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

      {debating && !isAgentRunning && !ready && (
        <section className="mettle-card mettle-card--risk" role="alert">
          <p className="mettle-kicker">
            <CircleAlert size={13} /> Council stalled
          </p>
          <strong>The debate ended before synthesis.</strong>
          <p className="mt-2">
            The agent run stopped early. Restart it — your kept claims are still intact.
          </p>
          <button
            className="mettle-action"
            onClick={() => void runCoach(state.scenario_id || 'lp_renewal')}
            type="button"
            style={{ marginTop: 12 }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Restart the debate
          </button>
        </section>
      )}

      {ready && analysis && (
        <div>
          <button className="mettle-action" onClick={() => setPhase('rehearsal')} type="button">
            Spar with {name}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {(ready || approved || (needsPaste && showCouncil)) && (
        <div>
          {ready && analysis && (
            <Fold label="How the council got there" meta="3 perspectives">
              <PerspectiveGrid analysis={analysis} />
            </Fold>
          )}
          {ready && analysis && <PressureTest analysis={analysis} />}
          {approved && (
            <EvidenceRecap
              brief={brief}
              onReDebate={() => void runCoach(state.scenario_id || 'lp_renewal')}
              isAgentRunning={isAgentRunning}
            />
          )}
          {needsPaste && showCouncil && (
            <Fold label="Add evidence" meta="council ran without a thread">
              <PasteEvidencePanel />
            </Fold>
          )}
          {ready && analysis && (
            <Fold label="Share the split" meta="no thread, no evidence">
              <ShareSplit analysis={analysis} counterpart={name} stakes={state.stakes} />
            </Fold>
          )}
        </div>
      )}
    </div>
  );
}

function PasteEvidencePanel() {
  const { state, setPartial, runCoach, isAgentRunning } = useConversationState();
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = counterpartName(state);
  const privacy = state.privacy_mode ?? 'private';
  const researchAvailable = useResearchAvailable();

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
        setError(
          'Extraction failed and nothing could be pulled locally. Check the paste includes the actual thread, then retry.',
        );
        setExtracting(false);
        return;
      }
      setPartial({
        context_brief: { ...brief, status: 'draft', user_approved_at: null },
        coach_analysis: undefined,
        coach_stage: 'idle',
      });
      setError(null);
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
        You&apos;ll keep or reject each proposed claim before anything reaches the council.
        {privacy === 'private' && ' Private mode is on.'}
      </p>
      <textarea
        className="mettle-textarea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={`From: ${name}\nSubject: Re: Q3…\n\nPaste the emails here.`}
        rows={6}
        style={{ minHeight: 140 }}
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
      </div>
      <Fold label="Other ways to add evidence">
        {researchAvailable && (
          <ResearchSourcesForm
            counterpart={name}
            onBrief={(researched) =>
              setPartial({
                context_brief: mergeBriefs(undefined, researched),
                coach_analysis: undefined,
                coach_stage: 'idle',
              })
            }
          />
        )}
        <div>
          <button
            className={styles.skipBtn}
            disabled={isAgentRunning}
            onClick={() => void runCoach(state.scenario_id || 'lp_renewal')}
            type="button"
          >
            Skip evidence — run the council on the scenario file
          </button>
        </div>
      </Fold>
    </section>
  );
}

function ClaimApprovalPanel({ brief }: { brief: ContextBrief }) {
  const { state, setPartial, runCoach, isAgentRunning } = useConversationState();
  const name = counterpartName(state);
  const privacy = state.privacy_mode ?? 'private';
  const claims = brief.claims ?? [];
  const researchAvailable = useResearchAvailable();
  const approvedCount = claims.filter((claim) => claim.decision === 'approved').length;
  const pendingCount = claims.filter(
    (claim) => !claim.decision || claim.decision === 'pending',
  ).length;

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [lastRejected, setLastRejected] = useState<{ index: number; claim: EvidenceClaim } | null>(
    null,
  );
  const [undoVisible, setUndoVisible] = useState(false);

  const saveEdit = (index: number) => {
    const cleaned = editDraft.trim();
    if (cleaned) {
      const nextClaims = claims.map((claim, i) =>
        i === index ? { ...claim, claim: cleaned } : claim,
      );
      setPartial({ context_brief: { ...brief, claims: nextClaims } });
    }
    setEditingIndex(null);
  };

  const setDecision = (index: number, decision: EvidenceClaim['decision']) => {
    if (decision === 'rejected') {
      setLastRejected({ index, claim: claims[index] });
      setUndoVisible(true);
      window.setTimeout(() => setUndoVisible(false), 5000);
    }
    const nextClaims = claims.map((claim, i) => (i === index ? { ...claim, decision } : claim));
    setPartial({ context_brief: { ...brief, claims: nextClaims } });
  };

  const undoReject = () => {
    if (!lastRejected) return;
    const nextClaims = claims.map((claim, i) =>
      i === lastRejected.index ? { ...lastRejected.claim, decision: 'pending' as const } : claim,
    );
    setPartial({ context_brief: { ...brief, claims: nextClaims } });
    setUndoVisible(false);
    setLastRejected(null);
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
          const editing = editingIndex === index;
          return (
            <li
              key={`${claim.claim}-${index}`}
              className={`${styles.claimRow} ${styles[`claim_${decision}`]}`}
            >
              <div className={styles.claimBody}>
                <span className={styles.claimRelevance}>{claim.relevance}</span>
                {editing ? (
                  <span className={styles.claimEditRow}>
                    <input
                      aria-label="Edit claim"
                      autoFocus
                      className="mettle-input"
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveEdit(index);
                        if (event.key === 'Escape') setEditingIndex(null);
                      }}
                      value={editDraft}
                    />
                    <button
                      className={`${styles.claimBtn} ${styles.claimBtnOn}`}
                      onClick={() => saveEdit(index)}
                      type="button"
                    >
                      <Check size={13} aria-hidden="true" /> Save
                    </button>
                    <button
                      className={styles.claimBtn}
                      onClick={() => setEditingIndex(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <span>{claim.claim}</span>
                    <button
                      aria-label="Edit claim"
                      className={styles.claimEditBtn}
                      onClick={() => {
                        setEditDraft(claim.claim);
                        setEditingIndex(index);
                      }}
                      title="Edit this claim before keeping it"
                      type="button"
                    >
                      <Pencil size={12} aria-hidden="true" /> Edit
                    </button>
                    <SourceLine brief={brief} sourceIds={claim.source_ids} />
                  </>
                )}
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
        {privacy === 'private' && ' Private mode is on — shares are anonymized.'}
      </p>
      {researchAvailable && (
        <Fold label="Add public sources" meta="recorded, replayable">
          <ResearchSourcesForm
            counterpart={name}
            onBrief={(researched) => setPartial({ context_brief: mergeBriefs(brief, researched) })}
          />
        </Fold>
      )}

      {undoVisible && lastRejected && (
        <div className={styles.undoToast} role="status">
          <span>Claim rejected.</span>
          <button className={styles.undoBtn} onClick={undoReject} type="button">
            <Undo2 size={13} aria-hidden="true" /> Undo
          </button>
        </div>
      )}
    </section>
  );
}

const PERSPECTIVE_ORDER = ['skeptic', 'counterpart', 'negotiator'] as const;

const PERSPECTIVE_META: Record<string, { label: string; icon: typeof Eye; role: string }> = {
  skeptic: { label: 'The Skeptic', icon: Eye, role: 'Finds the hole' },
  counterpart: { label: 'The Counterpart', icon: MessageCircle, role: 'Speaks from their seat' },
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

  // Once synthesis lands, the verdict is the interface; the three lenses that
  // produced it fold away below. While debating, the seats ARE the progress.
  if (ready && analysis) {
    return (
      <section className={styles.council} aria-label="Council verdict">
        <DisagreementHero analysis={analysis} counterpart={counterpart} />
      </section>
    );
  }

  return (
    <section className={styles.council} aria-label="Adversarial council" aria-busy={debating}>
      <div className={styles.councilHead}>
        <p className="mettle-kicker">
          <Swords size={13} /> Council
        </p>
        <strong>
          {perspectives.length > 0
            ? 'Perspectives in. Synthesizing the split…'
            : 'Convening three adversaries…'}
        </strong>
      </div>
      <PerspectiveGrid analysis={analysis} />
      <div className={styles.synthesisPending} aria-live="polite">
        {perspectives.length === 0
          ? 'Waiting for the first lens…'
          : 'Holding synthesis until all three have spoken.'}
      </div>
    </section>
  );
}

function PerspectiveGrid({ analysis }: { analysis: CoachAnalysis | undefined }) {
  const byName = Object.fromEntries((analysis?.perspectives ?? []).map((p) => [p.name, p]));
  return (
    <div className={styles.perspectiveGrid}>
      {PERSPECTIVE_ORDER.map((name) => (
        <PerspectiveSeat
          key={name}
          name={name}
          perspective={byName[name]}
          waiting={!byName[name]}
        />
      ))}
    </div>
  );
}

function SourceLine({ brief, sourceIds }: { brief: ContextBrief; sourceIds: string[] }) {
  // Pasted claims come from the thread the user is looking at; only researched
  // claims need a receipt.
  const source = findSource(brief, sourceIds);
  if (!source || source.provider !== 'solari') return null;
  const replay = replayHref(source);
  return (
    <span className="mettle-source-line">
      <span>{source.author || source.title}</span>
      {replay && (
        <a href={replay} target="_blank" rel="noopener noreferrer">
          <PlayCircle size={11} aria-hidden="true" /> Watch how this was found
        </a>
      )}
    </span>
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
      <article
        className={`${styles.perspectiveCard} ${styles.perspectiveWaiting}`}
        aria-label={`${meta.label} is thinking`}
      >
        <div className={styles.perspectiveHead}>
          <Icon size={15} aria-hidden="true" />
          <strong>{meta.label}</strong>
        </div>
        <p className={styles.perspectiveRole}>{meta.role}</p>
        <div className={styles.skeleton} aria-hidden="true">
          <span className={styles.skeletonLine} style={{ width: '88%' }} />
          <span className={styles.skeletonLine} style={{ width: '70%' }} />
          <span className={styles.skeletonLine} style={{ width: '80%' }} />
        </div>
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
}: {
  analysis: CoachAnalysis;
  counterpart: string;
}) {
  const agreed = analysis.consensus?.[0];
  const split = analysis.disagreements?.[0];
  const move = analysis.opening_strategy || analysis.concrete_moves?.[0];
  const lines = (analysis.if_then ?? []).slice(0, 3);
  const firstName = counterpart.split(' ')[0];

  return (
    <div className={styles.hero} aria-label="Council verdict">
      <div className={`${styles.heroBlock} ${styles.heroMove}`}>
        <p className="mettle-kicker">Your opening</p>
        <strong>{move || `Ask ${firstName} what would make renewal simple.`}</strong>
        {lines.length > 0 ? (
          <dl className={styles.ifThen} aria-label={`If ${firstName} pushes back`}>
            {lines.map((line, index) => (
              <div key={`${line.trigger}-${index}`}>
                <dt>If {line.trigger.replace(/\.$/, '')}</dt>
                <dd>{line.response}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Two sentences you can actually say. Then stop.</p>
        )}
      </div>
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
    </div>
  );
}

function ShareSplit({
  analysis,
  counterpart,
  stakes,
}: {
  analysis: CoachAnalysis;
  counterpart: string;
  stakes?: string;
}) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const share = async (anonymize: boolean) => {
    const text = buildCouncilSplitText({ analysis, counterpart, stakes, anonymize });
    const ok = await copyText(text);
    setShareStatus(
      ok ? (anonymize ? 'Anonymized split copied' : 'Council split copied') : 'Copy failed',
    );
    window.setTimeout(() => setShareStatus(null), 2200);
  };

  return (
    <div>
      <div className={styles.shareBar}>
        <p className={styles.shareHint}>
          <Share2 size={12} aria-hidden="true" /> What they agreed, where they split, the move
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
    <Fold
      label="Pressure test detail"
      meta={`${analysis.blind_spots?.length || 0} blind spots · ${analysis.likely_objections?.length || 0} objections`}
    >
      <div className="mettle-grid">
        <AnalysisCard title="Blind spots" items={analysis.blind_spots} tone="risk" />
        <AnalysisCard title="Concrete moves" items={analysis.concrete_moves} tone="signal" />
        <AnalysisCard title="Likely objections" items={analysis.likely_objections} tone="accent" />
      </div>
      <div className="mettle-card">
        <p className="mettle-kicker">
          <CircleAlert size={13} /> Where your position breaks
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
    </Fold>
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
  const replayable = brief.sources.filter((source) => source.replay_session_id).length;

  return (
    <Fold
      label="Approved evidence"
      meta={`${brief.claims.length} kept${replayable ? ` · ${replayable} recorded` : ''}`}
    >
      <ul className="mettle-list">
        {brief.claims.map((claim, index) => (
          <li key={`${claim.claim}-${index}`}>
            {claim.claim}
            <span className="mettle-source-line">
              <span>
                {claim.relevance} · {claim.confidence}
              </span>
              <SourceLine brief={brief} sourceIds={claim.source_ids} />
            </span>
          </li>
        ))}
      </ul>
      {brief.open_commitments.length > 0 && (
        <div className="mettle-card mettle-card--risk">
          <p className="mettle-kicker" style={{ color: 'var(--tomato)' }}>
            <FileText size={12} aria-hidden="true" /> Open commitments
          </p>
          <ul className="mettle-list">
            {brief.open_commitments.map((commitment, index) => (
              <li key={`${commitment}-${index}`}>{commitment}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <button
          className="mettle-icon-action"
          disabled={isAgentRunning}
          onClick={onReDebate}
          type="button"
        >
          <RefreshCw size={14} aria-hidden="true" /> Re-debate with this brief
        </button>
      </div>
    </Fold>
  );
}
