import { BedroomType } from './rentData';

// ─── Raw JSON schema (compact keys for file size) ───
export interface RentZipRaw {
  c: string;           // City name
  s: string;           // State abbreviation
  m: string;           // Metro area name (for FRED lookup)
  f: number[];         // Current FMR: [0BR, 1BR, 2BR, 3BR, 4BR]
  p: number[];         // Prior year FMR
  y: number;           // Pre-computed YoY % change for 1BR
  ps: 'f' | 'a' | 'm' | 'n'; // Prior source
  r?: number;          // Census median gross rent
  i?: number;          // Census median household income
}

export interface FredTrendData {
  monthlyChange: number;
  yearlyChange: number | null;
  direction: 'rising' | 'falling' | 'flat';
  label: string;
}

// ─── Combined result from all data layers ───
export interface RentLookupResult {
  zip: string;
  city: string;
  state: string;
  metro: string;
  fmr: number;
  fmrPrior: number;
  yoyChange: number;
  priorSource: 'f' | 'a' | 'm' | 'n';
  censusMedianRent: number | null;
  medianIncome: number | null;
  fredTrend: FredTrendData | null;
}

// ─── Bedroom mapping ───
const bedroomToIndex: Record<BedroomType, number> = {
  studio: 0,
  oneBr: 1,
  twoBr: 2,
  threeBr: 3,
  fourBr: 4,
};

// ─── Cache ───
let rentDataCache: Record<string, RentZipRaw> | null = null;
let fredMetroMapCache: Record<string, string> | null = null;

// ─── Lazy loaders ───

async function getRentData(): Promise<Record<string, RentZipRaw>> {
  if (!rentDataCache) {
    const response = await fetch('/data/rentData.json');
    rentDataCache = await response.json();
  }
  return rentDataCache!;
}

async function getFredMetroMap(): Promise<Record<string, string>> {
  if (!fredMetroMapCache) {
    const response = await fetch('/data/fredMetroMap.json');
    fredMetroMapCache = await response.json();
  }
  return fredMetroMapCache!;
}

// ─── FRED API (optional, silent failure) ───

function getFredSeriesFromMetro(metroName: string, metroMap: Record<string, string>): string | null {
  // Try matching first city in metro name
  const city = metroName.split('-')[0].split(',')[0].trim();
  return metroMap[city] || null;
}

