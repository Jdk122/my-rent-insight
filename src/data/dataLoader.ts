import { BedroomType } from './rentData';

// ─── HUD Data Types ───
export interface HudZipData {
  state: string;
  city: string;
  county: string;
  metro: string;
  fmr_0br: number;
  fmr_1br: number;
  fmr_2br: number;
  fmr_3br: number;
  fmr_4br: number;
  fmr_0br_prior: number;
  fmr_1br_prior: number;
  fmr_2br_prior: number;
  fmr_3br_prior: number;
  fmr_4br_prior: number;
}

export interface CensusZipData {
  median_rent: number;
  median_income: number;
}

export interface FredTrendData {
  monthlyRate: number;
  trend: 'accelerating' | 'decelerating';
}

// ─── Combined result from all data layers ───
export interface RentLookupResult {
  zip: string;
  city: string;
  state: string;
  county: string;
  metro: string;
  fmr: number;           // Current FMR for selected bedroom count
  fmrPrior: number;      // Prior year FMR for selected bedroom count
  yoyChange: number;     // ((fmr - fmrPrior) / fmrPrior) * 100
  censusMedianRent: number | null;
  medianIncome: number | null;
  fredTrend: FredTrendData | null;
}

// ─── Bedroom mapping ───
const bedroomToFmrKey: Record<BedroomType, string> = {
  studio: '0br',
  oneBr: '1br',
  twoBr: '2br',
  threeBr: '3br',
  fourBr: '4br',
};

// ─── Caches ───
let hudCache: Record<string, HudZipData> | null = null;
let censusCache: Record<string, CensusZipData> | null = null;
let fredMetroMapCache: Record<string, string> | null = null;

// ─── Lazy loaders ───

async function getHudData(): Promise<Record<string, HudZipData>> {
  if (!hudCache) {
    const response = await fetch('/data/hudData.json');
    hudCache = await response.json();
  }
  return hudCache!;
}

async function getCensusData(): Promise<Record<string, CensusZipData>> {
  if (!censusCache) {
    const response = await fetch('/data/censusData.json');
    censusCache = await response.json();
  }
  return censusCache!;
}

async function getFredMetroMap(): Promise<Record<string, string>> {
  if (!fredMetroMapCache) {
    const response = await fetch('/data/fredMetroMap.json');
    fredMetroMapCache = await response.json();
  }
  return fredMetroMapCache!;
}

// ─── FRED API (optional, silent failure) ───

async function fetchFredTrend(metro: string): Promise<FredTrendData | null> {
  try {
    const metroMap = await getFredMetroMap();
    const seriesId = metroMap[metro];
    if (!seriesId) return null;

    // Check for API key — stored as env var or skip silently
    const apiKey = import.meta.env.VITE_FRED_API_KEY;
    if (!apiKey) return null;

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = twoYearsAgo.toISOString().split('T')[0];

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startDate}&frequency=m`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return calculateMonthlyTrend(data.observations);
  } catch {
    return null;
  }
}

function calculateMonthlyTrend(
  observations: Array<{ date: string; value: string }>
): FredTrendData | null {
  const values = observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .slice(-7); // Last 7 to get 6 month-over-month changes

  if (values.length < 4) return null;

  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const change =
      ((values[i].value - values[i - 1].value) / values[i - 1].value) * 100;
    changes.push(change);
  }

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

  // Compare recent 3 months to prior 3 months
  const recent = changes.slice(-3);
  const prior = changes.slice(0, Math.min(3, changes.length - 3));
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorAvg =
    prior.length > 0 ? prior.reduce((a, b) => a + b, 0) / prior.length : recentAvg;

  return {
    monthlyRate: Math.round(avgChange * 100) / 100,
    trend: recentAvg > priorAvg ? 'accelerating' : 'decelerating',
  };
}

// ─── Main lookup function ───

export async function lookupRentData(
  zip: string,
  bedrooms: BedroomType
): Promise<RentLookupResult | null> {
  // Load HUD + Census in parallel
  const [hudAll, censusAll] = await Promise.all([getHudData(), getCensusData()]);

  const hud = hudAll[zip];
  if (!hud) return null; // No HUD data = no results

  const brKey = bedroomToFmrKey[bedrooms];
  const fmr = hud[`fmr_${brKey}` as keyof HudZipData] as number;
  const fmrPrior = hud[`fmr_${brKey}_prior` as keyof HudZipData] as number;
  const yoyChange = Math.round(((fmr - fmrPrior) / fmrPrior) * 1000) / 10;

  const census = censusAll[zip] || null;

  return {
    zip,
    city: hud.city,
    state: hud.state,
    county: hud.county,
    metro: hud.metro,
    fmr,
    fmrPrior,
    yoyChange,
    censusMedianRent: census?.median_rent ?? null,
    medianIncome: census?.median_income ?? null,
    fredTrend: null, // Loaded separately
  };
}

// Fetch FRED data separately (non-blocking supplement)
export async function loadFredTrend(metro: string): Promise<FredTrendData | null> {
  return fetchFredTrend(metro);
}

// ─── Calculation helpers ───

export function calculateResults(
  currentRent: number,
  increasePercent: number,
  movingCosts: number,
  data: RentLookupResult
) {
  const proposedRent = Math.round(currentRent * (1 + increasePercent / 100));
  const extraPerYear = (proposedRent - currentRent) * 12;
  const marketYoyChange = data.yoyChange;
  const typicalRangeLow = data.fmr;
  const typicalRangeHigh = data.censusMedianRent
    ? Math.round(data.censusMedianRent * 1.15)
    : Math.round(data.fmr * 1.3);

  const rentBurden = data.medianIncome
    ? Math.round(((proposedRent * 12) / data.medianIncome) * 100)
    : null;
  const isCostBurdened = rentBurden !== null && rentBurden > 30;

  const increaseRatio =
    marketYoyChange > 0
      ? Math.round((increasePercent / marketYoyChange) * 10) / 10
      : 0;

  let verdict: 'below' | 'at-market' | 'above';
  if (increaseRatio <= 0.8) verdict = 'below';
  else if (increaseRatio <= 1.3) verdict = 'at-market';
  else verdict = 'above';

  // Break-even
  const benchmarkRent = data.censusMedianRent || data.fmr;
  const monthlySavings = proposedRent - benchmarkRent;
  const breakEvenMonths =
    monthlySavings > 0 ? movingCosts / monthlySavings : Infinity;

  // Counter offer
  const counterLowPercent = Math.round(marketYoyChange);
  const counterHighPercent = Math.round(marketYoyChange) + 1;
  const counterLow =
    Math.round((currentRent * (1 + counterLowPercent / 100)) / 25) * 25;
  const counterHigh =
    Math.round((currentRent * (1 + counterHighPercent / 100)) / 25) * 25;

  return {
    proposedRent,
    extraPerYear,
    marketYoyChange,
    typicalRangeLow,
    typicalRangeHigh,
    rentBurden,
    isCostBurdened,
    increaseRatio,
    verdict,
    breakEvenMonths,
    counterLowPercent,
    counterHighPercent,
    counterLow,
    counterHigh,
  };
}
