// Capture UTM parameters from URL on first load and persist in sessionStorage.
// Also detects Google Ads (gclid) and Microsoft Ads (msclkid) auto-tags.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const STORAGE_KEY = 'rr_utm';

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export function captureUtmParams(): void {
  // Only capture once per session
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  let hasAny = false;

  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) {
      utm[key] = val;
      hasAny = true;
    }
  }

  // Detect Google Ads auto-tagging (gclid) when no UTM source is set
  if (!utm.utm_source && params.get('gclid')) {
    utm.utm_source = 'google';
    utm.utm_medium = utm.utm_medium || 'cpc';
    utm.utm_campaign = utm.utm_campaign || 'google_ads';
    hasAny = true;
  }

  // Detect Microsoft Ads auto-tagging (msclkid) when no UTM source is set
  if (!utm.utm_source && params.get('msclkid')) {
    utm.utm_source = 'bing';
    utm.utm_medium = utm.utm_medium || 'cpc';
    utm.utm_campaign = utm.utm_campaign || 'microsoft_ads';
    hasAny = true;
  }

  // Detect referrer-based attribution when no params are present
  if (!hasAny && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      const host = ref.hostname.replace('www.', '');
      if (host.includes('google.')) {
        utm.utm_source = 'google';
        utm.utm_medium = 'organic';
        hasAny = true;
      } else if (host.includes('bing.') || host.includes('msn.')) {
        utm.utm_source = 'bing';
        utm.utm_medium = 'organic';
        hasAny = true;
      } else if (host.includes('facebook.') || host.includes('fb.')) {
        utm.utm_source = 'facebook';
        utm.utm_medium = 'social';
        hasAny = true;
      } else if (host.includes('reddit.')) {
        utm.utm_source = 'reddit';
        utm.utm_medium = 'social';
        hasAny = true;
      } else if (host.includes('twitter.') || host.includes('t.co') || host.includes('x.com')) {
        utm.utm_source = 'twitter';
        utm.utm_medium = 'social';
        hasAny = true;
      } else if (!host.includes('renewalreply.com') && !host.includes('lovable.app')) {
        utm.utm_source = host;
        utm.utm_medium = 'referral';
        hasAny = true;
      }
    } catch {
      // invalid referrer URL, skip
    }
  }

  // Store even if empty so we don't re-check
  sessionStorage.setItem(STORAGE_KEY, hasAny ? JSON.stringify(utm) : '{}');
}

export function getUtmParams(): UtmParams {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
