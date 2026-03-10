/**
 * Comp tiering engine: classifies comparable rentals into proximity tiers
 * for weighted fair-range calculation and UI grouping.
 */

import type { RentcastComparable } from '@/hooks/useRentcast';

export type CompTier = 1 | 2 | 3 | 4;

export interface TieredComp extends RentcastComparable {
  tier: CompTier;
}

export interface TieringResult {
  tiered: TieredComp[];
  tier1: TieredComp[];
  tier2: TieredComp[];
  tier3: TieredComp[];
  tier4: TieredComp[];
  buildingRentRange: { low: number; high: number } | null;
}

/**
 * Strip unit/apt/suite/# identifiers and trailing unit numbers,
 * normalize spacing and casing → "400 Park Ave"
 */
export function normalizeBaseAddress(addr: string): string {
  let s = addr.trim();
  // Remove everything after a comma (city, state, zip)
  s = s.split(',')[0].trim();
  // Remove unit/apt/suite/# designators and what follows
  s = s.replace(/\b(apt|apartment|unit|suite|ste|fl|floor|#|ph)\b\.?\s*\S*/gi, '');
  // Remove trailing standalone numbers that look like unit numbers (e.g. "400 Park Ave 9G")
  s = s.replace(/\s+\d+[A-Za-z]?\s*$/, '');
  // Collapse whitespace, lowercase
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

/**
 * Extract just the street name portion (without building number) for Tier 2 matching.
 * "400 Park Ave" → "park ave"
 */
function extractStreetName(normalized: string): string {
  return normalized.replace(/^\d+\s+/, '');
}

/**
 * Classify a comp into a tier based on address proximity to the subject.
 */
function classifyComp(
  comp: RentcastComparable,
  subjectBase: string | null,
  subjectStreet: string | null,
): CompTier {
  if (subjectBase && comp.formattedAddress) {
    const compBase = normalizeBaseAddress(comp.formattedAddress);

    // Tier 1: exact base address match (same building)
    if (compBase === subjectBase) return 1;

    // Tier 2: same street name within 0.1 mi
    if (subjectStreet) {
      const compStreet = extractStreetName(compBase);
      if (compStreet === subjectStreet && comp.distance !== null && comp.distance <= 0.1) {
        return 2;
      }
    }
  }

  // Tier 3: within 0.5 mi
  if (comp.distance !== null && comp.distance <= 0.5) return 3;

  // Tier 4: beyond 0.5 mi
  return 4;
}

/**
 * Classify all comps into tiers relative to the subject address.
 */
export function tierComps(
  comps: RentcastComparable[],
  subjectAddress: string | null,
): TieringResult {
  const subjectBase = subjectAddress ? normalizeBaseAddress(subjectAddress) : null;
  const subjectStreet = subjectBase ? extractStreetName(subjectBase) : null;

  const tiered: TieredComp[] = comps.map(comp => ({
    ...comp,
    tier: classifyComp(comp, subjectBase, subjectStreet),
  }));

  // Also flag isSameBuilding for Tier 1 (preserves existing UI logic)
  tiered.forEach(c => {
    if (c.tier === 1) c.isSameBuilding = true;
  });

  const tier1 = tiered.filter(c => c.tier === 1);
  const tier2 = tiered.filter(c => c.tier === 2);
  const tier3 = tiered.filter(c => c.tier === 3);
  const tier4 = tiered.filter(c => c.tier === 4);

  // Building rent range from Tier 1 comps with valid rent
  const t1Rents = tier1.filter(c => c.rent !== null && c.rent > 0).map(c => c.rent as number);
  const buildingRentRange = t1Rents.length > 0
    ? { low: Math.min(...t1Rents), high: Math.max(...t1Rents) }
    : null;

  return { tiered, tier1, tier2, tier3, tier4, buildingRentRange };
}

/**
 * Compute tier-adjusted weights for fair range calculation.
 * Returns overridden comp weight percentages if Tier 1 comps are present.
 */
export interface TierWeights {
  tier1CompWeight: number;
  otherCompWeight: number;
  hudZoriWeight: number;
}

export function getTierWeights(tier1Count: number): TierWeights | null {
  if (tier1Count >= 3) {
    return { tier1CompWeight: 60, otherCompWeight: 10, hudZoriWeight: 30 };
  }
  if (tier1Count >= 1) {
    return { tier1CompWeight: 40, otherCompWeight: 30, hudZoriWeight: 30 };
  }
  // No Tier 1 — use default weighting
  return null;
}
