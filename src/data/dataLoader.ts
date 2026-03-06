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
  fs?: 'safmr' | 'county'; // FMR source: ZIP-level SAFMR or county-level FMR
  r?: number;          // Census median gross rent (dormant — not used in scoring)
  i?: number;          // Census median household income (dormant — not used in scoring)
  // Zillow ZORI trend data (~15% of zips, covers ~80% of renters)
  zy?: number;         // Zillow 12-month YoY % (capped ±35%) — PRIMARY when present
  zm?: number;         // Month-over-month % change
  zt?: number;         // 3-month trend (annualized %)
  zd?: string;         // Direction: "rising" | "falling" | "flat"
}

// ─── ZHVI (Zillow Home Value Index) data ───
export interface ZhviZipRaw {
  hvy: number;         // YoY % change in home values
  hvm: number;         // MoM % change
  hvt: number;         // 3-month trailing average MoM
  hvd: 'rising' | 'falling' | 'flat';  // Direction
}

// ─── Apartment List rental market data ───
export interface ApartmentListZipRaw {
  aly?: number;        // YoY rent growth % (transacted rents, bedroom-blended)
  alm?: number;        // MoM rent growth %
  alv?: number;        // Vacancy rate %
  alt?: number;        // Time on market in days
  alr?: string;        // Source county name (for attribution)
}

// ─── HUD 50th percentile (median) rents ───
export interface Hud50ZipRaw {
  f50: number[];       // [studio, 1br, 2br, 3br, 4br] median rent
}

export interface FredTrendData {
  monthlyChange: number;
  yearlyChange: number | null;
  direction: 'rising' | 'falling' | 'flat';
  label: string;
}

// ─── County/Metro ZORI fallback data ───
export interface CountyMetroZoriRaw {
  zy?: number;         // YoY %
  zm?: number;         // Monthly %
  zt?: number;         // 3-month annualized %
  zd?: 'rising' | 'falling' | 'flat';
  src?: 'county' | 'metro';
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
  yoySource: 'zillow' | 'hud';
  yoySourceLabel: string;
  yoyCapped?: boolean;
  yoyReliability: 'market' | 'government';
  priorSource: 'f' | 'a' | 'm' | 'n';
  fmrSource: 'safmr' | 'county' | 'unknown'; // ZIP-level SAFMR vs county-level FMR
  censusMedianRent: number | null;
  medianIncome: number | null;
  fredTrend: FredTrendData | null;
  // Zillow trend data (when available)
  zillowMonthly: number | null;
  zillowDirection: string | null;
  zillow3moTrend: number | null;
  // ZHVI home value proxy (when ZORI unavailable)
  hvd: 'rising' | 'falling' | 'flat' | null;
  // Apartment List data (when available)
  alYoY: number | null;           // YoY rent growth %
  alMoM: number | null;           // MoM rent growth %
  alVacancy: number | null;       // Vacancy rate %
  alTimeOnMarket: number | null;  // Time on market in days
  alRegion: string | null;        // Source county name
  // HUD 50th percentile (median) rents
  f50: number[] | null;           // [studio, 1br, 2br, 3br, 4br]
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
let countyFmrCache: Record<string, RentZipRaw> | null = null;
let fredMetroMapCache: Record<string, string> | null = null;
let zhviCache: Record<string, ZhviZipRaw> | null = null;
let apartmentListCache: Record<string, ApartmentListZipRaw> | null = null;
let hud50Cache: Record<string, Hud50ZipRaw> | null = null;
let countyMetroZoriCache: Record<string, CountyMetroZoriRaw> | null = null;

// ─── Lazy loaders ───

export async function getRentData(): Promise<Record<string, RentZipRaw>> {
  if (!rentDataCache) {
    const response = await fetch('/data/rentData.json');
    rentDataCache = await response.json();
  }
  return rentDataCache!;
}

async function getCountyFmrData(): Promise<Record<string, RentZipRaw>> {
  if (!countyFmrCache) {
    const urls = ['/data/county_fmr.json'];
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (projectId) {
      urls.push(`https://${projectId}.supabase.co/storage/v1/object/public/temp-data/county_fmr.json`);
    }
    if (supabaseUrl) {
      urls.push(`${supabaseUrl}/storage/v1/object/public/temp-data/county_fmr.json`);
    }

    countyFmrCache = {};
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          countyFmrCache = await response.json();
          break;
        }
      } catch {
        // try next source
      }
    }
  }
  return countyFmrCache!;
}

