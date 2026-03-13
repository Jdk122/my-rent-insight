/**
 * Returns a stable session ID for the current browser session.
 * Persists in sessionStorage so it survives in-page navigation
 * but resets when the tab/window is closed.
 */
const SESSION_KEY = 'rr_session_id';

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
