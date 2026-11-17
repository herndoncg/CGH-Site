// DIRT DASH: load the dump truck with a skid steer before time runs out.
// Seen from above. Hold your finger where you want to go and the skid steer drives there. Drive into a
// dirt pile to fill the bucket, drive up to the truck to dump it. Stay away from people and off the
// utility flags.
//
// The numbers that set how hard a level is are in LEVELS below:
//   piles   how many dirt piles, and scoops in each       slack  how generous the clock is (2 = twice the
//           time a perfect run needs)
//   flags   rows of utility flags to stay off (by color)  mud    soft spots that slow the machine
//   walkers people walking across the site                crew   people standing on the site
import { clamp, rr, rng, font, pill, bar, banner } from './kit.js';

const LEVELS = [
  { piles: [1, 1, 1, 1], slack: 2.6, flags: [], mud: 0, walkers: 0, crew: 1 },
  { piles: [2, 2, 2], slack: 2.3, flags: [], mud: 0, walkers: 0, crew: 1 },
  { piles: [2, 2, 2], slack: 2.3, flags: ['yellow'], mud: 0, walkers: 0, crew: 1 },
  { piles: [2, 2, 3], slack: 2.2, flags: ['red', 'yellow'], mud: 0, walkers: 0, crew: 1 },
  { piles: [2, 3, 3], slack: 2.1, flags: ['blue', 'green', 'orange'], mud: 0, walkers: 0, crew: 1 },
  { piles: [2, 3, 3], slack: 2.2, flags: ['red'], mud: 3, walkers: 0, crew: 1 },
  { piles: [2, 3, 3], slack: 2.3, flags: ['yellow'], mud: 0, walkers: 2, crew: 1 },
  { piles: [3, 3, 4], slack: 2.1, flags: ['red', 'blue', 'orange'], mud: 2, walkers: 2, crew: 1 },
];
// What each flag color marks (the standard color code used by 811 locators).
const FLAG = {
  red: { c: '#e5332a', what: 'Red means electric.' },
  yellow: { c: '#f5c542', what: 'Yellow means gas or oil.' },
  orange: { c: '#f47a20', what: 'Orange means phone and internet.' },
  blue: { c: '#3b82f6', what: 'Blue means water.' },
  green: { c: '#22a552', what: 'Green means sewer.' },
};
const EMPTY_SPEED = 26, FULL_SPEED = 18;   // feet per second

