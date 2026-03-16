/**
 * Comp Confidence Score (0–100)
 * Pure function that evaluates how much we should trust local comp data.
 * Used by the fairness score engine to interpolate component weights.
 *
 * v2.3 — Fairness Score redesign
 */

import type { RentcastComparable } from '@/hooks/useRentcast';
import { normalizeBaseAddress } from '@/lib/compTiering';

export interface CompConfidenceInput {
  /** Filtered comps (after outlier removal, seasonal adjustment) */
  comps: RentcastComparable[];
  /** Subject property address (for building matching) */
  subjectAddress: string | null;
  /** Number of same-unit-line comps with rent data */
  sameLineCompCount: number;
  /** Number of same-building comps with rent data */
  buildingCompCount: number;
  /** Number of bedroom-matched same-building comps */
  buildingBedroomMatchCount: number;
  /** Number of bedroom-matched area comps within 0.5mi */
  nearbyBedroomMatchCount: number;
  /** Median comp distance in miles */
  medianCompDistance: number | null;
  /** Comp IQR / median ratio (variance measure) */
  compIqrRatio: number | null;
  /** Median daysOld of comps */
  medianDaysOld: number | null;
}

export interface CompConfidenceResult {
  /** Raw confidence score 0–100 (after minimum-count gate) */
  score: number;
  /** UI display band */
  uiBand: 'Low' | 'Medium' | 'High';
  /** Whether engine considers this "high confidence" for behavioral shifts */
  engineHighConfidence: boolean;
  /** Breakdown of point contributions for debugging */
  breakdown: Record<string, number>;
  /** Whether minimum-count gate was applied */
  minimumCountGateApplied: boolean;
}

/**
 * Calculate comp confidence score from comp metadata.
 *
 * Engine confidence threshold (55) and UI display threshold (61) are intentionally different.
 * Engine: gradual behavioral shifts start at 55 (aligned with minimum-count gate cap of 54).
 * UI: "High" label only shown at 61+ for user-facing credibility.
 * Do not unify these without reviewing the full spec.
 */
export function calculateCompConfidence(input: CompConfidenceInput): CompConfidenceResult {
  const breakdown: Record<string, number> = {};
  let raw = 0;

  // Same-unit-line comps: +30 if any present
  if (input.sameLineCompCount > 0) {
    breakdown.sameUnitLine = 30;
    raw += 30;
  }

  // Same-building comps: +8 each, max +24 (3+). Bedroom-matched get +10 each instead.
  const buildingPts = Math.min(
    24,
    input.buildingBedroomMatchCount * 10 +
    Math.max(0, input.buildingCompCount - input.buildingBedroomMatchCount) * 8
  );
  if (buildingPts > 0) {
    breakdown.sameBuilding = buildingPts;
    raw += buildingPts;
  }

  // Area comps (Tier 3-4): +3 each, max +15. Bedroom-matched within 0.5mi get +4 each.
  const areaComps = input.comps.filter(c => !c.isSameBuilding);
  const areaCount = areaComps.length;
  const areaPts = Math.min(
    15,
    input.nearbyBedroomMatchCount * 4 +
    Math.max(0, areaCount - input.nearbyBedroomMatchCount) * 3
  );
  if (areaPts > 0) {
    breakdown.areaComps = areaPts;
    raw += areaPts;
  }

  // Distance tightness: +10 if median <= 0.3mi, +5 if <= 0.5mi
  if (input.medianCompDistance !== null) {
    if (input.medianCompDistance <= 0.3) {
      breakdown.distanceTightness = 10;
      raw += 10;
    } else if (input.medianCompDistance <= 0.5) {
      breakdown.distanceTightness = 5;
      raw += 5;
    }
  }

  // Low variance: +10 if IQR/median < 0.15, +5 if < 0.25
  if (input.compIqrRatio !== null) {
    if (input.compIqrRatio < 0.15) {
      breakdown.lowVariance = 10;
      raw += 10;
    } else if (input.compIqrRatio < 0.25) {
      breakdown.lowVariance = 5;
      raw += 5;
    }
  }

  // Single-building dominance: -15 if >60% of comps from one building AND total < 5
  const totalComps = input.comps.length;
  if (totalComps > 0 && totalComps < 5) {
    const buildingShare = input.buildingCompCount / totalComps;
    if (buildingShare > 0.6) {
      breakdown.singleBuildingDominance = -15;
      raw -= 15;
    }
  }

  // Building >70% influence: -12 if one building > 70% of weighted comp influence,
  // no same-line matches, total >= 5
  if (totalComps >= 5 && input.sameLineCompCount === 0) {
    const buildingInfluence = computeBuildingInfluenceShare(input.comps, input.subjectAddress);
    if (buildingInfluence > 0.70) {
      breakdown.buildingHighInfluence = -12;
      raw -= 12;
    }
  }

  // Stale comps: -10 if median daysOld > 120, -5 if > 90
  if (input.medianDaysOld !== null) {
    if (input.medianDaysOld > 120) {
      breakdown.staleComps = -10;
      raw -= 10;
    } else if (input.medianDaysOld > 90) {
      breakdown.staleComps = -5;
      raw -= 5;
    }
  }

  // Clamp to 0–100
  let score = Math.max(0, Math.min(100, raw));

  // ── Minimum-Count Gate ──
  // To prevent overtrusting tiny samples, cap at 54 unless:
  // - 3+ usable comps total, OR
  // - 2+ same-line or same-building bedroom-matched comps
  let minimumCountGateApplied = false;
  const hasEnoughComps = totalComps >= 3;
  const hasEnoughPrecisionComps = (input.sameLineCompCount >= 2) ||
    (input.buildingBedroomMatchCount >= 2);

  if (!hasEnoughComps && !hasEnoughPrecisionComps && score > 54) {
    score = 54;
    minimumCountGateApplied = true;
  }

  // Engine confidence threshold (55) and UI display threshold (61) are intentionally different.
  // Engine: gradual behavioral shifts start at 55 (aligned with minimum-count gate cap of 54).
  // UI: "High" label only shown at 61+ for user-facing credibility.
  // Do not unify these without reviewing the full spec.
  const engineHighConfidence = score >= 55;
  const uiBand: 'Low' | 'Medium' | 'High' =
    score <= 30 ? 'Low' :
    score <= 60 ? 'Medium' :
    'High';

  return {
    score,
    uiBand,
    engineHighConfidence,
    breakdown,
    minimumCountGateApplied,
  };
}

