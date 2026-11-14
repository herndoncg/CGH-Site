// Runs the back end against an in-memory store and walks through the main flows.
// Run: node scripts/test-api.mjs
import { createHash } from 'node:crypto';
import * as core from '../netlify/functions/lib/core.mjs';
const mem = new Map();
const store = { get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), setJSON: async (k, v) => void mem.set(k, JSON.stringify(v)), delete: async (k) => void mem.delete(k), list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }) };
let pass = 0, fail = 0;
const ok = (label, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const pushed = [];
const push = { key: async () => 'TESTKEY', send: async (sub, msg) => { pushed.push({ to: sub.endpoint, ...msg }); return 'ok'; } };
const call = async (method, path, body, cookie, extra = {}) => { // (extra = more request headers)
  const r = await core.handle(new Request('https://x.test/api/' + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined }), store, push); const set = r.headers.get('set-cookie'); return { status: r.status, body: await r.json(), cookie: set ? set.split(';')[0] : undefined }; };
const TEMP = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
// The real owner code is not in this repo. The test uses its own.
process.env.CGH_SETUP_HASH = sha('TEST-CODE-12345');

// ----- the owner's first sign-in -----
let r = await call('GET', 'state'); ok('fresh site has no owner yet', r.body.needsSetup === true && r.body.me === null);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'WRONG-CODE-00000' }); ok('a wrong temporary password does not create the owner', r.status === 401 && !mem.has('meta/owner'));
r = await call('POST', 'login', { email: 'owner@example.com', password: ' test-code-12345 ' }); ok('owner signs in with the temporary password', r.status === 200 && r.body.me.role === 'owner' && r.body.me.mustChange === true); const ownerTemp = r.cookie;
r = await call('GET', 'leads', null, ownerTemp); ok('a temporary password opens nothing until it is changed', r.status === 403);
r = await call('POST', 'password', { next: 'short', name: 'Colton' }, ownerTemp); ok('short password is refused', r.status === 400);
r = await call('POST', 'password', { next: 'TEST-CODE-12345', name: 'Colton' }, ownerTemp); ok('the new password cannot be the temporary one', r.status === 400);
r = await call('POST', 'password', { next: 'a-long-password' }, ownerTemp); ok('owner must give a name', r.status === 400);
r = await call('POST', 'password', { next: 'a-long-password', name: 'Colton' }, ownerTemp); ok('owner chooses a password and is in', r.status === 200 && r.body.me.mustChange === false && r.body.me.name === 'Colton'); const owner = r.cookie;
r = await call('GET', 'leads', null, ownerTemp); ok('the temporary sign-in stops working after the change', r.status === 401);
r = await call('POST', 'login', { email: 'someone-else@example.com', password: 'TEST-CODE-12345' }); ok('the owner code works for one account only', r.status === 401);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'TEST-CODE-12345' }); ok('the owner code no longer signs in', r.status === 401);
r = await call('POST', 'setup', { code: 'TEST-CODE-12345', name: 'x', email: 'x@x.co', password: 'a-long-password' }); ok('setup cannot run twice', r.status === 409);
r = await call('POST', 'login', { email: 'OWNER@example.com', password: 'a-long-password' }); ok('owner can sign in with the new password', r.status === 200 && r.body.me.role === 'owner');
r = await call('GET', 'leads'); ok('signed-out visitors cannot read leads', r.status === 401);
r = await call('POST', 'logout', {}, owner, { origin: 'https://evil.example' }); ok('another website cannot send changes', r.status === 403);
r = await call('GET', 'leads', null, owner, { origin: 'https://x.test' }); ok('the site itself still works', r.status === 200);

