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

// Mock data for top 20 zip codes
export const rentDatabase: Record<string, RentData> = {
  "10001": {
    zip: "10001", city: "New York", state: "NY", county: "New York",
    fmr: { studio: 1872, oneBr: 2147, twoBr: 2513, threeBr: 3190, fourBr: 3548 },
    censusMedian: 2380, yoyChange: 4.8,
  },
  "10003": {
    zip: "10003", city: "New York", state: "NY", county: "New York",
    fmr: { studio: 2010, oneBr: 2310, twoBr: 2720, threeBr: 3420, fourBr: 3810 },
    censusMedian: 2650, yoyChange: 5.1,
  },
  "10011": {
    zip: "10011", city: "New York", state: "NY", county: "New York",
    fmr: { studio: 2150, oneBr: 2480, twoBr: 2890, threeBr: 3650, fourBr: 4100 },
    censusMedian: 2800, yoyChange: 3.9,
  },
  "11201": {
    zip: "11201", city: "Brooklyn", state: "NY", county: "Kings",
    fmr: { studio: 1780, oneBr: 2050, twoBr: 2420, threeBr: 3080, fourBr: 3450 },
    censusMedian: 2320, yoyChange: 6.2,
  },
  "07030": {
    zip: "07030", city: "Hoboken", state: "NJ", county: "Hudson",
    fmr: { studio: 1820, oneBr: 2147, twoBr: 2520, threeBr: 3200, fourBr: 3580 },
    censusMedian: 2380, yoyChange: 5.5,
  },
  "90001": {
    zip: "90001", city: "Los Angeles", state: "CA", county: "Los Angeles",
    fmr: { studio: 1350, oneBr: 1620, twoBr: 2050, threeBr: 2680, fourBr: 2980 },
    censusMedian: 1850, yoyChange: 3.2,
  },
  "90024": {
    zip: "90024", city: "Los Angeles", state: "CA", county: "Los Angeles",
    fmr: { studio: 1780, oneBr: 2120, twoBr: 2650, threeBr: 3380, fourBr: 3750 },
    censusMedian: 2420, yoyChange: 4.5,
  },
  "60601": {
    zip: "60601", city: "Chicago", state: "IL", county: "Cook",
    fmr: { studio: 1050, oneBr: 1280, twoBr: 1550, threeBr: 2010, fourBr: 2350 },
    censusMedian: 1480, yoyChange: 2.8,
  },
  "60614": {
    zip: "60614", city: "Chicago", state: "IL", county: "Cook",
    fmr: { studio: 1180, oneBr: 1420, twoBr: 1750, threeBr: 2280, fourBr: 2620 },
    censusMedian: 1650, yoyChange: 3.5,
  },
  "77001": {
    zip: "77001", city: "Houston", state: "TX", county: "Harris",
    fmr: { studio: 850, oneBr: 1020, twoBr: 1280, threeBr: 1650, fourBr: 1920 },
    censusMedian: 1150, yoyChange: 2.1,
  },
  "85001": {
    zip: "85001", city: "Phoenix", state: "AZ", county: "Maricopa",
    fmr: { studio: 920, oneBr: 1080, twoBr: 1320, threeBr: 1710, fourBr: 1980 },
    censusMedian: 1220, yoyChange: 7.8,
  },
  "19101": {
    zip: "19101", city: "Philadelphia", state: "PA", county: "Philadelphia",
    fmr: { studio: 980, oneBr: 1180, twoBr: 1420, threeBr: 1820, fourBr: 2100 },
    censusMedian: 1350, yoyChange: 3.1,
  },
  "92101": {
    zip: "92101", city: "San Diego", state: "CA", county: "San Diego",
    fmr: { studio: 1520, oneBr: 1810, twoBr: 2250, threeBr: 2890, fourBr: 3220 },
    censusMedian: 2100, yoyChange: 4.2,
  },
  "75201": {
    zip: "75201", city: "Dallas", state: "TX", county: "Dallas",
    fmr: { studio: 1020, oneBr: 1220, twoBr: 1510, threeBr: 1950, fourBr: 2280 },
    censusMedian: 1380, yoyChange: 3.8,
  },
  "78701": {
    zip: "78701", city: "Austin", state: "TX", county: "Travis",
    fmr: { studio: 1150, oneBr: 1380, twoBr: 1720, threeBr: 2210, fourBr: 2580 },
    censusMedian: 1580, yoyChange: -1.2,
  },
  "94102": {
    zip: "94102", city: "San Francisco", state: "CA", county: "San Francisco",
    fmr: { studio: 2050, oneBr: 2450, twoBr: 3100, threeBr: 3950, fourBr: 4380 },
    censusMedian: 2820, yoyChange: 1.5,
  },
  "98101": {
    zip: "98101", city: "Seattle", state: "WA", county: "King",
    fmr: { studio: 1480, oneBr: 1780, twoBr: 2180, threeBr: 2810, fourBr: 3150 },
    censusMedian: 2050, yoyChange: 3.6,
  },
  "80201": {
    zip: "80201", city: "Denver", state: "CO", county: "Denver",
    fmr: { studio: 1180, oneBr: 1420, twoBr: 1780, threeBr: 2280, fourBr: 2620 },
    censusMedian: 1620, yoyChange: 2.4,
  },
  "33101": {
    zip: "33101", city: "Miami", state: "FL", county: "Miami-Dade",
    fmr: { studio: 1380, oneBr: 1650, twoBr: 2050, threeBr: 2680, fourBr: 3020 },
    censusMedian: 1880, yoyChange: 9.1,
  },
  "02101": {
    zip: "02101", city: "Boston", state: "MA", county: "Suffolk",
    fmr: { studio: 1680, oneBr: 2020, twoBr: 2480, threeBr: 3150, fourBr: 3520 },
    censusMedian: 2280, yoyChange: 4.0,
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
  securityDeposit: 0, // delta handled in calculation
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
