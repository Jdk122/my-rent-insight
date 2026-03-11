export interface GuideArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  publishedDate: string;
  updatedDate?: string;
  author: string;
  readingTime: string;
  category: string;
  relatedSlugs: string[];
  content: string;
  faqItems?: { q: string; a: string }[];
}

export const guides: GuideArticle[] = [
  {
    slug: 'how-to-negotiate-rent-increase',
    title: 'How to Negotiate a Rent Increase: A Data-Driven Guide',
    metaTitle: 'How to Negotiate a Rent Increase (2026) — Step-by-Step Guide',
    metaDescription: 'Learn how to negotiate your rent increase using market data, comps, and proven scripts. Free strategies that actually work for renters in 2026.',
    publishedDate: '2026-03-11',
    author: 'RenewalReply',
    readingTime: '8 min read',
    category: 'Rent Negotiation',
    relatedSlugs: [],
    content: `## Why You Should Negotiate Your Rent Increase

Most renters accept their rent increase without question — but data shows that landlords expect some pushback, and tenants who negotiate save an average of $50–$150/month.

This guide walks you through a data-driven approach to negotiating your next rent increase, using the same methodology that powers RenewalReply's free rent analysis tool.

## Step 1: Know Your Market

Before you respond to a rent increase notice, you need to understand what similar units in your area are renting for. Key data points to gather:

- **HUD Fair Market Rent (FMR):** The federal benchmark for your zip code and bedroom count
- **Zillow Observed Rent Index (ZORI):** Tracks actual rental price trends over time
- **Comparable listings:** What similar apartments are currently listed for nearby

## Step 2: Calculate the Increase Percentage

Take your proposed new rent, subtract your current rent, and divide by your current rent. Multiply by 100 to get the percentage.

For example: if your rent is going from $1,500 to $1,650, that's a 10% increase.

Compare this to the year-over-year trend in your area. If rents in your zip code only went up 3%, a 10% increase is well above market.

## Step 3: Build Your Case

Your negotiation letter should include:

1. **Your tenure and reliability** — landlords value stable tenants
2. **Market data** showing the increase exceeds area trends
3. **A specific counter-offer** anchored to the data
4. **A collaborative tone** — you want to stay, not fight

## Step 4: Make Your Counter-Offer

A good counter-offer splits the difference between the market rate increase and what your landlord proposed. If the market moved 3% but they proposed 10%, offer 4–5%.

## Step 5: Follow Up

Send your letter via email so there's a written record. Follow up within a week if you haven't heard back. Most landlords will negotiate — vacancy costs them far more than a smaller increase.

---

*Ready to see how your rent increase compares to market data? Use our [free rent increase analyzer](/) to get a personalized report in seconds.*
`,
    faqItems: [
      { q: 'Can I negotiate my rent increase?', a: 'Yes. Unless you\'re in a rent-controlled unit with fixed increases, rent is negotiable. Landlords expect some tenants to push back, and data shows that tenants who negotiate save an average of $50–$150/month.' },
      { q: 'What data should I use to negotiate rent?', a: 'Use HUD Fair Market Rents for your zip code, year-over-year rent trends from Zillow or Apartment List, and comparable listings in your area. These data points establish what the market actually supports.' },
      { q: 'When should I respond to a rent increase?', a: 'Respond within a few days of receiving the notice. The sooner you start the conversation, the more time both sides have to reach an agreement before your lease renewal deadline.' },
    ],
  },
];

export function getGuideBySlug(slug: string): GuideArticle | undefined {
  return guides.find((g) => g.slug === slug);
}
