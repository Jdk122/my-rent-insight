import { useState, useEffect } from 'react';
import { lookupRentData, calculateResults } from '@/data/dataLoader';
import type { RentLookupResult } from '@/data/dataLoader';
import type { BedroomType } from '@/data/rentData';

// ─── Bedroom index → BedroomType mapping ───
const bedroomMap: Record<number, BedroomType> = {
  0: 'studio',
  1: 'oneBr',
  2: 'twoBr',
  3: 'threeBr',
  4: 'fourBr',
};

// ─── Test case type ───
interface TestCase {
  id: number;
  name: string;
  zip: string;
  bedrooms: number;
  currentRent: number;
  increasePct: number;
  expected: {
    city?: string;
    state?: string;
    yoySource?: 'zillow' | 'hud';
    yoyApprox?: number;
    verdict?: 'below' | 'at-market' | 'above';
    counterMin?: number | null;
    counterMax?: number | null;
    hasRange?: boolean;
    rangeLowMin?: number;
    rangeLowMax?: number;
    rangeHighMin?: number;
    rangeHighMax?: number;
    fmrMin?: number;
    fmrMax?: number;
    shouldShowError?: boolean;
    shouldShowLetter?: boolean;
    hasBurden?: boolean;
    burdenMin?: number;
    burdenMax?: number;
    isBurdened?: boolean;
    hasCensus?: boolean;
  };
}

const testCases: TestCase[] = [
  {
    id: 1, name: "Hoboken 1BR — Zillow YoY, above market",
    zip: "07030", bedrooms: 1, currentRent: 2500, increasePct: 8.5,
    expected: { city: "Hoboken", state: "NJ", yoySource: "zillow", yoyApprox: 4.7, verdict: "above", counterMin: 2550, counterMax: 2690, hasRange: true, rangeLowMin: 2500, rangeLowMax: 3200, rangeHighMin: 2900, rangeHighMax: 3500 }
  },
  {
    id: 2, name: "Manhattan 1BR — Zillow overrides negative HUD YoY",
    zip: "10001", bedrooms: 1, currentRent: 3200, increasePct: 5.0,
    expected: { city: "New York", state: "NY", yoySource: "zillow", yoyApprox: 4.7, verdict: "at-market", counterMin: null, counterMax: null }
  },
  {
    id: 3, name: "Miami Downtown — declining market",
    zip: "33130", bedrooms: 1, currentRent: 2000, increasePct: 12.0,
    expected: { city: "Miami", yoySource: "zillow", yoyApprox: -1.1, verdict: "above", counterMin: 2000, counterMax: 2000 }
  },
  {
    id: 4, name: "Detroit — cheap market, small numbers",
    zip: "48201", bedrooms: 1, currentRent: 900, increasePct: 8.0,
    expected: { city: "Detroit", verdict: "above", counterMin: 900, counterMax: 950, rangeLowMin: 600, rangeLowMax: 1000 }
  },
  {
    id: 5, name: "Beverly Hills — Zillow high YoY, 15% hike is at-market",
    zip: "90210", bedrooms: 1, currentRent: 3000, increasePct: 15.0,
    expected: { city: "Beverly Hills", yoySource: "zillow", yoyApprox: 12.5, verdict: "at-market", counterMin: null, counterMax: null }
  },
  {
    id: 6, name: "Invalid zip — should handle gracefully",
    zip: "00000", bedrooms: 1, currentRent: 1500, increasePct: 5.0,
    expected: { shouldShowError: true }
  },
  {
    id: 7, name: "Hoboken studio — bedroom index 0",
    zip: "07030", bedrooms: 0, currentRent: 2000, increasePct: 5.0,
    expected: { city: "Hoboken", fmrMin: 2500, fmrMax: 3200, verdict: "at-market" }
  },
  {
    id: 8, name: "Hoboken 0% increase — should be below market",
    zip: "07030", bedrooms: 1, currentRent: 2500, increasePct: 0,
    expected: { verdict: "below", counterMin: null, counterMax: null, shouldShowLetter: false }
  },
  {
    id: 9, name: "Houston 2BR — test bedroom index 2",
    zip: "77002", bedrooms: 2, currentRent: 1800, increasePct: 10.0,
    expected: { city: "Houston", verdict: "above" }
  },
  {
    id: 10, name: "Nashville declining — counter should equal current rent",
    zip: "37201", bedrooms: 1, currentRent: 1700, increasePct: 15.0,
    expected: { yoySource: "zillow", yoyApprox: -1.6, verdict: "above", counterMin: 1700, counterMax: 1700 }
  },
  {
    id: 11, name: "Las Vegas — high increase in flat market",
    zip: "89101", bedrooms: 1, currentRent: 1100, increasePct: 18.0,
    expected: { verdict: "above", counterMin: 1100, counterMax: 1150 }
  },
  {
    id: 12, name: "SF studio — below market increase",
    zip: "94102", bedrooms: 0, currentRent: 2200, increasePct: 4.0,
    expected: { yoySource: "zillow", yoyApprox: 10.2, verdict: "below", shouldShowLetter: false }
  },
  {
    id: 13, name: "Rent burden check — should show burdened",
    zip: "48201", bedrooms: 1, currentRent: 900, increasePct: 8.0,
    expected: { hasBurden: true, burdenMin: 40, burdenMax: 60, isBurdened: true }
  },
  {
    id: 14, name: "Counter-offer rounding — must not exceed proposed",
    zip: "07030", bedrooms: 1, currentRent: 2500, increasePct: 6.2,
    expected: { verdict: "above", counterMax: 2654 }
  },
  {
    id: 15, name: "Rural zip — no Zillow, falls back to HUD",
    zip: "50039", bedrooms: 1, currentRent: 800, increasePct: 10.0,
    expected: { yoySource: "hud", hasCensus: true }
  },
];

