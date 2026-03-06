import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { password, query, params } = await req.json();

    // Validate password server-side
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create service-role client (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let data: unknown;

    switch (query) {
      case "leads": {
        const { data: rows, error } = await supabase
          .from("analyses")
          .select(
            "id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, letter_tone, results_shared, confidence_level, rent_stabilized, utm_source, utm_medium, utm_campaign, created_at, counter_offer_low, counter_offer_high, comp_median_rent, hud_fmr_value, comps_count, comps_position, fair_counter_offer, sale_data_found, market_trend_pct, cache_hit, markup_multiplier, leads(id, email, lease_expiration_month, lease_expiration_year, partner_opt_in, capture_source, unsubscribed, outcome, reminder_sent_at, followup_sent_at, created_at)"
          )
          .order("created_at", { ascending: false })
          .limit(params?.limit || 1000);
        if (error) throw error;
        data = rows;
        break;
      }

      case "leads_filtered": {
        let q = supabase
          .from("analyses")
          .select(
            "id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, letter_tone, results_shared, confidence_level, rent_stabilized, utm_source, utm_medium, utm_campaign, created_at, counter_offer_low, counter_offer_high, comp_median_rent, hud_fmr_value, comps_count, comps_position, fair_counter_offer, sale_data_found, market_trend_pct, cache_hit, markup_multiplier, leads(id, email, lease_expiration_month, lease_expiration_year, partner_opt_in, capture_source, unsubscribed, outcome, reminder_sent_at, followup_sent_at, created_at)",
            { count: "exact" }
          );

        // Apply server-side filters
        if (params?.filterZip) q = q.ilike("zip", `%${params.filterZip}%`);
        if (params?.filterCity) q = q.ilike("city", `%${params.filterCity}%`);
        if (params?.filterVerdict?.length > 0) q = q.in("verdict_label", params.filterVerdict);
        if (params?.filterLetter === "yes") q = q.eq("letter_generated", true);
        if (params?.filterLetter === "no") q = q.eq("letter_generated", false);
        if (params?.filterBedrooms) q = q.eq("bedrooms", parseInt(params.filterBedrooms));
        if (params?.filterUtm) q = q.ilike("utm_source", `%${params.filterUtm}%`);
        if (params?.filterConfidence?.length > 0) q = q.in("confidence_level", params.filterConfidence);
        if (params?.filterStabilized === "yes") q = q.eq("rent_stabilized", true);
        if (params?.filterStabilized === "no") q = q.eq("rent_stabilized", false);
        if (params?.filterStabilized === "unknown") q = q.is("rent_stabilized", null);

        const sortCol = params?.sortCol || "created_at";
        const sortAsc = params?.sortAsc ?? false;
        q = q.order(sortCol, { ascending: sortAsc });

        const pageSize = params?.pageSize || 50;
        const page = params?.page || 0;
        q = q.range(page * pageSize, (page + 1) * pageSize - 1);

        const { data: rows, count, error } = await q;
        if (error) throw error;
        data = { rows, count };
        break;
      }

      case "leads_export": {
        let q = supabase
          .from("analyses")
          .select(
            "id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, results_shared, confidence_level, utm_source, created_at, leads(email, lease_expiration_month, lease_expiration_year)"
          );

        if (params?.filterZip) q = q.ilike("zip", `%${params.filterZip}%`);
        if (params?.filterCity) q = q.ilike("city", `%${params.filterCity}%`);
        if (params?.filterVerdict?.length > 0) q = q.in("verdict_label", params.filterVerdict);
        if (params?.filterLetter === "yes") q = q.eq("letter_generated", true);
        if (params?.filterLetter === "no") q = q.eq("letter_generated", false);

        q = q.order("created_at", { ascending: false }).limit(5000);
        const { data: rows, error } = await q;
        if (error) throw error;
        data = rows;
        break;
      }

      case "anomaly_data": {
        const { data: rows, error } = await supabase
          .from("analyses")
          .select("id, address, bedrooms, current_rent, dollar_overpayment, fairness_score, increase_pct, created_at")
          .order("created_at", { ascending: false })
          .limit(1000);
        if (error) throw error;
        data = rows;
        break;
      }

      case "referral_clicks": {
        const { data: rows, error } = await supabase
          .from("referral_clicks")
          .select("id, analysis_id, email, link_type, zip, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        data = rows;
        break;
      }

      case "dashboard_stats": {
        const { data: result, error } = await supabase.rpc("admin_dashboard_stats");
        if (error) throw error;
        data = result;
        break;
      }

      case "zip_leaderboard": {
        const { data: result, error } = await supabase.rpc("admin_zip_leaderboard");
        if (error) throw error;
        data = result;
        break;
      }

      case "traffic_stats": {
        const { data: result, error } = await supabase.rpc("admin_traffic_stats");
        if (error) throw error;
        data = result;
        break;
      }

      case "daily_submissions": {
        const { data: result, error } = await supabase.rpc("admin_daily_submissions", {
          p_days: params?.days || 90,
        });
        if (error) throw error;
        data = result;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown query type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
