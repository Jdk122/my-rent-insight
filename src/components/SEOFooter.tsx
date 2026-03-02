import { Link } from 'react-router-dom';

interface SEOFooterProps {
  onContactClick?: () => void;
}

const SEOFooter = ({ onContactClick }: SEOFooterProps) => (
  <footer className="mt-auto border-t border-border bg-card">
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <Link to="/" className="font-display text-lg font-bold text-primary tracking-tight shrink-0" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
        <nav className="flex items-center gap-4 text-[13px] text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Check Rent</Link>
          <Link to="/rent-data" className="hover:text-foreground transition-colors">Rent Data</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          {onContactClick ? (
            <button onClick={onContactClick} className="hover:text-foreground transition-colors">Contact</button>
          ) : (
            <a href="mailto:hello@renewalreply.com" className="hover:text-foreground transition-colors">Contact</a>
          )}
        </nav>
      </div>

      {/* Copyright */}
      <p className="text-xs text-muted-foreground/50 shrink-0">© 2026 RenewalReply</p>
    </div>

    {/* Disclaimer */}
    <div className="border-t border-border/50 px-6 py-4">
      <p className="max-w-3xl mx-auto text-[11px] text-muted-foreground/40 leading-relaxed text-center">
        Data: HUD SAFMR FY2025 · Census ACS 2023 · Zillow ZORI · FRED · DHCR. For informational purposes only — not legal or financial advice.
      </p>
    </div>
  </footer>
);

export default SEOFooter;
