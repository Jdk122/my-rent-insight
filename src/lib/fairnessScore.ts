// ─── RenewalReply Fairness Score™ ───
// 0-100 composite score from 5 weighted components

export interface FairnessScoreInput {
  increasePct: number;         // User's increase %
  marketYoY: number;           // Area YoY trend %
  proposedRent: number;        // New rent after increase
  currentRent: number;         // Current rent before increase
  compMedian: number | null;   // Rentcast comp median
  compCount?: number;          // Number of filtered comps (controls Component 2 weight)
  fmr: number;                 // HUD FMR for bedroom count
  medianIncome: number | null; // Census ACS median renter income
  zillowMonthly: number | null; // Monthly rent trend %
  hvd?: 'rising' | 'falling' | 'flat' | null; // ZHVI home value direction (fallback for Component 5)
  alYoY?: number | null;       // Apartment List YoY rent growth % (fallback for Component 1)
  alMoM?: number | null;       // Apartment List MoM rent growth % (fallback for Component 5)
  bedroomCount?: number;       // 0-4 (studio=0, 1br=1, etc.)
  f50?: number[] | null;       // HUD 50th percentile rents [studio, 1br, 2br, 3br, 4br]
  rcMedianRent?: number | null;   // Rentcast /markets median rent for bedroom count
  rcTotalListings?: number | null; // Rentcast /markets total active listings
}

// Tooltip explainer for the FMR/Increase Reasonableness component
export const FMR_COMPONENT_TOOLTIP = 'Evaluates whether your rent increase is reasonable relative to HUD reference rents for your area. When your rent already exceeds the reference level, we score based on the rate of increase instead.';

export interface ScoreComponent {
  id: string;
  label: string;
  score: number;
  max: number;
  estimated: boolean;
}

export interface FairnessScoreResult {
  total: number;
  tier: 'excellent' | 'fair' | 'moderate' | 'unfair' | 'excessive';
  tierLabel: string;
  tierColor: string;        // CSS color class
  tierColorHsl: string;     // HSL for gauge
  tierMessage: string;
  components: ScoreComponent[];
}

// Component 1: Increase Rate vs Area Trend (30 pts)
function scoreRateVsTrend(increasePct: number, marketYoY: number, alYoY?: number | null, maxPts: number = 30): ScoreComponent {
  // Priority: Apartment List transacted rents > existing marketYoY (ZORI/HUD)
  const effectiveYoY = (alYoY !== null && alYoY !== undefined) ? alYoY : marketYoY;
  const diff = increasePct - effectiveYoY;
  let rawScore: number;
  if (diff <= 0) rawScore = 30;
  else if (diff <= 3) rawScore = 20;
  else if (diff <= 6) rawScore = 10;
  else rawScore = 0;
  // Scale to adjusted max
  const score = Math.round((rawScore / 30) * maxPts);
  const sourceNote = (alYoY !== null && alYoY !== undefined) ? ' (Apartment List)' : '';
  return { id: 'rate', label: `Increase vs. Area Trend${sourceNote}`, score, max: maxPts, estimated: false };
}

// Component 2: Proposed Rent vs Comp Median (25 pts)
function scoreVsComps(proposedRent: number, compMedian: number | null, maxPts: number = 25): ScoreComponent {
  if (maxPts === 0) {
    return { id: 'comps', label: 'Rent vs. Nearby Listings', score: 0, max: 0, estimated: true };
  }
  if (compMedian === null) {
    // Neutral default scaled to adjusted max
    return { id: 'comps', label: 'Rent vs. Nearby Listings', score: Math.round((15 / 25) * maxPts), max: maxPts, estimated: true };
  }
  const ratio = (proposedRent - compMedian) / compMedian;
  let rawScore: number;
  if (ratio <= 0) rawScore = 25;
  else if (ratio <= 0.10) rawScore = 18;
  else if (ratio <= 0.20) rawScore = 10;
  else rawScore = 0;
  const score = Math.round((rawScore / 25) * maxPts);
  return { id: 'comps', label: 'Rent vs. Nearby Listings', score, max: maxPts, estimated: false };
}

