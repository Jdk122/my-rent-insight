import { BedroomType, getFmrForBedrooms, RentData } from './rentData';

export interface LandlordCostEstimate {
  address: string;
  purchasePrice: number;
  purchaseYear: number;
  mortgage: number;
  propertyTax: number;
  hoa: number;
  insurance: number;
  totalCosts: number;
  annualCostIncrease: number; // typical yearly increase in taxes/insurance/HOA
  monthlyCostIncrease: number;
}

/**
 * Deterministic hash from a string — same address always gives same numbers.
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate plausible landlord cost estimates from address + rent data.
 * Uses deterministic hashing so same address always produces same results.
 * Later this will be replaced with real property record API data.
 */
export function estimateLandlordCosts(
  address: string,
  rentData: RentData,
  bedrooms: BedroomType
): LandlordCostEstimate {
  const hash = hashCode(address.toLowerCase().trim());
  const fmr = getFmrForBedrooms(rentData, bedrooms);

  // Purchase price: 200-250x monthly FMR, varied by hash
  const priceMultiplier = 200 + (hash % 51); // 200-250
  const purchasePrice = Math.round(fmr * priceMultiplier / 1000) * 1000;

  // Purchase year: 3-7 years ago, varied by hash
  const currentYear = new Date().getFullYear();
  const yearsAgo = 3 + (hash % 5); // 3-7
  const purchaseYear = currentYear - yearsAgo;

  // Mortgage: 80% LTV, 30-year fixed at 4.5% (typical for 3-7 years ago)
  const loanAmount = purchasePrice * 0.8;
  const monthlyRate = 0.045 / 12;
  const numPayments = 360;
  const mortgage = Math.round(
    loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );

  // Property tax: 1.2-1.8% of purchase price / 12, varied by hash
  const taxRate = 1.2 + ((hash % 7) * 0.1); // 1.2-1.8%
  const propertyTax = Math.round((purchasePrice * (taxRate / 100)) / 12);

  // HOA: varies by bedroom count and hash
  const hoaBase: Record<BedroomType, number> = {
    studio: 280, oneBr: 350, twoBr: 420, threeBr: 500, fourBr: 580,
  };
  const hoaVariance = -80 + ((hash >> 4) % 161); // -80 to +80
  const hoa = Math.max(0, Math.round((hoaBase[bedrooms] + hoaVariance) / 10) * 10);

  // Insurance: $100-200/month
  const insurance = 100 + Math.round(((hash >> 8) % 11) * 10); // 100-200

  const totalCosts = mortgage + propertyTax + hoa + insurance;

  // Annual cost increase: 2.5% of non-mortgage costs (taxes, HOA, insurance go up)
  const variableCosts = propertyTax + hoa + insurance;
  const annualCostIncrease = Math.round(variableCosts * 0.025 * 12);
  const monthlyCostIncrease = Math.round(annualCostIncrease / 12);

  return {
    address,
    purchasePrice,
    purchaseYear,
    mortgage,
    propertyTax,
    hoa,
    insurance,
    totalCosts,
    annualCostIncrease,
    monthlyCostIncrease,
  };
}
