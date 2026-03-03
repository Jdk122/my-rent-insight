// Capture UTM parameters from URL on first load and persist in sessionStorage.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
const STORAGE_KEY = 'rr_utm';

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
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
