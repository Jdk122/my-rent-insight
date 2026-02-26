import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RENTCAST_API_KEY = Deno.env.get("RENTCAST_API_KEY");
const RENTCAST_BASE = "https://api.rentcast.io/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const { address } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RENTCAST_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Rentcast API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Check cache first
    const normalizedAddress = address.toLowerCase().trim();
    const { data: cached } = await supabase
      .from("property_cache")
      .select("data, created_at")
      .eq("address_normalized", normalizedAddress)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (age < thirtyDays) {
        return new Response(
          JSON.stringify(cached.data),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Rate limiting check
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourCount } = await supabase
      .from("lookup_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIP)
      .gte("created_at", oneHourAgo);

    if ((hourCount || 0) >= 20) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later.", code: "RATE_LIMIT" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the lookup for rate limiting
    await supabase.from("lookup_rate_limits").insert({ ip_address: clientIP });

    // Call Rentcast /properties endpoint
    const encodedAddress = encodeURIComponent(address);
    const propertyUrl = `${RENTCAST_BASE}/properties?address=${encodedAddress}`;

    const propertyRes = await fetch(propertyUrl, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": RENTCAST_API_KEY,
      },
    });

    if (!propertyRes.ok) {
      const errText = await propertyRes.text();
      console.error("Rentcast property error:", propertyRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Property not found", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propertyData = await propertyRes.json();
    const property = Array.isArray(propertyData) ? propertyData[0] : propertyData;

    if (!property) {
      return new Response(
        JSON.stringify({ error: "Property not found", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the most recent tax assessment
    const taxAssessments = property.taxAssessments || {};
    const taxYears = Object.keys(taxAssessments).sort().reverse();
    const latestTaxYear = taxYears[0];
    const latestTax = latestTaxYear ? taxAssessments[latestTaxYear] : null;
    const priorTaxYear = taxYears[1];
    const priorTax = priorTaxYear ? taxAssessments[priorTaxYear] : null;

    // Extract owner info
    const owner = property.owner || {};
    const ownerMailingAddress = owner.mailingAddress || {};

    // Determine if investor (owner mailing address != property address)
    const propZip = property.zipCode || "";
    const ownerZip = ownerMailingAddress.zipCode || "";
    const ownerLine1 = (ownerMailingAddress.addressLine1 || "").toLowerCase();
    const propLine1 = (property.addressLine1 || "").toLowerCase();
    const isInvestor = ownerZip !== propZip || ownerLine1 !== propLine1;

    // Build result
    const result = {
      address: property.formattedAddress || address,
      city: property.city || null,
      state: property.state || null,
      zipCode: property.zipCode || null,

      propertyType: property.propertyType || "Unknown",
      yearBuilt: property.yearBuilt || null,
      bedrooms: property.bedrooms || null,
      bathrooms: property.bathrooms || null,
      squareFootage: property.squareFootage || null,
      lotSize: property.lotSize || null,

      lastSalePrice: property.lastSalePrice || null,
      lastSaleDate: property.lastSaleDate || null,

      saleHistory: Array.isArray(property.history)
        ? property.history.map((h: any) => ({
            date: h.date,
            price: h.price,
          }))
        : [],

      assessedValue: latestTax?.value || null,
      landValue: latestTax?.land || null,
      improvementValue: latestTax?.improvements || null,
      annualTax: latestTax?.tax || null,
      taxYear: latestTaxYear ? parseInt(latestTaxYear) : null,
      priorYearTax: priorTax?.tax || null,
      priorTaxYear: priorTaxYear ? parseInt(priorTaxYear) : null,

      ownerType: owner.type || null,
      isInvestor,
      ownerCity: ownerMailingAddress.city || null,
      ownerState: ownerMailingAddress.state || null,

      hoaFee: property.hoa?.fee || null,

      units: inferUnits(property.propertyType, property.bedrooms),
    };

    // Cache the result
    await supabase.from("property_cache").upsert(
      {
        address_normalized: normalizedAddress,
        data: result,
        created_at: new Date().toISOString(),
      },
      { onConflict: "address_normalized" }
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function inferUnits(propertyType: string | null, bedrooms: number | null): number {
  if (!propertyType) return 1;
  const type = propertyType.toLowerCase();
  if (type.includes("duplex")) return 2;
  if (type.includes("triplex")) return 3;
  if (type.includes("quadruplex") || type.includes("fourplex")) return 4;
  if (type.includes("multi")) {
    if (bedrooms && bedrooms >= 6) return Math.round(bedrooms / 2);
    return 4;
  }
  return 1;
}
