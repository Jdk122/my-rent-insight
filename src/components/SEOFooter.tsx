import { Link } from 'react-router-dom';

interface SEOFooterProps {
  onContactClick?: () => void;
  showCityDirectory?: boolean;
}

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

const SEOFooter = ({ onContactClick, showCityDirectory = false }: SEOFooterProps) => (
  <footer className="mt-auto border-t border-border bg-card">
    {/* City directory — integrated into footer like Zillow/Redfin */}
    {showCityDirectory && (
      <div className="border-b border-border/50">
        <nav aria-label="Popular cities" className="max-w-4xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4">
            Explore Rent Data by City
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5">
            {TOP_CITIES.map(({ city, state, stateSlug, citySlug }) => (
              <Link
                key={`${stateSlug}/${citySlug}`}
                to={`/rent-data/${stateSlug}/${citySlug}`}
                className="text-[12px] sm:text-[13px] text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {city}, {state}
              </Link>
            ))}
          </div>
          <Link
            to="/rent-data"
            className="inline-block mt-3 text-[12px] sm:text-[13px] text-primary hover:text-primary/80 transition-colors font-medium"
          >
            View all states →
          </Link>
        </nav>
      </div>
    )}

    {/* Main footer */}
    <div className="max-w-4xl mx-auto px-5 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4 sm:gap-6">
      {/* Brand */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        <Link to="/" className="shrink-0">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-5 sm:h-6 w-auto object-contain" />
        </Link>
        <nav className="flex items-center justify-center gap-3 sm:gap-4 text-[12px] sm:text-[13px] text-muted-foreground flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">Check Rent</Link>
          <Link to="/rent-data" className="hover:text-foreground transition-colors">Rent Data</Link>
          <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link to="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          {onContactClick ? (
            <button onClick={onContactClick} className="hover:text-foreground transition-colors">Contact</button>
          ) : (
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          )}
        </nav>
      </div>

      {/* Copyright */}
      <p className="text-[11px] sm:text-xs text-muted-foreground/50 shrink-0">© 2026 RenewalReply</p>
    </div>

    {/* Disclaimer */}
    <div className="border-t border-border/50 px-5 sm:px-6 py-3 sm:py-4">
      <p className="max-w-3xl mx-auto text-[10px] sm:text-[11px] text-muted-foreground/40 leading-relaxed text-center">
        Data: HUD SAFMR FY2026 · Zillow ZORI · Rentcast · NY DHCR. For informational purposes only — not legal or financial advice.
      </p>
    </div>
  </footer>
);

export default SEOFooter;
