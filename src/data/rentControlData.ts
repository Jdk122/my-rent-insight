// Rent control / stabilization laws by jurisdiction
// Manually compiled from state statutes & city ordinances
// Sources: nolo.com/rent-control, local municipal codes

export interface RentControlLaw {
  jurisdiction: string; // city or state name
  level: 'state' | 'city';
  hasRentControl: boolean;
  maxIncreasePct: number | null; // null = no statutory cap
  maxIncreaseFormula: string | null; // e.g. "5% + CPI" or "CPI" or "10%"
  noticePeriodDays: number | null; // required notice for increases
  applicability: string; // what units are covered
  exemptions: string; // what's excluded
  ordinanceUrl: string | null;
  notes: string | null;
}

// Lookup: zip → jurisdiction key(s)
// A zip can be covered by both state and city law
export interface RentControlResult {
  stateLaw: RentControlLaw | null;
  cityLaw: RentControlLaw | null;
}

const stateLaws: Record<string, RentControlLaw> = {
  CA: {
    jurisdiction: 'California',
    level: 'state',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: '5% + local CPI (max 10%)',
    noticePeriodDays: 30, // 90 days if increase >10%
    applicability: 'Most residential units built before 2005 (AB-1482, Tenant Protection Act)',
    exemptions: 'Single-family homes (with notice), units <15 years old, owner-occupied duplexes',
    ordinanceUrl: 'https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=201920200AB1482',
    notes: 'Local city ordinances may impose stricter limits. 90-day notice required for increases over 10%.',
  },
  OR: {
    jurisdiction: 'Oregon',
    level: 'state',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: '7% + CPI',
    noticePeriodDays: 90,
    applicability: 'Most residential units (SB 608)',
    exemptions: 'Units less than 15 years old, subsidized housing',
    ordinanceUrl: 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
    notes: 'First state to enact statewide rent control (2019).',
  },
  NJ: {
    jurisdiction: 'New Jersey',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30,
    applicability: 'No statewide cap, but municipalities may enact rent control ordinances',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'Over 100 NJ municipalities have some form of rent control. Check your city.',
  },
  NY: {
    jurisdiction: 'New York',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30, // 60 days if >5% or >1yr tenancy, 90 days if >2yr tenancy
    applicability: 'No statewide cap. Notice requirements vary by tenancy length.',
    exemptions: 'N/A',
    ordinanceUrl: 'https://www.nysenate.gov/legislation/laws/RPP/226-C',
    notes: '30-day notice for <1yr tenancy; 60 days for 1-2yr; 90 days for 2yr+. NYC has separate rent stabilization.',
  },
  WA: {
    jurisdiction: 'Washington',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 60,
    applicability: 'No statewide cap, but 60-day written notice required for all increases.',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'State preempts local rent control (cities cannot enact their own caps).',
  },
  FL: {
    jurisdiction: 'Florida',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30, // 60 for >5%
    applicability: 'No rent control. State preempts local rent control.',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'Florida prohibits local governments from imposing rent control except in housing emergencies.',
  },
  MA: {
    jurisdiction: 'Massachusetts',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30,
    applicability: 'No rent control since 1994 statewide ban.',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'Rent control was banned by statewide ballot measure in 1994. Some tenant protections remain in Boston.',
  },
  TX: {
    jurisdiction: 'Texas',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30,
    applicability: 'No rent control. State law prohibits municipalities from enacting rent control.',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'Texas Property Code §214.902 preempts local rent control.',
  },
  CO: {
    jurisdiction: 'Colorado',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 21,
    applicability: 'No statewide rent control, but local ban was lifted in 2021.',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'HB21-1117 removed the statewide preemption, allowing local governments to enact rent control.',
  },
  AZ: {
    jurisdiction: 'Arizona',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30,
    applicability: 'No rent control. State preempts local rent control.',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'Arizona law prohibits municipalities from controlling rent.',
  },
  IL: {
    jurisdiction: 'Illinois',
    level: 'state',
    hasRentControl: false,
    maxIncreasePct: null,
    maxIncreaseFormula: null,
    noticePeriodDays: 30,
    applicability: 'No statewide rent control. State previously preempted local control (repealed 2023).',
    exemptions: 'N/A',
    ordinanceUrl: null,
    notes: 'Preemption repealed 2023, allowing municipalities to enact rent control. None have yet.',
  },
};

