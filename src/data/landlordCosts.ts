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

/**
 * Deterministic hash from a string — same address always gives same numbers.
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate plausible landlord cost estimates from address + FMR.
 * Uses deterministic hashing so same address always produces same results.
 */
export function estimateLandlordCosts(
  address: string,
  fmr: number
): LandlordCostEstimate {
  const hash = hashCode(address.toLowerCase().trim());

  // Purchase price: 200-250x monthly FMR, varied by hash
  const priceMultiplier = 200 + (hash % 51);
  const purchasePrice = Math.round(fmr * priceMultiplier / 1000) * 1000;

  // Purchase year: 3-7 years ago
  const currentYear = new Date().getFullYear();
  const yearsAgo = 3 + (hash % 5);
  const purchaseYear = currentYear - yearsAgo;

  // Mortgage: 80% LTV, 30-year fixed at 4.5%
  const loanAmount = purchasePrice * 0.8;
  const monthlyRate = 0.045 / 12;
  const numPayments = 360;
  const mortgage = Math.round(
    loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );

  // Property tax: 1.2-1.8%
  const taxRate = 1.2 + ((hash % 7) * 0.1);
  const propertyTax = Math.round((purchasePrice * (taxRate / 100)) / 12);

  // HOA
  const hoaBase = 350 + (fmr > 2000 ? 100 : 0);
  const hoaVariance = -80 + ((hash >> 4) % 161);
  const hoa = Math.max(0, Math.round((hoaBase + hoaVariance) / 10) * 10);

  // Insurance
  const insurance = 100 + Math.round(((hash >> 8) % 11) * 10);

  const totalCosts = mortgage + propertyTax + hoa + insurance;

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
