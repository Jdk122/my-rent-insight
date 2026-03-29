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

const RENT_REPORTERS_URL = "https://prf.hn/click/camref:1110lBJ34";
const HIREAHELPER_URL = "https://www.hireahelper.com/?affil=32303039";

function getEmailHtml(lead: any): { subject: string; html: string } {
  const score = lead.fairness_score;
  const verdict = lead.verdict;
  const isAbove = (score != null && score < 60) || (verdict != null && badVerdicts.includes(verdict));
  const isGood = score != null && score >= 80;

  const reportUrl = lead.zip ? `${BASE_URL}/rent/${lead.zip}` : BASE_URL;
  const unsubUrl = `${BASE_URL}/outcome?id=${lead.id}&result=unsubscribe`;

  let subject: string;
  let intro: string;
  let affiliateBlock = "";

  if (isAbove) {
    subject = "Did you send the letter?";
    intro = `Most renters never respond to their landlord's increase. Most landlords take that as a yes. You already have the negotiation letter with the comps behind it. The hard part is done.`;
    affiliateBlock = `
      <p style="font-size:13px;color:#555;line-height:1.6;margin:0 0 4px;">
        If you do end up moving, it helps to get quotes early. You can compare local movers with real reviews and transparent pricing.
      </p>
      <p style="margin:8px 0 0;">
        <a href="${HIREAHELPER_URL}" style="font-size:13px;color:#168eca;text-decoration:none;font-weight:600;">Compare movers →</a>
      </p>
    `;
  } else if (isGood) {
    subject = "Have you locked in your renewal yet?";
    intro = `Your renewal came in below market. That's worth locking in before your landlord changes the terms. If you haven't signed yet, this is also a good time to ask for something extra. A longer lease, a unit upgrade, a repair you've been waiting on. Landlords are more flexible when they know you're staying.`;
    affiliateBlock = `
      <p style="font-size:13px;color:#555;line-height:1.6;margin:0 0 4px;">
        Staying put? Your monthly rent payments may help build your credit. Most renters don't know this is an option.
      </p>
      <p style="margin:8px 0 0;">
        <a href="${RENT_REPORTERS_URL}" style="font-size:13px;color:#168eca;text-decoration:none;font-weight:600;">Start reporting rent →</a>
      </p>
    `;
  } else {
    subject = "Have you replied to your landlord yet?";
    intro = `Even when the increase is fair, responding is worth it. Most landlords expect a conversation, and avoiding turnover is worth more to them than the difference between their ask and yours. A short reply puts you in a stronger position than silence.`;
    affiliateBlock = `
      <p style="font-size:13px;color:#555;line-height:1.6;margin:0 0 4px;">
        One thing worth doing while you're renewing. Your rent payments may help build your credit.
      </p>
      <p style="margin:8px 0 0;">
        <a href="${RENT_REPORTERS_URL}" style="font-size:13px;color:#168eca;text-decoration:none;font-weight:600;">Start reporting rent →</a>
      </p>
    `;
  }

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 24px;">${intro}</p>
      <div style="margin-bottom:16px;">
        <a href="${reportUrl}" style="display:inline-block;padding:12px 20px;background:#168eca;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View your report →</a>
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;" />
      ${affiliateBlock}
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:20px;">— James</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:10px;color:#bbb;text-align:center;line-height:1.5;">
        971 US Hwy 202N Ste N, Branchburg NJ 08876 · <a href="${BASE_URL}/privacy" style="color:#bbb;text-decoration:underline;">Details</a> · <a href="${unsubUrl}" style="color:#bbb;text-decoration:underline;">Unsubscribe</a>
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
