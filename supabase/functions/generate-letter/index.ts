import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a tenant advocate writing a rent negotiation letter on behalf of a renter. Write a persuasive but professional letter the tenant can email to their landlord.

RULES:
- Only include data points that HELP the tenant's case. Never include anything that strengthens the landlord's position.
- If the tenant's current rent is significantly above the area median or comp median (more than 30% above), do NOT mention those absolute benchmarks. Focus on the rate of increase vs market trends instead.
- If the rent-to-income ratio exceeds 50%, do NOT mention it.
- If proposed rent is more than 40% above government benchmarks (FMR or f50), do NOT cite those benchmarks.
- Always state the specific increase percentage and dollar amount.
- Reference comparable units if available. If current rent already exceeds comps, reframe around the increase rate, not absolute rent level.
- Reference market trends when the proposed increase exceeds the trend — this is usually the strongest argument.
- Mention vacancy, days on market, or active listings ONLY when they favor the tenant (vacancy > 5%, days on market > 30, active listings > 20).
- Keep source references conversational: "current market data", "government rent estimates", "comparable listings nearby". Never include URLs, hyperlinks, or formal citations.
- Include one line near the end of the evidence section: "I want to be transparent that this analysis draws on multiple public data sources including government rent benchmarks and current local listings. I'm happy to share the detailed breakdown if that would be helpful."
- The very last line of the letter (after the signature) should be: "Analysis by RenewalReply — renewalreply.com"
- Tone: professional, respectful, firm but not adversarial. A neighbor writing to their landlord, not a lawyer writing a demand letter.
- Length: 250-400 words.
- Format as a ready-to-send email. No subject line needed.
- Start with "Dear Landlord," or "Dear Property Manager," — do NOT use placeholder brackets like [Landlord Name].
- End with "Sincerely," followed by a blank line (the tenant will add their name).
- Do NOT include any placeholder text like [Your Name], [Address], etc.
- Write in first person as the tenant.
- Structure: Opening (acknowledge increase) → Market Evidence (2-4 short paragraphs with specific numbers) → Transparency line → Proposal (counter-offer range) → Closing.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const analysisData = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Generate a negotiation letter using this analysis data. Only use data points that help the tenant. Omit anything that would help the landlord's case.\n\n${JSON.stringify(analysisData)}`,
            },
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
    const letterText =
      data.choices?.[0]?.message?.content || "";

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
