import { DEAL_CITIES, type DealCity } from './dealsCities';

/**
 * Exact ZIP match: find the deals neighborhood that covers a given ZIP.
 * Returns first match only (one neighborhood per ZIP).
 */
export function findDealsNeighborhoodByZip(zip: string): DealCity | undefined {
  return DEAL_CITIES.find(c => c.zips.includes(zip));
}

/**
 * City-name match via explicit metroCities field.
 * Returns all neighborhoods whose metroCities list includes this city name.
 * Returns empty array when there is no match — caller decides what to show.
 */
export function findDealsNeighborhoodsByCity(
  cityName: string,
  stateAbbr: string,
): DealCity[] {
  const lower = cityName.toLowerCase().trim();
  return DEAL_CITIES.filter(
    c => c.stateAbbr === stateAbbr && c.metroCities.includes(lower),
  );
}

/**
 * State-level match: all deals neighborhoods in a given state.
 */
export function findDealsNeighborhoodsByState(stateAbbr: string): DealCity[] {
  return DEAL_CITIES.filter(c => c.stateAbbr === stateAbbr);
}
