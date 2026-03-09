import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fmt = (n: number | null | undefined) =>
  n != null ? `$${Math.round(n).toLocaleString("en-US")}` : "—";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const contactEmail = Deno.env.get("CONTACT_EMAIL");
  if (!resendKey || !contactEmail) {
    return new Response(
      JSON.stringify({ error: "Missing RESEND_API_KEY or CONTACT_EMAIL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const {
      zip, city, state, bedrooms, current_rent, proposed_rent,
      increase_pct, fairness_score, verdict_label, address,
      confidence_level, comp_median_rent, hud_fmr_value,
    } = body;

    const subject = `🏠 New submission: ${zip || "unknown"} — ${verdict_label || "N/A"} (Score ${fairness_score ?? "?"})`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;color:#1a1a1a">New Rent Check Submission</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">Location</td><td style="padding:6px 0;font-weight:600">${address || "—"}<br/>${city || ""}, ${state || ""} ${zip || ""}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">Bedrooms</td><td style="padding:6px 0;font-weight:600">${bedrooms ?? "—"}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">Current Rent</td><td style="padding:6px 0;font-weight:600">${fmt(current_rent)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">Proposed Rent</td><td style="padding:6px 0;font-weight:600">${fmt(proposed_rent)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">Increase</td><td style="padding:6px 0;font-weight:600">${increase_pct != null ? `${Math.round(increase_pct)}%` : "No increase"}</td></tr>
          <tr style="background:#f8f8f8"><td style="padding:6px 12px 6px 0;color:#666">Fairness Score</td><td style="padding:6px 0;font-weight:700;font-size:16px">${fairness_score ?? "—"}/100</td></tr>
          <tr style="background:#f8f8f8"><td style="padding:6px 12px 6px 0;color:#666">Verdict</td><td style="padding:6px 0;font-weight:700">${verdict_label || "—"}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">HUD FMR</td><td style="padding:6px 0">${fmt(hud_fmr_value)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">Comp Median</td><td style="padding:6px 0">${fmt(comp_median_rent)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">Confidence</td><td style="padding:6px 0">${confidence_level || "—"}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#999">Sent by RenewalReply submission notifier</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RenewalReply <noreply@renewalreply.com>",
        to: [contactEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-submission error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
