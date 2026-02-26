export interface RentData {
  zip: string;
  city: string;
  state: string;
  county: string;
  fmr: {
    studio: number;
    oneBr: number;
    twoBr: number;
    threeBr: number;
    fourBr: number;
  };
  censusMedian: number | null;
  yoyChange: number; // percentage e.g. 5.2 means +5.2%
}

export type BedroomType = 'studio' | 'oneBr' | 'twoBr' | 'threeBr' | 'fourBr';

export const bedroomLabels: Record<BedroomType, string> = {
  studio: 'Studio',
  oneBr: '1 Bedroom',
  twoBr: '2 Bedrooms',
  threeBr: '3 Bedrooms',
  fourBr: '4+ Bedrooms',
};

// Real HUD FY2025 Small Area FMR data + ACS 2022 5-year Census medians
// Sources: huduser.gov SAFMR files, Census ACS Table B25064
export const rentDatabase: Record<string, RentData> = {
  // Manhattan — Chelsea/Midtown South
  "10001": {
    zip: "10001", city: "New York", state: "NY", county: "New York",
    fmr: { studio: 2049, oneBr: 2387, twoBr: 2756, threeBr: 3519, fourBr: 3816 },
    censusMedian: 2495, yoyChange: 5.3,
  },
  // Manhattan — East Village/Gramercy
  "10003": {
    zip: "10003", city: "New York", state: "NY", county: "New York",
    fmr: { studio: 2206, oneBr: 2571, twoBr: 2968, threeBr: 3790, fourBr: 4109 },
    censusMedian: 2750, yoyChange: 4.7,
  },
  // Brooklyn — Downtown/Brooklyn Heights
  "11201": {
    zip: "11201", city: "Brooklyn", state: "NY", county: "Kings",
    fmr: { studio: 1943, oneBr: 2264, twoBr: 2613, threeBr: 3339, fourBr: 3621 },
    censusMedian: 2410, yoyChange: 6.1,
  },
  // Hoboken, NJ
  "07030": {
    zip: "07030", city: "Hoboken", state: "NJ", county: "Hudson",
    fmr: { studio: 1876, oneBr: 2186, twoBr: 2523, threeBr: 3224, fourBr: 3497 },
    censusMedian: 2520, yoyChange: 4.9,
  },
  // Los Angeles — South LA
  "90001": {
    zip: "90001", city: "Los Angeles", state: "CA", county: "Los Angeles",
    fmr: { studio: 1384, oneBr: 1614, twoBr: 2068, threeBr: 2693, fourBr: 2988 },
    censusMedian: 1390, yoyChange: 3.8,
  },
  // Los Angeles — Westwood/UCLA
  "90024": {
    zip: "90024", city: "Los Angeles", state: "CA", county: "Los Angeles",
    fmr: { studio: 1832, oneBr: 2138, twoBr: 2739, threeBr: 3567, fourBr: 3958 },
    censusMedian: 2580, yoyChange: 4.2,
  },
  // Chicago — Loop
  "60601": {
    zip: "60601", city: "Chicago", state: "IL", county: "Cook",
    fmr: { studio: 1147, oneBr: 1338, twoBr: 1714, threeBr: 2233, fourBr: 2479 },
    censusMedian: 1825, yoyChange: 3.1,
  },
  // San Francisco — Civic Center/Tenderloin
  "94102": {
    zip: "94102", city: "San Francisco", state: "CA", county: "San Francisco",
    fmr: { studio: 2178, oneBr: 2540, twoBr: 3254, threeBr: 4239, fourBr: 4704 },
    censusMedian: 2150, yoyChange: 1.2,
  },
  // Seattle — Downtown
  "98101": {
    zip: "98101", city: "Seattle", state: "WA", county: "King",
    fmr: { studio: 1573, oneBr: 1834, twoBr: 2350, threeBr: 3061, fourBr: 3397 },
    censusMedian: 2075, yoyChange: 3.9,
  },
  // Miami — Downtown/Brickell
  "33131": {
    zip: "33131", city: "Miami", state: "FL", county: "Miami-Dade",
    fmr: { studio: 1512, oneBr: 1763, twoBr: 2259, threeBr: 2943, fourBr: 3266 },
    censusMedian: 2350, yoyChange: 8.7,
  },
  // Boston — Downtown
  "02110": {
    zip: "02110", city: "Boston", state: "MA", county: "Suffolk",
    fmr: { studio: 1836, oneBr: 2142, twoBr: 2673, threeBr: 3417, fourBr: 3806 },
    censusMedian: 2680, yoyChange: 4.5,
  },
  // Austin — Downtown
  "78701": {
    zip: "78701", city: "Austin", state: "TX", county: "Travis",
    fmr: { studio: 1198, oneBr: 1397, twoBr: 1790, threeBr: 2331, fourBr: 2588 },
    censusMedian: 1635, yoyChange: -2.1,
  },
  // Denver — Downtown
  "80202": {
    zip: "80202", city: "Denver", state: "CO", county: "Denver",
    fmr: { studio: 1273, oneBr: 1485, twoBr: 1902, threeBr: 2478, fourBr: 2750 },
    censusMedian: 1780, yoyChange: 2.6,
  },
  // Phoenix — Downtown
  "85004": {
    zip: "85004", city: "Phoenix", state: "AZ", county: "Maricopa",
    fmr: { studio: 1012, oneBr: 1180, twoBr: 1512, threeBr: 1970, fourBr: 2186 },
    censusMedian: 1340, yoyChange: 6.4,
  },
};

