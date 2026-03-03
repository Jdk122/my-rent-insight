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

  // Calculate the target date ~60 days from now
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + 60);
  const targetMonth = targetDate.getMonth() + 1; // 1-indexed
  const targetYear = targetDate.getFullYear();

  // Find leads whose lease expires in the target month/year,
  // who haven't been sent a reminder yet, and haven't unsubscribed
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, email, address, city, state, zip, bedrooms, current_rent, lease_expiration_month, lease_expiration_year")
    .eq("lease_expiration_month", targetMonth)
    .eq("lease_expiration_year", targetYear)
    .is("reminder_sent_at", null)
    .or("unsubscribed.is.null,unsubscribed.eq.false");

  if (error) {
    console.error("Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!leads || leads.length === 0) {
    return new Response(JSON.stringify({ sent: 0, targetMonth, targetYear }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const siteUrl = "https://my-rent-insight.lovable.app";
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  let sent = 0;

  for (const lead of leads) {
    const monthName = monthNames[(lead.lease_expiration_month ?? 1) - 1];
    const location = [lead.city, lead.state].filter(Boolean).join(", ") || "your area";

    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <p style="font-size: 20px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px;">
          Renewal<span style="font-weight: 400; color: #c77d3c;">Reply</span>
        </p>
        <h1 style="font-size: 22px; color: #1a1a1a; margin: 24px 0 8px;">Your lease renews in ~60 days</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 8px;">
          Your lease in <strong>${location}</strong> is set to renew in <strong>${monthName} ${lead.lease_expiration_year}</strong>.
          Now is the best time to check if your rent is competitive.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 28px;">
          We've updated our market data — run a fresh analysis to see where you stand before your landlord sends renewal terms.
        </p>
        <a href="${siteUrl}" style="display: block; text-align: center; background: #2d6a4f; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
          Check my rent now →
        </a>
        <div style="background: #f8f6f3; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #666; margin: 0 0 8px; font-weight: 600;">Tips before you renew:</p>
          <ul style="font-size: 13px; color: #666; line-height: 1.8; margin: 0; padding-left: 18px;">
            <li>Run a fresh analysis with your current rent</li>
            <li>Compare to similar units in your ZIP code</li>
            <li>Use the negotiation letter if your rent is above market</li>
          </ul>
        </div>
        <p style="font-size: 12px; color: #999; text-align: center;">
          RenewalReply · You signed up for lease renewal reminders.
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
          subject: `Your lease renews in ~60 days — check your rent`,
          html: htmlBody,
        }),
      });

      const resBody = await res.text();
      if (!res.ok) {
        console.error(`Resend error for ${lead.email}: ${res.status} ${resBody}`);
        continue;
      }

      // Mark reminder as sent
      await supabase
        .from("leads")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", lead.id);

      sent++;
    } catch (e) {
      console.error(`Failed to send to ${lead.email}:`, e);
    }
  }

  return new Response(JSON.stringify({ sent, targetMonth, targetYear }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
