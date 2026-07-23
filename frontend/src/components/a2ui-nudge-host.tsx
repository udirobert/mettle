'use client';

import { useEffect } from 'react';
import { A2UIProvider, A2UIRenderer, useA2UI } from '@copilotkit/a2ui-renderer';
import { useConversationState } from '@/hooks/use-conversation-state';
import { nudgeCatalog } from '@/components/a2ui-catalog';

function NudgeSurface() {
  const { state } = useConversationState();
  const { processMessages, clearSurfaces } = useA2UI();

  useEffect(() => {
    if (state.a2ui_surface) {
      try {
        const parsed = JSON.parse(state.a2ui_surface);
        processMessages(parsed.a2ui_operations ?? []);
      } catch {
        // Ignore malformed surface payloads.
      }
    } else {
      clearSurfaces();
    }
  }, [state.a2ui_surface, processMessages, clearSurfaces]);

  return <A2UIRenderer surfaceId="nudge-surface" fallback={null} />;
}

export function A2UINudgeHost() {
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
      <NudgeSurface />
    </A2UIProvider>
  );
}
