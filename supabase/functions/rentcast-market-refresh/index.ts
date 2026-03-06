import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS = 1; // 24-hour TTL
const BATCH_SIZE = 50; // Process 50 ZIPs per invocation to avoid timeout
const DELAY_MS = 200; // 200ms between API calls to respect rate limits

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RENTCAST_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "RENTCAST_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional offset from body
    let offset = 0;
    try {
      const body = await req.json();
      offset = body.offset ?? 0;
    } catch { /* default 0 */ }

    // Get priority ZIPs
    const { data: priorityZips, error: pzError } = await sb
      .from("priority_zips")
      .select("zip")
      .order("zip")
      .range(offset, offset + BATCH_SIZE - 1);

    if (pzError || !priorityZips?.length) {
      return new Response(
        JSON.stringify({ status: "done", message: "No more ZIPs to process", offset }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staleThreshold = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let refreshed = 0;
    let skipped = 0;
    let errors = 0;

    for (const { zip } of priorityZips) {
      const lookupKey = `market|${zip}`;
      const endpoint = "market-statistics";

      // Check if cache is fresh
      const { data: cached } = await sb
        .from("rentcast_cache")
        .select("fetched_at")
        .eq("lookup_key", lookupKey)
        .eq("endpoint", endpoint)
        .single();

      if (cached && cached.fetched_at > staleThreshold) {
        skipped++;
        continue;
      }

      // Fetch from Rentcast
      try {
        const params = new URLSearchParams({ zipCode: zip, historyRange: "6" });
        const url = `https://api.rentcast.io/v1/markets?${params.toString()}`;

        const response = await fetch(url, {
          headers: { Accept: "application/json", "X-Api-Key": apiKey },
        });

        if (!response.ok) {
          console.error(`Rentcast error for ${zip}: ${response.status}`);
          errors++;
          continue;
        }

        const raw = await response.json();
        const rental = raw?.rentalData;

        const result = {
          averageRent: rental?.averageRent ?? null,
          medianRent: rental?.medianRent ?? null,
          minRent: rental?.minRent ?? null,
          maxRent: rental?.maxRent ?? null,
          totalListings: rental?.totalListings ?? null,
          newListings: rental?.newListings ?? null,
          averageDaysOnMarket: rental?.averageDaysOnMarket ?? null,
          averageRentBySqft: rental?.averageRentBySqft ?? null,
          detailedStats: rental?.detailedStats ?? null,
          detailedByBedroom: rental?.detailedByBedroom ?? null,
          rentTrend: rental?.historyRent ?? null,
          history: rental?.history ?? null,
        };

        await sb.from("rentcast_cache").upsert(
          {
            lookup_key: lookupKey,
            endpoint,
            response_data: result,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "lookup_key,endpoint" }
        );

        refreshed++;
      } catch (e) {
        console.error(`Error refreshing ${zip}:`, e);
        errors++;
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        offset,
        batch_size: priorityZips.length,
        refreshed,
        skipped,
        errors,
        next_offset: offset + BATCH_SIZE,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Refresh error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
