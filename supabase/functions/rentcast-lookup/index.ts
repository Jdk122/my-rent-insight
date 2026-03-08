import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS_RENT = 30;

// Dense urban ZIP prefixes → 1-mile radius; everything else → 3 miles
const DENSE_ZIP_PREFIXES = [
  '100','101','102','103','104','111','112', // NYC
  '941','940',       // SF
  '606','607',       // Chicago
  '021','022',       // Boston
  '900','901',       // LA
  '070','071',       // Hoboken/JC/Newark
  '200','201',       // DC
  '191',             // Philadelphia
  '981',             // Seattle
  '331','332','333', // Miami
];

/** Strip unit/apt tokens so Rentcast resolves the building, not a specific unit */
const stripUnit = (addr: string) =>
  addr
    .replace(/\b(apt|unit|suite|ste|#|fl|floor)\s*\w+\b/gi, '')
    .replace(/\s+[0-9]+[a-z]?\b(?=\s*,)/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

/** Normalize to street-base for same-building matching */
const normalizeStreetBase = (addr: string) =>
  addr
    .toLowerCase()
    .split(',')[0]
    .replace(/\b(apt|unit|suite|ste|#|fl|floor)\s*\w+\b/gi, '')
    .replace(/\s+[0-9]+[a-z]?\b$/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Build enriched, validated, prioritised comp list from raw Rentcast data */
function processComps(
  rawApiComps: any[],
  address: string | null,
  requestedBedrooms: number | null,
) {
  const rawComps = rawApiComps.slice(0, 20).map((c: any) => ({
    formattedAddress: c.formattedAddress || c.address || 'Unknown',
    rent: c.price ?? c.lastSeenPrice ?? null,
    bedrooms: c.bedrooms ?? null,
    bathrooms: c.bathrooms ?? null,
    squareFootage: c.squareFootage ?? null,
    distance: c.distance ?? null,
    daysOld: c.daysOld ?? null,
    correlation: c.correlation ?? null,
    listingType: c.listingType ?? null,
  }));

  const subjectStreet = address ? normalizeStreetBase(address) : '';

  // Enrich with same-building flag + relevance score
  const enriched = rawComps.map((comp: any) => {
    const compStreet = normalizeStreetBase(comp.formattedAddress || '');
    const isSameBuilding =
      !!subjectStreet &&
      !!compStreet &&
      (compStreet === subjectStreet ||
        compStreet.startsWith(subjectStreet) ||
        subjectStreet.startsWith(compStreet));

    const freshnessScore =
      comp.daysOld !== null ? Math.max(0, 1 - comp.daysOld / 180) : 0.5;

    const baseCorrelation = comp.correlation ?? 0.5;
    const relevanceScore =
      baseCorrelation * 0.5 + freshnessScore * 0.2 + (isSameBuilding ? 0.3 : 0);

    return {
      ...comp,
      isSameBuilding,
      relevanceScore,
      correlation: isSameBuilding
        ? Math.min(baseCorrelation * 1.5, 1.0)
        : baseCorrelation,
    };
  });

  // Validate
  const valid = enriched.filter((comp: any) => {
    if (comp.rent == null || comp.rent < 200 || comp.rent > 25000) return false;
    if (
      requestedBedrooms !== null &&
      comp.bedrooms != null &&
      Math.abs(comp.bedrooms - requestedBedrooms) > 1
    )
      return false;
    if (comp.distance != null && comp.distance > 10) return false;
    return true;
  });

  // Sort by composite relevance
  valid.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

  // Prioritise: all same-building (up to 5) + best nearby to fill 10
  const sameBuilding = valid.filter((c: any) => c.isSameBuilding);
  const nearby = valid.filter((c: any) => !c.isSameBuilding);

  return [
    ...sameBuilding.slice(0, 5),
    ...nearby.slice(0, Math.max(5, 10 - sameBuilding.length)),
  ].slice(0, 10);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Rate limiting (10/hour) ---
    const clientIP =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const windowKey = windowStart.toISOString();
    const rlSb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: rlRow } = await rlSb
      .from('rate_limits')
      .select('request_count')
      .eq('ip_address', clientIP)
      .eq('endpoint', 'rentcast-lookup')
      .eq('window_start', windowKey)
      .maybeSingle();
    if (rlRow && rlRow.request_count >= 10) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    await rlSb.from('rate_limits').upsert(
      {
        ip_address: clientIP,
        endpoint: 'rentcast-lookup',
        window_start: windowKey,
        request_count: (rlRow?.request_count ?? 0) + 1,
      },
      { onConflict: 'ip_address,endpoint,window_start' },
    );
    // --- End rate limiting ---

    const { zip, bedrooms, address, bathrooms, squareFootage } = await req.json();

    const apiKey = Deno.env.get('RENTCAST_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Rentcast API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Zip-only: skip Rentcast AVM (doesn't support zip-only)
    if (!address && zip) {
      return new Response(
        JSON.stringify({
          rentEstimate: null,
          rentRangeLow: null,
          rentRangeHigh: null,
          comparables: [],
          cacheHit: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Cache key includes bathrooms when provided
    const lookupKey = address
      ? `${address.toLowerCase().replace(/\s+/g, ' ').trim()}|br${bedrooms ?? 'any'}${bathrooms != null ? `|ba${bathrooms}` : ''}`
      : `${zip}|br${bedrooms ?? 'any'}`;
    const endpointKey = 'rent-estimate';

    // Check cache
    const { data: cached } = await sb
      .from('rentcast_cache')
      .select('response_data, fetched_at')
      .eq('lookup_key', lookupKey)
      .eq('endpoint', endpointKey)
      .single();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < CACHE_DAYS_RENT * 24 * 60 * 60 * 1000) {
        console.log(`Cache hit for ${endpointKey}: ${lookupKey}`);
        return new Response(
          JSON.stringify({ ...cached.response_data, cacheHit: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Build API params ──────────────────────────────────────────────
    const strippedAddress = address ? stripUnit(address) : null;

    const params = new URLSearchParams();
    if (strippedAddress) params.set('address', strippedAddress);
    if (bedrooms !== undefined) params.set('bedrooms', String(bedrooms));
    if (bathrooms != null) params.set('bathrooms', String(bathrooms));
    if (squareFootage != null) params.set('squareFootage', String(squareFootage));

    params.set('lookupSubjectAttributes', 'true');
    params.set('compCount', '20');
    params.set('daysOld', '180');

    // Adaptive radius
    const zipCode = zip || address?.match(/\d{5}/)?.[0] || '';
    const zipPrefix = zipCode.substring(0, 3);
    const isDense = DENSE_ZIP_PREFIXES.includes(zipPrefix);
    params.set('maxRadius', isDense ? '1' : '3');

    // ── Primary fetch ─────────────────────────────────────────────────
    const apiUrl = `https://api.rentcast.io/v1/avm/rent/long-term?${params.toString()}`;
    const response = await fetch(apiUrl, {
      headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Rentcast API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Rentcast API error', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    const requestedBedrooms = bedrooms !== undefined ? Number(bedrooms) : null;

    // Extract / infer property type
    let propertyType: string | null = data.propertyType ?? null;
    if (!propertyType && data.comparables?.length) {
      const closeComps = (data.comparables as any[])
        .filter((c: any) => c.distance != null && c.distance <= 0.25)
        .slice(0, 3);
      if (closeComps.length >= 2) {
        const counts: Record<string, number> = {};
        for (const c of closeComps) {
          counts[c.propertyType || 'Unknown'] = (counts[c.propertyType || 'Unknown'] || 0) + 1;
        }
        propertyType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      }
    }

    let prioritised = processComps(data.comparables || [], address, requestedBedrooms);
    let retried = false;

    // ── Fallback widening (only for dense areas with thin results) ──
    if (prioritised.length < 3 && isDense) {
      console.log(`Thin results (${prioritised.length} comps) — retrying with wider params`);
      params.set('maxRadius', '3');
      params.set('daysOld', '270');

      const retryUrl = `https://api.rentcast.io/v1/avm/rent/long-term?${params.toString()}`;
      const retryResp = await fetch(retryUrl, {
        headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
      });

      if (retryResp.ok) {
        const retryData = await retryResp.json();
        prioritised = processComps(retryData.comparables || [], address, requestedBedrooms);
        retried = true;
        // Update estimates from retry if we got better data
        if (retryData.rent) data.rent = retryData.rent;
        if (retryData.rentRangeLow) data.rentRangeLow = retryData.rentRangeLow;
        if (retryData.rentRangeHigh) data.rentRangeHigh = retryData.rentRangeHigh;
      } else {
        await retryResp.text(); // consume body
      }
    }

    const result = {
      rentEstimate: prioritised.length > 0 ? (data.rent ?? data.rentRangeLow ?? null) : null,
      rentRangeLow: data.rentRangeLow ?? null,
      rentRangeHigh: data.rentRangeHigh ?? null,
      propertyType,
      comparables: prioritised,
      retried,
    };

    // Upsert to cache
    await sb.from('rentcast_cache').upsert(
      {
        lookup_key: lookupKey,
        endpoint: endpointKey,
        response_data: result,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'lookup_key,endpoint' },
    );

    return new Response(JSON.stringify({ ...result, cacheHit: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
