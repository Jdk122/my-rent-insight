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
  <section className="max-w-[620px] mx-auto px-5 sm:px-6 pb-12">
    <h2 className="font-display text-lg text-foreground mb-3 tracking-tight">Rent Data by City</h2>
    <div className="flex flex-wrap gap-2">
      {TOP_CITIES.map(({ city, state, stateSlug, citySlug }) => (
        <Link
          key={`${stateSlug}/${citySlug}`}
          to={`/rent-data/${stateSlug}/${citySlug}`}
          className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          {city}, {state}
        </Link>
      ))}
    </div>
    <Link to="/rent-data" className="inline-block mt-3 text-xs text-primary hover:underline font-medium">
      Browse all states & cities →
    </Link>
  </section>
);

export default TopCityLinks;
