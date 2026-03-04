import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ERAP_URL =
  "https://www.huduser.gov/portal/datasets/fmr/fmr2026/fy2026_erap_fmrs.xlsx";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Step 1: Fetching ERAP xlsx from HUD...");
    const erapResp = await fetch(ERAP_URL);
    if (!erapResp.ok) {
      throw new Error(`Failed to fetch ERAP file: ${erapResp.status}`);
    }
    const erapBuffer = await erapResp.arrayBuffer();
    console.log(`  Downloaded ${(erapBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    console.log("Step 2: Parsing ERAP xlsx...");
    const wb = XLSX.read(new Uint8Array(erapBuffer), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    console.log(`  Parsed ${rows.length} rows`);

    // Find column names (case-insensitive partial match)
    const sampleRow = rows[0] || {};
    const keys = Object.keys(sampleRow);
    const findKey = (...candidates: string[]) => {
      for (const c of candidates) {
        const cl = c.toLowerCase();
        const found = keys.find((k) => k.toLowerCase().includes(cl));
        if (found) return found;
      }
      return null;
    };

    const kZip = findKey("zip", "zcta");
    const kMetro = findKey("area name", "metro", "hud");
    const kBr0 = findKey("erap_fmr_br0", "br0", "0br");
    const kBr1 = findKey("erap_fmr_br1", "br1", "1br");
    const kBr2 = findKey("erap_fmr_br2", "br2", "2br");
    const kBr3 = findKey("erap_fmr_br3", "br3", "3br");
    const kBr4 = findKey("erap_fmr_br4", "br4", "4br");

    if (!kZip || !kBr0) {
      throw new Error(
        `Could not find required columns. Keys: ${keys.join(", ")}`
      );
    }

    console.log(`  ZIP col: ${kZip}, BR cols: ${kBr0},${kBr1},${kBr2},${kBr3},${kBr4}`);

    // Build ERAP lookup: zip → {m, f}
    const erapData: Record<string, { m: string; f: number[] }> = {};
    for (const row of rows) {
      const z = String(row[kZip!] || "").trim().padStart(5, "0");
      if (z.length !== 5 || !/^\d{5}$/.test(z)) continue;
      const fmr = [
        parseInt(row[kBr0!]) || 0,
        parseInt(row[kBr1!]) || 0,
        parseInt(row[kBr2!]) || 0,
        parseInt(row[kBr3!]) || 0,
        parseInt(row[kBr4!]) || 0,
      ];
      if (fmr.every((v) => v === 0)) continue;
      const metro = String(row[kMetro!] || "").trim();
      erapData[z] = { m: metro, f: fmr };
    }
    console.log(`  ERAP ZIPs: ${Object.keys(erapData).length}`);

    // Step 3: Fetch current rentData.json
    console.log("Step 3: Fetching current rentData.json...");
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    // Try fetching from the app's public URL
    let rentDataUrl = "";
    if (origin) {
      const url = new URL(origin);
      rentDataUrl = `${url.protocol}//${url.host}/data/rentData.json`;
    }
    
    // Fallback: use Supabase storage or direct URL
    let rentData: Record<string, any> = {};
    let fetchSuccess = false;
    
    if (rentDataUrl) {
      try {
        const rdResp = await fetch(rentDataUrl);
        if (rdResp.ok) {
          rentData = await rdResp.json();
          fetchSuccess = true;
        }
      } catch (e) {
        console.log(`  Could not fetch from ${rentDataUrl}: ${e}`);
      }
    }
    
    if (!fetchSuccess) {
      // Try common preview URLs
      const projectId = Deno.env.get("SUPABASE_URL")?.match(/\/\/([^.]+)/)?.[1] || "";
      const previewUrl = `https://${projectId}.supabase.co/storage/v1/object/public/temp-data/rentData.json`;
      try {
        const rdResp = await fetch(previewUrl);
        if (rdResp.ok) {
          rentData = await rdResp.json();
          fetchSuccess = true;
        }
      } catch {
        // pass
      }
    }

    const existingZips = new Set(Object.keys(rentData));
    console.log(`  Existing ZIPs in rentData: ${existingZips.size}`);

    // Step 4: Build county_fmr.json (only ZIPs NOT in rentData)
    console.log("Step 4: Building county-level supplement...");
    const countyFmr: Record<string, any> = {};
    let newCount = 0;

    for (const [z, data] of Object.entries(erapData)) {
      if (existingZips.has(z)) continue;

      // Infer state from metro
      let state = "";
      if (data.m.includes(", ")) {
        const parts = data.m.split(", ");
        const lastPart = parts[parts.length - 1];
        const stateCandidate = lastPart.split(/\s/)[0];
        if (stateCandidate.length === 2 && /^[A-Z]+$/.test(stateCandidate)) {
          state = stateCandidate;
        }
      }

      countyFmr[z] = {
        c: "",
        s: state,
        m: data.m,
        f: data.f,
        p: [0, 0, 0, 0, 0],
        y: 0,
        ps: "f",
        fs: "county",
      };
      newCount++;
    }

    console.log(`  New county-level ZIPs: ${newCount}`);
    console.log(`  Total coverage: ${existingZips.size + newCount}`);

    // Step 5: Upload county_fmr.json to Supabase storage
    console.log("Step 5: Uploading county_fmr.json to storage...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const jsonStr = JSON.stringify(countyFmr);
    const { error: uploadError } = await supabase.storage
      .from("temp-data")
      .upload("county_fmr.json", new Blob([jsonStr], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("temp-data")
      .getPublicUrl("county_fmr.json");

    console.log(`  Uploaded to: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          erap_total: Object.keys(erapData).length,
          existing_safmr: existingZips.size,
          new_county: newCount,
          total_coverage: existingZips.size + newCount,
        },
        download_url: urlData.publicUrl,
        message: `Created county_fmr.json with ${newCount} new ZIPs. Download from storage and save to public/data/county_fmr.json.`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
