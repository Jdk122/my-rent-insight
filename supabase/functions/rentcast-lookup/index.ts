import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Build query params
    const params = new URLSearchParams();
    if (address) {
      params.set("address", address);
    } else if (zip) {
      // Use zip code with a generic lookup
      params.set("zipCode", zip);
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

    // Extract what we need
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

    return new Response(JSON.stringify(result), {
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
