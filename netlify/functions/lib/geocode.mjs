// Address search for the map: turns "123 Main St, Longview TX" into a spot on the map.
//
// Plain version: the map asks this file where an address is. It asks two free public services, in order:
//   1. The U.S. Census Bureau address finder. Free, no account. Best for street addresses.
//   2. OpenStreetMap's finder. Free, no account. Catches towns, county roads and places the first one misses.
// The search runs on our server, so the visitor's own phone never talks to those services.
// Nothing here needs a key or a password.

const UA = 'CGHOperations-website/1.0 (+https://cghoperations.com; address search for quote map)';

async function getJson(net, url) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 6000);
  try { const r = await net(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctl.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(timer); }
}
const ok = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat > 17 && lat < 72 && lng > -180 && lng < -64;
const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// "300 W COTTON ST, LONGVIEW, TX, 75601" reads better as "300 W Cotton St, Longview, TX 75601".
const pretty = (s) => tidy(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/, ([A-Za-z]{2}), (\d{5})/, (_, st, zip) => `, ${st.toUpperCase()} ${zip}`).replace(/\b(Nw|Ne|Sw|Se|Fm|Us|Cr|Tx|La|Ar|Ok)\b/g, (c) => c.toUpperCase());

export async function geocode(query, net = fetch) {
  const q = tidy(query).slice(0, 160);
  if (q.length < 3) return [];
  const out = [];
  // A bare town name ("Kilgore") gets ", TX" as a nudge. Anything with a state or ZIP is left alone.
  const hasState = /\b(tx|texas|la|louisiana|ar|arkansas|ok|oklahoma)\b|\d{5}/i.test(q);
  if (/\d/.test(q)) {
    const census = await getJson(net, 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' + encodeURIComponent(hasState ? q : q + ', TX'));
    for (const m of census?.result?.addressMatches || []) {
      const lat = Number(m?.coordinates?.y), lng = Number(m?.coordinates?.x);
      if (ok(lat, lng)) out.push({ label: pretty(m.matchedAddress), lat, lng, exact: true });
    }
  }
  if (!out.length) {
    // The box (viewbox) leans the search toward Texas, Louisiana, Arkansas and Oklahoma without shutting out the rest.
    const osm = await getJson(net, 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&viewbox=-103.1,37.1,-88.8,28.9&q=' + encodeURIComponent(hasState ? q : q + ', Texas'));
    for (const m of Array.isArray(osm) ? osm : []) {
      const lat = Number(m.lat), lng = Number(m.lon);
      if (ok(lat, lng)) out.push({ label: tidy(m.display_name).replace(/, United States$/, ''), lat, lng, exact: ['house', 'building', 'residential'].includes(m.type) || m.addresstype === 'building' });
    }
  }
  const seen = new Set();
  return out.filter((r) => { const k = r.lat.toFixed(4) + ',' + r.lng.toFixed(4); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5).map((r) => ({ ...r, lat: Math.round(r.lat * 1e6) / 1e6, lng: Math.round(r.lng * 1e6) / 1e6 }));
}
