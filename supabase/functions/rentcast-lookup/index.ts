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
      ? `${address.toLowerCase().trim()}|br${bedrooms ?? "any"}`
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

    // Build query params
    const params = new URLSearchParams();
    if (address) {
      params.set("address", address);
    }
    if (bedrooms !== undefined) {
      params.set("bedrooms", String(bedrooms));
    }
    params.set("compCount", "5");
    params.set("propertyType", "Apartment");

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

    const result = {
      rentEstimate: data.rent ?? data.rentRangeLow ?? null,
      rentRangeLow: data.rentRangeLow ?? null,
      rentRangeHigh: data.rentRangeHigh ?? null,
      comparables: (data.comparables || []).slice(0, 5).map((comp: any) => ({
        formattedAddress: comp.formattedAddress || comp.address || "Unknown",
        rent: comp.price ?? comp.lastSeenPrice ?? null,
        bedrooms: comp.bedrooms ?? null,
        bathrooms: comp.bathrooms ?? null,
        squareFootage: comp.squareFootage ?? null,
        distance: comp.distance ?? null,
        daysOld: comp.daysOld ?? null,
        correlation: comp.correlation ?? null,
        listingType: comp.listingType ?? null,
      })),
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
