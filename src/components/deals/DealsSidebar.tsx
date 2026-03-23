import { Link } from 'react-router-dom';
import type { DealCity } from '@/data/dealsCities';

const fmt = (n: number) => n.toLocaleString('en-US');

interface SideCardProps {
  title?: string;
  children: React.ReactNode;
}

const SideCard = ({ title, children }: SideCardProps) => (
  <div className="bg-card rounded-lg border border-border p-4">
    {title && (
      <h3 className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
        {title}
      </h3>
    )}
    {children}
  </div>
);

interface DealsSidebarProps {
  city: DealCity;
  medianRent1BR: number | null;
  yoyChange: number | null;
  activeListings: number;
}

const DealsSidebar = ({ city, medianRent1BR, yoyChange, activeListings }: DealsSidebarProps) => {
  const primaryZip = city.zips[0];

  return (
    <aside className="hidden lg:flex sticky top-[50px] flex-col gap-3">
      {/* Score legend */}
      <SideCard title="Scores">
        {[
          { label: 'Great Deal', range: '80+', desc: 'Well below market', className: 'bg-accent' },
          { label: 'Good Deal', range: '75–79', desc: 'Below market', className: 'bg-primary' },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-1.5 mb-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.className}`} />
            <span className="text-xs font-semibold" style={{ color: t.className === 'bg-accent' ? 'hsl(var(--accent-green))' : 'hsl(var(--primary))' }}>
              {t.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{t.range}</span>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground leading-snug pt-1.5 border-t border-border">
          Only listings scoring 75+ appear here.
        </p>
      </SideCard>

      {/* Market stats */}
      <SideCard title={`${city.neighborhood || city.name} now`}>
        <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
          {medianRent1BR && (
            <p>Typical 1BR: <strong className="text-foreground">${fmt(medianRent1BR)}/mo</strong></p>
          )}
          {yoyChange !== null && (
            <p>
              YoY: <strong className={yoyChange > 0 ? 'text-destructive' : 'text-accent'}>
                {yoyChange > 0 ? '+' : ''}{yoyChange.toFixed(1)}%
              </strong>
            </p>
          )}
          <p>{activeListings} apartments listed</p>
        </div>
        <Link
          to={`/rent/${primaryZip}`}
          className="block mt-2.5 text-[11.5px] text-primary font-semibold hover:underline"
        >
          Full rent data for {primaryZip} →
        </Link>
      </SideCard>

      {/* Cross-sell */}
      <SideCard>
        <p className="text-[13px] font-semibold text-foreground mb-1">Already renting here?</p>
        <p className="text-[11.5px] text-muted-foreground mb-2.5">Check if your rent increase is fair.</p>
        <Link
          to="/"
          className="block py-1.5 rounded-md border-[1.5px] border-primary text-primary font-semibold text-xs text-center hover:bg-primary/5 transition-colors"
        >
          Check my increase →
        </Link>
      </SideCard>

      {/* Affiliate services */}
      <SideCard title="Moving soon?">
        {[
          { icon: '🛡', title: 'Renters Insurance', sub: 'From $5/mo', accent: 'hsl(var(--primary))', href: '#' },
          { icon: '✓', title: 'Need a Guarantor?', sub: 'Get approved fast', accent: '#7c3aed', href: '#' },
          { icon: '📦', title: 'Moving Help', sub: 'Compare movers', accent: '#ea580c', href: '#' },
          { icon: '📊', title: 'Build Credit', sub: 'Report rent free', accent: 'hsl(var(--accent-green))', href: '#' },
        ].map((svc) => (
          <a
            key={svc.title}
            href={svc.href}
            className="flex gap-2 items-center py-1.5 border-b border-border/50 last:border-0 no-underline hover:opacity-70 transition-opacity"
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] shrink-0"
              style={{ background: `${svc.accent}14` }}
            >
              {svc.icon}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-foreground">{svc.title}</div>
              <div className="text-[11px] text-muted-foreground">{svc.sub}</div>
            </div>
            <span className="text-[11px] font-semibold" style={{ color: svc.accent }}>→</span>
          </a>
        ))}
      </SideCard>
    </aside>
  );
};

export default DealsSidebar;
