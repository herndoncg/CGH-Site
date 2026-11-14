// Checks the map tool's math and its back end: square feet from dots, address search, drawings saved on leads.
// Run: node scripts/test-map.mjs
import { createHash } from 'node:crypto';
import * as core from '../netlify/functions/lib/core.mjs';
import { areaSqft, lengthFt, shapeSqft, stripOutline, cleanMap, describeMap } from '../netlify/functions/lib/geo.mjs';
import { geocode } from '../netlify/functions/lib/geocode.mjs';

const mem = new Map();
const store = { get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), setJSON: async (k, v) => void mem.set(k, JSON.stringify(v)), delete: async (k) => void mem.delete(k), list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }) };
let pass = 0, fail = 0;
const ok = (label, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const pushed = []; const push = { key: async () => 'K', send: async (sub, msg) => { pushed.push(msg); return 'ok'; } };
// A stand-in for the two public address services, so the test never touches the internet.
const asked = [];
let netMode = 'normal';
const net = async (u) => {
  asked.push(String(u)); const url = new URL(u);
  if (netMode === 'down') throw new Error('offline');
  if (url.host.includes('census')) return new Response(JSON.stringify({ result: { addressMatches: /cotton/i.test(url.searchParams.get('address')) ? [{ matchedAddress: '300 W COTTON ST, LONGVIEW, TX, 75601', coordinates: { x: -94.7405, y: 32.4946 } }] : [] } }));
  if (/nowhere/i.test(url.searchParams.get('q'))) return new Response('[]');
  return new Response(JSON.stringify([{ lat: '32.3862', lon: '-94.8758', display_name: 'Kilgore, Gregg County, Texas, United States', type: 'city' }, { lat: '48.85', lon: '2.35', display_name: 'Paris, France', type: 'city' }]));
};
const call = async (method, path, body, cookie, ip = '1.1.1.1') => {
  const r = await core.handle(new Request('https://x.test/api/' + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), 'x-nf-client-connection-ip': ip }, body: body ? JSON.stringify(body) : undefined }), store, push, net);
  const sc = r.headers.get('set-cookie'); return { status: r.status, body: await r.json().catch(() => ({})), cookie: sc ? sc.split(';')[0] : undefined };
};

// ----- the math -----
const lat = 32.5, lng = -94.74, M = 0.3048, R = 6378137, deg = 180 / Math.PI;
const north = (ft) => ((ft * M) / R) * deg, east = (ft) => ((ft * M) / (R * Math.cos(lat / deg))) * deg;
const rect = (w, h, oLat = lat, oLng = lng) => [[oLat, oLng], [oLat, oLng + east(w)], [oLat + north(h), oLng + east(w)], [oLat + north(h), oLng]];
ok('a 100 by 50 ft rectangle measures 5,000 sq ft', Math.abs(areaSqft(rect(100, 50)) - 5000) < 1);
ok('a 12 by 400 ft ranch drive measures 4,800 sq ft', Math.abs(areaSqft(rect(12, 400)) - 4800) < 2);
ok('direction of the dots does not matter', Math.abs(areaSqft(rect(100, 50).reverse()) - 5000) < 1);
ok('an L shape adds up (two rectangles)', Math.abs(areaSqft([[lat, lng], [lat, lng + east(60)], [lat + north(20), lng + east(60)], [lat + north(20), lng + east(20)], [lat + north(50), lng + east(20)], [lat + north(50), lng]]) - (60 * 20 + 20 * 30)) < 1);
ok('the distance around a 100 by 50 is 300 ft', Math.abs(lengthFt(rect(100, 50), true) - 300) < 0.5);
const drive = { kind: 'line', pts: [[lat, lng], [lat, lng + east(300)]], width_ft: 12 };
ok('a traced 300 ft drive at 12 ft wide is 3,600 sq ft', Math.abs(shapeSqft(drive) - 3600) < 1);
ok('the strip drawn for it covers the same area', Math.abs(areaSqft(stripOutline(drive.pts, 12)) - 3600) < 2);
ok('a line with no width adds no area', shapeSqft({ kind: 'line', pts: drive.pts, width_ft: 0 }) === 0);
ok('fewer than three dots is not an area', areaSqft(rect(100, 50).slice(0, 2)) === 0);

