'use client';

import { useEffect, useRef, useState } from 'react';

type ModelContext = {
  registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => Promise<void>;
  getTools: () => Promise<unknown[]>;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

type ToolCallLog = {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
  time: string;
  durationMs: number;
};

const PROXY = '/api/webmcp';

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PROXY}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function getEvent(scenarioId = 'lp_renewal'): Promise<unknown> {
  const res = await fetch(`${PROXY}/event?scenario_id=${encodeURIComponent(scenarioId)}`);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

const BASE_TOOLS: ToolDefinition[] = [
  {
    name: 'mettle_get_event',
    description:
      'Load the current high-stakes conversation event. Returns stakes, the counterpart profile (name, role, concerns, leverage), and the user\'s known weak points.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: {
          type: 'string',
          description: 'Scenario identifier, e.g. "lp_renewal"',
          default: 'lp_renewal',
        },
      },
    },
    execute: async ({ scenario_id }: Record<string, unknown>) =>
      getEvent(typeof scenario_id === 'string' ? scenario_id : 'lp_renewal'),
  },
  {
    name: 'mettle_extract_context',
    description:
      'Extract claims, commitments, open objections, and numbers from pasted email or thread text. Returns a draft evidence brief with pending claims for the user to approve or reject.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Pasted email, thread, or research text to extract evidence from.',
        },
        counterpart_name: {
          type: 'string',
          description: 'Name of the counterpart the user is meeting with.',
          default: 'Elena Park',
        },
      },
      required: ['text'],
    },
    execute: async ({ text, counterpart_name }: Record<string, unknown>) =>
      post('extract', {
        text: typeof text === 'string' ? text : '',
        counterpart_name: typeof counterpart_name === 'string' ? counterpart_name : 'Elena Park',
      }),
  },
  {
    name: 'mettle_run_coach',
    description:
      'Run the multi-perspective Coach council (Skeptic, Counterpart as Elena, and Voss-style Negotiator) and return a synthesis with blind spots, concrete moves, likely objections, opening strategy, disagreements, and consensus.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string', default: 'lp_renewal' },
        user_weak_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of self-identified weak points to seed the debate.',
        },
        context_brief: {
          type: 'object',
          description:
            'Optional approved evidence brief from mettle_extract_context, with approved claims.',
        },
      },
    },
    execute: async (input: Record<string, unknown>) => post('coach', input),
  },
  {
    name: 'mettle_rehearse_opponent',
    description:
      'Generate an in-character skeptical response from the counterpart for the most recent user turn in the rehearsal transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string', default: 'lp_renewal' },
        transcript: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              speaker: { type: 'string', enum: ['user', 'counterpart', 'system'] },
              text: { type: 'string' },
            },
            required: ['speaker', 'text'],
          },
          description: 'Rehearsal transcript. The last user turn is what the opponent responds to.',
        },
      },
    },
    execute: async (input: Record<string, unknown>) => post('opponent', input),
  },
  {
    name: 'mettle_ask_wingman',
    description:
      'Get a short, tactical reply to a quick question during a live high-stakes conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string', default: 'lp_renewal' },
        open_reactive_query: {
          type: 'string',
          description: 'The question the user needs answered right now, in the moment.',
        },
        transcript: {
          type: 'array',
          items: { type: 'object' },
          description: 'Optional recent transcript turns for context.',
        },
        coach_analysis: {
          type: 'object',
          description: 'Optional Coach analysis to ground the reply.',
        },
      },
      required: ['open_reactive_query'],
    },
    execute: async (input: Record<string, unknown>) => post('wingman', input),
  },
  {
    name: 'mettle_run_debrief',
    description:
      'Summarize commitments, unresolved objections, and next actions from a completed conversation transcript and any nudges sent.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string', default: 'lp_renewal' },
        transcript: {
          type: 'array',
          items: { type: 'object' },
          description: 'Full conversation transcript.',
        },
        nudges_sent: {
          type: 'array',
          items: { type: 'object' },
          description: 'Proactive nudges surfaced during the conversation.',
        },
        coach_analysis: {
          type: 'object',
          description: 'Coach analysis used to calibrate the debrief.',
        },
      },
    },
    execute: async (input: Record<string, unknown>) => post('debrief', input),
  },
];

