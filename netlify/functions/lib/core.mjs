// The CGH app's back end. One small program that answers every /api/... request.
//
// Plain version: it keeps four kinds of records (people who can sign in, leads, job applicants,
// and who has finished which training) and decides who is allowed to see or change each one.
//
// Storage is passed in as `store`, so the same code runs on Netlify (Netlify Blobs) and in tests.
// Passwords are never stored: only a salted scrypt hash. Sign-in sessions last 30 days.
//
// New logins start with a temporary password. The first sign-in forces the person to choose their own.
// Changing or resetting a password signs that person out everywhere else.
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

// The owner's first temporary password (the setup code). Only its fingerprint lives here, and it stops
// working the moment the owner account exists.
export const SETUP_HASH = '877f19dc823c32a131f4ac88749165bed3fb5dee888de6a37ffcc902c5cc3a77';

// A one-time owner recovery code, for when the owner is locked out or the account landed on the wrong
// email. Signing in with any email plus this code moves the owner login to that email and forces a new
// password. Only the fingerprint lives here, and each code works once.
export const RECOVERY_HASH = '91d540e8eced52aed5ef046f94e82a2de69c918911c9046cffd9385a19ba6403';
const recoveryHash = () => (typeof process !== 'undefined' && process.env && process.env.CGH_RECOVERY_HASH) || RECOVERY_HASH;

// The fingerprint can also be supplied as a site setting (CGH_SETUP_HASH) instead of living in this file.
const setupHash = () => (typeof process !== 'undefined' && process.env && process.env.CGH_SETUP_HASH) || SETUP_HASH;

export const STAGES = ['New', 'Contacted', 'Site visit set', 'Quote sent', 'Accepted', 'Scheduled', 'Done', 'Lost'];
const STAFF = ['owner', 'sales', 'crew'];
const ROLES = [...STAFF, 'client'];

export const LESSONS = [
  { id: 'values', title: 'Who we are and how we work', minutes: 5, points: ['CGH Operations is a faith-driven company. We tell customers the truth about what their job needs, even when it costs us the sale.', 'Show up on time. If you are running late, call before the start time, not after.', 'Leave every site cleaner than we found it. The customer remembers the cleanup as much as the pavement.', 'If you make a mistake, say so right away. We can fix a mistake we know about.'] },
  { id: 'paver-safety', title: 'Working safely around the paver and roller', minutes: 10, points: ['Never walk between the dump truck and the paver hopper. Stay where the operator and the driver can both see you.', 'Make eye contact with the operator before you step near a moving machine. If you cannot see the operator, the operator cannot see you.', 'The roller cannot stop fast and has blind spots front and back. Never stand or kneel in its path.', 'Hot mix arrives at around 300 degrees. Wear boots, long pants, gloves and eye protection. Treat burns with cool water and tell the crew lead.', 'Backing trucks need a spotter. One spotter, clear hand signals, and the driver stops if the spotter is out of sight.'] },
  { id: 'hot-mix', title: 'Raking, luting and compacting hot mix', minutes: 10, points: ['Mix cools fast. Work the joint and the edges first, while the mat is still hot enough to move.', 'Lute to fill low spots and knock down high ones. Do not broadcast loose mix across a finished mat; it leaves a rough texture.', 'Keep edges straight and tamped. A clean edge is the first thing a customer notices.', 'Rolling starts while the mat is hot and finishes before it cools. Follow the crew lead on the rolling pattern.', 'Check for water flow before you leave. Low spots hold water and become the first failure.'] },
  { id: 'traffic', title: 'Working next to the road', minutes: 8, points: ['Any time a truck or a person is at the road edge, cones and signs go out first.', 'Wear a high-visibility vest whenever you are within a truck length of traffic.', 'Never turn your back to live traffic while flagging a truck in or out.', 'Keep mud, rock and loose mix off the public road. Sweep it before we leave.'] },
  { id: 'measure', title: 'Measuring a job and reading the ground', minutes: 8, points: ['Measure length and width in feet and multiply for square feet. Break odd shapes into rectangles and add them up.', 'Walk the whole area. Look for soft spots, washouts, standing water and thin gravel. Those decide whether base work is needed.', 'Ask where the water goes now and where the customer wants it to go.', 'Take photos before anything is touched: the full area, each problem spot, and the tie-in at the road and the garage.', 'Write down access problems: low limbs, tight gates, septic lines, sprinkler heads.'] },
  { id: 'sales', title: 'Talking to a customer about a quote', minutes: 8, points: ['Start with their problem, not our price. Ask what is bothering them about the driveway or lot.', 'The website gives a price range. Our job on the site visit is to confirm it and explain what the number includes.', 'Explain the three parts in plain words: the asphalt, the rock base where it is needed, and grading so water runs off.', 'Never promise a date or a price you are not sure of. Say you will confirm, then confirm the same day.', 'Log every lead and every conversation in the app before the end of the day.'] },
  { id: 'app', title: 'Using this app', minutes: 5, points: ['Website quotes show up under Leads as New. Call them the same day.', 'Move a lead to the next stage as soon as it changes, and add a short note about what was said.', 'After a firm quote, create the customer login so they can see their price, dates and status.', 'Never share your sign-in. If someone needs access, ask the owner to add them.'] },
];

