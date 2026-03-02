import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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

    // 1. Download and parse Excel
    console.log("Downloading Excel...");
    const excelUrl = `${supabaseUrl}/storage/v1/object/public/temp-data/fy2026_safmrs.xlsx`;
    const excelRes = await fetch(excelUrl);
    const excelBuf = await excelRes.arrayBuffer();
    console.log(`Downloaded: ${excelBuf.byteLength} bytes`);

    const wb = XLSX.read(new Uint8Array(excelBuf), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
    console.log(`Parsed ${rows.length} rows`);

    // 2. Find columns
    const keys = Object.keys(rows[0] || {});
    const findKey = (candidates: string[]): string | null => {
      for (const k of keys) {
        const kNorm = k.toLowerCase().replace(/\n/g, " ");
        for (const c of candidates) {
          if (kNorm.includes(c.toLowerCase())) return k;
        }
      }
      return null;
    };

    const zipKey = findKey(["zip code", "zip"])!;
    const metroKey = findKey(["hud fair market rent area name", "area name"]);
    const br0Key = findKey(["safmr 0br", "safmr\n0br"])!;
    const br1Key = findKey(["safmr 1br", "safmr\n1br"])!;
    const br2Key = findKey(["safmr 2br", "safmr\n2br"])!;
    const br3Key = findKey(["safmr 3br", "safmr\n3br"])!;
    const br4Key = findKey(["safmr 4br", "safmr\n4br"])!;

    // 3. Extract compact data: { zip: [0br,1br,2br,3br,4br,metro] }
    const extracted: Record<string, [number, number, number, number, number, string]> = {};
    for (const row of rows) {
      const z = String(row[zipKey] || "").trim().padStart(5, "0");
      if (z.length !== 5 || !/^\d{5}$/.test(z)) continue;
      const fmr: [number, number, number, number, number] = [
        parseInt(String(row[br0Key] || 0)),
        parseInt(String(row[br1Key] || 0)),
        parseInt(String(row[br2Key] || 0)),
        parseInt(String(row[br3Key] || 0)),
        parseInt(String(row[br4Key] || 0)),
      ];
      if (fmr.every((v) => v === 0 || isNaN(v))) continue;
      const metro = metroKey ? String(row[metroKey] || "").trim() : "";
      extracted[z] = [...fmr, metro];
    }

    console.log(`Extracted ${Object.keys(extracted).length} zips`);

    // 4. Upload extracted data to storage (compact JSON)
    const blob = new Blob([JSON.stringify(extracted)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("temp-data")
      .upload("fy2026_extracted.json", blob, { contentType: "application/json", upsert: true });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    return new Response(
      JSON.stringify({ success: true, zipsExtracted: Object.keys(extracted).length }),
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
