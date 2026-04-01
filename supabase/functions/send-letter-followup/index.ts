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

interface AffiliateSection {
  text: string;
  buttonLabel: string;
  buttonUrl: string;
  disclosure: string | null;
}

async function getAffiliateSection(
  supabase: any,
  analysisId: string | null
): Promise<AffiliateSection | null> {
  if (!analysisId) return null;

  // Get user_intent from analyses
  const { data: analysis } = await supabase
    .from("analyses")
    .select("user_intent")
    .eq("id", analysisId)
    .single();

  const intent = analysis?.user_intent;
  if (!intent) return null;

  if (intent === "stay") {
    // Check for prior affiliate click
    const { data: clicks } = await supabase
      .from("referral_clicks")
      .select("id")
      .eq("analysis_id", analysisId)
      .eq("event_type", "affiliate_click")
      .limit(1);

    if (clicks && clicks.length > 0) return null;

    return {
      text: "While you're staying — your rent could be building your credit.",
      buttonLabel: "Start reporting rent →",
      buttonUrl: "https://prf.hn/click/camref:1110lBJ34?utm_source=email&utm_medium=letter_followup&utm_campaign=rent_reporting",
      disclosure: "RenewalReply may earn a commission from this partner.",
    };
  }

  if (intent === "move") {
    // Check for listing engagement
    const { data: engagements } = await supabase
      .from("referral_clicks")
      .select("id")
      .eq("analysis_id", analysisId)
      .in("link_type", ["browse_deals", "listing_click"])
      .limit(1);

    const hasEngagement = engagements && engagements.length > 0;

    if (!hasEngagement) {
      return {
        text: "Still looking? Browse scored apartments in your area.",
        buttonLabel: "See what's available →",
        buttonUrl: "https://renewalreply.com/deals",
        disclosure: null,
      };
    }

    return {
      text: "Need help with the move? Compare movers in your area.",
      buttonLabel: "Compare movers →",
      buttonUrl: "https://www.hireahelper.com/?affil=32303039",
      disclosure: "RenewalReply may earn a commission from this partner.",
    };
  }

  return null;
}

const AFFILIATE_DISCLOSURE = `
  <table role="presentation" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="padding: 12px 0 8px 0; font-size: 11px; color: #888; line-height: 1.5; border-top: 1px solid #eee;">
        <strong>Disclosure:</strong> Some links below are affiliate or referral links to third-party services. If you use them, RenewalReply may receive compensation at no additional cost to you. Affiliate relationships never influence our rent analysis, fairness scores, or advice. <a href="https://www.renewalreply.com/privacy" style="color: #888; text-decoration: underline;">Privacy Policy</a>
      </td>
    </tr>
  </table>
`;

function buildAffiliateSectionHtml(section: AffiliateSection | null): string {
  if (!section) return "";

  const disclosureHtml = section.disclosure
    ? `<p style="font-size:11px;color:#999;margin:8px 0 0;">${section.disclosure}</p>`
    : "";

  // Show FTC-compliant disclosure above affiliate content
  const hasAffiliateLink = !!section.disclosure;
  const disclosureBlock = hasAffiliateLink ? AFFILIATE_DISCLOSURE : "";

  return `
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0 20px;" />
    ${disclosureBlock}
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 12px;">${section.text}</p>
    ${buildButton(section.buttonLabel, section.buttonUrl, "#168eca")}
    ${disclosureHtml}
  `;
}

