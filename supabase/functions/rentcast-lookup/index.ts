import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS_RENT = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Rate limiting (10/hour) ---
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const windowKey = windowStart.toISOString();
    const rlSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rlRow } = await rlSb
      .from("rate_limits")
      .select("request_count")
      .eq("ip_address", clientIP)
      .eq("endpoint", "rentcast-lookup")
      .eq("window_start", windowKey)
      .maybeSingle();
    if (rlRow && rlRow.request_count >= 10) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    await rlSb.from("rate_limits").upsert(
      { ip_address: clientIP, endpoint: "rentcast-lookup", window_start: windowKey, request_count: (rlRow?.request_count ?? 0) + 1 },
      { onConflict: "ip_address,endpoint,window_start" }
    );
    // --- End rate limiting ---

    const { zip, bedrooms, address } = await req.json();

    const apiKey = Deno.env.get("RENTCAST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Rentcast API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Zip-only: skip Rentcast AVM (it doesn't support zip-only queries)
    if (!address && zip) {
      return new Response(
        JSON.stringify({ rentEstimate: null, rentRangeLow: null, rentRangeHigh: null, comparables: [], cacheHit: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build cache key
    const lookupKey = address
      ? `${address.toLowerCase().replace(/\s+/g, ' ').trim()}|br${bedrooms ?? "any"}`
      : `${zip}|br${bedrooms ?? "any"}`;
    const endpoint = "rent-estimate";

    // Check cache
    const { data: cached } = await sb
      .from("rentcast_cache")
      .select("response_data, fetched_at")
      .eq("lookup_key", lookupKey)
      .eq("endpoint", endpoint)
      .single();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < CACHE_DAYS_RENT * 24 * 60 * 60 * 1000) {
        console.log(`Cache hit for ${endpoint}: ${lookupKey}`);
        return new Response(
          JSON.stringify({ ...cached.response_data, cacheHit: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Strip unit/apt from address for AVM query (Rentcast returns better comps without it)
    const strippedAddress = address
      ? address.replace(/\b(apt|unit|suite|ste|#)\s*\S*/gi, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim()
      : null;

    // Build query params
    const params = new URLSearchParams();
    if (strippedAddress) {
      params.set("address", strippedAddress);
    }
    if (bedrooms !== undefined) {
      params.set("bedrooms", String(bedrooms));
    }
    params.set("compCount", "10");
    params.set("maxRadius", "3");
    params.set("propertyType", "Apartment");
    params.set("lookupSubjectAttributes", "true");

    const url = `https://api.rentcast.io/v1/avm/rent/long-term?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Rentcast API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Rentcast API error", status: response.status }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract subject property type or infer from closest comps
    let propertyType: string | null = data.propertyType ?? null;
    if (!propertyType && data.comparables?.length) {
      const closeComps = (data.comparables as any[])
        .filter((c: any) => c.distance != null && c.distance <= 0.25)
        .slice(0, 3);
      if (closeComps.length >= 2) {
        const counts: Record<string, number> = {};
        for (const c of closeComps) {
          const pt = c.propertyType || "Unknown";
          counts[pt] = (counts[pt] || 0) + 1;
        }
        propertyType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      }
    }

    const requestedBedrooms = bedrooms !== undefined ? Number(bedrooms) : null;

    const rawComps = (data.comparables || []).slice(0, 15).map((comp: any) => ({
      formattedAddress: comp.formattedAddress || comp.address || "Unknown",
      rent: comp.price ?? comp.lastSeenPrice ?? null,
      bedrooms: comp.bedrooms ?? null,
      bathrooms: comp.bathrooms ?? null,
      squareFootage: comp.squareFootage ?? null,
      distance: comp.distance ?? null,
      daysOld: comp.daysOld ?? null,
      correlation: comp.correlation ?? null,
      listingType: comp.listingType ?? null,
    }));

    // Detect same-building comps by matching street address (ignoring unit/apt numbers)
    const subjectStreet = address
      ? address.replace(/\b(apt|unit|suite|ste|#)\s*\S*/gi, '').replace(/\s+/g, ' ').trim().toLowerCase()
      : '';

    const compsWithBuildingFlag = rawComps.map((comp: any) => {
      const compStreet = (comp.formattedAddress || '')
        .replace(/\b(apt|unit|suite|ste|#)\s*\S*/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      // Same building: street matches OR distance is effectively zero
      const isSameBuilding = (subjectStreet && compStreet && compStreet.startsWith(subjectStreet.split(',')[0]))
        || (comp.distance !== null && comp.distance <= 0.05);

      return {
        ...comp,
        isSameBuilding,
        // Boost correlation for same-building comps (most defensible)
        correlation: isSameBuilding ? Math.min((comp.correlation ?? 0.5) * 1.5, 1.0) : (comp.correlation ?? null),
      };
    });

    const validComps = compsWithBuildingFlag.filter((comp: any) => {
      if (comp.rent == null || comp.rent < 200 || comp.rent > 25000 || comp.rent <= 0) {
        console.warn(`Rejected comp "${comp.formattedAddress}": invalid rent ${comp.rent}`);
        return false;
      }
      if (requestedBedrooms !== null && comp.bedrooms != null && Math.abs(comp.bedrooms - requestedBedrooms) > 1) {
        console.warn(`Rejected comp "${comp.formattedAddress}": bedrooms ${comp.bedrooms} vs requested ${requestedBedrooms}`);
        return false;
      }
      if (comp.distance != null && comp.distance > 10) {
        console.warn(`Rejected comp "${comp.formattedAddress}": distance ${comp.distance} miles`);
        return false;
      }
      return true;
    });

    // Prioritize same-building comps, then sort by correlation
    const sameBuilding = validComps.filter((c: any) => c.isSameBuilding);
    const nearby = validComps.filter((c: any) => !c.isSameBuilding)
      .sort((a: any, b: any) => (b.correlation ?? 0) - (a.correlation ?? 0));

    // Keep all same-building comps (up to 5), fill remaining slots with best nearby
    const prioritizedComps = [
      ...sameBuilding.slice(0, 5),
      ...nearby.slice(0, Math.max(0, 8 - sameBuilding.length)),
    ].slice(0, 8);

    const result = {
      rentEstimate: prioritizedComps.length > 0 ? (data.rent ?? data.rentRangeLow ?? null) : null,
      rentRangeLow: data.rentRangeLow ?? null,
      rentRangeHigh: data.rentRangeHigh ?? null,
      propertyType,
      comparables: prioritizedComps,
    };

    // Upsert to cache
    await sb.from("rentcast_cache").upsert(
      {
        lookup_key: lookupKey,
        endpoint,
        response_data: result,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "lookup_key,endpoint" }
    );

    return new Response(JSON.stringify({ ...result, cacheHit: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
