import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FRED_API_KEY = "2f091940133b890134935950c4f22eec";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state } = await req.json();
    if (!state || typeof state !== "string" || state.length !== 2) {
      return new Response(
        JSON.stringify({ error: "Invalid state abbreviation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seriesId = `${state.toUpperCase()}RVAC`;
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ rate: 7.0, year: "2024", isFallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const obs = data.observations?.filter((o: { value: string }) => o.value !== ".");

    if (!obs || obs.length === 0) {
      return new Response(
        JSON.stringify({ rate: 7.0, year: "2024", isFallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        rate: parseFloat(obs[0].value),
        year: obs[0].date?.split("-")[0] || "2024",
        isFallback: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("FRED vacancy error:", error);
    return new Response(
      JSON.stringify({ rate: 7.0, year: "2024", isFallback: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
