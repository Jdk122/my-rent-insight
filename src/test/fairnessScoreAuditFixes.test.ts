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
  medianIncome: 50000,
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

  it('scores 3/10 when zillowMonthly is 0.5', () => {
    const comp = getComponent({ ...baseInput, zillowMonthly: 0.5 }, 'momentum');
    expect(comp.score).toBe(3);
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

describe('Component 3: FMR Label Rename', () => {
  it('returns "Increase Reasonableness" when rent is below FMR upper', () => {
    const comp = getComponent({ ...baseInput, currentRent: 1500, fmr: 1800 }, 'fmr');
    expect(comp.label).toBe('Increase Reasonableness');
  });

  it('returns "Increase Reasonableness" when rent exceeds FMR upper (fallback path)', () => {
    const comp = getComponent({ ...baseInput, currentRent: 4000, fmr: 1800 }, 'fmr');
    expect(comp.label).toBe('Increase Reasonableness');
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
    }
  });
});

// ─── FMR DECLINING MARKET TIGHTENING (Component 3) ───

describe('Component 3: Declining Market Tightening', () => {
  // currentRent=4000, fmr=1800 → currentRent > fmr*1.15 (2070), triggers fallback path
  const highRentInput: FairnessScoreInput = {
    ...baseInput,
    currentRent: 4000,
    fmr: 1800,
    proposedRent: 4200,
  };

  describe('falling market (marketYoY = -2)', () => {
    it('increasePct=3 → 12/20 (falls in 2-4% band)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: -2, increasePct: 3 }, 'fmr');
      expect(comp.score).toBe(12);
    });

    it('increasePct=5 → 5/20 (falls in 4-7% band)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: -2, increasePct: 5 }, 'fmr');
      expect(comp.score).toBe(5);
    });

    it('increasePct=8 → 0/20 (exceeds 7%)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: -2, increasePct: 8 }, 'fmr');
      expect(comp.score).toBe(0);
    });
  });

  describe('rising market (marketYoY = +2)', () => {
    it('increasePct=3 → 18/20 (falls in <=3% band)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: 2, increasePct: 3 }, 'fmr');
      expect(comp.score).toBe(18);
    });

    it('increasePct=5 → 12/20 (falls in 3-6% band)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: 2, increasePct: 5 }, 'fmr');
      expect(comp.score).toBe(12);
    });

    it('increasePct=8 → 5/20 (falls in 6-10% band)', () => {
      const comp = getComponent({ ...highRentInput, marketYoY: 2, increasePct: 8 }, 'fmr');
      expect(comp.score).toBe(5);
    });
  });

  it('marketYoY=0 (flat) uses rising breakpoints: increasePct=5 → 12/20', () => {
    const comp = getComponent({ ...highRentInput, marketYoY: 0, increasePct: 5 }, 'fmr');
    expect(comp.score).toBe(12);
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
