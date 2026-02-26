import { Search } from 'lucide-react';
import { BedroomType } from '@/data/rentData';

interface CompLinksProps {
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
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
      url: `https://streeteasy.com/for-rent/${citySlug}?bedrooms=${bedrooms === 'studio' ? 'studio' : beds}`,
    });
  }

  links.push({
    name: 'Zillow',
    url: `https://www.zillow.com/homes/for_rent/${zip}/${beds}-_beds/`,
  });

  links.push({
    name: 'Apartments.com',
    url: `https://www.apartments.com/${citySlug}-${stateSlug}-${zip}/${bedrooms === 'studio' ? 'studios' : beds + '-bedrooms'}/`,
  });

  links.push({
    name: 'Realtor.com',
    url: `https://www.realtor.com/apartments/${zip}/beds-${beds}`,
  });

  links.push({
    name: 'HotPads',
    url: `https://hotpads.com/${citySlug}-${stateSlug}/apartments-for-rent/${beds === '0' ? 'studio' : beds + '-beds'}`,
  });

  return links;
}

const CompLinks = ({ zip, city, state, bedrooms }: CompLinksProps) => {
  const links = buildLinks(zip, city, state, bedrooms);

  return (
    <div>
      <h2 className="font-display text-xl text-foreground mb-1">See What's Available</h2>
      <p className="text-[13px] text-muted-foreground mb-4">
        {bedroomLabel[bedrooms]} rentals in {zip} — verify your landlord's number
      </p>

      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md border border-border text-xs font-mono font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Search className="w-3 h-3" />
            {link.name}
          </a>
        ))}
      </div>
    </div>
  );
};

export default CompLinks;
