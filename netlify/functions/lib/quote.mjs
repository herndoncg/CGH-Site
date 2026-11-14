// The website's prices and the quote math. This runs on the server only.
//
// Plain version: a visitor's browser sends the job details here and gets back price ranges
// (three for new paving, one for a seal coat on asphalt they already have).
// The prices and the formula never go to the browser, so they cannot be read out of the website.
// (They are still in this code file. Keep the code repository private.)

export const PRICES = {
  minimumJob: 3500, minimumSqft: 900,
  tiers: [{ sqft: 2500, rate: 3.35 }, { sqft: 5000, rate: 3.2 }],
  baseWorkFee: 1500, loadPrice: 600, loadYards: 10, fillDepthIn: 2,
  rangeLowPct: 5, rangeHighPct: 10,
  sealSqft: 0.35, hotOilSqft: 1.0,
  // Seal coat on asphalt the customer already has (no new paving). Colton set these Nov 14, 2026:
  // Standard $0.75 a square foot (the sheet's "recommended .70-.75"), Premium $0.90, Heavy duty $1.10,
  // and never less than $350 for the trip.
  sealOnly: { standard: 0.75, premium: 0.9, heavy: 1.1 }, sealOnlyMinimum: 350,
};
// Starting numbers for the app's three-option estimate (the owner can change and save them in the app).
export const EST_DEFAULTS = { hotmix_sqyd: 32, seal_sqft: 0.35, hotoil_sqft: 1, tax_pct: 8.25, min_sqft: 900, deposit_pct: 45 };

const round50 = (n) => Math.round(n / 50) * 50;
export function ratePerSqft(p, sqft) {
  const points = [{ sqft: p.minimumSqft, rate: p.minimumJob / p.minimumSqft }, ...[...p.tiers].sort((a, b) => a.sqft - b.sqft)];
  if (sqft <= points[0].sqft) return points[0].rate;
  for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i]; if (sqft <= b.sqft) return a.rate + ((sqft - a.sqft) / (b.sqft - a.sqft)) * (b.rate - a.rate); }
  return points[points.length - 1].rate;
}

const ROCK = { '2': 'a top-up, about 2 inches', '4': 'new base for cars, about 4 inches', '6': 'new base for delivery trucks, about 6 inches', '8': 'new base for heavy trucks, about 8 inches' };

// Turns one real price into the range a customer sees: 5% under to 10% over, rounded to $50, never under the minimum.
function range(p, key, name, what, lasts, total, floor) {
  let low = Math.max(floor, round50(total * (1 - p.rangeLowPct / 100))), high = round50(total * (1 + p.rangeHighPct / 100));
  // Colton's rule: the first digit of the low and the high are never more than 1 apart.
  // $8,375 must not show as 7,950 to 9,200 (a 7 and a 9). It shows as 8,000 to 9,200.
  // When 5% under and 10% over would span three leading figures, the low end comes up to the next
  // round figure. The high end stays, because a final price above the range is worse than one below it.
  // (9,xxx to 10,xxx counts as one step.)
  const unit = 10 ** Math.floor(Math.log10(total));
  if (Math.floor(high / unit) - Math.floor(low / unit) > 1) {
    const up = (Math.floor(high / unit) - 1) * unit; // bring the low end up to the next round figure...
    if (up <= total) low = up; else high = (Math.floor(low / unit) + 2) * unit - 50; // ...unless that would pass the real price; then trim the high end
  }
  return { key, name, what, lasts, total: Math.round(total), low, high };
}

