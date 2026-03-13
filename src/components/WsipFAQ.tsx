import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do you calculate the fair rent range?',
    a: 'We combine HUD Fair Market Rent data, Zillow rent trends, Apartment List vacancy data, and real-time comparable listings to determine what similar units actually rent for in your area.',
  },
  {
    q: 'Is this really free?',
    a: 'Yes. Free, no account required. Enter your email to unlock full comparable listings and negotiation tips.',
  },
  {
    q: 'Can I use this to negotiate before signing a lease?',
    a: 'Absolutely. If the asking price is above the fair range, we show you the comps that prove it and give you a template to propose a lower price.',
  },
  {
    q: 'What areas do you cover?',
    a: 'We cover 38,600+ US zip codes using HUD Fair Market Rent data, Zillow and Apartment List rent trends, and real-time comparable listings.',
  },
  {
    q: 'How is this different from Zillow or Apartments.com?',
    a: "Those sites show you listings. We tell you if the price is fair. We're the independent check — we don't sell listings or represent landlords.",
  },
];

const WsipFAQ = React.forwardRef<HTMLElement>((_, ref) => (
  <section ref={ref} className="max-w-[620px] mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-14 sm:pb-20 border-t border-border/60" aria-label="Frequently asked questions">
    <h2 className="font-display text-[22px] sm:text-[26px] text-foreground tracking-tight text-center mb-2" style={{ letterSpacing: '-0.02em' }}>
      Frequently Asked Questions
    </h2>
    <p className="text-[15px] sm:text-base text-muted-foreground text-center max-w-[440px] mx-auto mb-8 sm:mb-10 leading-relaxed">
      Common questions about finding fair rent prices.
    </p>
    <Accordion type="single" collapsible className="space-y-2">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4 sm:px-5">
          <AccordionTrigger className="text-[15px] sm:text-base font-medium text-foreground text-left py-3.5 sm:py-4 hover:no-underline">
            <h3 className="font-medium">{faq.q}</h3>
          </AccordionTrigger>
          <AccordionContent className="text-[14px] sm:text-[15px] text-muted-foreground leading-relaxed pb-3.5 sm:pb-4">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
));

WsipFAQ.displayName = 'WsipFAQ';

export default WsipFAQ;
