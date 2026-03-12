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
    title: 'How to Negotiate a Rent Increase: A Data-Driven Guide + Free Email Template',
    metaTitle: 'How to Negotiate a Rent Increase: A Data-Driven Guide + Free Email Template',
    metaDescription: 'Learn how to negotiate a rent increase using local rent trends, comparable listings, and a smart counteroffer. Includes a sample email template, worked examples, and practical scripts.',
    publishedDate: '2026-03-11',
    author: 'RenewalReply',
    readingTime: '10 min read',
    category: 'Rent Negotiation',
    relatedSlugs: ['rent-increase-laws-by-state'],
    content: `You just got the renewal notice. Your landlord wants more — maybe 5%, maybe 15%. Do not reply emotionally. In many cases, a rent increase is negotiable if you come back with the right data and a clear counteroffer.

Tenants who negotiate with specific market evidence usually get a better outcome than tenants who respond emotionally or without a clear counteroffer.

This guide gives you the exact process: what data to gather, how to calculate a counteroffer, what to say in your email, and how to handle common landlord responses.

## Can You Actually Negotiate a Rent Increase?

Yes. Many landlords expect some tenants to push back, and they are often willing to adjust — particularly when the alternative is losing a reliable tenant.

Landlords set rent increases based on a mix of market research, property expenses, and in many cases, a rough estimate of what they think the market will bear. Most don't run a rigorous comp analysis for every unit at renewal time. That means there's often a gap between what they're asking and what the data actually supports.

That gap is your opportunity.

## Why Good Tenants Have More Leverage Than They Think

Even when a landlord wants higher rent, replacing a tenant is rarely free. A vacancy can mean lost rent, cleaning, repairs, listing time, showings, screening, and uncertainty about when a new renter will actually sign. In many markets, the total cost of turnover can easily outweigh the benefit of pushing an existing tenant too hard on renewal price.

A landlord deciding whether to push for an extra $150/month isn't just deciding between two rent numbers. They're deciding whether that extra income is worth the risk of a vacancy, turnover work, and a slower lease-up. If the unit sits empty for even a few weeks, the math can shift quickly in favor of retaining the current tenant.

That's why a calm, data-backed counteroffer often works. You're not asking for a favor — you're showing the landlord that keeping a reliable tenant at a fair rate may be the better business decision.

Landlords care about revenue, but they also care about occupancy, stability, and avoiding turnover costs. A tenant who understands that can negotiate from a much stronger position.

## When You Have the Most Leverage

Certain conditions tilt the negotiation further in your favor:

**High vacancy rates.** If apartments near you are sitting empty, your landlord knows that losing you means joining that pool. The higher the local vacancy rate, the stronger your position.

**Long days on market.** If similar units are taking 30+ days to rent, your landlord has a real incentive to keep you. Every empty day is lost revenue.

**Winter timing.** Leases expiring November through February give you natural leverage. Fewer people move in winter, which means fewer potential replacement tenants.

**Rent stabilization.** In some cities — New York, Los Angeles, San Francisco, and others — your rent increase may be legally capped. If you're not sure whether your unit qualifies, check your city's rent board.

Notice requirements for rent increases vary by state and city, so check your local rules before assuming the proposed timeline or increase is valid.

## What Data to Gather

Before you respond to your landlord, you need three things. These data points matter more than anything else — if you have them, you can negotiate from a position of evidence instead of emotion.

**1. Your increase rate vs. the local trend.** This is usually your strongest argument. If rents in your area went up 3% this year but your landlord is asking for 8%, that's a 5-percentage-point gap you can point to directly.

**2. Your proposed rent vs. comparable units nearby.** Are similar apartments in your area renting for more or less than what your landlord is proposing? Active listings for similar units in your neighborhood usually give you the clearest real-time picture.

**3. Your rent vs. government benchmarks.** HUD publishes Fair Market Rents for every ZIP code. While these are useful as a secondary reference point, they represent broad area medians that include units of all conditions and amenity levels — so they work best as supporting context rather than your primary argument.

Gathering this data manually across Zillow, Apartments.com, HUD, and local trend sources can take an hour or more. [RenewalReply](/) pulls the key numbers into one place so you can see whether your increase is fair before you respond.

## How to Calculate a Counteroffer

Don't just say "that's too much." Come with a specific number anchored to the data.

**If your increase is above the local trend:** Propose matching the trend rate. You're not asking for a discount — you're asking to match the market.

**If your rent is already above comps:** Propose a flat renewal or a minimal increase (1–2%). The data shows your landlord is already charging above the local median.

**If your rent is below market but the increase is aggressive:** Propose a gradual correction. Acknowledge that an adjustment toward market is reasonable, but argue that a large single-year jump is too steep. Suggest getting there over two years instead.

## Worked Example

| Item | Amount |
|---|---|
| Current rent | $2,400 |
| Proposed rent | $2,640 |
| Proposed increase | 10% |
| Local rent trend | 4% |
| Comp range | $2,425–$2,525 |

**Data-backed counter:** $2,496/month (matching the 4% local trend)

**Reasonable stretch ask:** $2,475/month (splitting the difference between trend and comps)

**Fallback position:** $2,550/month with a 2-year lease (guaranteed occupancy in exchange for a smaller increase)

In plain English: the landlord asked for a 10% jump in a 4% market. Your counter brings the renewal back in line with local conditions.

Notice how each number is tied to a data point, not a feeling. That's what makes it credible.

> **Quick takeaway:** If the proposed increase is much higher than local rent growth and pushes your rent above comparable units, you likely have a strong case to counter.

## What to Say in Your Email

Email is better than a phone call for rent negotiations. It creates a written record, gives your landlord time to consider rather than react defensively, and lets you present your data clearly.

A strong negotiation email has four parts:

**Opening:** Acknowledge the renewal and express your desire to stay. This isn't adversarial — lead with your intent to continue the relationship.

**Market evidence:** Reference the local rent trend, comparable listings, and any supporting benchmarks. Be specific: "The proposed rent of $2,640 would represent a 10% increase, while rents in this area have grown approximately 4% over the past year" is far stronger than "I think this is too high."

**Your proposal:** State your counter-offer clearly with the reasoning behind it.

**Closing:** Mention your track record as a tenant and invite discussion.

## Sample Rent Negotiation Email

> **Subject:** Lease Renewal — [Your Address / Unit Number]
>
> Hi [Landlord / Property Manager],
>
> Thank you for sending over the renewal terms. I've been happy here and would like to stay and renew my lease.
>
> I wanted to discuss the proposed increase. I reviewed current rental listings and local rent trends for comparable [1-bedroom / 2-bedroom] units in the area, and the proposed rent of $[amount] appears to be above the pace of local rent growth, which has been approximately [X]% over the past year.
>
> Based on that data, I'd like to propose renewing at $[counter-amount] per month. I believe that number is more consistent with current market conditions while also reflecting the value of retaining a reliable tenant.
>
> I've paid on time throughout my tenancy, taken good care of the apartment, and would be happy to sign a longer lease term if that's helpful.
>
> I'm happy to share the market data behind these numbers if useful. Looking forward to discussing.
>
> Best,
> [Your Name]

*Want a version tailored to your actual situation? [RenewalReply](/) generates a personalized negotiation letter in about 60 seconds using your actual rent data, local comps, and market trends — so you don't have to build the case from scratch.*

## Common Landlord Responses and How to Handle Them

**"Our costs went up — taxes, insurance, maintenance."** This is common and often legitimate. Acknowledge it: "I understand operating costs have increased. My concern is that the proposed rent still appears above the pace of local market growth for comparable units. Could we find a middle ground?"

**"This is the market rate."** Ask for specifics: "Could you share which comparables you used? The listings I reviewed suggest the range for similar units is $X–$Y." If the landlord can't point to specific data, your position gets stronger.

**"We can't go any lower."** Shift to non-monetary terms: "Would you consider a smaller increase in exchange for a longer lease term? That gives you guaranteed occupancy and saves turnover costs." Landlords who won't budge on rent will often move on lease length, parking, unit improvements, or other concessions.

**"We already gave you a good deal."** If your rent is genuinely below market, acknowledge it honestly: "I appreciate that my rent has been competitive. My concern is specifically about the rate of this increase — [X]% in a single year is significantly above the local trend. A more gradual adjustment would work better for both of us."

**No response.** Follow up by phone or in person after 3–5 business days. Silence doesn't always mean no — landlords are busy. But don't wait too long. In some jurisdictions and lease structures, failing to respond to renewal terms by a deadline can reduce your options.

## Mistakes to Avoid

**Negotiating without data.** "I can't afford this" is not a negotiation strategy. "This increase is well above the local trend and puts my rent above the area median for comparable units" is.

**Threatening to leave unless you mean it.** If your landlord calls your bluff, you've lost all leverage and may have to move.

**Getting emotional.** This is a business transaction. Your landlord is trying to optimize revenue — meet them on that level with evidence, not frustration.

**Waiting too long to respond.** In many cases, failing to respond promptly can reduce your negotiating leverage, and in some jurisdictions or lease structures, new terms may move forward unless you object within a specified period.

**Ignoring non-monetary options.** If the landlord won't budge on rent, a parking spot, appliance upgrade, fresh paint, or locked rate on a longer lease all have real value.

## The Bottom Line

Negotiating a rent increase isn't about winning a fight — it's about making sure you're paying a fair price for where you live. The renters who do best aren't the loudest or the most aggressive. They're the ones who show up with data, a specific number, and a professional tone.

Before you reply to your landlord, [check your address in RenewalReply](/). In about 10 seconds, you'll see whether the increase is in line with local rent trends, how your proposed rent compares to nearby listings, and get a negotiation letter built around your actual numbers. It's free.
`,
    faqItems: [
      { q: 'Can you negotiate a rent increase?', a: 'Yes. Many landlords expect some negotiation at renewal, especially when the tenant can point to specific market data supporting a lower number.' },
      { q: 'What is a reasonable rent increase?', a: 'It depends on your local market. An increase that is significantly above recent rent growth in your area is worth questioning.' },
      { q: 'How do I write a letter to negotiate rent?', a: 'Lead with your intent to stay, present specific market evidence (local trend, comparable listings), propose a clear counter-number, and close by reinforcing your value as a tenant.' },
      { q: 'Should I negotiate by email or phone?', a: 'Email is generally better — it creates a written record and gives both sides time to think. Follow up by phone if you don\'t hear back.' },
      { q: 'Can I negotiate if my rent is already below market?', a: 'Yes, but shift your argument. Instead of arguing the absolute rent level, focus on the rate of increase. A 12% jump in one year is aggressive even if your rent is below the area median.' },
      { q: 'What if my landlord refuses to negotiate?', a: 'You have three options: accept the increase and stay, negotiate for non-monetary concessions (longer lease, unit improvements), or give notice and move. The right choice depends on your local market and personal situation.' },
      { q: 'How much should I counter-offer?', a: 'Anchor your counter to the local rent trend. If the trend is 4% and your landlord wants 10%, a counter in the 4–6% range is data-backed and reasonable.' },
    ],
  },
  {
    slug: 'rent-increase-laws-by-state',
    title: 'How Much Can a Landlord Raise Rent? A State-by-State Guide',
    metaTitle: 'How Much Can a Landlord Raise Rent? Rent Increase Laws by State (2026)',
    metaDescription: 'How much can a landlord raise rent in your state? See rent increase caps, required notice periods, and tenant protections for all 50 states. Updated for 2026.',
    publishedDate: '2026-03-11',
    author: 'RenewalReply',
    readingTime: '12 min read',
    category: 'Tenant Rights',
    relatedSlugs: ['how-to-negotiate-rent-increase'],
    content: `Your landlord just told you rent is going up. Your first question: is that even legal?

The answer depends entirely on where you live. Three states cap how much your rent can increase. A handful of others have cities or counties with local rent control. The rest have no limits at all — but they do have notice requirements and rules your landlord has to follow.

This guide covers every state: whether there's a cap, how much notice your landlord must give, and what protections you have. Use the quick-reference table to find your state, then read the details below.

**Important:** This guide summarizes statewide baseline rules only. It does not fully capture city or county rent control ordinances, lease-specific notice clauses, mobile or manufactured-home rules, voucher-program rules, or property-specific exemptions. If your unit may be locally regulated, always check your city or county housing agency before relying on a statewide summary.

## Quick Reference: Rent Increase Rules by State

| State | Rent Increase Cap | Notice Required | Local Exceptions / Notes |
|---|---|---|---|
| Alabama | No cap | No specific statewide statute; check lease and local law | No — banned |
| Alaska | No cap | 30 days | Yes — but none exist |
| Arizona | No cap | 30 days | No — banned |
| Arkansas | No cap | 1 month | No — banned |
| [California](#california) | 5% + CPI or 10%, whichever is less | 30 days (under 10%); 90 days (over 10%) | Yes — many cities have local controls |
| Colorado | No cap (max once/year) | 60 days (mobile homes / no written lease) | No — banned |
| Connecticut | No statewide cap (Fair Rent Commissions in larger cities) | 45 days | No — banned (but FRCs can block excessive increases) |
| Delaware | No cap | 60 days (90-120 for mobile homes) | Yes — but none exist |
| D.C. | CPI + 2% (rent-controlled units) | Minimum 60 days | Yes — extensive local rent control |
| Florida | No cap | No specific statewide statute; check lease and local law | No — banned |
| Georgia | No cap | 60 days | No — banned |
| Hawaii | No cap | 45 days | Yes — but none exist |
| Idaho | No cap | 30 days (90 for mobile homes) | No — banned |
| Illinois | No cap | No specific statewide statute; Chicago requires 30-120 days based on tenancy length | No — banned (Rent Control Preemption Act); Chicago has separate notice rules |
| Indiana | No cap | 30 days | No — banned |
| Iowa | No cap | 30 days | No — banned |
| Kansas | No cap | 30 days (60 for mobile homes) | No — banned |
| Kentucky | No cap | No specific statewide statute; check lease and local law | No — banned |
| Louisiana | No cap | No specific statewide statute; check lease and local law | No |
| Maine | No cap statewide (local controls exist) | 45 days (75 days if 10%+ in past year) | Yes — Portland has rent control |
| Maryland | No statewide cap (local controls exist) | 90 days (term over one month) | Yes — Montgomery County, Takoma Park, others |
| Massachusetts | No cap (statewide prohibition in effect; 2026 ballot initiative pending) | Varies by tenancy and lease structure; check lease and local law | No — currently prohibited statewide (Rent Control Prohibition Act, Ch. 40P); 2026 ballot initiative could change this |
| Michigan | No cap | 30 days (for certain mid-lease increases) | No — banned |
| Minnesota | No statewide cap (local controls exist) | 60 days (mobile homes) | Yes — St. Paul has 3% cap |
| Mississippi | No cap | 30 days | No |
| Missouri | No cap | 60 days (mobile homes) | No |
| Montana | No cap | 30 days | No — banned |
| Nebraska | No cap | 30 days (60 for mobile homes) | No — banned (preemption passed 2025) |
| Nevada | No cap | 60 days | No — banned |
| New Hampshire | No cap | 30 days (60 for mobile homes) | No — banned |
| New Jersey | No statewide cap (many local controls) | At least 30 days written notice; lease or local ordinance may require more | Yes — numerous municipalities have caps |
| New Mexico | No cap | 30 days | No |
| New York | No traditional statewide cap; Good Cause Eviction law creates soft cap (inflation + 5%, max 10%) on many market-rate units | 30-90 days (based on tenancy length; applies when increase exceeds 5% or landlord does not intend to renew) | Yes — NYC rent stabilization covers ~1M units; Good Cause applies more broadly |
| North Carolina | No cap | No specific statewide statute; check lease and local law | No — banned |
| North Dakota | No cap | 30 days (90 for mobile homes) | No |
| Ohio | No cap | No specific statewide statute; check lease and local law | No — banned |
| Oklahoma | No cap | No specific statewide statute; check lease and local law | No — banned |
| Oregon | 7% + CPI or 10%, whichever is less (9.5% for 2026) | 90 days | No — state law preempts local controls |
| Pennsylvania | No cap | No specific statewide statute; check lease and local law | Yes — but none currently active |
| Rhode Island | No cap | 60 days (120 for tenants over 62) | Yes — but none exist |
| South Carolina | No cap | No specific statewide statute; check lease and local law | No — banned |
| South Dakota | No cap | 30 days | No |
| Tennessee | No cap | No specific statewide statute; check lease and local law | No — banned |
| Texas | No cap | 30 days for month-to-month; for lease renewals, notice must be given at least 7 days before tenant's vacate deadline (HB 1185, effective Sept 2025) | No — banned |
| Utah | No cap | No specific statewide statute; check lease and local law | No — banned |
| Vermont | No cap | 60 days | Yes — but none exist |
| Virginia | No cap | 30–60 days | No |
| Washington | 7% + CPI or 10%, whichever is less (9.683% for 2026) | 90 days | No — state law preempts local controls |
| West Virginia | No cap | No specific statewide statute; check lease and local law | No |
| Wisconsin | No cap | No specific statewide statute; check lease and local law | No — banned |
| Wyoming | No cap | No specific statewide statute; check lease and local law | No |

## States With Rent Control

Only three states have statewide caps on rent increases as of 2026: California, Oregon, and Washington. Washington, D.C. also has its own rent control system. Several other states allow local jurisdictions to set their own caps.

### California

California caps rent increases at 5% plus the local Consumer Price Index (CPI), or 10% total — whichever is lower. This applies to most residential rental units that are 15 years or older under the Tenant Protection Act (AB 1482). Landlords can only raise rent twice in any 12-month period, and the combined increases cannot exceed the annual cap.

Many California cities have their own, stricter rent control ordinances on top of the state law. San Francisco, Los Angeles, Oakland, San Jose, Berkeley, and others all have local rent boards that set annual allowable increases — often well below the state cap. For the 2026-2027 period (effective March 1, 2026), San Francisco's local cap is 1.6% for rent-controlled units.

Newer buildings (less than 15 years old), single-family homes (with certain exceptions), and some owner-occupied properties are exempt from AB 1482.

**Notice required:** 30 days for increases under 10%. 90 days for increases over 10%.

### Oregon

Oregon caps many annual rent increases at the lesser of 7% plus CPI or 10%. For 2026, the maximum allowable increase is 9.5%. A separate 6% cap applies to manufactured home parks with more than 30 spaces.

Oregon generally prohibits local rent control, although state law allows temporary local controls after a natural or man-made disaster that materially reduces rental supply. The cap does not apply to units whose first certificate of occupancy was issued less than 15 years before the rent-increase notice. Landlords can only raise rent once per 12-month period and cannot increase rent during the first year of a tenancy.

**Notice required:** 90 days.

### Washington

Washington's rent-stabilization law (HB 1217) took effect May 7, 2025. For most covered residential tenancies, annual increases are capped at the lesser of 7% plus CPI or 10%. The Washington Department of Commerce set the 2026 maximum annual increase at 9.683%. Manufactured and mobile-home lot rents have a separate 5% cap.

Landlords generally cannot raise rent during the first 12 months of a tenancy and must give 90 days' notice before a covered increase takes effect. The cap applies to both lease renewals and month-to-month tenancies. The Washington Attorney General's office has enforcement authority and has already fined landlords for violations.

**Notice required:** 90 days.

### Washington, D.C.

Washington, D.C. has its own rent-stabilization system. For most covered units, annual increases are tied to CPI-W plus 2%, subject to a 10% ceiling. For registered elderly or disabled tenants, the allowable increase is generally the lesser of CPI, Social Security COLA, or 5%. Covered units must receive at least 60 calendar days' notice of any increase. Common exemptions include units built after 1975 and certain units owned by natural persons with no more than four rental units in the District.

Landlords must register with the Rental Accommodations Division and comply with housing regulations before raising rent.

**Notice required:** Minimum 60 days.

## States With Important Local Rent Rules (No General Statewide Cap)

These states don't have a statewide cap, but they allow cities and counties to pass their own rent control laws. Some have active local rent control; others allow it but no municipality has passed one.

### New York

New York has no traditional statewide rent increase cap, but multiple overlapping systems regulate rent increases depending on unit type and location.

**Rent stabilization:** New York City's rent stabilization system covers approximately one million apartments. The NYC Rent Guidelines Board sets annual allowable increases for rent-stabilized units — typically between 1-5% depending on the year and lease length.

**Good Cause Eviction law:** New York's Good Cause Eviction law creates a soft rent cap for many residential tenants. Under this framework, a rent increase is presumptively unreasonable if it exceeds the local inflation rate plus 5%, subject to an absolute ceiling of 10%. If a landlord exceeds this threshold, the tenant can challenge the increase in housing court and the burden of proof shifts to the landlord to justify the hike with documented cost increases. Good Cause protections are mandatory in New York City; municipalities outside NYC can opt in. Coverage depends on property type, with exemptions for owner-occupied buildings with 10 or fewer units and certain other categories.

**Notice requirements:** For non-regulated units, New York requires advance notice when the landlord intends to raise rent by more than 5% or does not intend to renew the lease. The notice period depends on tenancy length: 30 days for tenancies under one year, 60 days for one to two years, and 90 days for tenancies longer than two years. Increases of 5% or less on non-regulated units do not trigger the statutory notice requirement, though lease terms still apply.

### New Jersey

New Jersey has no statewide rent cap, but many municipalities have their own rent control ordinances. Cities like Jersey City, Newark, Hoboken, and others set local caps — often tied to CPI or a fixed percentage. The specifics vary significantly by municipality, so tenants in New Jersey should check their local ordinances.

**Notice required:** At least 30 days written notice; the lease or a local rent control ordinance may require more.

### Maine

Maine has no statewide cap, but Portland passed a rent control ordinance. State law requires 45 days of notice before a rent increase, and 75 days of notice if the landlord has increased rent by 10% or more in the past 12 months. The rental unit must also meet habitability standards before a landlord can raise rent.

### Maryland

Maryland has no statewide cap, but several jurisdictions have local rent stabilization — including Montgomery County (which caps increases at 3% plus CPI, currently 5.7% for 2025-2026) and Takoma Park. State law requires 90 days of notice for tenancies longer than one month.

### Minnesota

Minnesota has no statewide cap. St. Paul has a 3% annual cap on rent increases, which has been controversial — housing construction dropped significantly after the policy took effect. Minneapolis does not currently have rent control. State law requires 60 days of notice for mobile home rent increases.

## States Where Most Renters Have No Cap

The majority of U.S. states — roughly 35-40 — have no statewide rent cap and either ban local rent control or simply don't have any. In these states, a landlord can raise your rent by any amount at the end of your lease term, as long as they provide the required notice and the increase isn't discriminatory or retaliatory.

Even in these states, landlords cannot raise rent:

**During your lease term** (unless the lease specifically allows it)

**In retaliation** for filing a complaint, requesting repairs, or joining a tenant organization

**In a discriminatory way** based on race, color, religion, national origin, sex, familial status, or disability (federal Fair Housing Act protections apply everywhere)

The required notice period varies — some states specify 30, 45, 60, or 90 days. Others have no specific statewide statute, meaning the notice requirement defaults to whatever the lease says or applicable local law. Always check both your lease and your local jurisdiction's rules.

**States that ban local rent control (as of early 2026):** The majority of U.S. states either explicitly prohibit local governments from enacting rent control or have no local rent control in practice. Preemption laws vary in scope and wording — some are broad statutory bans, others arise from state constitutional or judicial precedent. If you're unsure whether your city or county has the authority to pass rent control, check your state's statutes or consult a local housing attorney.

## What to Do If You Think Your Increase Is Too High

Whether or not your state has a cap, you have options:

**1. Check if the increase is legal.** If you're in California, Oregon, Washington, D.C., or a city with local rent control, your landlord may be exceeding the legal limit. Contact your local rent board or housing authority.

**2. Check if the increase is fair.** Even in states with no cap, your landlord's proposed rent should be roughly in line with local market conditions. If comparable units nearby are renting for significantly less, you have a data-backed argument to negotiate.

**3. Verify the notice period.** If your landlord didn't give you enough advance notice, the increase may not be enforceable yet. Check the notice requirements for your state in the table above.

**4. Negotiate.** Many landlords will adjust the increase — especially when presented with comparable market data. The cost of losing a reliable tenant often outweighs the benefit of a larger rent increase.

[Check your address in RenewalReply](/) to see how your proposed rent compares to local market data, HUD benchmarks, and recent trends. If the data supports a counteroffer, the tool generates a negotiation letter you can send to your landlord. It takes about 10 seconds and it's free.

Not sure what rent you should be paying in the first place? Check what similar units in your area are renting for with our [What Should I Pay](/what-should-i-pay) tool — free and instant.

*This guide is for informational purposes only and does not constitute legal advice. Rent increase laws change frequently — state legislatures, city councils, and ballot measures can alter these rules at any time. For legal questions about your specific situation, consult a tenant rights attorney or your local housing authority.*

*Sources: Primary state and local materials, including the California Attorney General, Oregon Department of Administrative Services, Washington Attorney General and Department of Commerce, New York Attorney General, New Jersey Department of Community Affairs, D.C. Rental Housing Commission and D.C. DHCD, Illinois General Assembly, and Massachusetts Legislature. Information should be rechecked before relying on it because rent law changes frequently.*
`,
    faqItems: [
      { q: 'How much can a landlord raise rent?', a: 'It depends on your state. California, Oregon, and Washington have statewide caps (roughly 7-10% per year). Washington, D.C. and several cities in New York, New Jersey, Maine, Maryland, and Minnesota have local caps. Most other states have no limit — landlords can raise rent by any amount with proper notice.' },
      { q: 'Is there a limit on how much rent can go up?', a: 'In most states, no. Only three states (California, Oregon, Washington) plus D.C. have statewide caps. However, every state prohibits discriminatory and retaliatory rent increases, and most require advance notice.' },
      { q: 'What is the most a landlord can increase rent?', a: 'In states without rent control, there is no maximum. In California, the cap is 5% plus CPI (max 10%). In Oregon, it\'s 7% plus CPI (max 10%, currently 9.5% for 2026). In Washington, it\'s 7% plus CPI or 10%, whichever is less.' },
      { q: 'How much notice does a landlord have to give for a rent increase?', a: 'It varies by state, typically 30-90 days. California requires 30 days for increases under 10% and 90 days for larger increases. Oregon and Washington require 90 days. Many states require 30-60 days. Some states have no specific statute.' },
      { q: 'Can a landlord raise rent during a lease?', a: 'Generally, no. A landlord typically cannot increase rent during a fixed-term lease unless the lease agreement specifically includes a provision allowing for it. Rent increases usually take effect at lease renewal.' },
      { q: 'Can I negotiate a rent increase even in a state without rent control?', a: 'Absolutely. Having no rent cap doesn\'t mean you have no leverage. Market data, comparable listings, and the cost of tenant turnover all give you negotiating power.' },
      { q: 'What counts as a retaliatory rent increase?', a: 'Most states prohibit landlords from raising rent in response to a tenant filing a complaint, requesting repairs, reporting code violations, or joining a tenant organization. The specific protections and timeframes vary by state.' },
      { q: 'Are there any new rent control laws coming?', a: 'Massachusetts has a 2026 rent-control initiative petition in progress, but current Massachusetts law still generally prohibits rent control. Because state legislatures, city councils, and ballot measures can change these rules quickly, tenants should confirm the current law before relying on any statewide summary.' },
    ],
  },
];

export function getGuideBySlug(slug: string): GuideArticle | undefined {
  return guides.find((g) => g.slug === slug);
}
