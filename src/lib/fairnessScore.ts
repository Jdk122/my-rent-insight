// ─── RenewalReply Fairness Score™ v2.3 ───
// Confidence-weighted model with continuous interpolation.
// Local comp data drives the score when available;
// HUD/federal benchmarks serve as fallback scaffolding when local data is thin.

import { CompConfidenceResult } from '@/lib/compConfidence';

export interface FairnessScoreInput {
  increasePct: number;         // User's increase %
  marketYoY: number;           // Area YoY trend %
  proposedRent: number;        // New rent after increase
  currentRent: number;         // Current rent before increase
  compMedian: number | null;   // Rentcast comp median
  compCount?: number;          // Number of filtered comps
  fmr: number;                 // HUD FMR for bedroom count
  zillowMonthly: number | null; // Monthly rent trend %
  hvd?: 'rising' | 'falling' | 'flat' | null;
  alYoY?: number | null;       // Apartment List YoY rent growth %
  alMoM?: number | null;       // Apartment List MoM rent growth %
  bedroomCount?: number;       // 0-4 (studio=0, 1br=1, etc.)
  f50?: number[] | null;       // HUD 50th percentile rents [studio, 1br, 2br, 3br, 4br]
  rcMedianRent?: number | null;   // Rentcast /markets median rent for bedroom count
  rcTotalListings?: number | null; // Rentcast /markets total active listings
  compositeTrend?: number | null;  // From calculateCompositeTrend
  buildingMedian?: number | null;  // Median rent of same-building comps
  buildingCompCount?: number | null; // Number of same-building comps with rent data
  sameLineMedian?: number | null;  // Median rent of same-unit-line comps
  allSameBuilding?: boolean;       // Whether all comps are from the same building
  // v2.3 additions
  compConfidence?: CompConfidenceResult | null; // Pre-computed comp confidence
  compP25?: number | null;         // 25th percentile of filtered comps
  compP75?: number | null;         // 75th percentile of filtered comps
  compIqrRatio?: number | null;    // IQR / median ratio
  zoriZipRent?: number | null;     // ZORI rent level (zip-level) for market tier detection
  comps?: any[] | null;            // Filtered comps array (for building influence check)
}

// Tooltip explainer for the Market Ceiling Check component
export const FMR_COMPONENT_TOOLTIP = 'Checks whether your proposed rent exceeds the ceiling implied by local market data and federal benchmarks. When local listing data is strong, the ceiling is driven by actual asking rents in your area.';

export interface ScoreComponent {
  id: string;
  label: string;
  score: number;
  max: number;
  estimated: boolean;
}

export type PriceLevelBand = 'below-market' | 'near-market' | 'above-market';

export interface FairnessScoreResult {
  total: number;
  tier: 'excellent' | 'fair' | 'moderate' | 'unfair' | 'excessive';
  tierLabel: string;
  tierColor: string;
  tierColorHsl: string;
  tierMessage: string;
  components: ScoreComponent[];
  extremeIncreaseCeilingApplied?: boolean;
  // v2.3 additions
  priceLevel?: PriceLevelBand | null;
  priceLevelLabel?: string | null;
  scoreBasisMessage?: string | null;
  decoupledMarketNote?: string | null;
  compConfidenceScore?: number;
  compConfidenceUiBand?: 'Low' | 'Medium' | 'High';
  softGoodValueFloorApplied?: boolean;
  buildingEchoChamberNote?: string | null;
}

// ─── Component 1: Increase Rate vs Area Trend ───
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
  return { id: 'rate', label: `Your Increase vs. Market Trend${sourceNote}`, score, max: maxPts, estimated: false };
}

// ─── Component 2: Proposed Rent vs Comp Median ───
function scoreVsComps(proposedRent: number, compMedian: number | null, maxPts: number = 30, buildingMedian?: number | null, buildingCompCount?: number | null, sameLineMedian?: number | null, currentRent?: number | null): ScoreComponent {
  if (maxPts === 0) {
    return { id: 'comps', label: 'Your Rent vs. Local Comps', score: 0, max: 0, estimated: true };
  }

  let effectiveMedian: number | null = compMedian;
  let label = 'Your Rent vs. Local Comps';
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
      label = 'Your Rent vs. Local Comps';
    } else if (bcc >= 2) {
      effectiveMedian = buildingMedian;
      label = 'Rent vs. Your Building';
    }
  }

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

