'use client';

import { useEffect } from 'react';
import { useAgent, UseAgentUpdate } from '@copilotkit/react-core/v2';
import { A2UIProvider, A2UIRenderer, useA2UI } from '@copilotkit/a2ui-renderer';
import { useConversationState } from '@/hooks/use-conversation-state';
import { nudgeCatalog } from '@/components/a2ui-catalog';

function applyVariant(operations: any[], variant?: 'panel' | 'signal') {
  if (!variant) return operations;
  return operations.map((op: any) => {
    if (op?.updateComponents?.components) {
      const components = op.updateComponents.components.map((component: any) =>
        component.id === 'root' && component.component === 'NudgeCard'
          ? { ...component, variant }
          : component,
      );
      return { ...op, updateComponents: { ...op.updateComponents, components } };
    }
    return op;
  });
}

function isA2UISurfaceMessage(
  message: any,
): message is { role: 'activity'; activityType: 'a2ui-surface'; content: Record<string, any> } {
  return (
    message?.role === 'activity' &&
    message?.activityType === 'a2ui-surface' &&
    typeof message?.content === 'object' &&
    message.content !== null &&
    !Array.isArray(message.content)
  );
}

function NudgeSurface({ variant }: { variant?: 'panel' | 'signal' }) {
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnMessagesChanged] });
  const { processMessages, clearSurfaces } = useA2UI();

  useEffect(() => {
    const latest = (agent.messages ?? []).filter(isA2UISurfaceMessage).pop();
    const content = latest?.content as Record<string, any> | undefined;
    const operations = content?.a2ui_operations;
    if (Array.isArray(operations)) {
      processMessages(applyVariant(operations, variant));
    } else {
      clearSurfaces();
    }
  }, [agent.messages, variant, processMessages, clearSurfaces]);

  return <A2UIRenderer surfaceId="nudge-surface" fallback={null} />;
}

type A2UINudgeHostProps = {
  variant?: 'panel' | 'signal';
};

export function A2UINudgeHost({ variant }: A2UINudgeHostProps) {
  const { startReactiveSession } = useConversationState();

  const getReframeQuery = (kind: string, message: string) => {
    const base = message.trim();
    switch (kind) {
      case 'concession':
        return `I may have just conceded on "${base}". What should I say to qualify it?`;
      case 'long_monologue':
        return `I just gave a long answer about "${base}". How do I invite them back in?`;
      case 'repetition':
        return `I repeated myself about "${base}". What calibrated question should I ask instead?`;
      default:
        return `The wingman flagged: "${base}". What should I say next?`;
    }
  };

  const handleAction = (message: any) => {
    const userAction = message?.userAction;
    if (userAction?.name === 'get_reframe') {
      const { kind, message: nudgeMessage } = userAction?.context ?? {};
      void startReactiveSession(getReframeQuery(kind, nudgeMessage));
    }
  };

  return (
    <A2UIProvider catalog={nudgeCatalog} onAction={handleAction}>
      <NudgeSurface variant={variant} />
    </A2UIProvider>
  );
}
