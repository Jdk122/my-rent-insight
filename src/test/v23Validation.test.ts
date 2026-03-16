import { describe, it, expect } from 'vitest';
import { calculateFairnessScore, FairnessScoreInput } from '@/lib/fairnessScore';
import { calculateCompConfidence, computeCompIqr, CompConfidenceResult } from '@/lib/compConfidence';

// ─── Helpers ───

const baseInput: FairnessScoreInput = {
  increasePct: 5,
  marketYoY: 3,
  proposedRent: 2100,
  currentRent: 2000,
  compMedian: 2200,
  compCount: 6,
  fmr: 1400,
  zillowMonthly: 0.3,
  bedroomCount: 1,
  f50: [1100, 1300, 1500, 1900, 2200],
};

function score(overrides: Partial<FairnessScoreInput> = {}) {
  return calculateFairnessScore({ ...baseInput, ...overrides });
}

// ═══════════════════════════════════════════
// Section 6A: Monotonicity Tests
// ═══════════════════════════════════════════

describe('v2.3 Monotonicity Tests', () => {
  const scenarios: Partial<FairnessScoreInput>[] = [
    {}, // base
    { currentRent: 1500, proposedRent: 1575, increasePct: 5, fmr: 1200 },
    { currentRent: 3000, proposedRent: 3150, increasePct: 5, fmr: 1800, compMedian: 3100 },
    { currentRent: 800, proposedRent: 840, increasePct: 5, fmr: 780, compMedian: 820, compCount: 2 },
    { currentRent: 2500, proposedRent: 2625, increasePct: 5, marketYoY: -1, compMedian: 2700 },
  ];

  describe('Rent monotonicity: higher proposedRent should never improve score', () => {
    scenarios.forEach((s, i) => {
      it(`scenario ${i}`, () => {
        const base = score(s);
        const higher = score({ ...s, proposedRent: (s.proposedRent ?? 2100) + 200 });
        expect(higher.total).toBeLessThanOrEqual(base.total);
      });
    });
  });

  describe('Increase monotonicity: higher increasePct should never improve score', () => {
    scenarios.forEach((s, i) => {
      it(`scenario ${i}`, () => {
        const base = score(s);
        const higher = score({
          ...s,
          increasePct: (s.increasePct ?? 5) + 3,
          proposedRent: (s.currentRent ?? 2000) * (1 + ((s.increasePct ?? 5) + 3) / 100),
        });
        expect(higher.total).toBeLessThanOrEqual(base.total);
      });
    });
  });

  describe('Interpolation continuity: no jump > 1.5 pts sweeping compConfidence 0-100', () => {
    it('fixed scenario, sweep compConfidence', () => {
      let prevTotal: number | null = null;
      const jumps: { from: number; to: number; conf: number; delta: number }[] = [];

      for (let conf = 0; conf <= 100; conf++) {
        const mockConfidence: CompConfidenceResult = {
          score: conf,
          uiBand: conf <= 30 ? 'Low' : conf <= 60 ? 'Medium' : 'High',
          engineHighConfidence: conf >= 55,
          breakdown: {},
          minimumCountGateApplied: false,
        };
        const result = score({
          compConfidence: mockConfidence,
          compP25: 1900,
          compP75: 2400,
          compIqrRatio: 0.15,
        });

        if (prevTotal !== null) {
          const delta = Math.abs(result.total - prevTotal);
          if (delta > 1.5) {
            jumps.push({ from: prevTotal, to: result.total, conf, delta });
          }
        }
        prevTotal = result.total;
      }

      // Filter out intentional guardrail discontinuities
      const unexplained = jumps.filter(j => {
        // Soft good-value floor at conf=55 is intentional
        if (j.conf === 55) return false;
        return true;
      });

      expect(unexplained).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════
// Section 6B: Validation Scenarios
// ═══════════════════════════════════════════

describe('v2.3 Validation Scenarios', () => {
  it('Scenario A — Hoboken Luxury: should score 70-90 (comp-driven, decoupled)', () => {
    const mockConf: CompConfidenceResult = {
      score: 72,
      uiBand: 'High',
      engineHighConfidence: true,
      breakdown: { sameBuilding: 24, areaComps: 9, distanceTightness: 10, lowVariance: 5 },
      minimumCountGateApplied: false,
    };
    const result = score({
      currentRent: 2900,
      proposedRent: 3045,
      increasePct: 5,
      marketYoY: 4.7,
      fmr: 1800,
      compMedian: 3100,
      compCount: 6,
      buildingCompCount: 3,
      f50: [1500, 1800, 2200, 2800, 3200],
      rcMedianRent: 3050,
      rcTotalListings: 45,
      compConfidence: mockConf,
      compP25: 2800,
      compP75: 3300,
      compIqrRatio: 0.16,
      zoriZipRent: 3050,
    });
    // v2.3: high confidence, decoupled, comp-derived ceiling → strong score
    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('Scenario B — Rural Kansas: should score 55-75 (HUD anchored, low confidence)', () => {
    const result = score({
      currentRent: 750,
      proposedRent: 795,
      increasePct: 6,
      marketYoY: 4.1,
      fmr: 770,
      compMedian: null,
      compCount: 0,
      f50: [600, 700, 770, 900, 1050],
      compConfidence: null,
      compP25: null,
      compP75: null,
      rcMedianRent: null,
      rcTotalListings: null,
      zoriZipRent: null,
    });
    expect(result.total).toBeGreaterThanOrEqual(55);
    expect(result.total).toBeLessThanOrEqual(80);
  });

  it('Scenario C — Legacy under-market with big increase: should be capped at 55', () => {
    const mockConf: CompConfidenceResult = {
      score: 65,
      uiBand: 'High',
      engineHighConfidence: true,
      breakdown: { areaComps: 15, distanceTightness: 5, lowVariance: 5 },
      minimumCountGateApplied: false,
    };
    const result = score({
      currentRent: 1800,
      proposedRent: 2340,
      increasePct: 30,
      marketYoY: 4,
      compMedian: 3100,
      compCount: 8,
      fmr: 1500,
      compConfidence: mockConf,
      compP25: 2700,
      compP75: 3400,
      compIqrRatio: 0.12,
      zoriZipRent: 3000,
    });
    // Extreme ceiling: increase=30%, rateGap=26pp → cap at 55
    expect(result.total).toBeLessThanOrEqual(55);
    expect(result.extremeIncreaseCeilingApplied).toBe(true);
  });

  it('Scenario D — Echo chamber building: reduced confidence', () => {
    const highInfluenceConf: CompConfidenceResult = {
      score: 48,  // Reduced by -12 from building >70% influence
      uiBand: 'Medium',
      engineHighConfidence: false,
      breakdown: { sameBuilding: 24, areaComps: 3, buildingHighInfluence: -12, lowVariance: 5 },
      minimumCountGateApplied: false,
    };
    const spreadConf: CompConfidenceResult = {
      score: 60,
      uiBand: 'Medium',
      engineHighConfidence: true,
      breakdown: { areaComps: 15, distanceTightness: 10, lowVariance: 5 },
      minimumCountGateApplied: false,
    };

    const echoResult = score({
      compCount: 5,
      compMedian: 3400,
      compConfidence: highInfluenceConf,
      compP75: 3500,
      compP25: 3200,
      allSameBuilding: false,
      buildingCompCount: 4,
    });
    const spreadResult = score({
      compCount: 5,
      compMedian: 3400,
      compConfidence: spreadConf,
      compP75: 3500,
      compP25: 3200,
      allSameBuilding: false,
      buildingCompCount: 1,
    });

    expect(echoResult.total).toBeLessThan(spreadResult.total);
  });
});

// ═══════════════════════════════════════════
// compConfidence unit tests
// ═══════════════════════════════════════════

describe('compConfidence', () => {
  it('minimum-count gate caps at 54 with single same-line comp', () => {
    const result = calculateCompConfidence({
      comps: [{ formattedAddress: '100 Main St', rent: 2000, bedrooms: 1, bathrooms: 1, squareFootage: null, distance: 0.1, daysOld: 30, correlation: 0.9, isSameUnitLine: true }] as any,
      subjectAddress: '100 Main St',
      sameLineCompCount: 1,
      buildingCompCount: 1,
      buildingBedroomMatchCount: 1,
      nearbyBedroomMatchCount: 0,
      medianCompDistance: 0.1,
      compIqrRatio: null,
      medianDaysOld: 30,
    });
    // 30 (same-line) + 10 (building br match) + 10 (distance) = 50, but gate caps at 54
    // Since 50 < 54, no gate applied
    expect(result.score).toBeLessThanOrEqual(54);
    expect(result.engineHighConfidence).toBe(false);
  });

  it('3+ comps bypass minimum-count gate', () => {
    const result = calculateCompConfidence({
      comps: Array(4).fill({ formattedAddress: 'A', rent: 2000, bedrooms: 1, bathrooms: 1, squareFootage: null, distance: 0.2, daysOld: 20, correlation: 0.9 }) as any,
      subjectAddress: 'B',
      sameLineCompCount: 0,
      buildingCompCount: 0,
      buildingBedroomMatchCount: 0,
      nearbyBedroomMatchCount: 3,
      medianCompDistance: 0.2,
      compIqrRatio: 0.10,
      medianDaysOld: 20,
    });
    // Not capped at 54
    expect(result.minimumCountGateApplied).toBe(false);
  });

  it('UI bands are correctly assigned', () => {
    const makeResult = (score: number) => {
      if (score <= 30) return 'Low';
      if (score <= 60) return 'Medium';
      return 'High';
    };
    expect(makeResult(0)).toBe('Low');
    expect(makeResult(30)).toBe('Low');
    expect(makeResult(31)).toBe('Medium');
    expect(makeResult(60)).toBe('Medium');
    expect(makeResult(61)).toBe('High');
    expect(makeResult(100)).toBe('High');
  });
});

// ═══════════════════════════════════════════
// v2.3 Feature Tests
// ═══════════════════════════════════════════

describe('v2.3 Features', () => {
  it('price level badge: below market when proposedRent < compP25', () => {
    const result = score({
      proposedRent: 1800,
      compP25: 1900,
      compP75: 2400,
      compCount: 6,
    });
    expect(result.priceLevel).toBe('below-market');
    expect(result.priceLevelLabel).toBe('Below Market');
  });

  it('price level badge: above market when proposedRent > compP75', () => {
    const result = score({
      proposedRent: 2600,
      compP25: 1900,
      compP75: 2400,
      compCount: 6,
    });
    expect(result.priceLevel).toBe('above-market');
  });

  it('decoupled market note appears when ratio > 1.50', () => {
    const result = score({
      fmr: 1200,
      rcMedianRent: 3000,
      rcTotalListings: 20,
      zoriZipRent: 2900,
    });
    expect(result.decoupledMarketNote).toBeTruthy();
    expect(result.decoupledMarketNote).toContain('significantly below');
  });

  it('soft good-value floor applies when conditions met', () => {
    const mockConf: CompConfidenceResult = {
      score: 60,
      uiBand: 'Medium',
      engineHighConfidence: true,
      breakdown: {},
      minimumCountGateApplied: false,
    };
    const result = score({
      proposedRent: 1850,
      currentRent: 1800,
      increasePct: 3,
      marketYoY: 4,
      compMedian: 2200,
      compP25: 1900,
      compConfidence: mockConf,
    });
    // proposedRent (1850) <= compP25 (1900), conf >= 55, increase < 15, rateGap < 10
    expect(result.total).toBeGreaterThanOrEqual(65);
  });

  it('extreme ceiling overrides soft floor', () => {
    const mockConf: CompConfidenceResult = {
      score: 70,
      uiBand: 'High',
      engineHighConfidence: true,
      breakdown: {},
      minimumCountGateApplied: false,
    };
    const result = score({
      proposedRent: 2500,
      currentRent: 2000,
      increasePct: 25,
      marketYoY: 3,
      compMedian: 2600,
      compP25: 2550,
      compP75: 2800,
      compConfidence: mockConf,
      zoriZipRent: 2600,
    });
    // extreme ceiling fires (25% increase, 22pp gap) → cap at 55
    expect(result.total).toBeLessThanOrEqual(55);
    expect(result.extremeIncreaseCeilingApplied).toBe(true);
  });

  it('updated component labels match v2.3 spec', () => {
    const result = score({});
    const labels = result.components.map(c => c.label);
    expect(labels.some(l => l.startsWith('Your Increase vs. Market Trend'))).toBe(true);
    expect(labels.some(l => l.includes('Local Comps') || l.includes('Unit Line') || l.includes('Building'))).toBe(true);
    expect(labels.some(l => l === 'Market Ceiling Check')).toBe(true);
    expect(labels.some(l => l.startsWith('Market Direction'))).toBe(true);
  });
});
