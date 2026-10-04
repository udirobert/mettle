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
  Pencil,
  RefreshCw,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  Swords,
  Undo2,
  X,
} from 'lucide-react';

import {
  mergeResearchIntoBrief,
  researchQueryFor,
  type ResearchResult,
} from '@/lib/merge-research';
import { SAMPLE_DANA_THREAD, extractBriefFromPaste } from '@/lib/extract-evidence';
import { buildCouncilSplitText, copyText } from '@/lib/share-artifacts';
import { ProvenanceBadge, ScoutLog } from '@/components/scout-log';
import { useConversationState } from '@/hooks/use-conversation-state';
import type {
  CoachAnalysis,
  ContextBrief,
  EvidenceClaim,
  PerspectiveResult,
  ScoutEvent,
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

  return (
    <div className="mettle-phase">
      <header>
        <p className="mettle-kicker">Before the room · you decide what Mettle sees</p>
        <h2 className="mettle-headline">Walk in with a point of view.</h2>
        <p className="mettle-copy">
          {state.agent_inbox_address ? (
            <>
              Forward the thread to your agent&apos;s own inbox at{' '}
              <strong>{state.agent_inbox_address}</strong>. Keep the claims you trust, and watch
              three adversaries attack your position — so {name} can&apos;t surprise you with
              anything they haven&apos;t already tried.
            </>
          ) : (
            <>
              Forward the thread with {name}, keep the claims you trust, and watch three adversaries
              attack your position — so {name} can&apos;t surprise you with anything they
              haven&apos;t already tried.
            </>
          )}
        </p>
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

      {(state.scout_log?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <ScoutLog events={state.scout_log ?? []} title="Scout — before you arrived" />
        </div>
      )}

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
            onClick={() => void runCoach(state.scenario_id || 'salary_review')}
            type="button"
            style={{ marginTop: 12 }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Restart the debate
          </button>
        </section>
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
          onReDebate={() => void runCoach(state.scenario_id || 'salary_review')}
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
  const [fetching, setFetching] = useState(false);
  const [researching, setResearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = counterpartName(state);
  const role =
    typeof state.counterpart_profile?.role === 'string'
      ? state.counterpart_profile.role
      : undefined;
  const privacy = state.privacy_mode ?? 'private';
  const brief = state.context_brief;

  /**
   * The agent doing its own homework — scoped public research that lands in the
   * same keep/reject gate as the private thread, badged `web` so it is never
   * confused with something the counterpart actually said.
   */
  const runHomework = async () => {
    if (researching) return;
    setResearching(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/agent/context/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: researchQueryFor(name, role),
          counterpart_name: name,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ResearchResult;

      if (result.degraded || !result.claims?.length) {
        setError(result.reason ?? 'Public research is unavailable right now.');
        return;
      }

      const merged = mergeResearchIntoBrief(brief, result);
      const added = merged.claims.length - (brief?.claims.length ?? 0);
      setPartial({ context_brief: merged, coach_analysis: undefined, coach_stage: 'idle' });
      setNotice(
        added > 0
          ? `${added} public claim${added === 1 ? '' : 's'} added — keep the ones that hold up.`
          : 'Nothing new — the research matches what you already have.',
      );
    } catch {
      setError('Could not reach the research service.');
    } finally {
      setResearching(false);
    }
  };

  /**
   * Pull the agent's own inbox. This is the demo's opening beat — the thread
   * arrives by email and the agent has already read it. Degrades to the bundled
   * seed thread server-side, so this never dead-ends without an inbox.
   */
  const fetchFromInbox = async () => {
    if (fetching) return;
    setFetching(true);
    setError(null);
    try {
      const response = await fetch('/api/agent/context/import', { method: 'POST' });
      const result = (await response.json().catch(() => ({}))) as {
        brief?: ContextBrief;
        scout_log?: ScoutEvent[];
        agent_inbox_address?: string;
        degraded?: boolean;
        reason?: string;
      };

      if (!result.brief?.claims?.length) {
        setError(result.reason ?? 'No thread in the agent inbox yet. Forward one, or paste below.');
        return;
      }

      setPartial({
        context_brief: {
          ...result.brief,
          status: 'draft',
          user_approved_at: null,
          claims: result.brief.claims.map((claim) => ({
            ...claim,
            decision: claim.decision ?? 'pending',
          })),
        },
        ...(result.scout_log ? { scout_log: result.scout_log } : {}),
        ...(result.agent_inbox_address ? { agent_inbox_address: result.agent_inbox_address } : {}),
        coach_analysis: undefined,
        coach_stage: 'idle',
      });
    } catch {
      setError('Could not reach the agent inbox. Paste the thread below instead.');
    } finally {
      setFetching(false);
    }
  };

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
      <strong>
        {state.agent_inbox_address
          ? `Forward the thread to ${state.agent_inbox_address} — or paste it here.`
          : `Forward the thread with ${name} — or paste it here.`}
      </strong>
      <p className="mt-2">
        The agent proposes claims from your thread and from public research, each labelled with
        where it came from. You keep or reject every one before the council runs.
        {privacy === 'private' && (
          <>
            {' '}
            <strong style={{ color: 'var(--cobalt)' }}>
              Private mode: nothing here leaves this room.
            </strong>
          </>
        )}
      </p>
      <textarea
        className="mettle-textarea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={`From: ${name}\nSubject: Re: …\n\nPaste the emails here.`}
        rows={10}
        aria-label={`Paste correspondence with ${name}`}
      />
      {error && <p className={styles.pasteError}>{error}</p>}
      {notice && <p className={styles.pasteNotice}>{notice}</p>}
      <div className={styles.pasteActions}>
        {state.agent_inbox_address && (
          <button
            className="mettle-action"
            disabled={fetching}
            onClick={() => void fetchFromInbox()}
            type="button"
            title="Read the thread from Mettle's own inbox"
          >
            <Inbox size={14} aria-hidden="true" />
            {fetching ? 'Reading your inbox…' : 'Check my inbox'}
          </button>
        )}
        <button
          className="mettle-action"
          disabled={researching}
          onClick={() => void runHomework()}
          type="button"
          title="Let Mettle research the public comp band for this role"
        >
          <Search size={14} aria-hidden="true" />
          {researching ? 'Doing homework…' : 'Do homework'}
        </button>
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
          onClick={() => setText(SAMPLE_DANA_THREAD)}
          type="button"
        >
          Use sample thread
        </button>
        <button
          className={styles.skipBtn}
          disabled={isAgentRunning}
          onClick={() => void runCoach(state.scenario_id || 'salary_review')}
          type="button"
        >
          Skip — use the scenario file
        </button>
      </div>
    </section>
  );
}

function ClaimApprovalPanel({ brief }: { brief: ContextBrief }) {
  const { state, setPartial, runCoach, isAgentRunning } = useConversationState();
  const name = counterpartName(state);
  const privacy = state.privacy_mode ?? 'private';
  const claims = brief.claims ?? [];
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
    await runCoach(state.scenario_id || 'salary_review', { contextBrief: approved });
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
                    <ProvenanceBadge provenance={claim.provenance} />
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
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-[var(--ink)]">{claim.claim}</div>
              <ProvenanceBadge provenance={claim.provenance} compact />
            </div>
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
