/**
 * Edge function that checks if a given address is in the 2024 DHCR
 * rent stabilization registry (stored in dhcr_buildings table).
 *
 * Matches on: zip + house number + street name.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Normalize street names for matching */
function normalizeStreet(input: string): { number: string; name: string } {
  const cleaned = input
    .toUpperCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Extract house number
  const match = cleaned.match(/^(\d[\d\-]*)\s+(.+)/);
  if (!match) return { number: "", name: cleaned };

  let streetPart = match[2];
  // Remove common suffixes
  streetPart = streetPart
    .replace(
      /\b(STREET|ST|AVENUE|AVE|BOULEVARD|BLVD|DRIVE|DR|PLACE|PL|ROAD|RD|LANE|LN|COURT|CT|TERRACE|TER|PARKWAY|PKWY|WAY)\b\.?$/i,
      ""
    )
    .trim();
  // Remove direction words
  streetPart = streetPart
    .replace(/^(EAST|WEST|NORTH|SOUTH|E|W|N|S)\b\.?\s*/i, "")
    .trim();

  return { number: match[1], name: streetPart };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, zip } = await req.json();
    if (!address || !zip) {
      return new Response(
        JSON.stringify({ found: false, error: "address and zip required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Get all buildings in this zip
    const { data: buildings, error } = await sb
      .from("dhcr_buildings")
      .select("bldg_no, street, street_suffix, status1, status2, status3, borough")
      .eq("zip", zip);

    if (error) {
      console.error("DB query error:", error);
      return new Response(
        JSON.stringify({ found: false, error: "db_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!buildings || buildings.length === 0) {
      return new Response(
        JSON.stringify({ found: false, reason: "no_buildings_in_zip" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = normalizeStreet(address);
    console.log(
      "Looking for:",
      parsed,
      "in zip",
      zip,
      `(${buildings.length} buildings)`
    );

    // Match: house number + street name
    const matched = buildings.find((b) => {
      const bNo = (b.bldg_no || "").toUpperCase();
      // Handle ranges like "303 TO 309"
      const bNums = bNo.split(/\s*TO\s*/);
      let numMatch = false;
      if (bNums.length === 2) {
        const lo = parseInt(bNums[0], 10);
        const hi = parseInt(bNums[1], 10);
        const userNum = parseInt(parsed.number, 10);
        numMatch =
          !isNaN(lo) &&
          !isNaN(hi) &&
          !isNaN(userNum) &&
          userNum >= lo &&
          userNum <= hi;
      } else {
        numMatch = bNo === parsed.number;
      }

      if (!numMatch) return false;

      // Street name match
      const csvStreet = (b.street || "").toUpperCase().replace(/\./g, "");
      return (
        parsed.name === csvStreet ||
        parsed.name.includes(csvStreet) ||
        csvStreet.includes(parsed.name)
      );
    });

    if (!matched) {
      return new Response(
        JSON.stringify({ found: false, reason: "no_match" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine status details
    const statuses = [matched.status1, matched.status2, matched.status3].filter(Boolean);
    const is421a = statuses.some((s) => /421[\-\s]?A/i.test(s!));
    const isJ51 = statuses.some((s) => /J[\-\s]?51/i.test(s!));
    const isHotel = statuses.some((s) => /HOTEL/i.test(s!));
    const isCoop = statuses.some((s) => /CO[\-\s]?OP|COOP|CONDO/i.test(s!));

    return new Response(
      JSON.stringify({
        found: true,
        stabilized: true,
        borough: matched.borough,
        status: matched.status1,
        taxBenefit: is421a ? "421-a" : isJ51 ? "J-51" : null,
        isHotel,
        isCoop,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("DHCR lookup error:", err);
    return new Response(
      JSON.stringify({ found: false, error: "lookup_failed" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
