// Checks the quote math against the numbers Colton gave. Run: node --experimental-strip-types scripts/test-pricing.mjs
import { readFileSync } from 'node:fs';
import { estimate, ratePerSqft } from '../src/lib/pricing.ts';
const p = JSON.parse(readFileSync(new URL('../src/data/pricing.json', import.meta.url)));
const rows = [];
let ok = true;
const check = (label, got, want) => { const pass = Math.abs(got - want) < 0.005; ok &&= pass; rows.push(`${pass ? 'PASS' : 'FAIL'}  ${label}: got ${got}, want ${want}`); };
check('900 sq ft asphalt', estimate(p, { sqft: 900, baseWork: false, fillPct: 0 }).asphalt, 3500);
check('500 sq ft hits the minimum', estimate(p, { sqft: 500, baseWork: false, fillPct: 0 }).asphalt, 3500);
check('2,500 sq ft rate', ratePerSqft(p, 2500), 3.35);
check('2,500 sq ft asphalt', estimate(p, { sqft: 2500, baseWork: false, fillPct: 0 }).asphalt, 8375);
check('5,000 sq ft rate', ratePerSqft(p, 5000), 3.2);
check('8,000 sq ft rate', ratePerSqft(p, 8000), 3.2);
check('base work adds $1,500', estimate(p, { sqft: 2500, baseWork: true, fillPct: 0 }).total, 9875);
const f = estimate(p, { sqft: 2500, baseWork: false, fillPct: 25 });
check('2,500 sq ft, 25% fill at 2in = 3.86 yd', Math.round(f.fillYards * 100) / 100, 3.86);
check('...which is 1 load', f.loads, 1);
check('...costing $600', f.fill, 600);
const g = estimate(p, { sqft: 10000, baseWork: true, fillPct: 50 });
check('10,000 sq ft, 50% fill = 30.86 yd = 4 loads', g.loads, 4);
check('10,000 sq ft total (32,000 + 1,500 + 2,400)', g.total, 35900);
check('range low is -5% (rounded to $50)', g.low, 34100);
check('range high is +10% (rounded to $50)', g.high, 39500);
let prev = 0, mono = true;
for (let s = 100; s <= 20000; s += 10) { const t = estimate(p, { sqft: s, baseWork: false, fillPct: 0 }).asphalt; if (t < prev - 0.001) mono = false; prev = t; }
check('a bigger job never costs less than a smaller one', mono ? 1 : 0, 1);
console.log(rows.join('\n'));
console.log('\nSample prices (asphalt only):');
for (const s of [900, 1200, 1500, 2000, 2500, 3500, 5000, 8000]) { const q = estimate(p, { sqft: s, baseWork: false, fillPct: 0 }); console.log(`  ${String(s).padStart(5)} sq ft  $${q.rate.toFixed(2)}/sq ft  total $${Math.round(q.asphalt).toLocaleString()}  range $${q.low.toLocaleString()} to $${q.high.toLocaleString()}`); }
process.exit(ok ? 0 : 1);
