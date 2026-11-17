// A private copy of the whole site on this computer, for testing: the built pages plus the back end,
// with records kept in memory (nothing is saved and nothing touches the live site).
// Run: npm run build && node scripts/preview-local.mjs   then open http://localhost:4321
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../netlify/functions/lib/core.mjs';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const mem = new Map();
const store = { get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), setJSON: async (k, v) => void mem.set(k, JSON.stringify(v)), delete: async (k) => void mem.delete(k), list: async ({ prefix }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }) };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const port = Number(process.env.PORT) || 4321;
// Send the same "only this site's scripts may run" rule the live site sends, so a blocked script shows up here first.
const headersText = await readFile(join(dist, '_headers'), 'utf8').catch(() => '');
const csp = (/^\s+Content-Security-Policy:\s*(.+)$/m.exec(headersText) || [])[1] || '';

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), store, null);
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    let file = normalize(join(dist, decodeURIComponent(url.pathname)));
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    const s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) file = join(file, 'index.html'); else if (!s && !extname(file)) file = join(file, 'index.html');
    const body = await readFile(file).catch(() => null);
    if (!body) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(join(dist, '404.html')).catch(() => 'Not found')); return; }
    const type = TYPES[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, ...(csp && type.startsWith('text/html') ? { 'content-security-policy': csp } : {}) }); res.end(body);
  } catch (err) { console.error(err); res.writeHead(500); res.end('error'); }
}).listen(port, () => console.log(`CGH site test copy: http://localhost:${port}`));