/**
 * Compute the maximum share of total weighted comp influence held by any single building.
 * Uses relevanceScore from processComps() when available, otherwise correlation * freshness.
 */
export function computeBuildingInfluenceShare(
  comps: RentcastComparable[],
  subjectAddress: string | null,
): number {
  if (comps.length === 0) return 0;

  // Group comps by normalized building address
  const buildingScores = new Map<string, number>();
  let totalScore = 0;

  for (const comp of comps) {
    const addr = comp.formattedAddress ? normalizeBaseAddress(comp.formattedAddress) : 'unknown';
    const weight = comp.relevanceScore ?? (comp.correlation ?? 1) * freshnessFactor(comp.daysOld);
    buildingScores.set(addr, (buildingScores.get(addr) ?? 0) + weight);
    totalScore += weight;
  }

  if (totalScore === 0) return 0;

  let maxShare = 0;
  for (const [, score] of buildingScores) {
    maxShare = Math.max(maxShare, score / totalScore);
  }

  return maxShare;
}

function freshnessFactor(daysOld: number | null): number {
  if (daysOld === null) return 1;
  if (daysOld <= 60) return 1;
  if (daysOld <= 120) return 0.75;
  return 0.5;
}

/**
 * Helper: compute IQR and IQR/median ratio from comp rents.
 * Returns null if fewer than 4 comps with rent data.
 */
export function computeCompIqr(comps: RentcastComparable[]): {
  q1: number;
  q3: number;
  iqr: number;
  median: number;
  iqrRatio: number;
  p25: number;
  p75: number;
} | null {
  const rents = comps
    .filter(c => c.rent != null && c.rent > 0)
    .map(c => c.seasonalRent ?? c.rent!)
    .sort((a, b) => a - b);

  if (rents.length < 4) return null;

  const q1Idx = Math.floor(rents.length * 0.25);
  const q3Idx = Math.floor(rents.length * 0.75);
  const medIdx = Math.floor(rents.length * 0.5);

  const q1 = rents[q1Idx];
  const q3 = rents[q3Idx];
  const median = rents[medIdx];
  const iqr = q3 - q1;
  const iqrRatio = median > 0 ? iqr / median : 0;

  return { q1, q3, iqr, median, iqrRatio, p25: q1, p75: q3 };
}

/**
 * Helper: compute median of an array of numbers.
 */
export function medianOf(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
