import type { ContextBrief, EvidenceClaim } from '@/hooks/use-conversation-state';

/** What /context/research returns, per the pinned contract. */
export type ResearchResult = {
  claims?: EvidenceClaim[];
  sources?: ContextBrief['sources'];
  degraded?: boolean;
  reason?: string;
};

function claimKey(claim: EvidenceClaim): string {
  return claim.claim.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Fold web research into the brief the user is already reviewing.
 *
 * Two rules matter here. Sources dedupe on source_id (Exa uses the result URL),
 * otherwise a second research pass doubles every citation. Claims dedupe on
 * normalized text, because Exa highlights overlap heavily between similar
 * results and a gate showing the same sentence twice reads as a bug.
 *
 * New claims always land `pending` — research is unvetted public data, so it
 * must clear the same human-in-the-loop gate as the private thread.
 */
export function mergeResearchIntoBrief(
  brief: ContextBrief | undefined,
  result: ResearchResult,
): ContextBrief {
  const base: ContextBrief = brief ?? {
    status: 'draft',
    sources: [],
    claims: [],
    counterpart_history: [],
    open_commitments: [],
    sensitive_redactions: [],
    user_approved_at: null,
  };

  const seenSources = new Set(base.sources.map((s) => s.source_id));
  const newSources = (result.sources ?? []).filter((source) => {
    if (seenSources.has(source.source_id)) return false;
    seenSources.add(source.source_id);
    return true;
  });

  const seenClaims = new Set(base.claims.map(claimKey));
  const newClaims = (result.claims ?? []).filter((claim) => {
    const key = claimKey(claim);
    if (!key || seenClaims.has(key)) return false;
    seenClaims.add(key);
    return true;
  });

  if (newClaims.length === 0 && newSources.length === 0) {
    return base;
  }

  return {
    ...base,
    sources: [...base.sources, ...newSources],
    claims: [
      ...base.claims,
      // Force provenance + pending regardless of what the backend sent — the
      // badge and the gate are the contract with the user, not the payload.
      ...newClaims.map(
        (claim): EvidenceClaim => ({
          ...claim,
          provenance: 'web',
          decision: 'pending',
        }),
      ),
    ],
    // Research is new evidence, so any prior approval no longer covers the
    // whole brief. Drop it back to draft rather than implying the user vetted
    // claims they have not seen.
    status: 'draft',
    user_approved_at: null,
  };
}

/**
 * Build the research query from the event on the docket.
 *
 * Deliberately scoped and role-led: a surname plus "compensation band" searches
 * for one named person's salary, which is both useless and a privacy problem.
 * The role is what has public comp data attached to it.
 */
export function researchQueryFor(counterpartName: string, role?: string): string {
  const roleLabel = role?.trim();
  return roleLabel
    ? `${roleLabel} compensation band public salary data`
    : `${counterpartName.split(' ').at(-1) ?? 'manager'} compensation band`;
}
