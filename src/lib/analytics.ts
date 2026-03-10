// GA4 custom event helper
// All events are fire-and-forget; never block UX.

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export type EventName =
  | 'form_submitted'
  | 'results_viewed'
  | 'letter_generated'
  | 'email_captured'
  | 'email_submitted'
  | 'share_clicked'
  | 'comp_link_clicked'
  | 'dhcr_match_found'
  | 'address_entered'
  | 'letter_tone_toggled'
  | 'lease_reminder_signup'
  | 'results_scrolled_to_section'
  | 'time_on_results'
  | 'report_shared'
  | 'report_viewed'
  | 'score_details_expanded'
  | 'report_link_generated'
  | 'user_property_type'
  | 'letter_copied'
  | 'comp_gate_shown'
  | 'comp_gate_converted'
  | 'report_gate_shown'
  | 'report_gate_converted'
  | 'exit_intent_shown'
  | 'exit_intent_converted'
  | 'exit_intent_dismissed'
  | 'letter_blur_shown'
  | 'post_conversion_lease_saved'
  | 'wsip_form_submitted'
  | 'wsip_results_viewed'
  | 'wsip_comp_gate_shown'
  | 'wsip_comp_gate_converted'
  | 'wsip_tips_unlocked'
  | 'wsip_exit_intent_shown'
  | 'wsip_exit_intent_converted'
  | 'wsip_exit_intent_dismissed';

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
export function trackAdsConversion() {
  try {
    window.gtag?.('event', 'conversion', {
      send_to: 'AW-17990530610/H5tjCKStoIIcELLsxoJD',
      value: 1.0,
      currency: 'USD',
    });
  } catch {
    // silent
  }
  try {
    (window as any).uetq?.push('event', 'lead_capture', {});
  } catch {
    // silent
  }
}
