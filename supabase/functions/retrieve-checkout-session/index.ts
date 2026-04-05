import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://www.renewalreply.com",
  "https://renewalreply.com",
  "https://my-rent-insight.lovable.app",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin)) return true;
  if (/^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const email = session.customer_details?.email || session.customer_email || null;
    const metadata = session.metadata || {};
    const paid = session.payment_status === "paid";

    // If we got an email and it's paid, upsert into leads
    if (email && paid) {
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(sbUrl, sbKey);

      try {
        await sb.rpc("upsert_lead", {
          p_email: email.trim().toLowerCase(),
          p_analysis_id: metadata.analysisId || null,
          p_capture_source: "stripe_checkout",
          p_zip: metadata.zip || null,
          p_city: metadata.city || null,
          p_verdict: metadata.verdict || null,
          p_tool_type: "renewal",
        });
        console.log("[retrieve-checkout-session] Upserted lead for", email);
      } catch (err) {
        console.error("[retrieve-checkout-session] Lead upsert failed:", err);
        // Try without analysis_id on FK violation
        try {
          await sb.rpc("upsert_lead", {
            p_email: email.trim().toLowerCase(),
            p_analysis_id: null,
            p_capture_source: "stripe_checkout",
            p_zip: metadata.zip || null,
            p_city: metadata.city || null,
            p_verdict: metadata.verdict || null,
            p_tool_type: "renewal",
          });
        } catch { /* non-critical */ }
      }
    }

    return new Response(
      JSON.stringify({ email, paid, metadata }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("retrieve-checkout-session error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
