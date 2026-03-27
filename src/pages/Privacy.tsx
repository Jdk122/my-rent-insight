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
              <li>Send you information about third-party products and services that we believe may be relevant to your housing situation, which may include renters insurance, rent reporting services, moving assistance, guarantor services, rental listings, or other housing-related offerings</li>
              <li>Display or deliver content that contains affiliate or referral links to third-party products and services — when you click on or purchase through such links, we may receive compensation from the third-party provider at no additional cost to you, and such compensation does not influence our rent analysis, fairness determinations, or any other information we provide to you</li>
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
              We may present you with recommendations, advertisements, or links to third-party products and services that we believe are relevant to your housing situation. Some of these may be affiliate or referral links, meaning we may receive compensation from the third-party provider if you click on, sign up for, or purchase a product or service through such link. Such compensation is received from the third-party provider, not from you. The presence of affiliate or referral relationships does not influence our rent analysis, fairness scores, market data, negotiation letters, or any other information or tools we provide. We do not share your name, email address, or other personal information with affiliate partners unless you independently and affirmatively choose to provide such information directly to the third-party provider (for example, by clicking through to their website and submitting your information on their platform).
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
              <li>You may opt out of receiving emails containing third-party product recommendations or affiliate offers while continuing to receive your rent analysis results, market updates, and renewal reminders. To do so, reply to any email with "unsubscribe recommendations" or contact us at{' '}
                <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">privacy@renewalreply.com</a>. We will process your request within ten (10) business days.
              </li>
              <li>You can request deletion of your data at any time by emailing{' '}
                <a href="mailto:privacy@renewalreply.com" className="text-primary hover:underline">privacy@renewalreply.com</a>.
              </li>
              <li>You can disable analytics cookies through your browser settings.</li>
              <li>You can opt out of Google Analytics tracking by installing the{' '}
                <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Analytics Opt-out Browser Add-on</a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Cookies</h2>
            <p>
              We use essential cookies for site functionality, analytics cookies for usage data,
              and advertising conversion tracking cookies to measure campaign effectiveness.
              No personal information is shared with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Do Not Track</h2>
            <p>
              We do not respond to Do Not Track (DNT) browser signals.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Third-Party Links</h2>
            <p>
              Our site may contain links to third-party websites or services. We are not responsible for the privacy practices or content of those sites. We encourage you to review the privacy policy of any third-party site you visit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Data Breach Notification</h2>
            <p>
              In the event of a data breach affecting your personal information, we will notify affected users and applicable authorities as required by law.
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
