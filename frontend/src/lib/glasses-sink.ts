import type { GlassesNudge } from '@/fixtures/glasses-nudges';

/**
 * WhisperSink vocabulary, TS side — mirrors scripts/glasses_sinks.py
 * (docs/WORN_M6.md, "Long-term direction"). The card contract never grows
 * per-provider fields; differences live in SinkCapabilities. Python sinks
 * are the working implementations today; this type set keeps the contract
 * legible wherever a future sink gets built (iOS bridge, watch extension,
 * backend fan-out).
 */

export type SinkCapabilities = {
  max_chars: number;
  max_lines: number;
  supports_body: boolean;
  supports_bitmap: boolean;
  /**
   * Load-bearing field: false → the surface is visible to others
   * (lock screen, Notification Center, shared displays) and must get the
   * redacted card — nudge text is negotiation content.
   */
  private_display: boolean;
  inputs: string[];
};

export interface WhisperSink {
  name: string;
  capabilities: SinkCapabilities;
  render(card: GlassesNudge): void | Promise<void>;
  clear?(): void | Promise<void>;
}

/** What a sink is allowed to show (present() in glasses_sinks.py). */
export function presentForSink(capabilities: SinkCapabilities, card: GlassesNudge): GlassesNudge {
  if (capabilities.private_display) return card;
  return { ...card, headline: 'Mettle — nudge', body: undefined };
}
