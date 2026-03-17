export interface DealScore {
  verdict: 'good-deal' | 'fair-price' | 'overpriced';
  percentDiff: number;
  explanation: string;
  baselineSource: 'market' | 'hud';
  sortScore: number;
}

/**
 * Score a listing against the local market median or HUD SAFMR fallback.
 *
 * @param rent       – listing asking rent
 * @param bedrooms   – bedroom count (0 = studio, 1, 2, …)
 * @param zip        – listing ZIP code
 * @param marketMap  – ZIP → bedroom → median rent (from Rentcast market data)
 * @param hudMap     – ZIP → number[] (SAFMR by bedroom index)
 */
export function scoreListing(
  rent: number,
  bedrooms: number,
  zip: string,
  marketMap: Record<string, Record<number, number>>,
  hudMap: Record<string, number[]>,
): DealScore | null {
  // Try market median first
  let baseline: number | null = null;
  let source: 'market' | 'hud' = 'market';

  const marketZip = marketMap[zip];
  if (marketZip && marketZip[bedrooms] != null && marketZip[bedrooms] > 0) {
    baseline = marketZip[bedrooms];
  }

  // Fallback to HUD SAFMR
  if (baseline == null) {
    const hudZip = hudMap[zip];
    const idx = Math.min(bedrooms, 4);
    if (hudZip && hudZip[idx] != null && hudZip[idx] > 0) {
      baseline = hudZip[idx];
      source = 'hud';
    }
  }

  if (baseline == null || baseline <= 0) return null;

  const percentDiff = (rent - baseline) / baseline;
  const absPct = Math.abs(Math.round(percentDiff * 100));

  let verdict: DealScore['verdict'];
  if (percentDiff <= -0.10) {
    verdict = 'good-deal';
  } else if (percentDiff <= 0.10) {
    verdict = 'fair-price';
  } else {
    verdict = 'overpriced';
  }

  let explanation: string;
  if (source === 'market') {
    if (verdict === 'good-deal') {
      explanation = `Priced ${absPct}% below market median for this area`;
    } else if (verdict === 'fair-price') {
      explanation = `Priced within ${absPct}% of market median`;
    } else {
      explanation = `Priced ${absPct}% above market median for this area`;
    }
  } else {
    if (verdict === 'good-deal') {
      explanation = `Priced ${absPct}% below HUD Fair Market Rent benchmark`;
    } else if (verdict === 'fair-price') {
      explanation = `Priced near HUD Fair Market Rent for this area`;
    } else {
      explanation = `Priced ${absPct}% above HUD Fair Market Rent benchmark`;
    }
  }

  return { verdict, percentDiff, explanation, baselineSource: source, sortScore: percentDiff };
}
