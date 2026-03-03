import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';

const About = () => {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="About RenewalReply — Free Rent Increase Calculator"
        description="RenewalReply helps renters check if their rent increase is fair using federal housing data, real listings, and local trends. Free, no account required."
        canonical="/about"
      />
      <nav className="sticky top-0 z-[60] flex items-center justify-between px-6 py-4 bg-card" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link to="/">
          <img src="/renewalreply-wordmark.png" alt="RenewalReply" className="h-7" />
        </Link>
        <Link to="/" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20">
          Check your rent →
        </Link>
      </nav>

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
