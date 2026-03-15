import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const fmt = (n: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString("en-US")}` : "—";

const BASE_URL = "https://renewalreply.com";
const WORDMARK = `${BASE_URL}/renewalreply-wordmark.png`;

const emailHeader = `
  <img src="${WORDMARK}" alt="RenewalReply" width="140" style="display:block;margin:0 0 16px;" />
  <div style="height:2px;background:#168eca;margin:0 0 24px;"></div>
`;

function buildWsipFollowupHtml(lead: any) {
  const unsubUrl = `${BASE_URL}/outcome?id=${lead.id}&result=unsubscribe`;
  const wsipUrl = `${BASE_URL}/what-should-i-pay`;

  const cityLabel = lead.city && lead.state
    ? `${lead.city}, ${lead.state}`
    : lead.zip
      ? `ZIP ${lead.zip}`
      : "your area";

  const rentLine = lead.current_rent
    ? `You were looking at a listing for ${fmt(lead.current_rent)}/mo`
    : "You recently searched for fair rent pricing";

  const medianLine = lead.comp_median_rent
    ? `<p style="font-size:15px;color:#555;line-height:1.7;margin:16px 0;">
        The comp median in ${cityLabel} was <strong>${fmt(lead.comp_median_rent)}/mo</strong> at the time.
        Market conditions shift — it's worth checking again if you're still searching.
      </p>`
    : "";

  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      ${emailHeader}
      <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#1b1f27;margin:0 0 12px;">Still apartment hunting in ${cityLabel}?</h1>
      <p style="font-size:15px;color:#555;line-height:1.7;">
        Hi — a few days ago you used our "What Should I Pay?" tool to check fair pricing in ${cityLabel}.
        ${rentLine}.
      </p>
      ${medianLine}
      <p style="font-size:15px;color:#555;line-height:1.7;margin:16px 0 24px;">
        Prices and availability change fast. Run a fresh search to see what's fair right now:
      </p>
      <a href="${wsipUrl}" style="display:inline-block;padding:14px 24px;background:#168eca;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
        Check current fair rent →
      </a>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#555;margin-top:28px;">— RenewalReply</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:11px;color:#999;text-align:center;">
        You received this because you used the What Should I Pay tool on RenewalReply.<br/>
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
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  let sent = 0;

  const target = new Date(now);
  target.setDate(target.getDate() - 5);
  const windowStart = new Date(target);
  windowStart.setHours(windowStart.getHours() - 12);
  const windowEnd = new Date(target);
  windowEnd.setHours(windowEnd.getHours() + 12);

  const { data: wsipLeads, error } = await supabase
    .from("leads")
    .select("id, email, current_rent, proposed_rent, city, state, zip, comp_median_rent, verdict, tool_type")
    .eq("tool_type", "wsip")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString())
    .is("followup_sent_at", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (error) console.error("WSIP followup query error:", error);

  for (const lead of wsipLeads || []) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "RenewalReply <noreply@renewalreply.com>",
          reply_to: "james@renewalreply.com",
          to: [lead.email],
          subject: `Still looking in ${lead.city || lead.zip || "your area"}?`,
          html: buildWsipFollowupHtml(lead),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`WSIP followup Resend error for ${lead.email}: ${res.status} ${body}`);
        continue;
      }

      await supabase
        .from("leads")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      sent++;
    } catch (e) {
      console.error(`WSIP followup send failed for ${lead.email}:`, e);
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
