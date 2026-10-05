import { describe, expect, it } from 'vitest';

import { claimsForCouncil, councilUsage } from './claim-gate';
import type { EvidenceClaim } from '@/hooks/use-conversation-state';

function claim(overrides: Partial<EvidenceClaim>): EvidenceClaim {
  return {
    claim: 'something',
    source_ids: [],
    confidence: 'medium',
    relevance: 'counterpart',
    ...overrides,
  };
}

describe('claimsForCouncil', () => {
  it('never lets pending or rejected claims reach the council', () => {
    const claims = [
      claim({ claim: 'approved one', decision: 'approved' }),
      claim({ claim: 'pending one', decision: 'pending' }),
      claim({ claim: 'rejected one', decision: 'rejected' }),
      claim({ claim: 'undecided one' }),
    ];
    const council = claimsForCouncil(claims);
    expect(council.map((c) => c.claim)).toEqual(['approved one']);
  });

  it('withholds approved claims individually via include_in_coach', () => {
    const claims = [
      claim({ claim: 'in', decision: 'approved' }),
      claim({ claim: 'out', decision: 'approved', include_in_coach: false }),
    ];
    expect(claimsForCouncil(claims).map((c) => c.claim)).toEqual(['in']);
  });
});

describe('councilUsage', () => {
  it('counts X of Y as included of approved', () => {
    const claims = [
      claim({ decision: 'approved' }),
      claim({ decision: 'approved' }),
      claim({ decision: 'approved', include_in_coach: false }),
      claim({ decision: 'pending' }),
    ];
    expect(councilUsage(claims)).toEqual({ total: 4, approved: 3, included: 2, pending: 1 });
  });
});
