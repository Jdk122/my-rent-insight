/**
 * Analysis deduplication utility.
 *
 * Treats an analysis as a duplicate if the same normalized key
 * (address + bedrooms + rent + tool) was submitted within
 * DEDUP_WINDOW_MS in the current session.
 *
 * Returns { isDuplicate: false, analysisId } for new analyses,
 * or { isDuplicate: true, analysisId } reusing the prior ID.
 */

const DEDUP_PREFIX = 'rr_dedup:';
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

interface DedupEntry {
  analysisId: string;
  timestamp: number;
}

function buildKey(
  address: string | null,
  zip: string,
  bedrooms: number,
  currentRent: number,
  tool: 'renewal' | 'wsip',
): string {
  const norm = (address || zip).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${DEDUP_PREFIX}${tool}:${norm}:${bedrooms}:${currentRent}`;
}

export function checkAnalysisDedup(
  address: string | null,
  zip: string,
  bedrooms: number,
  currentRent: number,
  tool: 'renewal' | 'wsip',
): { isDuplicate: boolean; analysisId: string } {
  if (typeof window === 'undefined') {
    return { isDuplicate: false, analysisId: crypto.randomUUID() };
  }

  const key = buildKey(address, zip, bedrooms, currentRent, tool);

  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      const entry: DedupEntry = JSON.parse(stored);
      if (Date.now() - entry.timestamp < DEDUP_WINDOW_MS) {
        return { isDuplicate: true, analysisId: entry.analysisId };
      }
    }
  } catch {
    // Corrupted entry — fall through to new
  }

  const analysisId = crypto.randomUUID();
  try {
    sessionStorage.setItem(key, JSON.stringify({ analysisId, timestamp: Date.now() } satisfies DedupEntry));
  } catch {
    // Storage full — proceed without caching
  }

  return { isDuplicate: false, analysisId };
}
