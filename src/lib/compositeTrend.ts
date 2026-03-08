// ─── Composite Trend Engine ───
// Precision-weighted combination of multiple rent trend sources
// with statistical confidence scoring

export interface TrendSource {
  value: number;
  weight: number;
  label: string;
  type: 'transaction' | 'listing' | 'government';
  geography: 'zip' | 'county' | 'metro' | 'national';
}

export type TrendBadgeTier = 'verified' | 'estimated' | 'mixed' | 'limited';

export interface CompositeTrendResult {
  compositeTrend: number;
  confidenceScore: number;
  badgeTier: TrendBadgeTier;
  badgeLabel: string;
  sources: TrendSource[];
  sourceCount: number;
  spreadLow: number;
  spreadHigh: number;
  primarySource: string;
  hasTransactionData: boolean;
  // Backward-compat helpers
  yoy: number | null;
  source: string;
  heroSource: string;
}

const SOURCE_WEIGHTS = {
  apartmentList: 0.45,
  zoriZip: 0.30,
  zoriCounty: 0.20,
  zoriMetro: 0.15,
  hudFmr: 0.10,
};

export function calculateCompositeTrend(params: {
  alYoY: number | null;
  zoriYoY: number | null;
  zoriSource?: 'zip' | 'county' | 'metro' | null;
  hudYoY: number | null;
}): CompositeTrendResult {
  const { alYoY, zoriYoY, zoriSource, hudYoY } = params;

  const sources: TrendSource[] = [];

  if (alYoY !== null && alYoY !== undefined) {
    sources.push({
      value: alYoY,
      weight: SOURCE_WEIGHTS.apartmentList,
      label: 'Apartment List',
      type: 'transaction',
      geography: 'zip',
    });
  }

  if (zoriYoY !== null && zoriYoY !== undefined) {
    const geo = zoriSource || 'zip';
    const weight = geo === 'zip' ? SOURCE_WEIGHTS.zoriZip
                 : geo === 'county' ? SOURCE_WEIGHTS.zoriCounty
                 : SOURCE_WEIGHTS.zoriMetro;
    sources.push({
      value: zoriYoY,
      weight,
      label: geo === 'zip' ? 'Zillow ZORI' : `Zillow ZORI (${geo})`,
      type: 'listing',
      geography: geo,
    });
  }

  if (hudYoY !== null && hudYoY !== undefined) {
    sources.push({
      value: hudYoY,
      weight: SOURCE_WEIGHTS.hudFmr,
      label: 'HUD Fair Market Rent',
      type: 'government',
      geography: 'zip',
    });
  }

  // Build backward-compat source/heroSource strings
  const sourceLabels = sources.map(s => s.label);
  const sourceStr = sourceLabels.length > 0 ? sourceLabels.join(', ') : '';
  const heroStr = sources.length > 0 ? sources.reduce((a, b) => a.weight > b.weight ? a : b).label : '';

  // No sources
  if (sources.length === 0) {
    return {
      compositeTrend: 0, confidenceScore: 0,
      badgeTier: 'limited', badgeLabel: 'No trend data',
      sources: [], sourceCount: 0, spreadLow: 0, spreadHigh: 0,
      primarySource: '', hasTransactionData: false,
      yoy: null, source: '', heroSource: '',
    };
  }

  // Single source
  if (sources.length === 1) {
    const s = sources[0];
    const conf = s.type === 'transaction' ? 55 : s.type === 'listing' ? 40 : 25;
    return {
      compositeTrend: Math.round(s.value * 10) / 10,
      confidenceScore: conf,
      badgeTier: 'estimated',
      badgeLabel: 'Single source estimate',
      sources, sourceCount: 1,
      spreadLow: s.value, spreadHigh: s.value,
      primarySource: s.label, hasTransactionData: s.type === 'transaction',
      yoy: Math.round(s.value * 10) / 10, source: sourceStr, heroSource: heroStr,
    };
  }

  // Precision-Weighted Mean
  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
  const weightedMean = sources.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight;

  // Normalized Dispersion Index
  const k = 1.5;
  const weightedVariance = sources.reduce(
    (sum, s) => sum + s.weight * Math.pow(s.value - weightedMean, 2), 0
  ) / totalWeight;
  const weightedStdDev = Math.sqrt(weightedVariance);
  const ndi = weightedStdDev / (Math.abs(weightedMean) + k);

  // Directional Concordance
  let concordanceScore = 1.0;
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i];
      const b = sources[j];
      const zeroCrossing = (a.value > 0.3 && b.value < -0.3) || (a.value < -0.3 && b.value > 0.3);
      if (zeroCrossing) {
        const pairWeight = (a.weight + b.weight) / (2 * totalWeight);
        concordanceScore -= pairWeight * 0.5;
      }
    }
  }
  concordanceScore = Math.max(0, concordanceScore);

  // Zero-Proximity Uncertainty Penalty
  const alpha = 2.0;
  const beta = 1.0;
  const zeroProximityPenalty = 1 + (alpha / (Math.abs(weightedMean) + beta));

  // Source Count & Geography Bonus
  const hasZipLevel = sources.some(s => s.geography === 'zip');
  const countBonus = sources.length >= 3 ? 1.1 : 1.0;
  const geoBonus = hasZipLevel ? 1.0 : 0.85;

  // Composite Confidence Score (0-100)
  const baseConfidence = 80;
  const dispersionPenalty = Math.min(40, ndi * zeroProximityPenalty * 30);
  const concordancePenalty = (1 - concordanceScore) * 25;
  const rawConfidence = (baseConfidence - dispersionPenalty - concordancePenalty)
                        * countBonus * geoBonus;
  const confidenceScore = Math.round(Math.max(0, Math.min(100, rawConfidence)));

  // Badge Tier
  let badgeTier: TrendBadgeTier;
  let badgeLabel: string;
  if (confidenceScore >= 75) { badgeTier = 'verified'; badgeLabel = 'Verified trend'; }
  else if (confidenceScore >= 55) { badgeTier = 'estimated'; badgeLabel = 'Estimated trend'; }
  else if (confidenceScore >= 35) { badgeTier = 'mixed'; badgeLabel = 'Mixed signals'; }
  else { badgeTier = 'limited'; badgeLabel = 'Limited data'; }

  // Spread
  const values = sources.map(s => s.value);
  const spreadLow = Math.min(...values);
  const spreadHigh = Math.max(...values);

  const bestSource = sources.reduce((a, b) => a.weight > b.weight ? a : b);
  const composite = Math.round(weightedMean * 10) / 10;

  return {
    compositeTrend: composite,
    confidenceScore, badgeTier, badgeLabel,
    sources, sourceCount: sources.length,
    spreadLow, spreadHigh,
    primarySource: bestSource.label,
    hasTransactionData: sources.some(s => s.type === 'transaction'),
    yoy: composite, source: sourceStr, heroSource: heroStr,
  };
}
