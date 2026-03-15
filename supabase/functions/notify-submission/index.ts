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
      analysis_id, email: directEmail,
    } = body;

    // Use directly provided email first, then look up by analysis_id or zip
    let leadEmail: string | null = directEmail || null;
    let totalLeads: number | null = null;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      if (!leadEmail && analysis_id) {
        const { data: leadRow } = await sb
          .from("leads")
          .select("email")
          .eq("analysis_id", analysis_id)
          .limit(1)
          .single();
        if (leadRow?.email) leadEmail = leadRow.email;
      }

      // If no direct match, check if there's a recent lead for this zip
      if (!leadEmail && zip) {
        const { data: recentLead } = await sb
          .from("leads")
          .select("email")
          .eq("zip", zip)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (recentLead?.email) leadEmail = recentLead.email;
      }

      // SAFETY NET: If we have a captured email, ensure lead + event exist in DB
      // This catches cases where client-side inserts failed silently
      if (directEmail) {
        const normalizedEmail = directEmail.trim().toLowerCase();
        try {
          await sb.rpc('upsert_lead', {
            p_email: normalizedEmail,
            p_analysis_id: analysis_id || null,
            p_capture_source: 'notify_safety_net',
            p_address: address || null,
            p_city: city || null,
            p_state: state || null,
            p_zip: zip || null,
            p_bedrooms: bedrooms ?? null,
            p_current_rent: current_rent ?? null,
            p_proposed_rent: proposed_rent ?? null,
            p_increase_pct: increase_pct ?? null,
            p_verdict: verdict_label || null,
            p_fairness_score: fairness_score ?? null,
            p_comp_median_rent: comp_median_rent ?? null,
            p_hud_fmr_value: hud_fmr_value ?? null,
            p_tool_type: body.tool_type || 'renewal',
          });
          console.log('[notify-submission] Safety net: upserted lead for', normalizedEmail);
        } catch (leadErr) {
          // Retry without analysis_id on FK violation
          try {
            await sb.rpc('upsert_lead', {
              p_email: normalizedEmail,
              p_analysis_id: null,
              p_capture_source: 'notify_safety_net',
              p_address: address || null,
              p_city: city || null,
              p_state: state || null,
              p_zip: zip || null,
              p_bedrooms: bedrooms ?? null,
              p_current_rent: current_rent ?? null,
              p_proposed_rent: proposed_rent ?? null,
              p_increase_pct: increase_pct ?? null,
              p_verdict: verdict_label || null,
              p_fairness_score: fairness_score ?? null,
              p_comp_median_rent: comp_median_rent ?? null,
              p_hud_fmr_value: hud_fmr_value ?? null,
              p_tool_type: body.tool_type || 'renewal',
            });
            console.log('[notify-submission] Safety net: upserted lead (no analysis_id) for', normalizedEmail);
          } catch (retryErr) {
            console.error('[notify-submission] Safety net lead upsert failed:', retryErr);
          }
        }

        // Also ensure lead_event exists
        try {
          await sb.from('lead_events').insert({
            email: normalizedEmail,
            analysis_id: analysis_id || null,
            event_type: 'notify_safety_net',
            fairness_score: fairness_score ?? null,
            address: address || null,
            zip: zip || null,
            current_rent: current_rent ?? null,
            proposed_rent: proposed_rent ?? null,
            increase_pct: increase_pct ?? null,
            verdict: verdict_label || null,
            comp_median_rent: comp_median_rent ?? null,
            hud_fmr_value: hud_fmr_value ?? null,
          });
        } catch { /* non-critical */ }
      }

      // Get total lead count
      const { count } = await sb
        .from("leads")
        .select("*", { count: "exact", head: true });
      totalLeads = count;
    } catch (dbErr) {
      console.error('[notify-submission] DB operations error:', dbErr);
    }

    const emailBadge = leadEmail
      ? `<tr style="background:#e6f9e6"><td style="padding:6px 12px 6px 0;color:#1a7a1a;font-weight:600">📧 Email Captured</td><td style="padding:6px 0;font-weight:700;color:#1a7a1a">${leadEmail}</td></tr>`
      : `<tr style="background:#fff3e0"><td style="padding:6px 12px 6px 0;color:#b36b00;font-weight:600">📧 Email Captured</td><td style="padding:6px 0;font-weight:600;color:#b36b00">No — anonymous submission</td></tr>`;

    const leadCountNote = totalLeads != null
      ? `<p style="margin-top:12px;font-size:12px;color:#666">Total leads in database: <strong>${totalLeads}</strong></p>`
      : "";

    const isEmailCapture = !!directEmail;
    const subject = leadEmail
      ? `🏠 ${isEmailCapture ? '✉️ EMAIL CAPTURED' : 'New submission'}: ${zip || "unknown"} — ${verdict_label || "N/A"} (Score ${fairness_score ?? "?"}) ✉️ ${leadEmail}`
      : `🏠 New submission: ${zip || "unknown"} — ${verdict_label || "N/A"} (Score ${fairness_score ?? "?"})`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;color:#1a1a1a">New Rent Check Submission</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${emailBadge}
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
        ${leadCountNote}
        <p style="margin-top:12px;font-size:12px;color:#999">Sent by RenewalReply submission notifier</p>
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
