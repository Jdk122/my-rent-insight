import { Link } from 'react-router-dom';

const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground">
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
            When you sign up for a lease renewal reminder, we store your email address, lease expiration date,
            and the property details you entered (address, city, state, zip, bedrooms, and rent amounts).
            We also save the market context from your session so we can send you a useful, personalized report.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">How we use it</h2>
          <p>
            We use your information to send you a rent market update roughly 60&nbsp;days before your lease
            renews. We may also send occasional housing-related tips that are relevant to your area.
            That's it — no spam, no marketing blasts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">We don't sell your data</h2>
          <p>
            Your personal information is never sold, rented, or shared with third parties for their
            marketing purposes. Period.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Unsubscribe anytime</h2>
          <p>
            Every email we send includes an unsubscribe link. One click and you're off the list —
            no hoops, no guilt trips.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Questions?</h2>
          <p>
            If you have any questions about how we handle your data, reach out and we'll get back to you.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-border">
        <Link to="/" className="text-sm text-primary hover:underline">← Back to RenewalReply</Link>
      </div>
    </main>
  </div>
);

export default Privacy;
