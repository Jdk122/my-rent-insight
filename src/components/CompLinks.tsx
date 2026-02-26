import { ExternalLink } from 'lucide-react';
import { BedroomType } from '@/data/rentData';

interface CompLinksProps {
  zip: string;
  city: string;
  state: string;
  bedrooms: BedroomType;
}

const bedroomToZillow: Record<BedroomType, string> = {
  studio: '0', oneBr: '1', twoBr: '2', threeBr: '3', fourBr: '4',
};

const bedroomToApartments: Record<BedroomType, string> = {
  studio: 'studio', oneBr: '1-bedrooms', twoBr: '2-bedrooms', threeBr: '3-bedrooms', fourBr: '4-bedrooms',
};

const bedroomToStreetEasy: Record<BedroomType, string> = {
  studio: 'studio', oneBr: '1_bedroom', twoBr: '2_bedroom', threeBr: '3_bedroom', fourBr: '4_bedroom',
};

const bedroomLabel: Record<BedroomType, string> = {
  studio: 'studios', oneBr: '1-bedrooms', twoBr: '2-bedrooms', threeBr: '3-bedrooms', fourBr: '4+-bedrooms',
};

function buildLinks(zip: string, city: string, state: string, bedrooms: BedroomType) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const isNYC = ['NY'].includes(state) && ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'].includes(city);

  const links: { name: string; url: string }[] = [];

  if (isNYC) {
    links.push({
      name: 'StreetEasy',
      url: `https://streeteasy.com/for-rent/${citySlug}?areas=${zip}&bedrooms=${bedroomToStreetEasy[bedrooms]}`,
    });
  }

  links.push({
    name: 'Zillow',
    url: `https://www.zillow.com/homes/for_rent/${zip}_rb/${bedroomToZillow[bedrooms]}-_beds/`,
  });

  links.push({
    name: 'Apartments.com',
    url: `https://www.apartments.com/${bedroomToApartments[bedrooms]}/${citySlug}-${stateSlug}-${zip}/`,
  });

  return links;
}

const CompLinks = ({ zip, city, state, bedrooms }: CompLinksProps) => {
  const links = buildLinks(zip, city, state, bedrooms);

  return (
    <div className="brand-card">
      <p className="data-label mb-1">Reality Check</p>
      <h3 className="font-display text-xl text-foreground mb-1">
        See what's actually available
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Browse {bedroomLabel[bedrooms]} in {zip} to verify your landlord's number.
      </p>

      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-xs font-mono font-medium text-foreground hover:bg-secondary transition-colors"
          >
            {link.name}
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default CompLinks;
