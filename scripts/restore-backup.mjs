// Puts one night's backup back into the live app. Run by hand, only when something has actually gone wrong.
//
// Plain version: the app saves a full copy of its records every night (see netlify/functions/lib/backup.mjs).
// This reads one of those nights and writes every record in it back. Records in the copy overwrite what is
// there now; anything created after that night is left alone.
//
// It needs to reach the site's private storage, so it needs two things from the Netlify account:
//   NETLIFY_SITE_ID     Netlify, the site, Site configuration, "Site ID"
//   NETLIFY_AUTH_TOKEN  Netlify, User settings, Applications, "New access token" (delete it afterwards)
//
//   List the nights:  NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... node scripts/restore-backup.mjs
//   Put one back:     NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... node scripts/restore-backup.mjs 2026-11-17 --yes
import { getStore } from '@netlify/blobs';
import { restore } from '../netlify/functions/lib/backup.mjs';

const siteID = process.env.NETLIFY_SITE_ID, token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) { console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN first (see the top of this file).'); process.exit(1); }
const open = (name) => getStore({ name, siteID, token, consistency: 'strong' });
const app = open('cgh-app'), backups = open('cgh-backup');
const [day, yes] = process.argv.slice(2);

const { blobs } = await backups.list({ prefix: 'daily/' });
const nights = blobs.map((b) => b.key.slice(6)).sort();
if (!day) { console.log(nights.length ? 'Nights on file:\n  ' + nights.join('\n  ') : 'No backups on file yet.'); process.exit(0); }
if (!nights.includes(day)) { console.error(`No backup for ${day}. Nights on file: ${nights.join(', ') || 'none'}`); process.exit(1); }
const copy = await backups.get('daily/' + day, { type: 'json' });
console.log(`${day}: ${copy.counts.leads} leads, ${copy.counts.logins} logins, ${copy.counts.applicants} job applications, ${copy.counts.records} records in all.`);
if (yes !== '--yes') { console.log('Nothing was changed. Add --yes to put this night back.'); process.exit(0); }
const done = await restore(app, backups, day);
console.log(`Put back ${done.restored} records from ${day}.`);
