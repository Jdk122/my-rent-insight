import { Link } from 'react-router-dom';

const TOP_CITIES = [
  { city: 'New York', state: 'NY', stateSlug: 'new-york', citySlug: 'new-york' },
  { city: 'Los Angeles', state: 'CA', stateSlug: 'california', citySlug: 'los-angeles' },
  { city: 'Chicago', state: 'IL', stateSlug: 'illinois', citySlug: 'chicago' },
  { city: 'Houston', state: 'TX', stateSlug: 'texas', citySlug: 'houston' },
  { city: 'Phoenix', state: 'AZ', stateSlug: 'arizona', citySlug: 'phoenix' },
  { city: 'Philadelphia', state: 'PA', stateSlug: 'pennsylvania', citySlug: 'philadelphia' },
  { city: 'San Antonio', state: 'TX', stateSlug: 'texas', citySlug: 'san-antonio' },
  { city: 'San Diego', state: 'CA', stateSlug: 'california', citySlug: 'san-diego' },
  { city: 'Dallas', state: 'TX', stateSlug: 'texas', citySlug: 'dallas' },
  { city: 'San Jose', state: 'CA', stateSlug: 'california', citySlug: 'san-jose' },
  { city: 'Orlando', state: 'FL', stateSlug: 'florida', citySlug: 'orlando' },
  { city: 'Atlanta', state: 'GA', stateSlug: 'georgia', citySlug: 'atlanta' },
  { city: 'Boston', state: 'MA', stateSlug: 'massachusetts', citySlug: 'boston' },
  { city: 'Seattle', state: 'WA', stateSlug: 'washington', citySlug: 'seattle' },
  { city: 'Denver', state: 'CO', stateSlug: 'colorado', citySlug: 'denver' },
  { city: 'Washington', state: 'DC', stateSlug: 'district-of-columbia', citySlug: 'washington' },
  { city: 'Nashville', state: 'TN', stateSlug: 'tennessee', citySlug: 'nashville' },
  { city: 'Austin', state: 'TX', stateSlug: 'texas', citySlug: 'austin' },
  { city: 'Miami', state: 'FL', stateSlug: 'florida', citySlug: 'miami' },
  { city: 'Minneapolis', state: 'MN', stateSlug: 'minnesota', citySlug: 'minneapolis' },
];

const TopCityLinks = () => (
  <div className="border-t border-border bg-card">
    <nav aria-label="Popular cities" className="max-w-4xl mx-auto px-5 sm:px-6 py-5 sm:py-6">
      <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
        Popular Cities
      </h2>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {TOP_CITIES.map(({ city, state, stateSlug, citySlug }) => (
          <Link
            key={`${stateSlug}/${citySlug}`}
            to={`/rent-data/${stateSlug}/${citySlug}`}
            className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            {city}, {state}
          </Link>
        ))}
        <Link
          to="/rent-data"
          className="text-[11px] sm:text-xs text-primary hover:text-primary/80 transition-colors font-medium whitespace-nowrap"
        >
          All states →
        </Link>
      </div>
    </nav>
  </div>
);

export default TopCityLinks;
