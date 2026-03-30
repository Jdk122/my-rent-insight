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

    const apiKey = Deno.env.get("RENTCAST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ listings: [], error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limiting (10/hour — these are expensive bulk calls)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const windowKey = windowStart.toISOString();

    const { data: rlRow } = await sb
      .from("rate_limits")
      .select("request_count")
      .eq("ip_address", clientIP)
      .eq("endpoint", "deals-listings")
      .eq("window_start", windowKey)
      .maybeSingle();

    if (rlRow && rlRow.request_count >= 10) {
      return new Response(
        JSON.stringify({ listings: [], cacheHit: false, error: "Rate limit exceeded" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await sb.from("rate_limits").upsert(
      {
        ip_address: clientIP,
        endpoint: "deals-listings",
        window_start: windowKey,
        request_count: (rlRow?.request_count ?? 0) + 1,
      },
      { onConflict: "ip_address,endpoint,window_start" },
    );

    // Parse request
    const { zips } = await req.json();
    if (!Array.isArray(zips) || zips.length === 0 || zips.length > 10) {
      return new Response(
        JSON.stringify({ listings: [], error: "Provide 1-10 ZIP codes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check cache first — one combined key for the ZIP set
    const sortedZips = [...zips].sort();
    const lookupKey = `deals:${sortedZips.join(",")}`;
    const endpointKey = "deals-listings";

    const { data: cached } = await sb
      .from("rentcast_cache")
      .select("response_data, fetched_at")
      .eq("lookup_key", lookupKey)
      .eq("endpoint", endpointKey)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        const cachedData = cached.response_data as any;
        return new Response(
          JSON.stringify({
            listings: cachedData.listings ?? [],
            totalScanned: cachedData.totalScanned ?? 0,
            walkScores: cachedData.walkScores ?? {},
            refreshedAt: cachedData.refreshedAt ?? null,
            cacheHit: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch from Rentcast — one call per ZIP with limit=500
    const allListings: any[] = [];

    for (const zip of sortedZips) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const params = new URLSearchParams({
          zipCode: zip,
          status: "Active",
          limit: "500",
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
          if (Array.isArray(raw)) {
            allListings.push(...raw);
          }
        } else {
          console.error(`Rentcast deals API error for ${zip}: ${resp.status}`);
        }
      } catch (err) {
        console.error(`Rentcast deals fetch failed for ${zip}:`, err);
      }
    }

    // Stale cache fallback
    if (allListings.length === 0 && cached) {
      return new Response(
        JSON.stringify({ ...(cached.response_data as any), cacheHit: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Process and deduplicate
    const seen = new Map<string, any>();
    for (const l of allListings) {
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

      // Filter out stale listings (>45 days)
      if (daysOnMarket != null && daysOnMarket > 45) continue;

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
        propertyType: l.propertyType || null,
      });
    }

    const listings = Array.from(seen.values())
      .sort((a, b) => a.rent - b.rent);

    const result = { listings, totalScanned: allListings.length };

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
    console.error("deals-listings error:", error);
    return new Response(
      JSON.stringify({ listings: [], cacheHit: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
