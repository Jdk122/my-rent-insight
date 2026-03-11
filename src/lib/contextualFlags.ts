/**
 * Contextual intelligence flags derived from property + location data.
 * No new API calls — uses existing property records and rent control data.
 */

import { PropertyLookupResult } from '@/hooks/usePropertyLookup';

// ─── Utility Inclusion Flag ───

const UTILITY_INCLUSION_STATES = ['NY', 'NJ', 'MA', 'CT', 'IL'];

export function getUtilityNote(
  propertyData: PropertyLookupResult | null,
  state: string,
): string | null {
  if (!propertyData) return null;
  if (!UTILITY_INCLUSION_STATES.includes(state.toUpperCase())) return null;
  if (!propertyData.yearBuilt || propertyData.yearBuilt >= 1960) return null;

  // Check for 6+ units: explicit unit count, or infer from multi-family type
  const isLargeMultiFamily =
    propertyData.units >= 6 ||
    (propertyData.propertyType?.toLowerCase().includes('multi') && (!propertyData.units || propertyData.units >= 6));

  if (!isLargeMultiFamily) return null;

  return 'Heat and hot water are typically included in older buildings in this area — factor this when comparing to newer listings';
}

// ─── Broker Fee Market Flag ───

const NYC_CITIES = [
  'new york', 'manhattan', 'brooklyn', 'queens', 'bronx',
  'staten island', 'new york city', 'the bronx',
  'long island city', 'astoria', 'flushing', 'harlem',
  'williamsburg', 'bushwick',
];

const BOSTON_CITIES = [
  'boston', 'cambridge', 'somerville', 'brookline', 'allston', 'brighton',
];

export interface BrokerFeeInfo {
  brokerFeeMarket: boolean;
  brokerFeeNote: string | null;
  brokerFeeCity: string | null;
}

export function getBrokerFeeInfo(state: string, city: string): BrokerFeeInfo {
  const cityLower = city.toLowerCase().trim();
  const stateUpper = state.toUpperCase();

  if (stateUpper === 'NY' && NYC_CITIES.includes(cityLower)) {
    return {
      brokerFeeMarket: false,
      brokerFeeNote: 'NYC\'s FARE Act (June 2025) eliminated most tenant-paid broker fees. Moving costs are significantly lower than they used to be.',
      brokerFeeCity: 'NYC',
    };
  }

  if (stateUpper === 'MA' && BOSTON_CITIES.includes(cityLower)) {
    return {
      brokerFeeMarket: true,
      brokerFeeNote: 'Broker fees are still common in Boston — typically 1 month\'s rent. Factor this into moving costs.',
      brokerFeeCity: 'Boston',
    };
  }

  const NJ_GOLD_COAST = [
    'hoboken', 'jersey city', 'weehawken', 'union city',
    'north bergen', 'west new york', 'edgewater', 'fort lee',
    'cliffside park',
  ];

  if (stateUpper === 'NJ' && NJ_GOLD_COAST.includes(cityLower)) {
    return {
      brokerFeeMarket: true,
      brokerFeeNote: 'Broker fees are common in the NJ Gold Coast — typically 1 month\'s rent',
      brokerFeeCity: 'NJ',
    };
  }

  return { brokerFeeMarket: false, brokerFeeNote: null, brokerFeeCity: null };
}
