// Netlify runs this for every /api/... request. All the logic is in lib/core.mjs.
// Records are kept in Netlify Blobs (storage that comes with the site; nothing to set up).
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { handle } from './lib/core.mjs';

export const config = { path: '/api/*' };

// Phone and computer alerts ("web push"). The pair of keys that lets this site send alerts is
// created the first time it is needed and kept in the same private storage as everything else.
function pusher(store) {
  let keys;
  const load = async () => {
    if (keys) return keys;
    keys = await store.get('meta/vapid', { type: 'json' });
    if (!keys) { keys = webpush.generateVAPIDKeys(); await store.setJSON('meta/vapid', keys); }
    return keys;
  };
  return {
    key: async () => (await load()).publicKey,
    send: async (sub, msg) => {
      const k = await load();
      try {
        await webpush.sendNotification(sub, JSON.stringify(msg), { TTL: 86400, vapidDetails: { subject: 'https://cghoperations.com', publicKey: k.publicKey, privateKey: k.privateKey } });
        return 'ok';
      } catch (err) { return err && (err.statusCode === 404 || err.statusCode === 410) ? 'gone' : 'failed'; }
    },
  };
}

export default async (req) => {
  try {
    const store = getStore({ name: 'cgh-app', consistency: 'strong' });
    return await handle(req, store, pusher(store), fetch);
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong on our end. Try again.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};
