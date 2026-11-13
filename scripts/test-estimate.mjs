// Checks the app's estimate math against the figures in Colton's sheet.
// Run: node --experimental-strip-types scripts/test-estimate.mjs
import { options, layer, liquid, yardage } from '../src/lib/estimate.ts';
import { EST_DEFAULTS as DEFAULT_PRICES } from '../netlify/functions/lib/quote.mjs';
let pass = 0, fail = 0; const near = (a, b, tol = 0.006) => Math.abs(a - b) <= tol;
const ok = (label, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); };
// Customer prices are the sheet's. The contractor and supplier prices below are made-up round numbers:
// the real ones are private and live only in the app's storage, never in this code.
const o = options(DEFAULT_PRICES, 900, { hotmix_sqyd: 18, seal_sqft: 0.1, hotoil_sqft: 0.2 }).list;
ok('Economy at 900 sq ft: $3,200 + $264 tax = $3,464', near(o[0].subtotal, 3200) && near(o[0].tax, 264) && near(o[0].total, 3464) && near(o[0].ppsf, 3.5556, 0.001));
ok('Premium: $3,515 + $289.99 = $3,804.99, seal coat $315', near(o[1].subtotal, 3515) && near(o[1].tax, 289.99) && near(o[1].total, 3804.99) && near(o[1].extraCost, 315));
ok('Elite: $4,100 + $338.25 = $4,438.25, hot oil $900', near(o[2].subtotal, 4100) && near(o[2].tax, 338.25) && near(o[2].total, 4438.25) && near(o[2].extraCost, 900));
ok('contractor share and what is left: hot mix by the square yard, extras by the square foot', near(o[0].owed, 1800) && near(o[0].profit, 1400) && near(o[1].owed, 1890) && near(o[1].profit, 1625) && near(o[2].owed, 1980) && near(o[2].profit, 2120));
ok('small jobs are priced at the 900 sq ft minimum, and no contractor numbers means no profit lines', options(DEFAULT_PRICES, 400).sqft === 900 && options(DEFAULT_PRICES, 400).list[0].owed === undefined);
ok('deposit is 45% of the total', near(o[0].deposit, 3464 * 0.45));
let L = layer({ sqft: 52800, depth: 3.125, perTon: 100, tonsPerYard: 2.015, truckTons: 25, taxPct: 8.25, exempt: true });
ok('surface layer: 509.26 yd, 1,026.16 tons, 41.05 loads, no tax when exempt', near(L.yards, 509.26) && near(L.tons, 1026.16) && near(L.deliveries, 41.05) && near(L.cost, 102615.74, 0.02) && L.tax === 0);
L = layer({ sqft: 900, depth: 3, perTon: 100, tonsPerYard: 2, truckTons: 15, taxPct: 8.25, exempt: false });
ok('3 in over 900 sq ft: 8.33 yd, 16.67 tons, 1.11 loads, 8.25% tax, 2.25 in compacted', near(L.yards, 8.33) && near(L.tons, 16.67) && near(L.deliveries, 1.11) && near(L.cost, 1666.67) && near(L.tax, 137.5) && near(L.perSqft, 2.0, 0.01) && L.compacted === 2.25);
L = layer({ sqft: 900, depth: 5, perTon: 100, tonsPerYard: 2, truckTons: 15, taxPct: 8.25, exempt: false });
ok('5 in over 900 sq ft: 13.89 yd, 27.78 tons, 3.75 in compacted', near(L.yards, 13.89) && near(L.tons, 27.78) && L.compacted === 3.75);
L = layer({ sqft: 40, depth: 12, perTon: 100, tonsPerYard: 1.25, truckTons: 15, taxPct: 8.25, exempt: false });
ok('aggregate base: 1.48 yd, 1.85 tons', near(L.yards, 1.48) && near(L.tons, 1.85) && near(L.deliveries, 0.12));
let q = liquid({ sqft: 32326, rate: 0.08, perGal: 2, wastePct: 7.5, taxPct: 8.25, exempt: false });
ok('tack coat: 287.34 gal + 21.55 waste = 308.89 to buy', near(q.gallons, 287.34) && near(q.wasted, 21.55) && near(q.overall, 308.89) && near(q.cost, 617.79, 0.02));
q = liquid({ sqft: 10220, rate: 0.5, perGal: 2, wastePct: 7, taxPct: 8.25, exempt: true });
ok('primer: 567.78 gal, 607.52 with waste, no tax when exempt', near(q.gallons, 567.78) && near(q.overall, 607.52) && q.tax === 0);
q = liquid({ sqft: 900, rate: 0.15, perGal: 2, wastePct: 7, taxPct: 8.25, exempt: false });
ok('seal coat: 15 gal, 16.05 with waste', near(q.gallons, 15) && near(q.overall, 16.05) && near(q.total, 34.75, 0.01));
let y = yardage({ sqft: 422 * 12, depth: 4, compactionPct: 15, yardsPerLoad: 12 });
ok('Yardage: 62.52 yd, 71.90 needed, 5.99 so 6 loads', near(y.yards, 62.52) && near(y.needed, 71.9) && near(y.loadsCalc, 5.99) && y.loads === 6);
y = yardage({ sqft: 1000, depth: 3, compactionPct: 0, yardsPerLoad: 12 });
ok('Yardage by square feet: 9.26 yd, 1 load', near(y.yards, 9.26) && y.loads === 1);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
