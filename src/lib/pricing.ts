// The quote math for the app's Quick quote. No prices live here: this code is sent to browsers.
// The numbers come from the server after sign-in (netlify/functions/lib/quote.mjs holds them and the public quote math).
//
// How the asphalt price works, in plain terms:
//   - Up to the minimum size (900 sq ft) the job costs the minimum ($3,500).
//   - From there the price per square foot slides down smoothly as the job gets bigger,
//     hitting each tier's rate at that tier's size ($3.35 at 2,500 sq ft, $3.20 at 5,000 sq ft and up).
//     Sliding (instead of jumping) means a slightly bigger job never costs less than a smaller one.
//   - Base work (washouts, grading) is one flat fee.
//   - Rock/fill is sold by the dump truck load: area that needs it x depth, rounded UP to whole loads.

export interface Pricing {
  minimumJob: number;
  minimumSqft: number;
  tiers: { sqft: number; rate: number }[];
  baseWorkFee: number;
  loadPrice: number;
  loadYards: number;
  fillDepthIn: number;
  rangeLowPct: number;
  rangeHighPct: number;
}

export interface QuoteInput { sqft: number; baseWork: boolean; fillPct: number }

export interface Quote {
  sqft: number;
  rate: number;
  asphalt: number;
  baseWork: number;
  fillYards: number;
  loads: number;
  fill: number;
  total: number;
  low: number;
  high: number;
}

export function ratePerSqft(p: Pricing, sqft: number): number {
  const points = [{ sqft: p.minimumSqft, rate: p.minimumJob / p.minimumSqft }, ...[...p.tiers].sort((a, b) => a.sqft - b.sqft)];
  if (sqft <= points[0].sqft) return points[0].rate;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (sqft <= b.sqft) return a.rate + ((sqft - a.sqft) / (b.sqft - a.sqft)) * (b.rate - a.rate);
  }
  return points[points.length - 1].rate;
}

const round50 = (n: number) => Math.round(n / 50) * 50;

export function estimate(p: Pricing, input: QuoteInput): Quote {
  const sqft = Math.max(0, Math.round(input.sqft));
  const fillPct = Math.min(100, Math.max(0, input.fillPct));
  const rate = ratePerSqft(p, sqft);
  const asphalt = Math.max(p.minimumJob, sqft * rate);
  const baseWork = input.baseWork ? p.baseWorkFee : 0;
  const fillYards = (sqft * (fillPct / 100) * (p.fillDepthIn / 12)) / 27;
  const loads = fillPct > 0 ? Math.max(1, Math.ceil(fillYards / p.loadYards - 1e-9)) : 0;
  const fill = loads * p.loadPrice;
  const total = asphalt + baseWork + fill;
  return {
    sqft, rate, asphalt, baseWork, fillYards, loads, fill, total,
    // the low end never dips under the minimum job price
    low: Math.max(p.minimumJob, round50(total * (1 - p.rangeLowPct / 100))),
    high: round50(total * (1 + p.rangeHighPct / 100)),
  };
}

export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
