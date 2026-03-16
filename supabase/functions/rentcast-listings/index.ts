import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
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

    // --- Rate limiting (20/hour) ---
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const windowKey = windowStart.toISOString();

    const { data: rlRow } = await sb
      .from("rate_limits")
      .select("request_count")
      .eq("ip_address", clientIP)
      .eq("endpoint", "rentcast-listings")
      .eq("window_start", windowKey)
      .maybeSingle();

    if (rlRow && rlRow.request_count >= 20) {
      return new Response(
        JSON.stringify({ listings: [], cacheHit: false, error: "Rate limit exceeded" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await sb.from("rate_limits").upsert(
      {
        ip_address: clientIP,
        endpoint: "rentcast-listings",
        window_start: windowKey,
        request_count: (rlRow?.request_count ?? 0) + 1,
      },
      { onConflict: "ip_address,endpoint,window_start" },
    );

    const { zip, bedrooms } = await req.json();

    if (!zip || bedrooms === undefined) {
      return new Response(
        JSON.stringify({ listings: [], cacheHit: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("RENTCAST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ listings: [], cacheHit: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lookupKey = `${zip}|br${bedrooms}|listings`;
    const endpointKey = "rental-listings";

    // Check cache
    const { data: cached } = await sb
      .from("rentcast_cache")
      .select("response_data, fetched_at")
      .eq("lookup_key", lookupKey)
      .eq("endpoint", endpointKey)
      .maybeSingle();

    const cacheAge = cached ? Date.now() - new Date(cached.fetched_at).getTime() : Infinity;
    const cacheIsFresh = cacheAge < CACHE_TTL_MS;

    if (cached && cacheIsFresh) {
      console.log(`Cache hit for listings: ${lookupKey}`);
      return new Response(
        JSON.stringify({ ...cached.response_data, cacheHit: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch from Rentcast with 10s timeout
    let apiListings: any[] | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const params = new URLSearchParams({
        zipCode: zip,
        bedrooms: String(bedrooms),
        status: "Active",
        limit: "10",
      });

      const resp = await fetch(
        `https://api.rentcast.io/v1/listings/rental/long-term?${params.toString()}`,
        {
          headers: { Accept: "application/json", "X-Api-Key": apiKey },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (resp.ok) {
        const raw = await resp.json();
        apiListings = Array.isArray(raw) ? raw : [];
      } else {
        const errText = await resp.text();
        console.error(`Rentcast listings API error: ${resp.status}`, errText);
      }
    } catch (err) {
      console.error("Rentcast listings fetch failed/timed out:", err);
    }

    // Stale cache fallback
    if (apiListings === null && cached) {
      console.log("Using stale cache for listings");
      return new Response(
        JSON.stringify({ ...cached.response_data, cacheHit: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!apiListings) {
      return new Response(
        JSON.stringify({ listings: [], cacheHit: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Process listings
    const seen = new Map<string, any>();
    for (const l of apiListings) {
      const rent = l.price ?? null;
      if (rent == null || rent <= 200 || rent > 25000) continue;

      const addr = l.formattedAddress || l.addressLine1 || "";
      if (!addr) continue;

      const normAddr = normalizeAddress(addr);
      const existing = seen.get(normAddr);
      if (existing && existing.rent <= rent) continue;

      const daysOnMarket = l.daysOnMarket ?? (l.listedDate
        ? Math.max(0, Math.round((Date.now() - new Date(l.listedDate).getTime()) / 86400000))
        : null);

      seen.set(normAddr, {
        formattedAddress: addr,
        city: l.city || "",
        state: l.state || "",
        zipCode: l.zipCode || zip,
        rent,
        bedrooms: l.bedrooms ?? null,
        bathrooms: l.bathrooms ?? null,
        squareFootage: l.squareFootage ?? null,
        daysOnMarket,
        listingUrl: l.url || null,
      });
    }

    const listings = Array.from(seen.values())
      .sort((a, b) => a.rent - b.rent)
      .slice(0, 8);

    const result = { listings };

    // Cache result
    await sb.from("rentcast_cache").upsert(
      {
        lookup_key: lookupKey,
        endpoint: endpointKey,
        response_data: result,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "lookup_key,endpoint" },
    );

    return new Response(
      JSON.stringify({ ...result, cacheHit: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("rentcast-listings error:", error);
    return new Response(
      JSON.stringify({ listings: [], cacheHit: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
