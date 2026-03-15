// ─── RenewalReply Fairness Score™ ───
// 0-100 composite score from 4 weighted components

export interface FairnessScoreInput {
  increasePct: number;         // User's increase %
  marketYoY: number;           // Area YoY trend %
  proposedRent: number;        // New rent after increase
  currentRent: number;         // Current rent before increase
  compMedian: number | null;   // Rentcast comp median
  compCount?: number;          // Number of filtered comps (controls Component 2 weight)
  fmr: number;                 // HUD FMR for bedroom count
  zillowMonthly: number | null; // Monthly rent trend %
  hvd?: 'rising' | 'falling' | 'flat' | null; // ZHVI home value direction (fallback for Component 4)
  alYoY?: number | null;       // Apartment List YoY rent growth % (fallback for Component 1)
  alMoM?: number | null;       // Apartment List MoM rent growth % (fallback for Component 4)
  bedroomCount?: number;       // 0-4 (studio=0, 1br=1, etc.)
  f50?: number[] | null;       // HUD 50th percentile rents [studio, 1br, 2br, 3br, 4br]
  rcMedianRent?: number | null;   // Rentcast /markets median rent for bedroom count
  rcTotalListings?: number | null; // Rentcast /markets total active listings
  compositeTrend?: number | null;  // From calculateCompositeTrend (preferred for Component 1)
  buildingMedian?: number | null;  // Median rent of same-building comps
  buildingCompCount?: number | null; // Number of same-building comps with rent data
  sameLineMedian?: number | null;  // Median rent of same-unit-line comps
  allSameBuilding?: boolean;       // Whether all comps are from the same building
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
  extremeIncreaseCeilingApplied?: boolean;
}

// Component 1: Increase Rate vs Area Trend (35 pts base)
function scoreRateVsTrend(increasePct: number, marketYoY: number, alYoY?: number | null, maxPts: number = 35, compositeTrend?: number | null): ScoreComponent {
  const effectiveYoY = (compositeTrend !== null && compositeTrend !== undefined)
    ? compositeTrend
    : (alYoY !== null && alYoY !== undefined) ? alYoY : marketYoY;
  const diff = increasePct - effectiveYoY;
  let rawScore: number;
  if (diff <= 0) rawScore = 35;
  else if (diff <= 3) rawScore = 35 - (diff / 3) * 12;
  else if (diff <= 6) rawScore = 23 - ((diff - 3) / 3) * 11;
  else if (diff <= 10) rawScore = 12 - ((diff - 6) / 4) * 12;
  else rawScore = 0;
  const score = Math.round((rawScore / 35) * maxPts);
  const sourceNote = (compositeTrend !== null && compositeTrend !== undefined) ? ' (composite)' : (alYoY !== null && alYoY !== undefined) ? ' (Apartment List)' : '';
  return { id: 'rate', label: `Increase vs. Area Trend${sourceNote}`, score, max: maxPts, estimated: false };
}

// Component 2: Proposed Rent vs Comp Median (30 pts base)
function scoreVsComps(proposedRent: number, compMedian: number | null, maxPts: number = 30, buildingMedian?: number | null, buildingCompCount?: number | null, sameLineMedian?: number | null, currentRent?: number | null): ScoreComponent {
  if (maxPts === 0) {
    return { id: 'comps', label: 'Rent vs. Nearby Listings', score: 0, max: 0, estimated: true };
  }

  // Determine effective reference rent: same-line > building (non-premium) > blended > area comps
  let effectiveMedian: number | null = compMedian;
  let label = 'Rent vs. Nearby Listings';
  const bcc = buildingCompCount ?? 0;
  const isPremium = buildingMedian != null && buildingMedian > 0 && currentRent != null && currentRent > buildingMedian * 1.20;

  if (sameLineMedian != null && sameLineMedian > 0) {
    effectiveMedian = sameLineMedian;
    label = 'Rent vs. Same Unit Line';
  } else if (buildingMedian != null && buildingMedian > 0 && !isPremium) {
    if (bcc >= 3) {
      effectiveMedian = buildingMedian;
      label = 'Rent vs. Your Building';
    } else if (bcc >= 2 && compMedian != null) {
      effectiveMedian = buildingMedian * 0.6 + compMedian * 0.4;
      label = 'Rent vs. Nearby Listings';
    } else if (bcc >= 2) {
      effectiveMedian = buildingMedian;
      label = 'Rent vs. Your Building';
    }
    // bcc < 2: ignore building data, use compMedian as-is
  }
  // For premium units, skip building data entirely → use compMedian (area-level)

  if (effectiveMedian === null) {
    return { id: 'comps', label, score: Math.round((18 / 30) * maxPts), max: maxPts, estimated: true };
  }
  const ratio = (proposedRent - effectiveMedian) / effectiveMedian;
  let rawScore: number;
  if (ratio <= 0) rawScore = 30;
  else if (ratio <= 0.10) rawScore = 30 - (ratio / 0.10) * 8;
  else if (ratio <= 0.20) rawScore = 22 - ((ratio - 0.10) / 0.10) * 10;
  else if (ratio <= 0.30) rawScore = 12 - ((ratio - 0.20) / 0.10) * 12;
  else rawScore = 0;
  const score = Math.round((rawScore / 30) * maxPts);
  return { id: 'comps', label, score, max: maxPts, estimated: false };
}

