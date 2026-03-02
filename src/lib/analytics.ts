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
  | 'share_clicked'
  | 'comp_link_clicked'
  | 'dhcr_match_found'
  | 'address_entered'
  | 'letter_tone_toggled'
  | 'lease_reminder_signup'
  | 'results_scrolled_to_section'
  | 'time_on_results';

export function trackEvent(name: string, params?: Record<string, string | number | boolean | null | undefined>) {
  try {
    window.gtag?.('event', name, params);
  } catch {
    // silent
  }
}
