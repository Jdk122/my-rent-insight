import { Link } from 'react-router-dom';

const TOP_ZIPS = [
  { zip: '10001', city: 'New York', state: 'NY' },
  { zip: '90001', city: 'Los Angeles', state: 'CA' },
  { zip: '60601', city: 'Chicago', state: 'IL' },
  { zip: '77001', city: 'Houston', state: 'TX' },
  { zip: '85001', city: 'Phoenix', state: 'AZ' },
  { zip: '19101', city: 'Philadelphia', state: 'PA' },
  { zip: '78201', city: 'San Antonio', state: 'TX' },
  { zip: '92101', city: 'San Diego', state: 'CA' },
  { zip: '75201', city: 'Dallas', state: 'TX' },
  { zip: '95101', city: 'San Jose', state: 'CA' },
  { zip: '32801', city: 'Orlando', state: 'FL' },
  { zip: '30301', city: 'Atlanta', state: 'GA' },
  { zip: '02101', city: 'Boston', state: 'MA' },
  { zip: '98101', city: 'Seattle', state: 'WA' },
  { zip: '80201', city: 'Denver', state: 'CO' },
  { zip: '20001', city: 'Washington', state: 'DC' },
  { zip: '37201', city: 'Nashville', state: 'TN' },
  { zip: '78701', city: 'Austin', state: 'TX' },
  { zip: '33101', city: 'Miami', state: 'FL' },
  { zip: '55401', city: 'Minneapolis', state: 'MN' },
];

const TopCityLinks = () => (
  <section className="max-w-[620px] mx-auto px-5 sm:px-6 pb-12">
    <h2 className="font-display text-lg text-foreground mb-3 tracking-tight">Rent Data by City</h2>
    <div className="flex flex-wrap gap-2">
      {TOP_ZIPS.map(({ zip, city, state }) => (
        <Link
          key={zip}
          to={`/rent/${zip}`}
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
