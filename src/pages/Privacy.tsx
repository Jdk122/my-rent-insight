import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';

const Privacy = () => {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="Privacy Policy — RenewalReply"
        description="How RenewalReply collects, uses, and protects your data. Read our privacy policy."
        canonical="/privacy"
      />

      <noscript>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>Privacy Policy — RenewalReply</h1>
          <h2>What we collect</h2>
          <p>When you use RenewalReply, you voluntarily enter property details (address, zip code, bedrooms, and rent amounts). If you choose to provide your email address, we store it along with your lease expiration date and analysis results.</p>
          <h2>How we use it</h2>
          <p>We use your information to deliver your rent analysis, send lease renewal reminders, and provide your negotiation letter. We may occasionally send relevant housing-related information. No spam, no marketing blasts.</p>
           <h2>Your data stays with us</h2>
           <p>We never sell your name, email address, or contact information to third parties. Period. We may use anonymized and aggregated data — such as rent trends by zip code — to improve our tools and support our operations. If we introduce optional features that connect you with housing professionals or services, you will always be asked first. We will never share your information without your explicit consent.</p>
          <h2>Analytics</h2>
          <p>We use Google Analytics 4 (GA4) to understand how people use the site. GA4 uses cookies to collect anonymized usage data.</p>
          <h2>Unsubscribe anytime</h2>
          <p>Every email includes an unsubscribe link. To delete your data entirely, email privacy@renewalreply.com.</p>
          <p><a href="https://www.renewalreply.com/">← Back to RenewalReply</a></p>
        </div>
      </noscript>

      <PageNav />

      <main className="max-w-[620px] mx-auto px-6 py-16">
        <h1 className="font-display text-[28px] font-semibold tracking-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
          Privacy Policy
        </h1>

        <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">The tool is free — no account required</h2>
            <p>
              RenewalReply is completely free. You can check your rent increase and get a full analysis
              without creating an account, entering a credit card, or signing up for anything.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What we collect</h2>
            <p>
              When you use RenewalReply, you voluntarily enter property details — your address or zip code,
              bedroom count, current rent, and proposed increase. If you choose to provide your email address,
              we store it along with your lease expiration date and analysis results so we can send you
              a personalized report and renewal reminders.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">How we use it</h2>
            <p>
              We use your information to deliver your rent analysis, send you lease renewal reminders,
              and provide your negotiation letter. We may occasionally send relevant housing-related information.
              That's it — no spam, no marketing blasts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your data stays with us</h2>
            <p>
              We never sell your name, email address, or contact information to third parties. Period.
              We may use anonymized and aggregated data — such as rent trends by zip code — to improve
              our tools and support our operations. If we introduce optional features that connect you
              with housing professionals or services, you will always be asked first. We will never
              share your information without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Analytics</h2>
            <p>
              We use Google Analytics 4 (GA4) to understand how people use the site — things like which
              pages are visited and how long people spend on the tool. GA4 uses cookies to collect
              anonymized usage data. No personally identifiable information is shared with Google.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Unsubscribe anytime</h2>
            <p>
              Every email we send includes an unsubscribe link. One click and you're off the list —
              no hoops, no guilt trips. To delete your data entirely, email{' '}
              <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">
                privacy@renewalreply.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Questions?</h2>
            <p>
              If you have any questions about how we handle your data, reach out at{' '}
              <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">
                privacy@renewalreply.com
              </a>{' '}
              and we'll get back to you.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to RenewalReply</Link>
        </div>
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default Privacy;
