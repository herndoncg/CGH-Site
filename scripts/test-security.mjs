// Checks the security pieces added Nov 17, 2026: the second sign-in step, the retired recovery
// fingerprint, and the nightly backup. Runs the real back end against an in-memory store.
// Run: node scripts/test-security.mjs
import { createHash } from 'node:crypto';
import * as core from '../netlify/functions/lib/core.mjs';
import * as bk from '../netlify/functions/lib/backup.mjs';

const mkStore = () => { const mem = new Map(); return { mem, get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), setJSON: async (k, v) => void mem.set(k, JSON.stringify(v)), delete: async (k) => void mem.delete(k), list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }) }; };
const store = mkStore(), backups = mkStore(), mem = store.mem;
bk.setBackupStore(() => backups);
let pass = 0, fail = 0;
const ok = (label, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const call = async (method, path, body, cookie) => {
  const r = await core.handle(new Request('https://x.test/api/' + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), store, null);
  const set = r.headers.get('set-cookie');
  return { status: r.status, body: await r.json().catch(() => ({})), cookie: set ? set.split(';')[0] : null, headers: r.headers };
};
const userByEmail = (e) => [...mem.entries()].filter(([k]) => k.startsWith('users/')).map(([, v]) => JSON.parse(v)).find((u) => u.email === e);
const patchUser = (e, fn) => { const u = userByEmail(e); fn(u); mem.set('users/' + u.id, JSON.stringify(u)); };
const step = () => Math.floor(Date.now() / 30e3);
const TEMP = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

// ----- the code math matches the published standard (RFC 6238 test values) -----
const RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890"
ok('code math matches the standard at 59 seconds', core.codeAt(RFC, Math.floor(59 / 30)) === '287082');
ok('code math matches the standard in 2005', core.codeAt(RFC, Math.floor(1111111109 / 30)) === '081804');
ok('code math matches the standard in 2009', core.codeAt(RFC, Math.floor(1234567890 / 30)) === '005924');
ok('code math matches the standard in 2033', core.codeAt(RFC, Math.floor(2000000000 / 30)) === '279037');
ok('code math matches the standard in 2603', core.codeAt(RFC, Math.floor(20000000000 / 30)) === '353130');

// ----- set up an owner, a manager and a crew member -----
process.env.CGH_SETUP_HASH = sha('TEST-CODE-12345');
delete process.env.CGH_RECOVERY_HASH;
let r = await call('POST', 'login', { email: 'owner@example.com', password: 'TEST-CODE-12345' });
r = await call('POST', 'password', { next: 'owners-long-password', name: 'Colton' }, r.cookie); let owner = r.cookie;
ok('the owner is in, with the second step off to begin with', r.status === 200 && r.body.me.twoStep === false);
r = await call('POST', 'users', { name: 'Nelson', email: 'nelson@example.com', role: 'manager' }, owner); const nelsonTemp = r.body.temp;
r = await call('POST', 'login', { email: 'nelson@example.com', password: nelsonTemp }); r = await call('POST', 'password', { next: 'nelsons-long-password' }, r.cookie); let nelson = r.cookie;
r = await call('POST', 'users', { name: 'Cal Crew', email: 'cal@example.com', role: 'crew' }, owner);
r = await call('POST', 'login', { email: 'cal@example.com', password: r.body.temp }); r = await call('POST', 'password', { next: 'cals-long-password' }, r.cookie); const cal = r.cookie;
r = await call('POST', 'lead', { name: 'Pat Customer', phone: '903-555-0100', email: 'pat@example.com', job_type: 'Driveway', sqft: '2500' });

// ----- the recovery fingerprint in the code is retired once the owner has a password -----
ok('before the owner has a password, the built-in recovery code can still be used', core.recoveryOpen(null) && core.recoveryOpen({ pass: 'x', must_change: true }));
ok('once the owner has chosen a password, the built-in recovery code opens nothing', core.recoveryOpen(userByEmail('owner@example.com')) === false);
process.env.CGH_RECOVERY_HASH = sha('PRIVATE-CODE-777');
ok('a recovery code kept in the private site settings still counts', core.recoveryOpen(userByEmail('owner@example.com')) === true);
delete process.env.CGH_RECOVERY_HASH;

// ----- the Home nudge -----
r = await call('GET', 'home', null, owner); ok('Home nudges the owner to add the second step', r.body.waiting.twoStep === 1);
r = await call('GET', 'home', null, cal); ok('crew are not nudged', r.body.waiting.twoStep === undefined);

// ----- turning the second step on -----
r = await call('POST', 'two-step/start', { password: 'wrong-wrong-wrong' }, owner); ok('turning it on needs the right password', r.status === 403);
r = await call('POST', 'two-step/start', {}); ok('signed-out visitors cannot start it', r.status === 401);
r = await call('POST', 'two-step/start', { password: 'owners-long-password' }, owner); const secret = r.body.secret;
ok('starting gives a 32-letter key and a link an authenticator app can open', r.status === 200 && /^[A-Z2-7]{32}$/.test(secret) && r.body.uri.startsWith('otpauth://totp/CGH%20Operations:owner%40example.com?secret=' + secret) && r.body.uri.includes('issuer=CGH%20Operations'));
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password' }); ok('nothing changes until the code is confirmed', r.status === 200 && !r.body.needCode && !!r.cookie);
r = await call('POST', 'two-step/confirm', { code: '000000' }, owner); ok('a wrong code does not turn it on', r.status === 400 && !userByEmail('owner@example.com').totp);
r = await call('POST', 'two-step/confirm', { code: core.codeAt(secret, step()) }, owner);
const codes = r.body.codes || [];
ok('the right code turns it on and hands back eight backup codes', r.status === 200 && r.body.me.twoStep === true && codes.length === 8 && codes.every((c) => TEMP.test(c)) && new Set(codes).size === 8);
const owner2 = r.cookie;
r = await call('GET', 'leads', null, owner); ok('turning it on signs the login out everywhere else', r.status === 401);
r = await call('GET', 'leads', null, owner2); ok('this device stays signed in', r.status === 200);
ok('backup codes are kept only as fingerprints', ![...mem.values()].some((v) => codes.some((c) => v.includes(c))));
r = await call('GET', 'home', null, owner2); ok('the nudge goes away', r.body.waiting.twoStep === undefined);

// ----- signing in with it on -----
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password' });
ok('the password alone no longer signs in: the app asks for the code', r.status === 200 && r.body.needCode === true && !r.cookie && !r.body.me);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'not-the-password', code: core.codeAt(secret, step() + 1) }); ok('a right code with a wrong password is refused', r.status === 401);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: '123456' === core.codeAt(secret, step()) ? '654321' : '123456' }); ok('a wrong code is refused', r.status === 401 && !r.cookie);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: core.codeAt(secret, userByEmail('owner@example.com').totp.last) }); ok('the code that was just used cannot be used again', r.status === 401);
patchUser('owner@example.com', (u) => { u.totp.last = 0; });
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: ' ' + core.codeAt(secret, step()).replace(/(...)/, '$1 ') }); ok('password plus the current code signs in (spaces in the code are fine)', r.status === 200 && r.body.me.role === 'owner' && !!r.cookie);
patchUser('owner@example.com', (u) => { u.totp.last = 0; });
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: core.codeAt(secret, step() - 1) }); ok('a code from the last 30 seconds still works (slow thumbs)', r.status === 200);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: core.codeAt(secret, step() - 5) }); ok('an old code does not', r.status === 401);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: codes[0].toLowerCase() }); ok('a backup code signs in', r.status === 200 && !!r.cookie);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: codes[0] }); ok('each backup code works once', r.status === 401);
ok('seven backup codes are left', userByEmail('owner@example.com').backup.length === 7);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: 'AAAA-BBBB-CCCC' }); ok('a made-up backup code is refused', r.status === 401);
// that was two misses in a row since the last good sign-in (used backup code, made-up code); three more locks it
for (let i = 0; i < 3; i++) r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: '11111' + i });
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: codes[1] }); ok('five wrong codes lock the email for 15 minutes, even for a right one', r.status === 429);
mem.delete('fails/' + sha('owner@example.com'));
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: codes[1] }); ok('after the wait, a backup code signs in again', r.status === 200); owner = r.cookie;

