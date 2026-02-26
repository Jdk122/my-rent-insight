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

const cityLaws: Record<string, RentControlLaw> = {
  'New York City': {
    jurisdiction: 'New York City',
    level: 'city',
    hasRentControl: true,
    maxIncreasePct: null,
    maxIncreaseFormula: 'Set annually by Rent Guidelines Board (typically 1.5–3.5% per year)',
    noticePeriodDays: 90, // for increases >5%
    applicability: 'Rent-stabilized units (buildings with 6+ units built before 1974)',
    exemptions: 'Units with rent above deregulation threshold (removed by 2019 law), new construction, owner-occupied small buildings',
    ordinanceUrl: 'https://hcr.ny.gov/rent-stabilization',
    notes: 'Approx. 1 million rent-stabilized units in NYC. Check your lease for stabilization status. 2024 guideline: 2.75% for 1-year leases.',
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
};

// Map zip codes to city law jurisdictions
const zipToCityLaw: Record<string, string> = {
  '10001': 'New York City',
  '10003': 'New York City',
  '11201': 'New York City',
  '94102': 'San Francisco',
  '90001': 'Los Angeles',
  '90024': 'Los Angeles',
  '07030': 'Hoboken',
};

// Map zip codes to state abbreviations
const zipToState: Record<string, string> = {
  '10001': 'NY',
  '10003': 'NY',
  '11201': 'NY',
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

export function getRentControlForZip(zip: string): RentControlResult {
  const stateAbbr = zipToState[zip];
  const cityName = zipToCityLaw[zip];

  return {
    stateLaw: stateAbbr ? stateLaws[stateAbbr] || null : null,
    cityLaw: cityName ? cityLaws[cityName] || null : null,
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
