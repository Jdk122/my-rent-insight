/**
 * Edge function that processes the DHCR rent stabilization CSV
 * and checks if a given address is in the registry.
 * 
 * Uses the MODA-NYC DHCR dataset (2016 registrations).
 * Matches on: zip + house number + street name.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DHCR_CSV_URL =
  "https://raw.githubusercontent.com/MODA-NYC/DHCR_RentStabData/master/dhcr.csv";

// In-memory cache of parsed CSV data (persists across warm invocations)
let cachedData: Map<string, Array<{ bldgNo: string; street: string; suffix: string; status1: string; status2: string; status3: string }>> | null = null;

async function loadData(): Promise<typeof cachedData> {
  if (cachedData) return cachedData;

  console.log("Fetching DHCR CSV...");
  const res = await fetch(DHCR_CSV_URL);
  const text = await res.text();
  const lines = text.split("\n").slice(1); // skip header

  const map = new Map<string, Array<{ bldgNo: string; street: string; suffix: string; status1: string; status2: string; status3: string }>>();

  for (const line of lines) {
    if (!line.trim()) continue;
    // CSV fields: ZIP,BLDGNO1,STREET1,STSUFX1,BLDGNO2,STREET2,STSUFX2,CITY,STATUS1,STATUS2,STATUS3,...
    const parts = line.split(",");
    if (parts.length < 11) continue;

    const zip = parts[0].trim();
    const bldgNo = parts[1].trim().toUpperCase();
    const street = parts[2].trim().toUpperCase();
    const suffix = parts[3].trim().toUpperCase();
    const status1 = parts[8].trim();
    const status2 = parts[9].trim();
    const status3 = parts[10].trim();

    if (!map.has(zip)) map.set(zip, []);
    map.get(zip)!.push({ bldgNo, street, suffix, status1, status2, status3 });
  }

  console.log(`Loaded ${lines.length} DHCR records across ${map.size} zip codes`);
  cachedData = map;
  return map;
}

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
    .replace(/\b(STREET|ST|AVENUE|AVE|BOULEVARD|BLVD|DRIVE|DR|PLACE|PL|ROAD|RD|LANE|LN|COURT|CT|TERRACE|TER|PARKWAY|PKWY|WAY)\b\.?$/i, "")
    .trim();
  // Remove direction words
  streetPart = streetPart
    .replace(/^(EAST|WEST|NORTH|SOUTH|E|W|N|S)\b\.?\s*/i, "")
    .trim();

  // Normalize ordinals: "52ND" → "52ND", "FIFTY-SECOND" stays
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

    const data = await loadData();
    if (!data) {
      return new Response(
        JSON.stringify({ found: false, error: "data_load_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buildings = data.get(zip);
    if (!buildings || buildings.length === 0) {
      return new Response(
        JSON.stringify({ found: false, reason: "no_buildings_in_zip" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = normalizeStreet(address);
    console.log("Looking for:", parsed, "in zip", zip, `(${buildings.length} buildings)`);

    // Match: house number contains our number AND street name matches
    const match = buildings.find((b) => {
      // Handle ranges like "303 TO 309"
      const bNums = b.bldgNo.split(/\s*TO\s*/);
      let numMatch = false;
      if (bNums.length === 2) {
        const lo = parseInt(bNums[0], 10);
        const hi = parseInt(bNums[1], 10);
        const userNum = parseInt(parsed.number, 10);
        numMatch = !isNaN(lo) && !isNaN(hi) && !isNaN(userNum) && userNum >= lo && userNum <= hi;
      } else {
        numMatch = b.bldgNo === parsed.number;
      }

      if (!numMatch) return false;

      // Street name match — the CSV has just the street name without suffix
      // e.g. "52ND" or "10TH" or "BROADWAY"
      const csvStreet = b.street.replace(/\./g, "");
      return parsed.name === csvStreet || parsed.name.includes(csvStreet) || csvStreet.includes(parsed.name);
    });

    if (!match) {
      return new Response(
        JSON.stringify({ found: false, reason: "no_match" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine status details
    const is421a = [match.status1, match.status2, match.status3].some(
      (s) => /421[\-\s]?A/i.test(s)
    );
    const isJ51 = [match.status1, match.status2, match.status3].some(
      (s) => /J[\-\s]?51/i.test(s)
    );
    const isHotel = [match.status1, match.status2, match.status3].some(
      (s) => /HOTEL/i.test(s)
    );
    const isCoop = [match.status1, match.status2, match.status3].some(
      (s) => /CO[\-\s]?OP|COOP|CONDO/i.test(s)
    );

    return new Response(
      JSON.stringify({
        found: true,
        stabilized: true,
        status: match.status1,
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
