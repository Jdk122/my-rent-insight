/**
 * Feature Flags
 *
 * EMAIL_GATE_ENABLED controls whether the email gate blocks access to
 * the full report (comps, evidence, negotiation letter, affiliate CTAs).
 *
 * When false (default): all users see the full report immediately.
 *   Soft inline email capture prompts appear as optional capture points.
 *
 * When true: the current gate behavior is restored exactly as it works today.
 *
 * Toggle via Netlify env var VITE_EMAIL_GATE_ENABLED=true or by changing the fallback.
 */
export const EMAIL_GATE_ENABLED: boolean =
  import.meta.env.VITE_EMAIL_GATE_ENABLED === 'true';

/** Returns 'gated' or 'ungated' for analytics variant tagging */
export const GATE_VARIANT: 'gated' | 'ungated' =
  EMAIL_GATE_ENABLED ? 'gated' : 'ungated';
