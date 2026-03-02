import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Download extracted FY2026 data
    console.log("Downloading extracted FY2026 data...");
    const extractedUrl = `${supabaseUrl}/storage/v1/object/public/temp-data/fy2026_extracted.json`;
    const extractedRes = await fetch(extractedUrl);
    if (!extractedRes.ok) throw new Error("Run process-safmr first to extract Excel data");
    const newData: Record<string, [number, number, number, number, number, string]> = await extractedRes.json();
    const newZips = new Set(Object.keys(newData));
    console.log(`FY2026 data: ${newZips.size} zips`);

    // 2. Download current rentData.json
    console.log("Downloading rentData.json...");
    const rdUrl = "https://my-rent-insight.lovable.app/data/rentData.json";
    const rdRes = await fetch(rdUrl);
    if (!rdRes.ok) throw new Error(`Failed to download rentData: ${rdRes.status}`);
    const rd: Record<string, Record<string, unknown>> = await rdRes.json();
    const existingZips = new Set(Object.keys(rd));
    console.log(`Current data: ${existingZips.size} zips`);

    // 3. Process updates
    let updated = 0, added = 0, removed = 0, unchanged = 0;

    for (const z of existingZips) {
      if (!newZips.has(z)) {
        delete rd[z];
        removed++;
        continue;
      }
      const entry = rd[z];
      const [br0, br1, br2, br3, br4, metro] = newData[z];
      const newFmr = [br0, br1, br2, br3, br4];
      const oldFmr = (entry.f as number[]) || [0, 0, 0, 0, 0];

      entry.p = oldFmr;

      if (oldFmr[0] === br0 && oldFmr[1] === br1 && oldFmr[2] === br2 && oldFmr[3] === br3 && oldFmr[4] === br4) {
        entry.y = 0.0;
        unchanged++;
      } else {
        entry.f = newFmr;
        updated++;
      }

      if (oldFmr[1] && oldFmr[1] > 0) {
        let yoy = Math.round(((br1 - oldFmr[1]) / oldFmr[1]) * 1000) / 10;
        yoy = Math.max(-30, Math.min(30, yoy));
        entry.y = yoy;
      }

      if (metro) entry.m = metro;
    }

    for (const z of newZips) {
      if (existingZips.has(z)) continue;
      const [br0, br1, br2, br3, br4, metro] = newData[z];
      let state = "";
      if (metro.includes(", ")) {
        const parts = metro.split(", ");
        const lastPart = parts[parts.length - 1];
        const sp = lastPart.split(" ")[0];
        if (sp.length === 2 && /^[A-Z]{2}$/.test(sp)) state = sp;
      }
      rd[z] = { c: "", s: state, m: metro, f: [br0, br1, br2, br3, br4], p: [0, 0, 0, 0, 0], y: 0.0, ps: "f" };
      added++;
    }

    const summary = { updated, unchanged, added, removed, totalZips: Object.keys(rd).length, fy2026Zips: newZips.size };
    console.log("Summary:", JSON.stringify(summary));

    // 4. Upload result
    console.log("Uploading result...");
    const blob = new Blob([JSON.stringify(rd)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("temp-data")
      .upload("rentData_fy2026.json", blob, { contentType: "application/json", upsert: true });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // 5. Sample updates
    const samples = Object.entries(rd)
      .filter(([z]) => existingZips.has(z) && newZips.has(z))
      .slice(0, 10)
      .map(([z, e]) => ({
        zip: z,
        city: e.c || e.m,
        new1BR: (e.f as number[])?.[1],
        old1BR: (e.p as number[])?.[1],
        yoy: e.y,
      }));

    return new Response(
      JSON.stringify({ success: true, summary, samples, downloadUrl: `${supabaseUrl}/storage/v1/object/public/temp-data/rentData_fy2026.json` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
