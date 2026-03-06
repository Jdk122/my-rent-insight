// Data freshness dates for display on SEO pages

export interface DataFreshness {
  hud_safmr: string;
  hud_50pct: string;
  apartment_list: string;
  zillow_zori: string;
  zillow_zhvi: string;
  rentcast: string;
}

let cache: DataFreshness | null = null;

export async function getDataFreshness(): Promise<DataFreshness> {
  if (!cache) {
    try {
      const res = await fetch('/data/data_freshness.json');
      cache = await res.json();
    } catch {
      cache = {
        hud_safmr: '2025-10-01',
        hud_50pct: '2025-10-01',
        apartment_list: '2026-02-28',
        zillow_zori: '2026-02-15',
        zillow_zhvi: '2026-02-15',
        rentcast: 'realtime',
      };
    }
  }
  return cache!;
}

/** Returns the freshest non-realtime date and its label */
export function getFreshestDate(
  freshness: DataFreshness,
  hasZillow: boolean,
  hasAL: boolean,
): { date: string; label: string } {
  const candidates: { date: string; label: string }[] = [];
  if (hasAL) candidates.push({ date: freshness.apartment_list, label: 'Apartment List' });
  if (hasZillow) candidates.push({ date: freshness.zillow_zori, label: 'Zillow ZORI' });
  candidates.push({ date: freshness.hud_safmr, label: 'HUD FMR' });
  // Sort descending by date
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0];
}

export function formatFreshnessDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** HUD fiscal year: calendar year of SAFMR date + 1 if Oct or later */
export function getHudFiscalYear(freshness: DataFreshness): string {
  const date = new Date(freshness.hud_safmr + 'T00:00:00');
  const fy = date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
  return String(fy);
}

/** Most recent data year across all sources */
export function getDataYear(freshness: DataFreshness): string {
  const dates = [freshness.apartment_list, freshness.zillow_zori, freshness.hud_safmr]
    .map(d => new Date(d + 'T00:00:00'))
    .sort((a, b) => b.getTime() - a.getTime());
  return String(dates[0].getFullYear());
}
