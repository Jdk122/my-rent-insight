import { BedroomType } from '@/data/rentData';
import { trackEvent } from '@/lib/analytics';

interface CompLinksProps {
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
  verdict?: string;
  fairnessScore?: number | null;
}

const AFFILIATE_CONFIG: Record<string, { param?: string; id?: string }> = {
  Zillow: {},
  'Apartments.com': {},
  'Realtor.com': {},
  HotPads: {},
  StreetEasy: {},
};

function appendAffiliate(url: string, platform: string): string {
  const config = AFFILIATE_CONFIG[platform];
  if (!config?.param || !config?.id) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${config.param}=${config.id}`;
}

const bedroomNum: Record<BedroomType, string> = {
  studio: '0', oneBr: '1', twoBr: '2', threeBr: '3', fourBr: '4',
};

const bedroomLabel: Record<BedroomType, string> = {
  studio: 'studio', oneBr: '1-bedroom', twoBr: '2-bedroom', threeBr: '3-bedroom', fourBr: '4-bedroom',
};

function buildLinks(zip: string, city: string, state: string, bedrooms: BedroomType) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const beds = bedroomNum[bedrooms];
  const isNYC = state === 'NY' && ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].includes(city);

  const links: { name: string; url: string }[] = [];

  if (isNYC) {
    links.push({
      name: 'StreetEasy',
      url: appendAffiliate(`https://streeteasy.com/for-rent/${citySlug}?bedrooms=${bedrooms === 'studio' ? 'studio' : beds}`, 'StreetEasy'),
    });
  }

  links.push(
    { name: 'Zillow', url: appendAffiliate(`https://www.zillow.com/homes/for_rent/${zip}/${beds}-_beds/`, 'Zillow') },
    { name: 'Apartments.com', url: appendAffiliate(`https://www.apartments.com/${citySlug}-${stateSlug}-${zip}/${bedrooms === 'studio' ? 'studios' : beds + '-bedrooms'}/`, 'Apartments.com') },
    { name: 'Realtor.com', url: appendAffiliate(`https://www.realtor.com/apartments/${zip}/beds-${beds}`, 'Realtor.com') },
    { name: 'HotPads', url: appendAffiliate(`https://hotpads.com/${citySlug}-${stateSlug}/apartments-for-rent/${beds === '0' ? 'studio' : beds + '-beds'}`, 'HotPads') },
  );

  return links;
}

const CompLinks = ({ zip, city, state, bedrooms, verdict, fairnessScore }: CompLinksProps) => {
  const links = buildLinks(zip, city, state, bedrooms);

  return (
    <div className="text-center">
      <h2 className="section-title">Check What Other {bedroomLabel[bedrooms]}s in {city} Are Renting For</h2>
      <p className="text-sm text-muted-foreground mb-3">
        {bedroomLabel[bedrooms]} rentals in {city}, {state}
      </p>

      <div className="flex flex-wrap justify-center gap-2 mt-3">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('comp_link_clicked', {
              platform: link.name,
              zip,
              city,
              state,
              bedrooms,
              verdict: verdict ?? null,
              fairness_score: fairnessScore ?? null,
            })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-border rounded text-sm font-medium text-foreground bg-card hover:border-foreground transition-colors"
          >
            {link.name}
            <span className="text-xs text-muted-foreground">→</span>
          </a>
        ))}
      </div>
    </div>
  );
};

export default CompLinks;
