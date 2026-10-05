'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ScoutStatusResponse } from '@/lib/scout-status';

/**
 * Reads GET /api/scout/status once on mount (and on demand). `status` is null
 * until the first answer; a failed fetch is reported as `{ degraded: true }`
 * so callers can treat "unknown" and "offline" the same way.
 */
export function useScoutStatus() {
  const [status, setStatus] = useState<ScoutStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/scout/status', { cache: 'no-store', signal });
      setStatus((await response.json()) as ScoutStatusResponse);
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      setStatus({ degraded: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return { status, loading, refresh };
}