export function useWebMCP() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [registered, setRegistered] = useState(false);
  const [calls, setCalls] = useState<ToolCallLog[]>([]);
  const log = useRef<ToolCallLog[]>([]);

  useEffect(() => {
    const docMc =
      typeof document !== 'undefined'
        ? (document as unknown as { modelContext?: ModelContext }).modelContext
        : undefined;
    const navMc =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as { modelContext?: ModelContext }).modelContext
        : undefined;
    const mc = docMc || navMc;

    setSupported(!!mc);

    if (!mc) return;

    const controllers = new Map<string, AbortController>();

    Promise.all(
      BASE_TOOLS.map(async (tool) => {
        const controller = new AbortController();
        controllers.set(tool.name, controller);

        const wrapped = {
          ...tool,
          execute: async (input: Record<string, unknown>, _agent?: unknown) => {
            const start = Date.now();
            const output = await tool.execute(input);
            const durationMs = Date.now() - start;
            const entry: ToolCallLog = {
              name: tool.name,
              input,
              output,
              time: new Date().toISOString(),
              durationMs,
            };
            log.current = [...log.current, entry];
            setCalls(log.current);
            return JSON.stringify(output);
          },
        };

        await mc.registerTool(wrapped, { signal: controller.signal });
      }),
    ).then(() => setRegistered(true));

    return () => {
      controllers.forEach((c) => c.abort());
    };
  }, []);

  async function runDemo() {
    const demoThread = `From: Elena Park
Date: 15 Oct 2024
Subject: Re: Q3 Performance Review

Before we discuss a new commitment, I need a clearer picture of the liquidity timeline. DPI has lagged what we were led to expect at the last renewal. The fee step-up is hard to defend while cash-back is slow.

From: You
Date: 16 Oct 2024
Subject: Portfolio Construction Memo — Follow-up

Understood. I will send the portfolio-construction memo before we meet. The $40M renewal is the ask. Two concentrated positions still dominate unrealized value; the memo will address how we de-risk that.`;

    const event = await getEvent();
    const extracted = await post('extract', { text: demoThread, counterpart_name: 'Elena Park' });
    const coach = (await post('coach', { scenario_id: 'lp_renewal' })) as { coach_analysis?: unknown };
    const opponent = await post('opponent', {
      scenario_id: 'lp_renewal',
      transcript: [{ speaker: 'user', text: 'I want to discuss the $40M renewal. We have made operational changes that will improve liquidity.' }],
    });
    const wingman = await post('wingman', {
      scenario_id: 'lp_renewal',
      open_reactive_query: 'Elena just pushed back on our liquidity timeline. What should I say?',
      coach_analysis: coach.coach_analysis,
    });
    const debrief = await post('debrief', {
      scenario_id: 'lp_renewal',
      transcript: [
        { speaker: 'user', text: 'I want to renew at $40M.' },
        { speaker: 'counterpart', text: 'Why should I believe the liquidity timeline this time?' },
        { speaker: 'user', text: 'We have committed to a distribution by Q2 2026.' },
        { speaker: 'counterpart', text: "That helps. Send me the memo by Friday." },
      ],
      nudges_sent: [{ kind: 'concession', message: 'Specific liquidity milestone' }],
      coach_analysis: coach.coach_analysis,
    });

    const output = {
      mettle_get_event: event,
      mettle_extract_context: extracted,
      mettle_run_coach: coach,
      mettle_rehearse_opponent: opponent,
      mettle_ask_wingman: wingman,
      mettle_run_debrief: debrief,
    };

    const entry: ToolCallLog = {
      name: 'demo_agent_run',
      input: { sample_thread: demoThread },
      output,
      time: new Date().toISOString(),
      durationMs: 0,
    };
    log.current = [...log.current, entry];
    setCalls(log.current);
    return output;
  }

  return { supported, registered, calls, tools: BASE_TOOLS, runDemo };
}
