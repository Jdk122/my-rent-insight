import { describe, it, expect } from 'vitest';
import { calculateFairnessScore, FairnessScoreInput, FairnessScoreResult, scoreToVerdict } from '@/lib/fairnessScore';
import { calculateFairRange, FairRangeInput } from '@/lib/fairRange';
import { calculateCompositeTrend } from '@/lib/compositeTrend';
import { tierComps, getTierWeights, normalizeBaseAddress } from '@/lib/compTiering';
import { getBuildingRange } from '@/lib/buildingRange';
import { detectOutliers, correlationWeightedMedian } from '@/lib/dataQuality';
import { seasonallyAdjustRent } from '@/lib/seasonalAdjust';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// ⚠️ LOGIC DRIFT WARNING: getDisplayState() mirrors RentResults.tsx display logic
// as a pure function for testing. If RentResults.tsx changes its guardrail conditions
// (isCompDeficient threshold, compOverpayment threshold, headline selection),
// this helper must be updated manually. Long-term fix: extract shared display-state
// logic into a pure helper used by both production and tests.

const baseInput: FairnessScoreInput = {
  increasePct: 5,
  marketYoY: 3,
  proposedRent: 2100,
  currentRent: 2000,
  compMedian: 2000,
  compCount: 10,
  fmr: 1800,
  zillowMonthly: 0.3,
};

const score = (overrides: Partial<FairnessScoreInput>): FairnessScoreResult =>
  calculateFairnessScore({ ...baseInput, ...overrides });

const getComp = (id: string, overrides: Partial<FairnessScoreInput>) =>
  score(overrides).components.find(c => c.id === id)!;

const range = (overrides: Partial<FairRangeInput>) =>
  calculateFairRange({
    compRents: [],
    hudFmr: 1800,
    zoriRent: null,
    rcMarketMedian: null,
    ...overrides,
  });

// Helper: build product-layer display state from scoring inputs
// Mirrors the logic in RentResults.tsx without importing React
function getDisplayState(input: FairnessScoreInput) {
  const result = calculateFairnessScore(input);
  const effectiveVerdict = scoreToVerdict(result.total);
  const compComponent = result.components.find(c => c.id === 'comps');
  const isCompDeficient = !compComponent || compComponent.max <= 10;

  const rentBearingCompCount = input.compCount ?? 0;
  const compMedian = input.compMedian;
  const overPct = (compMedian && compMedian > 0)
    ? (input.proposedRent - compMedian) / compMedian
    : 0;
  const compOverpayment = (rentBearingCompCount >= 5 && overPct >= 0.15)
    ? { overPct: Math.round(overPct * 100), dollarOver: Math.round(input.proposedRent - compMedian!) }
    : null;

  // compOverpayment callout only shows when score >= 60
  const showCompOverpaymentCallout = compOverpayment !== null && result.total >= 60;

  return {
    score: result.total,
    tier: result.tier,
    tierLabel: result.tierLabel,
    effectiveVerdict,
    isCompDeficient,
    showCompOverpaymentCallout,
    compOverpayment,
    // What the headline should say
    headlineType: result.total < 60 ? 'above-market'
      : isCompDeficient && effectiveVerdict === 'at-market' ? 'tracks-trend'
      : isCompDeficient && effectiveVerdict === 'below' ? 'in-line-with-trends'
      : effectiveVerdict === 'below' ? 'below-market'
      : 'at-market',
  };
}

const makeComp = (addr: string, rent: number | null, bedrooms: number, distance = 0) => ({
  formattedAddress: addr,
  rent,
  bedrooms,
  bathrooms: 1,
  squareFootage: null,
  distance,
  daysOld: 30,
  correlation: 1,
});

// ═══════════════════════════════════════════════════════════════
// SECTION 1: KNOWN LIMITATIONS
// These document bad behavior that exists today.
// When fixed, flip these to assert the corrected behavior.
// ═══════════════════════════════════════════════════════════════

