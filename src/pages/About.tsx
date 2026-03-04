import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';

const About = () => {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="About RenewalReply — Free Rent Check Tool"
        description="RenewalReply helps renters check if their rent increase is fair using HUD data, real listings, and local trends. Free, no account required."
        canonical="/about"
      />

      <noscript>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>About RenewalReply</h1>
          <p>RenewalReply was built by a real estate professional who saw the same problem over and over: renters had no easy way to check whether their rent increase was reasonable.</p>
          <p>RenewalReply closes that gap. The tool pulls federal housing data (HUD Small Area Fair Market Rents), real nearby listings, and local rent trends to give you an objective, data-backed assessment of your rent increase — typically in under 10 seconds.</p>
          <p>It's completely free and no account is required.</p>
          <h2>What Makes RenewalReply Different</h2>
          <ul>
            <li>Six independent data sources cross-referenced for accuracy</li>
            <li>Coverage for 38,000+ zip codes across all 50 states</li>
            <li>Real-time comparable listings from MLS and public records</li>
            <li>Free negotiation letter backed by specific market evidence</li>
          </ul>
          <h2>Data Sources</h2>
          <p>HUD Fair Market Rents (FY2026) · HUD 50th Percentile Rents · Apartment List Rent Estimates · Zillow ZORI · Zillow ZHVI · Rentcast</p>
          <p>Contact: social@renewalreply.com</p>
          <p><a href="https://www.renewalreply.com/">Check if your rent increase is fair →</a></p>
        </div>
      </noscript>

      <PageNav />

      <main className="max-w-[620px] mx-auto px-6 py-16">
        <h1 className="font-display text-[28px] font-semibold tracking-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
          About RenewalReply
        </h1>

        <div className="space-y-6 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            RenewalReply was built by a real estate professional who saw the same problem over and over: renters had no easy way to check whether their rent increase was reasonable.
          </p>
          <p>
            RenewalReply closes that gap. The tool pulls federal housing data (HUD Small Area Fair Market Rents), real nearby listings, and local rent trends to give you an objective, data-backed assessment of your rent increase — typically in under 10 seconds.
          </p>
          <p>
            It's completely free and no account is required.
          </p>
        </div>

        {/* What makes us different — E-E-A-T signals */}
        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">What Makes RenewalReply Different</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              Most rent tools show you a single number from a single source. RenewalReply cross-references <strong className="text-foreground">six independent data sources</strong> — HUD Fair Market Rents, HUD 50th Percentile Rents, Apartment List transacted rent trends, Zillow ZORI and ZHVI market indices, and Rentcast real-time MLS listings — to generate a composite Fairness Score across four dimensions.
            </p>
            <p>
              The result is a <strong className="text-foreground">multi-dimensional analysis</strong> that accounts for local trends, comparable units, government benchmarks, and market momentum — not just one data point.
            </p>
          </div>
        </div>

        {/* Coverage */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <h2 className="text-lg font-semibold text-foreground mb-4">Coverage & Data</h2>
          <ul className="space-y-2 text-[15px] text-muted-foreground">
            <li className="flex gap-2"><span className="text-primary">•</span> 38,000+ zip codes across all 50 states and DC</li>
            <li className="flex gap-2"><span className="text-primary">•</span> HUD SAFMR and 50th Percentile data updated annually (currently FY2026)</li>
            <li className="flex gap-2"><span className="text-primary">•</span> Apartment List and Zillow trends updated monthly</li>
            <li className="flex gap-2"><span className="text-primary">•</span> Rentcast comparable listings updated in real-time</li>
          </ul>
          <p className="mt-4 text-[14px] text-muted-foreground">
            For full details on how the Fairness Score is calculated, see our{' '}
            <Link to="/methodology" className="text-primary hover:underline">methodology page</Link>.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-2">Questions or feedback?</h2>
          <p className="text-[15px] text-muted-foreground">
            Reach us at{' '}
            <a href="mailto:social@renewalreply.com" className="text-primary hover:underline">
              social@renewalreply.com
            </a>
          </p>
        </div>

        <div className="mt-8">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to RenewalReply</Link>
        </div>
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default About;