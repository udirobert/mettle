export const LP_EVENT = {
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

export const CONTRAST_EVENTS = [
  {
    id: 'board_update',
    name: 'Board update',
    counterpart: 'Victoria Sterling',
    stakes: 'Q3 miss and revised annual guidance',
  },
  {
    id: 'performance_review',
    name: 'Performance review',
    counterpart: 'Marcus Chen',
    stakes: 'Terminating a senior employee with 8 years tenure',
  },
  {
    id: 'salary_negotiation',
    name: 'Salary negotiation',
    counterpart: 'Sarah Martinez',
    stakes: 'VP promotion compensation package',
  },
] as const;
