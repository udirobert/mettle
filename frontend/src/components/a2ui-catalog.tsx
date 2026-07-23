'use client';

import { z } from 'zod';
import { createCatalog, type RendererProps } from '@copilotkit/a2ui-renderer';
import { NudgeCard } from '@/components/nudge-card';
import type { Nudge } from '@/hooks/use-conversation-state';

const definitions = {
  NudgeCard: {
    description: 'A proactive Wingman nudge card with an optional reframe action.',
    props: z.object({
      kind: z.enum(['concession', 'long_monologue', 'repetition', 'timing', 'other']),
      message: z.string(),
      hint: z.string().optional(),
      actionLabel: z.string().optional(),
    }),
  },
};

function NudgeCardRenderer({
  props,
  dispatch,
}: RendererProps<z.infer<typeof definitions.NudgeCard.props>>) {
  const { kind, message, hint, actionLabel } = props;

  const nudge: Nudge = {
    id: 'a2ui',
    kind,
    message,
    timestamp: new Date().toISOString(),
    source_turn_index: 0,
  };

  const handleAction = () => {
    if (!dispatch) return;
    dispatch({
      userAction: {
        name: 'get_reframe',
        surfaceId: 'nudge-surface',
        sourceComponentId: 'root',
        context: { kind, message },
      },
    });
  };

  return (
    <NudgeCard
      nudge={nudge}
      actionLabel={actionLabel}
      onAction={actionLabel ? handleAction : undefined}
    />
  );
}

export const nudgeCatalog = createCatalog(
  definitions,
  { NudgeCard: NudgeCardRenderer },
  { catalogId: 'mettle-nudge-catalog', includeBasicCatalog: false },
);

export const nudgeCatalogSchema = JSON.stringify(
  {
    catalogId: 'mettle-nudge-catalog',
    components: {
      NudgeCard: {
        description: definitions.NudgeCard.description,
        props: {
          kind: { type: 'string' },
          message: { type: 'string' },
          hint: { type: 'string' },
          actionLabel: { type: 'string' },
        },
      },
    },
  },
  null,
  2,
);
