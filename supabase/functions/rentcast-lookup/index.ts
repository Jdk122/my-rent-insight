import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_DAYS_RENT_DEFAULT = 30;
const CACHE_DAYS_RENT_DENSE = 7;

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

/**
 * Extract the "line" identifier from a unit number.
 * Buildings use different schemes:
 *   "12A" → "a"  (letter suffix = the line)
 *   "1201" → "01" (4-digit: last 2 digits = the line)
 *   "12N" → "n"  (directional suffix)
 *   "301" → "01" (3-digit: last 2 digits = the line)
 *   "PH-A" → "a" (penthouse with letter)
 *   "3" → null (single number, can't determine line)
 */
function extractUnitLine(address: string): string | null {
  const unitMatch = address.match(/\b(?:apt|unit|suite|ste|#|fl|floor)\s*([a-z0-9-]+)/i)
    || address.match(/\s+(\d+[a-z])\s*(?:,|$)/i)
    || address.match(/\s+([a-z]\d+)\s*(?:,|$)/i)
    || address.match(/\s+([a-z]{1,2})\s*(?:,|$)/i);

  if (!unitMatch) return null;

  const unit = unitMatch[1].toLowerCase().replace(/[-\s]/g, '');

  // Pure letter (A, B, PH, N, S)
  if (/^[a-z]{1,3}$/.test(unit)) return unit;

  // Letter suffix: "12A" → "a", "3B" → "b"
  const letterSuffix = unit.match(/\d+([a-z]+)$/);
  if (letterSuffix) return letterSuffix[1];

  // Letter prefix: "A12" → "a", "N3" → "n"
  const letterPrefix = unit.match(/^([a-z]+)\d+/);
  if (letterPrefix) return letterPrefix[1];

  // 4-digit numeric: "1201" → "01"
  if (/^\d{4}$/.test(unit)) return unit.slice(-2);

  // 3-digit numeric: "301" → "01"
  if (/^\d{3}$/.test(unit)) return unit.slice(-2);

  // 2-digit numeric: "01"
  if (/^\d{2}$/.test(unit)) return unit;

  return null;
}

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
  const subjectUnitLine = address ? extractUnitLine(address) : null;

  // Enrich with same-building flag, unit-line flag, + relevance score
  const enriched = rawComps.map((comp: any) => {
    const compStreet = normalizeStreetBase(comp.formattedAddress || '');
    const isSameBuilding =
      !!subjectStreet &&
      !!compStreet &&
      (compStreet === subjectStreet ||
        compStreet.startsWith(subjectStreet) ||
        subjectStreet.startsWith(compStreet));

    // Same unit line: same building + matching line identifier
    const compUnitLine = isSameBuilding ? extractUnitLine(comp.formattedAddress || '') : null;
    const isSameUnitLine = !!(isSameBuilding && subjectUnitLine && compUnitLine && subjectUnitLine === compUnitLine);

    const freshnessScore =
      comp.daysOld !== null ? Math.max(0, 1 - comp.daysOld / 180) : 0.5;

    const baseCorrelation = comp.correlation ?? 0.5;
    // Tiered relevance: unit line > building > nearby
    const buildingBoost = isSameUnitLine ? 0.35 : isSameBuilding ? 0.25 : 0;
    const bedroomBonus = (requestedBedrooms !== null && comp.bedrooms !== null && comp.bedrooms === requestedBedrooms) ? 0.15 : 0;
    const isBedroomFallback = requestedBedrooms !== null && comp.bedrooms !== null && comp.bedrooms !== requestedBedrooms;
    const relevanceScore =
      baseCorrelation * 0.45 + freshnessScore * 0.2 + buildingBoost + bedroomBonus;

    return {
      ...comp,
      isSameBuilding,
      isSameUnitLine,
      relevanceScore,
      // Correlation boost: unit line (×1.8) > building (×1.5) > none
      correlation: isSameUnitLine
        ? Math.min(baseCorrelation * 1.8, 1.0)
        : isSameBuilding
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

  // Prioritise: same unit line first, then same building, then nearby
  const sameUnitLine = valid.filter((c: any) => c.isSameUnitLine);
  const sameBuildingOnly = valid.filter((c: any) => c.isSameBuilding && !c.isSameUnitLine);
  const nearby = valid.filter((c: any) => !c.isSameBuilding);

  return [
    ...sameUnitLine,
    ...sameBuildingOnly.slice(0, Math.max(0, 5 - sameUnitLine.length)),
    ...nearby.slice(0, Math.max(3, 10 - sameUnitLine.length - sameBuildingOnly.length)),
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
      // Dynamic TTL: check if this ZIP has dense cache (50+ entries)
      const zipCode4cache = zip || address?.match(/\d{5}/)?.[0] || '';
      let cacheDays = CACHE_DAYS_RENT_DEFAULT;
      if (zipCode4cache) {
        const { count } = await sb
          .from('rentcast_cache')
          .select('id', { count: 'exact', head: true })
          .like('lookup_key', `%${zipCode4cache}%`)
          .eq('endpoint', 'rent-estimate');
        if (count !== null && count >= 50) {
          cacheDays = CACHE_DAYS_RENT_DENSE;
        }
      }

      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < cacheDays * 24 * 60 * 60 * 1000) {
        console.log(`Cache hit for ${endpointKey}: ${lookupKey} (TTL: ${cacheDays}d)`);
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

    // ── Primary fetch with retry for transient failures ──────────────
    const apiUrl = `https://api.rentcast.io/v1/avm/rent/long-term?${params.toString()}`;

    async function fetchWithRetry(url: string, opts: RequestInit, retries = 1): Promise<Response> {
      const resp = await fetch(url, opts);
      if (retries > 0 && (resp.status === 502 || resp.status === 503 || resp.status === 504)) {
        console.log(`Rentcast returned ${resp.status}, retrying in 1s...`);
        await resp.text(); // consume body
        await new Promise(r => setTimeout(r, 1000));
        return fetchWithRetry(url, opts, retries - 1);
      }
      return resp;
    }

    const response = await fetchWithRetry(apiUrl, {
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
