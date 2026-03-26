// GA4 custom event helper
// All events are fire-and-forget; never block UX.

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export type EventName =
  | 'analysis_started'
  | 'analysis_completed'
  | 'gate_viewed'
  | 'email_captured'
  | 'letter_used'
  | 'report_shared'
  | 'referral_clicked'
  | 'prompt_shown'
  | 'prompt_dismissed'
  | 'lease_info_saved'
  | 'report_viewed'
  | 'page_not_found'
  | 'followup_unsubscribe'
  | 'followup_agreed_testimonial'
  | 'followup_countered_amount'
  | 'followup_moving_submitted'
  | 'results_cta_clicked'
  | 'report_unlocked'
  | 'intent_selected'
  | 'affiliate_impression'
  | 'affiliate_click'
  | 'internal_click'
  | 'listing_clicked';

export function trackEvent(name: string, params?: Record<string, string | number | boolean | null | undefined>) {
  try {
    if (import.meta.env.DEV) {
      console.log(`[analytics] ${name}`, params ?? '');
    }
    window.gtag?.('event', name, params);
  } catch {
    // silent
  }
}

/** Fire Google Ads lead-form conversion + Microsoft UET lead event */
export function trackAdsConversion(
  toolType: 'renewal' | 'wsip' = 'renewal',
  userEmail?: string,
) {
  // DEBUG — remove after confirming conversions record
  console.log('[ads-debug] trackAdsConversion called', { toolType, userEmail: userEmail ? '***' : undefined, gtagExists: typeof window.gtag === 'function' });

  try {
    // Enhanced Conversions — send hashed email
    if (userEmail) {
      window.gtag?.('set', 'user_data', {
        email: userEmail,
      });
    }

    // Tool-specific conversion action (both tools use same conversion label)
    const conversionLabel = 'AW-17990530610/3GPLCIyp14YcELLsxoJD';

    window.gtag?.('event', 'conversion', {
      send_to: conversionLabel,
      value: 1.0,
      currency: 'USD',
    });
    console.log('[ads-debug] conversion event queued', { conversionLabel });
  } catch (err) {
    console.warn('[ads-debug] conversion error', err);
  }
  try {
    (window as any).uetq?.push('event', 'lead_capture', {
      event_category: toolType,
    });
  } catch {
    // silent
  }
}
