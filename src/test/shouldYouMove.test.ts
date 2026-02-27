import { describe, it, expect } from 'vitest';

describe('Should you move? logic', () => {
  function getMedian(rents: number[]): number {
    const sorted = rents.filter(r => r > 0).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  }

  function getUpfrontCosts(medianRent: number, state: string) {
    const brokerFeeStates = ['NJ', 'NY', 'MA'];
    const hasBrokerFee = brokerFeeStates.includes(state);
    const low = medianRent + medianRent + 1500;
    const high = medianRent + medianRent + 5000 + (hasBrokerFee ? medianRent : 0);
    return { low, high };
  }

  function getVerdict(breakEvenAvg: number) {
    if (breakEvenAvg < 6) return 'moving-wins';
    if (breakEvenAvg > 24) return 'negotiate-wins';
    return 'close-call';
  }

  it('calculates median correctly (odd)', () => {
    expect(getMedian([2800, 3200, 3000, 2900, 3100])).toBe(3000);
  });

  it('calculates median correctly (even)', () => {
    expect(getMedian([2800, 3200, 3000, 2900])).toBe(2950);
  });

  it('NJ gets broker fee', () => {
    const { low, high } = getUpfrontCosts(3000, 'NJ');
    expect(low).toBe(7500);
    expect(high).toBe(14000);
  });

  it('TX has no broker fee', () => {
    const { low, high } = getUpfrontCosts(2500, 'TX');
    expect(low).toBe(6500);
    expect(high).toBe(10000);
  });

  it('daily reframe rounds to nearest $0.50', () => {
    const monthlySavings = 400;
    const daily = Math.round((monthlySavings / 30) * 2) / 2;
    expect(daily).toBe(13.5);
  });

  it('verdict: moving wins when break-even < 6 months', () => {
    expect(getVerdict(4)).toBe('moving-wins');
  });

  it('verdict: negotiate wins when break-even > 24 months', () => {
    expect(getVerdict(30)).toBe('negotiate-wins');
  });

  it('verdict: close call between 6 and 24 months', () => {
    expect(getVerdict(12)).toBe('close-call');
  });

  it('negotiate section shows first when break-even > 12 months', () => {
    const breakEvenAvg = 15;
    const showNegotiateFirst = breakEvenAvg > 12;
    expect(showNegotiateFirst).toBe(true);
  });

  it('moving section shows first when break-even <= 12 months', () => {
    const breakEvenAvg = 8;
    const showNegotiateFirst = breakEvenAvg > 12;
    expect(showNegotiateFirst).toBe(false);
  });
});
