export interface DealCity {
  slug: string;
  name: string;
  neighborhood?: string;
  state: string;
  stateAbbr: string;
  zips: string[];
}

export const DEAL_CITIES: DealCity[] = [
  { slug: 'east-village', name: 'East Village', neighborhood: 'East Village', state: 'new-york', stateAbbr: 'NY', zips: ['10003', '10009'] },
];

export function findDealCity(slug: string): DealCity | undefined {
  return DEAL_CITIES.find(c => c.slug === slug);
}
