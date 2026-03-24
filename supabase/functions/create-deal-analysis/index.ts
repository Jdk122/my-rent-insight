import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHARS = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";

function generateShortId(length = 8): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limiting (20/5min)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count } = await sb
      .from("function_request_log")
      .select("id", { count: "exact", head: true })
      .eq("function_name", "create-deal-analysis")
      .eq("ip_address", clientIP)
      .gte("created_at", fiveMinAgo);

    if ((count ?? 0) >= 20) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers },
      );
    }

    const body = await req.json();

    // Validate required fields
    const { email, address, city, beds, rent, score, savingsPerMonth, median } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: "Valid email is required." }), { status: 400, headers });
    }

    if (!address || typeof address !== "string") {
      return new Response(JSON.stringify({ error: "Address is required." }), { status: 400, headers });
    }
    if (!city || typeof city !== "string") {
      return new Response(JSON.stringify({ error: "City is required." }), { status: 400, headers });
    }

    for (const [name, val] of Object.entries({ beds, rent, score, savingsPerMonth, median })) {
      if (val == null || typeof val !== "number" || Number.isNaN(val)) {
        return new Response(JSON.stringify({ error: `${name} must be a number.` }), { status: 400, headers });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Insert with shortId, retry on collision up to 3 times
    let shortId = "";
    let analysisId = "";
    let inserted = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      shortId = generateShortId();

      const { data, error } = await sb
        .from("deal_analyses")
        .insert({
          short_id: shortId,
          address,
          city,
          state_abbr: body.stateAbbr || null,
          zip: body.zip || null,
          beds,
          baths: body.baths ?? null,
          sqft: body.sqft ?? null,
          rent,
          days_on_market: body.daysOnMarket ?? null,
          listing_url: body.listingUrl || null,
          score,
          verdict: body.verdict || "good",
          savings_per_month: savingsPerMonth,
          savings_pct: body.savingsPct ?? null,
          median,
          is_suspicious: body.isSuspicious ?? false,
          has_leverage: body.hasLeverage ?? false,
          leverage_note: body.leverageNote || null,
          trend_context: body.trendContext || null,
          walk_score: body.walkScore ?? null,
          is_rent_stabilized: body.isRentStabilized ?? false,
          components: body.components || null,
          fair_range: body.fairRange || null,
        })
        .select("id")
        .single();

      if (!error && data) {
        analysisId = data.id;
        inserted = true;
        break;
      }

      // If not a unique constraint violation, don't retry
      if (error && !error.message?.includes("unique")) {
        console.error("deal_analyses insert error:", error.message);
        return new Response(JSON.stringify({ error: "Failed to save analysis." }), { status: 500, headers });
      }
    }

    if (!inserted) {
      return new Response(
        JSON.stringify({ error: "Failed to generate unique analysis ID." }),
        { status: 500, headers },
      );
    }

    // Insert lead (private)
    const { error: leadError } = await sb
      .from("deal_analysis_leads")
      .insert({ deal_analysis_id: analysisId, email: normalizedEmail });

    if (leadError) {
      console.error("deal_analysis_leads insert error:", leadError.message);
    }

    // Log the request
    await sb.from("function_request_log").insert({
      function_name: "create-deal-analysis",
      ip_address: clientIP,
      success: true,
      response_status: 200,
    });

    const analysisUrl = `https://www.renewalreply.com/deals/analysis/${shortId}`;

    return new Response(
      JSON.stringify({ shortId, analysisUrl }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("create-deal-analysis error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
