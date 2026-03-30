// Schedule: Run daily at 5:00 AM ET (10:00 UTC)
// Requires 3 invocations: offset=0, offset=6, offset=12
// POST https://<project>.supabase.co/functions/v1/deals-refresh-cron
// Body: { "offset": 0 }
// Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Neighborhood {
  slug: string;
  name: string;
  zips: string[];
}

const NEIGHBORHOODS: Neighborhood[] = [
  { slug: "east-village", name: "East Village", zips: ["10003", "10009"] },
  { slug: "chelsea-nyc", name: "Chelsea", zips: ["10001", "10011"] },
  { slug: "brooklyn-heights", name: "Brooklyn Heights", zips: ["11201"] },
  { slug: "astoria", name: "Astoria", zips: ["11101", "11102", "11106"] },
  { slug: "jersey-city", name: "Jersey City", zips: ["07302", "07304", "07306"] },
  { slug: "brickell", name: "Brickell", zips: ["33129", "33131"] },
  { slug: "wynwood", name: "Wynwood", zips: ["33127", "33137"] },
  { slug: "coral-gables", name: "Coral Gables", zips: ["33134", "33146"] },
  { slug: "lincoln-park", name: "Lincoln Park", zips: ["60614"] },
  { slug: "wicker-park", name: "Wicker Park", zips: ["60622"] },
  { slug: "lakeview", name: "Lakeview", zips: ["60657"] },
  { slug: "east-austin", name: "East Austin", zips: ["78702"] },
  { slug: "south-congress", name: "South Congress", zips: ["78704"] },
  { slug: "downtown-austin", name: "Downtown Austin", zips: ["78701"] },
  { slug: "mission-district", name: "Mission District", zips: ["94110"] },
  { slug: "soma-sf", name: "SoMa", zips: ["94103"] },
  { slug: "pacific-heights", name: "Pacific Heights", zips: ["94115"] },
];

