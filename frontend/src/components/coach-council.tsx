'use client';

import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  CircleAlert,
  Copy,
  Eye,
  FileText,
  Inbox,
  Link2,
  MessageCircle,
  RefreshCw,
  Scale,
  Share2,
  Swords,
} from 'lucide-react';

import { buildCouncilSplitText, copyText } from '@/lib/share-artifacts';
import { encodeCouncilShareLink } from '@/lib/share-link';
import { ProvenanceBadge } from '@/components/scout-log';
import { useConversationState } from '@/hooks/use-conversation-state';
import type {
  CoachAnalysis,
  ContextBrief,
  EvidenceClaim,
  PerspectiveResult,
} from '@/hooks/use-conversation-state';
import styles from './coach-disclosure.module.css';

const PERSPECTIVE_ORDER = ['skeptic', 'counterpart', 'negotiator'] as const;

const PERSPECTIVE_META: Record<string, { label: string; icon: typeof Eye; role: string }> = {
  skeptic: { label: 'The Skeptic', icon: Eye, role: 'Finds the hole' },
  counterpart: { label: 'The Counterpart', icon: MessageCircle, role: 'Speaks from their seat' },
  negotiator: { label: 'The Negotiator', icon: Scale, role: 'Tests whether they feel cornered' },
};

