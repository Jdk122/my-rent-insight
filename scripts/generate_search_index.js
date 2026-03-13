#!/usr/bin/env node
/**
 * Generate a lightweight search index from rentData.json.
 * Output: public/data/searchIndex.json
 *
 * Contains ONLY navigation fields — no rent values, FMR, or trend data.
 * Cities are deduplicated (one entry per unique city+state pair).
 * Uses the same slug logic as the site (lowercase, alphanumeric, hyphens).
 *
 * Run: node scripts/generate_search_index.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',
  GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',
  IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',
  MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
  MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
  SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',
  WY:'Wyoming',PR:'Puerto Rico',GU:'Guam',VI:'Virgin Islands',
};

const rentData = JSON.parse(readFileSync(join(ROOT, 'public/data/rentData.json'), 'utf8'));

// --- States ---
const states = Object.entries(STATE_NAMES)
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([code, name]) => [name, code]);

// --- Deduplicated cities ---
const citySet = new Set();
const cities = [];
for (const raw of Object.values(rentData)) {
  const city = (raw.c || '').replace(/^Zcta\s+/i, '');
  const st = raw.s;
  if (!city || !st || !STATE_NAMES[st]) continue;
  const key = `${city}|${st}`;
  if (citySet.has(key)) continue;
  citySet.add(key);
  cities.push([city, st]);
}
cities.sort((a, b) => a[0].localeCompare(b[0]));

// --- Zips (compact: [zip, cityName, stateCode]) ---
const zips = Object.entries(rentData)
  .filter(([z, r]) => /^\d{5}$/.test(z) && r.s && STATE_NAMES[r.s])
  .map(([z, r]) => {
    const city = (r.c || '').replace(/^Zcta\s+/i, '');
    return [z, city, r.s];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

const index = { states, cities, zips };
const json = JSON.stringify(index);

writeFileSync(join(ROOT, 'public/data/searchIndex.json'), json);

const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(0);
console.log(`✅ searchIndex.json generated: ${states.length} states, ${cities.length} cities, ${zips.length} zips (${sizeKB} KB)`);
