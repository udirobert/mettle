'use client';

import { useEffect, useRef, useState } from 'react';

type ModelContext = {
  registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => Promise<void>;
  getTools: () => Promise<unknown[]>;
  addEventListener?: (
    type: 'toolchange',
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void;
  removeEventListener?: (
    type: 'toolchange',
    listener: () => void,
    options?: EventListenerOptions,
  ) => void;
};

type ToolAnnotations = {
  readOnlyHint?: boolean;
  /** Spec §6.4.3: output embeds content the author does not control —
   * clients should sanitize/spotlight it before trusting the model with it. */
  untrustedContentHint?: boolean;
  title?: string;
  openWorld?: boolean;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  /** Spec §4.2.2: receives ToolExecuteCallbackOptions — carries an AbortSignal
   * the agent uses to cancel long-running executions. */
  execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

type ToolCallLog = {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
  time: string;
  durationMs: number;
};

const PROXY = '/api/webmcp';

// Spec §6.4.1 mitigation: cap third-party text an agent can push through us.
const MAX_TEXT_LENGTH = 20_000;

async function post<T = unknown>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${PROXY}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function getEvent(
  scenarioId = 'lp_renewal',
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await fetch(`${PROXY}/event?scenario_id=${encodeURIComponent(scenarioId)}`, {
    signal,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

/** Guardrail applied on the client so oversized/untrusted input never leaves the page. */
function clampText(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

const BASE_TOOLS: ToolDefinition[] = [
  {
    name: 'mettle_get_event',
    description:
      'Call at the start of a conversation-prep workflow. Returns the stakes, the counterpart profile (name, role, concerns, leverage), and the user\'s known weak points for the chosen scenario.',
    inputSchema: {
      type: 'object',
      title: 'Get conversation event',
      properties: {
        scenario_id: {
          type: 'string',
          title: 'Scenario identifier',
          description: 'Which scenario to load, e.g. "lp_renewal".',
          default: 'lp_renewal',
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async ({ scenario_id }, options) =>
      getEvent(
        typeof scenario_id === 'string' ? scenario_id : 'lp_renewal',
        options?.signal,
      ),
  },
  {
    name: 'mettle_extract_context',
    description:
      'Call when the user has pasted an email or thread. Extracts claims, commitments, open objections, and numbers into a draft evidence brief. The brief stays pending until the user approves each claim.',
    inputSchema: {
      type: 'object',
      title: 'Extract evidence from pasted context',
      properties: {
        text: {
          type: 'string',
          title: 'Pasted text',
          description: 'Pasted email, thread, or research text to extract evidence from.',
          maxLength: 20000,
        },
        counterpart_name: {
          type: 'string',
          title: 'Counterpart name',
          description: 'Name of the counterpart the user is meeting with.',
          default: 'Elena Park',
        },
      },
      required: ['text'],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ text, counterpart_name }, options) =>
      post(
        'extract',
        {
          text: clampText(text),
          counterpart_name: typeof counterpart_name === 'string' ? counterpart_name : 'Elena Park',
        },
        options?.signal,
      ),
  },
  {
    name: 'mettle_run_coach',
    description:
      'Call after the scenario and evidence are known. Runs a multi-perspective Coach council — Skeptic, Counterpart as Elena, and Voss-style Negotiator — and returns a synthesis with blind spots, concrete moves, likely objections, opening strategy, disagreements, and consensus.',
    inputSchema: {
      type: 'object',
      title: 'Run Coach prep council',
      properties: {
        scenario_id: {
          type: 'string',
          title: 'Scenario identifier',
          description: 'Which scenario to prepare for.',
          default: 'lp_renewal',
        },
        user_weak_points: {
          type: 'array',
          title: 'User weak points',
          items: { type: 'string' },
          description: 'Optional list of self-identified weak points to seed the debate.',
        },
        context_brief: {
          type: 'object',
          title: 'Approved evidence brief',
          description:
            'Optional approved evidence brief from mettle_extract_context, with approved claims.',
        },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input, options) => post('coach', input, options?.signal),
  },
  {
    name: 'mettle_rehearse_opponent',
    description:
      'Call during rehearsal when the user has just said something and needs the counterpart\'s skeptical, in-character reply. The opponent presses on the concern the user least addressed.',
    inputSchema: {
      type: 'object',
      title: 'Rehearse with the counterpart',
      properties: {
        scenario_id: {
          type: 'string',
          title: 'Scenario identifier',
          description: 'Which scenario to rehearse.',
          default: 'lp_renewal',
        },
        transcript: {
          type: 'array',
          title: 'Rehearsal transcript',
          items: {
            type: 'object',
            title: 'Turn',
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
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input, options) => post('opponent', input, options?.signal),
  },
  {
    name: 'mettle_ask_wingman',
    description:
      'Call during a live conversation when the user needs a short, tactical reply to a specific question right now, grounded in the coach prep and recent transcript.',
    inputSchema: {
      type: 'object',
      title: 'Ask Wingman for a live reply',
      properties: {
        scenario_id: {
          type: 'string',
          title: 'Scenario identifier',
          description: 'Which scenario the live conversation belongs to.',
          default: 'lp_renewal',
        },
        open_reactive_query: {
          type: 'string',
          title: 'Question',
          description: 'The specific question the user needs answered in the moment.',
        },
        transcript: {
          type: 'array',
          title: 'Recent transcript',
          items: { type: 'object' },
          description: 'Optional recent transcript turns for context.',
        },
        coach_analysis: {
          type: 'object',
          title: 'Coach analysis',
          description: 'Optional Coach analysis to ground the reply.',
        },
      },
      required: ['open_reactive_query'],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input, options) => post('wingman', input, options?.signal),
  },
  {
    name: 'mettle_run_debrief',
    description:
      'Call after a conversation ends. Summarizes commitments, unresolved objections, and concrete next actions from the transcript and any proactive nudges sent during the meeting.',
    inputSchema: {
      type: 'object',
      title: 'Run conversation debrief',
      properties: {
        scenario_id: {
          type: 'string',
          title: 'Scenario identifier',
          description: 'Which scenario the conversation belongs to.',
          default: 'lp_renewal',
        },
        transcript: {
          type: 'array',
          title: 'Full transcript',
          items: { type: 'object' },
          description: 'Full conversation transcript.',
        },
        nudges_sent: {
          type: 'array',
          title: 'Proactive nudges',
          items: { type: 'object' },
          description: 'Proactive nudges surfaced during the conversation.',
        },
        coach_analysis: {
          type: 'object',
          title: 'Coach analysis',
          description: 'Coach analysis used to calibrate the debrief.',
        },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input, options) => post('debrief', input, options?.signal),
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

    // Spec §4.4: toolchange fires when the context's tool set changes.
    // Keep our registration status honest if tools get unregistered externally.
    const onToolChange = () => {
      void mc.getTools().then((tools) => {
        setRegistered(tools.some((t) => (t as { name?: string }).name?.startsWith('mettle_')));
      });
    };
    mc.addEventListener?.('toolchange', onToolChange);

    const controllers = new Map<string, AbortController>();

    Promise.all(
      BASE_TOOLS.map(async (tool) => {
        const controller = new AbortController();
        controllers.set(tool.name, controller);

        const wrapped = {
          ...tool,
          execute: async (
            input: Record<string, unknown>,
            execOptions?: { signal?: AbortSignal },
          ) => {
            const start = Date.now();
            // ToolExecuteCallbackOptions.signal (spec §4.2.2) flows through so
            // agents can cancel long-running coach/debrief calls.
            const output = await tool.execute(input, execOptions);
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
            // Spec examples return structured values, not pre-stringified JSON.
            return output;
          },
        };

        await mc.registerTool(wrapped, { signal: controller.signal });
      }),
    ).then(() => setRegistered(true));

    return () => {
      mc.removeEventListener?.('toolchange', onToolChange);
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
