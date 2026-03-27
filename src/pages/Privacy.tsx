import { useState } from 'react';
import { usePrerenderReady } from '@/hooks/usePrerenderReady';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';

const Privacy = () => {
  const [contactOpen, setContactOpen] = useState(false);
  usePrerenderReady(true);
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
          <p>Last updated: March 27, 2026</p>
          <h2>What RenewalReply Does</h2>
          <p>RenewalReply is a free tool that helps renters understand whether their rent increase is in line with market rates.</p>
          <h2>Information You Provide</h2>
          <p>When you use our tool, you enter property details such as your address or zip code, bedroom count, current rent, and proposed increase. If you choose to provide your email address, we use it to send your analysis results and optional renewal reminders.</p>
          <h2>How We May Share Your Information</h2>
          <p>We never sell your name, email address, or contact information to third parties.</p>
          <p><a href="https://www.renewalreply.com/">← Back to RenewalReply</a></p>
        </div>
      </noscript>

      <PageNav />

      <main className="max-w-[620px] mx-auto px-6 py-16">
        <h1 className="font-display text-[28px] font-semibold tracking-tight mb-2" style={{ letterSpacing: '-0.02em' }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 27, 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What RenewalReply Does</h2>
            <p>
              RenewalReply is a free tool that helps renters understand whether their rent increase is in line
              with market rates. We combine federal housing data, market indices, and real-time listing data
              to provide objective rent analysis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Information You Provide</h2>
            <p>
              When you use our tool, you enter property details such as your address or zip code, bedroom count,
              current rent, and proposed increase. If you choose to provide your email address, we use it
              to send your analysis results and optional renewal reminders.
            </p>
          </section>

          <section>
           <h2 className="text-lg font-semibold text-foreground mb-2">Information We Collect Automatically</h2>
            <p>
              We use analytics tools to collect anonymized usage data such as pages visited, time on site,
              and general tool usage patterns. We also use advertising conversion tracking to measure the
              effectiveness of our campaigns. We use cookies and similar technologies to enable these functions.
              For more information about how our analytics provider collects and processes data, see{' '}
              <a href="https://google.com/policies/privacy/partners" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">"How Google uses data when you use our partners' sites or apps"</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">How We Use Your Information</h2>
            <p>We use the information you provide to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Generate your personalized rent analysis</li>
              <li>Send you renewal reminders (if you opt in)</li>
              <li>Improve our tools and data accuracy</li>
              <li>Produce anonymized, aggregated market reports and analytics</li>
              <li>Support our business operations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">How We May Share Your Information</h2>
            <p>
              We never sell your name, email address, or contact information to third parties.
            </p>
            <p className="mt-3">
              We use third-party service providers to operate the site, including cloud hosting, data APIs
              for market comparisons, and analytics. These providers only access the minimum data needed to
              perform their function.
            </p>
            <p className="mt-3">
              If we introduce features that connect you with housing professionals (such as rental agents
              or moving services), we will clearly present this as a choice. Your information will only be
              shared with a professional if you take a specific action requesting that connection. You are
              never opted in automatically.
            </p>
            <p className="mt-3">
              We may share anonymized, aggregated data (such as average rent trends by zip code) for research,
              reporting, or business purposes. This data cannot identify individual users.
            </p>
          </section>

          <section>
           <h2 className="text-lg font-semibold text-foreground mb-2">Your Choices</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You can use the rent check tool without providing any personal contact information.</li>
              <li>If you provide your email, every message includes a one-click unsubscribe link.</li>
              <li>You can request deletion of your data at any time by emailing{' '}
                <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">privacy@renewalreply.com</a>.
              </li>
              <li>You can disable analytics cookies through your browser settings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Cookies</h2>
            <p>
              We use essential cookies for site functionality, analytics cookies (GA4) for usage data,
              and Google Ads conversion tracking cookies to measure advertising effectiveness.
              No personal information is shared with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Data Retention</h2>
            <p>
              We retain tool usage data (zip code, rent amounts, scores) in anonymized form to improve our
              products. If you provide your email, we retain it until you unsubscribe or request deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your Privacy Rights</h2>
            <p>
              <strong>California Residents (CCPA/CPRA):</strong> If you are a California resident, you have the right to know what personal information we collect, request its deletion, and opt out of the sale of your information. We do not sell your personal information to third parties. We do not share personal information for cross-context behavioral advertising.
            </p>
            <p className="mt-3">
              <strong>Categories of personal information we collect:</strong> identifiers (email address, IP address), internet activity (pages visited, tool usage), approximate geolocation derived from IP address, and user-provided property information (ZIP code, bedroom count, rent amounts).
            </p>
            <p className="mt-3">
              <strong>Third parties we share data with:</strong> cloud infrastructure providers, analytics providers, advertising platforms (conversion data only, no personal information shared), and data API providers (anonymized queries only).
            </p>
            <p className="mt-3">
              To exercise your rights, email{' '}
              <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">privacy@renewalreply.com</a>. We will respond within 45 days.
            </p>
            <p className="mt-3">
              <strong>Other States:</strong> Residents of Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, and other states with consumer privacy laws have similar rights to access, delete, and opt out of certain data processing. Contact{' '}
              <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">privacy@renewalreply.com</a> to exercise them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Security</h2>
            <p>
              We use industry-standard security measures to protect your data, including encrypted
              connections (HTTPS) and secure cloud infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Children's Privacy</h2>
            <p>
              RenewalReply is not intended for use by anyone under the age of 18.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be posted on this page
              with an updated effective date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <p>
              RenewalReply is operated by PacketOps LLC, 971 US Highway 202N, Suite N, Branchburg, NJ 08876. Questions about privacy? Email{' '}
              <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">
                privacy@renewalreply.com
              </a>.
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
