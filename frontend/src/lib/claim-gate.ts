import type { EvidenceClaim } from '@/hooks/use-conversation-state';

/**
 * The single source of truth for "which claims reach the council".
 *
 * Two gates compose: `decision === 'approved'` is the human keep/reject gate,
 * and `include_in_coach` lets an approved claim be individually withheld.
 * Anything pending or rejected never reaches a Coach prompt.
 */
export function claimsForCouncil(claims: EvidenceClaim[]): EvidenceClaim[] {
  return claims.filter(
    (claim) => claim.decision === 'approved' && claim.include_in_coach !== false,
  );
}

/** "Council is using X of Y claims" — X included, Y kept. */
export function councilUsage(claims: EvidenceClaim[]): {
  total: number;
  approved: number;
  included: number;
  pending: number;
} {
  const approved = claims.filter((claim) => claim.decision === 'approved');
  return {
    total: claims.length,
    approved: approved.length,
    included: claimsForCouncil(claims).length,
    pending: claims.filter(
      (claim) => !claim.decision || claim.decision === 'pending',
    ).length,
  };
}
