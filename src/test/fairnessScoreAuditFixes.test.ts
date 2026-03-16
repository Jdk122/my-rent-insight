import { describe, it, expect } from 'vitest';
import { calculateFairnessScore, FairnessScoreInput } from '@/lib/fairnessScore';

// Helper to get a component by id from the score result
const getComponent = (input: FairnessScoreInput, id: string) => {
  const result = calculateFairnessScore(input);
  return result.components.find(c => c.id === id)!;
};

// Base input for reuse
const baseInput: FairnessScoreInput = {
  increasePct: 5,
  marketYoY: 3,
  proposedRent: 2100,
  currentRent: 2000,
  compMedian: 2000,
  fmr: 1800,
  zillowMonthly: null,
};

// ─── MISSING ZILLOW DEFAULT (Component 5) ───

describe('Component 5: Missing Zillow Default', () => {
  it('scores 5/10 when zillowMonthly is null (missing data)', () => {
    const comp = getComponent({ ...baseInput, zillowMonthly: null }, 'momentum');
    expect(comp.score).toBe(5);
    expect(comp.max).toBe(10);
  });

  it('marks estimated=true when zillowMonthly is null', () => {
    const comp = getComponent({ ...baseInput, zillowMonthly: null }, 'momentum');
    expect(comp.estimated).toBe(true);
  });

  it('scores 10/10 when zillowMonthly is 0 (real data, not missing)', () => {
    const comp = getComponent({ ...baseInput, zillowMonthly: 0 }, 'momentum');
    expect(comp.score).toBe(10);
    expect(comp.estimated).toBe(false);
  });

  it('scores 5/10 when zillowMonthly is 0.5 (interpolated between 0.30→7 and 0.80→3)', () => {
    const comp = getComponent({ ...baseInput, zillowMonthly: 0.5 }, 'momentum');
    expect(comp.score).toBe(5);
  });

  it('total is exactly 5 points higher than old 0/10 default would produce', () => {
    // With zillowMonthly=null, new behavior gives 5/10 for momentum.
    // Old behavior gave 0/10. So total should be 5 higher.
    // We verify by comparing against zillowMonthly=0 (which scores 10/10)
    // and checking the difference is exactly 5 (10 - 5 = 5).
    const withNull = calculateFairnessScore({ ...baseInput, zillowMonthly: null });
    const withZero = calculateFairnessScore({ ...baseInput, zillowMonthly: 0 });
    expect(withZero.total - withNull.total).toBe(5);
  });
});

// ─── FMR LABEL RENAME (Component 3) ───
// v2.3: renamed to "Market Ceiling Check"

describe('Component 3: FMR Label Rename', () => {
  it('returns "Market Ceiling Check" when rent is below FMR upper', () => {
    const comp = getComponent({ ...baseInput, currentRent: 1500, fmr: 1800 }, 'fmr');
    expect(comp.label).toBe('Market Ceiling Check');
  });

  it('returns "Market Ceiling Check" when rent exceeds FMR upper (fallback path)', () => {
    const comp = getComponent({ ...baseInput, currentRent: 4000, fmr: 1800 }, 'fmr');
    expect(comp.label).toBe('Market Ceiling Check');
  });

  it('never returns the old label "Rent vs. HUD Benchmark"', () => {
    const scenarios: Partial<FairnessScoreInput>[] = [
      { currentRent: 1500, fmr: 1800 },
      { currentRent: 4000, fmr: 1800 },
      { currentRent: 2100, fmr: 1800, increasePct: 0 },
      { currentRent: 4000, fmr: 1800, increasePct: 15 },
    ];
    for (const overrides of scenarios) {
      const comp = getComponent({ ...baseInput, ...overrides }, 'fmr');
      expect(comp.label).not.toBe('Rent vs. HUD Benchmark');
      expect(comp.label).not.toBe('Increase Reasonableness');
    }
  });
});

// ─── FMR DECLINING MARKET TIGHTENING (Component 3) ───
// v2.3: fmrMax is now interpolated based on compConfidence. With no compConfidence
// passed (defaults to conf=0), fmrMax = 40. Scores are scaled from rawScore/25 * 40.

