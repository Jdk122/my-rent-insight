import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

const FRED_API_KEY = Deno.env.get("FRED_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Rate limiting (20/5min) ---
  try {
    const ip = getClientIp(req);
    const fnName = "fred-vacancy";
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
  } catch (rlErr) {
    console.error("Rate limit check failed:", rlErr);
  }

  try {
    const { state } = await req.json();
    if (!state || typeof state !== "string" || state.length !== 2) {
      return new Response(
        JSON.stringify({ error: "Invalid state abbreviation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seriesId = `${state.toUpperCase()}RVAC`;
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ rate: 7.0, year: "2024", isFallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const obs = data.observations?.filter((o: { value: string }) => o.value !== ".");

    if (!obs || obs.length === 0) {
      return new Response(
        JSON.stringify({ rate: 7.0, year: "2024", isFallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        rate: parseFloat(obs[0].value),
        year: obs[0].date?.split("-")[0] || "2024",
        isFallback: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("FRED vacancy error:", error);
    return new Response(
      JSON.stringify({ rate: 7.0, year: "2024", isFallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
