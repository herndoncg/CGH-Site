// The math from Colton's "Asphalt Road Estimation Tool" sheet, so the app gives the same numbers the sheet does.
// Checked against the sheet's own figures by scripts/test-estimate.mjs.

export interface EstPrices { hotmix_sqyd: number; seal_sqft: number; hotoil_sqft: number; tax_pct: number; min_sqft: number; deposit_pct: number }
export interface Contractor { hotmix_sqyd?: number; seal_sqft?: number; hotoil_sqft?: number }
// The starting prices are not in this file: this code is sent to browsers. They come from the server after sign-in.
const cents = (n: number) => Math.round(n * 100) / 100;

// Pricing Sheet: three options for the customer. Hot mix is priced by the square yard (9 sq ft).
export function options(p: EstPrices, sqftIn: number, c?: Contractor) {
  const sqft = Math.max(p.min_sqft, Math.round(sqftIn));
  const hot = p.hotmix_sqyd / 9, cHot = c?.hotmix_sqyd ? c.hotmix_sqyd / 9 : 0;
  const make = (key: string, name: string, what: string, lasts: string, extraName: string, extra: number, cExtra: number) => {
    const ppsf = hot + extra, subtotal = cents(ppsf * sqft), tax = cents(subtotal * (p.tax_pct / 100)), total = cents(subtotal + tax);
    const owed = c?.hotmix_sqyd ? cents((cHot + cExtra) * sqft) : undefined;
    return { key, name, what, lasts, extraName, extraCost: cents(extra * sqft), ppsf, subtotal, tax, total, deposit: cents(total * (p.deposit_pct / 100)), owed, profit: owed === undefined ? undefined : cents(subtotal - owed) };
  };
  return { sqft, list: [
    make('economy', 'Economy', 'Hot mix only, 2 to 3 inches thick', '2 to 3 years before it needs a seal coat', '', 0, 0),
    make('premium', 'Premium', 'Hot mix with a seal coat applied after', '5 to 7 years before reseal', 'Seal coat', p.seal_sqft, c?.seal_sqft || 0),
    make('elite', 'Elite', 'Hot mix with a hot oil treatment', '10 to 12 years before reseal', 'Hot oil treatment', p.hotoil_sqft, c?.hotoil_sqft || 0),
  ] };
}

// Materials Cost Sheet: a layer sold by the ton (hot mix types D, C, B and aggregate base).
export function layer(i: { sqft: number; depth: number; perTon: number; tonsPerYard: number; truckTons: number; taxPct: number; exempt: boolean }) {
  const yards = (i.sqft * (i.depth / 12)) / 27, tons = yards * i.tonsPerYard, cost = tons * i.perTon, tax = i.exempt ? 0 : cost * (i.taxPct / 100);
  return { yards, tons, deliveries: i.truckTons ? tons / i.truckTons : 0, cost, tax, total: cost + tax, perSqft: i.sqft ? (cost + tax) / i.sqft : 0, compacted: i.depth * 0.75 };
}
// Materials Cost Sheet: a liquid sold by the gallon (tack coat, primer, seal coat). Rate is gallons per square yard.
export function liquid(i: { sqft: number; rate: number; perGal: number; wastePct: number; taxPct: number; exempt: boolean }) {
  const gallons = (i.sqft / 9) * i.rate, wasted = gallons * (i.wastePct / 100), overall = gallons + wasted, cost = overall * i.perGal, tax = i.exempt ? 0 : cost * (i.taxPct / 100);
  return { gallons, wasted, overall, cost, tax, total: cost + tax, perSqft: i.sqft ? (cost + tax) / i.sqft : 0 };
}
// Yardage / Tonnage / Load Approximator: loose material needed once compaction is allowed for, and truck loads.
export function yardage(i: { sqft: number; depth: number; compactionPct: number; yardsPerLoad: number }) {
  const yards = (i.sqft * (i.depth / 12)) / 27, needed = yards * (1 + i.compactionPct / 100), loadsCalc = i.yardsPerLoad ? needed / i.yardsPerLoad : 0;
  return { yards, needed, loadsCalc, loads: Math.ceil(loadsCalc - 1e-9) };
}