describe('KNOWN LIMITATIONS — flip when fixed', () => {

  it('OSHKOSH: 19% above comp median with 10 comps still scores Fair (71)', () => {
    // ROOT CAUSE: Component 2 capped at 30 pts cannot drag total below 60 alone.
    // MITIGATION: comp-overpayment callout surfaces this in UI.
    // PROPER FIX: comp-position penalty when proposed > 15% above median with 5+ comps.
    const result = score({
      increasePct: 7, marketYoY: 5.8, proposedRent: 1150,
      currentRent: 1075, compMedian: 970, compCount: 10, fmr: 1140, zillowMonthly: null,
    });
    expect(result.tier).toBe('fair');
    expect(result.total).toBeGreaterThanOrEqual(65);
    expect(result.total).toBeLessThanOrEqual(75);
  });

  it('⚠️ ZERO-COMP INFLATION: scores 95 EXCELLENT with NO comparable data — guardrail masks this in UI but score math is wrong', () => {
    // ROOT CAUSE: Rate gets 65 pts when comps absent, Reasonableness gives 25, Momentum defaults 5.
    // MITIGATION: isCompDeficient guardrail forces "Limited" badge and softened language.
    // PROPER FIX: consider score cap or mandatory discount when rateMax >= 50.
    const result = score({
      increasePct: 3, marketYoY: 4, compMedian: null, compCount: 0,
      proposedRent: 2060, currentRent: 2000, fmr: 1800, zillowMonthly: null,
    });
    expect(result.total).toBe(95);
    expect(result.tier).toBe('excellent'); // this is the problem — Excellent with zero comps
  });

  it('EXTREME INPUT: 150% increase clamped to 100% still scores 57 (Moderate)', () => {
    // ROOT CAUSE: Clamp prevents overflow but Reasonableness + Momentum still contribute.
    const result = score({ increasePct: 150 });
    expect(result.total).toBe(57);
    expect(result.tier).toBe('moderate');
  });

  it('ADDRESS BUG: #12B unit designator not stripped from address normalization', () => {
    // ROOT CAUSE: Regex \\b#\\s*\\S+ requires word boundary; "Ave #12B" doesn't strip fully.
    // IMPACT: Comps with "#" vs "Apt" format may not match as same-building.
    expect(normalizeBaseAddress('400 Park Ave #12B')).toBe('400 park ave #12b');
    // Expected after fix: '400 park ave'
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: MONOTONICITY INVARIANTS
// Things that should always be directionally true.
// ═══════════════════════════════════════════════════════════════

describe('Monotonicity Invariants', () => {

  describe('Increase rate: higher increase should never improve score', () => {
    const increases = [1, 3, 5, 8, 12, 20];
    const base = { marketYoY: 3, proposedRent: 2000, currentRent: 2000, compMedian: 2000, compCount: 10, fmr: 1800, zillowMonthly: 0.3 };

    it('score is monotonically non-increasing as increasePct rises', () => {
      let prevScore = 100;
      for (const inc of increases) {
        const result = score({ ...base, increasePct: inc, proposedRent: Math.round(2000 * (1 + inc / 100)) });
        expect(result.total).toBeLessThanOrEqual(prevScore);
        prevScore = result.total;
      }
    });
  });

  describe('Comp position: higher rent above median should never improve score', () => {
    const rents = [1900, 2000, 2200, 2500, 3000];
    const base = { increasePct: 5, marketYoY: 3, currentRent: 1900, compMedian: 2000, compCount: 10, fmr: 1800, zillowMonthly: 0.3 };

    it('score is non-increasing as proposed rent rises above comp median', () => {
      let prevScore = 100;
      for (const rent of rents) {
        const inc = Math.round(((rent - 1900) / 1900) * 100 * 10) / 10;
        const result = score({ ...base, proposedRent: rent, increasePct: Math.max(inc, 0.1) });
        expect(result.total).toBeLessThanOrEqual(prevScore);
        prevScore = result.total;
      }
    });
  });

  describe('Comp count: more comps should not decrease comp authority', () => {
    it('comp component max weight is non-decreasing as compCount increases', () => {
      const counts = [0, 1, 3, 5, 10];
      let prevMax = 0;
      for (const cc of counts) {
        const result = score({ compCount: cc, compMedian: cc > 0 ? 2000 : null });
        const compComp = result.components.find(c => c.id === 'comps');
        const max = compComp?.max ?? 0;
        expect(max).toBeGreaterThanOrEqual(prevMax);
        prevMax = max;
      }
    });
  });

  describe('Market trend: falling market should never make same increase look better', () => {
    it('score with -2% trend <= score with +5% trend for same 7% increase', () => {
      const falling = score({ increasePct: 7, marketYoY: -2, proposedRent: 2140, currentRent: 2000 });
      const rising = score({ increasePct: 7, marketYoY: 5, proposedRent: 2140, currentRent: 2000 });
      expect(falling.total).toBeLessThanOrEqual(rising.total);
    });
  });

  describe('Fair range: more sources should not narrow confidence', () => {
    it('adding ZORI or rcMarketMedian should not downgrade confidence', () => {
      const base = range({ compRents: [2000, 2100, 2200], hudFmr: 1800 });
      const withZori = range({ compRents: [2000, 2100, 2200], hudFmr: 1800, zoriRent: 2100 });
      const withBoth = range({ compRents: [2000, 2100, 2200], hudFmr: 1800, zoriRent: 2100, rcMarketMedian: 2150 });

      const confRank = { low: 0, moderate: 1, high: 2 };
      expect(confRank[withZori.confidence]).toBeGreaterThanOrEqual(confRank[base.confidence]);
      expect(confRank[withBoth.confidence]).toBeGreaterThanOrEqual(confRank[withZori.confidence]);
    });
  });

  describe('Composite trend: adding agreeing sources should not lower confidence', () => {
    it('3 agreeing sources >= 2 agreeing sources in confidence', () => {
      const two = calculateCompositeTrend({ alYoY: 3.0, zoriYoY: 3.5, hudYoY: null });
      const three = calculateCompositeTrend({ alYoY: 3.0, zoriYoY: 3.5, hudYoY: 2.8 });
      expect(three.confidenceScore).toBeGreaterThanOrEqual(two.confidenceScore);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: GOLDEN CASE MATRIX
// Real-world scenarios with expected user-facing outcomes.
// ═══════════════════════════════════════════════════════════════

describe('Golden Case Matrix', () => {

  it('CASE 1: Normal renewal, slight above trend, rent near comps → Excellent, no callouts', () => {
    const ds = getDisplayState({
      increasePct: 5, marketYoY: 3.5, proposedRent: 2100, currentRent: 2000,
      compMedian: 2050, compCount: 8, fmr: 1800, zillowMonthly: 0.2,
    });
    // 5% vs 3.5% trend = only 1.5pp above, and rent is near comp median → strong score
    expect(ds.tier).toBe('excellent');
    expect(ds.isCompDeficient).toBe(false);
    expect(ds.showCompOverpaymentCallout).toBe(false);
  });

  it('CASE 2: Below-trend increase with strong comps → Excellent, below market', () => {
    const ds = getDisplayState({
      increasePct: 2, marketYoY: 5, proposedRent: 2040, currentRent: 2000,
      compMedian: 2200, compCount: 10, fmr: 1800, zillowMonthly: 0.4,
    });
    expect(ds.tier).toBe('excellent');
    expect(ds.effectiveVerdict).toBe('below');
    expect(ds.headlineType).toBe('below-market');
    expect(ds.showCompOverpaymentCallout).toBe(false);
  });

  it('CASE 3: Oshkosh — trend-aligned but 19% above comps → Fair + callout', () => {
    const ds = getDisplayState({
      increasePct: 7, marketYoY: 5.8, proposedRent: 1150, currentRent: 1075,
      compMedian: 970, compCount: 10, fmr: 1140, zillowMonthly: null,
    });
    expect(ds.tier).toBe('fair');
    expect(ds.showCompOverpaymentCallout).toBe(true);
    expect(ds.compOverpayment!.dollarOver).toBe(180);
  });

  it('CASE 4: No comps, below-trend increase → Excellent but comp-deficient guardrail fires', () => {
    const ds = getDisplayState({
      increasePct: 3, marketYoY: 4, proposedRent: 2060, currentRent: 2000,
      compMedian: null, compCount: 0, fmr: 1800, zillowMonthly: null,
    });
    // 3% below 4% trend → full rate points (65/65) + full reasonableness + default momentum
    // Score is 95 Excellent — this is the no-comp inflation problem
    expect(ds.tier).toBe('excellent');
    expect(ds.isCompDeficient).toBe(true); // guardrail fires
    expect(ds.showCompOverpaymentCallout).toBe(false);
    expect(ds.headlineType).toBe('in-line-with-trends'); // softened from "below market"
  });

  it('CASE 5: No comps, high increase → Moderate + comp-deficient', () => {
    const ds = getDisplayState({
      increasePct: 10, marketYoY: 3, proposedRent: 2200, currentRent: 2000,
      compMedian: null, compCount: 0, fmr: 1800, zillowMonthly: null,
    });
    expect(ds.tier).toBe('moderate');
    expect(ds.isCompDeficient).toBe(true);
    expect(ds.headlineType).toBe('above-market');
  });

  it('CASE 6: Premium unit — building data skipped, area comps used', () => {
    const result = calculateFairnessScore({
      increasePct: 5, marketYoY: 3, proposedRent: 4200, currentRent: 4000,
      compMedian: 3500, compCount: 8, fmr: 1800, zillowMonthly: 0.3,
      buildingMedian: 2800, buildingCompCount: 5, // currentRent 4000 > 2800 * 1.20 = 3360
    });
    expect(result.components.find(c => c.id === 'comps')!.label).toContain('Nearby Listings');
  });

  it('CASE 7: Same-building override with 3+ building comps', () => {
    const result = calculateFairnessScore({
      increasePct: 5, marketYoY: 3, proposedRent: 2100, currentRent: 2000,
      compMedian: 2500, compCount: 10, fmr: 1800, zillowMonthly: 0.3,
      buildingMedian: 2000, buildingCompCount: 4,
    });
    expect(result.components.find(c => c.id === 'comps')!.label).toContain('Your Building');
  });

  it('CASE 8: Declining market, 5% increase but rent = comp median → Fair (72)', () => {
    const ds = getDisplayState({
      increasePct: 5, marketYoY: -1, proposedRent: 2100, currentRent: 2000,
      compMedian: 2000, compCount: 10, fmr: 1800, zillowMonthly: -0.2,
    });
    // 6pp above trend → rate penalized (12/35), but rent ≈ median → full comp (26/30)
    // Reasonableness 24/25, momentum 10/10 (falling market = renter-friendly)
    expect(ds.score).toBe(72);
    expect(ds.tier).toBe('fair');
  });

  it('CASE 9: Flat market, 0% increase → Excellent', () => {
    const ds = getDisplayState({
      increasePct: 0, marketYoY: 0, proposedRent: 2000, currentRent: 2000,
      compMedian: 2100, compCount: 10, fmr: 1800, zillowMonthly: 0,
    });
    expect(ds.tier).toBe('excellent');
  });

  it('CASE 10: Absurd increase (50%) → Unfair or Excessive', () => {
    const ds = getDisplayState({
      increasePct: 50, marketYoY: 3, proposedRent: 3000, currentRent: 2000,
      compMedian: 2000, compCount: 10, fmr: 1800, zillowMonthly: 0.3,
    });
    expect(['unfair', 'excessive']).toContain(ds.tier);
  });

  it('CASE 11: 1 comp only → comp-deficient', () => {
    const ds = getDisplayState({
      increasePct: 4, marketYoY: 3, proposedRent: 2080, currentRent: 2000,
      compMedian: 2000, compCount: 1, fmr: 1800, zillowMonthly: 0.2,
    });
    expect(ds.isCompDeficient).toBe(true);
  });

  it('CASE 12: compOverpayment and isCompDeficient are mutually exclusive', () => {
    for (const cc of [0, 1, 2, 3, 5, 8, 15]) {
      const ds = getDisplayState({
        increasePct: 7, marketYoY: 3, proposedRent: 2500, currentRent: 2000,
        compMedian: 1800, compCount: cc, fmr: 1800, zillowMonthly: 0.3,
      });
      expect(ds.isCompDeficient && ds.showCompOverpaymentCallout).toBe(false);
    }
  });

  it('CASE 13: scoreToVerdict is deterministic and consistent with tier thresholds', () => {
    for (let s = 0; s <= 100; s++) {
      const v = scoreToVerdict(s);
      if (s >= 80) expect(v).toBe('below');
      else if (s >= 60) expect(v).toBe('at-market');
      else expect(v).toBe('above');
    }
  });

  it('CASE 14: 14% above comps with only 4 comps → callout does NOT fire (too few)', () => {
    const ds = getDisplayState({
      increasePct: 5, marketYoY: 3, proposedRent: 2280, currentRent: 2000,
      compMedian: 2000, compCount: 4, fmr: 1800, zillowMonthly: 0.3,
    });
    expect(ds.showCompOverpaymentCallout).toBe(false);
  });

  it('CASE 15: 14% above comps with 10 comps → callout does NOT fire (under 15% threshold)', () => {
    const ds = getDisplayState({
      increasePct: 5, marketYoY: 3, proposedRent: 2280, currentRent: 2000,
      compMedian: 2000, compCount: 10, fmr: 1800, zillowMonthly: 0.3,
    });
    expect(ds.showCompOverpaymentCallout).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: COMPONENT-LEVEL REGRESSION
// ═══════════════════════════════════════════════════════════════

describe('Component-Level Regression', () => {

  describe('Weight redistribution exact values', () => {
    it('5+ comps: rate=35, comps=30', () => {
      const r = score({ compCount: 5, compMedian: 2000 });
      expect(r.components.find(c => c.id === 'rate')!.max).toBe(35);
      expect(r.components.find(c => c.id === 'comps')!.max).toBe(30);
    });
    it('3-4 comps: rate=47, comps=18', () => {
      const r = score({ compCount: 3, compMedian: 2000 });
      expect(r.components.find(c => c.id === 'rate')!.max).toBe(47);
      expect(r.components.find(c => c.id === 'comps')!.max).toBe(18);
    });
    it('1-2 comps: rate=55, comps=10', () => {
      const r = score({ compCount: 1, compMedian: 2000 });
      expect(r.components.find(c => c.id === 'rate')!.max).toBe(55);
      expect(r.components.find(c => c.id === 'comps')!.max).toBe(10);
    });
    it('0 comps: rate=65, comps absent', () => {
      const r = score({ compCount: 0, compMedian: null });
      expect(r.components.find(c => c.id === 'rate')!.max).toBe(65);
      expect(r.components.find(c => c.id === 'comps')).toBeUndefined();
    });
  });

  describe('Reasonableness data source cascade', () => {
    it('Rentcast market median (10+ listings) → live market data label', () => {
      expect(getComp('fmr', { rcMedianRent: 2200, rcTotalListings: 15 }).label).toContain('live market data');
    });
    it('HUD F50 when Rentcast < 10 → HUD median label', () => {
      expect(getComp('fmr', { rcMedianRent: 2200, rcTotalListings: 5, f50: [1500, 1700, 2000, 2300, 2600], bedroomCount: 2 }).label).toContain('HUD median');
    });
    it('Declining market scores worse than rising for same increase', () => {
      const falling = getComp('fmr', { currentRent: 3000, proposedRent: 3150, fmr: 1500, increasePct: 5, marketYoY: -2 });
      const rising = getComp('fmr', { currentRent: 3000, proposedRent: 3150, fmr: 1500, increasePct: 5, marketYoY: 2 });
      expect(falling.score).toBeLessThan(rising.score);
    });
  });

  describe('Momentum fallback chain', () => {
    it('Zillow MoM → not estimated', () => expect(getComp('momentum', { zillowMonthly: 0.5 }).estimated).toBe(false));
    it('AL MoM fallback → estimated', () => expect(getComp('momentum', { zillowMonthly: null, alMoM: 0.3 }).estimated).toBe(true));
    it('ZHVI falling → 8/10, estimated', () => {
      const c = getComp('momentum', { zillowMonthly: null, alMoM: null, hvd: 'falling' });
      expect(c.score).toBe(8); expect(c.estimated).toBe(true);
    });
    it('Nothing → 5/10, estimated', () => {
      const c = getComp('momentum', { zillowMonthly: null, alMoM: null, hvd: null });
      expect(c.score).toBe(5); expect(c.estimated).toBe(true);
    });
  });

  describe('Building-level comp hierarchy', () => {
    it('same-line → "Same Unit Line"', () => expect(getComp('comps', {
      compMedian: 2500, buildingMedian: 2200, buildingCompCount: 5, sameLineMedian: 2000, proposedRent: 2100, currentRent: 2000,
    }).label).toContain('Same Unit Line'));
    it('3+ building → "Your Building"', () => expect(getComp('comps', {
      compMedian: 2500, buildingMedian: 2000, buildingCompCount: 3, proposedRent: 2100, currentRent: 1900,
    }).label).toContain('Your Building'));
    it('premium unit → "Nearby Listings"', () => expect(getComp('comps', {
      compMedian: 2500, buildingMedian: 1800, buildingCompCount: 5, currentRent: 2200, proposedRent: 2300,
    }).label).toContain('Nearby Listings'));
  });

  describe('Input validation', () => {
    it('zero proposed rent → 50, moderate', () => { const r = calculateFairnessScore({ ...baseInput, proposedRent: 0 }); expect(r.total).toBe(50); expect(r.tier).toBe('moderate'); });
    it('zero current rent → 50', () => expect(calculateFairnessScore({ ...baseInput, currentRent: 0 }).total).toBe(50));
    it('comp < $200 → sanitized', () => { const c = score({ compMedian: 100, compCount: 10 }).components.find(c => c.id === 'comps'); if (c) expect(c.estimated).toBe(true); });
    it('comp > $25K → sanitized', () => { const c = score({ compMedian: 30000, compCount: 10 }).components.find(c => c.id === 'comps'); if (c) expect(c.estimated).toBe(true); });
  });

  describe('scoreToVerdict exact mapping', () => {
    it('80 → below', () => expect(scoreToVerdict(80)).toBe('below'));
    it('79 → at-market', () => expect(scoreToVerdict(79)).toBe('at-market'));
    it('60 → at-market', () => expect(scoreToVerdict(60)).toBe('at-market'));
    it('59 → above', () => expect(scoreToVerdict(59)).toBe('above'));
    it('0 → above', () => expect(scoreToVerdict(0)).toBe('above'));
    it('100 → below', () => expect(scoreToVerdict(100)).toBe('below'));
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: WSIP FAIR RANGE
// ═══════════════════════════════════════════════════════════════

describe('WSIP Fair Range', () => {
  it('HUD-only → low confidence, FMR to FMR*1.15', () => {
    const r = range({ hudFmr: 1500 });
    expect(r.rangeLow).toBe(1500); expect(r.rangeHigh).toBe(Math.round(1500 * 1.15));
    expect(r.confidence).toBe('low'); expect(r.sources).toContain('HUD SAFMR');
  });
  it('5+ comps + ZORI + rc → high confidence', () => {
    const r = range({ compRents: [2000, 2100, 2200, 2300, 2400], hudFmr: 1800, zoriRent: 2200, rcMarketMedian: 2150 });
    expect(r.confidence).toBe('high');
  });
  it('ZORI pulls range higher', () => {
    const without = range({ compRents: [2000, 2200, 2400], hudFmr: 1800 });
    const with_ = range({ compRents: [2000, 2200, 2400], hudFmr: 1800, zoriRent: 2800 });
    expect(with_.rangeHigh).toBeGreaterThan(without.rangeHigh);
  });
  it('tier1 override → high confidence, In-Building source', () => {
    const r = range({ compRents: [2000, 2100, 2200, 2300], hudFmr: 1800,
      tierOverride: { tier1Rents: [2000, 2100, 2200], otherRents: [2300], tier1CompWeight: 60, otherCompWeight: 10, hudZoriWeight: 30 } });
    expect(r.confidence).toBe('high'); expect(r.sources).toContain('In-Building Comps');
  });
  it('$0 and negative comps filtered', () => expect(range({ compRents: [0, -500, 2000, 2200], hudFmr: 1800 }).rangeLow).toBeGreaterThan(0));
  it('range low <= range high (stress)', () => {
    for (const c of [{ compRents: [500], hudFmr: 3000 }, { compRents: [], hudFmr: 800 }, { compRents: [10000, 500], hudFmr: 1500 }]) {
      expect(range(c).rangeHigh).toBeGreaterThanOrEqual(range(c).rangeLow);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6: COMPOSITE TREND ENGINE
// ═══════════════════════════════════════════════════════════════

describe('Composite Trend Engine', () => {
  it('no sources → 0 trend, limited, 0 confidence', () => {
    const r = calculateCompositeTrend({ alYoY: null, zoriYoY: null, hudYoY: null });
    expect(r.compositeTrend).toBe(0); expect(r.badgeTier).toBe('limited'); expect(r.confidenceScore).toBe(0);
  });
  it('single AL → estimated, 55 confidence', () => {
    const r = calculateCompositeTrend({ alYoY: 3.5, zoriYoY: null, hudYoY: null });
    expect(r.badgeTier).toBe('estimated'); expect(r.confidenceScore).toBe(55);
  });
  it('disagreeing sources → lower confidence', () => {
    const agree = calculateCompositeTrend({ alYoY: 4.0, zoriYoY: 3.5, hudYoY: null });
    const disagree = calculateCompositeTrend({ alYoY: 4.0, zoriYoY: -2.0, hudYoY: null });
    expect(disagree.confidenceScore).toBeLessThan(agree.confidenceScore);
  });
  it('AL weighted highest', () => expect(calculateCompositeTrend({ alYoY: 5.0, zoriYoY: 3.0, hudYoY: 2.0 }).compositeTrend).toBeGreaterThan(3.5));
  it('ZORI county < zip confidence', () => {
    const zip = calculateCompositeTrend({ alYoY: null, zoriYoY: 5.0, zoriSource: 'zip', hudYoY: null });
    const county = calculateCompositeTrend({ alYoY: null, zoriYoY: 5.0, zoriSource: 'county', hudYoY: null });
    expect(zip.confidenceScore).toBeGreaterThanOrEqual(county.confidenceScore);
  });
  it('near-zero → higher uncertainty', () => {
    expect(calculateCompositeTrend({ alYoY: 0.1, zoriYoY: 0.2, hudYoY: null }).confidenceScore)
      .toBeLessThan(calculateCompositeTrend({ alYoY: 5.0, zoriYoY: 4.8, hudYoY: null }).confidenceScore);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7: SUPPORTING MODULES
// ═══════════════════════════════════════════════════════════════

describe('Comp Tiering', () => {
  it('same building = tier 1', () => expect(tierComps([makeComp('400 Park Ave Apt 5B', 2000, 2)], '400 Park Ave Apt 3A').tier1.length).toBe(1));
  it('same street + close = tier 2', () => expect(tierComps([makeComp('402 Park Ave Apt 1', 2000, 2, 0.05)], '400 Park Ave Apt 3A').tier2.length).toBe(1));
  it('within 0.5mi = tier 3', () => expect(tierComps([makeComp('100 Different St', 2000, 2, 0.3)], '400 Park Ave').tier3.length).toBe(1));
  it('beyond 0.5mi = tier 4', () => expect(tierComps([makeComp('100 Far Blvd', 2000, 2, 1.5)], '400 Park Ave').tier4.length).toBe(1));
  it('weights: 3→60/10/30, 1→40/30/30, 0→null', () => {
    expect(getTierWeights(3)).toEqual({ tier1CompWeight: 60, otherCompWeight: 10, hudZoriWeight: 30 });
    expect(getTierWeights(1)).toEqual({ tier1CompWeight: 40, otherCompWeight: 30, hudZoriWeight: 30 });
    expect(getTierWeights(0)).toBeNull();
  });
  it('normalization strips Apt/Unit/Suite/comma-after', () => {
    expect(normalizeBaseAddress('400 Park Ave Apt 9G')).toBe('400 park ave');
    expect(normalizeBaseAddress('400 Park Ave, New York, NY')).toBe('400 park ave');
    expect(normalizeBaseAddress('400 Park Ave Unit 5')).toBe('400 park ave');
    expect(normalizeBaseAddress('400 Park Ave Suite 200')).toBe('400 park ave');
  });
});

describe('Building Range', () => {
  it('< 2 comps → inactive', () => expect(getBuildingRange([makeComp('100 Main Apt 1', 2000, 2)], '100 Main Apt 5').hasBuildingData).toBe(false));
  it('2+ comps → active', () => {
    const r = getBuildingRange([makeComp('100 Main Apt 1', 2000, 2), makeComp('100 Main Apt 2', 2200, 2)], '100 Main Apt 5', 2);
    expect(r.hasBuildingData).toBe(true); expect(r.buildingLow).toBe(2000); expect(r.buildingHigh).toBe(2200);
  });
  it('bedroom filter applied', () => {
    const r = getBuildingRange([makeComp('100 Main Apt 1', 2000, 2), makeComp('100 Main Apt 2', 2200, 2), makeComp('100 Main Apt 3', 1500, 1)], '100 Main Apt 5', 2);
    expect(r.buildingLow).toBe(2000); expect(r.bedroomFilterLabel).toBe('2BR');
  });
  it('null rent → ignored', () => expect(getBuildingRange([makeComp('100 Main Apt 1', null, 2), makeComp('100 Main Apt 2', null, 2)], '100 Main Apt 5', 2).hasBuildingData).toBe(false));
});

describe('Seasonal Adjustment', () => {
  it('same month → no change', () => expect(seasonallyAdjustRent(2000, 6, 6, 'NY').wasAdjusted).toBe(false));
  it('< 2% diff → suppressed', () => expect(seasonallyAdjustRent(2000, 1, 2, 'FL').wasAdjusted).toBe(false));
  it('Jan→Jul NY → up', () => expect(seasonallyAdjustRent(2000, 1, 7, 'NY').adjusted).toBeGreaterThan(2000));
  it('Jul→Jan NY → down', () => expect(seasonallyAdjustRent(2000, 7, 1, 'NY').adjusted).toBeLessThan(2000));
  it('unknown state → no change', () => expect(seasonallyAdjustRent(2000, 1, 7, 'XX').wasAdjusted).toBe(false));
  it('$0 → no change', () => expect(seasonallyAdjustRent(0, 1, 7, 'NY').wasAdjusted).toBe(false));
});

describe('Outlier Detection', () => {
  const makeComps = (rents: number[]) => rents.map((r, i) => makeComp(`${i} Test St`, r, 2, 0.5));
  it('< 5 comps → no removal', () => expect(detectOutliers(makeComps([1000, 1100, 1200, 5000])).outliers.length).toBe(0));
  it('5+ → extreme removed', () => expect(detectOutliers(makeComps([1000, 1050, 1100, 1150, 1200, 5000])).outliers.some(o => o.rent === 5000)).toBe(true));
  it('correlation weighting favors high-corr comps', () => {
    const comps = [{ ...makeComp('1 St', 1000, 2, 0.5), correlation: 0.1 }, { ...makeComp('2 St', 3000, 2, 0.5), correlation: 0.9 }];
    expect(correlationWeightedMedian(comps)!).toBeGreaterThan(2000);
  });
});
