export interface DealsCityConfig {
  name: string;
  state: string;
  zips: string[];
  metroLabel: string;
  displayName: string;
}

export const DEALS_CITIES: Record<string, DealsCityConfig> = {
  'manhattan': {
    name: 'Manhattan',
    state: 'NY',
    zips: ['10001', '10003', '10011', '10014', '10019', '10028', '10002', '10036', '10016', '10024'],
    metroLabel: 'New York City',
    displayName: 'Manhattan, NYC',
  },
  'brooklyn': {
    name: 'Brooklyn',
    state: 'NY',
    zips: ['11201', '11215', '11211', '11217', '11231', '11205', '11221', '11216'],
    metroLabel: 'New York City',
    displayName: 'Brooklyn, NYC',
  },
  'hoboken': { name: 'Hoboken', state: 'NJ', zips: ['07030'], metroLabel: 'Northern NJ', displayName: 'Hoboken, NJ' },
  'jersey-city': { name: 'Jersey City', state: 'NJ', zips: ['07302', '07306', '07304', '07310'], metroLabel: 'Northern NJ', displayName: 'Jersey City, NJ' },
  'boston': { name: 'Boston', state: 'MA', zips: ['02108', '02116', '02127', '02130', '02118', '02215'], metroLabel: 'Boston', displayName: 'Boston, MA' },
  'miami': { name: 'Miami', state: 'FL', zips: ['33130', '33132', '33137', '33139', '33125', '33136'], metroLabel: 'Miami', displayName: 'Miami, FL' },
  'san-francisco': { name: 'San Francisco', state: 'CA', zips: ['94102', '94103', '94107', '94110', '94109', '94114'], metroLabel: 'San Francisco', displayName: 'San Francisco, CA' },
  'los-angeles': { name: 'Los Angeles', state: 'CA', zips: ['90012', '90015', '90036', '90028', '90026', '90046'], metroLabel: 'Los Angeles', displayName: 'Los Angeles, CA' },
  'san-diego': { name: 'San Diego', state: 'CA', zips: ['92101', '92103', '92104', '92116'], metroLabel: 'San Diego', displayName: 'San Diego, CA' },
  'seattle': { name: 'Seattle', state: 'WA', zips: ['98101', '98102', '98103', '98109', '98122'], metroLabel: 'Seattle', displayName: 'Seattle, WA' },
};

export function getDealsCity(zip: string): string | null {
  if (DEALS_CITIES['manhattan'].zips.includes(zip)) return 'manhattan';
  if (DEALS_CITIES['brooklyn'].zips.includes(zip)) return 'brooklyn';

  if (zip === '07030') return 'hoboken';
  if (['07302', '07304', '07306', '07310'].includes(zip)) return 'jersey-city';
  if (zip.startsWith('021')) return 'boston';
  if (zip.startsWith('331')) return 'miami';
  if (zip.startsWith('941')) return 'san-francisco';
  if (zip.startsWith('900')) return 'los-angeles';
  if (zip.startsWith('921')) return 'san-diego';
  if (zip.startsWith('981')) return 'seattle';
  return null;
}

export function getDealsCityDisplayName(zip: string): string | null {
  const slug = getDealsCity(zip);
  if (!slug) return null;
  return DEALS_CITIES[slug]?.displayName ?? null;
}
