import { describe, expect, it } from 'vitest';

import { SAMPLE_DANA_THREAD, SAMPLE_ELENA_THREAD } from '@/lib/extract-evidence';
import { buildMeetingBrief, formatMeetingBriefText } from '@/lib/meeting-brief';

describe('buildMeetingBrief', () => {
  it('extracts objections and highlights from the Elena sample thread', () => {
    const result = buildMeetingBrief(SAMPLE_ELENA_THREAD, 'Elena Park');
    expect(result.counterpart_name).toBe('Elena Park');
    expect(result.brief.claims.length).toBeGreaterThan(0);
    expect(result.walk_in_move.length).toBeGreaterThan(10);
    expect(result.objections.length).toBeGreaterThan(0);
    expect(result.prep_highlights.length).toBeGreaterThan(0);
    expect(result.richer_actions.status).toBe('account_or_product');
    expect(result.richer_actions.plans_url).toContain('/plans');
    expect(result.richer_actions.plans_url).toContain('utm_source=chatgpt_mcp');
    expect(result.richer_actions.rehearse_url).toContain('utm_source=chatgpt_mcp');
    expect(result.richer_actions.rehearse_url).toContain('entry=rehearsal');
    expect(result.richer_actions.rehearse_url).toContain('Elena+Park');
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
    expect(text).toContain('Walk-in move:');
    expect(text).toContain('Likely objections');
    expect(text).toContain('Rehearse on Mettle:');
    expect(text).toContain('Plans (informational)');
  });

  it('extracts $185k salary numbers, March metrics commitment, and objections from Dana thread', () => {
    const result = buildMeetingBrief(SAMPLE_DANA_THREAD);
    expect(result.counterpart_name).toBe('Dana Whitfield');
    expect(result.prep_highlights.some((h) => h.includes('$185k'))).toBe(true);
    expect(result.objections.length).toBeGreaterThan(0);
  });
});