// ─── Component 3: Market Ceiling Check (v2.3 redesign) ───
//
// This component checks whether the proposed rent exceeds the appropriate ceiling.
// The ceiling source depends on market tier ratio and comp confidence.

interface CeilingContext {
  proposedRent: number;
  fmr: number;
  currentRent: number;
  increasePct: number;
  marketYoY?: number;
  f50?: number[] | null;
  bedroomCount?: number;
  rcMedianRent?: number | null;
  rcTotalListings?: number | null;
  maxPts: number;
  // v2.3
  compP75?: number | null;
  zoriZipRent?: number | null;
  compConfidence?: CompConfidenceResult | null;
}

/**
 * Compute the local market median for market tier detection.
 * Returns null if neither rcMedianRent nor zoriZipRent is available.
 */
function getLocalMarketMedian(rcMedianRent?: number | null, zoriZipRent?: number | null): number | null {
  if (rcMedianRent != null && rcMedianRent > 0) return rcMedianRent;
  if (zoriZipRent != null && zoriZipRent > 0) return zoriZipRent;
  return null;
}

/**
 * Compute marketTierRatio = localMarketMedian / max(f50[br], fmr * 1.15)
 */
function getMarketTierRatio(
  localMarketMedian: number | null,
  fmr: number,
  f50?: number[] | null,
  bedroomCount?: number,
): number | null {
  if (localMarketMedian === null) return null;
  let benchmark = fmr * 1.15;
  if (f50 && bedroomCount !== undefined && bedroomCount >= 0 && bedroomCount <= 4 && f50[bedroomCount] > 0) {
    benchmark = Math.max(f50[bedroomCount], benchmark);
  }
  if (benchmark <= 0) return null;
  return localMarketMedian / benchmark;
}

type MarketState = 'aligned' | 'drifting' | 'decoupled' | 'no-medians';

function classifyMarketState(ratio: number | null): MarketState {
  if (ratio === null) return 'no-medians';
  if (ratio < 1.20) return 'aligned';
  if (ratio <= 1.50) return 'drifting';
  return 'decoupled';
}

function scoreCeilingCheck(ctx: CeilingContext): ScoreComponent {
  const label = 'Market Ceiling Check';

  // Compute local market median and market tier ratio
  const localMarketMedian = getLocalMarketMedian(ctx.rcMedianRent, ctx.zoriZipRent);
  const marketTierRatio = getMarketTierRatio(localMarketMedian, ctx.fmr, ctx.f50, ctx.bedroomCount);
  const marketState = classifyMarketState(marketTierRatio);

  const isHighConf = ctx.compConfidence?.engineHighConfidence ?? false;

  // ── Compute upper bounds ──
  // benchmarkBased: current hierarchy (rcMedianRent if 10+ listings → f50[br] → fmr * 1.15)
  let benchmarkBased: number;
  if (ctx.rcMedianRent != null && ctx.rcTotalListings != null && ctx.rcTotalListings >= 10) {
    benchmarkBased = ctx.rcMedianRent;
  } else if (ctx.f50 && ctx.bedroomCount !== undefined && ctx.bedroomCount >= 0 && ctx.bedroomCount <= 4 && ctx.f50[ctx.bedroomCount] > 0) {
    benchmarkBased = ctx.f50[ctx.bedroomCount];
  } else {
    benchmarkBased = ctx.fmr * 1.15;
  }
  benchmarkBased = Math.max(benchmarkBased, ctx.fmr);

  // compDerived: min(compP75 * 1.10, max(rcMedianRent, zoriZip) * 1.20)
  // Only computable when at least one market median exists
  let compDerived: number | null = null;
  if (localMarketMedian !== null && ctx.compP75 != null && ctx.compP75 > 0) {
    compDerived = Math.min(ctx.compP75 * 1.10, localMarketMedian * 1.20);
  }

  // blended: 0.5 * compDerived + 0.5 * benchmarkBased
  let blended: number | null = null;
  if (compDerived !== null) {
    blended = 0.5 * compDerived + 0.5 * benchmarkBased;
  }

  // ── Select upper bound per decision matrix ──
  let upper: number;
  switch (marketState) {
    case 'aligned':
      upper = isHighConf && blended !== null ? blended : benchmarkBased;
      break;
    case 'drifting':
      upper = blended !== null ? blended : benchmarkBased;
      break;
    case 'decoupled':
      upper = isHighConf && compDerived !== null ? compDerived
        : blended !== null ? blended
        : benchmarkBased;
      break;
    case 'no-medians':
    default:
      upper = benchmarkBased;
      break;
  }

  upper = Math.max(upper, ctx.fmr);

  // ── Score using existing penalty decay curve ──
  if (ctx.currentRent >= upper) {
    // Already above upper bound: score based on increase rate alone
    const isFalling = (ctx.marketYoY ?? 0) < -0.5;
    let rawScore: number;
    if (isFalling) {
      if (ctx.increasePct <= 0) rawScore = 25;
      else if (ctx.increasePct <= 2) rawScore = 25 - (ctx.increasePct / 2) * 2;
      else if (ctx.increasePct <= 4) rawScore = 23 - ((ctx.increasePct - 2) / 2) * 8;
      else if (ctx.increasePct <= 7) rawScore = 15 - ((ctx.increasePct - 4) / 3) * 9;
      else if (ctx.increasePct <= 10) rawScore = 6 - ((ctx.increasePct - 7) / 3) * 6;
      else rawScore = 0;
    } else {
      if (ctx.increasePct <= 0) rawScore = 25;
      else if (ctx.increasePct <= 3) rawScore = 25 - (ctx.increasePct / 3) * 2;
      else if (ctx.increasePct <= 6) rawScore = 23 - ((ctx.increasePct - 3) / 3) * 8;
      else if (ctx.increasePct <= 10) rawScore = 15 - ((ctx.increasePct - 6) / 4) * 9;
      else if (ctx.increasePct <= 14) rawScore = 6 - ((ctx.increasePct - 10) / 4) * 6;
      else rawScore = 0;
    }
    const score = Math.round((rawScore / 25) * ctx.maxPts);
    return { id: 'fmr', label, score, max: ctx.maxPts, estimated: false };
  }

  // Below upper: score based on how far proposed rent exceeds it
  let rawScore: number;
  if (ctx.proposedRent <= upper) {
    rawScore = 25;
  } else {
    const above = (ctx.proposedRent - upper) / upper;
    if (above <= 0) rawScore = 25;
    else if (above <= 0.10) rawScore = 25 - (above / 0.10) * 10;
    else if (above <= 0.25) rawScore = 15 - ((above - 0.10) / 0.15) * 9;
    else if (above <= 0.35) rawScore = 6 - ((above - 0.25) / 0.10) * 6;
    else rawScore = 0;
  }
  const score = Math.round((rawScore / 25) * ctx.maxPts);
  return { id: 'fmr', label, score, max: ctx.maxPts, estimated: false };
}

