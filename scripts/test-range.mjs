// Colton's range rule, checked on every job size from 900 to 60,000 sq ft, with and without grading and rock:
// the first digit of the low and the high are never more than 1 apart, and the real price is always inside the range.
// Run: node scripts/test-range.mjs
import { publicQuote, PRICES } from '../netlify/functions/lib/quote.mjs';
let checked = 0, broken = 0, widest = 0, crossTen = 0; const examples = [];
for (let sqft = 900; sqft <= 60000; sqft += 25) for (const baseWork of ['No', 'Yes']) for (const fillPct of [0, 30, 100]) for (const rockDepth of ['', '8']) {
  for (const o of publicQuote({ sqft, baseWork, fillPct, rockDepth }).options) {
    checked++; const unit = 10 ** Math.floor(Math.log10(o.total)), d = Math.floor(o.total / unit), lo = Math.floor(o.low / unit), hi = Math.floor(o.high / unit);
    if (hi - lo > 1 || o.low > o.total || o.high < o.total) { broken++; if (examples.length < 5) examples.push(`${sqft} sq ft ${o.name}: real ${o.total}, shown ${o.low} to ${o.high}`); }
    widest = Math.max(widest, hi - lo); if (String(o.high).length > String(Math.round(o.total)).length) crossTen++;
  }
}
// the same rule for seal coat prices, from tiny jobs (the $350 minimum) to 60,000 sq ft
for (let sqft = 100; sqft <= 60000; sqft += 25) for (const o of publicQuote({ service: 'seal', sqft }).options) {
  checked++; const unit = 10 ** Math.floor(Math.log10(o.total)), lo = Math.floor(o.low / unit), hi = Math.floor(o.high / unit);
  if (hi - lo > 1 || o.low > o.total || o.high < o.total || o.low < PRICES.sealOnlyMinimum) { broken++; if (examples.length < 5) examples.push(`seal ${sqft} sq ft ${o.name}: real ${o.total}, shown ${o.low} to ${o.high}`); }
}
console.log(`${checked.toLocaleString()} prices checked, ${broken} break the rule. Range is ${PRICES.rangeLowPct}% under to ${PRICES.rangeHighPct}% over.`);
console.log(`Most the low and high ever differ in their leading figure: ${widest}. Prices whose high end rolls over into the next digit count (like 9,6xx showing up to 10,xxx): ${crossTen}.`);
if (examples.length) console.log(examples.join('\n'));
for (const s of [900, 1900, 2100, 2500, 2850, 5000, 30000]) { const o = publicQuote({ sqft: s, baseWork: 'No', fillPct: 0 }).options[0]; console.log(`  ${String(s).padStart(6)} sq ft Economy: real $${o.total.toLocaleString()}  shown $${o.low.toLocaleString()} to $${o.high.toLocaleString()}`); }
process.exit(broken ? 1 : 0);
