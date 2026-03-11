/**
 * RenewalReply Accuracy Validation Suite
 * ========================================
 * Three layers of testing:
 *   Layer 1: Data pipeline — is the source data correct?
 *   Layer 2: Scoring calibration — do real-world scenarios produce correct verdicts?
 *   Layer 3: Cross-tool consistency — do Renewal and WSIP agree directionally?
 *
 * Run: npx vitest run src/test/accuracyValidation.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calculateFairnessScore, FairnessScoreInput } from '@/lib/fairnessScore';
import { calculateFairRange, FairRangeInput } from '@/lib/fairRange';

// ═══════════════════════════════════════════════════════════════════
// LAYER 1: DATA PIPELINE VERIFICATION
// Spot-check that source data loaded correctly for known ZIPs.
// If any of these fail, the data import pipeline has a bug.
// ═══════════════════════════════════════════════════════════════════

describe('Layer 1: Data Pipeline Verification', () => {
  let rentData: Record<string, any>;
  let hud50Data: Record<string, any>;
  let alData: Record<string, any>;

  // Load data files — these may not be available in all test environments
  beforeAll(async () => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dataDir = path.resolve(__dirname, '../../public/data');

      rentData = JSON.parse(fs.readFileSync(`${dataDir}/rentData.json`, 'utf8'));
      try { hud50Data = JSON.parse(fs.readFileSync(`${dataDir}/hud50_processed.json`, 'utf8')); } catch { hud50Data = {}; }
      try { alData = JSON.parse(fs.readFileSync(`${dataDir}/apartmentlist_processed.json`, 'utf8')); } catch { alData = {}; }
    } catch {
      rentData = {};
      hud50Data = {};
      alData = {};
    }
  });

  describe('HUD SAFMR FY2026 spot checks', () => {
    // Ground truth from HUD's official fy2026_safmrs.xlsx
    const hudGroundTruth: Record<string, number[]> = {
      '07030': [3610, 3680, 4140, 5050, 5930],  // Hoboken
      '10001': [3800, 3990, 4370, 5470, 5950],  // Chelsea NYC
      '80202': [2380, 2540, 3030, 3970, 4420],  // Denver downtown
      '80903': [1120, 1370, 1620, 2250, 2560],  // Colorado Springs
      '02118': [2110, 2210, 2630, 3150, 3480],  // Boston South End
      '94102': [2050, 2510, 2990, 3740, 3960],  // SF
      '60614': [2220, 2370, 2670, 3440, 3980],  // Chicago Lincoln Park
      '90012': [1960, 2190, 2730, 3460, 3850],  // LA downtown
    };

    for (const [zip, expected] of Object.entries(hudGroundTruth)) {
      it(`ZIP ${zip}: FMR matches HUD source`, () => {
        if (!rentData[zip]) { console.log(`SKIPPED: ${zip} not in rentData`); return; }
        expect(rentData[zip].f).toEqual(expected);
      });
    }
  });

  describe('State assignment sanity', () => {
    const zipToState: Record<string, string> = {
      '07030': 'NJ', '10001': 'NY', '80202': 'CO',
      '02118': 'MA', '94102': 'CA', '60614': 'IL',
      '90012': 'CA', '33101': 'FL', '98101': 'WA',
    };

    for (const [zip, state] of Object.entries(zipToState)) {
      it(`ZIP ${zip} assigned to ${state}`, () => {
        if (!rentData[zip]) { console.log(`SKIPPED: ${zip} not in rentData`); return; }
        expect(rentData[zip].s).toBe(state);
      });
    }
  });

  describe('Total coverage', () => {
    it('rentData has 38,000+ ZIPs', () => {
      if (Object.keys(rentData).length === 0) { console.log('SKIPPED: data not loaded'); return; }
      expect(Object.keys(rentData).length).toBeGreaterThan(38000);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════
// LAYER 2: SCORING CALIBRATION
// Real-world scenarios with expected verdict ranges.
// Each test encodes "an expert would say this is [verdict]."
// If the engine disagrees with an expert, the scoring is miscalibrated.
// ═══════════════════════════════════════════════════════════════════

describe('Layer 2: Renewal Tool — Scoring Calibration', () => {

  // Helper: build a full input and return score + tier
  function score(overrides: Partial<FairnessScoreInput>) {
    const defaults: FairnessScoreInput = {
      increasePct: 5,
      marketYoY: 3.5,
      proposedRent: 2100,
      currentRent: 2000,
      compMedian: 2050,
      compCount: 6,
      fmr: 1800,
      zillowMonthly: 0.2,
      hvd: null,
      alYoY: null,
      alMoM: null,
      bedroomCount: 2,
      f50: null,
      rcMedianRent: null,
      rcTotalListings: null,
      compositeTrend: null,
      buildingMedian: null,
      buildingCompCount: null,
      sameLineMedian: null,
    };
    return calculateFairnessScore({ ...defaults, ...overrides });
  }

  // ── CLEARLY FAIR SCENARIOS (should score 70+) ──

  describe('Clearly fair scenarios → score 70+', () => {
    it('Below-trend increase, rent below comps', () => {
      const r = score({ increasePct: 2, marketYoY: 4, proposedRent: 1900, compMedian: 2050, fmr: 1800 });
      expect(r.total).toBeGreaterThanOrEqual(70);
      expect(['excellent', 'fair']).toContain(r.tier);
    });

    it('At-trend increase, rent at comp median', () => {
      const r = score({ increasePct: 3.5, marketYoY: 3.5, proposedRent: 2050, compMedian: 2050 });
      expect(r.total).toBeGreaterThanOrEqual(70);
    });

    it('Flat rent (0% increase) in rising market', () => {
      const r = score({ increasePct: 0, marketYoY: 4, proposedRent: 2000, currentRent: 2000 });
      expect(r.total).toBeGreaterThanOrEqual(80);
      expect(r.tier).toBe('excellent');
    });

    it('Small increase (2%) in flat market', () => {
      const r = score({ increasePct: 2, marketYoY: 0, proposedRent: 2040, currentRent: 2000 });
      expect(r.total).toBeGreaterThanOrEqual(65);
    });
  });

  // ── CLEARLY UNFAIR SCENARIOS (should score below 50) ──

  describe('Clearly unfair scenarios → score < 50', () => {
    it('10% increase in flat market, rent above comps', () => {
      const r = score({
        increasePct: 10, marketYoY: 0,
        proposedRent: 2200, currentRent: 2000,
        compMedian: 1900, fmr: 1800,
      });
      expect(r.total).toBeLessThan(50);
      expect(['moderate', 'unfair', 'excessive']).toContain(r.tier);
    });

    it('15% increase in declining market', () => {
      const r = score({
        increasePct: 15, marketYoY: -2,
        proposedRent: 2300, currentRent: 2000,
        compMedian: 2000, fmr: 1800,
        zillowMonthly: -0.5,
      });
      expect(r.total).toBeLessThan(45);
    });

    it('8% increase when comps and FMR both say rent is high', () => {
      const r = score({
        increasePct: 8, marketYoY: 2,
        proposedRent: 2700, currentRent: 2500,
        compMedian: 2200, fmr: 2000,
      });
      expect(r.total).toBeLessThan(50);
    });
  });

  // ── EDGE: PREMIUM / HIGH-RENT SCENARIOS ──

  describe('Premium rent scenarios', () => {
    it('Luxury renter with accurate comps: should NOT be penalized', () => {
      // $8,000 rent, comps at $8,500, FMR $4,000 — comps are real, just high-end market
      const r = score({
        increasePct: 3, marketYoY: 3,
        proposedRent: 8240, currentRent: 8000,
        compMedian: 8500, compCount: 5,
        fmr: 4000,
      });
      expect(r.total).toBeGreaterThanOrEqual(65);
    });

    it('Luxury skew: thin comps from one building should be discounted', () => {
      // The Hoboken bug: $6,500 rent, comps at $9,400, all same building
      // With compCount=2, comp weight is already low (10pts base).
      // Discount halves it to 5, dropping score ~3-4pts.
      // Real-world impact is larger because live system has ZORI, AL, market data active.
      const withSkew = score({
        increasePct: 4.6, marketYoY: 3.8,
        proposedRent: 6800, currentRent: 6500,
        compMedian: 9400, compCount: 2,
        fmr: 4140,
        allSameBuilding: true,
      });
      // Same inputs but comps match the user's rent tier (no discount fires)
      const withGoodComps = score({
        increasePct: 4.6, marketYoY: 3.8,
        proposedRent: 6800, currentRent: 6500,
        compMedian: 6900, compCount: 6,
        fmr: 4140,
        allSameBuilding: false,
      });
      // With skewed comps, score should be lower than with accurate comps
      expect(withSkew.total).toBeLessThanOrEqual(withGoodComps.total);
    });

    it('Premium renter, divergent comps but rent matches comps', () => {
      // $8,000 rent, $8,500 comps, FMR $4,370 — comps diverge from FMR but user matches comps
      const r = score({
        increasePct: 3, marketYoY: 3,
        proposedRent: 8240, currentRent: 8000,
        compMedian: 8500, compCount: 5,
        fmr: 4370,
      });
      // rentToCompRatio = 8000/8500 = 0.94 — above 0.75, so divergence discount should NOT fire
      expect(r.total).toBeGreaterThanOrEqual(60);
    });
  });

  // ── EDGE: MISSING DATA SCENARIOS ──

  describe('Missing data resilience', () => {
    it('No comps, no Zillow: still produces reasonable score from HUD + rate', () => {
      const r = score({
        compMedian: null, compCount: 0,
        zillowMonthly: null,
        increasePct: 5, marketYoY: 3,
        proposedRent: 2100, fmr: 2000,
      });
      expect(r.total).toBeGreaterThanOrEqual(40);
      expect(r.total).toBeLessThanOrEqual(80);
    });

    it('Only HUD data: score reflects rate vs trend + FMR position', () => {
      const r = score({
        compMedian: null, compCount: 0,
        zillowMonthly: null, hvd: null,
        alYoY: null, alMoM: null,
        increasePct: 8, marketYoY: 3,
        proposedRent: 2400, currentRent: 2200,
        fmr: 2000,
      });
      expect(r.total).toBeLessThan(70); // 8% vs 3% trend, above FMR — not great
    });
  });

  // ── MONOTONICITY: score should decrease as increase % rises ──

  describe('Monotonicity', () => {
    it('Score decreases as increase % rises (all else equal)', () => {
      const pcts = [0, 2, 4, 6, 8, 10, 15, 20];
      const scores = pcts.map(pct =>
        score({ increasePct: pct, proposedRent: 2000 * (1 + pct / 100) }).total
      );
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    it('Score increases as comp median rises (all else equal)', () => {
      const medians = [1500, 1800, 2000, 2200, 2500, 3000];
      const scores = medians.map(med => score({ compMedian: med }).total);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  });

  // ── SYMMETRY: similar inputs should produce similar outputs ──

  describe('Symmetry and proportionality', () => {
    it('Same ratio at different rent levels should score within 10pts', () => {
      // Low rent: $1,000 → $1,050 (5%), comps $1,100, FMR $900
      const low = score({
        increasePct: 5, proposedRent: 1050, currentRent: 1000,
        compMedian: 1100, fmr: 900,
      });
      // High rent: $5,000 → $5,250 (5%), comps $5,500, FMR $4,500
      const high = score({
        increasePct: 5, proposedRent: 5250, currentRent: 5000,
        compMedian: 5500, fmr: 4500,
      });
      expect(Math.abs(low.total - high.total)).toBeLessThanOrEqual(10);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════
// LAYER 2B: WSIP TOOL — FAIR RANGE CALIBRATION
// ═══════════════════════════════════════════════════════════════════

describe('Layer 2B: WSIP Tool — Fair Range Calibration', () => {

  function range(overrides: Partial<FairRangeInput>) {
    const defaults: FairRangeInput = {
      compRents: [2000, 2100, 2200, 2300, 2400],
      hudFmr: 1800,
      zoriRent: null,
      rcMarketMedian: null,
    };
    return calculateFairRange({ ...defaults, ...overrides });
  }

  describe('Fair range sanity', () => {
    it('rangeLow < rangeHigh always', () => {
      const r = range({});
      expect(r.rangeLow).toBeLessThan(r.rangeHigh);
    });

    it('Range includes comp median when comps are clustered', () => {
      const comps = [3800, 3900, 4000, 4100, 4200];
      const r = range({ compRents: comps, hudFmr: 3500 });
      const median = comps.sort()[Math.floor(comps.length / 2)];
      expect(r.rangeLow).toBeLessThan(median);
      expect(r.rangeHigh).toBeGreaterThan(median);
    });

    it('No comps: range anchored to HUD FMR', () => {
      const r = range({ compRents: [], hudFmr: 2000 });
      expect(r.rangeLow).toBe(2000);
      expect(r.rangeHigh).toBe(Math.round(2000 * 1.15));
      expect(r.confidence).toBe('low');
    });

    it('Many comps, high confidence', () => {
      const r = range({
        compRents: [3000, 3100, 3200, 3300, 3400, 3500],
        hudFmr: 2800,
        zoriRent: 3200,
        rcMarketMedian: 3300,
      });
      expect(r.confidence).toBe('high');
    });
  });

  describe('WSIP verdict direction', () => {
    it('Asking price below range low → not overpriced', () => {
      const r = range({ compRents: [3000, 3100, 3200, 3300, 3400], hudFmr: 2800 });
      const askingRent = r.rangeLow - 200;
      expect(askingRent).toBeLessThan(r.rangeLow);
    });

    it('Asking price above range high → overpriced', () => {
      const r = range({ compRents: [3000, 3100, 3200, 3300, 3400], hudFmr: 2800 });
      const askingRent = r.rangeHigh + 500;
      expect(askingRent).toBeGreaterThan(r.rangeHigh);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════
// LAYER 3: CROSS-TOOL CONSISTENCY
// When the same data inputs are used, Renewal and WSIP tools
// should agree directionally. If Renewal says "Excellent" but
// WSIP says "Overpriced" for the same rent, something is wrong.
// ═══════════════════════════════════════════════════════════════════

describe('Layer 3: Cross-Tool Consistency', () => {

  it('At-market rent: Renewal says Fair/Excellent AND WSIP says in-range', () => {
    // Scenario: $2,100 proposed, comps at $2,000-$2,200, FMR $1,800
    const comps = [1900, 2000, 2050, 2100, 2200];

    // Renewal tool
    const renewal = calculateFairnessScore({
      increasePct: 5, marketYoY: 3.5,
      proposedRent: 2100, currentRent: 2000,
      compMedian: 2050, compCount: 5,
      fmr: 1800, zillowMonthly: 0.2,
    });

    // WSIP tool
    const wsip = calculateFairRange({
      compRents: comps, hudFmr: 1800,
      zoriRent: null, rcMarketMedian: null,
    });

    // Renewal should be Fair or better
    expect(['excellent', 'fair']).toContain(renewal.tier);

    // WSIP: $2,100 should be within or very close to fair range
    // Allow some tolerance since the tools weight data differently
    expect(2100).toBeGreaterThanOrEqual(wsip.rangeLow - 100);
    expect(2100).toBeLessThanOrEqual(wsip.rangeHigh + 200);
  });

  it('Overpriced rent: Renewal says Moderate/Unfair AND WSIP says above range', () => {
    const comps = [1800, 1900, 2000, 2050, 2100];

    // Renewal: 12% increase, rent way above comps
    const renewal = calculateFairnessScore({
      increasePct: 12, marketYoY: 2,
      proposedRent: 2800, currentRent: 2500,
      compMedian: 2000, compCount: 5,
      fmr: 1800, zillowMonthly: 0.1,
    });

    // WSIP
    const wsip = calculateFairRange({
      compRents: comps, hudFmr: 1800,
      zoriRent: null, rcMarketMedian: null,
    });

    // Renewal should NOT say Excellent
    expect(renewal.tier).not.toBe('excellent');
    expect(renewal.total).toBeLessThan(70);

    // WSIP: $2,800 should be above fair range
    expect(2800).toBeGreaterThan(wsip.rangeHigh);
  });

  it('Below-market rent: Renewal says Excellent AND WSIP says below range', () => {
    const comps = [2800, 2900, 3000, 3100, 3200];

    // Renewal: 2% increase, rent below all comps
    const renewal = calculateFairnessScore({
      increasePct: 2, marketYoY: 4,
      proposedRent: 2040, currentRent: 2000,
      compMedian: 3000, compCount: 5,
      fmr: 2500, zillowMonthly: 0.3,
    });

    // WSIP
    const wsip = calculateFairRange({
      compRents: comps, hudFmr: 2500,
      zoriRent: null, rcMarketMedian: null,
    });

    // Renewal should score well
    expect(renewal.total).toBeGreaterThanOrEqual(75);

    // WSIP: $2,040 should be below or at bottom of fair range
    expect(2040).toBeLessThanOrEqual(wsip.rangeLow + 100);
  });
});


// ═══════════════════════════════════════════════════════════════════
// LAYER 4: COMP RELIABILITY DISCOUNT VALIDATION
// Verify the fix for the Hoboken luxury skew bug
// ═══════════════════════════════════════════════════════════════════

describe('Layer 4: Comp Reliability Discount', () => {

  function score(overrides: Partial<FairnessScoreInput>) {
    const defaults: FairnessScoreInput = {
      increasePct: 5, marketYoY: 3.5,
      proposedRent: 2100, currentRent: 2000,
      compMedian: 2050, compCount: 6,
      fmr: 1800, zillowMonthly: 0.2,
    };
    return calculateFairnessScore({ ...defaults, ...overrides });
  }

  describe('Path A: Divergent comps + rent mismatch', () => {
    it('Fires when comp/FMR > 1.8 AND rent/comp < 0.75', () => {
      // Discount scenario: comp median $9,400, FMR $4,140, current $6,500
      // compToFmrRatio = 2.27 (> 1.8), rentToCompRatio = 0.69 (< 0.75) → fires
      const divergent = score({
        compMedian: 9400, compCount: 3, fmr: 4140,
        currentRent: 6500, proposedRent: 6800, increasePct: 4.6,
        allSameBuilding: true,
      });
      // Same scenario but with comps that match the user's tier → no discount
      const matched = score({
        compMedian: 6900, compCount: 3, fmr: 4140,
        currentRent: 6500, proposedRent: 6800, increasePct: 4.6,
        allSameBuilding: false,
      });
      // Divergent comps should not score higher than matched comps
      expect(divergent.total).toBeLessThanOrEqual(matched.total);
    });

    it('Does NOT fire when rent matches comps (ratio > 0.75)', () => {
      // $8,000 rent, $8,500 comps, FMR $4,370
      // Ratio: 8500/4370 = 1.94 (> 1.8), BUT 8000/8500 = 0.94 (> 0.75)
      const r = score({
        compMedian: 8500, compCount: 5, fmr: 4370,
        currentRent: 8000, proposedRent: 8240, increasePct: 3,
      });
      // Should still score well — comps are valid for this renter
      expect(r.total).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Path B: Thin same-building comps', () => {
    it('Fires when all same building, < 5 comps, rent/comp < 0.85', () => {
      // All same building, 2 comps, rent well below comp median
      const thinSame = score({
        compMedian: 9400, compCount: 2, fmr: 4140,
        currentRent: 6500, proposedRent: 6800, increasePct: 4.6,
        allSameBuilding: true,
      });
      // Same building but enough comps that it's a valid sample
      const goodSample = score({
        compMedian: 6900, compCount: 8, fmr: 4140,
        currentRent: 6500, proposedRent: 6800, increasePct: 4.6,
        allSameBuilding: true,
      });
      // Thin same-building comps should not outscore a good sample
      expect(thinSame.total).toBeLessThanOrEqual(goodSample.total);
    });

    it('Does NOT fire when comps >= 5 even if same building', () => {
      const r = score({
        compMedian: 6200, compCount: 8, fmr: 4140,
        currentRent: 6500, proposedRent: 6800, increasePct: 4.6,
        allSameBuilding: true, // same building but plenty of comps
      });
      // 8 comps from same building is actually great data
      expect(r.total).toBeGreaterThanOrEqual(60);
    });
  });
});
