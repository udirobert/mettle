export type IfThen = { trigger: string; response: string };

/** What fits on one screen when there are five minutes left. */
export type WalkIn = {
  opening: string;
  ifThen: IfThen[];
  /** The one thing not to say or do in this room. */
  avoid: string;
};

export type MettleEvent = {
  id: string;
  name: string;
  /** The moment in the raise, e.g. "Renewal" or "Bad news". */
  kind: string;
  counterpart: string;
  counterpartRole: string;
  stakes: string;
  risk: 'High' | 'Medium';
  timeUntil: string;
  counterpartProfile: {
    name: string;
    /** Where they work. Qualifies memory so two people with one name stay apart. */
    organization?: string;
    role: string;
    style: string[];
    leverage: string;
    concerns: string[];
  };
  userWeakPoints: string[];
  walkIn: WalkIn;
};

export const LP_EVENT: MettleEvent = {
  id: 'lp_renewal',
  name: 'LP Renewal',
  kind: 'Renewal',
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
  walkIn: {
    opening:
      'Name the liquidity milestone and its date before she asks. Then ask what would make the full $40M an easy decision.',
    ifThen: [
      {
        trigger: 'she asks why liquidity will be different this time',
        response: 'We changed how we exit, not just when. Here is the dated milestone we report against.',
      },
      {
        trigger: 'she floats a reduced allocation',
        response: 'Before we size it — what would make the full amount easy for your committee?',
      },
      {
        trigger: 'she calls the fee step-up unjustified',
        response: 'Fair. Tie the step-up to the milestone. If we miss it, the step-up waits.',
      },
    ],
    avoid: 'Defending the headline return before answering the liquidity question.',
  },
};

/**
 * Other LP meetings in the Fund III raise — different LP types and different
 * moments. Each maps to a backend scenario in /scenarios.
 */
export const RAISE_EVENTS: MettleEvent[] = [
  {
    id: 'lp_bad_news',
    name: 'Partner departure call',
    kind: 'Bad news',
    counterpart: 'Tom Becker',
    counterpartRole: 'Senior PM, Meridian Pension',
    stakes: 'Telling your anchor LP a founding partner is leaving, before the final close.',
    risk: 'High',
    timeUntil: 'Today, 4pm',
    counterpartProfile: {
      name: 'Tom Becker',
      role: 'Senior Portfolio Manager, Meridian Pension',
      style: ['loyal', 'blunt', 'hates surprises'],
      leverage:
        'The key-person clause lets Meridian suspend its $40M commitment, and other LPs will follow its lead.',
      concerns: [
        'Whether the key-person clause is triggered.',
        'Why he is hearing this now and not earlier.',
        "Who takes over the departing partner's board seats.",
        'What to tell his own investment committee this week.',
      ],
    },
    userWeakPoints: [
      'May soften the news until it is unclear what actually happened.',
      'May lead with the succession plan before stating the departure plainly.',
      'May guess at key-person legal consequences instead of committing to a dated answer.',
    ],
    walkIn: {
      opening:
        'Say it in the first sentence: "Sarah is leaving the firm at year end. You are the first LP I am calling." Then stop and let him react.',
      ifThen: [
        {
          trigger: 'he asks whether key-person is triggered',
          response: 'Counsel is confirming in writing. You will have their answer by Thursday — not my guess today.',
        },
        {
          trigger: 'he asks why he is only hearing now',
          response: 'She told us on Monday. We took two days to confirm coverage, then called you first.',
        },
        {
          trigger: 'he asks what to tell his committee',
          response: 'I will send you a one-page note tonight you can forward as-is.',
        },
      ],
      avoid: 'Opening with the succession plan before saying plainly that she is leaving.',
    },
  },
  {
    id: 'lp_endowment_followup',
    name: 'Second meeting',
    kind: 'Follow-up',
    counterpart: 'David Okafor',
    counterpartRole: 'Private Markets, Harlow Endowment',
    stakes: 'Second meeting with a $25M prospect; you owe him the Q2 exit pipeline.',
    risk: 'High',
    timeUntil: 'Tomorrow',
    counterpartProfile: {
      name: 'David Okafor',
      role: 'Director of Private Markets, Harlow Endowment',
      style: ['methodical', 'courteous', 'remembers everything'],
      leverage: 'Can stall the commitment to the next investment committee cycle, six months out.',
      concerns: [
        'Key-person risk if the founding partner steps back during the fund life.',
        'The Q2 exit pipeline you promised at the first meeting.',
        'Whether the liquidity story has changed since the first meeting.',
        'How succession is written into the LPA, not just described.',
      ],
    },
    userWeakPoints: [
      'May gloss over the late exit-pipeline document instead of owning it.',
      'May describe succession as culture rather than as contractual terms.',
      'May repeat the first-meeting pitch instead of answering what he asked last time.',
    ],
    walkIn: {
      opening:
        'Open with what you owe him: "I promised the Q2 exit pipeline. Here it is, and here is why it was late."',
      ifThen: [
        {
          trigger: 'he raises key-person risk again',
          response: 'It is in the LPA — here is the exact trigger and the cure period.',
        },
        {
          trigger: 'he asks what changed since last time',
          response: 'Here is what moved and what slipped since we met. Both, not just the good one.',
        },
      ],
      avoid: 'Re-running the first-meeting pitch instead of answering what he asked last time.',
    },
  },
  {
    id: 'lp_family_office',
    name: 'Family office meeting',
    kind: 'Relationship',
    counterpart: 'Priya Raman',
    counterpartRole: 'Principal, Castell Family Office',
    stakes: '$15M from a single-family office that invests on relationship and gut feel.',
    risk: 'Medium',
    timeUntil: 'Friday',
    counterpartProfile: {
      name: 'Priya Raman',
      role: 'Principal, Castell Family Office',
      style: ['warm', 'intuitive', 'tests for consistency'],
      leverage: 'Can walk away without explanation; the family has no committee to answer to.',
      concerns: [
        'Whether the fee step-up is fair to a long-term relationship.',
        "Liquidity timing relative to the family's own distribution needs.",
        'Consistency between what the GP said last year and what they say now.',
        'Whether she will get real access to the partners, not just IR.',
      ],
    },
    userWeakPoints: [
      'May lead with numbers when she wants to understand judgement.',
      'May defend the fee structure instead of explaining what it pays for.',
      'May tell a slightly different story from last year without noticing.',
    ],
    walkIn: {
      opening:
        'Start with the hardest call you made this year and why. She is buying your judgement, not the deck.',
      ifThen: [
        {
          trigger: 'she says the fee step-up feels like a loyalty tax',
          response: 'Here is exactly what it pays for. For early backers, it waits until we hit the DPI milestone.',
        },
        {
          trigger: 'she notes you said something different last year',
          response: 'You are right, and here is what we learned that changed it.',
        },
      ],
      avoid: 'Leading with a returns table before she has heard how you think.',
    },
  },
  {
    id: 'lp_first_meeting',
    name: 'First meeting',
    kind: 'First meeting',
    counterpart: 'Hiro Tanaka',
    counterpartRole: 'Head of Alternatives, Aster Insurance',
    stakes: 'First meeting with an insurance allocator who can anchor $30M if you clear the screen.',
    risk: 'Medium',
    timeUntil: 'Next week',
    counterpartProfile: {
      name: 'Hiro Tanaka',
      role: 'Head of Alternatives, Aster Insurance',
      style: ['process-driven', 'precise', 'allergic to adjectives'],
      leverage:
        'A single "not a fit" in the first meeting removes the fund from their pipeline for the cycle.',
      concerns: [
        'Capital-charge treatment and reporting cadence.',
        'Portfolio concentration in the top two positions.',
        'Realized versus unrealized returns, stated separately.',
        'Operational due diligence readiness.',
      ],
    },
    userWeakPoints: [
      'May tell the founding story when he wants the fit criteria answered.',
      'May quote blended returns instead of separating realized and unrealized.',
      'May leave without agreeing the next diligence step.',
    ],
    walkIn: {
      opening: 'Ask for his screening criteria first, then answer them in his order.',
      ifThen: [
        {
          trigger: 'he asks about returns',
          response: 'Realized and unrealized, stated separately, each with its source in the data room.',
        },
        {
          trigger: 'he raises concentration',
          response: 'Here is our top-two share of NAV, and the downside case if both are marked down by half.',
        },
      ],
      avoid: 'Leaving without a dated operational due-diligence session.',
    },
  },
];

