import { describe, it, expect } from 'vitest';

describe('Should you move? logic', () => {
  // Simulate the median calculation
  function getMedian(rents: number[]): number {
    const sorted = rents.filter(r => r > 0).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  }

  // Simulate the upfront cost calculation
  function getUpfrontCosts(medianRent: number, state: string) {
    const brokerFeeStates = ['NJ', 'NY', 'MA'];
    const hasBrokerFee = brokerFeeStates.includes(state);
    const low = medianRent + medianRent + 1500; // first month + security + DIY
    const high = medianRent + medianRent + 5000 + (hasBrokerFee ? medianRent : 0);
    return { low, high };
  }

  it('calculates median of comparable rents correctly (odd count)', () => {
    const rents = [2800, 3200, 3000, 2900, 3100];
    expect(getMedian(rents)).toBe(3000);
  });

  it('calculates median of comparable rents correctly (even count)', () => {
    const rents = [2800, 3200, 3000, 2900];
    expect(getMedian(rents)).toBe(2950);
  });

  it('calculates upfront costs for NJ (broker fee state)', () => {
    const median = 3000;
    const { low, high } = getUpfrontCosts(median, 'NJ');
    // low = 3000 + 3000 + 1500 = 7500
    expect(low).toBe(7500);
    // high = 3000 + 3000 + 5000 + 3000 = 14000
    expect(high).toBe(14000);
  });

  it('calculates upfront costs for TX (no broker fee)', () => {
    const median = 2500;
    const { low, high } = getUpfrontCosts(median, 'TX');
    // low = 2500 + 2500 + 1500 = 6500
    expect(low).toBe(6500);
    // high = 2500 + 2500 + 5000 = 10000
    expect(high).toBe(10000);
  });

  it('calculates break-even correctly', () => {
    const newRent = 3900;
    const medianRent = 3000;
    const monthlySavings = newRent - medianRent; // 900
    const upfrontLow = 7500;
    const upfrontHigh = 14000;

    const breakEvenLow = upfrontLow / monthlySavings; // 8.33 months
    const breakEvenHigh = upfrontHigh / monthlySavings; // 15.56 months

    expect(Math.round(breakEvenLow)).toBe(8);
    expect(Math.round(breakEvenHigh)).toBe(16);
  });

  it('negotiation savings are immediate with no upfront cost', () => {
    const newRent = 3900;
    const counterOffer = 3600;
    const negotiationSavings = newRent - counterOffer; // 300
    expect(negotiationSavings).toBe(300);
    // No break-even needed — savings start immediately
  });
});