// Component 3: Increase Reasonableness (25 pts)
function scoreVsFmr(proposedRent: number, fmr: number, currentRent: number, increasePct: number, marketYoY?: number, f50?: number[] | null, bedroomCount?: number, rcMedianRent?: number | null, rcTotalListings?: number | null): ScoreComponent {
  let label = 'Increase Reasonableness';
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
  upper = Math.max(upper, fmr);
  if (currentRent >= upper) {
    const isFalling = (marketYoY ?? 0) < -0.5;
    let score: number;
    if (isFalling) {
      if (increasePct <= 0) score = 25;
      else if (increasePct <= 2) score = 25 - (increasePct / 2) * 2;
      else if (increasePct <= 4) score = 23 - ((increasePct - 2) / 2) * 8;
      else if (increasePct <= 7) score = 15 - ((increasePct - 4) / 3) * 9;
      else if (increasePct <= 10) score = 6 - ((increasePct - 7) / 3) * 6;
      else score = 0;
    } else {
      if (increasePct <= 0) score = 25;
      else if (increasePct <= 3) score = 25 - (increasePct / 3) * 2;
      else if (increasePct <= 6) score = 23 - ((increasePct - 3) / 3) * 8;
      else if (increasePct <= 10) score = 15 - ((increasePct - 6) / 4) * 9;
      else if (increasePct <= 14) score = 6 - ((increasePct - 10) / 4) * 6;
      else score = 0;
    }
    score = Math.round(score);
    return { id: 'fmr', label, score, max: 25, estimated: false };
  }
  let score: number;
  if (proposedRent <= upper) {
    score = 25;
  } else {
    const above = (proposedRent - upper) / upper;
    if (above <= 0) score = 25;
    else if (above <= 0.10) score = 25 - (above / 0.10) * 10;
    else if (above <= 0.25) score = 15 - ((above - 0.10) / 0.15) * 9;
    else if (above <= 0.35) score = 6 - ((above - 0.25) / 0.10) * 6;
    else score = 0;
  }
  score = Math.round(score);
  return { id: 'fmr', label, score, max: 25, estimated: false };
}