const BATCH_SIZE = 6;
const MAX_NEW_WALKSCORES_PER_NEIGHBORHOOD = 30;
const WALKSCORE_CACHE_TTL_DAYS = 90;

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rentcastKey = Deno.env.get("RENTCAST_API_KEY");
  const walkScoreKey = Deno.env.get("WALKSCORE_API_KEY");

  if (!rentcastKey) {
    return new Response(JSON.stringify({ error: "RENTCAST_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let offset = 0;
  try {
    const body = await req.json();
    offset = typeof body.offset === "number" ? body.offset : 0;
  } catch {
    // default offset 0
  }

  const startIdx = offset;
  const endIdx = Math.min(offset + BATCH_SIZE, NEIGHBORHOODS.length);
  const batch = NEIGHBORHOODS.slice(startIdx, endIdx);

  const summary = {
    offset,
    neighborhoodsProcessed: 0,
    totalListings: 0,
    walkScoresFromCache: 0,
    walkScoresNewlyFetched: 0,
    errors: [] as string[],
  };

  for (const hood of batch) {
    try {
      const sortedZips = [...hood.zips].sort();
      const lookupKey = `deals:${sortedZips.join(",")}`;
      const endpointKey = "deals-listings";

      // Fetch listings from Rentcast
      const allListings: any[] = [];

      for (const zip of sortedZips) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const params = new URLSearchParams({
            zipCode: zip,
            status: "Active",
            limit: "500",
          });

          const resp = await fetch(
            `https://api.rentcast.io/v1/listings/rental/long-term?${params.toString()}`,
            {
              headers: { Accept: "application/json", "X-Api-Key": rentcastKey },
              signal: controller.signal,
            },
          );
          clearTimeout(timeout);

          if (resp.ok) {
            const raw = await resp.json();
            if (Array.isArray(raw)) {
              allListings.push(...raw);
            }
          } else {
            console.error(`Rentcast error for ${zip}: ${resp.status}`);
            summary.errors.push(`rentcast:${zip}:${resp.status}`);
          }
        } catch (err) {
          console.error(`Rentcast fetch failed for ${zip}:`, err);
          summary.errors.push(`rentcast:${zip}:fetch_error`);
        }

        await delay(200);
      }

      // If zero listings, skip — preserve existing cache
      if (allListings.length === 0) {
        console.warn(`No listings for ${hood.slug}, skipping cache write`);
        summary.errors.push(`${hood.slug}:no_listings`);
        summary.neighborhoodsProcessed++;
        continue;
      }

      // Process and deduplicate
      const seen = new Map<string, any>();
      for (const l of allListings) {
        const rent = l.price ?? null;
        if (rent == null || rent <= 200 || rent > 25000) continue;

        const addr = l.formattedAddress || l.addressLine1 || "";
        if (!addr) continue;

        const normAddr = normalizeAddress(addr);
        const existing = seen.get(normAddr);
        if (existing && existing.rent <= rent) continue;

        const daysOnMarket = l.daysOnMarket ?? (l.listedDate
          ? Math.max(0, Math.round((Date.now() - new Date(l.listedDate).getTime()) / 86400000))
          : null);

        // Filter out stale listings (>45 days)
        if (daysOnMarket != null && daysOnMarket > 45) continue;

        seen.set(normAddr, {
          formattedAddress: addr,
          city: l.city || "",
          state: l.state || "",
          zipCode: l.zipCode || "",
          rent,
          bedrooms: l.bedrooms ?? null,
          bathrooms: l.bathrooms ?? null,
          squareFootage: l.squareFootage ?? null,
          daysOnMarket,
          listingUrl: l.url || null,
          propertyType: l.propertyType || null,
          latitude: l.latitude ?? null,
          longitude: l.longitude ?? null,
        });
      }

      const listings = Array.from(seen.values()).sort((a, b) => a.rent - b.rent);

      // Walk Score resolution
      const walkScores: Record<string, number> = {};

      if (walkScoreKey) {
        // Collect addresses that need walk scores
        const addressesWithCoords: { normAddr: string; lat: number; lon: number; addr: string }[] = [];
        for (const l of listings) {
          if (l.latitude && l.longitude) {
            addressesWithCoords.push({
              normAddr: normalizeAddress(l.formattedAddress),
              lat: l.latitude,
              lon: l.longitude,
              addr: l.formattedAddress,
            });
          }
        }

        // Check cache for all addresses
        const normAddrs = addressesWithCoords.map((a) => a.normAddr);
        const uncached: typeof addressesWithCoords = [];

        if (normAddrs.length > 0) {
          // Query in batches of 50 to avoid query limits
          for (let i = 0; i < normAddrs.length; i += 50) {
            const batch = normAddrs.slice(i, i + 50);
            const { data: cached } = await sb
              .from("walkscore_cache")
              .select("normalized_address, walkscore, updated_at")
              .in("normalized_address", batch);

            const cutoff = Date.now() - WALKSCORE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

            if (cached) {
              const cachedMap = new Map(
                cached
                  .filter((r) => r.walkscore != null && new Date(r.updated_at || r.created_at || 0).getTime() > cutoff)
                  .map((r) => [r.normalized_address, r.walkscore as number]),
              );

              for (const entry of addressesWithCoords.slice(i, i + 50)) {
                const score = cachedMap.get(entry.normAddr);
                if (score != null) {
                  walkScores[entry.normAddr] = score;
                  summary.walkScoresFromCache++;
                } else {
                  uncached.push(entry);
                }
              }
            } else {
              uncached.push(...addressesWithCoords.slice(i, i + 50));
            }
          }
        }

        // Fetch new walk scores, capped
        const toFetch = uncached.slice(0, MAX_NEW_WALKSCORES_PER_NEIGHBORHOOD);

        for (let i = 0; i < toFetch.length; i += 5) {
          const group = toFetch.slice(i, i + 5);

          await Promise.all(
            group.map(async (entry) => {
              try {
                const wsParams = new URLSearchParams({
                  format: "json",
                  lat: entry.lat.toString(),
                  lon: entry.lon.toString(),
                  address: entry.addr,
                  wsapikey: walkScoreKey,
                });

                const resp = await fetch(
                  `https://api.walkscore.com/score?${wsParams.toString()}`,
                );

                if (resp.ok) {
                  const data = await resp.json();
                  if (data.status === 1 && data.walkscore != null) {
                    walkScores[entry.normAddr] = data.walkscore;
                    summary.walkScoresNewlyFetched++;

                    // Upsert into cache
                    await sb.from("walkscore_cache").upsert(
                      {
                        normalized_address: entry.normAddr,
                        walkscore: data.walkscore,
                        transit: data.transit?.score ?? null,
                        bike: data.bike?.score ?? null,
                        description: data.description ?? null,
                        raw: data,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: "normalized_address" },
                    );
                  }
                }
              } catch (err) {
                console.error(`WalkScore error for ${entry.normAddr}:`, err);
              }
            }),
          );

          if (i + 5 < toFetch.length) {
            await delay(200);
          }
        }
      }

      // Build result payload
      const result = {
        listings,
        totalScanned: allListings.length,
        walkScores,
        refreshedAt: new Date().toISOString(),
      };

      // Write to cache
      await sb.from("rentcast_cache").upsert(
        {
          lookup_key: lookupKey,
          endpoint: endpointKey,
          response_data: result,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "lookup_key,endpoint" },
      );

      summary.neighborhoodsProcessed++;
      summary.totalListings += listings.length;

      console.log(`✓ ${hood.slug}: ${listings.length} listings, ${Object.keys(walkScores).length} walk scores`);
    } catch (err) {
      console.error(`Error processing ${hood.slug}:`, err);
      summary.errors.push(`${hood.slug}:${String(err)}`);
      summary.neighborhoodsProcessed++;
    }
  }

  console.log("Refresh summary:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
