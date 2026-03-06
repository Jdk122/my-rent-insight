import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Fetch rentData.json from the live site to identify urban ZIPs
    const res = await fetch("https://www.renewalreply.com/data/rentData.json");
    if (!res.ok) throw new Error(`Failed to fetch rentData.json: ${res.status}`);
    const rentData = await res.json();

    // Select ZIPs with Zillow ZORI data (proxy for urban/high-density)
    // These cover ~15% of ZIPs but ~80% of renters
    const zoriZips: { zip: string; city: string; state: string }[] = [];

    for (const [zip, raw] of Object.entries(rentData)) {
      const r = raw as any;
      if (r.zy !== undefined && r.zy !== null && r.c && r.s) {
        zoriZips.push({ zip, city: r.c, state: r.s });
      }
    }

    // Sort by ZIP (stable ordering), take top 500
    zoriZips.sort((a, b) => a.zip.localeCompare(b.zip));
    const top500 = zoriZips.slice(0, 500);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Clear existing and insert fresh
    await sb.from("priority_zips").delete().neq("zip", "");

    // Insert in batches of 100
    for (let i = 0; i < top500.length; i += 100) {
      const batch = top500.slice(i, i + 100).map((z) => ({
        zip: z.zip,
        city: z.city,
        state: z.state,
        source: "zori",
      }));
      const { error } = await sb.from("priority_zips").upsert(batch, { onConflict: "zip" });
      if (error) console.error(`Batch insert error at ${i}:`, error.message);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        total_zori_zips: zoriZips.length,
        inserted: top500.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
