/**
 * Regional seasonal rent adjustment profiles.
 * Each profile maps month (1-12) to a seasonal index where 1.0 = annual average.
 */

export type SeasonalProfile = Record<number, number>;

const NORTHEAST_MIDWEST: SeasonalProfile = {
  1: 0.94, 2: 0.95, 3: 0.97, 4: 1.00,
  5: 1.04, 6: 1.06, 7: 1.06, 8: 1.05,
  9: 1.02, 10: 0.99, 11: 0.96, 12: 0.94,
};

const SUNBELT: SeasonalProfile = {
  1: 0.99, 2: 0.99, 3: 1.00, 4: 1.01,
  5: 1.02, 6: 1.02, 7: 1.01, 8: 1.01,
  9: 1.00, 10: 0.99, 11: 0.98, 12: 0.98,
};

const PACIFIC: SeasonalProfile = {
  1: 0.96, 2: 0.97, 3: 0.99, 4: 1.01,
  5: 1.03, 6: 1.04, 7: 1.04, 8: 1.03,
  9: 1.01, 10: 0.99, 11: 0.97, 12: 0.96,
};

const MOUNTAIN_PLAINS: SeasonalProfile = {
  1: 0.95, 2: 0.96, 3: 0.98, 4: 1.00,
  5: 1.03, 6: 1.05, 7: 1.05, 8: 1.04,
  9: 1.01, 10: 0.99, 11: 0.97, 12: 0.95,
};

const STATE_REGION_MAP: Record<string, SeasonalProfile> = {
  // Northeast / Midwest
  NY: NORTHEAST_MIDWEST, NJ: NORTHEAST_MIDWEST, CT: NORTHEAST_MIDWEST,
  MA: NORTHEAST_MIDWEST, PA: NORTHEAST_MIDWEST, IL: NORTHEAST_MIDWEST,
  MI: NORTHEAST_MIDWEST, OH: NORTHEAST_MIDWEST, IN: NORTHEAST_MIDWEST,
  ME: NORTHEAST_MIDWEST, NH: NORTHEAST_MIDWEST, VT: NORTHEAST_MIDWEST,
  RI: NORTHEAST_MIDWEST, DE: NORTHEAST_MIDWEST, MD: NORTHEAST_MIDWEST,
  DC: NORTHEAST_MIDWEST, VA: NORTHEAST_MIDWEST, WV: NORTHEAST_MIDWEST,
  // Sunbelt
  FL: SUNBELT, TX: SUNBELT, AZ: SUNBELT, NV: SUNBELT,
  GA: SUNBELT, NC: SUNBELT, SC: SUNBELT, AL: SUNBELT,
  MS: SUNBELT, LA: SUNBELT, AR: SUNBELT, TN: SUNBELT,
  OK: SUNBELT, HI: SUNBELT,
  // Pacific
  CA: PACIFIC, OR: PACIFIC, WA: PACIFIC, AK: PACIFIC,
  // Mountain / Plains
  CO: MOUNTAIN_PLAINS, UT: MOUNTAIN_PLAINS, MT: MOUNTAIN_PLAINS,
  ID: MOUNTAIN_PLAINS, WY: MOUNTAIN_PLAINS, NM: MOUNTAIN_PLAINS,
  ND: MOUNTAIN_PLAINS, SD: MOUNTAIN_PLAINS, NE: MOUNTAIN_PLAINS,
  KS: MOUNTAIN_PLAINS, MN: MOUNTAIN_PLAINS, IA: MOUNTAIN_PLAINS,
  MO: MOUNTAIN_PLAINS, WI: MOUNTAIN_PLAINS, KY: MOUNTAIN_PLAINS,
};

/** Get the seasonal profile for a state. Falls back to a flat (no-op) profile. */
export function getSeasonalProfile(state: string): SeasonalProfile {
  return STATE_REGION_MAP[state.toUpperCase()] ?? {
    1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1,
    7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1,
  };
}

/**
 * Adjust a rent from listing month to target month using regional seasonal factors.
 * If the factor difference is < 2%, returns original rent (noise suppression).
 *
 * @param rent        Original rent amount
 * @param listingMonth  Month the listing was observed (1-12)
 * @param targetMonth   Month to normalize to (1-12)
 * @param state         Two-letter state code
 * @returns { adjusted: number; wasAdjusted: boolean }
 */
export function seasonallyAdjustRent(
  rent: number,
  listingMonth: number,
  targetMonth: number,
  state: string,
): { adjusted: number; wasAdjusted: boolean } {
  if (listingMonth === targetMonth || rent <= 0) {
    return { adjusted: rent, wasAdjusted: false };
  }

  const profile = getSeasonalProfile(state);
  const listingFactor = profile[listingMonth] ?? 1;
  const targetFactor = profile[targetMonth] ?? 1;

  // Skip if difference is < 2% (noise, not signal)
  if (Math.abs(targetFactor - listingFactor) < 0.02) {
    return { adjusted: rent, wasAdjusted: false };
  }

  const adjusted = Math.round(rent * (targetFactor / listingFactor));
  return { adjusted, wasAdjusted: true };
}

/**
 * Derive listing month from daysOld. Returns 1-12 or null.
 */
export function listingMonthFromDaysOld(daysOld: number | null): number | null {
  if (daysOld === null || daysOld < 0) return null;
  const listingDate = new Date();
  listingDate.setDate(listingDate.getDate() - daysOld);
  return listingDate.getMonth() + 1; // 1-indexed
}