async function getZhviData(): Promise<Record<string, ZhviZipRaw>> {
  if (!zhviCache) {
    try {
      const response = await fetch('/data/zhvi_processed.json');
      zhviCache = await response.json();
    } catch {
      zhviCache = {};
    }
  }
  return zhviCache!;
}

export async function getApartmentListData(): Promise<Record<string, ApartmentListZipRaw>> {
  if (!apartmentListCache) {
    try {
      const response = await fetch('/data/apartmentlist_processed.json');
      apartmentListCache = await response.json();
    } catch {
      apartmentListCache = {};
    }
  }
  return apartmentListCache!;
}

export async function getHud50Data(): Promise<Record<string, Hud50ZipRaw>> {
  if (!hud50Cache) {
    try {
      const response = await fetch('/data/hud50_processed.json');
      hud50Cache = await response.json();
    } catch {
      hud50Cache = {};
    }
  }
  return hud50Cache!;
}

export async function getCountyMetroZori(): Promise<Record<string, CountyMetroZoriRaw>> {
  if (!countyMetroZoriCache) {
    try {
      const response = await fetch('/data/county_metro_zori.json');
      countyMetroZoriCache = await response.json();
    } catch {
      countyMetroZoriCache = {};
    }
  }
  return countyMetroZoriCache!;
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

// ─── Data quality constants ───
const YOY_CAP = 30; // Cap displayed YoY at ±30%
const HUD_EXTREME_CAP = 3.0; // Cap HUD-only YoY when > ±10% (national FMR weighted avg)
const HUD_EXTREME_THRESHOLD = 10; // Threshold for capping HUD YoY
const MIN_VALID_INCOME = 10000; // Suppress income below this (bad Census data)
const MAX_CENSUS_FMR_RATIO = 2.5; // Suppress census rent if it diverges >2.5x from FMR

// ─── Main lookup function ───

export async function lookupRentData(
  zip: string,
  bedrooms: BedroomType
): Promise<RentLookupResult | null> {
  const [allData, countyData, zhviData, alData, hud50Data, cmZoriData] = await Promise.all([
    getRentData(), getCountyFmrData(), getZhviData(), getApartmentListData(), getHud50Data(), getCountyMetroZori()
  ]);
  // Primary: SAFMR data. Fallback: county-level FMR.
  let raw = allData[zip];
  let fmrSource: 'safmr' | 'county' | 'unknown' = 'safmr';
  if (!raw && countyData[zip]) {
    raw = countyData[zip];
    fmrSource = 'county';
  } else if (raw) {
    fmrSource = (raw.fs as 'safmr' | 'county') || 'safmr';
  }
  if (!raw) return null;
  const zhvi = zhviData[zip] ?? null;
  const al = alData[zip] ?? null;
  const hud50 = hud50Data[zip] ?? null;
  const cmZori = cmZoriData[zip] ?? null;

  const brIdx = bedroomToIndex[bedrooms];
  const fmr = raw.f[brIdx];
  const fmrPrior = raw.p[brIdx];

  // YoY Priority: (1) ZIP ZORI → (2) County/Metro ZORI → (3) bedroom-specific HUD → (4) pre-computed 1BR
  let yoyChange: number;
  let yoySource: 'zillow' | 'hud';
  let yoySourceLabel: string;
  let yoyReliability: 'market' | 'government';
  // Track whether we filled Zillow fields from county/metro fallback
  let zillowMonthlyOut: number | null = raw.zm ?? null;
  let zillowDirectionOut: string | null = raw.zd ?? null;
  let zillow3moTrendOut: number | null = raw.zt ?? null;

  if (raw.zy !== undefined && raw.zy !== null) {
    // Priority 1: ZIP-level Zillow ZORI
    yoyChange = raw.zy;
    yoySource = 'zillow';
    yoyReliability = 'market';
    const cName = raw.c || raw.m.split(',')[0] || `ZIP ${zip}`;
    yoySourceLabel = `Based on ${cName} market data through Jan 2026`;
  } else if (cmZori && cmZori.zy !== undefined && cmZori.zy !== null) {
    // Priority 2: County/Metro ZORI fallback
    yoyChange = cmZori.zy;
    yoySource = 'zillow';
    yoyReliability = 'market';
    const cName = raw.c || raw.m.split(',')[0] || `ZIP ${zip}`;
    const metroName = raw.m || `ZIP ${zip}`;
    yoySourceLabel = cmZori.src === 'county'
      ? `Based on ${cName} county market data through Jan 2026`
      : `Based on ${metroName} metro area data through Jan 2026`;
    // Populate Zillow fields from county/metro data
    zillowMonthlyOut = cmZori.zm ?? null;
    zillowDirectionOut = cmZori.zd ?? null;
    zillow3moTrendOut = cmZori.zt ?? null;
  } else if (fmrPrior > 0) {
    // Priority 3: Bedroom-specific HUD FMR
    yoyChange = Math.round(((fmr - fmrPrior) / fmrPrior) * 1000) / 10;
    yoySource = 'hud';
    yoyReliability = 'government';
    yoySourceLabel = 'Based on HUD Fair Market Rent data (FY2026)';
  } else {
    // Priority 4: Pre-computed 1BR fallback
    yoyChange = raw.y;
    yoySource = 'hud';
    yoyReliability = 'government';
    yoySourceLabel = 'Based on HUD Fair Market Rent data (FY2026)';
  }

  // Guard 1: Cap extreme YoY values
  let yoyCapped = Math.abs(yoyChange) > YOY_CAP;
  yoyChange = Math.max(-YOY_CAP, Math.min(YOY_CAP, yoyChange));

  // Guard 1b: Cap HUD-only extreme YoY to national average
  if (yoyReliability === 'government' && Math.abs(yoyChange) > HUD_EXTREME_THRESHOLD) {
    yoyChange = yoyChange > 0 ? HUD_EXTREME_CAP : -HUD_EXTREME_CAP;
    yoyCapped = true;
  }

  // Guard 2: Suppress clearly bad income data
  const validIncome = (raw.i && raw.i >= MIN_VALID_INCOME) ? raw.i : null;

  // Guard 3: Fix empty state (Puerto Rico nonmetro zips)
  const state = raw.s || (raw.m.includes('PR') || raw.m.includes('Puerto Rico') ? 'PR' : '');

  // Guard 4: Suppress census rent when it diverges wildly from FMR
  let censusRent = raw.r ?? null;
  if (censusRent) {
    const fmr2br = raw.f[2];
    const ratio = Math.max(censusRent / fmr2br, fmr2br / censusRent);
    if (ratio > MAX_CENSUS_FMR_RATIO) {
      censusRent = null;
    }
  }

  // Override known problem zip-to-city mappings
  const CITY_OVERRIDES: Record<string, string> = {
    '07087': 'Union City',
    '11101': 'Long Island City',
  };
  const cityName = CITY_OVERRIDES[zip] || raw.c || raw.m.split(',')[0] || `ZIP ${zip}`;

  return {
    zip,
    city: cityName,
    state,
    metro: raw.m,
    fmr,
    fmrPrior,
    yoyChange,
    yoySource,
    yoySourceLabel,
    yoyCapped: yoyCapped || undefined,
    yoyReliability,
    priorSource: raw.ps,
    fmrSource,
    censusMedianRent: censusRent,
    medianIncome: validIncome,
    fredTrend: null,
    zillowMonthly: zillowMonthlyOut,
    zillowDirection: zillowDirectionOut,
    zillow3moTrend: zillow3moTrendOut,
    hvd: zhvi?.hvd ?? null,
    alYoY: al?.aly ?? null,
    alMoM: al?.alm ?? null,
    alVacancy: al?.alv ?? null,
    alTimeOnMarket: al?.alt ?? null,
    alRegion: al?.alr ?? null,
    f50: hud50?.f50 ?? null,
  };
}

// Fetch FRED data separately (non-blocking supplement)
export async function loadFredTrend(metro: string): Promise<FredTrendData | null> {
  return fetchFredTrend(metro);
}

// ─── FRED State Vacancy Rate ───

export interface VacancyRateResult {
  rate: number;
  year: string;
  stateName: string;
  isFallback: boolean;
}

const NATIONAL_AVG_VACANCY = 7.0;
let vacancyCache: Record<string, VacancyRateResult> = {};

export async function fetchStateVacancyRate(stateAbbr: string, stateName: string): Promise<VacancyRateResult> {
  if (vacancyCache[stateAbbr]) return vacancyCache[stateAbbr];

  const fallback: VacancyRateResult = { rate: NATIONAL_AVG_VACANCY, year: '2024', stateName, isFallback: true };

  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return fallback;

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/fred-vacancy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateAbbr }),
      }
    );
    if (!response.ok) return fallback;

    const data = await response.json();
    const result: VacancyRateResult = {
      rate: data.rate ?? NATIONAL_AVG_VACANCY,
      year: data.year ?? '2024',
      stateName,
      isFallback: data.isFallback ?? true,
    };
    vacancyCache[stateAbbr] = result;
    return result;
  } catch {
    return fallback;
  }
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

