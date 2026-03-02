import { Link } from 'react-router-dom';

interface SEOFooterProps {
  onContactClick?: () => void;
}

const SEOFooter = ({ onContactClick }: SEOFooterProps) => (
  <footer className="mt-auto border-t border-border bg-secondary/40">
    <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 gap-10">
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

      {/* Quick Links column */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Quick Links</h3>
        <ul className="space-y-2">
          <li>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Check Your Rent
            </Link>
          </li>
          <li>
            <Link to="/rent/10001" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Browse Rent Data by Zip Code
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
          </li>
          <li>
            {onContactClick ? (
              <button onClick={onContactClick} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact Us
              </button>
            ) : (
              <a href="mailto:hello@renewalreply.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact Us
              </a>
            )}
          </li>
        </ul>
      </div>
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