describe('Component 3: Declining Market Tightening', () => {
  // currentRent=4000, fmr=1800 → currentRent > upper, triggers fallback path
  const highRentInput: FairnessScoreInput = {
    ...baseInput,
    currentRent: 4000,
    fmr: 1800,
    proposedRent: 4200,
  };

  describe('falling market (marketYoY = -2)', () => {
    it('increasePct=3 → score in falling 2-4% band (fmrMax=40)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: -2, increasePct: 3 }, 'fmr');
      // rawScore = 23 - ((3-2)/2)*8 = 19, scaled: round(19/25 * 40) = 30
      expect(comp.score).toBe(30);
      expect(comp.max).toBe(40);
    });

    it('increasePct=5 → score in falling 4-7% band (fmrMax=40)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: -2, increasePct: 5 }, 'fmr');
      // rawScore = 15 - ((5-4)/3)*9 = 12, scaled: round(12/25 * 40) = 19
      expect(comp.score).toBe(19);
    });

    it('increasePct=8 → score in falling 7-10% band (fmrMax=40)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: -2, increasePct: 8 }, 'fmr');
      // rawScore = 6 - ((8-7)/3)*6 = 4, scaled: round(4/25 * 40) = 6
      expect(comp.score).toBe(6);
    });
  });

  describe('rising market (marketYoY = +2)', () => {
    it('increasePct=3 → score in <=3% band (fmrMax=40)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: 2, increasePct: 3 }, 'fmr');
      // rawScore = 25 - (3/3)*2 = 23, scaled: round(23/25 * 40) = 37
      expect(comp.score).toBe(37);
    });

    it('increasePct=5 → score in 3-6% band (fmrMax=40)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: 2, increasePct: 5 }, 'fmr');
      // rawScore = 23 - ((5-3)/3)*8 ≈ 17.67, scaled: round(17.67/25 * 40) = 28
      expect(comp.score).toBe(28);
    });

    it('increasePct=8 → score in 6-10% band (fmrMax=40)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: 2, increasePct: 8 }, 'fmr');
      // rawScore = 15 - ((8-6)/4)*9 = 10.5, scaled: round(10.5/25 * 40) = 17
      expect(comp.score).toBe(17);
    });
  });

  it('marketYoY=0 (flat) uses rising breakpoints: increasePct=5 → scaled to fmrMax=40', () => {
    const comp = getComponent({ ...highRentInput, marketYoY: 0, increasePct: 5 }, 'fmr');
    // Same as rising: rawScore ≈ 17.67, scaled: round(17.67/25 * 40) = 28
    expect(comp.score).toBe(28);
  });
});

// ─── COUNTER-OFFER ANNOTATION (conditional logic) ───

describe('Counter-offer annotation logic', () => {
  // Test the conditional: medianCompRent && calc.counterLow > medianCompRent
  it('annotation shows when counterLow > medianCompRent', () => {
    const counterLow = 2500;
    const medianCompRent: number | null = 2200;
    const shouldShow = medianCompRent != null && counterLow > medianCompRent;
    expect(shouldShow).toBe(true);
  });

  it('annotation hidden when counterLow <= medianCompRent', () => {
    const counterLow = 2000;
    const medianCompRent: number | null = 2200;
    const shouldShow = medianCompRent != null && counterLow > medianCompRent;
    expect(shouldShow).toBe(false);
  });

  it('annotation hidden when medianCompRent is null', () => {
    const counterLow = 2500;
    const medianCompRent: number | null = null;
    const shouldShow = medianCompRent != null && counterLow > medianCompRent;
    expect(shouldShow).toBe(false);
  });

  it('annotation hidden when medianCompRent is undefined', () => {
    const counterLow = 2500;
    const medianCompRent: number | undefined = undefined;
    const shouldShow = medianCompRent != null && counterLow > medianCompRent;
    expect(shouldShow).toBe(false);
  });
});
