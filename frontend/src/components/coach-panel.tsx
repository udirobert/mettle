'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Eye,
  Inbox,
  Pencil,
  RefreshCw,
  Search,
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
import { copyText } from '@/lib/share-artifacts';
import { claimsForCouncil, councilUsage } from '@/lib/claim-gate';
import { buildDebugReport } from '@/lib/debug-report';
import { withDemoParam } from '@/lib/demo';
import { ClaimCitation, CouncilChamber } from '@/components/coach-council';
import { ProvenanceBadge, ScoutLog } from '@/components/scout-log';
import { CounterpartDossier, type CounterpartProfile } from '@/components/dossier';
import { useConversationState } from '@/hooks/use-conversation-state';
import type {
  CoachAnalysis,
  ContextBrief,
  EvidenceClaim,
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

      <CounterpartDossier profile={state.counterpart_profile as CounterpartProfile | undefined} />

      {needsPaste && !showCouncil && <PasteEvidencePanel />}
      {needsApproval && <ClaimApprovalPanel brief={brief} />}

      {showCouncil && (
        <CouncilChamber
          analysis={analysis}
          counterpart={name}
          stakes={state.stakes}
          debating={debating}
          ready={ready}
          brief={approved ? brief : undefined}
          onReDebate={() => void runCoach(state.scenario_id || 'salary_review')}
          isAgentRunning={isAgentRunning}
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
          <button
            className="mettle-icon-action"
            onClick={() => void copyText(buildDebugReport(state))}
            type="button"
            title="Copies run state only — no message text"
          >
            <Copy size={13} aria-hidden="true" /> Copy debug report
          </button>
        </section>
      )}

      {ready && analysis && (
        <button className="mettle-action" onClick={() => setPhase('rehearsal')} type="button">
          Rehearse this with {name}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
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
      const response = await fetch(withDemoParam('/api/agent/context/research'), {
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
      const response = await fetch(withDemoParam('/api/agent/context/import'), { method: 'POST' });
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
      {error && (
        <p className={styles.pasteError}>
          {error}{' '}
          <button
            className={styles.claimEditBtn}
            onClick={() => {
              void copyText(buildDebugReport(state)).then((ok) =>
                setNotice(ok ? 'Debug report copied — no message text included.' : 'Copy failed.'),
              );
            }}
            type="button"
          >
            Copy debug report
          </button>
        </p>
      )}
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
  const usage = councilUsage(claims);
  const pendingCount = usage.pending;

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

  const setIncluded = (index: number, included: boolean) => {
    const nextClaims = claims.map((claim, i) =>
      i === index ? { ...claim, include_in_coach: included } : claim,
    );
    setPartial({ context_brief: { ...brief, claims: nextClaims } });
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
    // Only included claims reach the council — kept-but-withheld claims never
    // enter the brief the model sees.
    const kept = claimsForCouncil(claims);
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
        Council is using {usage.included} of {usage.approved} kept claim
        {usage.approved === 1 ? '' : 's'} · {pendingCount} pending.
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
                      aria-label={`Edit claim ${index + 1} text`}
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
                    <ClaimCitation claim={claim} />
                    <ProvenanceBadge provenance={claim.provenance} />
                    <button
                      aria-label={`Edit claim ${index + 1}`}
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
              <div
                className={styles.claimActions}
                role="group"
                aria-label={`Decision for claim ${index + 1}: ${claim.claim.slice(0, 60)}`}
              >
                <button
                  className={`${styles.claimBtn} ${decision === 'approved' ? styles.claimBtnOn : ''}`}
                  onClick={() => setDecision(index, 'approved')}
                  type="button"
                  title={`Keep claim ${index + 1} for Coach`}
                  aria-label={`Keep claim ${index + 1}`}
                >
                  <Check size={14} aria-hidden="true" />
                  Keep
                </button>
                <button
                  className={`${styles.claimBtn} ${styles.claimBtnReject} ${decision === 'rejected' ? styles.claimBtnOnReject : ''}`}
                  onClick={() => setDecision(index, 'rejected')}
                  type="button"
                  title={`Reject claim ${index + 1}`}
                  aria-label={`Reject claim ${index + 1}`}
                >
                  <X size={14} aria-hidden="true" />
                  Reject
                </button>
                {decision === 'approved' && (
                  <button
                    className={`${styles.claimBtn} ${claim.include_in_coach === false ? styles.claimBtnReject : styles.claimBtnOn}`}
                    aria-pressed={claim.include_in_coach !== false}
                    aria-label={
                      claim.include_in_coach === false
                        ? `Include claim ${index + 1} in the council`
                        : `Withhold claim ${index + 1} from the council`
                    }
                    onClick={() => setIncluded(index, claim.include_in_coach === false)}
                    type="button"
                    title="Whether the council sees this claim"
                  >
                    <Eye size={13} aria-hidden="true" />
                    {claim.include_in_coach === false ? 'Withheld' : 'In council'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className={styles.pasteActions}>
        <button
          className="mettle-action"
          disabled={isAgentRunning || usage.included === 0}
          onClick={() => void debate()}
          type="button"
        >
          <Swords size={14} aria-hidden="true" /> Debate with {usage.included} claim
          {usage.included === 1 ? '' : 's'}
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
