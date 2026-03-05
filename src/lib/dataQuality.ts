import { RentcastComparable } from '@/hooks/useRentcast';

// ─── Data Confidence ───

export type ConfidenceLevel = 'high' | 'moderate' | 'limited';

export interface DataConfidence {
  level: ConfidenceLevel;
  sources: string[];
  missingSources: string[];
  note: string | null;
}

export function assessConfidence({
  hasHud,
  compCount,
  maxCompDistance,
  hasZillow,
  hasCensus,
}: {
  hasHud: boolean;
  compCount: number;
  maxCompDistance: number | null;
  hasZillow: boolean;
  hasCensus: boolean;
}): DataConfidence {
  const sources: string[] = [];
  const missing: string[] = [];

  if (hasHud) sources.push('HUD SAFMR FY2026');
  else missing.push('HUD Fair Market Rent');

  if (compCount >= 5) sources.push(`${compCount} nearby listings`);
  else if (compCount > 0) sources.push(`${compCount} nearby listings`);
  else missing.push('Nearby listings');

  if (hasZillow) sources.push('Zillow ZORI trends');
  else missing.push('Zillow rent trends');

  if (hasCensus) sources.push('Census ACS 2023');
  else missing.push('Census data');

  const farComps = maxCompDistance !== null && maxCompDistance > 5;

  // High: HUD + at least one market trend + comparable listings (3+)
  if (hasHud && compCount >= 3 && (hasZillow || hasCensus)) {
    return { level: 'high', sources, missingSources: missing, note: null };
  }

  // Moderate: HUD + at least one market trend source (Zillow/Census) OR 3+ comps
  if (hasHud && (hasZillow || hasCensus || compCount >= 3)) {
    const note = `Analysis based on ${sources.join(', ')}.`;
    return { level: 'moderate', sources, missingSources: missing, note };
  }

  // Limited: only HUD with no market trend data at all
  const note = 'Limited data available for this zip code. Results should be used as a general guide only.';
  return { level: 'limited', sources, missingSources: missing, note };
}

// ─── Outlier Detection (IQR method, 5+ comps minimum) ───
// Also filters by distance (<=3 mi) and uses correlation-weighted median

export interface OutlierResult {
  filtered: RentcastComparable[];
  outliers: RentcastComparable[];
  median: number | null;
}

function correlationWeightedMedian(comps: RentcastComparable[]): number | null {
  const valid = comps.filter(c => c.rent != null && c.rent > 0);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0].rent!;

  const sorted = [...valid].sort((a, b) => a.rent! - b.rent!);
  const totalWeight = sorted.reduce((sum, c) => sum + (c.correlation ?? 1), 0);
  const halfWeight = totalWeight / 2;

  let cumWeight = 0;
  for (const comp of sorted) {
    cumWeight += comp.correlation ?? 1;
    if (cumWeight >= halfWeight) return comp.rent!;
  }
  return sorted[sorted.length - 1].rent!;
}

export function detectOutliers(comps: RentcastComparable[]): OutlierResult {
  // Step 1: Distance filter (<=3 miles), fallback to all if none pass
  const nearbyComps = comps.filter(c => c.distance === null || c.distance <= 3);
  const workingComps = nearbyComps.length > 0 ? nearbyComps : comps;

  const withRent = workingComps.filter(c => c.rent !== null && c.rent > 0);

  if (withRent.length < 5) {
    // Not enough data for outlier detection — use all, but with correlation-weighted median
    const median = correlationWeightedMedian(withRent);
    return { filtered: withRent, outliers: [], median };
  }

  const rents = withRent.map(c => c.rent!).sort((a, b) => a - b);
  const q1Idx = Math.floor(rents.length * 0.25);
  const q3Idx = Math.floor(rents.length * 0.75);
  const q1 = rents[q1Idx];
  const q3 = rents[q3Idx];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const filtered: RentcastComparable[] = [];
  const outliers: RentcastComparable[] = [];

  for (const comp of withRent) {
    if (comp.rent! < lowerBound || comp.rent! > upperBound) {
      outliers.push(comp);
    } else {
      filtered.push(comp);
    }
  }

  // Step 2: Correlation-weighted median instead of simple median
  const median = correlationWeightedMedian(filtered);

  return { filtered, outliers, median };
}

// ─── Cross-Source Consistency ───

export function checkCrossSourceConsistency(
  hudFmr: number,
  compMedian: number | null,
): string | null {
  if (compMedian === null || hudFmr <= 0) return null;

  const ratio = compMedian / hudFmr;
  if (ratio > 1.5 || ratio < 0.5) {
    return 'Note: Actual nearby listings differ significantly from federal rent benchmarks. This can happen in rapidly changing markets or areas with wide rent ranges. Comparable listings may be a more accurate reflection of current conditions.';
  }
  return null;
}

// ─── Comp Radius ───

export function getCompRadius(comps: RentcastComparable[]): { maxDistance: number | null; label: string } {
  const distances = comps
    .map(c => c.distance)
    .filter((d): d is number => d !== null && d > 0);

  if (distances.length === 0) return { maxDistance: null, label: '' };

  const max = Math.max(...distances);
  const rounded = Math.ceil(max);
  return {
    maxDistance: max,
    label: `within ${rounded} ${rounded === 1 ? 'mile' : 'miles'}`,
  };
}