// Normalize borough/variant names to city law keys
const cityNameAliases: Record<string, string> = {
  'New York': 'New York City',
  'New York City': 'New York City',
  'Manhattan': 'New York City',
  'Brooklyn': 'New York City',
  'Queens': 'New York City',
  'Bronx': 'New York City',
  'The Bronx': 'New York City',
  'Staten Island': 'New York City',
  'Long Island City': 'New York City',
  'Astoria': 'New York City',
  'Flushing': 'New York City',
  'Harlem': 'New York City',
  'Williamsburg': 'New York City',
  'Bushwick': 'New York City',
  'San Francisco': 'San Francisco',
  'Los Angeles': 'Los Angeles',
  'Hoboken': 'Hoboken',
  'Jersey City': 'Jersey City',
  'Washington': 'Washington',
};

function normalizeCityName(city: string): string | undefined {
  // Direct match first
  if (cityNameAliases[city]) return cityNameAliases[city];
  // Case-insensitive match
  const lower = city.toLowerCase();
  for (const [alias, canonical] of Object.entries(cityNameAliases)) {
    if (alias.toLowerCase() === lower) return canonical;
  }
  return undefined;
}

const cityLaws: Record<string, RentControlLaw> = {
  'New York City': {
    jurisdiction: 'New York City',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: 'Set annually by Rent Guidelines Board (RGB)',
    noticePeriodDays: 90, // for increases >5%
    applicability: 'Rent-stabilized units (buildings with 6+ units built before 1974, ~1 million units citywide)',
    exemptions: 'New construction, buildings with fewer than 6 units, owner-occupied small buildings',
    ordinanceUrl: 'https://hcr.ny.gov/rent-stabilization',
    notes: 'RGB 2024–25 guidelines: 2.75% for 1-year renewals, 5.25% for 2-year renewals. If your unit is rent-stabilized, these caps apply — not the market trend. Check your lease or ask your landlord. You can verify stabilization status at hcr.ny.gov.',
  },
  'San Francisco': {
    jurisdiction: 'San Francisco',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: '60% of Bay Area CPI increase (typically 1–3%)',
    noticePeriodDays: 30,
    applicability: 'Units in buildings with 2+ units built before June 13, 1979',
    exemptions: 'Single-family homes, condos, units built after 1979',
    ordinanceUrl: 'https://sfrb.org/',
    notes: '2024 allowable increase: 1.7%. Landlords may also pass through certain capital improvement costs.',
  },
  'Los Angeles': {
    jurisdiction: 'Los Angeles',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: '3–8% (set annually by LAHD, based on CPI)',
    noticePeriodDays: 30,
    applicability: 'Units in buildings with 2+ units built before October 1, 1978 (RSO)',
    exemptions: 'Single-family homes, condos, units built after 1978',
    ordinanceUrl: 'https://housing.lacity.org/residents/rso-overview',
    notes: '2024 allowable increase: 4%. LA also has a Just Cause eviction requirement for RSO units.',
  },
  'Hoboken': {
    jurisdiction: 'Hoboken',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: 'CPI-based (typically 2–4%)',
    noticePeriodDays: 30,
    applicability: 'Most multi-family rental units',
    exemptions: 'New construction (30-year exemption), owner-occupied 2-3 unit buildings',
    ordinanceUrl: 'https://www.hobokennj.gov/resources/rent-control',
    notes: 'Hoboken Rent Leveling & Stabilization Board oversees disputes.',
  },
  'Jersey City': {
    jurisdiction: 'Jersey City',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: 'CPI-based (typically 2–4%)',
    noticePeriodDays: 30,
    applicability: 'Most multi-family rental units',
    exemptions: 'New construction (30-year tax abatement exemption), owner-occupied 2-3 unit buildings',
    ordinanceUrl: 'https://www.jerseycitynj.gov/community/rentcontrol',
    notes: 'Jersey City Rent Leveling Board oversees disputes.',
  },
  'Washington': {
    jurisdiction: 'Washington, DC',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: 'CPI + 2% (max 10%)',
    noticePeriodDays: 30,
    applicability: 'Rental units built before 1975',
    exemptions: 'Units built after 1975, federally or DC-subsidized units',
    ordinanceUrl: 'https://ota.dc.gov/page/rent-stabilization-program',
    notes: 'Elderly and disabled tenants have a lower cap (CPI only). Registration with OTA required.',
  },
};

// Map zip codes to city law jurisdictions
// NYC zips are handled dynamically via isNycZip() below
const zipToCityLaw: Record<string, string> = {
  '94102': 'San Francisco',
  '90001': 'Los Angeles',
  '90024': 'Los Angeles',
  '07030': 'Hoboken',
};