// ----- quotes and alerts -----
r = await call('POST', 'push-subscribe', { sub: { endpoint: 'https://push.example/owner', keys: {} } }, owner); ok('owner can turn on alerts for a device', r.status === 200);
r = await call('POST', 'push-subscribe', { sub: { endpoint: 'https://push.example/x', keys: {} } }); ok('signed-out visitors cannot register for alerts', r.status === 401);
r = await call('POST', 'lead', { name: 'Pat Customer', phone: '903-555-0100', email: 'pat@example.com', job_type: 'Driveway', sqft: '2500', est_low: '1', est_high: '2', est_total: '3' }); ok('website quote is accepted', r.status === 200 && !!r.body.ref); const patRef = r.body.ref;
ok('the server works out three price ranges and ignores numbers sent by the browser', r.body.quote.options.map((o) => `${o.name} ${o.low}-${o.high}`).join(', ') === 'Economy 8000-9200, Premium 9000-10200, Elite 10350-11950');
ok('the public answer carries no rates, totals or line prices', !JSON.stringify(r.body).match(/rate|total|3\.35|0\.35|1500|600/));
ok('a new quote alerts the owner', pushed.length === 1 && pushed[0].title.includes('Pat Customer') && pushed[0].body.includes('$8,000'));
r = await call('POST', 'lead-request', { ref: 'not-a-real-ref', want: 'call' }); ok('a made-up reference cannot touch a lead', r.status === 404);
r = await call('POST', 'lead-request', { ref: patRef, want: 'visit', when: 'Morning', note: 'Gate code 1234', option: 'Premium' }); ok('customer can ask for a site visit right after the quote', r.status === 200 && pushed.length === 2 && pushed[1].title.includes('site visit') && Object.keys(r.body).join() === 'ok');
r = await call('POST', 'lead', { name: 'Bot', phone: '9035550100', 'bot-field': 'x' }); r = await call('GET', 'leads', null, owner); ok('spam trap submissions are dropped', r.body.leads.length === 1);
const lead = r.body.leads[0]; ok('owner sees the lead with its price range', lead.est_low === 8000 && lead.stage === 'New');

ok('the lead keeps all three ranges and the option they lean toward', lead.options.length === 3 && lead.options[2].high === 11950 && lead.request.option === 'Premium');
{ const ipHdr = { 'x-nf-client-connection-ip': '203.0.113.9' }; let last; for (let i = 0; i < 11; i++) last = await call('POST', 'lead', { name: 'Curve Mapper', phone: '9035550199', sqft: String(1000 + i * 100) }, null, ipHdr); ok('one address is cut off after ten quotes in an hour', last.status === 429); for (const k of [...mem.keys()]) if (k.startsWith('leads/') && JSON.parse(mem.get(k)).name === 'Curve Mapper') mem.delete(k); }
r = await call('POST', 'lead', { name: 'Deep Detail', phone: '9035550188', sqft: '2500', base_work: 'Yes', fill_pct: '50', mode: 'advanced', rock_depth: '6', existing: 'Old asphalt', access: 'Narrow gate', timeline: 'This month' }); ok('a detailed quote prices deeper rock and flags tear-out', r.body.quote.options[0].low === 11100 && r.body.quote.options[0].high === 12850 && r.body.quote.flags.length === 1 && r.body.quote.includes.length === 3);
for (const k of [...mem.keys()]) if (k.startsWith('leads/') && JSON.parse(mem.get(k)).name === 'Deep Detail') { ok('the detailed answers land on the lead as a note', JSON.parse(mem.get(k)).notes[0].text.includes('Narrow gate')); mem.delete(k); }
r = await call('GET', 'pricing'); ok('website prices are not readable without signing in', r.status === 401);

