import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Find leads where letter was generated exactly 7 days ago (±12 hours window),
  // followup not yet sent, and not unsubscribed
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const windowStart = new Date(sevenDaysAgo);
  windowStart.setHours(windowStart.getHours() - 12);
  const windowEnd = new Date(sevenDaysAgo);
  windowEnd.setHours(windowEnd.getHours() + 12);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email")
    .gte("letter_generated_at", windowStart.toISOString())
    .lte("letter_generated_at", windowEnd.toISOString())
    .is("followup_sent_at", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (error) {
    console.error("Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!leads || leads.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const siteUrl = "https://my-rent-insight.lovable.app";
  let sent = 0;

  for (const lead of leads) {
    const agreedUrl = `${siteUrl}/outcome?id=${lead.id}&outcome=agreed`;
    const counteredUrl = `${siteUrl}/outcome?id=${lead.id}&outcome=countered`;
    const noResponseUrl = `${siteUrl}/outcome?id=${lead.id}&outcome=no_response`;

    // Log the email that would be sent (actual email delivery requires an email service)
    console.log(`Follow-up for ${lead.email}:`, {
      subject: "Did your landlord respond?",
      body: `You sent your rent negotiation letter a week ago. How did it go?`,
      links: { agreedUrl, counteredUrl, noResponseUrl },
    });

    // Mark as sent
    await supabase
      .from("leads")
      .update({ followup_sent_at: new Date().toISOString() })
      .eq("id", lead.id);

    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
