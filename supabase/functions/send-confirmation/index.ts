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

function emailFooter(cityLabel: string, unsubUrl: string) {
  return `
    <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:28px;">— RenewalReply</p>
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
    <p style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#999;text-align:center;">
      You received this because you used RenewalReply for ${cityLabel}.<br/>
      <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
    </p>
  `;
}

function buildRenewalHtml(data: any) {
  const { city, state, zip, bedrooms, fairness_score, verdict_label } = data;
  const cityLabel = city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";
  const reportUrl = `${BASE_URL}/?zip=${zip || ""}&bedrooms=${bedrooms || ""}`;
  const unsubUrl = `${BASE_URL}/outcome?result=unsubscribe&id=`;

  const scoreLine = fairness_score != null
    ? `<p style="font-family:'DM Serif Display',Georgia,serif;font-size:18px;font-weight:700;color:#1b1f27;margin:16px 0 4px;">Your Fairness Score: ${fairness_score}/100 — ${verdict_label || "See report"}</p>`
    : "";

  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#1b1f27;margin:0 0 12px;">Your rent analysis is ready</h1>
      ${scoreLine}
      <p style="font-size:15px;color:#555;line-height:1.7;margin:16px 0;">
        Your full report with comparable listings, market data, and negotiation letter is available now:
      </p>
      <a href="${reportUrl}" style="display:inline-block;padding:14px 24px;background:#168eca;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
        View your full report →
      </a>
      <p style="font-size:14px;color:#6b7280;margin-top:20px;line-height:1.6;">
        💡 <strong>Tip:</strong> Bookmark your results page so you can reference it during your negotiation.
      </p>
      ${emailFooter(cityLabel, unsubUrl)}
    </div>
  `;
}

function buildWsipHtml(data: any) {
  const { city, state, zip, bedrooms } = data;
  const cityLabel = city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";
  const reportUrl = `${BASE_URL}/what-should-i-pay?zip=${zip || ""}&bedrooms=${bedrooms || ""}`;
  const renewalUrl = BASE_URL;
  const unsubUrl = `${BASE_URL}/outcome?result=unsubscribe&id=`;

  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#1b1f27;margin:0 0 12px;">Your market report is ready</h1>
      <p style="font-size:15px;color:#555;line-height:1.7;margin:16px 0;">
        Your full report with comparable listings and fair rent range for ${cityLabel} is available now:
      </p>
      <a href="${reportUrl}" style="display:inline-block;padding:14px 24px;background:#168eca;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
        View your full report →
      </a>
      <p style="font-size:14px;color:#6b7280;margin-top:20px;line-height:1.6;">
        Already have a lease? <a href="${renewalUrl}" style="color:#168eca;text-decoration:underline;">Check if your next rent increase is fair →</a>
      </p>
      ${emailFooter(cityLabel, unsubUrl)}
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const data = await req.json();
    const { email, city, state, zip, bedrooms, tool_type, fairness_score, verdict_label } = data;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isWsip = tool_type === "wsip";
    const cityLabel = city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";

    const html = isWsip ? buildWsipHtml(data) : buildRenewalHtml(data);
    const subject = isWsip
      ? `Your market report for ${cityLabel}`
      : `Your rent analysis for ${cityLabel}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RenewalReply <noreply@renewalreply.com>",
        reply_to: "social@renewalreply.com",
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Confirmation email Resend error for ${email}: ${res.status} ${body}`);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: body }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-confirmation error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
