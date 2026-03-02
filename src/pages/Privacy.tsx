import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
const Privacy = () => {
  const [contactOpen, setContactOpen] = useState(false);
  return (
  <div className="min-h-screen bg-background text-foreground flex flex-col">
    <SEO
      title="Privacy Policy — RenewalReply"
      description="How RenewalReply collects, uses, and protects your data. Read our privacy policy."
      canonical="/privacy"
    />
    <nav className="flex items-center justify-between px-6 py-5 border-b border-border">
      <Link to="/" className="font-display text-xl font-bold text-primary tracking-tight hover:scale-105 transition-transform duration-200" style={{ letterSpacing: '-0.02em' }}>
        Renewal<span className="font-normal text-accent">Reply</span>
      </Link>
    </nav>

    <main className="max-w-[620px] mx-auto px-6 py-16">
      <h1 className="font-display text-[28px] font-semibold tracking-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
        Privacy Policy
      </h1>

      <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">What we collect</h2>
          <p>
            When you use RenewalReply, we store your email address, lease expiration date,
            and the property details you entered (address, city, state, zip, bedrooms, and rent amounts).
            We also save the market context from your session so we can send you a useful, personalized report.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">How we use it</h2>
          <p>
            We use your information to send you lease renewal reminders and your negotiation letter.
            We may occasionally send relevant housing-related information and offers from partners.
            That's it — no spam, no marketing blasts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Your data stays with us — unless you say otherwise</h2>
          <p>
            We never sell, rent, or share your personal information without your permission.
            If you opt in to hear from trusted partners about housing-related services, we may
            share your contact details and housing preferences with vetted third parties.
            You're always in control — only users who actively check the partner opt-in box
            will ever be contacted by third parties.
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