// ----- checking a drawing before it is saved -----
let m = cleanMap(JSON.stringify({ address: '  1 Main St ', center: [lat, lng], zoom: 19.4, shapes: [{ kind: 'area', pts: rect(100, 50), sqft: 999999 }, { kind: 'area', pts: [[1, 2]] }, drive, { kind: 'line', pts: [[lat, 'x'], [lat, lng]] }, { kind: 'area', pts: [[95, 0], [96, 0], [97, 1]] }] }));
ok('bad shapes are dropped, good ones kept', m.shapes.length === 2 && m.shapes[0].kind === 'area' && m.shapes[1].kind === 'line');
ok('the size is measured again, not taken from the browser', Math.abs(m.shapes[0].sqft - 5000) <= 1 && Math.abs(m.sqft - 8600) <= 2);
ok('address and view are tidied', m.address === '1 Main St' && m.zoom === 19 && m.center[0] === lat);
ok('junk is refused', cleanMap('garbage') === null && cleanMap({ shapes: [] }) === null && cleanMap(null) === null && cleanMap('x'.repeat(70000)) === null);
ok('no more than 8 shapes and 80 dots are kept', cleanMap({ shapes: Array.from({ length: 20 }, () => ({ kind: 'area', pts: Array.from({ length: 200 }, (_, i) => [lat + i * 1e-5, lng + (i % 2) * 1e-5]) })) }).shapes.length === 8 && cleanMap({ shapes: [{ kind: 'area', pts: Array.from({ length: 200 }, (_, i) => [lat + i * 1e-5, lng + (i % 2) * 1e-5]) }] }).shapes[0].pts.length === 80);
ok('a drawing is described in plain words', describeMap(m) === '1 area and 1 traced drive drawn on the map, ' + m.sqft.toLocaleString('en-US') + ' sq ft');

// ----- address search -----
let g = await geocode('300 W Cotton St Longview', net);
ok('a street address is found by the Census finder', g.length === 1 && g[0].label === '300 W Cotton St, Longview, TX 75601' && g[0].exact && Math.abs(g[0].lat - 32.4946) < 1e-6);
ok('a street address with no state gets ", TX" added', asked.at(-1).includes(encodeURIComponent('300 W Cotton St Longview, TX')));
g = await geocode('Kilgore', net);
ok('a town falls through to the second finder, and places outside the U.S. are dropped', g.length === 1 && g[0].label === 'Kilgore, Gregg County, Texas' && g[0].exact === false);
ok('a town search skips the street-address finder', !asked.at(-1).includes('census'));
g = await geocode('123 Unknown Rd', net); ok('an address the first finder misses is tried on the second', g.length === 1 && asked.at(-2).includes('census') && asked.at(-1).includes('nominatim'));
ok('nothing found gives an empty list', (await geocode('nowhere at all', net)).length === 0);
ok('too short a search is not sent anywhere', (await geocode('ab', net)).length === 0);
netMode = 'down'; ok('if both finders are down the search just comes back empty', (await geocode('300 W Cotton St', net)).length === 0); netMode = 'normal';

