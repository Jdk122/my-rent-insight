import React from 'react';
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
];

const linkClass = 'text-[13px] text-muted-foreground hover:text-foreground hover:underline transition-colors';

const SEOFooter = React.forwardRef<HTMLElement, SEOFooterProps>(({ onContactClick, showCityDirectory = false }, ref) => (
  <footer ref={ref} className="mt-auto border-t border-border">
    {/* City directory — page background */}
    {showCityDirectory && (
      <div className="border-b border-border/50 bg-background">
        <nav aria-label="Popular cities" className="max-w-5xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
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

    {/* Brand + copyright row */}
    <div style={{ backgroundColor: 'hsl(210 12% 92%)' }}>
    <div className="max-w-5xl mx-auto px-5 sm:px-6 pt-8 sm:pt-10 pb-6">
      <div className="flex items-center justify-between mb-8">
        <Link to="/" className="shrink-0">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-5 sm:h-6 w-auto object-contain" />
        </Link>
      </div>

      {/* Link columns */}
      <nav aria-label="Footer navigation" className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-8">
        {/* Tools */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70 mb-3">Tools</h3>
          <ul className="space-y-2">
            <li><Link to="/" className={linkClass}>Check My Increase</Link></li>
            <li><Link to="/what-should-i-pay" className={linkClass}>Check Asking Price</Link></li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70 mb-3">Resources</h3>
          <ul className="space-y-2">
            <li><Link to="/rent-data" className={linkClass}>Rent Data</Link></li>
            <li><Link to="/guides" className={linkClass}>Guides</Link></li>
            <li><Link to="/methodology" className={linkClass}>Methodology</Link></li>
            <li><Link to="/about" className={linkClass}>About</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70 mb-3">Company</h3>
          <ul className="space-y-2">
            <li><Link to="/privacy" className={linkClass}>Privacy</Link></li>
            <li><Link to="/terms" className={linkClass}>Terms</Link></li>
            <li>
              {onContactClick ? (
                <button onClick={onContactClick} className={linkClass}>Contact</button>
              ) : (
                <Link to="/contact" className={linkClass}>Contact</Link>
              )}
            </li>
          </ul>
        </div>
      </nav>
    </div>
    </div>

    {/* Data attribution bar */}
    <div className="px-5 sm:px-6 py-3" style={{ backgroundColor: 'hsl(210 12% 89%)' }}>
      <p className="max-w-5xl mx-auto text-[10px] sm:text-[11px] text-muted-foreground/60 leading-snug text-center">
        Data: HUD SAFMR FY2026 · Apartment List · Zillow ZORI · Live Market Comps · NY DHCR. For informational purposes only — not legal or financial advice.
        <span className="block mt-1">© 2026 RenewalReply</span>
      </p>
    </div>
  </footer>
));

SEOFooter.displayName = 'SEOFooter';

export default SEOFooter;
