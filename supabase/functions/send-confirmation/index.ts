import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://renewalreply.com";
const WORDMARK = `${BASE_URL}/renewalreply-wordmark.png`;

const emailHeader = `
  <img src="${WORDMARK}" alt="RenewalReply" width="150" style="display:block;margin:0 0 24px" />
`;

function emailFooter(cityLabel: string, unsubUrl: string) {
  const unsubLine = unsubUrl
    ? `<a href="${unsubUrl}" style="color:#999;text-decoration:underline">Unsubscribe</a>`
    : "";
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px" />
    <p style="font-size:11px;color:#999;line-height:1.6;margin:0;text-align:center;">
      RenewalReply | PacketOps LLC<br/>
      971 US Highway 202N, Suite N, Branchburg, NJ 08876<br/><br/>
      You received this because you used the RenewalReply rent analysis tool for ${cityLabel}.${unsubLine ? `<br/>${unsubLine}` : ""}
    </p>
  `;
}

// ─── Verdict classification (single source of truth) ───

interface VerdictClass {
  isAboveMarket: boolean;
  isGoodDeal: boolean;
  isFair: boolean;
}

function classifyVerdict(fairnessScore: number | null, verdictLabel: string | null): VerdictClass {
  const label = (verdictLabel || "").toLowerCase();

  const isAboveMarket =
    (typeof fairnessScore === "number" && fairnessScore < 60) ||
    label.includes("above market") ||
    label.includes("overpriced") ||
    label.includes("high") ||
    label.includes("unfair") ||
    label.includes("excessive");

  const isGoodDeal =
    !isAboveMarket && (
      label.includes("good deal") ||
      label.includes("below market") ||
      label.includes("great") ||
      (typeof fairnessScore === "number" && fairnessScore >= 80)
    );

  return {
    isAboveMarket,
    isGoodDeal,
    isFair: !isAboveMarket && !isGoodDeal,
  };
}

// ─── Renewal email variants ───

interface EmailVariant {
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  cta: string;
}

function getRenewalVariant(data: any, cityLabel: string): EmailVariant {
  const v = classifyVerdict(data.fairness_score, data.verdict_label);

  if (v.isAboveMarket) {
    return {
      subject: `Your rent increase looks above market`,
      preheader: "We pulled the comps. Here's what we found.",
      headline: "This increase looks above market",
      body: `We pulled the comps for ${cityLabel}. Your increase is higher than what similar apartments are renting for right now. Your report has the data, the fair range, and a negotiation letter you can send before your landlord's deadline.`,
      cta: "See the comps and letter →",
    };
  }

  if (v.isGoodDeal) {
    return {
      subject: `Your renewal looks below market`,
      preheader: "Good news — the comps back you up.",
      headline: "This renewal looks below market",
      body: `Good news on your ${cityLabel} renewal. This increase is actually below what similar apartments are renting for. Your report has the numbers so you can see for yourself.`,
      cta: "See the comps and fair range →",
    };
  }

  return {
    subject: `Your renewal looks in line with the market`,
    preheader: "Here's where you stand before you reply.",
    headline: "This renewal looks in line with the market",
    body: `Here's where your ${cityLabel} renewal stands. Your increase is in line with what similar apartments are going for. Your report shows the comps and fair range so you can decide whether to push back or sign.`,
    cta: "See the comps and fair range →",
  };
}

// ─── WSIP email variant ───

function getWsipVariant(data: any, cityLabel: string): EmailVariant {
  const v = classifyVerdict(data.fairness_score, data.verdict_label);

  if (v.isAboveMarket) {
    return {
      subject: `This listing looks overpriced`,
      preheader: "The asking rent on this one is high.",
      headline: "This listing is priced above market",
      body: `We checked the comps for this ${cityLabel} listing. The asking price is higher than what similar apartments are going for. Your report has the fair range and the data behind it.`,
      cta: "See the comps and fair range →",
    };
  }

  return {
    subject: `Your fair rent range is ready`,
    preheader: `Here's what the comps say about ${cityLabel}.`,
    headline: "Your market report is ready",
    body: `We ran the numbers for ${cityLabel}. Your report has the fair rent range and the comparable listings behind it so you can see if the price makes sense.`,
    cta: "See the comps and fair range →",
  };
}

// ─── HTML builders ───

function buildRenewalHtml(data: any, unsubUrl: string) {
  const { city, state, zip, fairness_score, verdict_label, report_url } = data;
  const cityLabel = city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";
  const reportUrl = report_url || `${BASE_URL}/rent/${zip || ""}`;

  const variant = getRenewalVariant(data, cityLabel);

  const scoreLine = fairness_score != null
    ? `<p style="font-size:14px;color:#1a1a1a;margin:0 0 20px;font-weight:600">Fairness Score: ${fairness_score}/100${verdict_label ? ` — ${verdict_label}` : ""}</p>`
    : "";

  const persistentNote = report_url
    ? `<p style="font-size:12px;color:#888;margin:20px 0 0">Bookmark this — your report is saved and you can come back to it anytime.</p>`
    : "";

  return `
    <div style="font-family:'Georgia',serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fffaf5">
      <div style="display:none;max-height:0;overflow:hidden">${variant.preheader}</div>
      ${emailHeader}
      <h1 style="font-family:'Georgia',serif;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 16px;line-height:1.3">
        ${variant.headline}
      </h1>
      ${scoreLine}
      <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">
        ${variant.body}
      </p>
      <a href="${reportUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">
        ${variant.cta}
      </a>
      ${persistentNote}
      ${emailFooter(cityLabel, unsubUrl)}
    </div>
  `;
}

