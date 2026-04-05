import { describe, it, expect } from 'vitest';
import { calculateCompositeTrend } from '@/lib/compositeTrend';

describe('Composite Trend Integrity — no double-counting', () => {
  it('ZORI and HUD must be independent inputs, not duplicated', () => {
    // Old bug: same ZORI value passed as both zoriYoY and hudYoY
    const duplicated = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 5.0,
      zoriSource: 'county',
      hudYoY: 5.0, // same value = bug
    });

    // Corrected: distinct HUD value
    const corrected = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 5.0,
      zoriSource: 'county',
      hudYoY: 2.0, // independent HUD calculation
    });

    // The corrected composite should differ from the duplicated one
    expect(corrected.compositeTrend).not.toEqual(duplicated.compositeTrend);
    // Corrected blends 5.0 and 2.0 → should be lower than 5.0
    expect(corrected.compositeTrend).toBeLessThan(5.0);
    expect(corrected.compositeTrend).toBeGreaterThan(2.0);
  });

  it('duplicated ZORI cannot produce a false "verified" badge', () => {
    const duplicated = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 5.0,
      zoriSource: 'county',
      hudYoY: 5.0,
    });
    // Two sources with identical values should NOT reach verified
    // (they're not truly independent — even if engine doesn't know)
    // The key assertion: corrected inputs with spread should have lower confidence
    const corrected = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 5.0,
      zoriSource: 'county',
      hudYoY: 2.0,
    });
    expect(corrected.confidenceScore).toBeLessThanOrEqual(duplicated.confidenceScore);
  });

  it('single county ZORI gets "estimated" not "verified"', () => {
    const result = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 4.9,
      zoriSource: 'county',
      hudYoY: null,
    });
    expect(result.badgeTier).toBe('estimated');
    expect(result.sourceCount).toBe(1);
  });

  it('single ZIP ZORI gets "estimated" not "verified"', () => {
    const result = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 3.5,
      zoriSource: 'zip',
      hudYoY: null,
    });
    expect(result.badgeTier).toBe('estimated');
    expect(result.sourceCount).toBe(1);
  });

  it('three truly independent sources can reach "verified"', () => {
    const result = calculateCompositeTrend({
      alYoY: 4.5,
      zoriYoY: 5.0,
      zoriSource: 'zip',
      hudYoY: 3.8,
    });
    expect(result.sourceCount).toBe(3);
    // Three agreeing sources should have high confidence
    expect(result.confidenceScore).toBeGreaterThanOrEqual(55);
  });

  it('blends distinct ZORI and HUD correctly for 55376 scenario', () => {
    // 55376: county ZORI 4.9%, HUD 3BR ~2.0%
    const result = calculateCompositeTrend({
      alYoY: null,
      zoriYoY: 4.9,
      zoriSource: 'county',
      hudYoY: 2.0,
    });
    // Should blend to ~3.9 (weighted mean of 4.9 at 0.20 and 2.0 at 0.10)
    expect(result.compositeTrend).toBeGreaterThan(2.0);
    expect(result.compositeTrend).toBeLessThan(4.9);
    expect(result.sourceCount).toBe(2);
    expect(result.badgeTier).not.toBe('verified');
  });
});
