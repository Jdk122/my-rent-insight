import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';
import SEOFooter from '@/components/SEOFooter';
import ContactModal from '@/components/ContactModal';
import PageNav from '@/components/PageNav';

const Contact = () => {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Contact Us — RenewalReply"
        description="Have a question, found a bug, or want to partner with us? Get in touch with the RenewalReply team."
        canonical="/contact"
      />

      <noscript>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>Contact RenewalReply</h1>
          <p>Have a question, found a bug, or want to partner with us? We'd love to hear from you.</p>
          <p>Email: social@renewalreply.com</p>
          <p><a href="https://www.renewalreply.com/">← Back to RenewalReply</a></p>
        </div>
      </noscript>

      <PageNav />

      <main className="max-w-xl mx-auto px-6 py-16 md:py-24 flex-1 w-full">
        <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          Contact Us
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed text-lg">
          Have a question, found a bug, or want to partner with us? We'd love to hear from you.
        </p>
        <a
          href="mailto:social@renewalreply.com"
          className="inline-block mt-6 text-primary hover:underline font-semibold text-lg"
        >
          social@renewalreply.com
        </a>

        <div className="mt-10 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground mb-4">Or send us a message directly:</p>
          <button
            onClick={() => setContactOpen(true)}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:brightness-90 transition-all duration-150 shadow-sm shadow-primary/20"
          >
            Open contact form
          </button>
        </div>
      </main>

      <SEOFooter onContactClick={() => setContactOpen(true)} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default Contact;