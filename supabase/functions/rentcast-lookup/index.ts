import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS = 7; // Active listings change fast — shorter TTL

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

    // Strip unit/apt from address for better geocoding (Rentcast needs street-level)
    const cleanAddress = address
      ? address.replace(/\s*(apt|unit|suite|ste|#)\s*\S+/gi, '').replace(/\s+/g, ' ').trim()
      : null;

    // Need either address or zip for listings search
    if (!cleanAddress && !zip) {
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
    const lookupKey = cleanAddress
      ? `listings|${cleanAddress.toLowerCase().trim()}|br${bedrooms ?? "any"}`
      : `listings|${zip}|br${bedrooms ?? "any"}`;
    const endpoint = "rental-listings";

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
          JSON.stringify({ ...cached.response_data, cacheHit: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build query params for /v1/listings/rental/long-term
    const params = new URLSearchParams();
    if (cleanAddress) {
      params.set("address", cleanAddress);
      params.set("radius", "1"); // 1 mile radius to keep comps local
    } else {
      params.set("zipCode", zip);
    }
    if (bedrooms !== undefined) {
      params.set("bedrooms", String(bedrooms));
    }
    params.set("status", "Active");
    params.set("limit", "10");
    params.set("propertyType", "Apartment");

    const url = `https://api.rentcast.io/v1/listings/rental/long-term?${params.toString()}`;
    console.log("Fetching listings:", url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Rentcast listings API error:", response.status, errorText);

      // Fall back to empty result (don't break the page)
      return new Response(
        JSON.stringify({ rentEstimate: null, rentRangeLow: null, rentRangeHigh: null, comparables: [], cacheHit: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listings = await response.json();
    const listingsArr = Array.isArray(listings) ? listings : [];

    // Compute median and range from active listings
    const rents = listingsArr.map((l: any) => l.price).filter((p: any) => typeof p === "number" && p > 0).sort((a: number, b: number) => a - b);
    const median = rents.length > 0 ? rents[Math.floor(rents.length / 2)] : null;
    const rangeLow = rents.length > 0 ? rents[0] : null;
    const rangeHigh = rents.length > 0 ? rents[rents.length - 1] : null;

    // Map listings to comparable format
    const comparables = listingsArr.slice(0, 10).map((listing: any) => {
      // Calculate distance if coordinates available (haversine approximation)
      let distance: number | null = null;

      // Calculate days on market
      const listedDate = listing.listedDate || listing.createdDate;
      let daysOnMarket: number | null = listing.daysOnMarket ?? null;
      if (daysOnMarket === null && listedDate) {
        daysOnMarket = Math.round((Date.now() - new Date(listedDate).getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        formattedAddress: listing.formattedAddress || listing.addressLine1 || "Unknown",
        rent: listing.price ?? null,
        bedrooms: listing.bedrooms ?? null,
        bathrooms: listing.bathrooms ?? null,
        squareFootage: listing.squareFootage ?? null,
        distance: distance,
        daysOld: daysOnMarket,
        correlation: null,
        // New rich fields
        status: listing.status || "Active",
        listingType: listing.listingType || null,
        listedDate: listedDate || null,
        daysOnMarket: daysOnMarket,
        propertyType: listing.propertyType || null,
        lastSeenDate: listing.lastSeenDate || null,
      };
    });

    const result = {
      rentEstimate: median,
      rentRangeLow: rangeLow,
      rentRangeHigh: rangeHigh,
      comparables,
      totalListings: listingsArr.length,
      source: "active-listings",
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