// ─── Result types ───
interface Check {
  field: string;
  expected: string;
  actual: string;
  pass: boolean;
}

interface TestResult {
  id: number;
  name: string;
  pass: boolean;
  checks: Check[];
  error?: string;
}

// ─── Runner ───
async function runTest(tc: TestCase): Promise<TestResult> {
  const checks: Check[] = [];
  const e = tc.expected;

  // Handle invalid zip
  if (e.shouldShowError) {
    const data = await lookupRentData(tc.zip, bedroomMap[tc.bedrooms]);
    checks.push({ field: 'returns null', expected: 'null', actual: data === null ? 'null' : 'data', pass: data === null });
    return { id: tc.id, name: tc.name, pass: checks.every(c => c.pass), checks };
  }

  let data: RentLookupResult | null;
  try {
    data = await lookupRentData(tc.zip, bedroomMap[tc.bedrooms]);
  } catch (err) {
    return { id: tc.id, name: tc.name, pass: false, checks, error: String(err) };
  }

  if (!data) {
    return { id: tc.id, name: tc.name, pass: false, checks, error: `No data for zip ${tc.zip}` };
  }

  // City
  if (e.city) {
    checks.push({ field: 'city', expected: e.city, actual: data.city, pass: data.city === e.city });
  }
  // State
  if (e.state) {
    checks.push({ field: 'state', expected: e.state, actual: data.state, pass: data.state === e.state });
  }
  // YoY source
  if (e.yoySource) {
    checks.push({ field: 'yoySource', expected: e.yoySource, actual: data.yoySource, pass: data.yoySource === e.yoySource });
  }
  // YoY value (±0.5 tolerance)
  if (e.yoyApprox !== undefined) {
    const diff = Math.abs(data.yoyChange - e.yoyApprox);
    checks.push({ field: 'yoyChange', expected: `~${e.yoyApprox}`, actual: `${data.yoyChange}`, pass: diff <= 0.5 });
  }
  // FMR range
  if (e.fmrMin !== undefined) {
    checks.push({ field: 'fmr ≥ min', expected: `≥${e.fmrMin}`, actual: `${data.fmr}`, pass: data.fmr >= e.fmrMin });
  }
  if (e.fmrMax !== undefined) {
    checks.push({ field: 'fmr ≤ max', expected: `≤${e.fmrMax}`, actual: `${data.fmr}`, pass: data.fmr <= e.fmrMax });
  }
  // Census
  if (e.hasCensus !== undefined) {
    const has = data.censusMedianRent !== null;
    checks.push({ field: 'hasCensus', expected: `${e.hasCensus}`, actual: `${has}`, pass: has === e.hasCensus });
  }

  // Calculate results (only if increase > 0)
  const hasIncrease = tc.increasePct > 0;
  const calc = hasIncrease ? calculateResults(tc.currentRent, tc.increasePct, 3000, data) : null;

  // Verdict
  if (e.verdict) {
    const actual = hasIncrease ? (calc?.verdict ?? 'none') : 'below';
    // Special: 0% increase check
    if (tc.increasePct === 0) {
      // 0% in a positive market → below (ratio = 0)
      const v = data.yoyChange > 0 ? 'below' : 'at-market';
      checks.push({ field: 'verdict', expected: e.verdict, actual: v, pass: v === e.verdict });
    } else {
      checks.push({ field: 'verdict', expected: e.verdict, actual, pass: actual === e.verdict });
    }
  }

  // Counter-offer
  if (e.counterMin !== undefined) {
    if (e.counterMin === null) {
      // Should NOT have a counter (at-market or below)
      const verdictActual = calc?.verdict;
      checks.push({ field: 'no counter needed', expected: 'not above', actual: verdictActual ?? 'n/a', pass: verdictActual !== 'above' });
    } else if (calc) {
      checks.push({ field: 'counterLow ≥ min', expected: `≥${e.counterMin}`, actual: `${calc.counterLow}`, pass: calc.counterLow >= e.counterMin });
    }
  }
  if (e.counterMax !== undefined && e.counterMax !== null && calc) {
    checks.push({ field: 'counterLow ≤ max', expected: `≤${e.counterMax}`, actual: `${calc.counterLow}`, pass: calc.counterLow <= e.counterMax });
  }

  // Range
  if (e.hasRange && calc) {
    checks.push({ field: 'has range', expected: 'true', actual: `${calc.typicalRangeLow > 0}`, pass: calc.typicalRangeLow > 0 });
  }
  if (e.rangeLowMin !== undefined && calc) {
    checks.push({ field: 'rangeLow ≥ min', expected: `≥${e.rangeLowMin}`, actual: `${calc.typicalRangeLow}`, pass: calc.typicalRangeLow >= e.rangeLowMin });
  }
  if (e.rangeLowMax !== undefined && calc) {
    checks.push({ field: 'rangeLow ≤ max', expected: `≤${e.rangeLowMax}`, actual: `${calc.typicalRangeLow}`, pass: calc.typicalRangeLow <= e.rangeLowMax });
  }
  if (e.rangeHighMin !== undefined && calc) {
    checks.push({ field: 'rangeHigh ≥ min', expected: `≥${e.rangeHighMin}`, actual: `${calc.typicalRangeHigh}`, pass: calc.typicalRangeHigh >= e.rangeHighMin });
  }
  if (e.rangeHighMax !== undefined && calc) {
    checks.push({ field: 'rangeHigh ≤ max', expected: `≤${e.rangeHighMax}`, actual: `${calc.typicalRangeHigh}`, pass: calc.typicalRangeHigh <= e.rangeHighMax });
  }

  // Burden
  if (e.hasBurden !== undefined && calc) {
    const has = calc.rentBurden !== null;
    checks.push({ field: 'hasBurden', expected: `${e.hasBurden}`, actual: `${has}`, pass: has === e.hasBurden });
  }
  if (e.burdenMin !== undefined && calc?.rentBurden !== null) {
    checks.push({ field: 'burden ≥ min', expected: `≥${e.burdenMin}%`, actual: `${calc.rentBurden}%`, pass: (calc.rentBurden ?? 0) >= e.burdenMin });
  }
  if (e.burdenMax !== undefined && calc?.rentBurden !== null) {
    checks.push({ field: 'burden ≤ max', expected: `≤${e.burdenMax}%`, actual: `${calc.rentBurden}%`, pass: (calc.rentBurden ?? 0) <= e.burdenMax });
  }
  if (e.isBurdened !== undefined && calc) {
    checks.push({ field: 'isBurdened', expected: `${e.isBurdened}`, actual: `${calc.isCostBurdened}`, pass: calc.isCostBurdened === e.isBurdened });
  }

  // Letter visibility
  if (e.shouldShowLetter !== undefined) {
    const wouldShow = hasIncrease && calc?.verdict === 'above';
    checks.push({ field: 'showLetter', expected: `${e.shouldShowLetter}`, actual: `${wouldShow}`, pass: wouldShow === e.shouldShowLetter });
  }

  return { id: tc.id, name: tc.name, pass: checks.every(c => c.pass), checks };
}

