import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  // Find leads where letter was generated ~7 days ago, followup not yet sent
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const windowStart = new Date(sevenDaysAgo);
  windowStart.setHours(windowStart.getHours() - 12);
  const windowEnd = new Date(sevenDaysAgo);
  windowEnd.setHours(windowEnd.getHours() + 12);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email")
    .gte("letter_generated_at", windowStart.toISOString())
    .lte("letter_generated_at", windowEnd.toISOString())
    .is("followup_sent_at", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (error) {
    console.error("Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!leads || leads.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const siteUrl = "https://my-rent-insight.lovable.app";
  let sent = 0;

  for (const lead of leads) {
    const agreedUrl = `${siteUrl}/outcome?id=${lead.id}&outcome=agreed`;
    const counteredUrl = `${siteUrl}/outcome?id=${lead.id}&outcome=countered`;
    const noResponseUrl = `${siteUrl}/outcome?id=${lead.id}&outcome=no_response`;

    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <p style="font-size: 20px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px;">
          Renewal<span style="font-weight: 400; color: #c77d3c;">Reply</span>
        </p>
        <h1 style="font-size: 22px; color: #1a1a1a; margin: 24px 0 8px;">Did your landlord respond?</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 28px;">
          You sent your rent negotiation letter a week ago. How did it go?
        </p>
        <div style="margin-bottom: 32px;">
          <a href="${agreedUrl}" style="display: block; text-align: center; background: #2d6a4f; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 10px;">
            ✅ They agreed to lower it
          </a>
          <a href="${counteredUrl}" style="display: block; text-align: center; background: #f5f0eb; color: #1a1a1a; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 10px; border: 1px solid #e0d8cf;">
            ↔️ They countered
          </a>
          <a href="${noResponseUrl}" style="display: block; text-align: center; background: #f5f0eb; color: #1a1a1a; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; border: 1px solid #e0d8cf;">
            ❌ No response yet
          </a>
        </div>
        <p style="font-size: 12px; color: #999; text-align: center;">
          RenewalReply · You received this because you generated a negotiation letter.
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
          to: [lead.email],
          subject: "Did your landlord respond?",
          html: htmlBody,
        }),
      });

      const resBody = await res.text();
      if (!res.ok) {
        console.error(`Resend error for ${lead.email}: ${res.status} ${resBody}`);
        continue;
      }

      // Mark as sent
      await supabase
        .from("leads")
        .update({ followup_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      sent++;
    } catch (e) {
      console.error(`Failed to send to ${lead.email}:`, e);
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
