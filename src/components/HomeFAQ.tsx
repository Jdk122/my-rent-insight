import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I know if my rent increase is fair?',
    a: 'Enter your address, current rent, and proposed increase. RenewalReply cross-references multiple independent data sources — including real-time comparable listings near you, government rent benchmarks, and actual lease transaction trends — to generate a Fairness Score from 0 to 100. You\u2019ll see how your increase compares across four market dimensions. If your increase scores poorly, we generate a free negotiation letter backed by specific market evidence.',
  },
  {
    q: 'What is Fair Market Rent (FMR)?',
    a: 'Fair Market Rent is published annually by the U.S. Department of Housing and Urban Development (HUD). It represents the 40th percentile of rents in your area. RenewalReply also uses HUD\u2019s 50th percentile data (the actual median) and live Rentcast market data when available, giving you the most precise benchmark for your bedroom count and ZIP code.',
  },
  {
    q: 'Can my landlord raise my rent by any amount?',
    a: 'It depends on where you live. In most markets without rent control, landlords can raise rent by any amount at renewal with proper notice. Some cities and states cap increases. Even without a cap, an increase well above market trends gives you leverage to negotiate. RenewalReply shows you exactly where your increase stands relative to the market.',
  },
  {
    q: 'What data sources does RenewalReply use?',
    a: (<>Six data sources: HUD Fair Market Rents and 50th Percentile Rents for government benchmarks, Apartment List for rent trends from actual lease transactions, Zillow ZORI and ZHVI for market momentum, and Rentcast for real-time comparable listings and market statistics. For each scoring component, we use the best available source for your ZIP code. See our <Link to="/methodology" className="text-primary hover:underline">methodology page</Link> for full details.</>),
  },
  {
    q: 'Is RenewalReply really free?',
    a: 'Yes, completely free. You get your Fairness Score, detailed component breakdown, comparable rent analysis, local market snapshot, and a data-backed negotiation letter \u2014 no credit card, no hidden fees, no trial.',
  },
  {
    q: 'What should I do if my rent increase is unfair?',
    a: 'Use the negotiation letter RenewalReply generates \u2014 it references specific comparable rents, market trends, and government benchmarks for your area. Share it with your landlord as a starting point for discussion. The data gives you a concrete basis for negotiation rather than just asking for a lower price. If your landlord won\u2019t negotiate, the market snapshot shows how many alternatives are available in your area.',
  },
  {
    q: 'How is the Fairness Score calculated?',
    a: (<>Your score is a weighted composite of four components: how your increase compares to local rent trends (35 points), how your proposed rent compares to nearby units (30 points), whether your rent is reasonable relative to area benchmarks (25 points), and market momentum (10 points). When comparable data is limited, the system automatically shifts weight toward trend data to keep the score reliable. See our <Link to="/methodology" className="text-primary hover:underline">methodology page</Link> for the full breakdown.</>),
  },
];

const HomeFAQ = () => (
  <section className="max-w-[620px] mx-auto px-5 sm:px-6 pt-10 sm:pt-12 pb-12 sm:pb-16 border-t border-border" aria-label="Frequently asked questions">
    <h2 className="font-display text-[22px] sm:text-[24px] md:text-[28px] font-semibold text-foreground tracking-tight mb-6 sm:mb-8" style={{ letterSpacing: '-0.02em' }}>
      Frequently Asked Questions
    </h2>
    <Accordion type="single" collapsible className="space-y-2">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4 sm:px-5">
          <AccordionTrigger className="text-[14px] sm:text-[15px] font-medium text-foreground text-left py-3.5 sm:py-4 hover:no-underline">
            <h3 className="font-medium">{faq.q}</h3>
          </AccordionTrigger>
          <AccordionContent className="text-[13px] sm:text-[14px] text-muted-foreground leading-relaxed pb-3.5 sm:pb-4">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);

export default HomeFAQ;
