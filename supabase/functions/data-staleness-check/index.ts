import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STALENESS_THRESHOLD_DAYS = 45;
const ALERT_EMAIL = "james@renewalreply.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch data_freshness.json from the live site
    const freshnessUrl = "https://www.renewalreply.com/data/data_freshness.json";
    const res = await fetch(freshnessUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch data_freshness.json: ${res.status}`);
    }
    const freshness = await res.json();

    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - STALENESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    );

    const staleItems: { source: string; date: string; daysOld: number }[] = [];

    const sourceLabels: Record<string, string> = {
      hud_safmr: "HUD SAFMR",
      hud_50pct: "HUD 50th Percentile",
      apartment_list: "Apartment List",
      zillow_zori: "Zillow ZORI",
      zillow_zhvi: "Zillow ZHVI",
    };

    for (const [key, label] of Object.entries(sourceLabels)) {
      const dateStr = freshness[key];
      if (!dateStr || dateStr === "realtime") continue;
      const sourceDate = new Date(dateStr + "T00:00:00Z");
      if (sourceDate < staleThreshold) {
        const daysOld = Math.floor(
          (now.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        staleItems.push({ source: label, date: dateStr, daysOld });
      }
    }

    const allFresh = staleItems.length === 0;
    let alertSent = false;

    if (!allFresh) {
      // Build email
      const emailHtml = `
        <h2>⚠️ RenewalReply Data Staleness Alert</h2>
        <p>The following data sources are more than ${STALENESS_THRESHOLD_DAYS} days old:</p>
        <ul>
          ${staleItems
            .map(
              (s) =>
                `<li><strong>${s.source}</strong>: last updated ${s.date} (${s.daysOld} days ago)</li>`
            )
            .join("")}
        </ul>
        <p>Please run the appropriate refresh scripts to update the data.</p>
        <p style="color: #888; font-size: 12px;">This alert is sent weekly by the data-staleness-check function.</p>
      `;

      // Send via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "RenewalReply Alerts <noreply@renewalreply.com>",
            to: [ALERT_EMAIL],
            subject: `⚠️ Data Staleness Alert: ${staleItems.length} source${staleItems.length > 1 ? "s" : ""} outdated`,
            html: emailHtml,
          }),
        });

        alertSent = emailRes.ok;
        if (!emailRes.ok) {
          const errText = await emailRes.text();
          console.error(`Resend error: ${emailRes.status} ${errText}`);
        }
      } else {
        console.error("RESEND_API_KEY not configured — skipping alert email");
      }
    }

    // Log result to data_freshness_log table
    await sb.from("data_freshness_log").insert({
      all_fresh: allFresh,
      stale_sources: staleItems,
      alert_sent: alertSent,
    });

    return new Response(
      JSON.stringify({
        status: allFresh ? "ok" : "alert_sent",
        all_fresh: allFresh,
        stale_sources: staleItems,
        alert_sent: alertSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Data staleness check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
