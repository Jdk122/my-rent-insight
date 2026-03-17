export interface DealScore {
  verdict: 'good-deal' | 'fair-price' | 'overpriced';
  percentDiff: number;
  explanation: string;
  shortLabel: string;
  baselineSource: 'market' | 'hud';
  sortScore: number;
}

function bedroomLabel(bedrooms: number): string {
  if (bedrooms === 0) return 'studios';
  return `${bedrooms} BRs`;
}

/**
 * Score a listing against the local market median or HUD SAFMR fallback.
 */
export function scoreListing(
  rent: number,
  bedrooms: number,
  zip: string,
  marketMap: Record<string, Record<number, number>>,
  hudMap: Record<string, number[]>,
): DealScore | null {
  let baseline: number | null = null;
  let source: 'market' | 'hud' = 'market';

  const marketZip = marketMap[zip];
  if (marketZip && marketZip[bedrooms] != null && marketZip[bedrooms] > 0) {
    baseline = marketZip[bedrooms];
  }

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
  const brLabel = bedroomLabel(bedrooms);

  let verdict: DealScore['verdict'];
  if (percentDiff <= -0.10) {
    verdict = 'good-deal';
  } else if (percentDiff <= 0.10) {
    verdict = 'fair-price';
  } else {
    verdict = 'overpriced';
  }

  let shortLabel: string;
  if (verdict === 'good-deal') {
    shortLabel = `${absPct}% below market`;
  } else if (verdict === 'fair-price') {
    shortLabel = 'At market';
  } else {
    shortLabel = `${absPct}% above market`;
  }

  const baseLabel = source === 'market' ? 'market median' : 'local rent benchmark';

  let explanation: string;
  if (source === 'market') {
    if (verdict === 'good-deal') {
      explanation = `Priced ${absPct}% below the market median for ${brLabel} in this area`;
    } else if (verdict === 'fair-price') {
      explanation = `In line with typical ${brLabel.replace('BRs', 'BR').replace('studios', 'studio')} rents in this area`;
    } else {
      explanation = `Priced ${absPct}% above typical ${brLabel.replace('BRs', 'BR').replace('studios', 'studio')} rents in this area`;
    }
  } else {
    if (verdict === 'good-deal') {
      explanation = `Priced ${absPct}% below the local rent benchmark for ${brLabel} in this area`;
    } else if (verdict === 'fair-price') {
      explanation = `In line with the local rent benchmark for ${brLabel}`;
    } else {
      explanation = `Priced ${absPct}% above the local rent benchmark for ${brLabel} in this area`;
    }
  }

  return { verdict, percentDiff, explanation, shortLabel, baselineSource: source, sortScore: percentDiff };
}