// ─── Component 4: Market Momentum ───
function scoreMarketMomentum(zillowMonthly: number | null, alMoM?: number | null, hvd?: 'rising' | 'falling' | 'flat' | null): ScoreComponent {
  if (zillowMonthly !== null && zillowMonthly !== undefined) {
    let score: number;
    if (zillowMonthly <= 0) score = 10;
    else if (zillowMonthly <= 0.30) score = 10 - (zillowMonthly / 0.30) * 3;
    else if (zillowMonthly <= 0.80) score = 7 - ((zillowMonthly - 0.30) / 0.50) * 4;
    else score = 3;
    score = Math.round(score);
    return { id: 'momentum', label: 'Market Direction', score, max: 10, estimated: false };
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
    return { id: 'momentum', label: 'Market Direction (Apartment List)', score, max: 10, estimated: true };
  }
  if (hvd) {
    const hvdScore = hvd === 'falling' ? 8 : hvd === 'flat' ? 5 : 3;
    return { id: 'momentum', label: 'Market Direction (home value proxy)', score: hvdScore, max: 10, estimated: true };
  }
  return { id: 'momentum', label: 'Market Direction', score: 5, max: 10, estimated: true };
}

// ─── Tier thresholds ───
function getTier(total: number): Pick<FairnessScoreResult, 'tier' | 'tierLabel' | 'tierColor' | 'tierColorHsl' | 'tierMessage'> {
  if (total >= 80) return {
    tier: 'excellent', tierLabel: 'Good Deal', tierColor: 'text-verdict-good',
    tierColorHsl: '152 50% 33%',
    tierMessage: 'Your increase is very fair. Renewing is a solid decision.',
  };
  if (total >= 60) return {
    tier: 'fair', tierLabel: 'At Market', tierColor: 'text-verdict-fair',
    tierColorHsl: '80 55% 40%',
    tierMessage: 'Your increase is within a reasonable range for your area.',
  };
  if (total >= 40) return {
    tier: 'moderate', tierLabel: 'Above Trend', tierColor: 'text-accent-amber',
    tierColorHsl: '38 85% 36%',
    tierMessage: 'Your increase is on the high side. You may have room to negotiate.',
  };
  if (total >= 20) return {
    tier: 'unfair', tierLabel: 'Overpaying', tierColor: 'text-destructive',
    tierColorHsl: '15 65% 46%',
    tierMessage: 'Your increase significantly exceeds market conditions. We recommend negotiating.',
  };
  return {
    tier: 'excessive', tierLabel: 'Overpaying', tierColor: 'text-destructive',
    tierColorHsl: '6 60% 46%',
    tierMessage: 'Your increase is well above what the data supports. Negotiation or exploring other options is strongly recommended.',
  };
}

