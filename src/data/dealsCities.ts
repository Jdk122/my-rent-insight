export interface DealCity {
  slug: string;
  name: string;
  neighborhood?: string;
  state: string;
  stateAbbr: string;
  zips: string[];
}

export const DEAL_CITIES: DealCity[] = [
  // NYC
  { slug: 'east-village', name: 'East Village', neighborhood: 'East Village', state: 'new-york', stateAbbr: 'NY', zips: ['10003', '10009'] },
  { slug: 'chelsea-nyc', name: 'Chelsea', neighborhood: 'Chelsea', state: 'new-york', stateAbbr: 'NY', zips: ['10001', '10011'] },
  { slug: 'brooklyn-heights', name: 'Brooklyn Heights', neighborhood: 'Brooklyn Heights', state: 'new-york', stateAbbr: 'NY', zips: ['11201'] },
  { slug: 'astoria', name: 'Astoria', neighborhood: 'Astoria', state: 'new-york', stateAbbr: 'NY', zips: ['11101', '11102', '11106'] },
  // NJ
  { slug: 'jersey-city', name: 'Jersey City', neighborhood: 'Jersey City', state: 'new-jersey', stateAbbr: 'NJ', zips: ['07302', '07304', '07306'] },
  // Miami
  { slug: 'brickell', name: 'Brickell', neighborhood: 'Brickell', state: 'florida', stateAbbr: 'FL', zips: ['33129', '33131'] },
  { slug: 'wynwood', name: 'Wynwood', neighborhood: 'Wynwood', state: 'florida', stateAbbr: 'FL', zips: ['33127', '33137'] },
  { slug: 'coral-gables', name: 'Coral Gables', neighborhood: 'Coral Gables', state: 'florida', stateAbbr: 'FL', zips: ['33134', '33146'] },
  // Chicago
  { slug: 'lincoln-park', name: 'Lincoln Park', neighborhood: 'Lincoln Park', state: 'illinois', stateAbbr: 'IL', zips: ['60614'] },
  { slug: 'wicker-park', name: 'Wicker Park', neighborhood: 'Wicker Park', state: 'illinois', stateAbbr: 'IL', zips: ['60622'] },
  { slug: 'lakeview', name: 'Lakeview', neighborhood: 'Lakeview', state: 'illinois', stateAbbr: 'IL', zips: ['60657'] },
  // Austin
  { slug: 'east-austin', name: 'East Austin', neighborhood: 'East Austin', state: 'texas', stateAbbr: 'TX', zips: ['78702'] },
  { slug: 'south-congress', name: 'South Congress', neighborhood: 'South Congress', state: 'texas', stateAbbr: 'TX', zips: ['78704'] },
  { slug: 'downtown-austin', name: 'Downtown Austin', neighborhood: 'Downtown Austin', state: 'texas', stateAbbr: 'TX', zips: ['78701'] },
  // San Francisco
  { slug: 'mission-district', name: 'Mission District', neighborhood: 'Mission District', state: 'california', stateAbbr: 'CA', zips: ['94110'] },
  { slug: 'soma-sf', name: 'SoMa', neighborhood: 'SoMa', state: 'california', stateAbbr: 'CA', zips: ['94103'] },
  { slug: 'pacific-heights', name: 'Pacific Heights', neighborhood: 'Pacific Heights', state: 'california', stateAbbr: 'CA', zips: ['94115'] },
];

export function findDealCity(slug: string): DealCity | undefined {
  return DEAL_CITIES.find(c => c.slug === slug);
}