const newId = () => randomBytes(9).toString('base64url');
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const hashPw = (pw, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
const checkPw = (pw, stored) => { const [salt, h] = String(stored).split(':'); const a = Buffer.from(h, 'hex'); const b = scryptSync(pw, salt, 64); return a.length === b.length && timingSafeEqual(a, b); };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff', ...headers } });
const bad = (error, status = 400) => json({ error }, status);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const email = (v) => clean(v, 200).toLowerCase();
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.pass && !u.must_change, disabled: !!u.disabled, mustChange: !!u.must_change });
const TEMP_DAYS = 14;
// A temporary password like K7QM-4TXP-9RWD (no look-alike letters such as O/0 or I/1).
const tempPw = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = randomBytes(12); return [0, 4, 8].map((i) => [...r.subarray(i, i + 4)].map((x) => A[x % A.length]).join('')).join('-'); };
// Gives a login a fresh temporary password and signs that person out everywhere.
const setTemp = (u) => { const t = tempPw(); u.pass = hashPw(t); u.must_change = true; u.temp_exp = Date.now() + TEMP_DAYS * 864e5; u.sv = (u.sv || 0) + 1; return t; };
// Temporary passwords are forgiving about spaces and lower-case typing.
const matches = (pw, u) => !!u.pass && (checkPw(pw, u.pass) || (!!u.must_change && checkPw(pw.trim().toUpperCase(), u.pass)));

async function readBody(req) {
  const type = req.headers.get('content-type') || '';
  try { return type.includes('json') ? await req.json() : Object.fromEntries((await req.formData()).entries()); } catch { return {}; }
}
async function all(store, prefix) {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
}
async function currentUser(req, store) {
  const m = /(?:^|;\s*)cgh_s=([^;]+)/.exec(req.headers.get('cookie') || '');
  if (!m) return null;
  const s = await store.get('sessions/' + sha(m[1]), { type: 'json' });
  if (!s || s.exp < Date.now()) return null;
  const u = await store.get('users/' + s.uid, { type: 'json' });
  return u && !u.disabled && (s.v || 0) === (u.sv || 0) ? u : null;
}
async function startSession(store, u) {
  const token = randomBytes(32).toString('base64url');
  await store.setJSON('sessions/' + sha(token), { uid: u.id, v: u.sv || 0, exp: Date.now() + 30 * 864e5 });
  return { 'set-cookie': `cgh_s=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}` };
}
async function userByEmail(store, e) {
  const ref = await store.get('emails/' + sha(e), { type: 'json' });
  return ref ? store.get('users/' + ref.id, { type: 'json' }) : null;
}
async function saveUser(store, u) { await store.setJSON('users/' + u.id, u); await store.setJSON('emails/' + sha(u.email), { id: u.id }); }

// Sends a phone or computer alert to every signed-in device that turned alerts on, for the given roles.
async function alertTeam(store, push, roles, msg) {
  if (!push) return;
  const subs = (await all(store, 'push/')).filter((s) => roles.includes(s.role));
  await Promise.all(subs.map(async (s) => { const r = await push.send(s.sub, msg).catch(() => 'failed'); if (r === 'gone') await store.delete('push/' + s.id); }));
}
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');

