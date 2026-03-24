import React from 'react';
import { Link } from 'react-router-dom';
import { DEAL_CITIES } from '@/data/dealsCities';

const SocialIcon = ({ href, label, children }: { href: string; label: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-muted-foreground/50 hover:text-foreground transition-colors">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg>
  </a>
);

interface SEOFooterProps {
  onContactClick?: () => void;
}


const linkClass = 'text-[13px] text-muted-foreground hover:text-foreground hover:underline transition-colors';

const SEOFooter = React.forwardRef<HTMLElement, SEOFooterProps>(({ onContactClick }, ref) => (
  <footer ref={ref} className="mt-auto border-t border-border">
    {/* Brand + copyright row */}
    <div style={{ backgroundColor: 'hsl(210 12% 92%)' }}>
    <div className="max-w-5xl mx-auto px-5 sm:px-6 pt-8 sm:pt-10 pb-6">
      <div className="flex items-center justify-between mb-8">
        <Link to="/" className="shrink-0" onClick={() => window.scrollTo({ top: 0 })}>
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-5 sm:h-6 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <SocialIcon href="https://www.tiktok.com/@rentfacts" label="TikTok">
              <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/>
            </SocialIcon>
            <SocialIcon href="https://www.instagram.com/rentfacts" label="Instagram">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </SocialIcon>
            <SocialIcon href="https://www.youtube.com/@rentfacts" label="YouTube">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </SocialIcon>
          </div>
          <p className="text-[12px] text-muted-foreground/50">© 2026 RenewalReply</p>
        </div>
      </div>

      {/* Link columns */}
      <nav aria-label="Footer navigation" className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 sm:gap-x-8 gap-y-8 sm:max-w-3xl sm:mx-auto">
        {/* Tools */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70 mb-3">Tools</h3>
          <ul className="space-y-2">
            <li><Link to="/" className={linkClass}>Check My Increase</Link></li>
            <li><Link to="/what-should-i-pay" className={linkClass}>Check Asking Price</Link></li>
          </ul>
        </div>

        {/* Browse Deals */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70 mb-3">Browse Deals</h3>
          <ul className="space-y-2">
            <li><Link to="/deals/east-village" className={linkClass}>NYC</Link></li>
            <li><Link to="/deals/jersey-city" className={linkClass}>New Jersey</Link></li>
            <li><Link to="/deals/brickell" className={linkClass}>Miami</Link></li>
            <li><Link to="/deals/lincoln-park" className={linkClass}>Chicago</Link></li>
            <li><Link to="/deals/east-austin" className={linkClass}>Austin</Link></li>
            <li><Link to="/deals/mission-district" className={linkClass}>San Francisco</Link></li>
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
      </p>
    </div>
  </footer>
));

SEOFooter.displayName = 'SEOFooter';

export default SEOFooter;