// ----- the price without a name or phone (Nov 14, 2026) -----
{ const leadsNow = () => [...mem.keys()].filter((k) => k.startsWith('leads/')).length, alertsNow = pushed.length, leadsBefore = leadsNow();
  r = await call('POST', 'quote', { job_type: 'Driveway', sqft: '2500', base_work: 'No', fill_pct: '0', est_low: '1' });
  ok('anyone can see the price with no name or phone', r.status === 200 && r.body.quote.options.map((o) => `${o.name} ${o.low}-${o.high}`).join(', ') === 'Economy 8000-9200, Premium 9000-10200, Elite 10350-11950');
  ok('looking at a price saves no lead and alerts nobody', leadsNow() === leadsBefore && pushed.length === alertsNow && !r.body.ref);
  ok('the price answer carries no rates, totals or line prices', !JSON.stringify(r.body).match(/rate|total|3\.35|0\.35|1500|600/));
  ok('each choice says how long it lasts and how it works', r.body.quote.options.every((o) => o.lasts && o.how));
  r = await call('POST', 'quote', { sqft: '20' }); ok('a price needs a real size', r.status === 400);
  r = await call('POST', 'quote', { sqft: '2500', 'bot-field': 'x' }); ok('spam bots get no price', r.status === 200 && !r.body.quote);
  // seal coat on asphalt that is already there
  r = await call('POST', 'quote', { service: 'seal', sqft: '2500', condition: 'Some cracks', striping: 'Yes' });
  ok('a seal coat shows four choices from the sheet at $0.75, $0.90 and $1.10 a square foot', r.body.quote.options.map((o) => `${o.name} ${o.low}-${o.high}`).join(', ') === 'Standard 1800-2050, Standard, rich black 1800-2050, Premium 2150-2500, Heavy duty 2600-3050');
  ok('cracks and stripes are flagged as priced on the visit', r.body.quote.flags.length === 2 && r.body.quote.options.every((o) => o.lasts && o.how));
  ok('the seal coat answer carries no per-foot prices', !JSON.stringify(r.body).match(/rate|total|0\.75|0\.9\b|1\.1\b/));
  r = await call('POST', 'quote', { service: 'seal', sqft: '300' }); ok('a small seal coat job never shows under $350', r.body.quote.options.every((o) => o.low === 350 && o.high === 400));
  // sending it in: one step, one lead, one alert
  r = await call('POST', 'lead', { service: 'seal', name: 'Sue Sealer', phone: '903-555-0144', job_type: 'Parking lot', sqft: '2500', condition: 'Some cracks', want: 'call', when: 'Morning', option: 'Premium', note: 'Back lot only' });
  const sue = [...mem.entries()].filter(([k]) => k.startsWith('leads/')).map(([, v]) => JSON.parse(v)).find((l) => l.name === 'Sue Sealer');
  ok('sending the quote in makes one lead with the request on it', r.status === 200 && sue && sue.job_type === 'Seal coat · Parking lot' && sue.est_low === 1800 && sue.options.length === 4 && sue.request.want === 'call' && sue.request.option === 'Premium' && sue.notes.some((n) => n.text.includes('Some cracks')));
  ok('and one alert that says what they want', pushed.length === alertsNow + 1 && pushed.at(-1).title === 'Sue Sealer wants a call' && pushed.at(-1).body.includes('903-555-0144') && pushed.at(-1).body.includes('Leaning Premium'));
  for (const k of [...mem.keys()]) if (k.startsWith('leads/') && JSON.parse(mem.get(k)).name === 'Sue Sealer') mem.delete(k);
  // the hourly limit on prices, and that it does not block someone from sending theirs in
  const ipHdr = { 'x-nf-client-connection-ip': '203.0.113.44' }; let last;
  for (let i = 0; i < 10; i++) last = await call('POST', 'quote', { sqft: String(1000 + i * 100) }, null, ipHdr); ok('one address can price ten different jobs in an hour', last.status === 200);
  last = await call('POST', 'quote', { sqft: '1000' }, null, ipHdr); ok('asking again about the same job does not count against the limit', last.status === 200);
  last = await call('POST', 'quote', { sqft: '5555' }, null, ipHdr); ok('an eleventh different job is told to call', last.status === 429 && !last.body.quote);
  last = await call('POST', 'lead', { name: 'Late Decider', phone: '9035550155', sqft: '1500' }, null, ipHdr); ok('someone who priced a lot of sizes can still send theirs in', last.status === 200 && !!last.body.ref);
  for (const k of [...mem.keys()]) if (k.startsWith('leads/') && JSON.parse(mem.get(k)).name === 'Late Decider') mem.delete(k);
  r = await call('GET', 'home', null, owner); ok('the owner sees how many prices the website showed this week', r.body.stats.priced >= 13);
}