export function ClaimCitation({ claim }: { claim: EvidenceClaim }) {
  if (!claim.quote) return null;
  const url = claim.source_url;
  const linked = typeof url === 'string' && /^https?:\/\//.test(url);
  const host = linked ? url.replace(/^https?:\/\//, '').split('/')[0] : null;
  const fetched = claim.fetched_at ? new Date(claim.fetched_at) : null;
  const fetchedLabel =
    fetched && !Number.isNaN(fetched.getTime())
      ? fetched.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : claim.fetched_at || null;

  return (
    <blockquote className={styles.claimQuote}>
      <span className={styles.claimQuoteText}>&ldquo;{claim.quote}&rdquo;</span>
      <span className={styles.claimQuoteMeta}>
        {host && (
          <a href={url} target="_blank" rel="noreferrer noopener">
            {host}
          </a>
        )}
        {fetchedLabel && (
          <>
            {host ? ' · ' : ''}read {fetchedLabel}
          </>
        )}
      </span>
    </blockquote>
  );
}

export function CouncilChamber({
  analysis,
  counterpart,
  stakes,
  debating,
  ready,
  brief,
  onReDebate,
  isAgentRunning,
}: {
  analysis: CoachAnalysis | undefined;
  counterpart: string;
  stakes?: string;
  debating: boolean;
  ready: boolean;
  brief?: ContextBrief;
  onReDebate?: () => void;
  isAgentRunning?: boolean;
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
            ? 'Walk-in verdict ready. Working folded below.'
            : perspectives.length > 0
              ? 'Perspectives in. Synthesizing the split…'
              : 'Convening three adversaries…'}
        </strong>
      </div>

      {ready && analysis ? (
        <>
          <DisagreementHero analysis={analysis} counterpart={counterpart} stakes={stakes} />
          <ShowWorkingFold
            analysis={analysis}
            byName={byName}
            brief={brief}
            onReDebate={onReDebate}
            isAgentRunning={isAgentRunning}
          />
        </>
      ) : (
        <>
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
          <div className={styles.synthesisPending} aria-live="polite">
            {perspectives.length === 0
              ? 'Waiting for the first lens…'
              : 'Holding synthesis until all three have spoken.'}
          </div>
        </>
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
  const agreed = analysis.consensus?.[0] || 'The council has not named a shared point yet.';
  const split = analysis.disagreements?.[0] || 'No material conflict in the three lenses.';
  const move =
    analysis.opening_strategy ||
    analysis.concrete_moves?.[0] ||
    `Ask ${counterpart} what would make a yes simple today.`;
  const ifThen = (analysis.if_then ?? []).slice(0, 3);

  const shareText = async (anonymize: boolean) => {
    const text = buildCouncilSplitText({ analysis, counterpart, stakes, anonymize });
    const ok = await copyText(text);
    setShareStatus(
      ok ? (anonymize ? 'Anonymized split copied' : 'Council split copied') : 'Copy failed',
    );
    window.setTimeout(() => setShareStatus(null), 2200);
  };

  const shareLink = async () => {
    const link = encodeCouncilShareLink({
      v: 1,
      counterpart,
      stakes,
      agreed,
      split,
      move,
    });
    const ok = await copyText(link);
    setShareStatus(ok ? 'Share link copied' : 'Copy failed');
    window.setTimeout(() => setShareStatus(null), 2200);
  };

  return (
    <div className={styles.heroWrap}>
      <div className={styles.hero} aria-label="Council disagreement">
        <div className={`${styles.heroBlock} ${styles.heroMove}`}>
          <p className="mettle-kicker">Your opening move</p>
          <strong>{move}</strong>
          <p>Two sentences you can actually say. Then stop.</p>
        </div>
        <div className={`${styles.heroBlock} ${styles.heroAgree}`}>
          <p className="mettle-kicker">They agreed</p>
          <strong>{agreed}</strong>
        </div>
        <div className={`${styles.heroBlock} ${styles.heroSplit}`}>
          <p className="mettle-kicker" style={{ color: 'var(--tomato)' }}>
            They split
          </p>
          <strong>{split}</strong>
        </div>
      </div>

      {ifThen.length > 0 && (
        <div className="mettle-card" style={{ marginTop: 12 }} aria-label="If-then walk-in lines">
          <p className="mettle-kicker">If-then lines (walk-in card)</p>
          <ul className="mettle-list" style={{ marginTop: 8 }}>
            {ifThen.map((line, index) => (
              <li key={index}>
                <strong>If:</strong> {line.trigger} <br />
                <strong>Say:</strong> “{line.response}”
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.shareBar}>
        <p className={styles.shareHint}>
          <Share2 size={12} aria-hidden="true" /> Share the split — no thread, no evidence
        </p>
        <div className={styles.shareActions}>
          <button className="mettle-action" onClick={() => void shareLink()} type="button">
            <Link2 size={14} aria-hidden="true" /> Copy share link
          </button>
          <button
            className="mettle-icon-action"
            onClick={() => void shareText(false)}
            type="button"
          >
            <Copy size={13} aria-hidden="true" /> Copy text
          </button>
          <button className="mettle-icon-action" onClick={() => void shareText(true)} type="button">
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

/**
 * Single "Show working" disclosure fold per North Star restraint rule:
 * houses the three adversary perspectives, pressure test detail, and kept evidence.
 */
function ShowWorkingFold({
  analysis,
  byName,
  brief,
  onReDebate,
  isAgentRunning,
}: {
  analysis: CoachAnalysis;
  byName: Record<string, PerspectiveResult>;
  brief?: ContextBrief;
  onReDebate?: () => void;
  isAgentRunning?: boolean;
}) {
  const { state, setPartial } = useConversationState();
  const weakPoints = state.user_weak_points ?? [];
  const keptCount = brief?.claims?.length ?? 0;

  return (
    <CollapsibleSection
      title="Show working"
      summary={`3 adversary lenses · ${analysis.blind_spots?.length || 0} blind spots · ${
        analysis.likely_objections?.length || 0
      } objections${keptCount ? ` · ${keptCount} kept claims` : ''}`}
      icon={Swords}
    >
      <div className={styles.perspectiveGrid} style={{ marginTop: 8 }}>
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

      {brief && brief.claims.length > 0 && (
        <div className="mettle-card" style={{ marginTop: 12 }}>
          <p className="mettle-kicker">
            <Inbox size={13} /> Approved evidence ({brief.claims.length} kept claims)
          </p>
          <ul className="mt-3 space-y-3">
            {brief.claims.map((claim, index) => (
              <li
                key={index}
                className="border-l-2 border-[var(--lime)] bg-white px-3 py-2 text-xs leading-relaxed"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[var(--ink)]">{claim.claim}</div>
                  <ProvenanceBadge provenance={claim.provenance} compact />
                </div>
                <ClaimCitation claim={claim} />
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
          {onReDebate && (
            <button
              className="mettle-action"
              disabled={isAgentRunning}
              onClick={onReDebate}
              type="button"
              style={{ marginTop: 14 }}
            >
              <RefreshCw size={14} aria-hidden="true" /> Re-debate with this brief
            </button>
          )}
        </div>
      )}
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
