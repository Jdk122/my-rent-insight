import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGGRESSIVE_PROMPT = `You are a tenant advocate writing a rent negotiation letter on behalf of a renter. Write a persuasive but professional letter the tenant can email to their landlord.

RULES:
- Only include data points that HELP the tenant's case. Never include anything that strengthens the landlord's position.
- If the tenant's current rent is significantly above the area median or comp median (more than 30% above), do NOT mention those benchmarks. Focus on the rate of increase vs market trends instead.
- If the rent-to-income ratio exceeds 50%, do NOT mention it.
- If proposed rent is more than 40% above government benchmarks, do NOT cite those benchmarks.
- Always state the specific increase percentage and dollar amount.
- Reference comparable units if available. If current rent already exceeds comps, focus on the increase rate, not absolute rent level.
- Reference market trends when the proposed increase exceeds the market trend — this is usually the strongest argument.
- Mention vacancy, days on market, or active listings ONLY when they favor the tenant (vacancy > 6%, days on market > 30, active listings > 20).
- Keep source references conversational: "current market data", "government rent estimates", "comparable listings nearby". Never include URLs or formal citations.
- Include one line near the end of the market evidence section: "I'm happy to share the detailed market analysis behind these figures if helpful."
- End with: "Analysis by RenewalReply — renewalreply.com"
- Tone: professional, respectful, firm but not adversarial. A neighbor writing to their landlord, not a lawyer writing a demand letter.
- Length: 250-400 words.
- Format as a ready-to-send email. No subject line.
- Do not include placeholder text like [Your Name] or [Landlord Name]. Start with "Dear Landlord" or "Dear Property Manager" and end with "Sincerely," followed by a blank line for the tenant to add their name.
- Never use placeholder text like [Apartment Address] or [Address]. Either use the ZIP code/area name from the data, or simply say "my apartment" or "my unit". The letter should have zero brackets or placeholders of any kind.
- Round all numbers naturally — say "about 32 days" not "31.65 days". No decimals in the letter unless they are percentages.
- Do not open with "I hope this email finds you well" or similar generic AI-sounding openers. Start directly with acknowledging the renewal and the proposed increase.
- Structure: Opening (acknowledge renewal, state increase amount and percentage) → Market Evidence (2-4 short paragraphs using only data that helps the tenant) → Proposal (suggest counter-offer range if available) → Closing (value tenancy, open to discussion).`;

const COLLABORATIVE_PROMPT = `You are a tenant advocate writing a rent negotiation letter for a renter whose increase is at or near market rate. The goal is NOT to argue the increase is unfair — it's to persuade the landlord that a small discount makes good business sense.

RULES:
- Acknowledge that the increase is reasonable and within market norms. Never claim the landlord is overcharging.
- Frame the negotiation around tenant retention value: the cost of turnover (vacancy, cleaning, re-listing, showing) typically equals 2-4 months of rent. A $50-100/month discount costs the landlord $600-1,200/year but avoids $3,000-8,000+ in turnover costs.
- Mention the tenant's track record: on-time payments, care of the property, being a reliable tenant.
- If comp data is available and the proposed rent is near or below the median, acknowledge this positively — "I understand my rent is competitively priced."
- Suggest a modest counter-offer: typically 1-2% less than the proposed increase, or $50-75/month off. Frame it as a "renewal incentive" not a demand.
- If vacancy or days-on-market data shows favorable conditions (vacancy > 5%, days > 25), mention it subtly: "I notice some units in the area are taking time to fill."
- Tone: warm, appreciative, professional. This is a long-term tenant asking for consideration, not making demands.
- Include: "I'm happy to share the detailed market analysis behind these figures if helpful."
- End with: "Analysis by RenewalReply — renewalreply.com"
- Length: 200-350 words.
- Format as a ready-to-send email. No subject line. Start with "Dear Landlord" or "Dear Property Manager". No placeholder text or brackets.
- Round all numbers naturally. No decimals except percentages.
- Do not open with "I hope this email finds you well" or similar generic AI-sounding openers. Start directly with acknowledging the renewal and the proposed increase.
- Never use placeholder text like [Your Name], [Landlord Name], [Apartment Address], or [Address]. Either use the ZIP code/area name from the data, or simply say "my apartment" or "my unit". The letter should have zero brackets or placeholders of any kind.
- End with "Sincerely," followed by a blank line for the tenant to add their name.
- Structure: Opening (acknowledge renewal, appreciate the relationship) → Brief Market Context (1-2 paragraphs, acknowledge fairness) → Retention Argument (turnover cost logic) → Modest Proposal (small discount as renewal incentive) → Closing (value the home, open to discussion).`;

