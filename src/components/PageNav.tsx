import { Link } from 'react-router-dom';

interface PageNavProps {
  ctaLink?: string;
  ctaText?: string;
  hideCta?: boolean;
}

const PageNav = ({ ctaLink = '/', ctaText = 'Check Your Rent Increase →', hideCta = false }: PageNavProps) => (
  <nav className="sticky top-0 z-[60] flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
    <Link to="/" className="shrink-0">
      <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-7 sm:h-8 w-auto object-contain" />
    </Link>
    <Link to="/guides" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Guides</Link>
    {!hideCta && (
      <Link
        to={ctaLink}
        className="shrink-0 bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20 whitespace-nowrap"
      >
        <span className="hidden sm:inline">{ctaText}</span>
        <span className="sm:hidden">Check My Increase →</span>
      </Link>
    )}
  </nav>
);

export default PageNav;
