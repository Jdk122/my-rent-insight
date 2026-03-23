/**
 * Deal scoring for apartment listings.
 *
 * v1 — simplified median comparison.
 * The full 5-layer Deal Score (value + building + location + momentum +
 * negotiability) will replace this in v2.
 */

export interface DealScoreResult {
  score: number;
  verdict: 'great' | 'good' | null;
  savingsPerMonth: number;
  savingsPct: number;
}

/**
 * Score a listing's asking rent against the bedroom-level market median.
 *
 * Formula: score = 50 + (pctBelow × 2), clamped 0-100
 *   – 20% below median → score ≈ 90
 *   – 12.5% below median → score ≈ 75 (minimum to display)
 *   – At median → score = 50
 */
export function scoreListing(rent: number, median: number): DealScoreResult {
  if (!median || median <= 0 || rent <= 0) {
    return { score: 0, verdict: null, savingsPerMonth: 0, savingsPct: 0 };
  }

  const pctBelow = ((median - rent) / median) * 100;
  const raw = Math.round(50 + pctBelow * 2);
  const score = Math.max(0, Math.min(100, raw));

  const savingsPerMonth = Math.max(0, Math.round(median - rent));
  const savingsPct = Math.round(pctBelow);

  if (score >= 80) return { score, verdict: 'great', savingsPerMonth, savingsPct };
  if (score >= 75) return { score, verdict: 'good', savingsPerMonth, savingsPct };
  return { score, verdict: null, savingsPerMonth, savingsPct };
}

/** Build a Zillow search URL from a formatted address */
export function zillowUrl(address: string, zip = '10003'): string {
  const slug = address
    .replace(/[,#]/g, '')
    .replace(/\s+/g, '-');
  return `https://www.zillow.com/homes/${slug}-New-York-NY-${zip}_rb/`;
}
