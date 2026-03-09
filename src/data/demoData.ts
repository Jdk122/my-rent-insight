import { RentFormData } from '@/components/RentForm';
import { RentLookupResult } from '@/data/dataLoader';

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