// ----- team logins with temporary passwords -----
r = await call('POST', 'users', { name: 'Sam Sales', email: 'sam@example.com', role: 'sales' }, owner); ok('owner adds a sales login and gets a temporary password', r.status === 200 && TEMP.test(r.body.temp) && r.body.user.mustChange === true); const samTemp = r.body.temp;
r = await call('POST', 'users', { name: 'Cal Crew', email: 'cal@example.com', role: 'crew' }, owner); const calTemp = r.body.temp;
r = await call('POST', 'login', { email: 'sam@example.com', password: samTemp.toLowerCase() + ' ' }); ok('new hire signs in with the temporary password', r.status === 200 && r.body.me.mustChange === true); let sam = r.cookie;
r = await call('GET', 'leads', null, sam); ok('new hire sees nothing until they choose a password', r.status === 403);
r = await call('POST', 'password', { next: 'sams-long-password' }, sam); ok('new hire chooses their own password', r.status === 200 && r.body.me.role === 'sales' && !r.body.me.mustChange); sam = r.cookie;
r = await call('POST', 'login', { email: 'sam@example.com', password: samTemp }); ok('a temporary password stops working once it is changed', r.status === 401);
r = await call('POST', 'login', { email: 'cal@example.com', password: calTemp }); r = await call('POST', 'password', { next: 'cals-long-password' }, r.cookie); let cal = r.cookie;
r = await call('POST', 'users', { name: 'Old Temp', email: 'old@example.com', role: 'crew' }, owner); const oldTemp = r.body.temp; { const u = await store.get('users/' + r.body.user.id); u.temp_exp = Date.now() - 1000; await store.setJSON('users/' + u.id, u); }
r = await call('POST', 'login', { email: 'old@example.com', password: oldTemp }); ok('a temporary password expires after 14 days', r.status === 401 && r.body.error.includes('expired'));
r = await call('GET', 'users', null, sam); ok('sales cannot list team logins', r.status === 404);
r = await call('GET', 'applicants', null, sam); ok('sales cannot read applicants', r.status === 404);
const ownerId = (await store.get('meta/owner')).id;
r = await call('PATCH', 'leads/' + lead.id, { owner: ownerId }, owner); r = await call('GET', 'leads', null, sam); ok('sales does not see leads assigned to someone else', r.body.leads.length === 0);
r = await call('PATCH', 'leads/' + lead.id, { owner: '' }, owner); r = await call('PATCH', 'leads/' + lead.id, { stage: 'Quote sent', firm_price: '8600', note: 'Walked the site.' }, sam); ok('sales can update an open lead', r.status === 200 && r.body.lead.firm_price === 8600 && r.body.lead.notes.length === 2 && r.body.lead.request.want === 'visit');
r = await call('GET', 'leads', null, cal); ok('crew see nothing until a job is scheduled', r.body.leads.length === 0);

// ----- customer login -----
r = await call('POST', 'leads/' + lead.id + '/invite', {}, sam); ok('sales can create the customer login', r.status === 200 && TEMP.test(r.body.temp) && r.body.email === 'pat@example.com'); const patTemp = r.body.temp;
r = await call('POST', 'login', { email: 'pat@example.com', password: patTemp }); const patFirst = r.cookie;
r = await call('GET', 'my-job', null, patFirst); ok('customer sees nothing until they choose a password', r.status === 403);
r = await call('POST', 'password', { next: 'pats-long-password' }, patFirst); const pat = r.cookie; ok('customer chooses their own password', r.body.me.role === 'client');
r = await call('GET', 'my-job', null, pat); ok('customer sees their own job and price', r.body.job.firm_price === 8600 && r.body.job.stage === 'Quote sent' && r.body.job.notes === undefined && r.body.job.phone === undefined);
r = await call('GET', 'leads', null, pat); ok('customer cannot read the lead list', r.status === 404);
r = await call('GET', 'users', null, pat); ok('customer cannot read the team list', r.status === 404);
r = await call('POST', 'my-job/accept', {}, pat); ok('customer can accept the quote', r.body.job.stage === 'Accepted');
r = await call('PATCH', 'leads/' + lead.id, { stage: 'Scheduled', job_date: '2026-12-01' }, owner); r = await call('GET', 'leads', null, cal); ok('crew see scheduled jobs without prices or email', r.body.leads.length === 1 && r.body.leads[0].firm_price === undefined && r.body.leads[0].est_low === undefined && r.body.leads[0].email === undefined);
r = await call('PATCH', 'leads/' + lead.id, { stage: 'Done' }, cal); ok('crew cannot edit leads', r.status === 404);
r = await call('POST', 'apply', { name: 'Jo Applicant', phone: '9035550111', position: 'Equipment Operator' }); r = await call('GET', 'applicants', null, owner); ok('job application reaches the owner', r.body.applicants.length === 1);
r = await call('GET', 'applicants', null, cal); ok('crew cannot read applicants', r.status === 404);
r = await call('POST', 'training', { lesson: 'paver-safety' }, cal); ok('crew can mark a lesson done', !!r.body.done['paver-safety'] && r.body.team === undefined);
r = await call('GET', 'training', null, owner); ok('owner sees team training progress', r.body.team.some((t) => t.name === 'Cal Crew' && t.done['paver-safety']));

