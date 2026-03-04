import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const fmt = (n: number | null) => (n != null ? `$${Math.round(n).toLocaleString("en-US")}` : "your rent");

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
  let sentDay7 = 0;
  let sentDay45 = 0;

  // ── Day 7 emails ──
  const day7Target = new Date(now);
  day7Target.setDate(day7Target.getDate() - 7);
  const day7Start = new Date(day7Target);
  day7Start.setHours(day7Start.getHours() - 12);
  const day7End = new Date(day7Target);
  day7End.setHours(day7End.getHours() + 12);

  const { data: day7Leads, error: err7 } = await supabase
    .from("leads")
    .select("id, email, current_rent, proposed_rent, zip, fairness_score")
    .gte("letter_generated_at", day7Start.toISOString())
    .lte("letter_generated_at", day7End.toISOString())
    .is("followup_sent_at", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (err7) console.error("Day 7 query error:", err7);

  for (const lead of day7Leads || []) {
    const unsubUrl = `https://my-rent-insight.lovable.app/outcome?id=${lead.id}&outcome=unsubscribe`;
    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <p style="font-size: 20px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px;">
          Renewal<span style="font-weight: 400; color: #c77d3c;">Reply</span>
        </p>
        <h1 style="font-size: 20px; color: #1a1a1a; margin: 24px 0 12px;">Did you send your negotiation letter?</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.7;">
          Hi — a week ago you generated a negotiation letter for your rent increase from
          ${fmt(lead.current_rent)} to ${fmt(lead.proposed_rent)} in ${lead.zip || "your area"}.
          Your Fairness Score was <strong>${lead.fairness_score ?? "—"}/100</strong>.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin-top: 16px;">
          Have you sent it to your landlord yet? If you want to adjust anything or need tips
          on how to deliver it, just reply to this email. We're here to help.
        </p>
        <p style="font-size: 15px; color: #555; margin-top: 24px;">— RenewalReply</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="font-size: 11px; color: #999; text-align: center;">
          You received this because you generated a negotiation letter on RenewalReply.<br/>
          <a href="${unsubUrl}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "RenewalReply <noreply@renewalreply.com>",
          reply_to: "social@renewalreply.com",
          to: [lead.email],
          subject: "Did you send your negotiation letter?",
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Day 7 Resend error for ${lead.email}: ${res.status} ${body}`);
        continue;
      }

      await supabase
        .from("leads")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      sentDay7++;
    } catch (e) {
      console.error(`Day 7 send failed for ${lead.email}:`, e);
    }
  }

  // ── Day 45 emails ──
  const day45Target = new Date(now);
  day45Target.setDate(day45Target.getDate() - 45);
  const day45Start = new Date(day45Target);
  day45Start.setHours(day45Start.getHours() - 12);
  const day45End = new Date(day45Target);
  day45End.setHours(day45End.getHours() + 12);

  const { data: day45Leads, error: err45 } = await supabase
    .from("leads")
    .select("id, email, current_rent, proposed_rent, zip")
    .gte("letter_generated_at", day45Start.toISOString())
    .lte("letter_generated_at", day45End.toISOString())
    .is("sent_email_day45", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (err45) console.error("Day 45 query error:", err45);

  for (const lead of day45Leads || []) {
    const unsubUrl = `https://my-rent-insight.lovable.app/outcome?id=${lead.id}&outcome=unsubscribe`;
    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <p style="font-size: 20px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px;">
          Renewal<span style="font-weight: 400; color: #c77d3c;">Reply</span>
        </p>
        <h1 style="font-size: 20px; color: #1a1a1a; margin: 24px 0 12px;">How did your rent negotiation go?</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.7;">
          Hi — about 6 weeks ago you used RenewalReply to check a rent increase from
          ${fmt(lead.current_rent)} to ${fmt(lead.proposed_rent)} in ${lead.zip || "your area"}.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin-top: 16px;">
          We'd love to know how it turned out. Did you negotiate a lower increase? Stay at
          the same rent? Or decide to move? Just reply and let us know — your experience
          helps us improve the tool for other renters.
        </p>
        <p style="font-size: 15px; color: #555; margin-top: 24px;">— RenewalReply</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="font-size: 11px; color: #999; text-align: center;">
          You received this because you used RenewalReply.<br/>
          <a href="${unsubUrl}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "RenewalReply <noreply@renewalreply.com>",
          reply_to: "social@renewalreply.com",
          to: [lead.email],
          subject: "How did your rent negotiation go?",
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Day 45 Resend error for ${lead.email}: ${res.status} ${body}`);
        continue;
      }

      await supabase
        .from("leads")
        .update({ sent_email_day45: new Date().toISOString() })
        .eq("id", lead.id);

      sentDay45++;
    } catch (e) {
      console.error(`Day 45 send failed for ${lead.email}:`, e);
    }
  }

  return new Response(JSON.stringify({ sentDay7, sentDay45 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
