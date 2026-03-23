/**
 * Deal scoring engine — 4-component system.
 *
 * Components:
 *   1. Price vs Market (0-50 pts) — rent relative to market median
 *   2. Fair Range Position (0-20 pts) — where rent falls in batch IQR
 *   3. Listing Freshness (0-15 pts) — days on market
 *   4. Market Momentum (0-15 pts) — composite trend, attenuated by confidence
 *
 * Bonuses: vacancy rate (up to +3)
 * Scam detection: listings >45% below median flagged as suspicious
 */

export function normalizeBedrooms(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 1;
  return Math.max(0, Math.floor(value));
}

export interface DealScoreInput {
  rent: number;
  bedrooms: number;
  daysOnMarket: number | null;
  rcMedianRent: number | null;
  compositeTrend: number | null;
  trendConfidence: number;
  batchMedian: number;
  batchP25: number | null;
  batchP75: number | null;
  stateVacancyRate: number | null;
  isRentStabilized: boolean;
  walkScore: number | null;
}

export interface DealScoreResult {
  score: number;
  verdict: 'great' | 'good' | null;
  savingsPerMonth: number;
  savingsPct: number;
  median: number;
  isSuspicious: boolean;
  hasLeverage: boolean;
  leverageNote: string | null;
  components: {
    position: { score: number; max: 50 };
    range: { score: number; max: 20 };
    freshness: { score: number; max: 15 };
    momentum: { score: number; max: 15 };
  } | null;
  fairRange: { low: number; high: number } | null;
  trendContext: string | null;
  walkScore: number | null;
  isRentStabilized: boolean;
}

const EMPTY_RESULT: DealScoreResult = {
  score: 0, verdict: null, savingsPerMonth: 0, savingsPct: 0,
  median: 0, isSuspicious: false, hasLeverage: false, leverageNote: null,
  components: null, fairRange: null, trendContext: null,
  walkScore: null, isRentStabilized: false,
};

export function scoreListing(input: DealScoreInput): DealScoreResult {
  const median = (input.rcMedianRent != null && input.rcMedianRent > 0)
    ? input.rcMedianRent
    : input.batchMedian;

  if (median <= 0 || input.rent <= 0) {
    return { ...EMPTY_RESULT };
  }

  const ratio = (input.rent - median) / median;

  // ── Component 1: Price vs Market (0-50 pts) ──
  let positionScore: number;
  if (ratio <= -0.20) positionScore = 50;
  else if (ratio <= -0.10) positionScore = 40 + ((-0.10 - ratio) / 0.10) * 10;
  else if (ratio <= 0) positionScore = 30 + ((-ratio) / 0.10) * 10;
  else if (ratio <= 0.10) positionScore = 15 - (ratio / 0.10) * 15;
  else positionScore = 0;

  // ── Component 2: Fair Range Position (0-20 pts) ──
  let rangeScore = 10;
  if (input.batchP25 != null && input.batchP75 != null) {
    if (input.rent <= input.batchP25) rangeScore = 20;
    else if (input.rent <= median) rangeScore = 14;
    else if (input.rent <= input.batchP75) rangeScore = 8;
    else rangeScore = 3;
  }

  // ── Component 3: Freshness (0-15 pts) ──
  const dom = input.daysOnMarket;
  let freshnessScore: number;
  if (dom == null) freshnessScore = 9;
  else if (dom <= 3) freshnessScore = 15;
  else if (dom <= 7) freshnessScore = 13;
  else if (dom <= 14) freshnessScore = 10;
  else if (dom <= 30) freshnessScore = 7;
  else if (dom <= 60) freshnessScore = 4;
  else freshnessScore = 2;

  // ── Component 4: Market Momentum (0-15 pts) ──
  let momentumScore = 8;
  if (input.compositeTrend != null) {
    const conf = Math.max(0, Math.min(100, input.trendConfidence ?? 0));
    let rawMomentum: number;
    if (input.compositeTrend <= -1) rawMomentum = 15;
    else if (input.compositeTrend <= 0) rawMomentum = 12;
    else if (input.compositeTrend <= 2) rawMomentum = 8;
    else if (input.compositeTrend <= 5) rawMomentum = 5;
    else rawMomentum = 2;
    momentumScore = Math.round((rawMomentum * (conf / 100)) + (8 * (1 - conf / 100)));
  }

  // ── Total ──
  let total = Math.round(positionScore + rangeScore + freshnessScore + momentumScore);

  if (input.stateVacancyRate != null && input.stateVacancyRate > 6) {
    total += input.stateVacancyRate > 8 ? 3 : 1;
  }

  total = Math.max(0, Math.min(100, total));

  // ── Scam detection ──
  const isSuspicious = median > 0 && input.rent < median * 0.55;

  // ── Negotiation leverage ──
  const hasLeverage = dom != null && dom > 21 && ratio > -0.05;
  const leverageNote = hasLeverage
    ? `Listed ${dom} days — landlord may negotiate`
    : null;

  // ── Verdict ──
  let verdict: 'great' | 'good' | null;
  if (isSuspicious) verdict = null;
  else if (total >= 80) verdict = 'great';
  else if (total >= 68) verdict = 'good';
  else verdict = null;

  const savingsPerMonth = Math.max(0, Math.round(median - input.rent));
  const savingsPct = median > 0 ? Math.round(((median - input.rent) / median) * 100) : 0;

  return {
    score: total,
    verdict,
    savingsPerMonth,
    savingsPct,
    median,
    isSuspicious,
    hasLeverage,
    leverageNote,
    components: {
      position: { score: Math.round(positionScore), max: 50 },
      range: { score: rangeScore, max: 20 },
      freshness: { score: freshnessScore, max: 15 },
      momentum: { score: momentumScore, max: 15 },
    },
    fairRange: (input.batchP25 != null && input.batchP75 != null)
      ? { low: input.batchP25, high: input.batchP75 }
      : null,
    trendContext: input.compositeTrend != null
      ? `${input.compositeTrend > 0 ? '+' : ''}${input.compositeTrend}% YoY`
      : null,
    walkScore: input.walkScore,
    isRentStabilized: input.isRentStabilized,
  };
}

/** Compute batch IQR for a given bedroom count from a set of listings */
export function computeBatchIQR(
  listings: { bedrooms?: number | null; rent: number }[],
  bedrooms: number,
): { median: number; p25: number | null; p75: number | null } {
  const rents = listings
    .filter(l => normalizeBedrooms(l.bedrooms) === bedrooms)
    .map(l => l.rent)
    .filter(r => r > 0)
    .sort((a, b) => a - b);

  if (rents.length === 0) return { median: 0, p25: null, p75: null };
  if (rents.length < 4) {
    return { median: rents[Math.floor(rents.length / 2)], p25: null, p75: null };
  }

  return {
    median: rents[Math.floor(rents.length / 2)],
    p25: rents[Math.floor(rents.length * 0.25)],
    p75: rents[Math.floor(rents.length * 0.75)],
  };
}

/** Build a Zillow search URL from a formatted address */
export function zillowUrl(address: string, zip = '10003'): string {
  const slug = address
    .replace(/[,#]/g, '')
    .replace(/\s+/g, '-');
  return `https://www.zillow.com/homes/${slug}-New-York-NY-${zip}_rb/`;
}