// Component 3: Proposed Rent vs HUD FMR (20 pts)
// Compares the INCREASE portion vs FMR, not the absolute rent
// This avoids penalizing tenants in areas where market rents naturally exceed HUD benchmarks
function scoreVsFmr(proposedRent: number, fmr: number, currentRent: number, increasePct: number, marketYoY?: number, f50?: number[] | null, bedroomCount?: number, rcMedianRent?: number | null, rcTotalListings?: number | null): ScoreComponent {
  let label = 'Increase Reasonableness';
  // Priority 1: Rentcast live market median (if sufficient listings)
  // Priority 2: HUD 50th percentile (median) if available
  // Priority 3: FMR * 1.15
  let upper: number;
  let labelSuffix = '';
  if (rcMedianRent != null && rcTotalListings != null && rcTotalListings >= 10) {
    upper = rcMedianRent;
    labelSuffix = ' (live market data)';
  } else if (f50 && bedroomCount !== undefined && bedroomCount >= 0 && bedroomCount <= 4 && f50[bedroomCount] > 0) {
    upper = f50[bedroomCount];
    labelSuffix = ' (HUD median)';
  } else {
    upper = fmr * 1.15;
  }
  label += labelSuffix;
  // If current rent already exceeds upper, compare increase rate instead
  if (currentRent >= upper) {
    // FIX 4: Tighten breakpoints in declining markets
    const isFalling = (marketYoY ?? 0) < -0.5;
    if (isFalling) {
      if (increasePct <= 2) return { id: 'fmr', label, score: 18, max: 20, estimated: false };
      if (increasePct <= 4) return { id: 'fmr', label, score: 12, max: 20, estimated: false };
      if (increasePct <= 7) return { id: 'fmr', label, score: 5, max: 20, estimated: false };
      return { id: 'fmr', label, score: 0, max: 20, estimated: false };
    }
    // Flat/rising market — existing breakpoints
    if (increasePct <= 3) return { id: 'fmr', label, score: 18, max: 20, estimated: false };
    if (increasePct <= 6) return { id: 'fmr', label, score: 12, max: 20, estimated: false };
    if (increasePct <= 10) return { id: 'fmr', label, score: 5, max: 20, estimated: false };
    return { id: 'fmr', label, score: 0, max: 20, estimated: false };
  }
  let score: number;
  if (proposedRent <= upper) score = 20;
  else {
    const above = (proposedRent - upper) / upper;
    if (above <= 0.10) score = 12;
    else if (above <= 0.25) score = 5;
    else score = 0;
  }
  return { id: 'fmr', label, score, max: 20, estimated: false };
}

// Component 4: Rent-to-Income Ratio (15 pts)
function scoreRentToIncome(proposedRent: number, medianIncome: number | null): ScoreComponent {
  if (medianIncome === null) {
    return { id: 'income', label: 'Rent-to-Income Ratio', score: 8, max: 15, estimated: true };
  }
  const ratio = (proposedRent * 12) / medianIncome * 100;
  let score: number;
  if (ratio < 30) score = 15;
  else if (ratio < 40) score = 10;
  else if (ratio < 50) score = 5;
  else score = 0;
  return { id: 'income', label: 'Rent-to-Income Ratio', score, max: 15, estimated: false };
}

