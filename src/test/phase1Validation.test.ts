import { describe, it, expect } from 'vitest';
import { calculateFairnessScore, FairnessScoreInput } from '@/lib/fairnessScore';
import { getCounterOffer } from '@/data/dataLoader';

interface TestCase {
  name: string;
  input: FairnessScoreInput;
  expectations: {
    comp5Score?: number;
    comp3Score?: number;
    comp3Label?: string;
    comp5Estimated?: boolean;
    totalMin?: number;
    totalMax?: number;
    counterAboveCompMedian?: boolean;
  };
}

const cases: TestCase[] = [
  {
    name: 'Case 1 - Typical renter, no Zillow data',
    input: {
      increasePct: 5, marketYoY: 3, proposedRent: 2100, currentRent: 2000,
      fmr: 1800, compMedian: 2050, zillowMonthly: null,
    },
    expectations: { comp5Score: 5, totalMin: 50, totalMax: 80 },
  },
  {
    name: 'Case 2 - High-cost NYC, falling market, no Zillow',
    input: {
      increasePct: 7, marketYoY: -1.5, proposedRent: 4280, currentRent: 4000,
      fmr: 1900, compMedian: 3800, zillowMonthly: null,
    },
    expectations: { comp3Score: 6, comp5Score: 5 },
  },
  {
    name: 'Case 3 - Fair increase, has Zillow data',
    input: {
      increasePct: 3, marketYoY: 4, proposedRent: 1545, currentRent: 1500,
      fmr: 1400, compMedian: 1550, zillowMonthly: -0.1,
    },
    expectations: { comp5Score: 10, comp5Estimated: false, totalMin: 75, totalMax: 100 },
  },
  {
    name: 'Case 4 - Zero increase, verify Component 3 label',
    input: {
      increasePct: 0, marketYoY: 2, proposedRent: 1800, currentRent: 1800,
      fmr: 1600, compMedian: 1750, zillowMonthly: 0.2,
    },
    expectations: { comp3Label: 'Increase Reasonableness' },
  },
  {
    name: 'Case 5 - Renter far above market, counter-offer check',
    input: {
      increasePct: 8, marketYoY: 3, proposedRent: 3240, currentRent: 3000,
      fmr: 1500, compMedian: 2200, zillowMonthly: 0.4,
    },
    expectations: { totalMin: 5, totalMax: 25, counterAboveCompMedian: true },
  },
];

describe('Phase 1 Validation — Full Pipeline', () => {
  cases.forEach(({ name, input, expectations }) => {
    describe(name, () => {
      const result = calculateFairnessScore(input);
      const comp3 = result.components.find(c => c.id === 'fmr')!;
      const comp5 = result.components.find(c => c.id === 'momentum')!;

      // Log full breakdown
      console.log(`\n=== ${name} ===`);
      result.components.forEach(c =>
        console.log(`  ${c.label}: ${c.score}/${c.max}${c.estimated ? ' (est)' : ''}`)
      );
      console.log(`  TOTAL: ${result.total}/100 → ${result.tierLabel}`);

      if (expectations.comp5Score !== undefined) {
        it(`Component 5 = ${expectations.comp5Score}/10`, () => {
          expect(comp5.score).toBe(expectations.comp5Score);
        });
      }

      if (expectations.comp5Estimated !== undefined) {
        it(`Component 5 estimated = ${expectations.comp5Estimated}`, () => {
          expect(comp5.estimated).toBe(expectations.comp5Estimated);
        });
      }

      if (expectations.comp3Score !== undefined) {
        it(`Component 3 = ${expectations.comp3Score}/20`, () => {
          expect(comp3.score).toBe(expectations.comp3Score);
        });
      }

      if (expectations.comp3Label !== undefined) {
        it(`Component 3 label = '${expectations.comp3Label}'`, () => {
          expect(comp3.label).toBe(expectations.comp3Label);
        });
      }

      if (expectations.totalMin !== undefined && expectations.totalMax !== undefined) {
        it(`Total in range [${expectations.totalMin}, ${expectations.totalMax}]`, () => {
          expect(result.total).toBeGreaterThanOrEqual(expectations.totalMin!);
          expect(result.total).toBeLessThanOrEqual(expectations.totalMax!);
        });
      }

      if (expectations.counterAboveCompMedian) {
        it('Counter-offer exceeds comp median (triggers annotation)', () => {
          const counter = getCounterOffer(input.currentRent, input.marketYoY);
          console.log(`  Counter: $${counter.counterLow}–$${counter.counterHigh} vs median $${input.compMedian}`);
          expect(counter.counterLow).toBeGreaterThan(input.compMedian!);
        });
      }
    });
  });
});
