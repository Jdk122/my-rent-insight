import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://www.renewalreply.com";

// All 50 states + DC + PR
const STATE_SLUGS = [
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new-hampshire","new-jersey","new-mexico","new-york","north-carolina",
  "north-dakota","ohio","oklahoma","oregon","pennsylvania","rhode-island",
  "south-carolina","south-dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west-virginia","wisconsin","wyoming",
  "district-of-columbia","puerto-rico",
];

function getDefaultUrls(): string[] {
  const urls: string[] = [
    `${SITE_URL}/`,
    `${SITE_URL}/rent-data`,
    `${SITE_URL}/guides/rent-increase-laws-by-state`,
    `${SITE_URL}/rent-increase-calculator`,
  ];
  for (const slug of STATE_SLUGS) {
    urls.push(`${SITE_URL}/rent-data/${slug}`);
  }
  return urls;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const key = Deno.env.get("INDEXNOW_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "INDEXNOW_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let urls: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.urls) && body.urls.length > 0) {
        urls = body.urls;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    if (urls.length === 0) {
      urls = getDefaultUrls();
    }

    // IndexNow batch limit is 10,000
    const batch = urls.slice(0, 10000);

    const payload = {
      host: "www.renewalreply.com",
      key,
      keyLocation: `${SITE_URL}/${key}.txt`,
      urlList: batch,
    };

    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const status = response.status;
    const responseText = await response.text();

    console.log(`IndexNow ping: ${batch.length} URLs, status ${status}`);

    return new Response(
      JSON.stringify({
        indexnow_status: status,
        urls_submitted: batch.length,
        response: responseText.slice(0, 500),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("IndexNow ping error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