// ----- home, announcements, equipment -----
r = await call('GET', 'home', null, owner); ok('owner home shows what is waiting', r.status === 200 && r.body.waiting.applicants === 1 && r.body.waiting.lessons === 7 && r.body.dated.some((d) => d.kind === 'Paving day' && d.date === '2026-12-01'));
r = await call('GET', 'home', null, cal); ok('crew home has no sales counts and only paving days', r.body.waiting.fresh === undefined && r.body.waiting.lessons === 6 && r.body.dated.every((d) => d.kind === 'Paving day'));
r = await call('GET', 'home', null, pat); ok('customers cannot open the team home', r.status === 404);
r = await call('POST', 'announcements', { title: 'Yard cleanup Friday', body: 'Be at the shop at 7.' }, sam); ok('only the owner can post announcements', r.status === 403);
const before = pushed.length; r = await call('POST', 'announcements', { title: 'Yard cleanup Friday', body: 'Be at the shop at 7.' }, owner); ok('owner posts an announcement and the team is alerted', r.status === 200 && pushed.length === before + 1); const annId = r.body.announcement.id;
r = await call('GET', 'announcements', null, cal); ok('crew can read announcements', r.body.announcements.length === 1);
r = await call('DELETE', 'announcements/' + annId, null, cal); ok('crew cannot delete announcements', r.status === 403);
r = await call('GET', 'equipment', null, cal); ok('the fleet list starts with the seven machines', r.body.equipment.length === 7); const paver = r.body.equipment.find((e) => e.name === 'Asphalt paver');
r = await call('PATCH', 'equipment/' + paver.id, { status: 'Down', hours: '1204', note: 'Hydraulic leak at the screed.' }, cal); ok('crew can report a machine down with hours and a note', r.body.item.status === 'Down' && r.body.item.hours === 1204 && r.body.item.log[0].text.includes('Hydraulic') && pushed.at(-1).title.includes('Asphalt paver'));
r = await call('POST', 'equipment', { name: 'Water truck', kind: 'Hauling' }, cal); ok('only the owner can add machines', r.status === 403);
r = await call('POST', 'equipment', { name: 'Water truck', kind: 'Hauling' }, owner); r = await call('GET', 'equipment', null, owner); ok('owner can add a machine and the seven are not re-added', r.body.equipment.length === 8);
r = await call('POST', 'leads', { name: 'Quick Quote', phone: '9035550122', sqft: '1200', est_low: '4050', est_high: '4700', base_work: 'Yes' }, sam); ok('a quick quote saves as a lead with its numbers', r.body.lead.est_low === 4050 && r.body.lead.owner);
r = await call('GET', 'equipment', null, pat); ok('customers cannot see equipment', r.status === 404);

// ----- follow-ups, job checklist, job log -----
r = await call('PATCH', 'leads/' + lead.id, { follow_up: '2026-11-10' }, owner); r = await call('GET', 'home?today=2026-11-12', null, owner); ok('a follow-up that has come due shows on Home', r.body.waiting.followups === 1 && r.body.stats.week >= 1 && r.body.stats.booked === 8600);
r = await call('GET', 'home?today=2026-11-01', null, owner); ok('a follow-up in the future does not', r.body.waiting.followups === 0);
r = await call('POST', 'leads/' + lead.id + '/check', { item: 'Paved', done: true }, cal); ok('crew can tick the job checklist', r.status === 200 && r.body.lead.checklist.Paved.by === 'Cal Crew' && r.body.lead.firm_price === undefined);
r = await call('POST', 'leads/' + lead.id + '/check', { item: 'Made up', done: true }, cal); ok('only real checklist items are accepted', r.status === 400);
r = await call('POST', 'leads/' + lead.id + '/log', { text: 'Soft spot by the gate, added a load of rock.' }, cal); ok('crew can add a job note', r.body.lead.joblog[0].text.includes('Soft spot'));
r = await call('GET', 'leads', null, owner); ok('owner sees the checklist and the job log', r.body.leads.find((l) => l.id === lead.id).joblog.length === 1 && !!r.body.leads.find((l) => l.id === lead.id).checklist.Paved);
r = await call('POST', 'leads/' + lead.id + '/log', { text: 'x' }, pat); ok('customers cannot write to the job log', r.status === 404);
r = await call('GET', 'home', null, cal); ok('crew get no sales numbers on Home', r.body.stats === undefined && r.body.waiting.followups === undefined);

