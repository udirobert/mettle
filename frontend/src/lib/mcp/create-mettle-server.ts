import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  buildMeetingBrief,
  formatMeetingBriefText,
} from '@/lib/meeting-brief';

const MEETING_BRIEF_DESCRIPTION = [
  'Use when the user pastes an email thread, Slack/Teams dump, or notes and wants help preparing for a meeting.',
  'Triggers include: "help me prepare for this meeting", "what are they going to ask me", "what objections will I get", "brief me before this call".',
  'Returns a structured evidence brief plus likely counterpart objections/questions.',
  'Do NOT use for live mid-meeting coaching, opponent roleplay/rehearsal, post-meeting debriefs, calendar scheduling, sending email, or when no pasted correspondence is available.',
  'Rehearsal and debrief are not part of this free ChatGPT tool set.',
].join(' ');

/**
 * Stateless MCP server for ChatGPT directory / mid-conversation discovery.
 * v1 free set: meeting_brief only.
 */
export function createMettleMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'mettle',
      version: '1.0.0',
    },
    {
      instructions: [
        'Mettle prepares people for high-stakes conversations.',
        'For ChatGPT, call meeting_brief when the user pastes a thread and asks to prepare or wants likely questions/objections.',
        'Do not invent rehearsal or debrief tools — those live in the Mettle product for existing accounts.',
      ].join(' '),
    },
  );

  server.registerTool(
    'meeting_brief',
    {
      title: 'Meeting brief from pasted thread',
      description: MEETING_BRIEF_DESCRIPTION,
      inputSchema: {
        text: z
          .string()
          .min(1)
          .max(20_000)
          .describe(
            'Pasted email thread, Slack/Teams dump, or meeting notes to brief from.',
          ),
        counterpart_name: z
          .string()
          .max(200)
          .optional()
          .describe(
            'Optional name of the person the user is meeting. Inferred from From: headers when omitted.',
          ),
      },
      outputSchema: {
        counterpart_name: z.string(),
        objections: z.array(z.string()),
        prep_highlights: z.array(z.string()),
        claim_count: z.number().int(),
        plans_url: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ text, counterpart_name }) => {
      const result = buildMeetingBrief(text, counterpart_name);
      const structured = {
        counterpart_name: result.counterpart_name,
        objections: result.objections,
        prep_highlights: result.prep_highlights,
        claim_count: result.brief.claims.length,
        plans_url: result.richer_actions.plans_url,
        brief: result.brief,
        richer_actions: result.richer_actions,
      };

      return {
        structuredContent: {
          counterpart_name: structured.counterpart_name,
          objections: structured.objections,
          prep_highlights: structured.prep_highlights,
          claim_count: structured.claim_count,
          plans_url: structured.plans_url,
        },
        content: [
          {
            type: 'text' as const,
            text: formatMeetingBriefText(result),
          },
        ],
      };
    },
  );

  return server;
}
