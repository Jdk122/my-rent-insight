import { getRentData, type RentZipRaw } from './dataLoader';

// ─── Slugs ───
export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming', PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands',
};

export function stateAbbrFromSlug(slug: string): string | null {
  for (const [abbr, name] of Object.entries(STATE_NAMES)) {
    if (slugify(name) === slug) return abbr;
  }
  return null;
}

export function stateNameFromAbbr(abbr: string): string {
  return STATE_NAMES[abbr] || abbr;
}

// ─── City aggregation ───

export interface CityZipEntry {
  zip: string;
  raw: RentZipRaw;
}

export interface CityData {
  city: string;
  state: string;
  stateSlug: string;
  citySlug: string;
  zips: CityZipEntry[];
  avgFmr: number[];      // [studio, 1br, 2br, 3br, 4br]
  censusMedianRent: number | null;
  yoyChange: number | null;
  cheapestZip: { zip: string; fmr1br: number } | null;
}

export interface StateData {
  stateAbbr: string;
  stateName: string;
  stateSlug: string;
  cities: CityData[];
  avgFmr1br: number;
  totalZips: number;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function getCityData(stateSlug: string, citySlug: string): Promise<CityData | null> {
  const stateAbbr = stateAbbrFromSlug(stateSlug);
  if (!stateAbbr) return null;

  const allData = await getRentData();
  const zips: CityZipEntry[] = [];

  for (const [zip, raw] of Object.entries(allData)) {
    if (raw.s !== stateAbbr) continue;
    if (slugify(raw.c || '') === citySlug) {
      zips.push({ zip, raw });
    }
  }

  if (zips.length === 0) return null;

  const cityName = zips[0].raw.c;
  const avgFmr = [0, 1, 2, 3, 4].map(i => avg(zips.map(z => z.raw.f[i])));

  // Census median rent (average of available)
  const censusRents = zips.map(z => z.raw.r).filter((r): r is number => r !== undefined && r !== null && r > 0);
  const censusMedianRent = censusRents.length > 0 ? avg(censusRents) : null;

  // YoY change: prefer Zillow where available, fall back to HUD
  const yoys = zips
    .map(z => z.raw.zy ?? (z.raw.p[1] > 0 ? Math.round(((z.raw.f[1] - z.raw.p[1]) / z.raw.p[1]) * 1000) / 10 : null))
    .filter((v): v is number => v !== null);
  const yoyChange = yoys.length > 0 ? Math.round((yoys.reduce((a, b) => a + b, 0) / yoys.length) * 10) / 10 : null;

  // Cheapest zip
  const sorted = [...zips].sort((a, b) => a.raw.f[1] - b.raw.f[1]);
  const cheapestZip = sorted.length > 0 ? { zip: sorted[0].zip, fmr1br: sorted[0].raw.f[1] } : null;

  return {
    city: cityName,
    state: stateAbbr,
    stateSlug,
    citySlug,
    zips: zips.sort((a, b) => a.raw.f[1] - b.raw.f[1]),
    avgFmr,
    censusMedianRent,
    yoyChange,
    cheapestZip,
  };
}

export async function getStateData(stateSlug: string): Promise<StateData | null> {
  const stateAbbr = stateAbbrFromSlug(stateSlug);
  if (!stateAbbr) return null;

  const allData = await getRentData();
  const cityMap = new Map<string, CityZipEntry[]>();

  for (const [zip, raw] of Object.entries(allData)) {
    if (raw.s !== stateAbbr) continue;
    const cityName = raw.c || 'Unknown';
    if (!cityMap.has(cityName)) cityMap.set(cityName, []);
    cityMap.get(cityName)!.push({ zip, raw });
  }

  if (cityMap.size === 0) return null;

  const cities: CityData[] = [];
  let totalZips = 0;
  const allFmr1br: number[] = [];

  for (const [cityName, zips] of cityMap) {
    totalZips += zips.length;
    const avgFmr = [0, 1, 2, 3, 4].map(i => avg(zips.map(z => z.raw.f[i])));
    allFmr1br.push(avgFmr[1]);

    const censusRents = zips.map(z => z.raw.r).filter((r): r is number => r !== undefined && r !== null && r > 0);
    const censusMedianRent = censusRents.length > 0 ? avg(censusRents) : null;

    const yoys = zips
      .map(z => z.raw.zy ?? (z.raw.p[1] > 0 ? Math.round(((z.raw.f[1] - z.raw.p[1]) / z.raw.p[1]) * 1000) / 10 : null))
      .filter((v): v is number => v !== null);
    const yoyChange = yoys.length > 0 ? Math.round((yoys.reduce((a, b) => a + b, 0) / yoys.length) * 10) / 10 : null;

    const sorted = [...zips].sort((a, b) => a.raw.f[1] - b.raw.f[1]);

    cities.push({
      city: cityName,
      state: stateAbbr,
      stateSlug,
      citySlug: slugify(cityName),
      zips: sorted,
      avgFmr,
      censusMedianRent,
      yoyChange,
      cheapestZip: sorted.length > 0 ? { zip: sorted[0].zip, fmr1br: sorted[0].raw.f[1] } : null,
    });
  }

  cities.sort((a, b) => a.avgFmr[1] - b.avgFmr[1]);

  return {
    stateAbbr,
    stateName: stateNameFromAbbr(stateAbbr),
    stateSlug,
    cities,
    avgFmr1br: avg(allFmr1br),
    totalZips,
  };
}

// Get nearby cities in same metro area for comparison
export async function getNearbyCities(city: string, state: string, metro: string, limit = 5): Promise<CityData[]> {
  const allData = await getRentData();
  const cityMap = new Map<string, CityZipEntry[]>();

  for (const [zip, raw] of Object.entries(allData)) {
    if (raw.m !== metro) continue;
    const cityName = raw.c || 'Unknown';
    const key = `${cityName}|${raw.s}`;
    if (cityName.toLowerCase() === city.toLowerCase() && raw.s === state) continue;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key)!.push({ zip, raw });
  }

  const results: CityData[] = [];
  for (const [key, zips] of cityMap) {
    const [cityName, st] = key.split('|');
    const avgFmr = [0, 1, 2, 3, 4].map(i => avg(zips.map(z => z.raw.f[i])));
    results.push({
      city: cityName,
      state: st,
      stateSlug: slugify(stateNameFromAbbr(st)),
      citySlug: slugify(cityName),
      zips,
      avgFmr,
      censusMedianRent: null,
      yoyChange: null,
      cheapestZip: null,
    });
    if (results.length >= limit) break;
  }

  return results;
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
