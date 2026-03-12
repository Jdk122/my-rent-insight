import { Link } from 'react-router-dom';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { NoIndexMeta } from '@/components/NoIndexMeta';
import SEO from '@/components/SEO';

const sections = [
  {
    title: 'Renewal Tool',
    demos: [
      { label: 'Above Market', path: '/?demo=above', desc: 'Rent increase is above market — triggers overpaying headline & letter flow' },
      { label: 'Fair / At Market', path: '/?demo=fair', desc: 'Rent increase is at market — fair verdict, "doesn\'t mean non-negotiable" gate copy' },
      { label: 'Below Market', path: '/?demo=below', desc: 'Rent below market — "protect your position" gate copy' },
      { label: 'No Increase', path: '/?demo=none', desc: 'No rent increase entered — "your landlord kept it flat" gate copy' },
    ],
  },
  {
    title: 'Edge Cases',
    demos: [
      { label: 'Moderate (Borderline)', path: '/?demo=moderate', desc: 'Score ~60-65 — at-market but close to above. Tests gate copy boundary.' },
      { label: 'Below FMR + High Increase', path: '/?demo=below-fmr-high-increase', desc: 'Rent below market but aggressive increase rate — special gate copy & blue info card' },
      { label: 'Limited Data (HUD-Only)', path: '/?demo=limited', desc: 'Rural ZIP, no comps, HUD-only data — tests limited confidence state' },
      { label: 'Premium Unit', path: '/?demo=premium', desc: 'High-rent unit well above FMR — scoring shifts to increase-rate weight' },
    ],
  },
  {
    title: 'WSIP Tool',
    demos: [
      { label: 'Overpriced', path: '/what-should-i-pay?demo=overpriced', desc: 'Asking rent is above market — dollar savings headline' },
      { label: 'Fair', path: '/what-should-i-pay?demo=fair', desc: 'Asking rent is at market — "fair price confirmed" gate copy' },
      { label: 'Deal', path: '/what-should-i-pay?demo=deal', desc: 'Asking rent is below market — "good deal" gate copy' },
    ],
  },
];

const DemoIndex = () => {
  usePrerenderReady(true);
  return (
  <div className="min-h-screen bg-background">
    <NoIndexMeta />
    <SEO title="Demo Scenarios | RenewalReply" description="Internal demo scenario index" canonical="/demos" />
    <div className="max-w-xl mx-auto px-5 pt-20 pb-16">
      <h1 className="text-2xl font-bold text-foreground mb-2">Demo Scenarios</h1>
      <p className="text-sm text-muted-foreground mb-8">Quick links to all static demo results — no data entry needed.</p>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{section.title}</h2>
            <div className="flex flex-col gap-2">
              {section.demos.map((d) => (
                <a
                  key={d.path}
                  href={d.path}
                  className="block border border-border rounded-lg p-4 hover:bg-muted transition-colors"
                >
                  <span className="font-semibold text-foreground text-sm">{d.label}</span>
                  <span className="block text-xs text-muted-foreground mt-1">{d.desc}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Link to="/" className="inline-block mt-8 text-sm text-primary hover:underline">← Back to home</Link>
    </div>
  </div>
  );
};

export default DemoIndex;