function buildWsipHtml(data: any, unsubUrl: string) {
  const { city, state, zip, report_url } = data;
  const cityLabel = city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";
  const reportUrl = report_url || `${BASE_URL}/what-should-i-pay`;

  const variant = getWsipVariant(data, cityLabel);

  const persistentNote = report_url
    ? `<p style="font-size:12px;color:#888;margin:20px 0 0">Bookmark this — your report is saved and you can come back to it anytime.</p>`
    : "";

  return `
    <div style="font-family:'Georgia',serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fffaf5">
      <div style="display:none;max-height:0;overflow:hidden">${variant.preheader}</div>
      ${emailHeader}
      <h1 style="font-family:'Georgia',serif;font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 16px;line-height:1.3">
        ${variant.headline}
      </h1>
      <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">
        ${variant.body}
      </p>
      <a href="${reportUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">
        ${variant.cta}
      </a>
      ${persistentNote}
      ${emailFooter(cityLabel, unsubUrl)}
    </div>
  `;
}

// ─── GA4 server event ───

async function fireGA4ServerEvent(
  email: string,
  toolType: string,
  zip: string | null,
  verdict: string | null,
) {
  const measurementId = Deno.env.get("GA4_MEASUREMENT_ID");
  const apiSecret = Deno.env.get("GA4_API_SECRET");
  if (!measurementId || !apiSecret) return;
  try {
    const normalized = email.trim().toLowerCase();
    const encoded = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const clientId = `server.${hashHex.slice(0, 16)}`;
    const payload = {
      client_id: clientId,
      user_data: { sha256_email_address: [hashHex] },
      events: [{
        name: "generate_lead",
        params: {
          currency: "USD", value: 1.0,
          tool_type: toolType || "renewal",
          zip_code: zip || "", verdict: verdict || "",
          engagement_time_msec: 1,
          session_id: Date.now().toString(),
        },
      }],
    };
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`[ga4-mp] Unexpected status ${res.status}`);
  } catch (err) {
    console.error("[ga4-mp] Server event error:", err);
  }
}

// ─── Main handler ───

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const ip = getClientIp(req);
  const fnName = "send-confirmation";
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count: recentCount } = await supabase
    .from("function_request_log")
    .select("*", { count: "exact", head: true })
    .eq("function_name", fnName)
    .eq("ip_address", ip)
    .gte("created_at", fiveMinAgo);

  if ((recentCount ?? 0) >= 10) {
    await supabase.from("function_request_log").insert({
      function_name: fnName, ip_address: ip, success: false, response_status: 429,
    });
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: logRow } = await supabase
    .from("function_request_log")
    .insert({ function_name: fnName, ip_address: ip })
    .select("id")
    .single();
  const logId = logRow?.id;

  let responseStatus = 500;
  let success = false;

  try {
    const data = await req.json();
    const { email, city, state, zip, tool_type, fairness_score, verdict_label, report_url } = data;

    if (!email) {
      responseStatus = 400;
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: unsubCheck } = await supabase
      .from("leads")
      .select("unsubscribed")
      .eq("email", normalizedEmail)
      .eq("unsubscribed", true)
      .limit(1);

    if (unsubCheck && unsubCheck.length > 0) {
      responseStatus = 200;
      success = true;
      return new Response(JSON.stringify({ sent: false, reason: "unsubscribed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: leadRow } = await supabase
      .from("leads")
      .select("id")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const leadId = leadRow?.id || "";
    const unsubUrl = leadId
      ? `${BASE_URL}/outcome?result=unsubscribe&id=${leadId}`
      : "";

    const isWsip = tool_type === "wsip";
    const cityLabel = city && state ? `${city}, ${state}` : zip ? `ZIP ${zip}` : "your area";

    const html = isWsip ? buildWsipHtml(data, unsubUrl) : buildRenewalHtml(data, unsubUrl);

    const subject = isWsip
      ? getWsipVariant(data, cityLabel).subject
      : getRenewalVariant(data, cityLabel).subject;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RenewalReply <noreply@renewalreply.com>",
        reply_to: "james@renewalreply.com",
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Confirmation email Resend error for ${email}: ${res.status} ${body}`);
      responseStatus = 500;
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: body }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    fireGA4ServerEvent(
      email,
      tool_type === "wsip" ? "wsip" : "renewal",
      zip || null,
      verdict_label || null,
    ).catch((err) => console.error("[ga4-mp] background error:", err));

    responseStatus = 200;
    success = true;
    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-confirmation error:", e);
    responseStatus = 500;
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (logId) {
      await supabase
        .from("function_request_log")
        .update({ success, response_status: responseStatus })
        .eq("id", logId);
    }
  }
});