function buildDay14Html(lead: any, affiliateHtml: string) {
  const unsubUrl = `${BASE_URL}/outcome?id=${lead.id}&result=unsubscribe`;
  const agreedUrl = `${BASE_URL}/outcome?id=${lead.id}&result=agreed`;
  const noResponseUrl = `${BASE_URL}/outcome?id=${lead.id}&result=no_response`;
  const movingUrl = `${BASE_URL}/outcome?id=${lead.id}&result=moving`;

  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#1b1f27;margin:0 0 12px;">Has your landlord responded?</h1>
      <p style="font-size:15px;color:#555;line-height:1.7;">
        It's been about two weeks since you checked your rent increase. If you sent the letter, I'm curious how it went. If you haven't heard back, that's normal — landlords often take a while. Either way, let me know with one click:
      </p>
      <div style="margin:24px 0 8px;">
        ${buildButton("My landlord agreed", agreedUrl, "#2d6a4f")}
        ${buildButton("No response yet", noResponseUrl, "#6b7280")}
        ${buildButton("I decided to move", movingUrl, "#b8860b")}
      </div>
      ${affiliateHtml}
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:28px;">— James</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#999;text-align:center;line-height:1.6;">
        RenewalReply | PacketOps LLC<br/>
        971 US Highway 202N, Suite N, Branchburg, NJ 08876<br/><br/>
        You received this because you used the RenewalReply rent analysis tool.<br/>
        <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  `;
}

function buildDay30Html(lead: any, affiliateHtml: string) {
  const unsubUrl = `${BASE_URL}/outcome?id=${lead.id}&result=unsubscribe`;
  const agreedUrl = `${BASE_URL}/outcome?id=${lead.id}&result=agreed`;
  const noResponseUrl = `${BASE_URL}/outcome?id=${lead.id}&result=no_response`;
  const movingUrl = `${BASE_URL}/outcome?id=${lead.id}&result=moving`;
  const referralUrl = "https://renewalreply.com/?utm_source=referral&utm_medium=email&utm_campaign=day30";

  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#1b1f27;margin:0 0 12px;">How did it turn out?</h1>
      <p style="font-size:15px;color:#555;line-height:1.7;">
        It's been about a month since you checked your rent increase. Whatever happened, I'd love to hear — your feedback helps me make the tool better.
      </p>
      <div style="margin:24px 0 8px;">
        ${buildButton("My landlord agreed", agreedUrl, "#2d6a4f")}
        ${buildButton("No response yet", noResponseUrl, "#6b7280")}
        ${buildButton("I decided to move", movingUrl, "#b8860b")}
      </div>
      <div style="margin-top:24px;padding:16px;background:#f9f9f6;border-radius:8px;">
        <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 8px;">Know someone dealing with a rent increase? Share this tool — it's free.</p>
        <a href="${referralUrl}" style="font-size:14px;color:#168eca;font-weight:600;text-decoration:none;">renewalreply.com →</a>
      </div>
      ${affiliateHtml}
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:28px;">— James</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#999;text-align:center;line-height:1.6;">
        RenewalReply | PacketOps LLC<br/>
        971 US Highway 202N, Suite N, Branchburg, NJ 08876<br/><br/>
        You received this because you used the RenewalReply rent analysis tool.<br/>
        <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  let sentDay14 = 0;
  let sentDay30 = 0;

  // ── Day 14 emails ──
  const day14Target = new Date(now);
  day14Target.setDate(day14Target.getDate() - 14);
  const day14Start = new Date(day14Target);
  day14Start.setHours(day14Start.getHours() - 12);
  const day14End = new Date(day14Target);
  day14End.setHours(day14End.getHours() + 12);

  const { data: day14Leads, error: err14 } = await supabase
    .from("leads")
    .select("id, email, current_rent, proposed_rent, zip, fairness_score, verdict, analysis_id")
    .gte("letter_generated_at", day14Start.toISOString())
    .lte("letter_generated_at", day14End.toISOString())
    .is("followup_sent_at", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (err14) console.error("Day 14 query error:", err14);

  for (const lead of day14Leads || []) {
    // Global unsub check
    const normalizedEmail = lead.email.trim().toLowerCase();
    const { data: unsubRows } = await supabase
      .from("leads")
      .select("unsubscribed")
      .eq("email", normalizedEmail)
      .eq("unsubscribed", true)
      .limit(1);
    if (unsubRows && unsubRows.length > 0) continue;

    const affiliateSection = await getAffiliateSection(supabase, lead.analysis_id);
    const affiliateHtml = buildAffiliateSectionHtml(affiliateSection);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "James from RenewalReply <noreply@renewalreply.com>",
          reply_to: "james@renewalreply.com",
          to: [lead.email],
          subject: "Has your landlord responded yet?",
          html: buildDay14Html(lead, affiliateHtml),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Day 14 Resend error for ${lead.email}: ${res.status} ${body}`);
        await supabase.from("email_send_attempts").insert({
          lead_id: lead.id,
          email: lead.email,
          template: "letter_followup_day14",
          attempted_at: new Date().toISOString(),
          success: false,
          error_message: `${res.status}: ${body}`,
        });
        continue;
      }

      await res.text();
      await supabase
        .from("leads")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "letter_followup_day14",
        attempted_at: new Date().toISOString(),
        success: true,
      });

      sentDay14++;
    } catch (e) {
      console.error(`Day 14 send failed for ${lead.email}:`, e);
      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "letter_followup_day14",
        attempted_at: new Date().toISOString(),
        success: false,
        error_message: String(e),
      });
    }
  }

  // ── Day 30 emails ──
  const day30Target = new Date(now);
  day30Target.setDate(day30Target.getDate() - 30);
  const day30Start = new Date(day30Target);
  day30Start.setHours(day30Start.getHours() - 12);
  const day30End = new Date(day30Target);
  day30End.setHours(day30End.getHours() + 12);

  const { data: day30Leads, error: err30 } = await supabase
    .from("leads")
    .select("id, email, current_rent, proposed_rent, zip, analysis_id")
    .gte("letter_generated_at", day30Start.toISOString())
    .lte("letter_generated_at", day30End.toISOString())
    .is("sent_email_day45", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (err30) console.error("Day 30 query error:", err30);

  for (const lead of day30Leads || []) {
    const normalizedEmail = lead.email.trim().toLowerCase();
    const { data: unsubRows } = await supabase
      .from("leads")
      .select("unsubscribed")
      .eq("email", normalizedEmail)
      .eq("unsubscribed", true)
      .limit(1);
    if (unsubRows && unsubRows.length > 0) continue;

    const affiliateSection = await getAffiliateSection(supabase, lead.analysis_id);
    const affiliateHtml = buildAffiliateSectionHtml(affiliateSection);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "James from RenewalReply <noreply@renewalreply.com>",
          reply_to: "james@renewalreply.com",
          to: [lead.email],
          subject: "How did your renewal turn out?",
          html: buildDay30Html(lead, affiliateHtml),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Day 30 Resend error for ${lead.email}: ${res.status} ${body}`);
        await supabase.from("email_send_attempts").insert({
          lead_id: lead.id,
          email: lead.email,
          template: "letter_followup_day30",
          attempted_at: new Date().toISOString(),
          success: false,
          error_message: `${res.status}: ${body}`,
        });
        continue;
      }

      await res.text();
      await supabase
        .from("leads")
        .update({ sent_email_day45: new Date().toISOString() })
        .eq("id", lead.id);

      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "letter_followup_day30",
        attempted_at: new Date().toISOString(),
        success: true,
      });

      sentDay30++;
    } catch (e) {
      console.error(`Day 30 send failed for ${lead.email}:`, e);
      await supabase.from("email_send_attempts").insert({
        lead_id: lead.id,
        email: lead.email,
        template: "letter_followup_day30",
        attempted_at: new Date().toISOString(),
        success: false,
        error_message: String(e),
      });
    }
  }

  return new Response(JSON.stringify({ sentDay14, sentDay30 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
