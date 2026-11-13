// Netlify runs this for every /api/... request. All the logic is in lib/core.mjs.
// Records are kept in Netlify Blobs (storage that comes with the site; nothing to set up).
import { getStore } from '@netlify/blobs';
import { handle } from './lib/core.mjs';

export const config = { path: '/api/*' };

export default async (req) => {
  try {
    return await handle(req, getStore({ name: 'cgh-app', consistency: 'strong' }));
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong on our end. Try again.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};