// Component 4: Market Momentum (10 pts)
function scoreMarketMomentum(zillowMonthly: number | null, alMoM?: number | null, hvd?: 'rising' | 'falling' | 'flat' | null): ScoreComponent {
  if (zillowMonthly !== null && zillowMonthly !== undefined) {
    let score: number;
    if (zillowMonthly <= 0) score = 10;
    else if (zillowMonthly <= 0.30) score = 10 - (zillowMonthly / 0.30) * 3;
    else if (zillowMonthly <= 0.80) score = 7 - ((zillowMonthly - 0.30) / 0.50) * 4;
    else score = 3;
    score = Math.round(score);
    return { id: 'momentum', label: 'Market Momentum', score, max: 10, estimated: false };
  }
  if (alMoM !== null && alMoM !== undefined) {
    let score: number;
    if (alMoM <= -0.3) score = 10;
    else if (alMoM <= 0) score = 10 - ((alMoM + 0.3) / 0.3) * 2;
    else if (alMoM <= 0.3) score = 8 - (alMoM / 0.3) * 3;
    else if (alMoM <= 0.6) score = 5 - ((alMoM - 0.3) / 0.3) * 2;
    else if (alMoM <= 1.0) score = 3 - ((alMoM - 0.6) / 0.4) * 2;
    else score = 1;
    score = Math.round(score);
    return { id: 'momentum', label: 'Market Momentum (Apartment List)', score, max: 10, estimated: true };
  }
  if (hvd) {
    const hvdScore = hvd === 'falling' ? 8 : hvd === 'flat' ? 5 : 3;
    return { id: 'momentum', label: 'Market Momentum (home value proxy)', score: hvdScore, max: 10, estimated: true };
  }
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
  // Input validation
  if (input.proposedRent <= 0 || input.currentRent <= 0) {
    return {
      total: 50,
      tier: 'moderate',
      tierLabel: 'Moderate',
      tierColor: 'text-accent-amber',
      tierColorHsl: '38 85% 36%',
      tierMessage: 'We couldn\'t fully validate your inputs. The score shown is a neutral default.',
      components: [],
    };
  }

  // Clamp inputs to sane ranges
  const clampedIncreasePct = Math.max(0, Math.min(100, input.increasePct));
  const clampedMarketYoY = Math.max(-30, Math.min(30, input.marketYoY));

  // Sanitize compMedian
  let sanitizedCompMedian = input.compMedian;
  if (sanitizedCompMedian !== null && (sanitizedCompMedian < 200 || sanitizedCompMedian > 25000)) {
    sanitizedCompMedian = null;
  }

  const validatedInput = {
    ...input,
    increasePct: clampedIncreasePct,
    marketYoY: clampedMarketYoY,
    compMedian: sanitizedCompMedian,
  };

  // Dynamic weight redistribution based on comp count
  const cc = validatedInput.compCount ?? (validatedInput.compMedian !== null ? 5 : 0);
  let compMax: number;
  let rateMax: number;
  // Base weights: Rate=35, Comps=30, Reasonableness=25, Momentum=10 = 100
  if (cc >= 5) { compMax = 30; rateMax = 35; }
  else if (cc >= 3) { compMax = 18; rateMax = 47; }
  else if (cc >= 1) { compMax = 10; rateMax = 55; }
  else { compMax = 0; rateMax = 65; }

  // Premium rent tier: when currentRent > 2× FMR, comps are less reliable
  if (validatedInput.currentRent > validatedInput.fmr * 2.0 && compMax > 0) {
    const compReduction = Math.min(compMax, 10);
    compMax -= compReduction;
    rateMax += compReduction;
  }

  // ── Comp reliability discount ──
  // Discount comp weight when comps appear unrepresentative of the user's actual market tier.
  // Two independent trigger paths — either one reduces comp authority.
  const compToFmrRatio = (sanitizedCompMedian !== null && validatedInput.fmr > 0)
    ? sanitizedCompMedian / validatedInput.fmr
    : 0;
  const rentToCompRatio = (sanitizedCompMedian !== null && sanitizedCompMedian > 0)
    ? validatedInput.currentRent / sanitizedCompMedian
    : 1;

  // Path A: Comps diverge significantly from government data AND user's rent confirms mismatch
  const compsDivergent = compToFmrRatio > 1.8 && rentToCompRatio < 0.75;

  // Path B: All comps from same building, thin count, and user paying notably less
  const allSameBuilding = validatedInput.allSameBuilding ?? false;
  const thinSameBuilding = allSameBuilding && cc < 5 && rentToCompRatio < 0.85;

  if ((compsDivergent || thinSameBuilding) && compMax > 0) {
    const compReduction = Math.round(compMax * 0.5);
    compMax -= compReduction;
    rateMax += compReduction;
  }


  const components = [
    scoreRateVsTrend(validatedInput.increasePct, validatedInput.marketYoY, validatedInput.alYoY, rateMax, validatedInput.compositeTrend),
    scoreVsComps(validatedInput.proposedRent, validatedInput.compMedian, compMax, validatedInput.buildingMedian, validatedInput.buildingCompCount, validatedInput.sameLineMedian, validatedInput.currentRent),
    scoreVsFmr(validatedInput.proposedRent, validatedInput.fmr, validatedInput.currentRent, validatedInput.increasePct, validatedInput.marketYoY, validatedInput.f50, validatedInput.bedroomCount, validatedInput.rcMedianRent, validatedInput.rcTotalListings),
    scoreMarketMomentum(validatedInput.zillowMonthly, validatedInput.alMoM, validatedInput.hvd),
  ];
  const visibleComponents = components.filter(c => c.max > 0);
  const total = components.reduce((sum, c) => sum + c.score, 0);
  return { total, ...getTier(total), components: visibleComponents };
}

// Context-aware tier message that explains WHY the score landed where it did
export function getContextualTierMessage(
  result: FairnessScoreResult,
  increasePct: number,
  marketYoY: number,
  proposedRent: number,
  compMedian: number | null,
): string {
  const { tier } = result;
  const rateAboveTrend = increasePct - marketYoY;
  const rentBelowComps = compMedian !== null && proposedRent <= compMedian;

  switch (tier) {
    case 'excellent':
      if (increasePct <= 0) return 'Your rent is staying flat or dropping. Great deal.';
      if (increasePct < marketYoY) return `Your increase is below the ${marketYoY}% area trend. Strong position.`;
      return 'Your rent and increase are both well within market range.';

    case 'fair':
      if (rateAboveTrend > 2 && rentBelowComps) {
        return `Your ${increasePct}% increase is above the ${marketYoY}% trend, but your rent is still below what similar units nearby are charging. Overall: reasonable.`;
      }
      if (rateAboveTrend > 1.5) {
        return `Your increase is slightly above the local trend, but your rent level is still within the normal range for your area.`;
      }
      return 'Your increase is in line with what the local market is doing.';

    case 'moderate':
      if (rateAboveTrend > 4) {
        return `Your ${increasePct}% increase is well above the ${marketYoY}% area trend. You have room to negotiate.`;
      }
      return `Your increase is on the high side for your area. Consider negotiating.`;

    case 'unfair':
      return `Your increase significantly exceeds what the market data supports. We strongly recommend negotiating or exploring alternatives.`;

    case 'excessive':
      return `Your increase is far above market conditions. Negotiation or moving should be seriously considered.`;

    default:
      return result.tierMessage;
  }
}

// Map score to the old verdict system for backward compatibility
export function scoreToVerdict(score: number): 'below' | 'at-market' | 'above' {
  if (score >= 80) return 'below';
  if (score >= 60) return 'at-market';
  return 'above';
}
