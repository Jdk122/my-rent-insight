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
  const targetMonth = targetDate.getMonth() + 1;
  const targetYear = targetDate.getFullYear();

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

  const siteUrl = "https://renewalreply.com";
  const bedroomLabelMap: Record<number, string> = {
    0: "studio",
    1: "1-bedroom",
    2: "2-bedroom",
    3: "3-bedroom",
    4: "4-bedroom",
  };

  let sent = 0;

  for (const lead of leads) {
    const bedrooms = lead.bedrooms ?? null;
    const brLabel = bedrooms !== null ? (bedroomLabelMap[bedrooms] || `${bedrooms}-bedroom`) : null;
    const rent = lead.current_rent ? Math.round(lead.current_rent) : null;
    const zipCode = lead.zip || null;
    const address = lead.address || null;

    // Build pre-filled CTA URL with UTM params
    const params = new URLSearchParams();
    params.set("utm_source", "email");
    params.set("utm_medium", "reminder");
    params.set("utm_campaign", "renewal_reminder");
    if (zipCode) params.set("zip", zipCode);
    if (bedrooms !== null) params.set("bedrooms", String(bedrooms));
    if (rent) params.set("rent", String(rent));
    if (address) params.set("address", address);

    const ctaUrl = `${siteUrl}/?${params.toString()}`;

    // Build personal copy
    const location = [lead.city, lead.state].filter(Boolean).join(", ") || "your area";
    let personalLine: string;
    if (brLabel && zipCode && rent) {
      personalLine = `Last year you checked a ${brLabel} in ${zipCode} at $${rent.toLocaleString("en-US")}/month. Your renewal is coming up — enter your new proposed rent to see if it's fair.`;
    } else {
      personalLine = `Your lease in <strong>${location}</strong> is coming up for renewal. Enter your new proposed rent to see if it's fair.`;
    }

    const htmlBody = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <p style="font-size: 20px; font-weight: 700; color: #2d6a4f; margin-bottom: 4px;">
          Renewal<span style="font-weight: 400; color: #c77d3c;">Reply</span>
        </p>
        <h1 style="font-size: 22px; color: #1a1a1a; margin: 24px 0 8px;">Your lease renews in ~60 days</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 28px;">
          ${personalLine}
        </p>
        <a href="${ctaUrl}" style="display: block; text-align: center; background: #2d6a4f; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
          Check my new increase →
        </a>
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