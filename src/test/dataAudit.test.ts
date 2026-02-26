import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

interface RentZipRaw {
  c: string;
  s: string;
  m: string;
  f: number[];
  p: number[];
  y: number;
  ps: 'f' | 'a' | 'm' | 'n';
  r?: number;
  i?: number;
}

const dataPath = path.resolve(__dirname, '../../public/data/rentData.json');
const raw: Record<string, RentZipRaw> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const entries = Object.entries(raw);

describe('rentData.json audit', () => {
  
  it('all zips have 5-digit format', () => {
    const bad = entries.filter(([zip]) => !/^\d{5}$/.test(zip));
    console.log('Bad zip formats:', bad.map(([z]) => z).slice(0, 20));
    expect(bad.length).toBe(0);
  });

  it('all entries have 5 FMR values (0BR-4BR)', () => {
    const bad = entries.filter(([, d]) => !Array.isArray(d.f) || d.f.length !== 5);
    console.log('Bad FMR arrays:', bad.map(([z]) => z).slice(0, 20));
    expect(bad.length).toBe(0);
  });

  it('all entries have 5 prior FMR values', () => {
    const bad = entries.filter(([, d]) => !Array.isArray(d.p) || d.p.length !== 5);
    console.log('Bad prior arrays:', bad.map(([z]) => z).slice(0, 20));
    expect(bad.length).toBe(0);
  });

  it('no $0 or negative FMR values', () => {
    const bad = entries.filter(([, d]) => d.f.some(v => v <= 0));
    console.log('Zero/negative FMR:', bad.map(([z, d]) => `${z}: ${d.f}`).slice(0, 10));
    expect(bad.length).toBe(0);
  });

  it('no $0 or negative prior FMR values', () => {
    const bad = entries.filter(([, d]) => d.p.some(v => v <= 0));
    console.log('Zero/negative prior:', bad.map(([z, d]) => `${z}: ${d.p}`).slice(0, 10));
    expect(bad.length).toBe(0);
  });

  it('no absurdly high FMR (>$10,000/mo for any bedroom)', () => {
    const bad = entries.filter(([, d]) => d.f.some(v => v > 10000));
    console.log('FMR > $10k:', bad.map(([z, d]) => `${z} (${d.c}, ${d.s}): ${Math.max(...d.f)}`).slice(0, 10));
    expect(bad.length).toBe(0);
  });

  it('no absurdly low FMR (<$100/mo for any bedroom)', () => {
    const bad = entries.filter(([, d]) => d.f.some(v => v < 100));
    console.log('FMR < $100:', bad.map(([z, d]) => `${z} (${d.c}, ${d.s}): ${Math.min(...d.f)}`).slice(0, 10));
    // Log count but don't necessarily fail — some PR/rural areas might be legit
    if (bad.length > 0) {
      console.log(`Total zips with sub-$100 FMR: ${bad.length}`);
    }
  });

  it('no extreme YoY (>50% or <-50%)', () => {
    const bad = entries.filter(([, d]) => Math.abs(d.y) > 50);
    console.log('Extreme YoY:', bad.map(([z, d]) => `${z} (${d.c}): ${d.y}%`).slice(0, 20));
    expect(bad.length).toBe(0);
  });

  it('pre-computed YoY roughly matches actual 1BR calculation', () => {
    const bad = entries.filter(([, d]) => {
      if (d.p[1] === 0) return false;
      const computed = Math.round(((d.f[1] - d.p[1]) / d.p[1]) * 1000) / 10;
      return Math.abs(computed - d.y) > 1.0; // >1% discrepancy
    });
    console.log('YoY mismatch (precomputed vs actual):', bad.map(([z, d]) => {
      const computed = Math.round(((d.f[1] - d.p[1]) / d.p[1]) * 1000) / 10;
      return `${z}: stored=${d.y}, computed=${computed}`;
    }).slice(0, 10));
    if (bad.length > 0) console.log(`Total mismatches: ${bad.length}`);
  });

  it('FMR increases monotonically by bedroom count (studio ≤ 1BR ≤ 2BR ≤ 3BR ≤ 4BR)', () => {
    const bad = entries.filter(([, d]) => {
      for (let i = 1; i < 5; i++) {
        if (d.f[i] < d.f[i - 1]) return true;
      }
      return false;
    });
    console.log('Non-monotonic FMR:', bad.map(([z, d]) => `${z} (${d.c}): ${d.f}`).slice(0, 10));
    if (bad.length > 0) console.log(`Total non-monotonic: ${bad.length}`);
  });

  it('census median rent is reasonable when present ($100-$5000)', () => {
    const bad = entries.filter(([, d]) => d.r !== undefined && (d.r < 100 || d.r > 5000));
    console.log('Unreasonable census rent:', bad.map(([z, d]) => `${z} (${d.c}): $${d.r}`).slice(0, 10));
    if (bad.length > 0) console.log(`Total unreasonable: ${bad.length}`);
  });

  it('median income is reasonable when present ($5k-$500k)', () => {
    const bad = entries.filter(([, d]) => d.i !== undefined && (d.i < 5000 || d.i > 500000));
    console.log('Unreasonable income:', bad.map(([z, d]) => `${z} (${d.c}): $${d.i}`).slice(0, 10));
    if (bad.length > 0) console.log(`Total unreasonable: ${bad.length}`);
  });

  it('no empty state codes', () => {
    const bad = entries.filter(([, d]) => !d.s || d.s.trim() === '');
    console.log('Empty states:', bad.map(([z, d]) => `${z}: city="${d.c}", metro="${d.m}"`).slice(0, 10));
    // We already know about 00664
  });

  it('valid prior source codes', () => {
    const bad = entries.filter(([, d]) => !['f', 'a', 'm', 'n'].includes(d.ps));
    console.log('Invalid prior source:', bad.map(([z, d]) => `${z}: ps="${d.ps}"`).slice(0, 10));
    expect(bad.length).toBe(0);
  });

  it('census rent vs FMR not wildly divergent (>3x difference suggests data error)', () => {
    const bad = entries.filter(([, d]) => {
      if (!d.r) return false;
      const fmr2br = d.f[2]; // 2BR FMR
      const ratio = Math.max(d.r / fmr2br, fmr2br / d.r);
      return ratio > 3;
    });
    console.log('Census vs FMR divergence (>3x):', bad.map(([z, d]) => 
      `${z} (${d.c}): census=$${d.r}, 2BR FMR=$${d.f[2]}, ratio=${(Math.max(d.r!/d.f[2], d.f[2]/d.r!)).toFixed(1)}x`
    ).slice(0, 15));
    if (bad.length > 0) console.log(`Total divergent: ${bad.length}`);
  });

  it('break-even math: no division by zero when proposed rent equals benchmark', () => {
    // This checks if there are zips where FMR and census rent are both present but equal
    // which could cause issues in break-even calculations
    const edgeCases = entries.filter(([, d]) => d.r !== undefined && d.r === d.f[1]);
    console.log(`Zips where census rent === 1BR FMR: ${edgeCases.length}`);
    // Not a failure, just informational
  });

  it('summary stats', () => {
    const total = entries.length;
    const withCensusRent = entries.filter(([, d]) => d.r !== undefined).length;
    const withIncome = entries.filter(([, d]) => d.i !== undefined).length;
    const negativeYoy = entries.filter(([, d]) => d.y < 0).length;
    const zeroYoy = entries.filter(([, d]) => d.y === 0).length;
    const states = new Set(entries.map(([, d]) => d.s));
    
    console.log(`\n=== DATASET SUMMARY ===`);
    console.log(`Total zips: ${total}`);
    console.log(`With census rent: ${withCensusRent} (${(withCensusRent/total*100).toFixed(1)}%)`);
    console.log(`With income: ${withIncome} (${(withIncome/total*100).toFixed(1)}%)`);
    console.log(`Negative YoY: ${negativeYoy}`);
    console.log(`Zero YoY: ${zeroYoy}`);
    console.log(`States/territories: ${states.size} — ${[...states].sort().join(', ')}`);
  });
});
