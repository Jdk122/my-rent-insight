const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = 'https://www.huduser.gov/portal/datasets/fmr/fmr2026/fy2026_erap_fmrs.xlsx';

  const resp = await fetch(url);
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `HUD returned ${resp.status}` }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(resp.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="fy2026_erap_fmrs.xlsx"',
    },
  });
});
