/**
 * Weighted composite fair rent range calculator for the WSIP tool.
 * Combines Rentcast comps, HUD SAFMR, Zillow ZORI, and Rentcast market median
 * into a single fair-range estimate with confidence scoring.
 */

export interface FairRangeInput {
  compRents: number[];
  hudFmr: number;
  zoriRent: number | null;
  rcMarketMedian: number | null;
  /** Tier-based weight overrides (from compTiering) */
  tierOverride?: {
    tier1Rents: number[];
    otherRents: number[];
    tier1CompWeight: number;
    otherCompWeight: number;
    hudZoriWeight: number;
  } | null;
}

export interface FairRangeResult {
  rangeLow: number;
  rangeHigh: number;
  sources: string[];
  confidence: 'high' | 'moderate' | 'low';
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export function calculateFairRange(input: FairRangeInput): FairRangeResult {
  const { tierOverride, compRents, hudFmr, zoriRent, rcMarketMedian } = input;
  const sorted = [...compRents].filter(r => r > 0).sort((a, b) => a - b);
  const hasComps = sorted.length >= 1;
  const hasZori = zoriRent !== null && zoriRent > 0;
  const hasMarketMedian = rcMarketMedian !== null && rcMarketMedian > 0;
  const fewComps = sorted.length < 3;

  // ── Sources ──
  const sources: string[] = ['HUD SAFMR'];
  if (hasComps) sources.push('Nearby Listings');
  if (hasZori) sources.push('Zillow ZORI');
  if (hasMarketMedian) sources.push('Local Market Data');

  // ── Tier-override path ──
  if (tierOverride && tierOverride.tier1Rents.length > 0) {
    const t1 = [...tierOverride.tier1Rents].sort((a, b) => a - b);
    const other = [...tierOverride.otherRents].filter(r => r > 0).sort((a, b) => a - b);

    const t1Low = t1.length >= 3 ? percentile(t1, 0.25) : t1[0] * 0.95;
    const t1High = t1.length >= 3 ? percentile(t1, 0.75) : t1[t1.length - 1] * 1.05;

    const otherLow = other.length >= 3 ? percentile(other, 0.25) : other.length > 0 ? other[0] * 0.90 : 0;
    const otherHigh = other.length >= 3 ? percentile(other, 0.75) : other.length > 0 ? other[other.length - 1] * 1.10 : 0;

    const hasOther = other.length > 0;
    const { tier1CompWeight, otherCompWeight, hudZoriWeight } = tierOverride;

    // Split hudZoriWeight between HUD and ZORI/market
    const hudPart = hudZoriWeight * (hasZori || hasMarketMedian ? 0.5 : 1);
    const auxPart = hudZoriWeight - hudPart;

    const total = tier1CompWeight + (hasOther ? otherCompWeight : 0) + hudPart + auxPart;
    const scale = 1 / total;

    const wT1 = tier1CompWeight * scale;
    const wOther = (hasOther ? otherCompWeight : 0) * scale;
    const wHud = hudPart * scale;

    const auxLow = hasMarketMedian ? rcMarketMedian! * 0.85 : hasZori ? zoriRent! * 0.85 : hudFmr;
    const auxHigh = hasMarketMedian ? rcMarketMedian! * 1.15 : hasZori ? zoriRent! * 1.15 : hudFmr * 1.15;
    const wAux = auxPart * scale;

    const rangeLow = Math.round(wT1 * t1Low + wOther * otherLow + wHud * hudFmr + wAux * auxLow);
    const rangeHigh = Math.round(wT1 * t1High + wOther * otherHigh + wHud * hudFmr * 1.15 + wAux * auxHigh);

    sources.unshift('In-Building Comps');

    const confidence: 'high' | 'moderate' | 'low' =
      t1.length >= 3 ? 'high' : t1.length >= 1 && other.length >= 2 ? 'moderate' : 'moderate';

    return {
      rangeLow: Math.max(rangeLow, 0),
      rangeHigh: Math.max(rangeHigh, rangeLow + 1),
      sources,
      confidence,
    };
  }

  // ── Default path (no tier override) ──

  // ── Base weights ──
  let compWeight = hasComps ? (fewComps ? 20 : 40) : 0;
  let hudWeight = 20;
  let zoriWeight = hasZori ? 20 : 0;
  let marketWeight = hasMarketMedian ? 20 : 0;

  // If few comps, boost HUD and ZORI
  if (fewComps && hasComps) {
    hudWeight += 10;
    if (hasZori) zoriWeight += 10;
    else hudWeight += 10;
  }

  // Redistribute weight from null sources
  const totalAssigned = compWeight + hudWeight + zoriWeight + marketWeight;
  if (totalAssigned === 0) {
    return { rangeLow: hudFmr, rangeHigh: Math.round(hudFmr * 1.15), sources, confidence: 'low' };
  }

  // Normalize weights to sum to 1
  const scale = 1 / totalAssigned;
  const wComp = compWeight * scale;
  const wHud = hudWeight * scale;
  const wZori = zoriWeight * scale;
  const wMarket = marketWeight * scale;

  // ── Anchors ──
  const compLow = sorted.length >= 3 ? percentile(sorted, 0.25) : sorted.length > 0 ? sorted[0] * 0.95 : 0;
  const compHigh = sorted.length >= 3 ? percentile(sorted, 0.75) : sorted.length > 0 ? sorted[sorted.length - 1] * 1.05 : 0;

  const hudLow = hudFmr;
  const hudHigh = hudFmr * 1.15;

  const zoriLow = hasZori ? zoriRent! * 0.85 : 0;
  const zoriHigh = hasZori ? zoriRent! * 1.15 : 0;

  const medLow = hasMarketMedian ? rcMarketMedian! * 0.85 : 0;
  const medHigh = hasMarketMedian ? rcMarketMedian! * 1.15 : 0;

  // ── Weighted average ──
  const rangeLow = Math.round(
    wComp * compLow + wHud * hudLow + wZori * zoriLow + wMarket * medLow
  );
  const rangeHigh = Math.round(
    wComp * compHigh + wHud * hudHigh + wZori * zoriHigh + wMarket * medHigh
  );

  // ── Confidence ──
  const otherSourceCount = (hasZori ? 1 : 0) + (hasMarketMedian ? 1 : 0);
  let confidence: 'high' | 'moderate' | 'low';
  if (sorted.length >= 5 && otherSourceCount >= 2) {
    confidence = 'high';
  } else if (sorted.length >= 3 || otherSourceCount >= 2) {
    confidence = 'moderate';
  } else {
    confidence = 'low';
  }

  return {
    rangeLow: Math.max(rangeLow, 0),
    rangeHigh: Math.max(rangeHigh, rangeLow + 1),
    sources,
    confidence,
  };
}