// ----- new backup codes, and turning it off -----
r = await call('POST', 'two-step/codes', { password: 'nope-nope-nope' }, owner); ok('new backup codes need the password', r.status === 403);
r = await call('POST', 'two-step/codes', { password: 'owners-long-password' }, owner); const codes2 = r.body.codes;
ok('new backup codes replace the old ones', r.status === 200 && codes2.length === 8 && !codes2.includes(codes[2]));
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password', code: codes[2] }); ok('an old backup code stops working', r.status === 401); mem.delete('fails/' + sha('owner@example.com'));
r = await call('GET', 'users', null, owner); ok('the team list shows who has the second step on, and never the key', r.body.users.find((u) => u.email === 'owner@example.com').twoStep === true && !JSON.stringify(r.body).includes(secret));
r = await call('GET', 'state', null, owner); ok('the signed-in person never gets their own key back either', r.body.me.twoStep === true && !JSON.stringify(r.body).includes(secret));

// a manager turns it on, loses the phone, and the owner resets them
r = await call('POST', 'two-step/start', { password: 'nelsons-long-password' }, nelson); const nSecret = r.body.secret;
r = await call('POST', 'two-step/confirm', { code: core.codeAt(nSecret, step()) }, nelson); nelson = r.cookie; ok('a manager can turn it on too', r.body.me.twoStep === true);
r = await call('POST', 'two-step/codes', { password: 'cals-long-password' }, cal); ok('backup codes cannot be made before it is on', r.status === 400);
const nelsonId = userByEmail('nelson@example.com').id;
r = await call('PATCH', 'users/' + nelsonId, { reset: true }, owner); const nelsonTemp2 = r.body.temp;
ok('Reset password also turns off that person\'s second step (lost phone)', r.status === 200 && r.body.user.twoStep === false && !userByEmail('nelson@example.com').backup);
r = await call('POST', 'login', { email: 'nelson@example.com', password: nelsonTemp2 }); ok('they sign in with the new temporary password, no code asked', r.status === 200 && !r.body.needCode && r.body.me.mustChange === true);
r = await call('POST', 'two-step/off', { password: 'bad-bad-bad-bad' }, owner); ok('turning it off needs the password', r.status === 403);
r = await call('POST', 'two-step/off', { password: 'owners-long-password' }, owner); ok('the owner can turn it off', r.status === 200 && r.body.me.twoStep === false);
r = await call('POST', 'login', { email: 'owner@example.com', password: 'owners-long-password' }); ok('with it off, the password alone signs in again', r.status === 200 && !!r.cookie && !r.body.needCode); owner = r.cookie;

