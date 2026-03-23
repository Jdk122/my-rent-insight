import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function normalizeAddr(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, " ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limiting: 20/hour per IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const endpoint = "walkscore-lookup";
    const windowStart = new Date(Date.now() - 3600000).toISOString();

    const { data: rlData } = await sb
      .from("rate_limits")
      .select("request_count")
      .eq("ip_address", ip)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart)
      .maybeSingle();

    if (rlData && rlData.request_count >= 20) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Upsert rate limit
    await sb.from("rate_limits").upsert(
      {
        ip_address: ip,
        endpoint,
        window_start: new Date().toISOString(),
        request_count: (rlData?.request_count || 0) + 1,
      },
      { onConflict: "ip_address,endpoint" },
    );

    const { address, lat, lon } = await req.json();

    if (!address || lat == null || lon == null) {
      return new Response(
        JSON.stringify({ error: "address, lat, and lon are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normAddr = normalizeAddr(address);

    // Check cache
    const { data: cached } = await sb
      .from("walkscore_cache")
      .select("*")
      .eq("normalized_address", normAddr)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.updated_at).getTime();
      if (age < CACHE_TTL_MS) {
        return new Response(
          JSON.stringify({
            walkscore: cached.walkscore,
            transit: cached.transit,
            bike: cached.bike,
            description: cached.description,
            cacheHit: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const apiKey = Deno.env.get("WALKSCORE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Walk Score API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const encodedAddr = encodeURIComponent(address);
    const url = `https://api.walkscore.com/score?format=json&address=${encodedAddr}&lat=${lat}&lon=${lon}&transit=1&bike=1&wsapikey=${apiKey}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Walk Score API error", status: resp.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const raw = await resp.json();

    const result = {
      walkscore: raw.walkscore ?? null,
      transit: raw.transit?.score ?? null,
      bike: raw.bike?.score ?? null,
      description: raw.description ?? null,
    };

    // Upsert cache
    await sb.from("walkscore_cache").upsert(
      {
        normalized_address: normAddr,
        walkscore: result.walkscore,
        transit: result.transit,
        bike: result.bike,
        description: result.description,
        raw,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "normalized_address" },
    );

    return new Response(
      JSON.stringify({ ...result, cacheHit: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("walkscore-lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