// ─── Price Level Badge ───
function computePriceLevel(
  proposedRent: number,
  compP25: number | null,
  compP75: number | null,
  compCount: number,
  rcMedianRent: number | null,
  zoriZipRent: number | null,
  f50: number[] | null,
  bedroomCount: number | undefined,
  fmr: number,
): { band: PriceLevelBand; label: string } | null {
  if (compCount >= 3 && compP25 != null && compP75 != null) {
    if (proposedRent < compP25) return { band: 'below-market', label: 'Below Market' };
    if (proposedRent <= compP75) return { band: 'near-market', label: 'Near Market' };
    return { band: 'above-market', label: 'Above Market' };
  }
  // Thin comps: compare to best available reference
  const ref = Math.max(
    rcMedianRent ?? 0,
    zoriZipRent ?? 0,
    (f50 && bedroomCount !== undefined && bedroomCount >= 0 && bedroomCount <= 4) ? (f50[bedroomCount] ?? 0) : 0,
    fmr * 1.15,
  );
  if (ref <= 0) return null;
  if (proposedRent < ref * 0.90) return { band: 'below-market', label: 'Below Market' };
  if (proposedRent <= ref * 1.10) return { band: 'near-market', label: 'Near Market' };
  return { band: 'above-market', label: 'Above Market' };
}

// ─── Score Basis Attribution ───
function getScoreBasisMessage(
  compConfidence: CompConfidenceResult | null | undefined,
  compCount: number,
  buildingCompCount: number,
): string {
  // Engine confidence threshold (55) and UI display threshold (61) are intentionally different.
  // Engine: gradual behavioral shifts start at 55 (aligned with minimum-count gate cap of 54).
  // UI: "High" label only shown at 61+ for user-facing credibility.
  // Do not unify these without reviewing the full spec.
  const uiBand = compConfidence?.uiBand ?? 'Low';
  if (uiBand === 'High') {
    const bldgNote = buildingCompCount > 0 ? ` including ${buildingCompCount} in your building` : '';
    return `Based on ${compCount} nearby listings${bldgNote}.`;
  }
  if (uiBand === 'Medium' || (uiBand === 'Low' && compCount >= 5)) {
    // Even if confidence score is low (e.g. distant or high-variance comps),
    // 5+ comps should still mention listings rather than only federal benchmarks.
    return `Based on ${compCount} nearby listings and regional rent trend data.`;
  }
  if (compCount > 0) {
    return `Based on ${compCount} nearby listings, federal rent benchmarks, and regional trends.`;
  }
  return 'Based primarily on federal rent benchmarks and regional trends.';
}

// ─── Decoupled Market Note ───
function getDecoupledMarketNote(
  marketTierRatio: number | null,
  fmr: number,
  localMarketMedian: number | null,
): string | null {
  if (marketTierRatio === null || marketTierRatio <= 1.50) return null;
  if (localMarketMedian === null) return null;
  const fmtN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `Federal fair-market benchmarks ($${fmtN(fmr)}) are significantly below actual asking rents in your area ($${fmtN(localMarketMedian)} median). Your score reflects live local market conditions.`;
}

