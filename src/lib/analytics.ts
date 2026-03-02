// GA4 custom event helper
// All events are fire-and-forget; never block UX.

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

type EventName =
  | 'form_submitted'
  | 'results_viewed'
  | 'letter_generated'
  | 'email_captured'
  | 'share_clicked'
  | 'comp_link_clicked'
  | 'dhcr_match_found';

export function trackEvent(name: EventName, params?: Record<string, string | number | boolean | null | undefined>) {
  try {
    window.gtag?.('event', name, params);
  } catch {
    // silent
  }
}