export interface VerdictContext {
  proposedRent?: number;
  compMedian?: number | null;
  fmrUpperBound?: number | null;
}

export function getVerdict(
  increasePct: number,
  marketYoY: number,
  ctx?: VerdictContext
): 'below' | 'at-market' | 'above' {
  const rateExceedsTrend = increasePct - marketYoY > 2;
  const proposedRent = ctx?.proposedRent;
  const compMedian = ctx?.compMedian;
  const fmrUpper = ctx?.fmrUpperBound;

  // Check if proposed rent is at/below comp median
  const belowCompMedian = compMedian != null && proposedRent != null && proposedRent <= compMedian;
  // Check if proposed rent is within HUD FMR upper bound (FMR * 1.15)
  const withinFmr = fmrUpper != null && proposedRent != null && proposedRent <= fmrUpper;

  // Below market: increase below trend AND at/below comp median (or no comps)
  if (increasePct < marketYoY && (belowCompMedian || compMedian == null)) {
    return 'below';
  }

  // Above market: rate exceeds trend by >2pp AND (above comp median OR above FMR upper)
  if (rateExceedsTrend) {
    // Both conditions must hold for "above": rate is high AND rent is high
    const rentIsHigh = (compMedian != null && proposedRent != null && proposedRent > compMedian)
      || (fmrUpper != null && proposedRent != null && proposedRent > fmrUpper);
    // If we have no comp/FMR data to check, fall back to rate-only with looser threshold
    const noRentContext = compMedian == null && fmrUpper == null;

    if (rentIsHigh || noRentContext) {
      return 'above';
    }
    // Rate exceeds trend but rent is reasonable → at-market
    return 'at-market';
  }

  // Within 2pp of trend → at-market
  return Math.abs(increasePct - marketYoY) <= 2 ? 'at-market' : 'below';
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
  // counterLow = current rent adjusted by market trend
  const counterLow = Math.round((currentRent * (1 + counterPct / 100)) / 25) * 25;
  // counterHigh = counterLow + 3% buffer
  const counterHigh = Math.round((counterLow * 1.03) / 25) * 25;
  return {
    counterLow: Math.max(counterLow, currentRent),
    counterHigh: Math.max(counterHigh, counterLow),
    counterLowPercent: Math.round(counterPct * 10) / 10,
    counterHighPercent: Math.round((counterHigh / currentRent - 1) * 1000) / 10,
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

  // Flag: suppress counter-offer display if it meets or exceeds proposed rent
  const counterExceedsProposed = counter.counterLow >= proposedRent;

  const increaseRatio = marketYoY > 0
    ? Math.round((increasePercent / marketYoY) * 10) / 10
    : 0;

  // Break-even: use HUD Fair Market Rent as the benchmark
  const benchmarkRent = data.fmr;
  const monthlySavings = proposedRent - benchmarkRent;
  const breakEvenMonths = monthlySavings > 0 ? movingCosts / monthlySavings : Infinity;

  // Rent burden for both current and proposed
  const currentRentBurden = getRentBurden(currentRent, data.medianIncome);
  const proposedRentBurden = rentBurden;

  return {
    proposedRent,
    extraPerYear,
    marketYoY,
    typicalRangeLow: range.low,
    typicalRangeHigh: range.high,
    rangeLabel: range.label,
    rentBurden: rentBurden?.percent ?? null,
    currentRentBurden: currentRentBurden?.percent ?? null,
    isCostBurdened: rentBurden?.isBurdened ?? false,
    increaseRatio,
    verdict,
    breakEvenMonths,
    counterExceedsProposed,
    ...counter,
  };
}
