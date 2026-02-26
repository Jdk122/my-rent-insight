// ─── Types ───
// These types are kept for backward compatibility with existing components.
// The actual data now comes from dataLoader.ts which loads JSON files.

export type BedroomType = 'studio' | 'oneBr' | 'twoBr' | 'threeBr' | 'fourBr';

export const bedroomLabels: Record<BedroomType, string> = {
  studio: 'Studio',
  oneBr: '1 Bedroom',
  twoBr: '2 Bedrooms',
  threeBr: '3 Bedrooms',
  fourBr: '4+ Bedrooms',
};

// Re-export the new data loader as the primary API
export { lookupRentData, loadFredTrend, calculateResults } from './dataLoader';
export type { RentLookupResult, FredTrendData } from './dataLoader';
