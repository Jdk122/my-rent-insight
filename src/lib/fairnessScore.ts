// ─── RenewalReply Fairness Score™ ───
// 0-100 composite score from 5 weighted components

export interface FairnessScoreInput {
  increasePct: number;         // User's increase %
  marketYoY: number;           // Area YoY trend %
  proposedRent: number;        // New rent after increase
  compMedian: number | null;   // Rentcast comp median
  fmr: number;                 // HUD FMR for bedroom count
  medianIncome: number | null; // Census ACS median renter income
  zillowMonthly: number | null; // Monthly rent trend %
}

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
function scoreRateVsTrend(increasePct: number, marketYoY: number): ScoreComponent {
  const diff = increasePct - marketYoY;
  let score: number;
  if (diff <= 0) score = 30;
  else if (diff <= 3) score = 20;
  else if (diff <= 6) score = 10;
  else score = 0;
  return { id: 'rate', label: 'Increase vs. Area Trend', score, max: 30, estimated: false };
}

// Component 2: Proposed Rent vs Comp Median (25 pts)
function scoreVsComps(proposedRent: number, compMedian: number | null): ScoreComponent {
  if (compMedian === null) {
    return { id: 'comps', label: 'Rent vs. Nearby Listings', score: 15, max: 25, estimated: true };
  }
  const ratio = (proposedRent - compMedian) / compMedian;
  let score: number;
  if (ratio <= 0) score = 25;
  else if (ratio <= 0.10) score = 18;
  else if (ratio <= 0.20) score = 10;
  else score = 0;
  return { id: 'comps', label: 'Rent vs. Nearby Listings', score, max: 25, estimated: false };
}

// Component 3: Proposed Rent vs HUD FMR (20 pts)
function scoreVsFmr(proposedRent: number, fmr: number): ScoreComponent {
  const upper = fmr * 1.15;
  let score: number;
  if (proposedRent <= upper) score = 20;
  else {
    const above = (proposedRent - upper) / upper;
    if (above <= 0.10) score = 12;
    else if (above <= 0.25) score = 5;
    else score = 0;
  }
  return { id: 'fmr', label: 'Rent vs. HUD Benchmark', score, max: 20, estimated: false };
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
function scoreMarketMomentum(zillowMonthly: number | null): ScoreComponent {
  const monthly = zillowMonthly ?? 0;
  let score: number;
  if (monthly <= 0) score = 10;
  else if (monthly <= 0.30) score = 7;
  else score = 3;
  return { id: 'momentum', label: 'Market Momentum', score, max: 10, estimated: zillowMonthly === null };
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
  const components = [
    scoreRateVsTrend(input.increasePct, input.marketYoY),
    scoreVsComps(input.proposedRent, input.compMedian),
    scoreVsFmr(input.proposedRent, input.fmr),
    scoreRentToIncome(input.proposedRent, input.medianIncome),
    scoreMarketMomentum(input.zillowMonthly),
  ];
  const total = components.reduce((sum, c) => sum + c.score, 0);
  return { total, ...getTier(total), components };
}

// Map score to the old verdict system for backward compatibility
export function scoreToVerdict(score: number): 'below' | 'at-market' | 'above' {
  if (score >= 80) return 'below';
  if (score >= 60) return 'at-market';
  return 'above';
}
