// ─── Types ───
// These types are kept for backward compatibility with existing components.
// The actual data now comes from dataLoader.ts which loads JSON files.

export type BedroomType = 'studio' | 'oneBr' | 'twoBr' | 'threeBr' | 'fourBr';

export const bedroomLabels: Record<BedroomType, string> = {
  studio: 'Studio',
  oneBr: '1-Bedroom',
  twoBr: '2-Bedroom',
  threeBr: '3-Bedroom',
  fourBr: '4+-Bedroom',
};

// Re-export the new data loader as the primary API
export { lookupRentData, loadFredTrend, calculateResults } from './dataLoader';
export type { RentLookupResult, FredTrendData } from './dataLoader';
