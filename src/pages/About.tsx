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
      <nav className="flex items-center justify-between px-6 py-5 border-b border-border">
        <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight hover:scale-105 transition-transform duration-200" style={{ letterSpacing: '-0.02em' }}>
          Renewal<span className="font-normal text-accent">Reply</span>
        </Link>
      </nav>

      <main className="max-w-[620px] mx-auto px-6 py-16">
        <h1 className="font-display text-[28px] font-semibold tracking-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
          About RenewalReply
        </h1>

        <div className="space-y-6 text-[15px] leading-relaxed text-muted-foreground">
          <p>
            RenewalReply was built by a team of real estate professionals who believe renters deserve access to the same market data that landlords and brokers use to set prices.
          </p>
          <p>
            Every year, millions of renters receive lease renewal notices with no way to know whether the increase is fair, excessive, or actually below market. Most people either accept the number or move — both potentially costly mistakes.
          </p>
          <p>
            RenewalReply changes that. Our free tool combines federal housing data, real nearby rental listings, and local market trends to give you an objective, data-backed assessment of your rent increase in under 10 seconds.
          </p>
          <p>
            We don't charge for the analysis. We don't require an account. We built this because we think transparent rental data should be free and accessible to everyone.
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