// ----- the back end -----
process.env.CGH_SETUP_HASH = sha('TEST-CODE-12345');
let r = await call('POST', 'setup', { code: 'TEST-CODE-12345', name: 'Colton', email: 'owner@example.com', password: 'a-long-password' }); const owner = r.cookie;
r = await call('GET', 'geocode?q=' + encodeURIComponent('300 W Cotton St Longview')); ok('the map can search an address without signing in', r.status === 200 && r.body.results.length === 1);
r = await call('GET', 'geocode?q=a'); ok('a one-letter search returns nothing', r.status === 200 && r.body.results.length === 0);
for (let i = 0; i < 45; i++) r = await call('GET', 'geocode?q=Kilgore', null, null, '9.9.9.9'); ok('one address gets 40 searches an hour', r.status === 429);
r = await call('GET', 'geocode?q=Kilgore', null, null, '9.9.9.8'); ok('other visitors are not affected', r.status === 200);

await call('POST', 'push-subscribe', { sub: { endpoint: 'https://push.test/owner' } }, owner); // the owner's phone has alerts on
const drawing = { address: '300 W Cotton St, Longview, TX 75601', center: [lat, lng], zoom: 19, shapes: [{ kind: 'area', pts: rect(100, 50) }, drive] };
r = await call('POST', 'lead', { name: 'Dana Drawer', phone: '(903) 555-0100', sqft: '8600', base_work: 'No', fill_pct: '0', mode: 'advanced', map: JSON.stringify(drawing), est_low: '1', est_total: '1' });
ok('a quote with a map drawing is accepted', r.status === 200 && !!r.body.ref && r.body.quote.options.length === 3);
ok('the public answer still has no rates or totals', !JSON.stringify(r.body).match(/rate|total|perSqft|3\.2|3\.35/));
ok('the public answer does not echo the drawing back', !JSON.stringify(r.body).includes('pts'));
ok('the team alert mentions the drawing', pushed.at(-1).body.includes('drew it on the map'));
r = await call('GET', 'leads', null, owner); let lead = r.body.leads.find((l) => l.name === 'Dana Drawer');
ok('the drawing is saved on the lead, re-measured', lead.map.shapes.length === 2 && Math.abs(lead.map.sqft - 8600) <= 2 && lead.map.address.startsWith('300 W Cotton'));
ok('the lead has a plain note about it', lead.notes.some((n) => n.text.includes('1 area and 1 traced drive drawn on the map')));
r = await call('POST', 'quote', { service: 'pave', sqft: '8600', base_work: 'No', fill_pct: '0', map: JSON.stringify(drawing) }); ok('looking at a price never stores a drawing or makes a lead', r.status === 200 && (await call('GET', 'leads', null, owner)).body.leads.length === 1);
r = await call('POST', 'lead', { name: 'Sealy Sue', phone: '9035550144', service: 'seal', sqft: '5000', condition: 'Good shape', map: JSON.stringify({ shapes: [{ kind: 'area', pts: rect(100, 50) }] }) }); r = await call('GET', 'leads', null, owner);
ok('a seal coat quote can carry a drawing too', r.body.leads.some((l) => l.name === 'Sealy Sue' && l.map && Math.abs(l.map.sqft - 5000) <= 1));
r = await call('POST', 'lead', { name: 'Bad Map', phone: '9035550123', sqft: '1000', base_work: 'No', fill_pct: '0', map: '{"shapes":[{"kind":"area","pts":[[1,2]]}]}' }); r = await call('GET', 'leads', null, owner);
ok('a broken drawing is ignored and the quote still goes through', r.body.leads.some((l) => l.name === 'Bad Map' && !l.map));

