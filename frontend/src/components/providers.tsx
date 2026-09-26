'use client';

import { CopilotKit } from '@copilotkit/react-core/v2';
import { ThemeProvider } from '@/hooks/use-theme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        inspectorDefaultAnchor={{ horizontal: 'right', vertical: 'top' }}
        openGenerativeUI={{}}
        useSingleEndpoint={false}
      >
        {children}
      </CopilotKit>
    </ThemeProvider>
  );
}
