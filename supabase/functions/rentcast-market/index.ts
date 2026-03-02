import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zip } = await req.json();

    if (!zip || !/^\d{5}$/.test(zip)) {
      return new Response(
        JSON.stringify({ error: "Valid 5-digit zip required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("RENTCAST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Rentcast API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const lookupKey = `market|${zip}`;
    const endpoint = "market-statistics";

    // Check cache
    const { data: cached } = await sb
      .from("rentcast_cache")
      .select("response_data, fetched_at")
      .eq("lookup_key", lookupKey)
      .eq("endpoint", endpoint)
      .single();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < CACHE_DAYS * 24 * 60 * 60 * 1000) {
        console.log(`Cache hit for ${endpoint}: ${lookupKey}`);
        return new Response(
          JSON.stringify({ ...cached.response_data as Record<string, unknown>, cacheHit: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch from Rentcast market statistics API
    const params = new URLSearchParams({
      zipCode: zip,
      historyRange: "6",
    });

    const url = `https://api.rentcast.io/v1/markets?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Rentcast market API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Rentcast API error", status: response.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = await response.json();
    console.log("Rentcast market response keys:", JSON.stringify(Object.keys(raw)));
    console.log("Rentcast market rentalData:", JSON.stringify(raw?.rentalData).slice(0, 2000));

    // Extract useful data from the response
    // Rentcast /v1/markets returns { rentalData: { ... }, saleData: { ... } }
    const rental = raw?.rentalData;

    const result = {
      averageRent: rental?.averageRent ?? null,
      medianRent: rental?.medianRent ?? null,
      minRent: rental?.minRent ?? null,
      maxRent: rental?.maxRent ?? null,
      totalListings: rental?.totalListings ?? null,
      averageRentBySqft: rental?.averageRentBySqft ?? null,
      detailedStats: rental?.detailedStats ?? null,
      rentTrend: rental?.historyRent ?? null,
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
