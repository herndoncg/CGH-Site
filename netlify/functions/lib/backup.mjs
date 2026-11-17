// The nightly backup of everything the CGH app keeps.
//
// Plain version: every night the site copies all of its records (leads, customers, team logins, job
// applicants, training sign-offs, announcements, equipment and settings) into a second, separate storage
// area called `cgh-backup`, one file per night, and keeps the last 30 nights. If a record is ever deleted
// or damaged by mistake, any of those nights can be put back.
//
// Two things make it run:
//   1. netlify/functions/nightly-backup.mjs, which Netlify runs on a clock at 3 AM Central.
//   2. A safety net: when the owner or a manager opens the app and the newest copy is more than a day and a
//      half old, the app makes one right then. So a missed night fixes itself.
//
// What is NOT copied: sign-in sessions and the counters that slow down repeated tries. Those are throwaway.
// Both storage areas are private to the site. The copy the owner can download from the app has every
// password fingerprint and sign-in secret removed first.

// Which storage area holds the backups. Set once by the function that starts the server (and by tests).
let open = null;
export const setBackupStore = (fn) => { open = fn; };
export const backupStore = () => (open ? open() : null);

// Every kind of record worth keeping, by the first part of its name in storage.
export const KEPT = ['users/', 'emails/', 'leads/', 'refs/', 'applicants/', 'training/', 'ann/', 'equip/', 'meta/', 'tally/', 'stats/'];
export const NIGHTS = 30;
const centralDay = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(t)); // 2026-11-17

// Reads every kept record out of the app's storage.
export async function snapshot(store) {
  const data = {};
  for (const prefix of KEPT) {
    const { blobs } = await store.list({ prefix });
    for (const b of blobs) { const v = await store.get(b.key, { type: 'json' }); if (v !== null && v !== undefined) data[b.key] = v; }
  }
  return data;
}
const countOf = (data) => {
  const keys = Object.keys(data), n = (p) => keys.filter((k) => k.startsWith(p)).length;
  return { leads: n('leads/'), logins: n('users/'), applicants: n('applicants/'), records: keys.length };
};

// Makes tonight's copy and drops copies older than 30 nights. Returns a short summary.
export async function runBackup(store, backups, now = Date.now()) {
  const day = centralDay(now), data = await snapshot(store), counts = countOf(data);
  await backups.setJSON('daily/' + day, { day, at: now, counts, data });
  const { blobs } = await backups.list({ prefix: 'daily/' });
  const days = blobs.map((b) => b.key).sort();
  for (const k of days.slice(0, Math.max(0, days.length - NIGHTS))) await backups.delete(k);
  const summary = { day, at: now, counts, nights: Math.min(days.length, NIGHTS) };
  await backups.setJSON('latest', summary);
  return summary;
}

// The safety net: returns the newest copy's summary, making a fresh copy first if the newest is stale.
export async function backupStatus(store, now = Date.now()) {
  const backups = backupStore();
  if (!backups) return null;
  try {
    const latest = await backups.get('latest', { type: 'json' });
    if (latest && latest.at > now - 36 * 3600e3) return latest;
    return await runBackup(store, backups, now);
  } catch { return null; }
}

// The newest copy with every secret removed, for the owner's "Download the latest copy" button.
export async function downloadCopy() {
  const backups = backupStore();
  const latest = backups ? await backups.get('latest', { type: 'json' }) : null;
  const copy = latest ? await backups.get('daily/' + latest.day, { type: 'json' }) : null;
  if (!copy) return null;
  const data = {};
  for (const [k, v] of Object.entries(copy.data)) {
    if (k === 'meta/vapid' || k.startsWith('emails/') || k.startsWith('refs/')) continue; // the alert key and lookup tables: no use to a person
    if (k.startsWith('users/')) { const { pass, totp, totp_pending, backup, ...rest } = v; data[k] = rest; } else data[k] = v;
  }
  return { day: copy.day, at: copy.at, counts: copy.counts, data };
}

// Puts one night's copy back. Records in the copy overwrite what is there now; records made after that
// night are left alone. This is deliberately not reachable from the app or the website: it is run by hand
// (scripts/restore-backup.mjs) when something has actually gone wrong.
export async function restore(store, backups, day) {
  const copy = await backups.get('daily/' + day, { type: 'json' });
  if (!copy) throw new Error('There is no backup for ' + day);
  let n = 0;
  for (const [k, v] of Object.entries(copy.data)) { await store.setJSON(k, v); n++; }
  return { day, restored: n };
}
