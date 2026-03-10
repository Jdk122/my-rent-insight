import { RentcastComparable } from '@/hooks/useRentcast';
import { seasonallyAdjustRent, listingMonthFromDaysOld } from '@/lib/seasonalAdjust';

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

// ─── Furnished Unit Detection ───

function isFurnished(comp: RentcastComparable): boolean {
  const text = (comp.formattedAddress || '').toLowerCase();
  return text.includes('furnished');
}

export interface FurnishedFilterResult {
  /** Comps used for median / analysis (excludes furnished) */
  unfurnished: RentcastComparable[];
  /** Furnished comps kept for display with a tag */
  furnished: RentcastComparable[];
}

export function filterFurnished(comps: RentcastComparable[]): FurnishedFilterResult {
  const unfurnished: RentcastComparable[] = [];
  const furnished: RentcastComparable[] = [];
  for (const c of comps) {
    if (isFurnished(c)) furnished.push(c);
    else unfurnished.push(c);
  }
  return { unfurnished, furnished };
}

// ─── Address Deduplication ───

function normalizeAddress(addr: string): string {
  return addr
    .trim()
    .toLowerCase()
    .replace(/\bapt\.?\s*/gi, '')
    .replace(/\bunit\.?\s*/gi, '')
    .replace(/\bste\.?\s*/gi, '')
    .replace(/\bsuite\.?\s*/gi, '')
    .replace(/\bfl\.?\s*/gi, '')
    .replace(/\bfloor\.?\s*/gi, '')
    .replace(/\b#\s*\S+/g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bcircle\b/g, 'cir')
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .trim();
}

function fieldCount(comp: RentcastComparable): number {
  let count = 0;
  if (comp.rent != null) count++;
  if (comp.bedrooms != null) count++;
  if (comp.bathrooms != null) count++;
  if (comp.squareFootage != null) count++;
  if (comp.distance != null) count++;
  if (comp.correlation != null) count++;
  return count;
}

export function deduplicateComps(comps: RentcastComparable[]): RentcastComparable[] {
  const map = new Map<string, RentcastComparable>();
  for (const comp of comps) {
    const key = normalizeAddress(comp.formattedAddress);
    const existing = map.get(key);
    if (!existing || fieldCount(comp) > fieldCount(existing)) {
      map.set(key, comp);
    }
  }
  return Array.from(map.values());
}

// ─── Seasonal Comp Adjustment ───

/**
 * Apply seasonal rent adjustment to comps based on their listing month.
 * Mutates copies — returns new array with seasonalRent and seasonallyAdjusted fields.
 */
export function applySeasonalAdjustment(
  comps: RentcastComparable[],
  state: string,
  targetMonth?: number,
): RentcastComparable[] {
  const tMonth = targetMonth ?? (new Date().getMonth() + 1);
  return comps.map(c => {
    if (c.rent == null || c.rent <= 0) return { ...c, seasonalRent: null, seasonallyAdjusted: false };
    const listMonth = listingMonthFromDaysOld(c.daysOld);
    if (listMonth === null) return { ...c, seasonalRent: null, seasonallyAdjusted: false };
    const { adjusted, wasAdjusted } = seasonallyAdjustRent(c.rent, listMonth, tMonth, state);
    return {
      ...c,
      seasonalRent: wasAdjusted ? adjusted : null,
      seasonallyAdjusted: wasAdjusted,
    };
  });
}

// ─── Outlier Detection (IQR method, 5+ comps minimum) ───
// Also filters by distance (<=3 mi) and uses correlation-weighted median

export interface OutlierResult {
  filtered: RentcastComparable[];
  outliers: RentcastComparable[];
  median: number | null;
}

export function correlationWeightedMedian(
  comps: RentcastComparable[],
  subjectSqft?: number | null,
): number | null {
  let valid = comps.filter(c => c.rent != null && c.rent > 0);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0].rent!;

  // When subject sqft is known and enough comps have sqft, filter to ±25%
  if (subjectSqft && subjectSqft > 0) {
    const sqftFiltered = valid.filter(
      c => c.squareFootage != null && c.squareFootage > 0 &&
        Math.abs(c.squareFootage - subjectSqft) / subjectSqft <= 0.25,
    );
    if (sqftFiltered.length >= 3) {
      valid = sqftFiltered;
    }
  }

  // Use seasonally adjusted rent when available, else original
  const getRent = (c: RentcastComparable) => c.seasonalRent ?? c.rent!;

  // Freshness weight: multiply correlation by time-decay factor
  // If ALL comps are >120 days old, skip freshness weighting entirely
  const allStale = valid.every(c => c.daysOld !== null && c.daysOld > 120);
  const getFreshnessMultiplier = (c: RentcastComparable): number => {
    if (allStale || c.daysOld === null) return 1;
    if (c.daysOld <= 60) return 1;
    if (c.daysOld <= 120) return 0.75;
    return 0.5;
  };

  const getWeight = (c: RentcastComparable) => (c.correlation ?? 1) * getFreshnessMultiplier(c);

  const sorted = [...valid].sort((a, b) => getRent(a) - getRent(b));
  const totalWeight = sorted.reduce((sum, c) => sum + getWeight(c), 0);
  const halfWeight = totalWeight / 2;

  let cumWeight = 0;
  for (const comp of sorted) {
    cumWeight += getWeight(comp);
    if (cumWeight >= halfWeight) return getRent(comp);
  }
  return getRent(sorted[sorted.length - 1]);
}

export function detectOutliers(comps: RentcastComparable[], subjectSqft?: number | null): OutlierResult {
  // Step 1: Distance filter (<=3 miles), fallback to all if none pass
  const nearbyComps = comps.filter(c => c.distance === null || c.distance <= 3);
  const workingComps = nearbyComps.length > 0 ? nearbyComps : comps;

  const withRent = workingComps.filter(c => c.rent !== null && c.rent > 0);

  // Use seasonally adjusted rent when available for outlier bounds
  const getRent = (c: RentcastComparable) => c.seasonalRent ?? c.rent!;

  if (withRent.length < 5) {
    const median = correlationWeightedMedian(withRent, subjectSqft);
    return { filtered: withRent, outliers: [], median };
  }

  const rents = withRent.map(c => getRent(c)).sort((a, b) => a - b);
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
    const r = getRent(comp);
    if (r < lowerBound || r > upperBound) {
      outliers.push(comp);
    } else {
      filtered.push(comp);
    }
  }

  const median = correlationWeightedMedian(filtered, subjectSqft);

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