// Seal coat on asphalt that is already there. The choices, how long each lasts and how each works come from the
// seal coat list on the Information tab of Colton's estimation sheet. Cracks and potholes are priced on the visit.
// Left off on purpose: the sheet's Coal Tar Sealer and PolyTar. Coal tar sealers are banned in parts of Texas
// (Austin, San Antonio, Bee Cave, the Edwards Aquifer zone) and in several states. Colton left that call to Claude.
const SEALS = [
  { key: 'seal-standard', tier: 'standard', name: 'Standard', what: 'Asphalt emulsion seal coat. The everyday choice for driveways and lots', lasts: 'About 3 to 5 years before it needs resealing',
    how: 'We clean the surface, then spray or squeegee on an asphalt emulsion sealer (MasterSeal AE or equal). It goes on cool and needs about 24 hours to cure with no rain. It shields the asphalt from sun, water and oil.' },
  { key: 'seal-black', tier: 'standard', name: 'Standard, rich black', what: 'A fast-drying, eco-friendly sealer with a deep black finish', lasts: 'About 3 to 5 years before it needs resealing',
    how: 'Same cleaning and prep, with a sealer made for a darker, like-new look (Pitch Black or equal). It dries quickly and is ready to drive on after about 24 hours. It should not go down in a cold snap.' },
  { key: 'seal-premium', tier: 'premium', name: 'Premium', what: 'Polymer-modified seal coat, made for commercial and high-traffic lots', lasts: 'About 4 to 6 years before it needs resealing',
    how: 'A sealer with polymers blended in so it wears longer under traffic (Jennite AE or equal). It is sprayed or squeegeed on and needs about 24 hours of warm, sunny weather to cure.' },
  { key: 'seal-heavy', tier: 'heavy', name: 'Heavy duty', what: 'Two coats of a flexible heavy-duty sealer for busy lots', lasts: 'About 4 to 6 years before it needs resealing',
    how: 'A flexible blend put down in two coats for lots that see constant traffic (Resurfacer HP or equal). You can drive on it after about a day.' },
];
function sealQuote(input, p) {
  const sqft = Math.max(0, Math.round(Number(input.sqft) || 0));
  const flags = [];
  if (input.condition === 'Some cracks') flags.push('Crack filling is not in this range. We price it on the site visit once we see how many feet of cracks there are.');
  if (input.condition === 'Potholes or broken spots') flags.push('Potholes and broken spots need patching before a seal coat. Patching is priced on the site visit.');
  if (input.striping === 'Yes') flags.push('Re-striping after the seal coat is priced on the site visit.');
  return { service: 'seal', sqft, loads: 0, includes: [`Cleaning the surface and seal coating about ${sqft.toLocaleString('en-US')} sq ft`], flags,
    options: SEALS.map((t) => ({ ...range(p, t.key, t.name, t.what, t.lasts, Math.max(p.sealOnlyMinimum, sqft * p.sealOnly[t.tier]), p.sealOnlyMinimum), how: t.how })) };
}

// What the public sees: three ranges and a plain list of what is included. No rates, no line prices.
export function publicQuote(input, p = PRICES) {
  if (input.service === 'seal') return sealQuote(input, p);
  const sqft = Math.max(0, Math.round(Number(input.sqft) || 0));
  const fillPct = Math.min(100, Math.max(0, Number(input.fillPct) || 0));
  const depth = ROCK[String(input.rockDepth)] ? Number(input.rockDepth) : p.fillDepthIn;
  const asphalt = Math.max(p.minimumJob, sqft * ratePerSqft(p, sqft));
  const base = input.baseWork === 'Yes' ? p.baseWorkFee : 0;
  const yards = (sqft * (fillPct / 100) * (depth / 12)) / 27;
  const loads = fillPct > 0 ? Math.max(1, Math.ceil(yards / p.loadYards - 1e-9)) : 0;
  const common = base + loads * p.loadPrice;
  const make = (key, name, what, lasts, extra, how) => ({ ...range(p, key, name, what, lasts, asphalt + extra * sqft + common, p.minimumJob), how });
  const includes = [`Hot mix asphalt over about ${sqft.toLocaleString('en-US')} sq ft`];
  if (base) includes.push('Grading and base prep');
  if (loads) includes.push(`${loads} dump truck load${loads > 1 ? 's' : ''} of rock (${ROCK[String(depth)] || 'about ' + depth + ' inches'}) on about ${fillPct}% of the area`);
  const flags = [];
  if (input.baseWork === 'Not sure') flags.push('Grading is not in this range yet. We check it on the site visit.');
  if (['Old asphalt', 'Concrete'].includes(input.existing)) flags.push('Removing the old surface is priced on the site visit.');
  return { service: 'pave', sqft, loads, includes, flags, options: [
    make('economy', 'Economy', 'Hot mix asphalt, 2 to 3 inches thick', 'Plan on a seal coat in 2 to 3 years', 0, 'We set the grade, lay hot mix with our own paver and roll it tight. Nothing goes on top, so it is ready for its first seal coat in 2 to 3 years.'),
    make('premium', 'Premium', 'Hot mix asphalt with a seal coat applied after it cures', 'About 5 to 7 years before it needs resealing', p.sealSqft, 'The same paving, and then we come back once the asphalt has cured and seal it. The seal coat keeps sun and water from drying the surface out.'),
    make('elite', 'Elite', 'Hot mix asphalt with a hot oil treatment', 'About 10 to 12 years before it needs resealing', p.hotOilSqft, 'The same paving, finished with a hot oil treatment over the new surface. It is the longest-lasting finish we offer.'),
  ] };
}
