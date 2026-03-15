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
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();

  // Leads captured 5–7 days ago
  const dayAgo7 = new Date(now);
  dayAgo7.setDate(dayAgo7.getDate() - 7);
  const dayAgo5 = new Date(now);
  dayAgo5.setDate(dayAgo5.getDate() - 5);

  // Bad-outcome verdicts stored in the DB
  const badVerdicts = ["Moderate", "Unfair", "Excessive", "Above Market"];

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email, fairness_score, verdict, current_rent, proposed_rent, zip")
    .eq("tool_type", "renewal")
    .is("founder_followup_sent_at", null)
    .not("email", "is", null)
    .gte("created_at", dayAgo7.toISOString())
    .lte("created_at", dayAgo5.toISOString())
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (error) {
    console.error("Query error:", error);
    return new Response(
      JSON.stringify({ error: "Query failed", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Filter: score < 60 OR verdict in bad list
  const eligible = (leads || []).filter((l) => {
    const scoreBad = l.fairness_score != null && l.fairness_score < 60;
    const verdictBad = l.verdict != null && badVerdicts.includes(l.verdict);
    return scoreBad || verdictBad;
  });

  let sent = 0;
  let failed = 0;

  const body = `Hey — you used RenewalReply recently to check your rent increase. I'm the founder, and I'm curious: did you end up negotiating with your landlord?\n\nIf the tool helped, I'd love to hear what happened. If it didn't, I'd still really appreciate the honest feedback.\n\n— James`;

  for (const lead of eligible) {
    const attemptedAt = new Date().toISOString();
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "James from RenewalReply <noreply@renewalreply.com>",
          reply_to: "james@renewalreply.com",
          to: [lead.email],
          subject: "Did your negotiation work?",
          text: body,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Resend error for ${lead.email}: ${res.status} ${errBody}`);

        await supabase.from("email_send_attempts").insert({
          lead_id: lead.id,
          email: lead.email,
          template: "founder_followup",
          attempted_at: attemptedAt,
          success: false,
          error_message: `${res.status}: ${errBody}`,
        });

        failed++;
        continue;
      }

      // Consume response body
      await res.text();

      // Mark sent on lead
      await supabase
        .from("leads")
        .update({ founder_followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      // Log success
      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "founder_followup",
        attempted_at: attemptedAt,
        success: true,
      });

      sent++;
    } catch (e) {
      console.error(`Send failed for ${lead.email}:`, e);

      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "founder_followup",
        attempted_at: attemptedAt,
        success: false,
        error_message: String(e),
      });

      failed++;
    }
  }

  console.log(`Founder followup: ${sent} sent, ${failed} failed, ${eligible.length} eligible, ${(leads || []).length} queried`);

  return new Response(
    JSON.stringify({ sent, failed, eligible: eligible.length, queried: (leads || []).length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
