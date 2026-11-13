// The website's prices and the quote math. This runs on the server only.
//
// Plain version: a visitor's browser sends the job details here and gets back three price ranges.
// The prices and the formula never go to the browser, so they cannot be read out of the website.
// (They are still in this code file. Keep the code repository private.)

export const PRICES = {
  minimumJob: 3500, minimumSqft: 900,
  tiers: [{ sqft: 2500, rate: 3.35 }, { sqft: 5000, rate: 3.2 }],
  baseWorkFee: 1500, loadPrice: 600, loadYards: 10, fillDepthIn: 2,
  rangeLowPct: 5, rangeHighPct: 10,
  sealSqft: 0.35, hotOilSqft: 1.0,
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

// What the public sees: three ranges and a plain list of what is included. No rates, no line prices.
export function publicQuote(input, p = PRICES) {
  const sqft = Math.max(0, Math.round(Number(input.sqft) || 0));
  const fillPct = Math.min(100, Math.max(0, Number(input.fillPct) || 0));
  const depth = ROCK[String(input.rockDepth)] ? Number(input.rockDepth) : p.fillDepthIn;
  const asphalt = Math.max(p.minimumJob, sqft * ratePerSqft(p, sqft));
  const base = input.baseWork === 'Yes' ? p.baseWorkFee : 0;
  const yards = (sqft * (fillPct / 100) * (depth / 12)) / 27;
  const loads = fillPct > 0 ? Math.max(1, Math.ceil(yards / p.loadYards - 1e-9)) : 0;
  const common = base + loads * p.loadPrice;
  const make = (key, name, what, lasts, extra) => {
    const total = asphalt + extra * sqft + common;
    let low = Math.max(p.minimumJob, round50(total * (1 - p.rangeLowPct / 100))), high = round50(total * (1 + p.rangeHighPct / 100));
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
  };
  const includes = [`Hot mix asphalt over about ${sqft.toLocaleString('en-US')} sq ft`];
  if (base) includes.push('Grading and base prep');
  if (loads) includes.push(`${loads} dump truck load${loads > 1 ? 's' : ''} of rock (${ROCK[String(depth)] || 'about ' + depth + ' inches'}) on about ${fillPct}% of the area`);
  const flags = [];
  if (input.baseWork === 'Not sure') flags.push('Grading is not in this range yet. We check it on the site visit.');
  if (['Old asphalt', 'Concrete'].includes(input.existing)) flags.push('Removing the old surface is priced on the site visit.');
  return { sqft, loads, includes, flags, options: [
    make('economy', 'Economy', 'Hot mix asphalt, 2 to 3 inches thick', 'Plan on a seal coat in 2 to 3 years', 0),
    make('premium', 'Premium', 'Hot mix asphalt with a seal coat applied after it cures', 'About 5 to 7 years before it needs resealing', p.sealSqft),
    make('elite', 'Elite', 'Hot mix asphalt with a hot oil treatment', 'About 10 to 12 years before it needs resealing', p.hotOilSqft),
  ] };
}
