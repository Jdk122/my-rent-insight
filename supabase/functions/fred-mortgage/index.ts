import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Rate limiting (20/5min) ---
    const ip = getClientIp(req);
    const fnName = "fred-mortgage";
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

    if ((recentCount ?? 0) >= 20) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await rlClient.from("function_request_log").insert({
      function_name: fnName, ip_address: ip,
    });

    const FRED_API_KEY = Deno.env.get("FRED_API_KEY");
    if (!FRED_API_KEY) {
      return new Response(
        JSON.stringify({ error: "FRED_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "mortgage";

    if (type === "mortgage") {
      // Mortgage rate lookup: expects ?sale_date=YYYY-MM-DD
      const saleDate = url.searchParams.get("sale_date");
      if (!saleDate) {
        return new Response(
          JSON.stringify({ error: "sale_date parameter required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const date = new Date(saleDate);
      const start = new Date(date);
      start.setDate(start.getDate() - 14);
      const end = new Date(date);
      end.setDate(end.getDate() + 14);

      const fmtDate = (d: Date) => d.toISOString().split("T")[0];
      const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${FRED_API_KEY}&file_type=json&observation_start=${fmtDate(start)}&observation_end=${fmtDate(end)}&sort_order=desc&limit=1`;

      const res = await fetch(fredUrl);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ rate: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      const obs = data.observations?.filter((o: { value: string }) => o.value !== ".");
      if (!obs || obs.length === 0) {
        return new Response(
          JSON.stringify({ rate: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ rate: parseFloat(obs[0].value) / 100 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "trend") {
      // Rent trend lookup: expects ?series_id=XXXX
      const seriesId = url.searchParams.get("series_id");
      if (!seriesId) {
        return new Response(
          JSON.stringify({ error: "series_id parameter required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=13`;

      const res = await fetch(fredUrl);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ observations: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      const observations = data.observations
        ?.filter((o: { value: string }) => o.value !== ".")
        .map((o: { date: string; value: string }) => ({
          date: o.date,
          value: parseFloat(o.value),
        }));

      return new Response(
        JSON.stringify({ observations: observations || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid type parameter. Use 'mortgage' or 'trend'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fred-mortgage error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
