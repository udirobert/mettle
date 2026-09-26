/**
 * The fundraise is the unit of value: each LP meeting adds to a memory of what
 * was asked and promised. Sample pipeline for the demo raise; real data would
 * come from debriefs.
 */

export type ObjectionTheme = 'liquidity' | 'key_person' | 'fees' | 'concentration';

export const OBJECTION_LABELS: Record<ObjectionTheme, string> = {
  liquidity: 'Liquidity timeline',
  key_person: 'Key-person risk',
  fees: 'Fee step-up',
  concentration: 'Portfolio concentration',
};

export type LpStatus = 'committed' | 'met' | 'next' | 'scheduled';

export type LpRecord = {
  name: string;
  org: string;
  status: LpStatus;
  /** Themes this LP pressed on in a prior meeting. */
  objections: ObjectionTheme[];
  /** Commitment the GP made to this LP that is still open. */
  openCommitment?: string;
  scenarioId?: string;
};

export type Fundraise = {
  name: string;
  target: string;
  committed: string;
  lps: LpRecord[];
};

export const FUND_III: Fundraise = {
  name: 'Fund III',
  target: '$250M',
  committed: '$96M',
  lps: [
    {
      name: 'Elena Park',
      org: 'Northstar Foundation',
      status: 'next',
      objections: [],
      scenarioId: 'lp_renewal',
    },
    {
      name: 'David Okafor',
      org: 'Harlow Endowment',
      status: 'met',
      objections: ['liquidity', 'key_person'],
      openCommitment: 'Send Q2 exit pipeline by Friday',
    },
    {
      name: 'Priya Raman',
      org: 'Castell Family Office',
      status: 'met',
      objections: ['liquidity', 'fees'],
    },
    {
      name: 'Tom Becker',
      org: 'Meridian Pension',
      status: 'committed',
      objections: ['key_person'],
    },
    {
      name: 'Ana Soto',
      org: 'Ridge Capital FoF',
      status: 'met',
      objections: ['liquidity', 'concentration'],
      openCommitment: 'Intro to the co-invest partner',
    },
    {
      name: 'Hiro Tanaka',
      org: 'Aster Insurance',
      status: 'scheduled',
      objections: [],
    },
  ],
};

export type ObjectionPattern = {
  theme: ObjectionTheme;
  label: string;
  count: number;
  of: number;
};

/** The objection most LPs have already pressed on — the one to walk in ready for. */
export function topObjectionPattern(raise: Fundraise): ObjectionPattern | null {
  const met = raise.lps.filter((lp) => lp.status === 'met' || lp.status === 'committed');
  if (met.length === 0) return null;
  const counts = new Map<ObjectionTheme, number>();
  for (const lp of met) {
    for (const theme of lp.objections) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }
  const [theme, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!theme || !count) return null;
  return { theme, label: OBJECTION_LABELS[theme], count, of: met.length };
}

export function openCommitments(raise: Fundraise): Array<{ lp: string; item: string }> {
  return raise.lps
    .filter((lp) => lp.openCommitment)
    .map((lp) => ({ lp: lp.name, item: lp.openCommitment as string }));
}
