// Saved levels. Every player's levels are kept on their own device. When they are signed in (a free
// player login, or a CGH login), the same levels are also kept on our side so they follow the player
// to any phone or computer. When the two copies differ, the best of each level wins.
const KEY = 'cgh-games-v1';
export const COUNTS = { haul: 8, paver: 8, roller: 8, math: 8, back: 8, skid: 8, patch: 8, flag: 8 };

function tidy(p) {
  const out = {};
  for (const [g, levels] of Object.entries(COUNTS)) {
    const src = p && typeof p === 'object' && p[g] && typeof p[g] === 'object' ? p[g] : {};
    const s = Array.isArray(src.s) ? src.s.slice(0, levels).map((x) => Math.max(0, Math.min(3, Math.floor(Number(x)) || 0))) : [];
    out[g] = { s, b: Math.max(0, Math.floor(Number(src.b)) || 0) };
  }
  return out;
}
export function merge(x, y) {
  const out = {};
  for (const g of Object.keys(COUNTS)) {
    const s = []; for (let i = 0; i < Math.max(x[g].s.length, y[g].s.length); i++) s.push(Math.max(x[g].s[i] || 0, y[g].s[i] || 0));
    out[g] = { s, b: Math.max(x[g].b, y[g].b) };
  }
  return out;
}
export function local() { try { return tidy(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return tidy(null); } }
function keep(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }

let me = null, asked = null;
export const who = () => me;

async function post(path, body) {
  const r = await fetch('/api/play/' + path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'That did not work. Try again.');
  return d;
}
function push(p) { return post('save', { progress: p }).then((d) => { if (d.progress) keep(merge(local(), tidy(d.progress))); }).catch(() => {}); }

// Finds out who is signed in (once per page) and lines the two copies of their levels up.
export function session() {
  if (!asked) asked = fetch('/api/play/me', { credentials: 'same-origin' }).then((r) => r.json()).then((d) => {
    me = d.who || null;
    if (me) { const theirs = tidy(d.progress), both = merge(local(), theirs); keep(both); if (JSON.stringify(both) !== JSON.stringify(theirs)) push(both); }
    return me;
  }).catch(() => null);
  return asked;
}
// A level was finished: remember the stars and the score.
export function record(game, level, stars, score) {
  const p = local(), g = p[game];
  while (g.s.length <= level) g.s.push(0);
  g.s[level] = Math.max(g.s[level], stars); g.b = Math.max(g.b, Math.round(score) || 0);
  keep(p); if (me) push(p);
  return p;
}
export async function join(name, password) { const d = await post('join', { name, password, progress: local() }); me = d.who; keep(merge(local(), tidy(d.progress))); return me; }
export async function login(name, password) { const d = await post('login', { name, password, progress: local() }); me = d.who; keep(merge(local(), tidy(d.progress))); return me; }
// Signing out also clears this device, so the next person to pick it up starts fresh.
export async function logout() { await post('logout').catch(() => {}); me = null; try { localStorage.removeItem(KEY); } catch {} }

export const stars = (p, game) => p[game].s.reduce((a, b) => a + b, 0);
export const totalStars = (p) => Object.keys(COUNTS).reduce((a, g) => a + stars(p, g), 0);
// How many levels are open: every level passed, plus the next one.
export function open(p, game) { let n = 0; while (n < COUNTS[game] && (p[game].s[n] || 0) > 0) n++; return Math.min(COUNTS[game], n + 1); }
// Erases a player login for good: the nickname, the password and the saved levels, here and on this device.
export async function erase() { await post('delete'); me = null; try { localStorage.removeItem(KEY); } catch {} }
