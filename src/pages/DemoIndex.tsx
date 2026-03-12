import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

const demos = [
  { label: 'Renewal: Above Market', path: '/?demo=above', desc: 'Rent increase is above market — triggers letter flow' },
  { label: 'Renewal: Fair', path: '/?demo=fair', desc: 'Rent increase is at market — fair verdict' },
  { label: 'Renewal: Below Market', path: '/?demo=below', desc: 'Rent increase is below market — good deal verdict' },
  { label: 'Renewal: No Increase', path: '/?demo=none', desc: 'No rent increase entered' },
  { label: 'WSIP: Overpriced', path: '/what-should-i-pay?demo=overpriced', desc: 'Asking rent is above market' },
  { label: 'WSIP: Fair', path: '/what-should-i-pay?demo=fair', desc: 'Asking rent is at market' },
  { label: 'WSIP: Deal', path: '/what-should-i-pay?demo=deal', desc: 'Asking rent is below market' },
];

const DemoIndex = () => (
  <div className="min-h-screen bg-background">
    <SEO title="Demo Scenarios | RenewalReply" description="Internal demo scenario index" canonical="/demos" />
    <div className="max-w-xl mx-auto px-5 pt-20 pb-16">
      <h1 className="text-2xl font-bold text-foreground mb-2">Demo Scenarios</h1>
      <p className="text-sm text-muted-foreground mb-8">Quick links to all static demo results — no data entry needed.</p>
      <div className="flex flex-col gap-3">
        {demos.map((d) => (
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
      <Link to="/" className="inline-block mt-8 text-sm text-primary hover:underline">← Back to home</Link>
    </div>
  </div>
);

export default DemoIndex;