r = await call('GET', 'pricing', null, sam); ok('sales can load prices for Quick quote', r.status === 200 && r.body.prices.minimumJob === 3500);
r = await call('GET', 'pricing', null, cal); ok('crew cannot load prices', r.status === 404);

// ----- estimate settings: contractor cost is the owner's alone -----
r = await call('POST', 'estimate-settings', { contractor: { hotmix_sqyd: '18' } }, sam); ok('sales cannot change estimate numbers', r.status === 403);
r = await call('POST', 'estimate-settings', { prices: { hotmix_sqyd: '33', tax_pct: '8.25' }, contractor: { hotmix_sqyd: '18', seal_sqft: '0.1' }, materials: { d: { perTon: '100', exempt: true } } }, owner); ok('owner saves prices, contractor cost and material prices', r.status === 200);
r = await call('GET', 'estimate-settings', null, owner); ok('owner reads them back', r.body.prices.hotmix_sqyd === 33 && r.body.contractor.hotmix_sqyd === 18 && r.body.materials.d.perTon === 100 && r.body.materials.d.exempt === true);
r = await call('GET', 'estimate-settings', null, sam); ok('sales get customer prices but never contractor cost or material prices', r.body.prices.hotmix_sqyd === 33 && r.body.contractor === undefined && r.body.materials === undefined);
r = await call('GET', 'estimate-settings', null, cal); ok('crew cannot open estimate numbers', r.status === 404);
r = await call('GET', 'estimate-settings', null, pat); ok('customers cannot open estimate numbers', r.status === 404);
r = await call('POST', 'leads', { name: 'Three Option', phone: '9035550133', sqft: '900', firm_price: '3464', source: 'three-option estimate' }, sam); ok('an estimate saves as a lead with its price', r.body.lead.firm_price === 3464);

// ----- managers: see everything, but cannot touch the owner or make other managers -----
r = await call('POST', 'users', { name: 'Max Manager', email: 'max@example.com', role: 'manager', phone: '903-555-0177' }, owner); ok('owner adds a manager', r.status === 200 && r.body.user.role === 'manager' && r.body.user.phone === '903-555-0177'); const maxTemp = r.body.temp, maxId = r.body.user.id;
r = await call('POST', 'login', { email: 'max@example.com', password: maxTemp }); r = await call('POST', 'password', { next: 'maxs-long-password' }, r.cookie); const max = r.cookie;
r = await call('GET', 'leads', null, max); ok('manager sees every lead with prices', r.body.leads.length >= 3 && r.body.leads.some((l) => l.firm_price === 8600));
r = await call('GET', 'applicants', null, max); ok('manager sees applicants', r.status === 200);
r = await call('GET', 'users', null, max); ok('manager sees the team list', r.status === 200);
r = await call('GET', 'estimate-settings', null, max); ok('manager sees contractor cost', r.body.contractor.hotmix_sqyd === 18);
r = await call('POST', 'users', { name: 'New Crew', email: 'newcrew@example.com', role: 'crew' }, max); ok('manager can add crew', r.status === 200);
r = await call('POST', 'users', { name: 'Second Manager', email: 'm2@example.com', role: 'manager' }, max); ok('manager cannot add another manager', r.status === 403);
r = await call('PATCH', 'users/' + ownerId, { disabled: true }, max); ok('manager cannot touch the owner', r.status === 404);
r = await call('PATCH', 'users/' + maxId, { role: 'sales' }, max); ok('manager cannot change a manager', r.status === 404);
r = await call('PATCH', 'users/' + (await store.get('emails/' + sha('sam@example.com'))).id, { role: 'manager' }, max); ok('only the owner can change roles', r.status === 403);
r = await call('PATCH', 'users/' + maxId, { role: 'crew' }, owner); r = await call('GET', 'applicants', null, max); ok('owner can change a role and it takes effect right away', r.status === 404);
r = await call('POST', 'users', { name: 'Bad Role', email: 'bad@example.com', role: 'owner' }, owner); ok('nobody can create a second owner', r.status === 400);

