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
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Separate comps into building vs other, and compute building rent range.
 * Returns hasBuildingData = true only when 2+ same-building comps have rent data.
 */
export function getBuildingRange(
  allComps: RentcastComparable[],
  subjectAddress: string | null,
): BuildingRangeResult {
  const empty: BuildingRangeResult = {
    hasBuildingData: false,
    buildingLow: 0,
    buildingHigh: 0,
    buildingMedian: 0,
    buildingComps: [],
    otherComps: allComps,
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

  const rents = buildingComps
    .filter(c => c.rent !== null && c.rent > 0)
    .map(c => c.rent as number);

  if (rents.length < 2) {
    return { ...empty, buildingComps, otherComps };
  }

  return {
    hasBuildingData: true,
    buildingLow: Math.min(...rents),
    buildingHigh: Math.max(...rents),
    buildingMedian: median(rents),
    buildingComps,
    otherComps,
  };
}
