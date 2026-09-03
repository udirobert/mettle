export type MettleEvent = {
  id: string;
  name: string;
  counterpart: string;
  counterpartRole: string;
  stakes: string;
  risk: 'High' | 'Medium';
  timeUntil: string;
  counterpartProfile: {
    name: string;
    role: string;
    style: string[];
    leverage: string;
    concerns: string[];
  };
  userWeakPoints: string[];
};

export const LP_EVENT: MettleEvent = {
  id: 'lp_renewal',
  name: 'LP Renewal',
  counterpart: 'Elena Park',
  counterpartRole: 'CIO, Northstar Foundation',
  stakes: "$40M LP renewal from the fund's second-largest investor.",
  risk: 'High' as const,
  timeUntil: '2 days',
  counterpartProfile: {
    name: 'Elena Park',
    role: 'CIO, Northstar Foundation',
    style: ['analytical', 'terse', 'skeptical'],
    leverage: 'Can renew at a reduced allocation before the next close.',
    concerns: [
      'DPI has lagged the earlier renewal expectation.',
      'Two concentrated positions dominate unrealized value.',
      'The management-fee step-up lacks a clear liquidity case.',
      'Operational changes matter more than another market explanation.',
    ],
  },
  userWeakPoints: [
    'May defend headline return before answering the liquidity question.',
    'May over-explain portfolio detail instead of naming the renewal ask.',
    'May accept a reduced allocation before testing what would unlock full renewal.',
  ],
};

/** Fully selectable secondary events — real prep workspaces, lighter stakes. */
export const SECONDARY_EVENTS: MettleEvent[] = [
  {
    id: 'board_update',
    name: 'Board update',
    counterpart: 'Victoria Sterling',
    counterpartRole: 'Chair, Audit Committee',
    stakes: 'Q3 miss and revised annual guidance.',
    risk: 'High',
    timeUntil: '5 days',
    counterpartProfile: {
      name: 'Victoria Sterling',
      role: 'Chair, Audit Committee',
      style: ['formal', 'prepared', 'direct'],
      leverage: 'Can order an independent review of the miss.',
      concerns: [
        'Guidance was raised two quarters in a row before the miss.',
        'Controls questions after the Q3 close process.',
        'Whether the CEO was informed early enough.',
      ],
    },
    userWeakPoints: [
      'May blame external conditions before owning the forecast process.',
      'May present the revised number before naming what changed.',
      'May get defensive when asked what the board should have known.',
    ],
  },
  {
    id: 'performance_review',
    name: 'Performance review',
    counterpart: 'Marcus Chen',
    counterpartRole: 'Senior Engineer, 8 years tenure',
    stakes: 'Terminating a senior employee with 8 years tenure.',
    risk: 'High',
    timeUntil: 'Tomorrow',
    counterpartProfile: {
      name: 'Marcus Chen',
      role: 'Senior Engineer',
      style: ['quiet', 'loyal', 'detail-oriented'],
      leverage: 'Deep knowledge of the billing system nobody else owns.',
      concerns: [
        'Was told last cycle that the path to staff engineer was clear.',
        'Relocated family for the team two years ago.',
        'Suspects the reorg was the real reason.',
      ],
    },
    userWeakPoints: [
      'May soften the message until it sounds like a performance plan instead of a termination.',
      'May over-explain the business rationale instead of being direct.',
      'May promise outplacement support that has not been approved.',
    ],
  },
  {
    id: 'salary_negotiation',
    name: 'Salary negotiation',
    counterpart: 'Sarah Martinez',
    counterpartRole: 'VP, People',
    stakes: 'VP promotion compensation package.',
    risk: 'Medium',
    timeUntil: '1 week',
    counterpartProfile: {
      name: 'Sarah Martinez',
      role: 'VP, People',
      style: ['warm', 'process-driven', 'firm on bands'],
      leverage: 'Controls the band exception process.',
      concerns: [
        'Compression complaints from two peers if the package is rich.',
        'Equity refresh is decided by a separate committee.',
        'The title change is already approved — only money is open.',
      ],
    },
    userWeakPoints: [
      'May anchor on the title win and under-ask on equity.',
      'May reveal the competing offer before extracting the counter.',
      'May accept "next cycle" framing without a dated commitment.',
    ],
  },
];

/** Legacy list kept for the "calendar noise" contrast section. */
export const CONTRAST_EVENTS = SECONDARY_EVENTS.map((event) => ({
  id: event.id,
  name: event.name,
  counterpart: event.counterpart,
  stakes: event.stakes,
}));

export const ALL_EVENTS: MettleEvent[] = [LP_EVENT, ...SECONDARY_EVENTS];

export function findEvent(id: string): MettleEvent | undefined {
  return ALL_EVENTS.find((event) => event.id === id);
}