async function fetchFredTrend(metro: string): Promise<FredTrendData | null> {
  try {
    const metroMap = await getFredMetroMap();
    const seriesId = getFredSeriesFromMetro(metro, metroMap);
    if (!seriesId) return null;

    const apiKey = import.meta.env.VITE_FRED_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=13`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const observations = data.observations
      .filter((o: { value: string }) => o.value !== '.')
      .map((o: { date: string; value: string }) => ({
        date: o.date,
        value: parseFloat(o.value),
      }));

    if (observations.length < 2) return null;

    const latest = observations[0].value;
    const prior = observations[1].value;
    const monthlyChange = ((latest - prior) / prior) * 100;

    const yearAgo = observations.length >= 12 ? observations[11] : null;
    const yearlyChange = yearAgo
      ? Math.round(((latest - yearAgo.value) / yearAgo.value) * 100 * 100) / 100
      : null;

    const roundedMonthly = Math.round(monthlyChange * 100) / 100;

    return {
      monthlyChange: roundedMonthly,
      yearlyChange,
      direction: monthlyChange > 0.1 ? 'rising' : monthlyChange < -0.1 ? 'falling' : 'flat',
      label: `Rents ${monthlyChange > 0.1 ? 'rising' : monthlyChange < -0.1 ? 'falling' : 'flat'} ${Math.abs(roundedMonthly).toFixed(1)}%/mo`,
    };
  } catch {
    return null;
  }
}

// ─── Main lookup function ───

export async function lookupRentData(
  zip: string,
  bedrooms: BedroomType
): Promise<RentLookupResult | null> {
  const allData = await getRentData();
  const raw = allData[zip];
  if (!raw) return null;

  const brIdx = bedroomToIndex[bedrooms];
  const fmr = raw.f[brIdx];
  const fmrPrior = raw.p[brIdx];

  // Calculate YoY for selected bedroom (more accurate than pre-computed 1BR)
  const yoyChange = fmrPrior > 0
    ? Math.round(((fmr - fmrPrior) / fmrPrior) * 1000) / 10
    : raw.y;

  return {
    zip,
    city: raw.c || raw.m.split(',')[0] || `ZIP ${zip}`,
    state: raw.s,
    metro: raw.m,
    fmr,
    fmrPrior,
    yoyChange,
    priorSource: raw.ps,
    censusMedianRent: raw.r ?? null,
    medianIncome: raw.i ?? null,
    fredTrend: null,
  };
}

// Fetch FRED data separately (non-blocking supplement)
export async function loadFredTrend(metro: string): Promise<FredTrendData | null> {
  return fetchFredTrend(metro);
}

// ─── Calculation helpers ───

export function getTypicalRange(fmr: number, censusRent: number | null, city: string) {
  if (censusRent) {
    const low = Math.min(fmr, censusRent);
    const high = Math.max(fmr, Math.round(censusRent * 1.15));

    // If range is too narrow (< 10% spread), widen it
    if ((high - low) / low < 0.10) {
      return {
        low: Math.round(fmr * 0.90),
        high: Math.round(fmr * 1.15),
        label: `${city} typical range`,
      };
    }
    return { low, high, label: `${city} typical range` };
  }

  // No census data: FMR ±15%
  return {
    low: Math.round(fmr * 0.85),
    high: Math.round(fmr * 1.15),
    label: `${city} estimated range`,
  };
}

export function getVerdict(increasePct: number, marketYoY: number): 'below' | 'at-market' | 'above' {
  if (marketYoY <= 0) {
    return increasePct > 0 ? 'above' : 'at-market';
  }
  const ratio = increasePct / marketYoY;
  if (ratio <= 0.8) return 'below';
  if (ratio <= 1.3) return 'at-market';
  return 'above';
}

export function getCounterOffer(currentRent: number, marketYoY: number) {
  if (marketYoY <= 0) {
    return {
      counterLow: currentRent,
      counterHigh: currentRent,
      counterLowPercent: 0,
      counterHighPercent: 0,
    };
  }
  const counterPct = Math.max(marketYoY, 1.0);
  const counterLow = Math.ceil((currentRent * (1 + counterPct / 100)) / 25) * 25;
  const counterHighPct = Math.round(counterPct) + 1;
  const counterHigh = Math.ceil((currentRent * (1 + counterHighPct / 100)) / 25) * 25;
  return {
    counterLow,
    counterHigh,
    counterLowPercent: Math.round(counterPct * 10) / 10,
    counterHighPercent: counterHighPct,
  };
}

export function getRentBurden(proposedRent: number, medianIncome: number | null) {
  if (!medianIncome) return null;
  const burden = ((proposedRent * 12) / medianIncome) * 100;
  return {
    percent: Math.round(burden),
    isBurdened: burden > 30,
  };
}

export function calculateResults(
  currentRent: number,
  increasePercent: number,
  movingCosts: number,
  data: RentLookupResult
) {
  const proposedRent = Math.round(currentRent * (1 + increasePercent / 100));
  const extraPerYear = (proposedRent - currentRent) * 12;
  const marketYoY = data.yoyChange;

  const range = getTypicalRange(data.fmr, data.censusMedianRent, data.city);
  const verdict = getVerdict(increasePercent, marketYoY);
  const rentBurden = getRentBurden(proposedRent, data.medianIncome);
  const counter = getCounterOffer(currentRent, marketYoY);

  const increaseRatio = marketYoY > 0
    ? Math.round((increasePercent / marketYoY) * 10) / 10
    : 0;

  // Break-even
  const benchmarkRent = data.censusMedianRent || data.fmr;
  const monthlySavings = proposedRent - benchmarkRent;
  const breakEvenMonths = monthlySavings > 0 ? movingCosts / monthlySavings : Infinity;

  return {
    proposedRent,
    extraPerYear,
    marketYoY,
    typicalRangeLow: range.low,
    typicalRangeHigh: range.high,
    rangeLabel: range.label,
    rentBurden: rentBurden?.percent ?? null,
    isCostBurdened: rentBurden?.isBurdened ?? false,
    increaseRatio,
    verdict,
    breakEvenMonths,
    ...counter,
  };
}