// owner recovery through the private setting clears the second step
r = await call('POST', 'two-step/start', { password: 'owners-long-password' }, owner); r = await call('POST', 'two-step/confirm', { code: core.codeAt(r.body.secret, step()) }, owner);
process.env.CGH_RECOVERY_HASH = sha('PRIVATE-CODE-777');
r = await call('POST', 'login', { email: 'owner@example.com', password: 'PRIVATE-CODE-777' });
ok('a private recovery code gets a locked-out owner back in and clears the second step', r.status === 200 && r.body.me.mustChange === true && r.body.me.twoStep === false);
r = await call('POST', 'password', { next: 'owners-third-password' }, r.cookie); owner = r.cookie;
delete process.env.CGH_RECOVERY_HASH;

// ----- the nightly backup -----
const DAY = 864e5, t0 = Date.parse('2026-11-17T09:00:00Z');
let done = await bk.runBackup(store, backups, t0);
ok('a backup copies the leads, logins and settings', done.day === '2026-11-17' && done.counts.leads === 1 && done.counts.logins === 3 && backups.mem.has('daily/2026-11-17'));
const copy = JSON.parse(backups.mem.get('daily/2026-11-17'));
ok('sign-in sessions and try counters are not copied', !Object.keys(copy.data).some((k) => /^(sessions|fails|rate|rate-lead|push)\//.test(k)) && Object.keys(copy.data).some((k) => k.startsWith('users/')));
for (let i = 1; i <= 34; i++) done = await bk.runBackup(store, backups, t0 + i * DAY);
const kept = [...backups.mem.keys()].filter((k) => k.startsWith('daily/')).sort();
ok('only the last 30 nights are kept', kept.length === 30 && done.nights === 30 && kept[0] === 'daily/2026-11-22' && kept[29] === 'daily/2026-12-21');
// putting a night back
const leadKey = [...mem.keys()].find((k) => k.startsWith('leads/')), leadWas = mem.get(leadKey);
mem.delete(leadKey);
const back = await bk.restore(store, backups, '2026-12-21');
ok('a deleted lead comes back from a backup', back.restored > 0 && mem.get(leadKey) === leadWas);
let threw = false; try { await bk.restore(store, backups, '2020-01-01'); } catch { threw = true; } ok('asking for a night that does not exist fails loudly', threw);
// the safety net (uses the real clock)
backups.mem.clear();
r = await call('GET', 'home', null, cal); ok('crew opening the app does not make or see backups', r.body.backup === undefined && backups.mem.size === 0);
r = await call('GET', 'home', null, owner); ok('if no backup exists, the owner opening Home makes one', !!r.body.backup && r.body.backup.counts.leads === 1 && backups.mem.has('latest'));
const firstAt = r.body.backup.at; r = await call('GET', 'home', null, owner); ok('a fresh backup is not made twice', r.body.backup.at === firstAt);
backups.mem.set('latest', JSON.stringify({ ...JSON.parse(backups.mem.get('latest')), at: Date.now() - 40 * 3600e3 }));
r = await call('GET', 'home', null, owner); ok('a backup older than a day and a half is replaced', r.body.backup.at >= firstAt && r.body.backup.at > Date.now() - 60e3);
// downloading it
r = await call('GET', 'backup'); ok('signed-out visitors cannot download the backup', r.status === 401);
r = await call('GET', 'backup', null, cal); ok('crew cannot download the backup', r.status === 404);
r = await call('POST', 'login', { email: 'nelson@example.com', password: nelsonTemp2 }); r = await call('POST', 'password', { next: 'nelsons-second-password' }, r.cookie);
r = await call('GET', 'backup', null, r.cookie); ok('a manager cannot download the backup', r.status === 404);
r = await call('GET', 'backup', null, owner);
const text = JSON.stringify(r.body);
ok('the owner can download the newest copy', r.status === 200 && Object.keys(r.body.data).some((k) => k.startsWith('leads/')) && /attachment/.test(r.headers.get('content-disposition') || ''));
ok('the download has no password fingerprints, sign-in keys or alert keys in it', !/"pass"|"totp"|"backup"|"privateKey"/.test(text) && Object.values(r.body.data).some((v) => v && v.email === 'owner@example.com'));
bk.setBackupStore(null);
r = await call('GET', 'home', null, owner); ok('the app still works if the backup area is not reachable', r.status === 200 && r.body.backup === undefined);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
