import { PropertyLookupResult } from '@/hooks/usePropertyLookup';

// Keep the old interface for backward compatibility with NegotiationLetter/ShareSection
export interface LandlordCostEstimate {
  address: string;
  purchasePrice: number;
  purchaseYear: number;
  mortgage: number;
  propertyTax: number;
  hoa: number;
  insurance: number;
  totalCosts: number;
  annualCostIncrease: number;
  monthlyCostIncrease: number;
}

const MORTGAGE_RATES: Record<number, number> = {
  2005: 0.059, 2006: 0.064, 2007: 0.063, 2008: 0.061,
  2009: 0.051, 2010: 0.047, 2011: 0.045, 2012: 0.037,
  2013: 0.040, 2014: 0.042, 2015: 0.039, 2016: 0.037,
  2017: 0.040, 2018: 0.046, 2019: 0.039, 2020: 0.031,
  2021: 0.030, 2022: 0.054, 2023: 0.068, 2024: 0.067,
  2025: 0.066, 2026: 0.065,
};

export interface LandlordCosts {
  mortgage: number;
  propertyTax: number;
  insurance: number;
  maintenance: number;
  total: number;
  totalCostChangePerMonth: number;
  taxChange: number;
  insuranceChange: number;
  maintenanceChange: number;
}

export interface LandlordInsights {
  profitMargin: number;
  profitAfterIncrease: number;
  profitMarginPct: number;
  costIncreaseMarkup: number | null;
  yearsOwned: number;
  equityGained: number;
  principalPaid: number;
  totalWealthBuilt: number;
  isInvestor: boolean;
  buildingAge: number | null;
  hasEnoughData: boolean;
  saleYear: number;
  downPaymentPct: number;
  mortgageRate: number;
}

function estimateMortgage(salePrice: number, saleYear: number): number {
  const downPct = salePrice > 1_000_000 ? 0.30 : 0.25;
  const principal = salePrice * (1 - downPct);
  const rate = MORTGAGE_RATES[saleYear] || 0.055;
  const monthlyRate = rate / 12;
  const months = 360;
  return Math.round(
    principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function estimatePrincipalPaid(salePrice: number, saleYear: number): number {
  const downPct = salePrice > 1_000_000 ? 0.30 : 0.25;
  const principal = salePrice * (1 - downPct);
  const rate = MORTGAGE_RATES[saleYear] || 0.055;
  const monthlyRate = rate / 12;
  const currentYear = new Date().getFullYear();
  const monthsElapsed = Math.min((currentYear - saleYear) * 12, 360);
  if (monthsElapsed <= 0) return 0;
  const remaining = principal * (
    Math.pow(1 + monthlyRate, 360) - Math.pow(1 + monthlyRate, monthsElapsed)
  ) / (Math.pow(1 + monthlyRate, 360) - 1);
  return Math.round(principal - remaining);
}

export function calculateLandlordCosts(prop: PropertyLookupResult): LandlordCosts | null {
  if (!prop.lastSalePrice || !prop.annualTax) return null;

  const saleYear = prop.lastSaleDate ? new Date(prop.lastSaleDate).getFullYear() : 2020;
  const units = Math.max(prop.units || 1, 1);

  const totalMortgage = estimateMortgage(prop.lastSalePrice, saleYear);
  const mortgage = Math.round(totalMortgage / units);

  const propertyTax = Math.round((prop.annualTax / 12) / units);

  let taxChange: number;
  if (prop.priorYearTax && prop.priorYearTax > 0) {
    const priorTaxPerUnit = Math.round((prop.priorYearTax / 12) / units);
    taxChange = propertyTax - priorTaxPerUnit;
  } else {
    taxChange = Math.round(propertyTax * 0.03);
  }

  const assessedVal = prop.assessedValue || prop.lastSalePrice;
  const insurance = Math.round((assessedVal * 0.005 / 12) / units);
  const insuranceChange = Math.round(insurance * 0.04);

  const age = prop.yearBuilt ? (new Date().getFullYear() - prop.yearBuilt) : 30;
  let maintenance: number;
  if (age < 10) maintenance = 100;
  else if (age < 25) maintenance = 150;
  else if (age < 50) maintenance = 200;
  else maintenance = 250;
  const maintenanceChange = Math.round(maintenance * 0.03);

  const total = mortgage + propertyTax + insurance + maintenance + Math.round((prop.hoaFee || 0) / units);
  const totalCostChangePerMonth = taxChange + insuranceChange + maintenanceChange;

  return {
    mortgage, propertyTax, insurance, maintenance, total,
    totalCostChangePerMonth, taxChange, insuranceChange, maintenanceChange,
  };
}

export function generateInsights(
  prop: PropertyLookupResult,
  costs: LandlordCosts,
  currentRent: number,
  proposedRent: number,
): LandlordInsights {
  const saleYear = prop.lastSaleDate ? new Date(prop.lastSaleDate).getFullYear() : 2020;
  const currentYear = new Date().getFullYear();
  const yearsOwned = currentYear - saleYear;
  const downPct = prop.lastSalePrice! > 1_000_000 ? 0.30 : 0.25;
  const rate = MORTGAGE_RATES[saleYear] || 0.055;

  const profitMargin = currentRent - costs.total;
  const profitAfterIncrease = proposedRent - costs.total;
  const profitMarginPct = currentRent > 0 ? Math.round((profitMargin / currentRent) * 100) : 0;

  const rentIncrease = proposedRent - currentRent;
  const costIncreaseMarkup = costs.totalCostChangePerMonth > 0
    ? Math.round((rentIncrease / costs.totalCostChangePerMonth) * 10) / 10
    : null;

  const estimatedCurrentValue = Math.round(prop.lastSalePrice! * Math.pow(1.03, yearsOwned));
  const equityGained = estimatedCurrentValue - prop.lastSalePrice!;
  const principalPaid = estimatePrincipalPaid(prop.lastSalePrice!, saleYear);

  return {
    profitMargin,
    profitAfterIncrease,
    profitMarginPct,
    costIncreaseMarkup,
    yearsOwned,
    equityGained,
    principalPaid,
    totalWealthBuilt: equityGained + principalPaid,
    isInvestor: prop.isInvestor,
    buildingAge: prop.yearBuilt ? (currentYear - prop.yearBuilt) : null,
    hasEnoughData: !!(prop.lastSalePrice && prop.annualTax),
    saleYear,
    downPaymentPct: downPct * 100,
    mortgageRate: rate * 100,
  };
}

/**
 * Convert PropertyLookupResult + LandlordCosts into the legacy LandlordCostEstimate
 * so existing NegotiationLetter and ShareSection continue to work.
 */
export function toLegacyCostEstimate(
  prop: PropertyLookupResult,
  costs: LandlordCosts
): LandlordCostEstimate {
  const saleYear = prop.lastSaleDate ? new Date(prop.lastSaleDate).getFullYear() : 2020;
  return {
    address: prop.address,
    purchasePrice: prop.lastSalePrice || 0,
    purchaseYear: saleYear,
    mortgage: costs.mortgage,
    propertyTax: costs.propertyTax,
    hoa: Math.round((prop.hoaFee || 0) / Math.max(prop.units, 1)),
    insurance: costs.insurance,
    totalCosts: costs.total,
    annualCostIncrease: costs.totalCostChangePerMonth * 12,
    monthlyCostIncrease: costs.totalCostChangePerMonth,
  };
}
