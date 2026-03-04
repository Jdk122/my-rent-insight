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
    a: 'Enter your address, current rent, and proposed increase. RenewalReply cross-references seven independent data sources — including real-time comparable listings near you, government rent benchmarks, actual lease transaction trends, and local income data — to generate a Fairness Score from 0 to 100. You\u2019ll see exactly how your increase compares to the local market across five dimensions. If your increase scores poorly, we generate a free negotiation letter backed by the data.',
  },
  {
    q: 'What is Fair Market Rent (FMR)?',
    a: 'Fair Market Rent is published annually by the U.S. Department of Housing and Urban Development (HUD). It represents the 40th percentile of rents in your area — meaning 40% of units rent for less. RenewalReply also uses HUD\u2019s 50th percentile data (the actual median rent) when available, giving you a more precise benchmark for your specific bedroom count and ZIP code.',
  },
  {
    q: 'Can my landlord raise my rent by any amount?',
    a: 'It depends on where you live. In most U.S. markets without rent control, landlords can raise rent by any amount at lease renewal with proper notice. However, some cities and states have rent stabilization laws that cap increases. Even where no cap exists, an increase significantly above market trends gives you leverage to negotiate. RenewalReply helps you understand whether your increase is in line with what the local market supports.',
  },
  {
    q: 'What data sources does RenewalReply use?',
    a: (<>RenewalReply analyzes seven data sources to score your rent increase: HUD Small Area Fair Market Rents and 50th Percentile Rents for government benchmarks, Apartment List for rent trends from actual lease transactions, Zillow ZORI and ZHVI for rental and housing market momentum, Rentcast for real-time comparable listings near your address, and U.S. Census data for local income context. For each scoring component, we use the best available source for your ZIP code and fall back to alternatives when needed. See our <Link to="/methodology" className="text-primary hover:underline">methodology page</Link> for full details.</>),
  },
  {
    q: 'Is RenewalReply really free?',
    a: 'Yes, completely free. You get your full Fairness Score, detailed component breakdown, comparable rent analysis, and a negotiation letter at no cost. No credit card, no hidden fees, no trial period.',
  },
  {
    q: 'What should I do if my rent increase is unfair?',
    a: 'Start by sharing your RenewalReply analysis with your landlord — the Fairness Score and market data give you a concrete basis for negotiation rather than just asking for a lower price. Use the negotiation letter we generate, which references specific market data points. If your landlord won\u2019t negotiate, consider whether comparable units nearby offer better value. In rent-controlled areas, check whether the proposed increase exceeds the legal limit.',
  },
  {
    q: 'How is the Fairness Score calculated?',
    a: (<>Your Fairness Score is a weighted composite of five components: how your increase compares to local rent trends (30 points), how your proposed rent compares to similar nearby units (25 points), whether your rent is reasonable relative to area benchmarks (20 points), how your rent relates to local incomes (15 points), and which direction the local market is heading (10 points). Each component draws from the best available data source for your ZIP code. For the complete methodology, visit our <Link to="/methodology" className="text-primary hover:underline">methodology page</Link>.</>),
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