/** Fully selectable secondary events — real prep workspaces, lighter stakes. */
export const SECONDARY_EVENTS: MettleEvent[] = [
  {
    id: 'board_update',
    name: 'Board update',
    kind: 'Board',
    walkIn: {
      opening: 'Own the forecast process in the first minute, then give the revised number and what changed.',
      ifThen: [
        {
          trigger: 'she asks what the board should have known',
          response: 'You should have seen the pipeline slip in August. Here is how we report it from now on.',
        },
        {
          trigger: 'she floats an independent review',
          response: 'We would welcome it. Here is the scope we would propose.',
        },
      ],
      avoid: 'Blaming external conditions before owning the forecast.',
    },
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
    kind: 'People',
    walkIn: {
      opening: 'Say the decision in the first two sentences. Then stop and let him respond.',
      ifThen: [
        {
          trigger: 'he says the reorg is the real reason',
          response: 'I understand why it feels that way. The decision is final, and I want to be straight about that.',
        },
        {
          trigger: 'he asks about support',
          response: 'People will walk you through the package today. I will not promise what is not approved.',
        },
      ],
      avoid: 'Softening it until it sounds like a performance plan.',
    },
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
];

/** Legacy list kept for the "calendar noise" contrast section. */
export const CONTRAST_EVENTS = SECONDARY_EVENTS.map((event) => ({
  id: event.id,
  name: event.name,
  counterpart: event.counterpart,
  stakes: event.stakes,
}));

export const ALL_EVENTS: MettleEvent[] = [LP_EVENT, ...RAISE_EVENTS, ...SECONDARY_EVENTS];

export function findEvent(id: string): MettleEvent | undefined {
  return ALL_EVENTS.find((event) => event.id === id);
}

/**
 * Register the featured demo event without importing it here — salary-event.ts
 * borrows this module's MettleEvent type, so a value import would cycle.
 */
export function registerEvent(event: MettleEvent): void {
  if (!ALL_EVENTS.some((existing) => existing.id === event.id)) {
    ALL_EVENTS.unshift(event);
  }
}
