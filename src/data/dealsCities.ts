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
  { slug: 'manhattan', name: 'Manhattan', state: 'new-york', stateAbbr: 'NY', zips: ['10001', '10002', '10003', '10009', '10010', '10011', '10012', '10013', '10014', '10016', '10017', '10019', '10021', '10022', '10023', '10024', '10025', '10028', '10029', '10031', '10032', '10033', '10034', '10036', '10037', '10038', '10039', '10040'] },
  { slug: 'brooklyn', name: 'Brooklyn', state: 'new-york', stateAbbr: 'NY', zips: ['11201', '11205', '11206', '11211', '11215', '11216', '11217', '11221', '11222', '11225', '11226', '11231', '11233', '11238'] },
  { slug: 'hoboken', name: 'Hoboken', state: 'new-jersey', stateAbbr: 'NJ', zips: ['07030'] },
  { slug: 'jersey-city', name: 'Jersey City', state: 'new-jersey', stateAbbr: 'NJ', zips: ['07302', '07304', '07306', '07307', '07310'] },
  { slug: 'boston', name: 'Boston', state: 'massachusetts', stateAbbr: 'MA', zips: ['02108', '02109', '02110', '02111', '02113', '02114', '02115', '02116', '02118', '02119', '02120', '02121', '02122', '02124', '02125', '02126', '02127', '02128', '02129', '02130', '02131', '02132', '02134', '02135', '02136'] },
  { slug: 'miami', name: 'Miami', state: 'florida', stateAbbr: 'FL', zips: ['33125', '33126', '33127', '33128', '33129', '33130', '33131', '33132', '33133', '33134', '33135', '33136', '33137', '33138', '33139', '33140', '33141', '33142', '33143', '33144', '33145', '33146', '33147', '33149', '33150'] },
  { slug: 'san-francisco', name: 'San Francisco', state: 'california', stateAbbr: 'CA', zips: ['94102', '94103', '94104', '94105', '94107', '94108', '94109', '94110', '94111', '94112', '94114', '94115', '94116', '94117', '94118', '94121', '94122', '94123', '94124', '94127', '94131', '94132', '94133', '94134'] },
  { slug: 'los-angeles', name: 'Los Angeles', state: 'california', stateAbbr: 'CA', zips: ['90001', '90004', '90005', '90006', '90007', '90010', '90012', '90013', '90014', '90015', '90017', '90019', '90020', '90024', '90025', '90026', '90027', '90028', '90029', '90034', '90035', '90036', '90038', '90039', '90046'] },
  { slug: 'san-diego', name: 'San Diego', state: 'california', stateAbbr: 'CA', zips: ['92101', '92102', '92103', '92104', '92105', '92106', '92107', '92108', '92109', '92110', '92111', '92113', '92114', '92115', '92116', '92117', '92120', '92122', '92123', '92126', '92127', '92128', '92129', '92130', '92131'] },
  { slug: 'seattle', name: 'Seattle', state: 'washington', stateAbbr: 'WA', zips: ['98101', '98102', '98103', '98104', '98105', '98106', '98107', '98108', '98109', '98112', '98115', '98116', '98117', '98118', '98119', '98121', '98122', '98125', '98126', '98133', '98134', '98136', '98144', '98146', '98155'] },
];

export function findDealCity(slug: string): DealCity | undefined {
  return DEAL_CITIES.find(c => c.slug === slug);
}
