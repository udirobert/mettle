import { describe, expect, it } from 'vitest';

import { SAMPLE_ELENA_THREAD } from '@/lib/extract-evidence';
import { buildMeetingBrief, formatMeetingBriefText } from '@/lib/meeting-brief';

describe('buildMeetingBrief', () => {
  it('extracts objections and highlights from the Elena sample thread', () => {
    const result = buildMeetingBrief(SAMPLE_ELENA_THREAD, 'Elena Park');
    expect(result.counterpart_name).toBe('Elena Park');
    expect(result.brief.claims.length).toBeGreaterThan(0);
    expect(result.objections.length).toBeGreaterThan(0);
    expect(result.prep_highlights.length).toBeGreaterThan(0);
    expect(result.richer_actions.status).toBe('account_or_product');
    expect(result.richer_actions.plans_url).toContain('/plans');
  });

  it('infers counterpart from From: headers when name omitted', () => {
    const result = buildMeetingBrief(SAMPLE_ELENA_THREAD);
    expect(result.counterpart_name).toBe('Elena Park');
  });

  it('returns empty brief for blank paste', () => {
    const result = buildMeetingBrief('   ');
    expect(result.brief.claims).toEqual([]);
    expect(result.objections).toEqual([]);
  });

  it('formats a readable text summary', () => {
    const text = formatMeetingBriefText(buildMeetingBrief(SAMPLE_ELENA_THREAD));
    expect(text).toContain('Likely objections');
    expect(text).toContain('Plans (informational)');
  });
});
