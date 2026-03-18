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

function buildButton(label: string, href: string, color: string) {
  return `<a href="${href}" style="display:inline-block;padding:12px 20px;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-right:8px;margin-bottom:8px;">${label}</a>`;
}

const badVerdicts = ["Moderate", "Unfair", "Excessive", "Above Market"];

function getEmailHtml(lead: any): { subject: string; html: string } {
  const score = lead.fairness_score;
  const verdict = lead.verdict;
  const isAbove = (score != null && score < 60) || (verdict != null && badVerdicts.includes(verdict));
  const isGood = score != null && score >= 80;

  const agreedUrl = `${BASE_URL}/outcome?id=${lead.id}&result=agreed`;
  const noResponseUrl = `${BASE_URL}/outcome?id=${lead.id}&result=no_response`;
  const movingUrl = `${BASE_URL}/outcome?id=${lead.id}&result=moving`;
  const unsubUrl = `${BASE_URL}/outcome?id=${lead.id}&result=unsubscribe`;

  let subject: string;
  let intro: string;

  if (isAbove) {
    subject = "Did your negotiation work?";
    intro = `Hey — you used RenewalReply recently to check your rent increase. I'm the founder, and I'm curious: did you end up negotiating with your landlord? Let me know with one click:`;
  } else if (isGood) {
    subject = "How did your renewal go?";
    intro = `Hey — you used RenewalReply recently and your rent looked like a good deal. I'm the founder, and I'm curious: did you renew? Let me know with one click:`;
  } else {
    subject = "How did your renewal go?";
    intro = `Hey — you used RenewalReply recently to check your rent increase. I'm the founder, and I'm curious: how did the renewal go? Let me know with one click:`;
  }

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 24px;">${intro}</p>
      <div style="margin-bottom:16px;">
        ${buildButton("I negotiated successfully ✓", agreedUrl, "#2d6a4f")}
        ${buildButton("I'm still deciding", noResponseUrl, "#6b7280")}
        ${buildButton("I moved instead", movingUrl, "#b8860b")}
      </div>
      <p style="font-size:15px;color:#555;line-height:1.7;margin:24px 0 0;">
        Your feedback helps me make the tool better for other renters. Either way, I appreciate it.
      </p>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:20px;">— James</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#999;text-align:center;">
        You received this because you used RenewalReply.<br/>
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

  const dayAgo7 = new Date(now);
  dayAgo7.setDate(dayAgo7.getDate() - 7);
  const dayAgo5 = new Date(now);
  dayAgo5.setDate(dayAgo5.getDate() - 5);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email, fairness_score, verdict, current_rent, proposed_rent, zip, unsubscribed")
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

  const eligible = leads || [];
  let sent = 0;
  let failed = 0;
  let skippedUnsub = 0;

  for (const lead of eligible) {
    // Double-check unsubscribe at email level (another row may be unsubscribed)
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

  console.log(`Founder followup: ${sent} sent, ${failed} failed, ${skippedUnsub} skipped (unsub), ${eligible.length} eligible`);

  return new Response(
    JSON.stringify({ sent, failed, skipped_unsubscribed: skippedUnsub, eligible: eligible.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
