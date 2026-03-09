import { RentFormData } from '@/components/RentForm';
import { RentLookupResult } from '@/data/dataLoader';
import { RentcastResult, RentcastComparable } from '@/hooks/useRentcast';

const mockComps: RentcastComparable[] = [
  { formattedAddress: '125 W 28th St, Apt 4B, New York, NY 10001', rent: 2250, bedrooms: 1, bathrooms: 1, squareFootage: 620, distance: 0.01, daysOld: 12, correlation: 0.97, isSameBuilding: true, isSameUnitLine: false },
  { formattedAddress: '125 W 28th St, Apt 3A, New York, NY 10001', rent: 2300, bedrooms: 1, bathrooms: 1, squareFootage: 640, distance: 0.01, daysOld: 25, correlation: 0.95, isSameBuilding: true, isSameUnitLine: true },
  { formattedAddress: '130 W 28th St, Apt 6C, New York, NY 10001', rent: 2180, bedrooms: 1, bathrooms: 1, squareFootage: 600, distance: 0.05, daysOld: 18, correlation: 0.92 },
  { formattedAddress: '145 W 27th St, Apt 2D, New York, NY 10001', rent: 2350, bedrooms: 1, bathrooms: 1, squareFootage: 650, distance: 0.12, daysOld: 30, correlation: 0.88 },
  { formattedAddress: '200 W 26th St, Apt 8A, New York, NY 10001', rent: 2150, bedrooms: 1, bathrooms: 1, squareFootage: 590, distance: 0.18, daysOld: 45, correlation: 0.85 },
  { formattedAddress: '220 W 29th St, Apt 5F, New York, NY 10001', rent: 2400, bedrooms: 1, bathrooms: 1, squareFootage: 670, distance: 0.22, daysOld: 60, correlation: 0.82 },
];

export const demoRentcast: RentcastResult = {
  rentEstimate: 2270,
  rentRangeLow: 2050,
  rentRangeHigh: 2450,
  propertyType: 'Apartment',
  comparables: mockComps,
};
type DemoScenario = 'above' | 'fair' | 'below' | 'none';

const baseRentData: RentLookupResult = {
  zip: '10001',
  city: 'New York',
  state: 'NY',
  metro: 'New York-Newark-Jersey City',
  fmr: 2100,
  fmrPrior: 2000,
  yoyChange: 3.2,
  yoySource: 'zillow',
  yoySourceLabel: 'Zillow ZORI',
  yoyReliability: 'market',
  priorSource: 'f',
  fmrSource: 'safmr',
  censusMedianRent: 1950,
  medianIncome: 75000,
  fredTrend: null,
  zillowMonthly: 0.3,
  zillowDirection: 'rising',
  zillow3moTrend: 2.8,
  hvd: 'rising',
  alYoY: 2.9,
  alMoM: 0.2,
  alVacancy: 4.5,
  alTimeOnMarket: 35,
  alRegion: 'New York County',
  f50: [1800, 2100, 2500, 3200, 3800],
  zoriYoY: 3.2,
  zoriGeoLevel: 'zip',
};

const scenarios: Record<DemoScenario, { formData: RentFormData; rentData: RentLookupResult }> = {
  above: {
    formData: {
      zip: '10001',
      fullAddress: '123 W 28th St, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 2000,
      rentIncrease: 350,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData },
  },
  fair: {
    formData: {
      zip: '10001',
      fullAddress: '456 W 34th St, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 2000,
      rentIncrease: 65,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData },
  },
  below: {
    formData: {
      zip: '10001',
      fullAddress: '789 8th Ave, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 2400,
      rentIncrease: 25,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData, fmr: 2600, fmrPrior: 2500 },
  },
  none: {
    formData: {
      zip: '10001',
      fullAddress: '321 W 23rd St, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 2100,
      rentIncrease: null,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData },
  },
};

export function getDemoData(scenario: string | null): { formData: RentFormData; rentData: RentLookupResult } | null {
  if (!scenario) return null;
  const key = scenario.toLowerCase() as DemoScenario;
  return scenarios[key] ?? null;
}
