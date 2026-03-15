import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const badVerdicts = ["Moderate", "Unfair", "Excessive", "Above Market"];

function getEmailCopy(lead: any): { subject: string; text: string } {
  const score = lead.fairness_score;
  const verdict = lead.verdict;
  const isAbove = score == null || (score < 60) || (verdict != null && badVerdicts.includes(verdict));
  const isGood = score != null && score >= 80;

  if (!isAbove && isGood) {
    return {
      subject: "How did your renewal go?",
      text: "Hey — you used RenewalReply recently and your rent looked like a good deal. I'm the founder, and I'm curious: did you renew? Did you ask for any extras like repairs or upgrades? I'd love to hear how it went — your feedback helps me make the tool better for other renters.\n\n— James",
    };
  }
  if (isAbove) {
    return {
      subject: "Did your negotiation work?",
      text: "Hey — you used RenewalReply recently to check your rent increase. I'm the founder, and I'm curious: did you end up negotiating with your landlord?\n\nIf the tool helped, I'd love to hear what happened. If it didn't, I'd still really appreciate the honest feedback.\n\n— James",
    };
  }
  // Score 60-79
  return {
    subject: "How did your renewal go?",
    text: "Hey — you used RenewalReply recently to check your rent increase. I'm the founder, and I'm curious: how did the renewal go? Did you end up negotiating or asking for anything? Either way, I'd love to hear what happened — your feedback helps me make the tool better.\n\n— James",
  };
}

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

  // Backfill cutoff: leads created before March 12, 2026
  const cutoff = "2026-03-12T00:00:00.000Z";

  // Fetch in batches to avoid the 1000-row limit
  let allLeads: any[] = [];
  let from = 0;
  const batchSize = 500;

  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, email, fairness_score, verdict, current_rent, proposed_rent, zip")
      .eq("tool_type", "renewal")
      .is("founder_followup_sent_at", null)
      .not("email", "is", null)
      .lt("created_at", cutoff)
      .or("unsubscribed.is.null,unsubscribed.eq.false")
      .range(from, from + batchSize - 1);

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "Query failed", detail: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    allLeads = allLeads.concat(data || []);
    if (!data || data.length < batchSize) break;
    from += batchSize;
  }

  console.log(`Backfill: found ${allLeads.length} eligible leads`);

  let sent = 0;
  let failed = 0;

  for (const lead of allLeads) {
    const { subject, text } = getEmailCopy(lead);
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
          subject,
          text,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Resend error for ${lead.email}: ${res.status} ${errBody}`);

        await supabase.from("email_send_attempts").insert({
          lead_id: lead.id,
          email: lead.email,
          template: "founder_followup_backfill",
          attempted_at: attemptedAt,
          success: false,
          error_message: `${res.status}: ${errBody}`,
        });

        failed++;

        // If rate-limited, pause before continuing
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
          console.log(`Rate limited, waiting ${retryAfter}s`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
        }
        continue;
      }

      await res.text();

      await supabase
        .from("leads")
        .update({ founder_followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "founder_followup_backfill",
        attempted_at: attemptedAt,
        success: true,
      });

      sent++;

      // Small delay between sends to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`Send failed for ${lead.email}:`, e);

      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "founder_followup_backfill",
        attempted_at: attemptedAt,
        success: false,
        error_message: String(e),
      });

      failed++;
    }
  }

  console.log(`Backfill complete: ${sent} sent, ${failed} failed, ${allLeads.length} total`);

  return new Response(
    JSON.stringify({ sent, failed, eligible: allLeads.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