// ----- resetting, changing, turning off -----
const calId = (await store.get('emails/' + sha('cal@example.com'))).id;
r = await call('PATCH', 'users/' + calId, { reset: true }, owner); ok('owner can reset a password to a new temporary one', r.status === 200 && TEMP.test(r.body.temp) && r.body.temp !== calTemp); const calTemp2 = r.body.temp;
r = await call('GET', 'leads', null, cal); ok('a reset signs that person out', r.status === 401);
r = await call('POST', 'login', { email: 'cal@example.com', password: 'cals-long-password' }); ok('the old password stops working after a reset', r.status === 401);
r = await call('POST', 'login', { email: 'cal@example.com', password: calTemp2 }); r = await call('POST', 'password', { next: 'cals-newer-password' }, r.cookie); cal = r.cookie;
r = await call('PATCH', 'users/' + calId, { reset: true }, sam); ok('sales cannot reset passwords', r.status === 404);
r = await call('PATCH', 'users/' + calId, { disabled: true }, owner); r = await call('GET', 'leads', null, cal); ok('a disabled login stops working', r.status === 401);
r = await call('POST', 'password', { current: 'not-my-password', next: 'owners-second-password' }, owner); ok('changing a password needs the current one', r.status === 403);
r = await call('POST', 'password', { current: 'a-long-password', next: 'owners-second-password' }, owner); ok('owner can change their password', r.status === 200 && !!r.cookie); const owner2 = r.cookie;
r = await call('GET', 'leads', null, owner); ok('changing a password signs out other devices', r.status === 401);
r = await call('GET', 'leads', null, owner2); ok('the device that changed it stays signed in', r.status === 200);
r = await call('POST', 'logout', {}, sam); r = await call('GET', 'leads', null, sam); ok('signing out ends the session', r.status === 401);
// ----- owner recovery -----
process.env.CGH_RECOVERY_HASH = sha('RECOVER-CODE-999');
r = await call('POST', 'login', { email: 'colton@example.com', password: 'RECOVER-CODE-000' }); ok('a wrong recovery code does nothing', r.status === 401);
r = await call('POST', 'login', { email: 'sam@example.com', password: 'RECOVER-CODE-999' }); ok('the recovery code cannot take over someone else\'s email', r.status === 401);
r = await call('POST', 'login', { email: 'colton@example.com', password: 'recover-code-999' }); ok('the recovery code moves the owner login to a new email', r.status === 200 && r.body.me.role === 'owner' && r.body.me.mustChange === true && r.body.me.email === 'colton@example.com'); const rec = r.cookie;
r = await call('GET', 'leads', null, owner2); ok('recovery signs the old owner session out', r.status === 401);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-second-password' }); ok('the old owner email no longer signs in', r.status === 401);
r = await call('POST', 'login', { email: 'third@example.com', password: 'RECOVER-CODE-999' }); ok('the recovery code works once', r.status === 401);
r = await call('POST', 'password', { next: 'recovered-password' }, rec); ok('recovered owner chooses a password and keeps their records', r.status === 200 && r.body.me.name === 'Colton'); r = await call('GET', 'leads', null, r.cookie); ok('recovered owner still sees the leads', r.status === 200 && r.body.leads.length === 3);
for (let i = 0; i < 5; i++) await call('POST', 'login', { email: 'sam@example.com', password: 'bad-bad-bad-bad' }); r = await call('POST', 'login', { email: 'sam@example.com', password: 'sams-long-password' }); ok('five bad passwords lock sign-in for a while', r.status === 429);
ok('no password is stored in readable form', ![...mem.values()].some((v) => ['a-long-password', 'sams-long-password', 'owners-second-password', 'TEST-CODE-12345', 'RECOVER-CODE-999', 'recovered-password', samTemp, calTemp2, patTemp].some((p) => v.includes(p))));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