// NYC zip code ranges cover all 5 boroughs
function isNycZip(zip: string): boolean {
  const n = parseInt(zip, 10);
  if (isNaN(n)) return false;
  // Manhattan: 10001–10282
  if (n >= 10001 && n <= 10282) return true;
  // Bronx: 10451–10475
  if (n >= 10451 && n <= 10475) return true;
  // Staten Island: 10301–10314
  if (n >= 10301 && n <= 10314) return true;
  // Brooklyn: 11201–11256
  if (n >= 11201 && n <= 11256) return true;
  // Queens: 11001–11109, 11351–11697
  if (n >= 11001 && n <= 11109) return true;
  if (n >= 11351 && n <= 11697) return true;
  return false;
}

function isJerseyCityZip(zip: string): boolean {
  const jcZips = ['07302', '07304', '07305', '07306', '07307', '07310', '07311'];
  return jcZips.includes(zip);
}

function isDcZip(zip: string): boolean {
  const n = parseInt(zip, 10);
  return !isNaN(n) && n >= 20001 && n <= 20599;
}

// Map zip codes to state abbreviations (expanded)
const zipToState: Record<string, string> = {
  '07030': 'NJ',
  '90001': 'CA',
  '90024': 'CA',
  '60601': 'IL',
  '94102': 'CA',
  '98101': 'WA',
  '33131': 'FL',
  '02110': 'MA',
  '78701': 'TX',
  '80202': 'CO',
  '85004': 'AZ',
};

function getStateFromZip(zip: string): string | undefined {
  if (zipToState[zip]) return zipToState[zip];
  if (isNycZip(zip)) return 'NY';
  if (isJerseyCityZip(zip)) return 'NJ';
  if (isDcZip(zip)) return 'DC';
  // CA zip ranges
  const n = parseInt(zip, 10);
  if (!isNaN(n) && n >= 90001 && n <= 96162) return 'CA';
  if (!isNaN(n) && n >= 97001 && n <= 97920) return 'OR';
  if (!isNaN(n) && n >= 98001 && n <= 99403) return 'WA';
  if (!isNaN(n) && n >= 60001 && n <= 62999) return 'IL';
  if (!isNaN(n) && n >= 32003 && n <= 34997) return 'FL';
  if (!isNaN(n) && n >= 1001 && n <= 2791) return 'MA';
  if (!isNaN(n) && n >= 73301 && n <= 79999) return 'TX';
  if (!isNaN(n) && n >= 80001 && n <= 81658) return 'CO';
  if (!isNaN(n) && n >= 85001 && n <= 86556) return 'AZ';
  if (!isNaN(n) && n >= 7001 && n <= 8989) return 'NJ';
  if (!isNaN(n) && n >= 10001 && n <= 14975) return 'NY';
  return undefined;
}

function getCityFromZip(zip: string): string | undefined {
  if (zipToCityLaw[zip]) return zipToCityLaw[zip];
  if (isNycZip(zip)) return 'New York City';
  if (isJerseyCityZip(zip)) return 'Jersey City';
  if (isDcZip(zip)) return 'Washington';
  return undefined;
}

export function getRentControlForZip(zip: string): RentControlResult {
  const stateAbbr = getStateFromZip(zip);
  const cityName = getCityFromZip(zip);

  return {
    stateLaw: stateAbbr ? stateLaws[stateAbbr] || null : null,
    cityLaw: cityName ? cityLaws[cityName] || null : null,
  };
}

/** Look up rent control by state abbreviation and city name (more reliable than zip-only lookup) */
export function getRentControlByStateCity(stateAbbr: string, cityName: string): RentControlResult {
  const normalizedCity = normalizeCityName(cityName);
  return {
    stateLaw: stateLaws[stateAbbr] || null,
    cityLaw: normalizedCity ? cityLaws[normalizedCity] || null : null,
  };
}

export function getApplicableCap(result: RentControlResult): RentControlLaw | null {
  // City law takes precedence (usually stricter)
  if (result.cityLaw?.hasRentControl) return result.cityLaw;
  if (result.stateLaw?.hasRentControl) return result.stateLaw;
  return null;
}

export function getNoticeRequirement(result: RentControlResult): { days: number; source: string } | null {
  // Return the longer notice period
  const cityDays = result.cityLaw?.noticePeriodDays ?? 0;
  const stateDays = result.stateLaw?.noticePeriodDays ?? 0;

  if (cityDays === 0 && stateDays === 0) return null;

  if (cityDays >= stateDays && result.cityLaw) {
    return { days: cityDays, source: result.cityLaw.jurisdiction };
  }
  if (result.stateLaw) {
    return { days: stateDays, source: result.stateLaw.jurisdiction };
  }
  return null;
}
