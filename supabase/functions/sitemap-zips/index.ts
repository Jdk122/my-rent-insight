const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = 'https://www.renewalreply.com';
const DATA_URL = `${SITE_URL}/data/rentData.json`;
const MAX_URLS_PER_SITEMAP = 45000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch the rent data JSON to get all zip codes
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      return new Response('Failed to fetch rent data', { status: 502, headers: corsHeaders });
    }

    const data = await response.json();
    const zips = Object.keys(data).sort();

    // Check if we need a sitemap index (>45k URLs)
    const url = new URL(req.url);
    const pageParam = url.searchParams.get('page');

    if (zips.length > MAX_URLS_PER_SITEMAP && !pageParam) {
      // Return a sitemap index
      const totalPages = Math.ceil(zips.length / MAX_URLS_PER_SITEMAP);
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sitemap-zips`;

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      for (let i = 1; i <= totalPages; i++) {
        xml += `  <sitemap>\n`;
        xml += `    <loc>${fnUrl}?page=${i}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n`;
        xml += `  </sitemap>\n`;
      }
      xml += `</sitemapindex>`;

      return new Response(xml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // Determine which slice of zips to render
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const start = (page - 1) * MAX_URLS_PER_SITEMAP;
    const slice = zips.slice(start, start + MAX_URLS_PER_SITEMAP);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    const today = new Date().toISOString().slice(0, 10);
    for (const zip of slice) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/rent/${zip}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }
    xml += `</urlset>`;

    return new Response(xml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers: corsHeaders });
  }
});