// ─── Component ───
const StressTest = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    (async () => {
      const all: TestResult[] = [];
      for (const tc of testCases) {
        all.push(await runTest(tc));
      }
      setResults(all);
      setRunning(false);
    })();
  }, []);

  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  return (
    <div className="min-h-screen bg-background p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-2">RentReply Stress Test</h1>
      <p className="text-muted-foreground mb-6">Internal QA — tests run against live data + calculation logic</p>

      {running ? (
        <p className="text-muted-foreground">Running {testCases.length} tests...</p>
      ) : (
        <>
          <div className={`text-lg font-bold mb-6 ${passed === total ? 'text-green-500' : 'text-red-500'}`}>
            {passed}/{total} passed {passed === total ? '✅' : '❌'}
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4 w-8">#</th>
                <th className="py-2 pr-4">Test</th>
                <th className="py-2 pr-4 w-12">Result</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} className={`border-b border-border ${!r.pass ? 'bg-red-500/5' : ''}`}>
                  <td className="py-3 pr-4 align-top">{r.id}</td>
                  <td className="py-3 pr-4 align-top font-medium">{r.name}</td>
                  <td className="py-3 pr-4 align-top text-lg">{r.pass ? '✅' : '❌'}</td>
                  <td className="py-3 align-top">
                    {r.error && <p className="text-red-500 mb-1">Error: {r.error}</p>}
                    <div className="space-y-0.5">
                      {r.checks.map((c, i) => (
                        <div key={i} className={`${c.pass ? 'text-muted-foreground' : 'text-red-500 font-bold'}`}>
                          {c.pass ? '✓' : '✗'} {c.field}: expected {c.expected}, got {c.actual}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default StressTest;
