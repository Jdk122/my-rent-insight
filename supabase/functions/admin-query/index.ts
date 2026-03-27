import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

const ALLOWED_ORIGINS = [
  "https://www.renewalreply.com",
  "https://renewalreply.com",
  "https://my-rent-insight.lovable.app",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Lovable preview origins
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin)) return true;
  if (/^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
  // Rate limiting — count first, then insert
    const ip = getClientIp(req);
    const fnName = "admin-query";
    const rlClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentCount } = await rlClient
      .from("function_request_log")
      .select("*", { count: "exact", head: true })
      .eq("function_name", fnName)
      .eq("ip_address", ip)
      .gte("created_at", fiveMinAgo);

    if ((recentCount ?? 0) >= 60) {
      await rlClient.from("function_request_log").insert({
        function_name: fnName, ip_address: ip, success: false, response_status: 429,
      });
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert log row — will be updated with outcome
    const { data: logRow } = await rlClient
      .from("function_request_log")
      .insert({ function_name: fnName, ip_address: ip })
      .select("id")
      .single();
    const logId = logRow?.id;

    let responseStatus = 500;
    let reqSuccess = false;

    try {
    const { password, query, params } = await req.json();

    // Validate password server-side
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || password !== adminPassword) {
      responseStatus = 403;
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create service-role client (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );

    let data: unknown;

    switch (query) {
      case "leads": {
        const { data: rows, error } = await supabase
          .from("analyses")
          .select(
            "id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, letter_tone, results_shared, confidence_level, rent_stabilized, utm_source, utm_medium, utm_campaign, created_at, counter_offer_low, counter_offer_high, comp_median_rent, hud_fmr_value, comps_count, comps_position, fair_counter_offer, sale_data_found, market_trend_pct, cache_hit, markup_multiplier, session_id, leads(id, email, lease_expiration_month, lease_expiration_year, partner_opt_in, capture_source, unsubscribed, outcome, reminder_sent_at, followup_sent_at, created_at)"
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
            "id, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, verdict_label, dollar_overpayment, letter_generated, letter_tone, results_shared, confidence_level, rent_stabilized, utm_source, utm_medium, utm_campaign, created_at, counter_offer_low, counter_offer_high, comp_median_rent, hud_fmr_value, comps_count, comps_position, fair_counter_offer, sale_data_found, market_trend_pct, cache_hit, markup_multiplier, anomaly_flags, session_id, leads(id, email, lease_expiration_month, lease_expiration_year, partner_opt_in, capture_source, unsubscribed, outcome, reminder_sent_at, followup_sent_at, created_at)",
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
          .select("id, analysis_id, email, link_type, event_type, placement, zip, created_at")
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

      case "orphan_leads": {
        const { data: rows, error } = await supabase
          .from("leads")
          .select("id, email, capture_source, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, comp_median_rent, hud_fmr_value, verdict, letter_generated, lease_expiration_month, lease_expiration_year, partner_opt_in, utm_source, utm_medium, utm_campaign, created_at, outcome, unsubscribed")
          .is("analysis_id", null)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        data = rows;
        break;
      }

      case "email_list": {
        const { data: rows, error } = await supabase
          .from("leads")
          .select("id, email, capture_source, address, city, state, zip, bedrooms, current_rent, proposed_rent, increase_pct, fairness_score, comp_median_rent, hud_fmr_value, verdict, letter_generated, lease_expiration_month, lease_expiration_year, partner_opt_in, utm_source, utm_medium, utm_campaign, created_at, outcome, unsubscribed, reminder_sent_at, followup_sent_at, sent_email_day45, analysis_id, tool_type, original_capture_source, first_captured_at")
          .not("email", "is", null)
          .order("created_at", { ascending: false })
          .limit(2000);
        if (error) throw error;
        data = rows;
        break;
      }

      case "diagnostic": {
        const today = new Date().toISOString().slice(0, 10);
        const mar14 = "2026-03-14";
        const mar15 = "2026-03-15";

        const { count: analysesMar14 } = await supabase
          .from("analyses")
          .select("*", { count: "exact", head: true })
          .gte("created_at", mar14)
          .lt("created_at", mar15);

        const { count: leadsMar14 } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", mar14)
          .lt("created_at", mar15);

        const { count: eventsMar14 } = await supabase
          .from("lead_events")
          .select("*", { count: "exact", head: true })
          .gte("created_at", mar14)
          .lt("created_at", mar15);

        const { count: analysesToday } = await supabase
          .from("analyses")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today);

        const { count: leadsToday } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today);

        const { count: eventsToday } = await supabase
          .from("lead_events")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today);

        const { count: analysesTotal } = await supabase
          .from("analyses")
          .select("*", { count: "exact", head: true });

        const { count: leadsTotal } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true });

        const { data: recentAnalyses } = await supabase
          .from("analyses")
          .select("id, address, zip, city, bedrooms, current_rent, fairness_score, verdict_label, created_at, tool_type, session_id")
          .order("created_at", { ascending: false })
          .limit(15);

        const { data: recentLeads } = await supabase
          .from("leads")
          .select("id, email, analysis_id, capture_source, address, zip, city, verdict, created_at, tool_type")
          .order("created_at", { ascending: false })
          .limit(15);

        const { data: recentEvents } = await supabase
          .from("lead_events")
          .select("id, email, analysis_id, event_type, zip, verdict, created_at")
          .order("created_at", { ascending: false })
          .limit(15);

        const { data: orphanedLeads } = await supabase.rpc("find_orphaned_leads");

        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const { data: unlinkedAnalyses } = await supabase
          .from("analyses")
          .select("id, address, zip, city, fairness_score, verdict_label, created_at, tool_type")
          .gte("created_at", threeDaysAgo)
          .order("created_at", { ascending: false })
          .limit(50);

        const analysisIds = (unlinkedAnalyses || []).map((a: any) => a.id);
        const { data: linkedLeads } = analysisIds.length > 0
          ? await supabase
              .from("leads")
              .select("analysis_id")
              .in("analysis_id", analysisIds)
          : { data: [] };
        const linkedIds = new Set((linkedLeads || []).map((l: any) => l.analysis_id));
        const unlinked = (unlinkedAnalyses || []).filter((a: any) => !linkedIds.has(a.id));

        data = {
          counts: {
            analyses_mar14: analysesMar14,
            leads_mar14: leadsMar14,
            events_mar14: eventsMar14,
            analyses_today: analysesToday,
            leads_today: leadsToday,
            events_today: eventsToday,
            analyses_total: analysesTotal,
            leads_total: leadsTotal,
          },
          recent_analyses: recentAnalyses,
          recent_leads: recentLeads,
          recent_events: recentEvents,
          orphaned_leads: orphanedLeads,
          unlinked_analyses_3d: unlinked,
        };
        break;
      }

      case "lead_lookup": {
        const searchEmail = (params?.email || "").trim().toLowerCase();
        if (!searchEmail) {
          data = { error: "Email required" };
          break;
        }
        const { data: leadRows } = await supabase
          .from("leads")
          .select("*")
          .ilike("email", `%${searchEmail}%`)
          .order("created_at", { ascending: false })
          .limit(10);
        const { data: eventRows } = await supabase
          .from("lead_events")
          .select("*")
          .ilike("email", `%${searchEmail}%`)
          .order("created_at", { ascending: false })
          .limit(20);
        const lookupAnalysisIds = [
          ...(leadRows || []).map((l: any) => l.analysis_id).filter(Boolean),
          ...(eventRows || []).map((e: any) => e.analysis_id).filter(Boolean),
        ];
        const lookupUniqueIds = [...new Set(lookupAnalysisIds)];
        const { data: analysisRows } = lookupUniqueIds.length > 0
          ? await supabase
              .from("analyses")
              .select("id, address, zip, city, bedrooms, current_rent, proposed_rent, fairness_score, verdict_label, created_at, tool_type")
              .in("id", lookupUniqueIds)
          : { data: [] };
        data = { leads: leadRows, events: eventRows, analyses: analysisRows };
        break;
      }

      case "delete_analysis": {
        const analysisId = params?.analysisId;
        if (!analysisId) {
          return new Response(JSON.stringify({ error: "analysisId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete in order: lead_events → leads → referral_clicks → shared_reports → user_feedback → analyses
        await supabase.from("lead_events").delete().eq("analysis_id", analysisId);
        await supabase.from("leads").delete().eq("analysis_id", analysisId);
        await supabase.from("referral_clicks").delete().eq("analysis_id", analysisId);
        await supabase.from("shared_reports").delete().eq("analysis_id", analysisId);
        await supabase.from("user_feedback").delete().eq("analysis_id", analysisId);
        const { error: delErr } = await supabase.from("analyses").delete().eq("id", analysisId);
        if (delErr) throw delErr;
        data = { success: true };
        break;
      }

      case "delete_lead": {
        const leadId = params?.leadId;
        if (!leadId) {
          return new Response(JSON.stringify({ error: "leadId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await supabase.from("lead_events").delete().eq("email", (await supabase.from("leads").select("email").eq("id", leadId).single()).data?.email || "");
        await supabase.from("email_send_attempts").delete().eq("lead_id", leadId);
        const { error: leadDelErr } = await supabase.from("leads").delete().eq("id", leadId);
        if (leadDelErr) throw leadDelErr;
        data = { success: true };
        break;
      }

      case "delete_feedback": {
        const feedbackId = params?.feedbackId;
        if (!feedbackId) {
          return new Response(JSON.stringify({ error: "feedbackId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: fbDelErr } = await supabase.from("user_feedback").delete().eq("id", feedbackId);
        if (fbDelErr) throw fbDelErr;
        data = { success: true };
        break;
      }

      case "feedback": {
        const { data: fbRows, error: fbErr } = await supabase
          .from("user_feedback")
          .select("id, analysis_id, rating, reason, comment, page, verdict_snapshot, score_snapshot, confidence_snapshot, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (fbErr) throw fbErr;
        data = fbRows;
        break;
      }

      case "outcomes": {
        const { data: outcomeRows, error: outcomeErr } = await supabase
          .from("leads")
          .select("id, email, outcome, testimonial, verdict, city, state, zip, current_rent, proposed_rent, fairness_score, tool_type, capture_source, created_at, followup_sent_at, founder_followup_sent_at, unsubscribed")
          .not("outcome", "is", null)
          .order("created_at", { ascending: false })
          .limit(200);
        if (outcomeErr) throw outcomeErr;
        data = outcomeRows;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown query type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    responseStatus = 200;
    reqSuccess = true;
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    } finally {
      if (logId) {
        await rlClient
          .from("function_request_log")
          .update({ success: reqSuccess, response_status: responseStatus })
          .eq("id", logId);
      }
    }
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