// What each role may see of a lead. Crew never see prices. Clients only see their own job.
function leadFor(lead, user) {
  if (user.role === 'owner') return lead;
  if (user.role === 'sales') return !lead.owner || lead.owner === user.id ? lead : null;
  if (user.role === 'crew') {
    if (!['Scheduled', 'Done'].includes(lead.stage)) return null;
    const { id, name, phone, city, job_type, sqft, base_work, fill_pct, loads, stage, job_date, created } = lead;
    return { id, name, phone, city, job_type, sqft, base_work, fill_pct, loads, stage, job_date, created, notes: [] };
  }
  return null;
}
const clientView = (l) => ({ job_type: l.job_type, sqft: l.sqft, city: l.city, est_low: l.est_low, est_high: l.est_high, firm_price: l.firm_price, stage: l.stage, visit_date: l.visit_date, job_date: l.job_date, status_note: l.status_note, accepted_at: l.accepted_at });

export async function handle(req, store, push) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const [a, b, c] = path.split('/');
  const m = req.method;
  // Only this website's own pages may send changes (blocks another site from acting through a signed-in browser).
  const origin = req.headers.get('origin');
  if (m !== 'GET' && origin && origin !== 'null') { let host = ''; try { host = new URL(origin).host; } catch {} if (host !== url.host) return bad('Not allowed.', 403); }
  const data = m === 'GET' ? {} : await readBody(req);

  // ---------- open to the public website ----------
  if (path === 'lead' && m === 'POST') {
    if (data['bot-field'] || data.company_website) return json({ ok: true });
    const name = clean(data.name, 120), phone = clean(data.phone, 40);
    if (!name || phone.replace(/\D/g, '').length < 10) return bad('Name and a 10-digit phone number are required.');
    const lead = { id: newId(), created: Date.now(), source: 'website', stage: 'New', name, phone, email: email(data.email), city: clean(data.city, 200), job_type: clean(data.job_type, 60), sqft: num(data.sqft), base_work: clean(data.base_work, 20), fill_pct: num(data.fill_pct), loads: num(data.loads), est_low: num(data.est_low), est_high: num(data.est_high), est_total: num(data.est_total), notes: [] };
    await store.setJSON('leads/' + lead.id, lead);
    // a private reference the customer's browser keeps, so they can follow up on this same quote
    const ref = randomBytes(18).toString('base64url');
    await store.setJSON('refs/' + sha(ref), { id: lead.id });
    await alertTeam(store, push, ['owner', 'sales'], { title: 'New quote: ' + lead.name, body: [lead.job_type, lead.sqft ? lead.sqft.toLocaleString('en-US') + ' sq ft' : '', lead.est_low ? `${usd(lead.est_low)} to ${usd(lead.est_high)}` : '', lead.city].filter(Boolean).join(' · '), url: '/app/' });
    return json({ ok: true, ref });
  }
  // the customer taps "book my site visit" or "call me" right after seeing their price
  if (path === 'lead-request' && m === 'POST') {
    const found = await store.get('refs/' + sha(clean(data.ref, 100)), { type: 'json' });
    const lead = found ? await store.get('leads/' + found.id, { type: 'json' }) : null;
    if (!lead) return bad('We could not find that quote. Please call us.', 404);
    const want = data.want === 'call' ? 'call' : 'visit', when = clean(data.when, 40), note = clean(data.note, 500);
    lead.request = { want, when, at: Date.now() };
    lead.notes.push({ at: Date.now(), by: 'Customer (website)', text: `Asked for ${want === 'call' ? 'a phone call' : 'a free site visit'}${when ? '. Best time: ' + when : ''}${note ? '. Note: ' + note : ''}` });
    await store.setJSON('leads/' + lead.id, lead);
    await alertTeam(store, push, ['owner', 'sales'], { title: `${lead.name} wants ${want === 'call' ? 'a call' : 'a site visit'}`, body: [lead.phone, when ? 'Best time: ' + when : '', note].filter(Boolean).join(' · '), url: '/app/' });
    return json({ ok: true });
  }
  if (path === 'apply' && m === 'POST') {
    if (data['bot-field'] || data.company_website) return json({ ok: true });
    const name = clean(data.name, 120), phone = clean(data.phone, 40);
    if (!name || phone.replace(/\D/g, '').length < 10) return bad('Name and a 10-digit phone number are required.');
    const app = { id: newId(), created: Date.now(), status: 'New', name, phone, email: email(data.email), city: clean(data.city, 200), position: clean(data.position, 80), cdl: clean(data.cdl, 30), experience_years: clean(data.experience_years, 30), start: clean(data.start, 80), details: clean(data.details, 2000) };
    await store.setJSON('applicants/' + app.id, app);
    await alertTeam(store, push, ['owner'], { title: 'New job application: ' + app.name, body: [app.position, app.city, app.phone].filter(Boolean).join(' · '), url: '/app/' });
    return json({ ok: true });
  }

  // ---------- signing in ----------
  if (path === 'state' && m === 'GET') {
    const me = await currentUser(req, store);
    const meta = await store.get('meta/owner', { type: 'json' });
    return json({ needsSetup: !meta, me: me ? pub(me) : null });
  }
  if (path === 'setup' && m === 'POST') {
    if (await store.get('meta/owner', { type: 'json' })) return bad('Setup is already done. Sign in instead.', 409);
    if (sha(clean(data.code, 100)) !== setupHash()) return bad('That setup code is not right.', 403);
    const e = email(data.email), name = clean(data.name, 120), pw = String(data.password || '');
    if (!name || !/^\S+@\S+\.\S+$/.test(e)) return bad('Enter your name and a valid email.');
    if (pw.length < 10) return bad('Use a password with at least 10 characters.');
    const u = { id: newId(), email: e, name, role: 'owner', pass: hashPw(pw), created: Date.now() };
    await saveUser(store, u); await store.setJSON('meta/owner', { id: u.id });
    return json({ me: pub(u) }, 200, await startSession(store, u));
  }
  if (path === 'login' && m === 'POST') {
    const e = email(data.email), key = 'fails/' + sha(e);
    const f = (await store.get(key, { type: 'json' })) || { n: 0, until: 0 };
    if (f.until > Date.now()) return bad('Too many tries. Wait 15 minutes and try again.', 429);
    const pw = String(data.password || '');
    let u = e ? await userByEmail(store, e) : null;
    // The very first sign-in: the owner's temporary password is the setup code. It works once, for one account.
    if (!u && /^\S+@\S+\.\S+$/.test(e) && sha(pw.trim().toUpperCase()) === setupHash() && !(await store.get('meta/owner', { type: 'json' }))) {
      u = { id: newId(), email: e, name: '', role: 'owner', pass: hashPw(pw.trim().toUpperCase()), must_change: true, created: Date.now() };
      await saveUser(store, u); await store.setJSON('meta/owner', { id: u.id });
    }
    // Owner recovery: the one-time recovery code moves the owner login to this email.
    if (/^\S+@\S+\.\S+$/.test(e) && sha(pw.trim().toUpperCase()) === recoveryHash()) {
      const meta = await store.get('meta/owner', { type: 'json' }), used = await store.get('meta/recovery', { type: 'json' });
      const o = meta ? await store.get('users/' + meta.id, { type: 'json' }) : null;
      if (o && !(used && used.hash === recoveryHash()) && (!u || u.id === o.id)) {
        if (o.email !== e) await store.delete('emails/' + sha(o.email));
        Object.assign(o, { email: e, pass: hashPw(pw.trim().toUpperCase()), must_change: true, disabled: false, sv: (o.sv || 0) + 1 }); delete o.temp_exp;
        await saveUser(store, o); await store.setJSON('meta/recovery', { hash: recoveryHash(), at: Date.now() });
        u = o;
      }
    }
    if (!u || u.disabled || !matches(pw, u)) {
      const n = f.n + 1; await store.setJSON(key, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 15 * 60e3 : 0 });
      return bad('That email and password do not match.', 401);
    }
    if (u.must_change && u.temp_exp && u.temp_exp < Date.now()) return bad('That temporary password has expired. Ask CGH for a new one.', 401);
    await store.delete(key);
    return json({ me: pub(u) }, 200, await startSession(store, u));
  }
  if (path === 'logout' && m === 'POST') {
    const mm = /(?:^|;\s*)cgh_s=([^;]+)/.exec(req.headers.get('cookie') || '');
    if (mm) await store.delete('sessions/' + sha(mm[1]));
    return json({ ok: true }, 200, { 'set-cookie': 'cgh_s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
  }

  // ---------- everything below needs a signed-in person ----------
  const me = await currentUser(req, store);
  if (!me) return bad('Please sign in.', 401);
  const staff = STAFF.includes(me.role), owner = me.role === 'owner';

  // choosing or changing your own password
  if (path === 'password' && m === 'POST') {
    const next = String(data.next || '');
    if (!me.must_change && !checkPw(String(data.current || ''), me.pass)) return bad('Your current password is not right.', 403);
    if (next.length < 10) return bad('Use a password with at least 10 characters.');
    if (matches(next, me)) return bad('Choose a password that is different from the one you have now.');
    if (!me.name) { me.name = clean(data.name, 120); if (!me.name) return bad('Enter your name.'); }
    me.pass = hashPw(next); delete me.must_change; delete me.temp_exp; me.sv = (me.sv || 0) + 1;
    await saveUser(store, me);
    return json({ me: pub(me) }, 200, await startSession(store, me));
  }
  // a temporary password only opens the "choose your own password" screen
  if (me.must_change) return bad('Choose your own password first.', 403);

  // the client portal
  if (a === 'my-job') {
    if (me.role !== 'client') return bad('Not found.', 404);
    const lead = me.leadId ? await store.get('leads/' + me.leadId, { type: 'json' }) : null;
    if (!lead) return json({ job: null });
    if (b === 'accept' && m === 'POST') {
      if (!lead.firm_price) return bad('Your firm quote is not ready yet.');
      lead.accepted_at = Date.now(); if (['Quote sent', 'Site visit set', 'Contacted', 'New'].includes(lead.stage)) lead.stage = 'Accepted';
      lead.notes.push({ at: Date.now(), by: me.name, text: 'Customer accepted the quote online.' });
      await store.setJSON('leads/' + lead.id, lead);
    }
    return json({ job: clientView(lead) });
  }

  // trainings
  if (a === 'training') {
    if (!staff) return bad('Not found.', 404);
    const key = 'training/' + me.id;
    const done = (await store.get(key, { type: 'json' })) || {};
    if (m === 'POST') { if (!LESSONS.some((l) => l.id === data.lesson)) return bad('Unknown lesson.'); done[data.lesson] = Date.now(); await store.setJSON(key, done); }
    let team;
    if (owner) { const users = (await all(store, 'users/')).filter((u) => STAFF.includes(u.role) && !u.disabled); team = await Promise.all(users.map(async (u) => ({ name: u.name, done: (await store.get('training/' + u.id, { type: 'json' })) || {} }))); }
    return json({ lessons: LESSONS, done, team });
  }

  if (!staff) return bad('Not found.', 404);

  // alerts on this device (owner and sales)
  if (a === 'push-key' && m === 'GET') return json({ key: push ? await push.key() : null });
  if (a === 'push-subscribe' && m === 'POST') {
    if (me.role === 'crew') return bad('Not allowed.', 403);
    const endpoint = clean(data.sub?.endpoint, 1000); if (!endpoint.startsWith('https://')) return bad('That device could not be registered.');
    const id = sha(endpoint);
    await store.setJSON('push/' + id, { id, uid: me.id, role: me.role, sub: data.sub, at: Date.now() });
    return json({ ok: true });
  }

  // leads
  if (a === 'leads' && !b) {
    if (m === 'GET') {
      const leads = (await all(store, 'leads/')).map((l) => leadFor(l, me)).filter(Boolean).sort((x, y) => y.created - x.created);
      const team = (await all(store, 'users/')).filter((u) => ['owner', 'sales'].includes(u.role) && !u.disabled).map((u) => ({ id: u.id, name: u.name }));
      return json({ leads, stages: STAGES, team });
    }
    if (m === 'POST') {
      if (me.role === 'crew') return bad('Not allowed.', 403);
      const name = clean(data.name, 120); if (!name) return bad('A name is required.');
      const lead = { id: newId(), created: Date.now(), source: clean(data.source, 60) || 'manual', stage: 'New', owner: me.id, name, phone: clean(data.phone, 40), email: email(data.email), city: clean(data.city, 200), job_type: clean(data.job_type, 60), sqft: num(data.sqft), notes: [] };
      if (clean(data.note, 1000)) lead.notes.push({ at: Date.now(), by: me.name, text: clean(data.note, 1000) });
      await store.setJSON('leads/' + lead.id, lead);
      return json({ lead });
    }
  }
  if (a === 'leads' && b) {
    const lead = await store.get('leads/' + b, { type: 'json' });
    if (!lead || !leadFor(lead, me) || me.role === 'crew') return bad('Not found.', 404);
    if (c === 'invite' && m === 'POST') {
      if (!lead.email) return bad('Add the customer\'s email to this lead first.');
      let u = await userByEmail(store, lead.email);
      if (u && u.role !== 'client') return bad('That email already belongs to a team member.');
      if (!u) u = { id: newId(), email: lead.email, name: lead.name, role: 'client', created: Date.now() };
      u.leadId = lead.id; const temp = setTemp(u); await saveUser(store, u);
      lead.clientUid = u.id; await store.setJSON('leads/' + lead.id, lead);
      return json({ temp, email: u.email, name: u.name });
    }
    if (m === 'PATCH') {
      if (data.stage !== undefined) { if (!STAGES.includes(data.stage)) return bad('Unknown stage.'); lead.stage = data.stage; }
      for (const k of ['phone', 'city', 'job_type', 'visit_date', 'job_date']) if (data[k] !== undefined) lead[k] = clean(data[k], 200);
      if (data.email !== undefined) lead.email = email(data.email);
      if (data.status_note !== undefined) lead.status_note = clean(data.status_note, 1000);
      if (data.firm_price !== undefined) lead.firm_price = num(data.firm_price);
      if (data.owner !== undefined && owner) lead.owner = clean(data.owner, 40) || undefined;
      if (clean(data.note, 2000)) lead.notes.push({ at: Date.now(), by: me.name, text: clean(data.note, 2000) });
      await store.setJSON('leads/' + lead.id, lead);
      return json({ lead });
    }
  }

  // owner only: applicants and team logins
  if (!owner) return bad('Not found.', 404);
  if (a === 'applicants' && !b && m === 'GET') return json({ applicants: (await all(store, 'applicants/')).sort((x, y) => y.created - x.created) });
  if (a === 'applicants' && b && m === 'PATCH') {
    const app = await store.get('applicants/' + b, { type: 'json' }); if (!app) return bad('Not found.', 404);
    app.status = clean(data.status, 40) || app.status; if (data.note !== undefined) app.note = clean(data.note, 2000);
    await store.setJSON('applicants/' + b, app); return json({ applicant: app });
  }
  if (a === 'users' && !b && m === 'GET') return json({ users: (await all(store, 'users/')).map(pub).sort((x, y) => x.name.localeCompare(y.name)) });
  if (a === 'users' && !b && m === 'POST') {
    const e = email(data.email), name = clean(data.name, 120), role = clean(data.role, 20);
    if (!name || !/^\S+@\S+\.\S+$/.test(e)) return bad('Enter a name and a valid email.');
    if (!ROLES.includes(role) || role === 'owner' || role === 'client') return bad('Pick sales or crew.');
    let u = await userByEmail(store, e);
    if (u && u.role === 'owner') return bad('That email is the owner account.');
    u = { ...(u || { id: newId(), created: Date.now() }), email: e, name, role, disabled: false };
    const temp = setTemp(u); await saveUser(store, u);
    return json({ user: pub(u), temp });
  }
  if (a === 'users' && b && m === 'PATCH') {
    const u = await store.get('users/' + b, { type: 'json' }); if (!u || u.role === 'owner') return bad('Not found.', 404);
    if (data.disabled !== undefined) u.disabled = !!data.disabled;
    const temp = data.reset ? setTemp(u) : undefined; // "Reset password": a new temporary one
    await saveUser(store, u);
    return json({ user: pub(u), temp });
  }
  return bad('Not found.', 404);
}
