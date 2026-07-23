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

  const handleAction = (message: any) => {
    const actionName = message?.userAction?.name;
    if (actionName === 'get_reframe') {
      void startReactiveSession();
    }
  };

  return (
    <A2UIProvider catalog={nudgeCatalog} onAction={handleAction}>
      <NudgeSurface />
    </A2UIProvider>
  );
}
