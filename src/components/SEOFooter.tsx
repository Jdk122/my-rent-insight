import { Link } from 'react-router-dom';

interface SEOFooterProps {
  onContactClick?: () => void;
}

const SEOFooter = ({ onContactClick }: SEOFooterProps) => (
  <footer className="mt-auto border-t border-border bg-card">
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <Link to="/" className="shrink-0">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-6" />
        </Link>
        <nav className="flex items-center gap-4 text-[13px] text-muted-foreground flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">Check Rent</Link>
          <Link to="/rent-data" className="hover:text-foreground transition-colors">Rent Data</Link>
          <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link to="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          {onContactClick ? (
            <button onClick={onContactClick} className="hover:text-foreground transition-colors">Contact</button>
          ) : (
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          )}
        </nav>
      </div>

      {/* Copyright */}
      <p className="text-xs text-muted-foreground/50 shrink-0">© 2026 RenewalReply</p>
    </div>

    {/* Disclaimer */}
    <div className="border-t border-border/50 px-6 py-4">
      <p className="max-w-3xl mx-auto text-[11px] text-muted-foreground/40 leading-relaxed text-center">
        Data: HUD SAFMR FY2026 · Census ACS 2023 · Zillow ZORI · FRED · DHCR. For informational purposes only — not legal or financial advice.
      </p>
    </div>
  </footer>
);

export default SEOFooter;
