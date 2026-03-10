/**
 * Building range helper: identifies same-building comps and calculates
 * building-level rent range to override area-level verdicts.
 */

import type { RentcastComparable } from '@/hooks/useRentcast';
import { normalizeBaseAddress } from '@/lib/compTiering';

export interface BuildingRangeResult {
  hasBuildingData: boolean;
  buildingLow: number;
  buildingHigh: number;
  buildingMedian: number;
  buildingComps: RentcastComparable[];
  otherComps: RentcastComparable[];
  /** Label like "1BR" or "studio" describing which bedroom filter matched */
  bedroomFilterLabel: string | null;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function brLabel(n: number): string {
  if (n === 0) return 'studio';
  return `${n}BR`;
}

/**
 * Separate comps into building vs other, and compute building rent range.
 * Returns hasBuildingData = true only when 2+ same-building comps have rent data.
 *
 * When bedroomCount is provided, filters building comps by:
 *   1. Exact bedroom match → if 2+ with rent, use those
 *   2. ±1 bedroom fallback → if 2+ with rent, use those
 *   3. All bedrooms fallback (original behavior)
 */
export function getBuildingRange(
  allComps: RentcastComparable[],
  subjectAddress: string | null,
  bedroomCount?: number | null,
): BuildingRangeResult {
  const empty: BuildingRangeResult = {
    hasBuildingData: false,
    buildingLow: 0,
    buildingHigh: 0,
    buildingMedian: 0,
    buildingComps: [],
    otherComps: allComps,
    bedroomFilterLabel: null,
  };

  if (!subjectAddress) return empty;

  const subjectBase = normalizeBaseAddress(subjectAddress);

  const buildingComps: RentcastComparable[] = [];
  const otherComps: RentcastComparable[] = [];

  for (const comp of allComps) {
    if (comp.formattedAddress && normalizeBaseAddress(comp.formattedAddress) === subjectBase) {
      buildingComps.push(comp);
    } else {
      otherComps.push(comp);
    }
  }

  // Helper: get rents from a set of comps
  const getRents = (comps: RentcastComparable[]) =>
    comps.filter(c => c.rent !== null && c.rent > 0).map(c => c.rent as number);

  // Try bedroom-filtered subsets when bedroomCount is provided
  if (bedroomCount !== null && bedroomCount !== undefined) {
    // 1. Exact bedroom match
    const exactMatch = buildingComps.filter(c => c.bedrooms === bedroomCount);
    const exactRents = getRents(exactMatch);
    if (exactRents.length >= 2) {
      return {
        hasBuildingData: true,
        buildingLow: Math.min(...exactRents),
        buildingHigh: Math.max(...exactRents),
        buildingMedian: median(exactRents),
        buildingComps: exactMatch,
        otherComps: [...otherComps, ...buildingComps.filter(c => c.bedrooms !== bedroomCount)],
        bedroomFilterLabel: brLabel(bedroomCount),
      };
    }

    // 2. ±1 bedroom fallback
    const nearMatch = buildingComps.filter(
      c => c.bedrooms !== null && Math.abs(c.bedrooms - bedroomCount) <= 1,
    );
    const nearRents = getRents(nearMatch);
    if (nearRents.length >= 2) {
      return {
        hasBuildingData: true,
        buildingLow: Math.min(...nearRents),
        buildingHigh: Math.max(...nearRents),
        buildingMedian: median(nearRents),
        buildingComps: nearMatch,
        otherComps: [...otherComps, ...buildingComps.filter(c => !nearMatch.includes(c))],
        bedroomFilterLabel: null, // mixed bedrooms, no specific label
      };
    }
  }

  // 3. All bedrooms fallback (original behavior)
  const rents = getRents(buildingComps);

  if (rents.length < 2) {
    return { ...empty, buildingComps, otherComps, bedroomFilterLabel: null };
  }

  return {
    hasBuildingData: true,
    buildingLow: Math.min(...rents),
    buildingHigh: Math.max(...rents),
    buildingMedian: median(rents),
    buildingComps,
    otherComps,
    bedroomFilterLabel: null,
  };
}