// ═══════════════════════════════════════════════════════════════
// Main scoring function — v2.3
// ═══════════════════════════════════════════════════════════════

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

  const cc = validatedInput.compCount ?? (validatedInput.compMedian !== null ? 5 : 0);
  const conf = validatedInput.compConfidence?.score ?? 0;
  const isHighConf = validatedInput.compConfidence?.engineHighConfidence ?? false;

  // ── v2.3: Continuous Weight Interpolation ──
  // Weights interpolate linearly across compConfidence 0–100:
  //   Component 2 (Local Position): 15 + (conf/100) * 30
  //   Component 3 (Ceiling Check):  40 - (conf/100) * 25
  //   Component 1 (Rate vs Trend):  35 - (conf/100) * 5
  //   Component 4 (Momentum):       10 (fixed)
  // All four always sum to 100.
  let compMax = Math.round(15 + (conf / 100) * 30);
  let fmrMax = Math.round(40 - (conf / 100) * 25);
  let rateMax = Math.round(35 - (conf / 100) * 5);
  const momentumMax = 10;

  // Ensure they sum to 100 (rounding fix)
  const sumCheck = compMax + fmrMax + rateMax + momentumMax;
  if (sumCheck !== 100) {
    rateMax += (100 - sumCheck);
  }

  // ── v2.3: Revised Comp-Divergence Guardrail (Section 1B) ──
  // New trigger: compIQR/compMedian > 0.30 AND currentRent/compMedian < 0.70
  // Removes FMR dependency. Fires when comps have high variance AND user is significantly under.
  const compIqrRatio = validatedInput.compIqrRatio ?? null;
  const rentToCompRatio = (sanitizedCompMedian !== null && sanitizedCompMedian > 0)
    ? validatedInput.currentRent / sanitizedCompMedian
    : 1;

  const compsDivergent = compIqrRatio !== null && compIqrRatio > 0.30 && rentToCompRatio < 0.70;

  // ── v2.3: Single-Building Echo Chamber (Section 4D) ──
  const allSameBuilding = validatedInput.allSameBuilding ?? false;
  let buildingEchoChamberNote: string | null = null;

  // Trigger A: ALL comps from same building AND total < 5. Cap Component 2 at 60% of max if compConfidence < 40.
  if (allSameBuilding && cc < 5 && conf < 40) {
    compMax = Math.round(compMax * 0.6);
    rateMax = 100 - compMax - fmrMax - momentumMax;
    buildingEchoChamberNote = 'Most comparables are from your building. Score also reflects broader market data.';
  }

  // Trigger B: Building >70% influence, no same-line, total >= 5.
  // This penalty was already applied in compConfidence (-12 points),
  // which shifts interpolated weights. We surface the UI note here.
  if (cc >= 5 && !allSameBuilding && validatedInput.sameLineMedian == null) {
    // Check if building influence penalty was applied
    if (validatedInput.compConfidence?.breakdown?.['buildingHighInfluence'] === -12) {
      buildingEchoChamberNote = 'Most comparables are from your building. Score also reflects broader market data.';
    }
  }

  // Apply comp divergence reduction
  if (compsDivergent && compMax > 0) {
    const compReduction = Math.round(compMax * 0.4);
    compMax -= compReduction;
    rateMax += compReduction;
  }

  // ── Compute components ──
  const rateComponent = scoreRateVsTrend(validatedInput.increasePct, validatedInput.marketYoY, validatedInput.alYoY, rateMax, validatedInput.compositeTrend);

  const compsComponent = scoreVsComps(validatedInput.proposedRent, validatedInput.compMedian, compMax, validatedInput.buildingMedian, validatedInput.buildingCompCount, validatedInput.sameLineMedian, validatedInput.currentRent);

  const ceilingComponent = scoreCeilingCheck({
    proposedRent: validatedInput.proposedRent,
    fmr: validatedInput.fmr,
    currentRent: validatedInput.currentRent,
    increasePct: validatedInput.increasePct,
    marketYoY: validatedInput.marketYoY,
    f50: validatedInput.f50,
    bedroomCount: validatedInput.bedroomCount,
    rcMedianRent: validatedInput.rcMedianRent,
    rcTotalListings: validatedInput.rcTotalListings,
    maxPts: fmrMax,
    compP75: validatedInput.compP75,
    zoriZipRent: validatedInput.zoriZipRent,
    compConfidence: validatedInput.compConfidence,
  });

  const momentumComponent = scoreMarketMomentum(validatedInput.zillowMonthly, validatedInput.alMoM, validatedInput.hvd);

  const components = [rateComponent, compsComponent, ceilingComponent, momentumComponent];
  const visibleComponents = components.filter(c => c.max > 0);
  let total = components.reduce((sum, c) => sum + c.score, 0);

  // ═══ Guardrails ═══

  // 4A. Extreme Increase Ceiling (UNCHANGED — top-level override)
  const effectiveTrend = validatedInput.compositeTrend ?? validatedInput.marketYoY ?? 0;
  const rateGap = validatedInput.increasePct - effectiveTrend;

  let extremeIncreaseCeilingApplied = false;
  let ceiling: number | null = null;

  if (validatedInput.increasePct >= 25 && rateGap >= 20) {
    ceiling = 55;
  } else if (validatedInput.increasePct >= 15 && rateGap >= 10) {
    ceiling = 65;
  }

  if (ceiling !== null && total > ceiling) {
    total = Math.round(ceiling);
    extremeIncreaseCeilingApplied = true;
  }

  // 4B. Comp Contradiction Guardrail (UNCHANGED)
  const compComponent = components.find(c => c.id === 'comps');
  if (compComponent && compComponent.max >= 18) {
    const compPct = compComponent.score / compComponent.max;
    if (compPct < 0.40 && total >= 60) {
      total = Math.min(total, 59);
    } else if (compPct < 0.25 && total >= 40) {
      total = Math.min(total, 39);
    }
  }

  // 4E. Soft Good-Value Floor (NEW)
  // The soft good-value floor protects obvious under-market renewals from being
  // dragged down by rate-based components, but it is subordinate to ALL top-level
  // consumer-protection caps (extreme increase ceiling, comp contradiction cap).
  // Do not promote this to a top-level override.
  let softGoodValueFloorApplied = false;
  if (
    validatedInput.compP25 != null &&
    validatedInput.proposedRent <= validatedInput.compP25 &&
    isHighConf &&
    validatedInput.increasePct < 15 &&
    rateGap < 10
  ) {
    if (total < 65 && !extremeIncreaseCeilingApplied) {
      total = 65;
      softGoodValueFloorApplied = true;
    }
  }

  // 4F. Zero-Comp Rent Position (REVISED)
  if (cc < 3 && validatedInput.fmr > 0) {
    const zeroCompUpper = Math.max(
      validatedInput.rcMedianRent ?? 0,
      validatedInput.zoriZipRent ?? 0,
      (validatedInput.f50 && validatedInput.bedroomCount !== undefined && validatedInput.bedroomCount >= 0 && validatedInput.bedroomCount <= 4)
        ? (validatedInput.f50[validatedInput.bedroomCount] ?? 0)
        : 0,
      validatedInput.fmr * 1.15,
    );
    const rentAboveRatio = (validatedInput.currentRent - zeroCompUpper) / zeroCompUpper;
    if (rentAboveRatio > 0.50 && total >= 70) {
      total = Math.min(total, 69);
    } else if (rentAboveRatio > 0.30 && total >= 80) {
      total = Math.min(total, 79);
    }
  }

  // ═══ v2.3 UI Enrichments ═══

  // Price Level Badge
  const priceLevel = computePriceLevel(
    validatedInput.proposedRent,
    validatedInput.compP25 ?? null,
    validatedInput.compP75 ?? null,
    cc,
    validatedInput.rcMedianRent ?? null,
    validatedInput.zoriZipRent ?? null,
    validatedInput.f50 ?? null,
    validatedInput.bedroomCount,
    validatedInput.fmr,
  );

  // Score Basis Attribution
  const scoreBasisMessage = getScoreBasisMessage(
    validatedInput.compConfidence,
    cc,
    validatedInput.buildingCompCount ?? 0,
  );

  // Decoupled Market Note
  const localMarketMedian = getLocalMarketMedian(validatedInput.rcMedianRent, validatedInput.zoriZipRent);
  const marketTierRatio = getMarketTierRatio(localMarketMedian, validatedInput.fmr, validatedInput.f50, validatedInput.bedroomCount);
  const decoupledMarketNote = getDecoupledMarketNote(marketTierRatio, validatedInput.fmr, localMarketMedian);

  return {
    total,
    ...getTier(total),
    components: visibleComponents,
    extremeIncreaseCeilingApplied,
    priceLevel: priceLevel?.band ?? null,
    priceLevelLabel: priceLevel?.label ?? null,
    scoreBasisMessage,
    decoupledMarketNote,
    compConfidenceScore: validatedInput.compConfidence?.score ?? undefined,
    compConfidenceUiBand: validatedInput.compConfidence?.uiBand ?? undefined,
    softGoodValueFloorApplied,
    buildingEchoChamberNote: buildingEchoChamberNote,
  };
}

// Context-aware tier message
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

// Map score to verdict for backward compatibility
export function scoreToVerdict(score: number): 'below' | 'at-market' | 'above' {
  if (score >= 80) return 'below';
  if (score >= 60) return 'at-market';
  return 'above';
}