// team side
r = await call('POST', 'users', { name: 'Sam Sales', email: 'sam@example.com', role: 'sales' }, owner); let t = r.body.temp;
r = await call('POST', 'login', { email: 'sam@example.com', password: t }); r = await call('POST', 'password', { next: 'sams-long-password' }, r.cookie); const sam = r.cookie;
r = await call('POST', 'users', { name: 'Cal Crew', email: 'cal@example.com', role: 'crew' }, owner); t = r.body.temp;
r = await call('POST', 'login', { email: 'cal@example.com', password: t }); r = await call('POST', 'password', { next: 'cals-long-password' }, r.cookie); const cal = r.cookie;
r = await call('POST', 'leads', { name: 'Measured Mike', phone: '9035550111', sqft: 5000, map: { shapes: [{ kind: 'area', pts: rect(100, 50) }] } }, sam); const mike = r.body.lead;
ok('sales can save a new lead with a drawing', r.status === 200 && Math.abs(mike.map.sqft - 5000) <= 1 && mike.map.by === 'Sam Sales');
r = await call('PATCH', 'leads/' + mike.id, { map: { shapes: [{ kind: 'area', pts: rect(100, 50) }, { kind: 'area', pts: rect(20, 20, lat + north(80), lng) }] } }, sam);
ok('sales can change the drawing on their lead', r.status === 200 && r.body.lead.map.shapes.length === 2 && Math.abs(r.body.lead.map.sqft - 5400) <= 2 && r.body.lead.sqft === 5000);
r = await call('PATCH', 'leads/' + mike.id, { use_map_size: true }, sam);
ok('"use the drawing size" changes the job size and says so in the notes', Math.abs(r.body.lead.sqft - 5400) <= 2 && r.body.lead.notes.at(-1).text.includes('Job size changed from 5,000'));
r = await call('PATCH', 'leads/' + mike.id, { map: { shapes: [] } }, sam); ok('saving an empty drawing clears it', r.status === 200 && !r.body.lead.map);
r = await call('PATCH', 'leads/' + mike.id, { map: { shapes: [{ kind: 'line', pts: drive.pts, width_ft: 14 }] }, stage: 'Scheduled', job_date: '2026-12-01', firm_price: 9000 }, sam);
r = await call('GET', 'leads', null, cal); const crewView = r.body.leads.find((l) => l.name === 'Measured Mike');
ok('crew see the drawing on a scheduled job', !!crewView && crewView.map.shapes[0].width_ft === 14);
ok('crew still see no prices', crewView.firm_price === undefined && crewView.est_low === undefined && crewView.options === undefined);
r = await call('PATCH', 'leads/' + mike.id, { map: { shapes: [] } }, cal); ok('crew cannot change or clear a drawing', r.status === 404);
await call('PATCH', 'leads/' + lead.id, { owner: (await call('GET', 'users', null, owner)).body.users.find((u) => u.role === 'owner').id }, owner);
r = await call('PATCH', 'leads/' + lead.id, { map: drawing }, sam); ok('sales cannot draw on a lead that belongs to someone else', r.status === 404);
r = await call('GET', 'leads'); ok('signed-out visitors cannot read leads or drawings', r.status === 401);
ok('the address search stores no addresses', ![...mem.keys()].some((k) => k.startsWith('georate/') && mem.get(k).includes('Cotton')));

// ----- the website step counter -----
for (const e of ['visit', 'visit', 'quote_start', 'quote_priced', 'map_open']) await call('POST', 'track', { e }, null, '7.7.7.7');
r = await call('POST', 'track', { e: 'made_up_thing' }, null, '7.7.7.7'); ok('an unknown step is ignored without an error', r.status === 200);
r = await call('GET', 'stats', null, owner); ok('the owner sees the counts for 7 and 30 days', r.status === 200 && r.body.d7.visit === 2 && r.body.d30.quote_priced === 1 && r.body.d7.map_open === 1 && r.body.d7.made_up_thing === undefined && /^\d{4}-\d{2}-\d{2}$/.test(r.body.since));
r = await call('GET', 'stats', null, sam); ok('sales cannot see the website counts', r.status === 404);
r = await call('GET', 'stats', null, cal); ok('crew cannot see the website counts', r.status === 404);
r = await call('GET', 'stats'); ok('signed-out visitors cannot read the counts', r.status === 401);
ok('the counter keeps no names, phones or addresses', [...mem.keys()].filter((k) => k.startsWith('stats/')).every((k) => /^\{("[a-z_]+":\d+,?)+\}$/.test(mem.get(k))));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
