import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Normalize street names for matching — copied from hcr-lookup */
function normalizeStreet(input: string): { number: string; name: string } {
  const cleaned = input
    .toUpperCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/^(\d[\d\-]*)\s+(.+)/);
  if (!match) return { number: "", name: cleaned };

  let streetPart = match[2];
  streetPart = streetPart
    .replace(
      /\b(STREET|ST|AVENUE|AVE|BOULEVARD|BLVD|DRIVE|DR|PLACE|PL|ROAD|RD|LANE|LN|COURT|CT|TERRACE|TER|PARKWAY|PKWY|WAY)\b\.?$/i,
      ""
    )
    .trim();
  streetPart = streetPart
    .replace(/^(EAST|WEST|NORTH|SOUTH|E|W|N|S)\b\.?\s*/i, "")
    .trim();

  return { number: match[1], name: streetPart };
}

/** Extract ZIP from a formatted address string like "123 Main St, New York, NY 10003" */
function extractZip(address: string): string | null {
  const m = address.match(/\b(\d{5})(?:\-\d{4})?\b/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { addresses } = await req.json();

    if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length > 50) {
      return new Response(
        JSON.stringify({ error: "addresses must be an array with 1-50 items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit: 10/hour per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const endpoint = "dhcr-batch-lookup";
    const windowStart = new Date(Date.now() - 3600000).toISOString();

    const { data: rlData } = await sb
      .from("rate_limits")
      .select("request_count")
      .eq("ip_address", ip)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart)
      .maybeSingle();

    if (rlData && rlData.request_count >= 10) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await sb.from("rate_limits").upsert(
      {
        ip_address: ip,
        endpoint,
        window_start: new Date().toISOString(),
        request_count: (rlData?.request_count || 0) + 1,
      },
      { onConflict: "ip_address,endpoint" },
    );

    // Group addresses by ZIP
    const addrByZip: Record<string, string[]> = {};
    for (const addr of addresses) {
      if (typeof addr !== "string" || !addr.trim()) continue;
      const zip = extractZip(addr);
      if (!zip) continue;
      if (!addrByZip[zip]) addrByZip[zip] = [];
      addrByZip[zip].push(addr);
    }

    const results: Record<string, boolean> = {};

    // For each unique ZIP, fetch buildings and match
    await Promise.all(
      Object.entries(addrByZip).map(async ([zip, addrs]) => {
        const { data: buildings, error } = await sb
          .from("dhcr_buildings")
          .select("bldg_no, street, street_suffix")
          .eq("zip", zip);

        if (error || !buildings?.length) {
          for (const a of addrs) results[a] = false;
          return;
        }

        for (const addr of addrs) {
          const parsed = normalizeStreet(addr);
          if (!parsed.number) {
            results[addr] = false;
            continue;
          }

          const matched = buildings.some((b) => {
            const bNo = (b.bldg_no || "").toUpperCase();
            const bNums = bNo.split(/\s*TO\s*/);
            let numMatch = false;
            if (bNums.length === 2) {
              const lo = parseInt(bNums[0], 10);
              const hi = parseInt(bNums[1], 10);
              const userNum = parseInt(parsed.number, 10);
              numMatch = !isNaN(lo) && !isNaN(hi) && !isNaN(userNum) && userNum >= lo && userNum <= hi;
            } else {
              numMatch = bNo === parsed.number;
            }
            if (!numMatch) return false;

            const csvStreet = (b.street || "").toUpperCase().replace(/\./g, "");
            return (
              parsed.name === csvStreet ||
              parsed.name.includes(csvStreet) ||
              csvStreet.includes(parsed.name)
            );
          });

          results[addr] = matched;
        }
      })
    );

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dhcr-batch-lookup error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", results: {} }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