// Component 5: Market Momentum (10 pts)
function scoreMarketMomentum(zillowMonthly: number | null, alMoM?: number | null, hvd?: 'rising' | 'falling' | 'flat' | null): ScoreComponent {
  // Priority 1: ZORI rent trend data (most direct signal)
  if (zillowMonthly !== null && zillowMonthly !== undefined) {
    let score: number;
    if (zillowMonthly <= 0) score = 10;
    else if (zillowMonthly <= 0.30) score = 7;
    else score = 3;
    return { id: 'momentum', label: 'Market Momentum', score, max: 10, estimated: false };
  }
  // Priority 2: Apartment List MoM rent growth
  if (alMoM !== null && alMoM !== undefined) {
    let score: number;
    if (alMoM <= -0.3) score = 10;
    else if (alMoM <= 0) score = 8;
    else if (alMoM <= 0.3) score = 5;
    else if (alMoM <= 0.6) score = 3;
    else score = 1;
    return { id: 'momentum', label: 'Market Momentum (Apartment List)', score, max: 10, estimated: true };
  }
  // Priority 3: ZHVI home value direction (proxy for rent momentum)
  if (hvd) {
    const hvdScore = hvd === 'falling' ? 8 : hvd === 'flat' ? 5 : 3;
    return { id: 'momentum', label: 'Market Momentum (home value proxy)', score: hvdScore, max: 10, estimated: true };
  }
  // Priority 4: No data — neutral default
  return { id: 'momentum', label: 'Market Momentum', score: 5, max: 10, estimated: true };
}

// Tier thresholds
function getTier(total: number): Pick<FairnessScoreResult, 'tier' | 'tierLabel' | 'tierColor' | 'tierColorHsl' | 'tierMessage'> {
  if (total >= 80) return {
    tier: 'excellent', tierLabel: 'Excellent', tierColor: 'text-verdict-good',
    tierColorHsl: '152 50% 33%',
    tierMessage: 'Your increase is very fair. Renewing is a solid decision.',
  };
  if (total >= 60) return {
    tier: 'fair', tierLabel: 'Fair', tierColor: 'text-verdict-fair',
    tierColorHsl: '80 55% 40%',
    tierMessage: 'Your increase is within a reasonable range for your area.',
  };
  if (total >= 40) return {
    tier: 'moderate', tierLabel: 'Moderate', tierColor: 'text-accent-amber',
    tierColorHsl: '38 85% 36%',
    tierMessage: 'Your increase is on the high side. You may have room to negotiate.',
  };
  if (total >= 20) return {
    tier: 'unfair', tierLabel: 'Unfair', tierColor: 'text-destructive',
    tierColorHsl: '15 65% 46%',
    tierMessage: 'Your increase significantly exceeds market conditions. We recommend negotiating.',
  };
  return {
    tier: 'excessive', tierLabel: 'Excessive', tierColor: 'text-destructive',
    tierColorHsl: '6 60% 46%',
    tierMessage: 'Your increase is well above what the data supports. Negotiation or exploring other options is strongly recommended.',
  };
}

export function calculateFairnessScore(input: FairnessScoreInput): FairnessScoreResult {
  // Dynamic weight redistribution based on comp count
  const cc = input.compCount ?? (input.compMedian !== null ? 5 : 0); // default: assume good comps if median exists
  let compMax: number;
  let rateMax: number;
  if (cc >= 5) { compMax = 25; rateMax = 30; }
  else if (cc >= 3) { compMax = 15; rateMax = 40; }
  else if (cc >= 1) { compMax = 8; rateMax = 47; }
  else { compMax = 0; rateMax = 55; }

  const components = [
    scoreRateVsTrend(input.increasePct, input.marketYoY, input.alYoY, rateMax),
    scoreVsComps(input.proposedRent, input.compMedian, compMax),
    scoreVsFmr(input.proposedRent, input.fmr, input.currentRent, input.increasePct, input.marketYoY, input.f50, input.bedroomCount, input.rcMedianRent, input.rcTotalListings),
    scoreRentToIncome(input.proposedRent, input.medianIncome),
    scoreMarketMomentum(input.zillowMonthly, input.alMoM, input.hvd),
  ];
  // Filter out 0-max components from display
  const visibleComponents = components.filter(c => c.max > 0);
  const total = components.reduce((sum, c) => sum + c.score, 0);
  return { total, ...getTier(total), components: visibleComponents };
}

// Map score to the old verdict system for backward compatibility
export function scoreToVerdict(score: number): 'below' | 'at-market' | 'above' {
  if (score >= 80) return 'below';
  if (score >= 60) return 'at-market';
  return 'above';
}