const STRATEGIC_PROMPT = `You are a tenant advisor writing a renewal strategy letter for a renter who received a below-market or at-market increase. The landlord is being reasonable — the goal is NOT to negotiate the price down, but to help the tenant leverage their strong position to get additional value from the renewal.

RULES:
- Open by acknowledging the fair terms and expressing appreciation. Never frame this as a complaint or negotiation — the tenant is happy with the rate.
- Frame the tenant's position as valuable to the landlord: guaranteed occupancy, no turnover costs ($3,000-8,000+), no vacancy risk.
- Suggest ONE OR TWO of these strategic asks based on the data: (1) A 2-year lease at the current increase rate, locking in before the market moves further — especially compelling if market trends show rising rents. (2) A unit improvement in exchange for early signing: fresh paint, appliance upgrade, or a repair. Frame this as "I'd be happy to sign today if we could address [improvement]." (3) A small concession: parking spot, storage unit, package locker access. Only suggest if relevant to an apartment building context.
- Mention the tenant's reliability: on-time payments, care of property, plans to stay long-term.
- If market data shows rents are rising in the area, emphasize that locking in now protects both parties.
- Tone: confident, appreciative, collaborative. A valued tenant making a smart ask, not a negotiation.
- Include: "I'm happy to discuss this further at your convenience."
- End with: "Analysis by RenewalReply — renewalreply.com"
- Length: 200-300 words.
- Format as ready-to-send email. No subject line. Start with "Dear Landlord" or "Dear Property Manager". No placeholder text or brackets.
- Round all numbers naturally.
- Do not open with "I hope this email finds you well" or similar generic AI-sounding openers.
- Never use placeholder text like [Your Name], [Landlord Name], [Apartment Address], or [Address]. Either use the ZIP code/area name from the data, or simply say "my apartment" or "my unit". The letter should have zero brackets or placeholders of any kind.
- End with "Sincerely," followed by a blank line for the tenant to add their name.
- Structure: Opening (acknowledge fair terms, express appreciation) → Tenant Value (reliability, turnover cost avoidance) → Strategic Ask (1-2 specific proposals) → Closing (happy to discuss, sign promptly).`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { letterTone, ...analysisData } = requestBody;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = letterTone === 'collaborative' ? COLLABORATIVE_PROMPT
      : letterTone === 'strategic' ? STRATEGIC_PROMPT
      : AGGRESSIVE_PROMPT;
    const userInstruction = letterTone === 'strategic'
      ? `Generate a strategic renewal letter using this analysis data. The tenant's increase is below or at market — help them leverage their position for extras like a longer lease, unit improvement, or concession.\n\n${JSON.stringify(analysisData)}`
      : letterTone === 'collaborative'
      ? `Generate a collaborative negotiation letter using this analysis data. The tenant's increase is at or near market rate — frame the ask around retention value and a modest discount, not unfairness.\n\n${JSON.stringify(analysisData)}`
      : `Generate a negotiation letter using this analysis data. Only use data points that help the tenant's negotiating position. Omit anything that would help the landlord's case.\n\n${JSON.stringify(analysisData)}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInstruction },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const letterText = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ letter: letterText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-letter error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
