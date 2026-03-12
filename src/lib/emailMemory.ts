const STORAGE_KEY = 'rr_captured_email';
const TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface StoredEmail {
  email: string;
  ts: number;
}

/** Retrieve remembered email (returns '' if expired or absent) */
export function getRememberedEmail(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const parsed: StoredEmail = JSON.parse(raw);
    if (Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return '';
    }
    return parsed.email;
  } catch {
    return '';
  }
}

/** Save email with 60-day TTL */
export function rememberEmail(email: string): void {
  try {
    const data: StoredEmail = { email, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable — silent fail
  }
}