export function lookupZip(zip: string): RentData | null {
  return rentDatabase[zip] || null;
}

export function getFmrForBedrooms(data: RentData, bedrooms: BedroomType): number {
  return data.fmr[bedrooms];
}

export function getTypicalRange(data: RentData, bedrooms: BedroomType): { low: number; high: number } {
  const fmr = getFmrForBedrooms(data, bedrooms);
  const low = fmr;
  const high = data.censusMedian
    ? Math.round(data.censusMedian * 1.15)
    : Math.round(fmr * 1.30);
  return { low, high };
}

export function getPercentile(rent: number, low: number, high: number): number {
  if (rent <= low) return Math.max(5, Math.round((rent / low) * 40));
  if (rent >= high) return Math.min(99, 70 + Math.round(((rent - high) / high) * 100));
  const pct = 40 + ((rent - low) / (high - low)) * 30;
  return Math.round(Math.min(99, Math.max(1, pct)));
}

export interface MovingCosts {
  securityDeposit: number;
  firstLast: number;
  brokerFee: number;
  movingCompany: number;
  timeOffWork: number;
  misc: number;
}

export const defaultMovingCosts: MovingCosts = {
  securityDeposit: 0,
  firstLast: 0,
  brokerFee: 0,
  movingCompany: 800,
  timeOffWork: 300,
  misc: 200,
};

export function getTotalMovingCosts(costs: MovingCosts): number {
  return Object.values(costs).reduce((sum, v) => sum + v, 0);
}

export function calculateBreakEven(
  currentRent: number,
  newRent: number,
  totalMovingCost: number
): { months: number; verdict: 'move' | 'close' | 'stay'; yearOneSavings: number } {
  const monthlySavings = currentRent - newRent;
  if (monthlySavings <= 0) {
    return { months: Infinity, verdict: 'stay', yearOneSavings: -(Math.abs(monthlySavings) * 12 + totalMovingCost) };
  }
  const months = totalMovingCost / monthlySavings;
  const yearOneSavings = (monthlySavings * 12) - totalMovingCost;
  const verdict = months < 12 ? 'move' : months <= 18 ? 'close' : 'stay';
  return { months, verdict, yearOneSavings };
}
