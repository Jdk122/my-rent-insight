import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://renewalreply.com";
const WORDMARK = `${BASE_URL}/renewalreply-wordmark.png`;

const emailHeader = `
  <img src="${WORDMARK}" alt="RenewalReply" width="140" style="display:block;margin:0 0 16px;" />
  <div style="height:2px;background:#168eca;margin:0 0 24px;"></div>
`;

const badVerdicts = ["Moderate", "Unfair", "Excessive", "Above Market"];

function getEmailHtml(lead: any): { subject: string; html: string } {
  const score = lead.fairness_score;
  const verdict = lead.verdict;
  const isAbove = (score != null && score < 60) || (verdict != null && badVerdicts.includes(verdict));
  const isGood = score != null && score >= 80;

  const reportUrl = lead.zip ? `${BASE_URL}/rent/${lead.zip}` : BASE_URL;
  const unsubUrl = `${BASE_URL}/outcome?id=${lead.id}&result=unsubscribe`;

  let subject: string;
  let intro: string;

  if (isAbove) {
    subject = "Did you send the letter?";
    intro = `Hey — you checked your rent increase a couple days ago and it came in above market. I built you a negotiation letter with the data behind it. If you haven't sent it yet, now is a good time — the longer you wait, the harder it is to push back.`;
  } else if (isGood) {
    subject = "Have you locked in your renewal yet?";
    intro = `Hey — you checked your rent increase a couple days ago and it looks like a solid deal. If you haven't signed yet, it might be worth locking it in before your landlord changes the terms. You could also ask for extras like a longer lease or a unit upgrade.`;
  } else {
    subject = "Have you replied to your landlord yet?";
    intro = `Hey — you checked your rent increase a couple days ago. Even though your increase is in line with the market, it's still worth responding. Most landlords expect a conversation, and avoiding turnover is worth more to them than a few percent.`;
  }

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 24px;">${intro}</p>
      <div style="margin-bottom:16px;">
        <a href="${reportUrl}" style="display:inline-block;padding:12px 20px;background:#168eca;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View your report →</a>
      </div>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:20px;">— James</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#999;text-align:center;line-height:1.6;">
        RenewalReply | PacketOps LLC<br/>
        971 US Highway 202N, Suite N, Branchburg, NJ 08876<br/><br/>
        You received this because you used the RenewalReply rent analysis tool.<br/>
        <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  `;

  return { subject, html };
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
  const now = new Date();

  const dayAgo3 = new Date(now);
  dayAgo3.setDate(dayAgo3.getDate() - 3);
  const dayAgo2 = new Date(now);
  dayAgo2.setDate(dayAgo2.getDate() - 2);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email, fairness_score, verdict, current_rent, proposed_rent, zip, unsubscribed")
    .eq("tool_type", "renewal")
    .is("founder_followup_sent_at", null)
    .not("email", "is", null)
    .gte("created_at", dayAgo3.toISOString())
    .lte("created_at", dayAgo2.toISOString())
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (error) {
    console.error("Query error:", error);
    return new Response(
      JSON.stringify({ error: "Query failed", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const eligible = leads || [];
  let sent = 0;
  let failed = 0;
  let skippedUnsub = 0;

  for (const lead of eligible) {
    const normalizedEmail = lead.email.trim().toLowerCase();
    const { data: unsubRows } = await supabase
      .from("leads")
      .select("unsubscribed")
      .eq("email", normalizedEmail)
      .eq("unsubscribed", true)
      .limit(1);

    if (unsubRows && unsubRows.length > 0) {
      skippedUnsub++;
      continue;
    }

    const { subject, html } = getEmailHtml(lead);
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
          html,
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

      await res.text();

      await supabase
        .from("leads")
        .update({ founder_followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

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

  console.log(`Day 2-3 followup: ${sent} sent, ${failed} failed, ${skippedUnsub} skipped (unsub), ${eligible.length} eligible`);

  return new Response(
    JSON.stringify({ sent, failed, skipped_unsubscribed: skippedUnsub, eligible: eligible.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