export function create(env) {
  const { ctx } = env;
  let L, n, f, top, bottom, me, piles, truck, flags, muds, people, need, loaded, bucket, busy, clock, limit, hits, points, t, note, noteT, endT, failed, dust, tracks, combo, lastDump;

  const say = (text, good = false, time = 2.2) => { note = { text, good }; noteT = time; };
  const P = (u, v) => ({ x: env.W * u, y: top + v * (bottom - top) });
  const segDist = (px, py, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, k = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - (a.x + dx * k), py - (a.y + dy * k)); };

  // The way from one spot to another that goes around the open end of any flag line in between.
  function route(from, to) {
    const cross = (p, q, a, b) => { const d = (x1, y1, x2, y2, x3, y3) => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1); return d(p.x, p.y, q.x, q.y, a.x, a.y) * d(p.x, p.y, q.x, q.y, b.x, b.y) < 0 && d(a.x, a.y, b.x, b.y, p.x, p.y) * d(a.x, a.y, b.x, b.y, q.x, q.y) < 0; };
    const pts = [from], down = to.y > from.y;
    const between = flags.filter((fl) => { const y = (fl.a.y + fl.b.y) / 2; return y > Math.min(from.y, to.y) - 4 * f && y < Math.max(from.y, to.y) + 4 * f; }).sort((p, q) => (down ? 1 : -1) * (p.a.y - q.a.y));
    for (const fl of between) {
      const last = pts[pts.length - 1], pad = { a: { x: fl.a.x - 6 * f, y: fl.a.y }, b: { x: fl.b.x + 6 * f, y: fl.b.y } };
      if (!cross(last, to, pad.a, pad.b)) continue;
      const open = fl.a.x < 2 ? { x: fl.b.x + 8 * f, y: fl.b.y } : { x: fl.a.x - 8 * f, y: fl.a.y };   // the end with the gap
      pts.push({ x: open.x, y: open.y - (down ? 5 : -5) * f }, { x: open.x, y: open.y + (down ? 5 : -5) * f });
    }
    pts.push(to); return pts;
  }
  const routeLen = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

  function start(level) {
    n = level; L = LEVELS[n]; const R = rng(900 + n * 7);
    top = 104; bottom = env.H - 16; f = env.W / 62;
    // the truck parks along the top; the skid steer starts in the middle
    truck = { ...P(0.5, 0.1), w: 24 * f, h: 9.5 * f, load: 0 };
    me = { ...P(0.5, 0.36), vx: 0, vy: 0, a: -Math.PI / 2 };
    const spots = [], far = (p, d) => spots.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > d * f) && Math.hypot(p.x - truck.x, p.y - truck.y) > 20 * f && Math.hypot(p.x - me.x, p.y - me.y) > 9 * f;
    const place = (d, vMin = 0.42, vMax = 0.95) => { for (let i = 0; i < 200; i++) { const p = P(0.1 + R() * 0.8, vMin + R() * (vMax - vMin)); if (far(p, d)) { spots.push(p); return p; } } const p = P(0.1 + R() * 0.8, vMin + R() * (vMax - vMin)); spots.push(p); return p; };
    // utility flags run part of the way across the site, down where the dirt piles are
    flags = L.flags.map((color, i) => { const v = 0.43 + (i / Math.max(1, L.flags.length)) * 0.45 + R() * 0.03, left = (i + n) % 2 === 0, u0 = left ? 0 : 0.45 + R() * 0.12, u1 = left ? 0.42 + R() * 0.14 : 1; return { color, a: P(u0, v), b: P(u1, v + (R() - 0.5) * 0.05), inside: false }; });
    const offFlags = (p) => flags.every((fl) => segDist(p.x, p.y, fl.a, fl.b) > 9 * f);
    piles = L.piles.map((size) => { let p = place(13, 0.5); for (let i = 0; i < 60 && !offFlags(p); i++) { spots.pop(); p = place(13, 0.5); } return { ...p, size, full: size }; });
    muds = Array.from({ length: L.mud }, () => ({ ...place(10, 0.3, 0.9), r: (6 + R() * 3) * f }));
    people = [];
    for (let i = 0; i < L.crew; i++) people.push({ x: truck.x + truck.w / 2 + 5 * f, y: truck.y + truck.h / 2 + 4 * f, still: true });
    for (let i = 0; i < L.walkers; i++) { const v = 0.47 + i * 0.27 + R() * 0.05; people.push({ a: P(0.08, v), b: P(0.92, v + (R() - 0.5) * 0.08), k: 0.1 + i * 0.6, dir: 1, speed: (0.09 + R() * 0.03), x: 0, y: 0 }); }
    need = L.piles.reduce((a, b) => a + b, 0); loaded = 0; bucket = false; busy = 0; hits = 0; points = 0; t = 0; note = null; noteT = 0; endT = 0; failed = ''; dust = []; tracks = []; combo = 0; lastDump = -99;
    // the clock: what a perfect run takes, times the level's slack
    const dump = { x: truck.x, y: truck.y + truck.h / 2 + 5 * f };
    const par = piles.reduce((a, p) => a + p.full * ((2 * routeLen(route(dump, p))) / f / ((EMPTY_SPEED + FULL_SPEED) / 2) + 0.9), 0);
    limit = Math.ceil(par * L.slack); clock = limit;
    say('Hold your finger where you want to drive', true, 3);
  }

  function update(dt) {
    t += dt; noteT = Math.max(0, noteT - dt);
    for (const d of dust) { d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; } dust = dust.filter((d) => d.age < 0.6);
    for (const p of people) if (!p.still) { p.k += p.dir * p.speed * dt; if (p.k > 1) { p.k = 1; p.dir = -1; } if (p.k < 0) { p.k = 0; p.dir = 1; } p.x = p.a.x + (p.b.x - p.a.x) * p.k; p.y = p.a.y + (p.b.y - p.a.y) * p.k; }
    if (endT > 0) { endT -= dt; if (endT <= 0) done(); return; }
    clock -= dt;
    if (clock <= 0) { clock = 0; failed = 'time'; endT = 0.6; env.sfx('bad'); return; }

    // driving: head for the finger (or the arrow keys)
    let tx = 0, ty = 0; const p = env.pointer;
    if (p) { const dx = p.x - me.x, dy = p.y - me.y, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / (10 * f)); tx = (dx / d) * k; ty = (dy / d) * k; } }
    else { tx = (env.keys.has('ArrowRight') || env.keys.has('d') ? 1 : 0) - (env.keys.has('ArrowLeft') || env.keys.has('a') ? 1 : 0); ty = (env.keys.has('ArrowDown') || env.keys.has('s') ? 1 : 0) - (env.keys.has('ArrowUp') || env.keys.has('w') ? 1 : 0); const d = Math.hypot(tx, ty); if (d > 1) { tx /= d; ty /= d; } }
    const inMud = muds.some((m) => Math.hypot(me.x - m.x, me.y - m.y) < m.r);
    const top2 = (bucket ? FULL_SPEED : EMPTY_SPEED) * f * (inMud ? 0.45 : 1) * (busy > 0 ? 0 : 1);
    me.vx += (tx * top2 - me.vx) * Math.min(1, dt * 8); me.vy += (ty * top2 - me.vy) * Math.min(1, dt * 8);
    busy = Math.max(0, busy - dt);
    const sp = Math.hypot(me.vx, me.vy);
    if (sp > 6) { let da = Math.atan2(me.vy, me.vx) - me.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; me.a += clamp(da, -dt * 9, dt * 9); }
    let nx = me.x + me.vx * dt, ny = me.y + me.vy * dt;
    // the truck is solid: slide along it instead of driving through
    const hw = truck.w / 2 + 3.2 * f, hh = truck.h / 2 + 3.2 * f;
    if (Math.abs(nx - truck.x) < hw && Math.abs(ny - truck.y) < hh) { if (Math.abs(me.y - truck.y) >= hh) ny = me.y; else nx = me.x; if (Math.abs(nx - truck.x) < hw && Math.abs(ny - truck.y) < hh) { nx = me.x; ny = me.y; } }
    me.x = clamp(nx, 4 * f, env.W - 4 * f); me.y = clamp(ny, top + 4 * f, bottom - 4 * f);
    if (sp > 20 && Math.random() < dt * 22) dust.push({ x: me.x - Math.cos(me.a) * 3 * f, y: me.y - Math.sin(me.a) * 3 * f, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, age: 0, mud: inMud });
    if (sp > 20 && (!tracks.length || Math.hypot(tracks[tracks.length - 1].x - me.x, tracks[tracks.length - 1].y - me.y) > 7)) { tracks.push({ x: me.x, y: me.y, a: me.a }); if (tracks.length > 160) tracks.shift(); }

    // the bucket is out in front
    const bx = me.x + Math.cos(me.a) * 4.2 * f, by = me.y + Math.sin(me.a) * 4.2 * f;
    if (!bucket && busy <= 0) for (const pile of piles) if (pile.size > 0 && Math.hypot(bx - pile.x, by - pile.y) < (3 + pile.size * 1.2) * f) { pile.size--; bucket = true; busy = 0.3; env.sfx('scoop'); env.buzz(20); for (let i = 0; i < 7; i++) dust.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.5) * 70, age: 0 }); break; }
    if (bucket && busy <= 0 && Math.abs(bx - truck.x) < truck.w / 2 - 2 * f && Math.abs(by - truck.y) < truck.h / 2 + 1.5 * f) {
      bucket = false; busy = 0.3; loaded++; truck.load++; combo = t - lastDump < 9 ? combo + 1 : 1; lastDump = t;
      const pts = 100 + Math.min(5, combo - 1) * 25; points += pts; env.pop(truck.x, truck.y + truck.h, combo > 1 ? `+${pts}  quick load` : '+' + pts, '#7ef0c2'); env.sfx('thump'); env.buzz(30);
      if (loaded >= need) { endT = 0.9; env.sfx('good'); }
    }
    // utility flags: driving over a marked line
    for (const fl of flags) { const on = segDist(me.x, me.y, fl.a, fl.b) < 3.0 * f; if (on && !fl.inside) { hits++; clock = Math.max(1, clock - 5); combo = 0; env.sfx('bad'); env.buzz(90); say(FLAG[fl.color].what + ' Stay off the flags. (-5 seconds)', false, 2.8); env.pop(me.x, me.y - 30, '-5 sec', '#ff7a6e'); } fl.inside = on; }
    // people: touching one ends the level
    for (const q of people) if (Math.hypot(me.x - q.x, me.y - q.y) < 4.4 * f && sp > 4) { failed = 'person'; endT = 0.9; me.vx = me.vy = 0; env.sfx('hit'); env.buzz(200); say('Stop! Someone was in the way.', false, 3); return; }
  }
  function done() {
    const stats = [['Buckets', `${loaded} of ${need}`], ['Time left', Math.ceil(clock) + ' sec'], ['Flag lines hit', String(hits)]];
    if (failed === 'person') return env.finish({ stars: 0, score: points, headline: 'Someone got hit', note: 'Nothing on a job site is worth that. Know where every person is, and stop when someone is close.', stats });
    if (failed === 'time') return env.finish({ stars: 0, score: points, headline: 'Out of time', note: 'Take the closest pile first and drive straight lines. A full bucket is slower, so keep the loaded trips short.', stats });
    const left = clock / limit, stars = left >= 0.33 && hits === 0 ? 3 : left >= 0.18 && hits <= 1 ? 2 : 1;
    env.finish({ stars, score: points + Math.round(clock * 20), headline: 'Truck is loaded', note: stars === 3 ? 'Loaded fast, nobody close, no lines crossed. Good operating.' : hits ? 'Loaded, but you drove over marked utility lines. Go around the flags, every time.' : 'Loaded. Shorter routes and fewer wasted turns will get you three stars.', stats });
  }

  // ----- drawing -----
  function draw() {
    const W = env.W, H = env.H;
    ctx.fillStyle = '#4c7a45'; ctx.fillRect(0, 0, W, H);
    rr(ctx, 5, top - 6, W - 10, bottom - top + 12, 10); ctx.fillStyle = '#b08d62'; ctx.fill();
    ctx.fillStyle = 'rgba(80,56,30,0.14)'; for (let i = 0; i < 40; i++) { const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; ctx.beginPath(); ctx.ellipse(10 + h * (W - 20), top + ((h * 23.1) % 1) * (bottom - top), 16 + h * 26, 7 + h * 6, h * 3, 0, 7); ctx.fill(); }
    for (const m of muds) { ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.8, 0, 0, 7); ctx.fillStyle = '#6b4a2a'; ctx.fill(); ctx.beginPath(); ctx.ellipse(m.x - m.r * 0.2, m.y - m.r * 0.15, m.r * 0.5, m.r * 0.3, 0, 0, 7); ctx.fillStyle = 'rgba(120,150,170,0.3)'; ctx.fill(); }
    // tracks the machine has left
    ctx.fillStyle = 'rgba(70,48,24,0.25)'; for (const tr of tracks) { ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.a); ctx.fillRect(-3, -2.6 * f, 6, 1.1 * f); ctx.fillRect(-3, 1.5 * f, 6, 1.1 * f); ctx.restore(); }
    // utility flags
    for (const fl of flags) {
      const c = FLAG[fl.color].c, len = Math.hypot(fl.b.x - fl.a.x, fl.b.y - fl.a.y), steps = Math.max(2, Math.round(len / (7 * f)));
      ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(fl.a.x, fl.a.y); ctx.lineTo(fl.b.x, fl.b.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      for (let i = 0; i <= steps; i++) { const x = fl.a.x + ((fl.b.x - fl.a.x) * i) / steps, y = fl.a.y + ((fl.b.y - fl.a.y) * i) / steps; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 1, y + 1, 9, 2); ctx.strokeStyle = '#d5dbe3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 9, y - 9); ctx.lineTo(x, y - 5); ctx.closePath(); ctx.fill(); }
    }
    for (const p of piles) if (p.size > 0) pile(p);
    drawTruck();
    for (const q of people) person(q);
    for (const d of dust) { ctx.globalAlpha = 0.5 * (1 - d.age / 0.6); ctx.beginPath(); ctx.arc(d.x, d.y, 5 + d.age * 14, 0, 7); ctx.fillStyle = d.mud ? '#6b4a2a' : '#d9bf98'; ctx.fill(); } ctx.globalAlpha = 1;
    machine();
    // an arrow to the truck when the bucket is full, so new players know where to go
    if (bucket && n < 2) { ctx.globalAlpha = 0.6 + Math.sin(t * 7) * 0.3; ctx.fillStyle = '#f5c542'; ctx.font = font(13, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DUMP HERE', truck.x, truck.y + truck.h / 2 + 14); ctx.globalAlpha = 1; }
    hud(W);
  }
  function pile(p) {
    const r = (3.2 + p.size * 1.5) * f;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 4, r, r * 0.8, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(p.x - r * 0.25, p.y - r * 0.3, r * 0.1, p.x, p.y, r); g.addColorStop(0, '#9a6b3c'); g.addColorStop(1, '#6e4a26');
    ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, k = 0.86 + (Math.abs(Math.sin((p.x + i) * 12.9898) * 43758.5453) % 1) * 0.22; ctx.lineTo(p.x + Math.cos(a) * r * k, p.y + Math.sin(a) * r * k * 0.84); } ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.2)'; ctx.beginPath(); ctx.ellipse(p.x - r * 0.25, p.y - r * 0.28, r * 0.35, r * 0.2, -0.5, 0, 7); ctx.fill();
  }
  function drawTruck() {
    const { x, y, w, h } = truck; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, -w / 2 + 3, -h / 2 + 5, w + 7 * f, h, 6); ctx.fill();
    ctx.fillStyle = '#14171c'; for (const xx of [-w * 0.32, -w * 0.12, w * 0.42]) { ctx.fillRect(xx, -h / 2 - 2, w * 0.1, 5); ctx.fillRect(xx, h / 2 - 3, w * 0.1, 5); }
    rr(ctx, -w / 2, -h / 2, w, h, 4); ctx.fillStyle = '#23272e'; ctx.fill(); rr(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 3); ctx.fillStyle = '#101216'; ctx.fill();
    if (truck.load > 0) { const k = truck.load / need; ctx.beginPath(); ctx.ellipse(0, 0, (w / 2 - 6) * clamp(0.3 + k * 0.7, 0, 1), (h / 2 - 5) * clamp(0.5 + k * 0.5, 0, 1), 0, 0, 7); ctx.fillStyle = '#7d5530'; ctx.fill(); ctx.fillStyle = 'rgba(255,230,190,0.16)'; ctx.beginPath(); ctx.ellipse(-w * 0.08, -h * 0.1, w * 0.16 * k, h * 0.14, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#0ea5a9'; ctx.fillRect(-w / 2, h / 2 - 3, w, 3);
    rr(ctx, w / 2 + 1, -h / 2 + 1, 6.4 * f, h - 2, 5); ctx.fillStyle = '#eef1f5'; ctx.fill(); ctx.fillStyle = '#1c2942'; ctx.fillRect(w / 2 + 3.2 * f, -h / 2 + 4, 1.6 * f, h - 8);
    ctx.restore();
  }
  function person(q) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(q.x + 2, q.y + 3, 1.7 * f, 1.4 * f, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 * f, 0, 7); ctx.fillStyle = '#c8f03c'; ctx.fill(); ctx.strokeStyle = '#f47a20'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(q.x, q.y, 0.85 * f, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();
    // a ring that shows how close is too close
    if (Math.hypot(me.x - q.x, me.y - q.y) < 13 * f) { ctx.strokeStyle = 'rgba(255,90,77,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(q.x, q.y, 4.4 * f, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }
  // The skid steer from above, bucket pointing the way it faces.
  function machine() {
    ctx.save(); ctx.translate(me.x, me.y); ctx.rotate(me.a);
    const u = f, box = (x, y, w, h, r, fill) => { rr(ctx, x * u, y * u, w * u, h * u, r * u); ctx.fillStyle = fill; ctx.fill(); };
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, -3.2 * u + 2, -2.9 * u + 3, 8.4 * u, 5.8 * u, 0.6 * u); ctx.fill();
    box(-3.2, -3.0, 5.8, 1.3, 0.4, '#14171c'); box(-3.2, 1.7, 5.8, 1.3, 0.4, '#14171c');                 // tracks
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 6; i++) { const o = ((t * Math.hypot(me.vx, me.vy)) / u) % 1; ctx.fillRect((-3 + i + o * 0.9) * u, -3.0 * u, 0.2 * u, 1.3 * u); ctx.fillRect((-3 + i + o * 0.9) * u, 1.7 * u, 0.2 * u, 1.3 * u); }
    const g = ctx.createLinearGradient(0, -2 * u, 0, 2 * u); g.addColorStop(0, '#f8c62a'); g.addColorStop(1, '#dc9c0a');
    rr(ctx, -3.0 * u, -1.9 * u, 5.0 * u, 3.8 * u, 0.5 * u); ctx.fillStyle = g; ctx.fill();
    box(-2.8, -1.5, 1.5, 3.0, 0.3, '#c98f06');                                                             // engine cover
    box(-1.0, -1.4, 2.4, 2.8, 0.35, 'rgba(20,23,28,0.85)');                                               // cab
    ctx.beginPath(); ctx.arc(0.1 * u, 0, 0.75 * u, 0, 7); ctx.fillStyle = '#c8f03c'; ctx.fill(); ctx.beginPath(); ctx.arc(0.1 * u, 0, 0.42 * u, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();
    box(1.6, -2.5, 2.2, 0.55, 0.2, '#2a2f37'); box(1.6, 1.95, 2.2, 0.55, 0.2, '#2a2f37');                 // lift arms
    box(3.4, -3.1, 1.9, 6.2, 0.3, '#3a414c'); box(3.8, -2.7, 1.2, 5.4, 0.2, bucket ? '#7d5530' : '#1d232d');   // bucket
    if (bucket) { ctx.fillStyle = 'rgba(255,230,190,0.2)'; ctx.fillRect(4.0 * u, -2.0 * u, 0.5 * u, 2.2 * u); }
    ctx.restore();
  }
  function hud(W) {
    const pad = 10, gapW = 8, w = (W - pad * 2 - gapW * 2) / 3, y = 10, low = clock < 10;
    pill(ctx, pad, y, w, 'Buckets', `${loaded} / ${need}`);
    pill(ctx, pad + w + gapW, y, w, 'Time', Math.ceil(clock) + 's', low ? { color: '#ff7a6e', edge: '#ff7a6e', bg: Math.floor(t * 3) % 2 ? 'rgba(110,20,16,0.85)' : undefined } : {});
    pill(ctx, pad + (w + gapW) * 2, y, w, 'Bucket', bucket ? 'FULL' : 'empty', { color: bucket ? '#f5c542' : 'rgba(255,255,255,0.6)' });
    bar(ctx, pad, y + 52, W - pad * 2, 6, clock / limit, low ? '#ff7a6e' : '#0ea5a9');
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, y + 64, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
  }
  return { start, update, draw, destroy() {}, peek: () => ({ L, me, piles, truck, flags, muds, people, bucket, need, loaded, clock, limit, f, top, bottom, route }), poke: (p) => { env.pointer = p; } };
}
