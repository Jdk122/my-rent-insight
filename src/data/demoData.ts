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
type DemoScenario = 'above' | 'fair' | 'below' | 'none' | 'moderate' | 'below-fmr-high-increase' | 'limited' | 'premium' | 'above-no-overpayment';

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
  // Moderate: borderline score ~60-65, small increase just above trend
  moderate: {
    formData: {
      zip: '10001',
      fullAddress: '250 W 31st St, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 2000,
      rentIncrease: 150,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData },
  },
  // Below-FMR + High Increase: rent is below market but increase is aggressively above trend
  'below-fmr-high-increase': {
    formData: {
      zip: '10001',
      fullAddress: '180 W 25th St, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 1700,
      rentIncrease: 200,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData, fmr: 2100, fmrPrior: 2000 },
  },
  // Limited Data: no comps, HUD-only
  limited: {
    formData: {
      zip: '59001',
      fullAddress: '',
      bedrooms: 'twoBr',
      currentRent: 900,
      rentIncrease: 100,
      increaseIsPercent: false,
      movingCosts: 3000,
    },
    rentData: {
      zip: '59001',
      city: 'Absarokee',
      state: 'MT',
      metro: 'Billings',
      fmr: 950,
      fmrPrior: 900,
      yoyChange: 2.0,
      yoySource: 'hud',
      yoySourceLabel: 'HUD FMR',
      yoyReliability: 'government',
      priorSource: 'f',
      fmrSource: 'county',
      censusMedianRent: null,
      medianIncome: 45000,
      fredTrend: null,
      zillowMonthly: null,
      zillowDirection: null,
      zillow3moTrend: null,
      hvd: null,
      alYoY: null,
      alMoM: null,
      alVacancy: null,
      alTimeOnMarket: null,
      alRegion: null,
      f50: [700, 950, 1100, 1400, 1600],
      zoriYoY: null,
      zoriGeoLevel: null,
    },
  },
  // Premium Unit: high rent well above FMR, scoring shifts to increase-rate
  premium: {
    formData: {
      zip: '10001',
      fullAddress: '100 W 25th St, PH-A, New York, NY 10001',
      bedrooms: 'twoBr',
      currentRent: 6500,
      rentIncrease: 500,
      increaseIsPercent: false,
      movingCosts: 8000,
    },
    rentData: { ...baseRentData, fmr: 2600, fmrPrior: 2500, f50: [1800, 2100, 2600, 3400, 4000] },
  },
  // Above market but counter-offer exceeds proposed rent (no usable overpayment)
  'above-no-overpayment': {
    formData: {
      zip: '10001',
      fullAddress: '400 W 33rd St, New York, NY 10001',
      bedrooms: 'oneBr',
      currentRent: 2000,
      rentIncrease: 300,
      increaseIsPercent: false,
      movingCosts: 5000,
    },
    rentData: { ...baseRentData, fmr: 2400, fmrPrior: 2300 },
  },
};

export function getDemoData(scenario: string | null): { formData: RentFormData; rentData: RentLookupResult } | null {
  if (!scenario) return null;
  const key = scenario.toLowerCase() as DemoScenario;
  return scenarios[key] ?? null;
}

/* ── WSIP demo scenarios ── */

type WsipDemoScenario = 'overpriced' | 'fair' | 'deal';

interface WsipDemoResult {
  zip: string;
  fullAddress: string | null;
  bedrooms: 'studio' | 'oneBr' | 'twoBr' | 'threeBr' | 'fourBr';
  askingRent: number | null;
  rentData: RentLookupResult;
}

const wsipScenarios: Record<WsipDemoScenario, WsipDemoResult> = {
  overpriced: {
    zip: '10001',
    fullAddress: '350 W 30th St, New York, NY 10001',
    bedrooms: 'oneBr',
    askingRent: 7200,
    rentData: { ...baseRentData },
  },
  fair: {
    zip: '10001',
    fullAddress: '456 W 34th St, New York, NY 10001',
    bedrooms: 'oneBr',
    askingRent: 5600,
    rentData: { ...baseRentData },
  },
  deal: {
    zip: '10001',
    fullAddress: '789 8th Ave, New York, NY 10001',
    bedrooms: 'oneBr',
    askingRent: 3500,
    rentData: { ...baseRentData, fmr: 2100, fmrPrior: 2000 },
  },
};

export function getWsipDemoData(scenario: string | null): WsipDemoResult | null {
  if (!scenario) return null;
  const key = scenario.toLowerCase() as WsipDemoScenario;
  return wsipScenarios[key] ?? null;
}
