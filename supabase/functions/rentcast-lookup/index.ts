import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS = 7;
const MIN_COMPS = 5;

interface SearchStep {
  radius: number;
  bedroomsDelta: number; // 0 = exact, 1 = ±1
  label: string;
}

const SEARCH_STEPS: SearchStep[] = [
  { radius: 1, bedroomsDelta: 0, label: "1 mile" },
  { radius: 3, bedroomsDelta: 0, label: "3 miles" },
  { radius: 10, bedroomsDelta: 0, label: "10 miles" },
  { radius: 3, bedroomsDelta: 1, label: "3 miles, ±1 bedroom" },
];

async function fetchListings(
  apiKey: string,
  address: string | null,
  zip: string | null,
  bedrooms: number | undefined,
  radius: number,
  bedroomsDelta: number
): Promise<any[]> {
  const params = new URLSearchParams();
  if (address) {
    params.set("address", address);
    params.set("radius", String(radius));
  } else {
    params.set("zipCode", zip!);
  }

  if (bedrooms !== undefined && bedroomsDelta === 0) {
    params.set("bedrooms", String(bedrooms));
  } else if (bedrooms !== undefined && bedroomsDelta === 1) {
    // Rentcast doesn't support range, so we omit bedrooms filter
    // and filter client-side for ±1
    params.set("bedroomsMin", String(Math.max(0, bedrooms - 1)));
    params.set("bedroomsMax", String(bedrooms + 1));
  }

  params.set("status", "Active");
  params.set("limit", "20");
  params.set("propertyType", "Apartment");

  const url = `https://api.rentcast.io/v1/listings/rental/long-term?${params.toString()}`;
  console.log("Fetching listings:", url);

  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-Api-Key": apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Rentcast API error:", response.status, errorText);
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

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

    // Strip unit/apt from address for better geocoding
    const cleanAddress = address
      ? address.replace(/\s*(apt|unit|suite|ste|#)\s*\S+/gi, '').replace(/\s+/g, ' ').trim()
      : null;

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
      ? `listings-v2|${cleanAddress.toLowerCase().trim()}|br${bedrooms ?? "any"}`
      : `listings-v2|${zip}|br${bedrooms ?? "any"}`;
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

    // Tiered search: expand radius and bedrooms until we have MIN_COMPS
    let allListings: any[] = [];
    let usedStep: SearchStep = SEARCH_STEPS[0];

    for (const step of SEARCH_STEPS) {
      const listings = await fetchListings(
        apiKey,
        cleanAddress,
        zip,
        bedrooms,
        step.radius,
        step.bedroomsDelta
      );

      // Filter to only listings with valid rent
      const valid = listings.filter((l: any) => typeof l.price === "number" && l.price > 0);

      if (valid.length >= MIN_COMPS) {
        allListings = valid;
        usedStep = step;
        console.log(`Found ${valid.length} comps at step: ${step.label}`);
        break;
      }

      // If this is the last step, take whatever we have
      if (step === SEARCH_STEPS[SEARCH_STEPS.length - 1]) {
        // Use the best result we've seen across all steps
        if (valid.length > allListings.length) {
          allListings = valid;
          usedStep = step;
        }
        console.log(`Final step reached with ${allListings.length} comps at: ${usedStep.label}`);
      } else if (valid.length > allListings.length) {
        // Keep track of best result so far in case we need fallback
        allListings = valid;
        usedStep = step;
      }
    }

    // Compute median and range
    const rents = allListings.map((l: any) => l.price).sort((a: number, b: number) => a - b);
    const median = rents.length > 0 ? rents[Math.floor(rents.length / 2)] : null;
    const rangeLow = rents.length > 0 ? rents[0] : null;
    const rangeHigh = rents.length > 0 ? rents[rents.length - 1] : null;

    // Map to comparable format (cap at 10)
    const comparables = allListings.slice(0, 10).map((listing: any) => {
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
        distance: null,
        daysOld: daysOnMarket,
        correlation: null,
        status: listing.status || "Active",
        listingType: listing.listingType || null,
        listedDate: listedDate || null,
        daysOnMarket: daysOnMarket,
        propertyType: listing.propertyType || null,
        lastSeenDate: listing.lastSeenDate || null,
      };
    });

    // Build expansion note for the UI
    let searchNote: string | null = null;
    if (usedStep.radius > 1 || usedStep.bedroomsDelta > 0) {
      if (usedStep.bedroomsDelta > 0) {
        searchNote = `Showing comparable units within ${usedStep.radius} miles (±1 bedroom) — not enough exact-match listings nearby.`;
      } else {
        searchNote = `Showing comparable units within ${usedStep.radius} miles — closer matches weren't available.`;
      }
    }

    const result = {
      rentEstimate: median,
      rentRangeLow: rangeLow,
      rentRangeHigh: rangeHigh,
      comparables,
      totalListings: allListings.length,
      source: "active-listings",
      searchRadius: usedStep.radius,
      searchNote,
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
