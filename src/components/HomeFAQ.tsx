import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: 'How do I know if my rent increase is fair?',
    a: 'Enter your address, current rent, and proposed increase. We compare your increase against real nearby rental listings with actual prices, HUD Fair Market Rent data, Zillow rent trends, and Census income data for your specific zip code. You\u2019ll see exactly what comparable units near you are renting for right now, so you can judge whether your increase is in line with the market. If it\u2019s not, we generate a free negotiation letter you can send to your landlord.',
  },
  {
    q: 'What is Fair Market Rent (FMR)?',
    a: 'Fair Market Rent is a standard set by the U.S. Department of Housing and Urban Development (HUD) that represents the cost to rent a moderately-priced dwelling in a local housing market. HUD publishes FMR data annually for every zip code in the U.S. We use the FY2026 Small Area Fair Market Rents (SAFMR) which are the most granular available.',
  },
  {
    q: 'Can my landlord raise my rent by any amount?',
    a: 'It depends on where you live. In most U.S. states, landlords can raise rent by any amount as long as they provide proper notice. However, cities and states with rent control or rent stabilization laws limit how much rent can increase. For example, California caps annual increases at 5% plus inflation (max 10%), and New York City rent-stabilized apartments have increases set by the Rent Guidelines Board.',
  },
  {
    q: 'What data sources does RenewalReply use?',
    a: 'We use HUD Small Area Fair Market Rents (SAFMR) FY2026 for federal rent benchmarks, real-time nearby rental listings to show you what apartments are actually renting for in your area, Zillow Observed Rent Index (ZORI) for local trends, and U.S. Census ACS data for income and demographics. This gives you both the government benchmark and real market data to evaluate your rent increase.',
  },
  {
    q: 'Is RenewalReply really free?',
    a: 'Yes. RenewalReply is free to use and no account is required. You get your rent fairness analysis and a data-backed negotiation letter at no charge.',
  },
  {
    q: 'What should I do if my rent increase is unfair?',
    a: 'If our tool indicates your rent increase exceeds local benchmarks, we provide a free data-backed negotiation letter you can send to your landlord. The letter cites specific HUD and market data for your area. Many landlords will negotiate when presented with objective data rather than emotional appeals.',
  },
];

const HomeFAQ = () => (
  <section className="max-w-[620px] mx-auto px-6 pt-12 pb-16 border-t border-border" aria-label="Frequently asked questions">
    <h2 className="font-display text-[24px] md:text-[28px] font-semibold text-foreground tracking-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
      Frequently Asked Questions
    </h2>
    <Accordion type="single" collapsible className="space-y-2">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-5">
          <AccordionTrigger className="text-[15px] font-medium text-foreground text-left py-4 hover:no-underline">
            <h3 className="font-medium">{faq.q}</h3>
          </AccordionTrigger>
          <AccordionContent className="text-[14px] text-muted-foreground leading-relaxed pb-4">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);

export default HomeFAQ;
