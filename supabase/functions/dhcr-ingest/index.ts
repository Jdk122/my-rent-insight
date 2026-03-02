/**
 * One-time ingestion edge function: downloads the 2024 DHCR CSV
 * from GitHub (firstmovernyc parsed RGB PDFs) and bulk-inserts
 * into the dhcr_buildings table.
 *
 * Call once to seed the table: POST /dhcr-ingest
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CSV_URL =
  "https://media.githubusercontent.com/media/firstmovernyc/nyc-rent-stabilized-listings/main/1_scanning/All%20NYC%20scanned.csv";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Check if table already has data
    const { count } = await sb
      .from("dhcr_buildings")
      .select("*", { count: "exact", head: true });

    if (count && count > 1000) {
      return new Response(
        JSON.stringify({ status: "already_loaded", count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching 2024 DHCR CSV from GitHub...");
    const res = await fetch(CSV_URL);
    if (!res.ok) {
      throw new Error(`CSV fetch failed: ${res.status}`);
    }
    const text = await res.text();
    const lines = text.split("\n");
    const header = lines[0];
    console.log(`CSV header: ${header}`);
    console.log(`Total lines: ${lines.length}`);

    // Parse CSV: BOROUGH,ZIP,BLDGNO1,STREET1,STSUFX1,BLDGNO2,STREET2,STSUFX2,COUNTY,CITY,STATUS1,STATUS2,STATUS3,BLOCK,LOT
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parse (no quoted fields with commas in this dataset)
      const parts = line.split(",");
      if (parts.length < 15) continue;

      rows.push({
        borough: parts[0].trim(),
        zip: parts[1].trim(),
        bldg_no: parts[2].trim(),
        street: parts[3].trim(),
        street_suffix: parts[4].trim() || null,
        bldg_no2: parts[5].trim() || null,
        street2: parts[6].trim() || null,
        street_suffix2: parts[7].trim() || null,
        county: parts[8].trim() || null,
        city: parts[9].trim() || null,
        status1: parts[10].trim() || null,
        status2: parts[11].trim() || null,
        status3: parts[12].trim() || null,
        block: parts[13].trim() || null,
        lot: parts[14].trim() || null,
      });
    }

    console.log(`Parsed ${rows.length} building records`);

    // Batch insert (1000 at a time)
    const BATCH = 1000;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await sb.from("dhcr_buildings").insert(batch);
      if (error) {
        console.error(`Batch insert error at ${i}:`, error);
        throw error;
      }
      inserted += batch.length;
      if (inserted % 5000 === 0) {
        console.log(`Inserted ${inserted}/${rows.length}`);
      }
    }

    console.log(`Done! Inserted ${inserted} records.`);
    return new Response(
      JSON.stringify({ status: "success", inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Ingestion error:", err);
    return new Response(
      JSON.stringify({ status: "error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
