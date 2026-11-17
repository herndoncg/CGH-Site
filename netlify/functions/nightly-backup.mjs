// Netlify runs this by itself every night at 3:00 AM Central (9:00 UTC; 4:00 AM during daylight time).
// It copies all of the app's records into the separate `cgh-backup` storage area. See lib/backup.mjs.
// It only runs on the live site, never on preview copies.
import { getStore } from '@netlify/blobs';
import { runBackup } from './lib/backup.mjs';

export const config = { schedule: '0 9 * * *' };

export default async () => {
  const app = getStore({ name: 'cgh-app', consistency: 'strong' });
  const backups = getStore({ name: 'cgh-backup', consistency: 'strong' });
  const done = await runBackup(app, backups);
  console.log('nightly backup', JSON.stringify(done));
  return new Response('ok');
};
