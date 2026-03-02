import { Link } from 'react-router-dom';

const footerLinks = {
  'Rent Increase Laws': [
    { label: 'California', href: '/rent-laws/california' },
    { label: 'New York', href: '/rent-laws/new-york' },
    { label: 'New Jersey', href: '/rent-laws/new-jersey' },
    { label: 'Oregon', href: '/rent-laws/oregon' },
    { label: 'Washington', href: '/rent-laws/washington' },
    { label: 'View All States', href: '/rent-laws' },
  ],
  'Popular Cities': [
    { label: 'New York City', href: '/rent-increase/new-york-city-ny' },
    { label: 'Los Angeles', href: '/rent-increase/los-angeles-ca' },
    { label: 'San Francisco', href: '/rent-increase/san-francisco-ca' },
    { label: 'Chicago', href: '/rent-increase/chicago-il' },
    { label: 'Hoboken', href: '/rent-increase/hoboken-nj' },
    { label: 'Jersey City', href: '/rent-increase/jersey-city-nj' },
  ],
  Resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'How to Negotiate Your Rent', href: '/blog/how-to-negotiate-rent-increase' },
    { label: 'What is Fair Market Rent?', href: '/blog/what-is-fair-market-rent' },
    { label: 'Rent Increase Calculator', href: '/' },
  ],
};

interface SEOFooterProps {
  onContactClick?: () => void;
}

const SEOFooter = ({ onContactClick }: SEOFooterProps) => (
  <footer className="mt-auto border-t border-border bg-secondary/40">
    {/* Link columns */}
    <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
      {/* Brand column */}
      <div>
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Data-backed rent fairness tools for renters. Free forever.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">© 2026 RenewalReply</p>
      </div>

      {/* Link columns */}
      {Object.entries(footerLinks).map(([heading, links]) => (
        <div key={heading}>
          <h3 className="text-sm font-semibold text-foreground mb-3">{heading}</h3>
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    {/* Source attribution bar */}
    <div className="border-t border-border px-6 py-4 text-center">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Sources: HUD SAFMR FY2025, Census ACS 2023, Zillow ZORI, FRED, DHCR · For informational purposes only · Not legal or financial advice ·{' '}
        <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy</Link>
        {onContactClick && (
          <>
            {' · '}
            <button onClick={onContactClick} className="underline hover:text-foreground transition-colors">
              Contact us
            </button>
          </>
        )}
      </p>
    </div>
  </footer>
);

export default SEOFooter;
