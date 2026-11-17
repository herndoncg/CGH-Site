// LAY THE MAT: run the paver down a driveway.
// Seen from straight above. Drag to steer and keep the screed between the painted lines; hold FEED
// when a truck is backed in to fill the hopper, and let go before it runs over.
//
// The numbers that set how hard a level is are in LEVELS below:
//   len    feet of driveway               speed   feet per second
//   bend   how far the drive swings side to side (feet), wave = feet between bends
//   wide   driveway width in feet         tol     how many feet off the line still counts as on it
//   feed   false = the hopper fills itself (level 1 is steering only)
//   drain  feet of paving one full hopper lasts
//   pour   how fast FEED fills the hopper (bigger = easier to spill)
import { clamp, rr, rng, font, pill, bar, banner } from './kit.js';

const LEVELS = [
  { len: 260, speed: 7, bend: 1.6, wave: 150, wide: 12, tol: 1.0, feed: false },
  { len: 300, speed: 7, bend: 2.2, wave: 140, wide: 12, tol: 1.0, feed: true, drain: 95, pour: 0.42 },
  { len: 340, speed: 7.5, bend: 4.5, wave: 125, wide: 12, tol: 1.0, feed: true, drain: 95, pour: 0.42 },
  { len: 340, speed: 7.5, bend: 3.5, wave: 115, wide: 12, tol: 0.95, feed: true, drain: 75, pour: 0.75 },
  { len: 380, speed: 8, bend: 6, wave: 100, wide: 12, tol: 0.95, feed: true, drain: 85, pour: 0.5 },
  { len: 400, speed: 8.5, bend: 5, wave: 86, wide: 12, tol: 0.9, feed: true, drain: 80, pour: 0.55, wobble: 1.4 },
  { len: 420, speed: 8.5, bend: 6, wave: 80, wide: 10, tol: 0.8, feed: true, drain: 75, pour: 0.6 },
  { len: 520, speed: 9.5, bend: 7, wave: 76, wide: 11, tol: 0.85, feed: true, drain: 75, pour: 0.65, wobble: 1.6 },
];
const SCREED_AT = 0.7;     // how far down the screen the screed sits
const STEP = 0.5;          // the mat is remembered every half foot
// How touchy the steering is. All three were turned down on Nov 17, 2026 after Colton found it too sensitive.
const DRAG = 0.55;         // the paver moves about half as far as the finger does (1 would be finger for finger)
const PULL = 4.4;          // how hard the paver chases the spot it is steering toward (was 5)
const EASE = 6;            // how quickly it changes sideways speed (was 7); lower feels heavier

export function create(env) {
  const { ctx } = env;
  let L, n, s, x, vx, target, hopper, samples, good, total, starves, spills, starved, truck, t, note, noteT, spillT, blobs, bumps, camX, drag, grass, endT, feedHeld, nextTruckAt, groove, bonus;
  const feedBtn = document.createElement('button');
  feedBtn.type = 'button'; feedBtn.className = 'gk-pedal gk-pedal--right'; feedBtn.innerHTML = 'FEED<small>hold to fill</small>';
  let pedal = false;
  const press = (on) => (e) => { e.preventDefault(); pedal = on; feedBtn.classList.toggle('is-down', on); };
  feedBtn.addEventListener('pointerdown', press(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => feedBtn.addEventListener(ev, press(false)));
  feedBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // Where the middle of the driveway is, s feet from the start. It eases in so the start is straight.
  const center = (d) => { const ease = clamp((d - 25) / 60, 0, 1); return ease * (L.bend * Math.sin((d - 25) / L.wave * Math.PI * 2) + (L.wobble || 0) * Math.sin(d / 31 + 1)); };
  const say = (text, good2 = false, time = 2) => { note = { text, good: good2 }; noteT = time; };

  function start(level) {
    n = level; L = LEVELS[n];
    s = 0; x = 0; vx = 0; target = 0; hopper = L.feed ? 0.7 : 1; samples = []; good = 0; total = 0; starves = 0; spills = 0; starved = false;
    truck = null; t = 0; note = null; noteT = 0; spillT = 0; blobs = []; bumps = []; camX = 0; drag = null; endT = 0; feedHeld = false; nextTruckAt = 12; groove = 0; bonus = 0;
    const r = rng(40 + n); grass = Array.from({ length: 70 }, () => ({ u: r(), v: r(), k: r() }));
    if (L.feed) env.stage.appendChild(feedBtn);
    say(L.feed ? 'Follow the lines. Feed the hopper when a truck backs in.' : 'Drag to steer. Keep the screed between the lines.', true, 3);
  }

  function update(dt) {
    t += dt; noteT = Math.max(0, noteT - dt);
    if (endT > 0) { endT -= dt; if (endT <= 0) done(); return; }
    const ppf = scale();
    // steering: drag moves the spot the paver is steering toward; the paver follows, slowly
    const p = env.pointer;
    if (p) { if (!drag) drag = { px: p.x, target }; target = drag.target + ((p.x - drag.px) / ppf) * DRAG; } else drag = null;
    const keyDir = (env.keys.has('ArrowRight') || env.keys.has('d') ? 1 : 0) - (env.keys.has('ArrowLeft') || env.keys.has('a') ? 1 : 0);
    const maxLat = Math.max(3.6, 1.35 * L.speed * (L.bend * Math.PI * 2) / L.wave + (L.wobble || 0) * 0.3);
    if (keyDir) target = x + keyDir * maxLat * 0.6;
    target = clamp(target, center(s) - 9, center(s) + 9);
    const want = clamp((target - x) * PULL, -maxLat, maxLat);
    vx += (want - vx) * Math.min(1, dt * EASE); x += vx * dt;

    s += L.speed * dt;
    camX += (x * 0.75 - camX) * Math.min(1, dt * 3);

    // the hopper and the trucks
    if (L.feed) {
      hopper = Math.max(0, hopper - (L.speed * dt) / L.drain);
      if (!truck && s > nextTruckAt && hopper < 0.62 && s < L.len - 30) { truck = { gap: 46, load: 1.25, state: 'in' }; say('Truck backing in', true, 1.6); }
      if (truck) {
        if (truck.state === 'in') { truck.gap = Math.max(0, truck.gap - 20 * dt); if (truck.gap === 0) { truck.state = 'docked'; truck.wait = 0; env.sfx('warn'); say('Truck is in. Hold FEED.', true, 2.2); } }
        else if (truck.state === 'docked') {
          truck.wait += dt; feedHeld = pedal || env.keys.has(' ');
          if (feedHeld && truck.load > 0) {
            const add = L.pour * dt; truck.load -= add;
            if (hopper + add > 1) { spillT += dt; hopper = 1; if (spillT > 0.22) { spillT = 0; spills++; truck.spilled = true; blobs.push({ s: s + 7.5, x: x + (Math.random() - 0.5) * 5 }); env.sfx('bad'); env.buzz(60); say('Hopper is full. Let go!', false, 1.6); } }
            else { hopper += add; spillT = 0; if (Math.random() < dt * 9) env.sfx('pour'); }
          }
          if (truck.load <= 0 || truck.wait > 13) { truck.state = 'out'; nextTruckAt = s + 28; if (truck.load <= 0) { say('Truck is empty. Pulling out.', true, 1.6); if (!truck.spilled) { bonus += 150; env.pop(env.W / 2, env.H * 0.3, 'Clean load +150', '#f5c542'); } } }
        } else { truck.gap += 26 * dt; if (truck.gap > 70) truck = null; }
      }
      if (hopper <= 0 && !starved) { starved = true; starves++; env.sfx('bad'); env.buzz(80); say('Hopper ran empty. That leaves a low spot.', false, 2.4); }
      if (hopper > 0.05) starved = false;
    }
    // spilled mix the tracks ride over turns into a bump across the mat
    blobs = blobs.filter((b) => { if (b.s < s - 2) { bumps.push(b.s + 2); return false; } return true; });

    // remember the mat that was just laid, and whether it was on the line
    while (samples.length * STEP < s) {
      const d = samples.length * STEP, laid = hopper > 0, off = Math.abs(x - center(d));
      samples.push({ x, laid, ok: laid && off <= L.tol });
      if (d > 12) {
        total++; if (laid && off <= L.tol) good++;
        // every 40 feet in a row on the line is a bonus
        if (laid && off <= L.tol) { groove += STEP; if (groove >= 40) { groove = 0; bonus += 100; env.pop(env.W / 2, env.H * SCREED_AT - 60, 'In the groove +100', '#7ef0c2'); env.sfx('pick'); } } else groove = 0;
      }
    }
    if (s >= L.len) { endT = 0.8; env.sfx('good'); }
  }
  const pct = () => (total ? Math.round((good / total) * 100) : 100);
  const score = () => Math.max(0, pct() * 30 + bonus - starves * 250 - spills * 120);
  function done() {
    const a = pct(), slips = starves + spills;
    let stars = a >= 60 ? 1 : 0; if (a >= 80 && slips <= 2) stars = 2; if (a >= 90 && slips === 0) stars = 3;
    const noteText = !stars ? 'The mat wandered off the lines. Watch the line ahead of the paver and start your turns early.' : stars === 3 ? 'Straight edges, full hopper, no spills. That is a clean mat.' : starves ? 'The hopper ran empty. Feed it as soon as the truck is in.' : spills ? 'Spilled mix makes bumps. Let go of FEED before the hopper is full.' : 'Good mat. Tighten up the edges for three stars.';
    env.finish({ stars, score: score(), headline: stars ? 'Driveway paved' : 'Too far off the line', note: noteText, stats: [['On the line', a + '%'], ...(L.feed ? [['Ran empty', String(starves)], ['Spills', String(spills)]] : [])] });
  }

  // ----- drawing -----
  const scale = () => Math.min((env.W * 0.34) / 12, env.H / 62);
  function draw() {
    const W = env.W, H = env.H, ppf = scale(), sy = H * SCREED_AT;
    const X = (wx) => W / 2 + (wx - camX) * ppf, Y = (d) => sy - (d - s) * ppf;
    const dTop = s + sy / ppf + 4, dBot = s - (H - sy) / ppf - 4;
    // grass
    ctx.fillStyle = '#4c7a45'; ctx.fillRect(0, 0, W, H);
    for (const g of grass) { const gy = (((g.v * 900 + s * ppf) % (H + 120)) + H + 120) % (H + 120) - 60, gx = ((g.u * 1.6 - 0.3) * W - camX * ppf * 0.999 % W + W * 2) % (W * 1.6) - W * 0.3; ctx.fillStyle = g.k > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)'; ctx.beginPath(); ctx.ellipse(gx, gy, 26 + g.k * 44, 12 + g.k * 16, 0, 0, 7); ctx.fill(); }
    // rock base, a little wider than the lines
    const edge = (off) => { const pts = []; for (let d = Math.max(-20, dBot); d <= Math.min(L.len + 30, dTop); d += 3) pts.push([X(center(Math.max(0, d)) + off), Y(d)]); return pts; };
    const strip = (half, fill) => { const a = edge(-half), b = edge(half).reverse(); if (!a.length) return; ctx.beginPath(); a.concat(b).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    strip(L.wide / 2 + 1.6, '#8f8672'); strip(L.wide / 2 + 0.9, '#a39a84');
    // gravel speckle on the base
    ctx.fillStyle = 'rgba(60,54,44,0.22)'; for (let d = Math.ceil(Math.max(0, dBot) / 2) * 2; d < Math.min(L.len + 30, dTop); d += 2) { const h = Math.abs(Math.sin(d * 12.9898) * 43758.5453) % 1; ctx.fillRect(X(center(d) + (h - 0.5) * L.wide), Y(d), 2, 2); ctx.fillRect(X(center(d) + (((h * 7.7) % 1) - 0.5) * L.wide), Y(d + 0.9), 2, 2); }
    // the mat
    const i0 = Math.max(0, Math.floor(dBot / STEP)), i1 = Math.min(samples.length - 1, Math.ceil(s / STEP));
    const half = L.wide / 2;
    let run = null;
    const flush = () => { if (!run || run.length < 2) { run = null; return; } ctx.beginPath(); run.forEach(([d, mx], i) => (i ? ctx.lineTo(X(mx - half), Y(d)) : ctx.moveTo(X(mx - half), Y(d)))); for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(X(run[i][1] + half), Y(run[i][0])); ctx.closePath(); ctx.fillStyle = '#1b1d21'; ctx.fill(); run = null; };
    for (let i = i0; i <= i1; i++) { const sm = samples[i]; if (sm && sm.laid) (run = run || []).push([i * STEP, sm.x]); else flush(); }
    if (run && hopper > 0) run.push([s, x]); flush();
    // fresh mat right behind the screed still shines
    const fg = ctx.createLinearGradient(0, sy, 0, sy + 9 * ppf); fg.addColorStop(0, 'rgba(120,130,150,0.22)'); fg.addColorStop(1, 'rgba(120,130,150,0)');
    ctx.fillStyle = fg; ctx.fillRect(X(x - half), sy, L.wide * ppf, 9 * ppf);
    // bumps where the tracks rode over spilled mix
    ctx.strokeStyle = 'rgba(150,158,172,0.5)'; ctx.lineWidth = 3; for (const b of bumps) { if (b < dBot || b > s) continue; const sm = samples[Math.floor(b / STEP)]; if (!sm) continue; ctx.beginPath(); ctx.moveTo(X(sm.x - half + 0.6), Y(b)); ctx.lineTo(X(sm.x + half - 0.6), Y(b)); ctx.stroke(); }
    // the painted lines: teal where the mat edge is on them, red where it is off, white ahead
    for (const side of [-1, 1]) {
      for (let d = Math.max(0, Math.floor(dBot / 2) * 2); d < Math.min(L.len, dTop); d += 2) {
        const sm = d < s ? samples[Math.floor(d / STEP)] : null;
        ctx.strokeStyle = sm ? (sm.ok ? '#34d399' : '#ff5a4d') : '#f3f5f8'; ctx.lineWidth = sm ? 3 : 2.5;
        ctx.beginPath(); ctx.moveTo(X(center(d) + side * half), Y(d)); ctx.lineTo(X(center(d + (sm ? 2 : 1.2)) + side * half), Y(d + (sm ? 2 : 1.2))); ctx.stroke();
      }
    }
    // the end of the drive
    if (L.len < dTop) { ctx.fillStyle = '#f3f5f8'; const yy = Y(L.len); for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#0b1220' : '#f3f5f8'; ctx.fillRect(X(center(L.len) - half) + (i * L.wide * ppf) / 8, yy - 5, (L.wide * ppf) / 8, 5); } }
    for (const b of blobs) { ctx.fillStyle = '#17191d'; ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.s), 1.3 * ppf, 0.8 * ppf, 0.4, 0, 7); ctx.fill(); }

    if (truck) drawTruck(X(x), sy - (14.2 + truck.gap) * ppf, ppf, truck);
    drawPaver(X(x), sy, ppf);
    hud(W);
  }

  // The paver from above, nose up the screen. (cx, sy) is the middle of the back of the screed.
  function drawPaver(cx, sy, f) {
    const lean = clamp(vx * 0.012, -0.08, 0.08), half = L.wide / 2;
    ctx.save(); ctx.translate(cx, sy); ctx.rotate(lean);
    const box = (x0, y0, w, h, r, fill) => { rr(ctx, x0 * f, -y0 * f - h * f, w * f, h * f, r * f); ctx.fillStyle = fill; ctx.fill(); };
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, -4.6 * f, -13.6 * f, 9.6 * f, 13.2 * f, 0.6 * f); ctx.fill();
    // screed: the wide bar at the back that lays the mat
    box(-half, 0, L.wide, 1.5, 0.15, '#3a414c'); box(-half, 0.25, L.wide, 0.35, 0.1, '#596271');
    box(-half - 0.25, -0.1, 0.5, 2.0, 0.1, '#f2a516'); box(half - 0.25, -0.1, 0.5, 2.0, 0.1, '#f2a516');
    // auger carrying mix out to the edges
    ctx.strokeStyle = '#14171c'; ctx.lineWidth = Math.max(1.5, 0.28 * f); ctx.beginPath(); for (let a = -half + 0.5; a < half - 0.4; a += 0.7) { ctx.moveTo(a * f, -1.6 * f); ctx.lineTo((a + 0.35) * f, -2.15 * f); } ctx.stroke();
    box(-half + 0.3, 1.5, L.wide - 0.6, 0.75, 0.1, hopper > 0 ? '#1b1d21' : '#6f6957');
    // tracks and the tractor body
    box(-4.2, 2.3, 1.1, 8.0, 0.3, '#14171c'); box(3.1, 2.3, 1.1, 8.0, 0.3, '#14171c');
    ctx.fillStyle = 'rgba(255,255,255,0.09)'; for (let y0 = 2.6; y0 < 10; y0 += 0.7) { ctx.fillRect(-4.2 * f, -(y0 + ((s * 0.9) % 0.7)) * f, 1.1 * f, 0.14 * f); ctx.fillRect(3.1 * f, -(y0 + ((s * 0.9) % 0.7)) * f, 1.1 * f, 0.14 * f); }
    const g = ctx.createLinearGradient(-3.2 * f, 0, 3.2 * f, 0); g.addColorStop(0, '#e2940f'); g.addColorStop(0.5, '#f7b12c'); g.addColorStop(1, '#dc8d0c');
    rr(ctx, -3.2 * f, -8.6 * f, 6.4 * f, 6.2 * f, 0.4 * f); ctx.fillStyle = g; ctx.fill();
    box(-2.5, 6.2, 5.0, 2.0, 0.25, '#c97f0a'); ctx.fillStyle = 'rgba(11,18,32,0.35)'; for (let i = 0; i < 6; i++) ctx.fillRect((-2.1 + i * 0.75) * f, -8.0 * f, 0.3 * f, 1.6 * f);   // engine hood and vents
    box(1.7, 7.0, 0.5, 0.5, 0.25, '#2a2f37');                                    // exhaust
    box(-2.7, 2.7, 5.4, 3.0, 0.25, '#2a2f37'); box(-2.4, 3.0, 4.8, 2.4, 0.2, '#3a414c');   // operator deck
    box(-1.6, 3.3, 1.5, 1.4, 0.3, '#14171c');                                    // seat
    ctx.beginPath(); ctx.arc(-0.85 * f, -4.1 * f, 0.62 * f, 0, 7); ctx.fillStyle = '#c8f03c'; ctx.fill(); ctx.beginPath(); ctx.arc(-0.85 * f, -4.1 * f, 0.38 * f, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();   // operator
    box(0.5, 4.1, 1.5, 0.9, 0.15, '#596271');                                    // controls
    // hopper at the front, with however much mix is in it
    ctx.beginPath(); ctx.moveTo(-4.3 * f, -8.6 * f); ctx.lineTo(-4.7 * f, -13.4 * f); ctx.lineTo(4.7 * f, -13.4 * f); ctx.lineTo(4.3 * f, -8.6 * f); ctx.closePath(); ctx.fillStyle = '#2f353f'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3.7 * f, -8.9 * f); ctx.lineTo(-4.05 * f, -13.0 * f); ctx.lineTo(4.05 * f, -13.0 * f); ctx.lineTo(3.7 * f, -8.9 * f); ctx.closePath(); ctx.fillStyle = '#4a515d'; ctx.fill();
    ctx.fillStyle = 'rgba(11,18,32,0.4)'; for (let y0 = 9.2; y0 < 13; y0 += 0.6) ctx.fillRect(-1.4 * f, -y0 * f, 2.8 * f, 0.18 * f);   // conveyor slats
    if (hopper > 0.02) { const k = 0.25 + hopper * 0.75; ctx.beginPath(); ctx.ellipse(0, -10.95 * f, 3.75 * f * k, 2.0 * f * Math.min(1, k + 0.12), 0, 0, 7); ctx.fillStyle = '#16181c'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 9; i++) { const a = i * 2.4; ctx.fillRect(Math.cos(a) * 2.2 * f * k * ((i % 3) / 3 + 0.2), -10.95 * f + Math.sin(a) * 1.2 * f * k * ((i % 2) / 2 + 0.3), 2, 2); } }
    box(-3.4, 13.4, 6.8, 0.45, 0.2, '#14171c');                                  // push rollers
    ctx.restore();
  }
  // A dump truck from above, backed up to the paver: tailgate toward the paver, cab up the screen.
  function drawTruck(cx, backY, f, tr) {
    ctx.save(); ctx.translate(cx, backY);
    const box = (x0, y0, w, h, r, fill) => { rr(ctx, x0 * f, -y0 * f - h * f, w * f, h * f, r * f); ctx.fillStyle = fill; ctx.fill(); };
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, -4.0 * f, -22.4 * f, 8.6 * f, 22.4 * f, 0.6 * f); ctx.fill();
    for (const y0 of [2.2, 6.0]) { box(-4.1, y0, 1.0, 3.2, 0.3, '#14171c'); box(3.1, y0, 1.0, 3.2, 0.3, '#14171c'); }
    box(-3.9, 17.6, 0.9, 2.8, 0.3, '#14171c'); box(3.0, 17.6, 0.9, 2.8, 0.3, '#14171c');
    const dumping = tr.state === 'docked' && feedHeld && tr.load > 0;
    box(-3.8, 0.4, 7.6, 14.6, 0.35, '#23272e'); box(-3.3, 0.9, 6.6, 13.6, 0.25, '#14161a');   // bed
    if (tr.load > 0.02) { const k = clamp(tr.load / 1.25, 0.12, 1); ctx.beginPath(); ctx.ellipse(0, -(0.9 + 6.8 * k) * f, 3.0 * f, 6.5 * f * k, 0, 0, 7); ctx.fillStyle = '#0d0e10'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2; ctx.stroke(); }
    box(-3.8, 13.9, 7.6, 1.1, 0.2, '#2d323a'); box(-3.8, 9.4, 7.6, 0.3, 0.1, '#2d323a'); box(-3.8, 5.0, 7.6, 0.3, 0.1, '#2d323a');
    box(-3.8, 2.6, 7.6, 0.4, 0.1, '#0ea5a9');                                    // CGH stripe
    box(-3.6, 15.6, 7.2, 6.2, 0.7, '#eef1f5'); box(-3.1, 16.0, 6.2, 2.9, 0.4, '#dfe5ec');     // cab and hood
    box(-3.0, 18.9, 6.0, 1.3, 0.3, '#1c2942'); box(-3.3, 15.9, 6.6, 0.5, 0.1, '#1c2942');     // windshield, back window
    box(-4.5, 19.3, 0.9, 0.5, 0.1, '#23272e'); box(3.6, 19.3, 0.9, 0.5, 0.1, '#23272e');     // mirrors
    if (tr.state !== 'docked') { ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ff5a4d' : '#a3231c'; ctx.fillRect(-3.4 * f, -0.75 * f, 1.0 * f, 0.4 * f); ctx.fillRect(2.4 * f, -0.75 * f, 1.0 * f, 0.4 * f); }
    if (dumping) { ctx.fillStyle = '#0d0e10'; for (let i = 0; i < 12; i++) { const ph = (t * 3 + i / 12) % 1; ctx.beginPath(); ctx.arc((Math.sin(i * 5.1) * 2.4) * f, (0.2 + ph * 2.6) * f, (0.5 - ph * 0.2) * f, 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  function hud(W) {
    const pad = 10, gapW = 8, cols = L.feed ? 3 : 2, w = (W - pad * 2 - gapW * (cols - 1)) / cols, y = 10, a = pct();
    pill(ctx, pad, y, w, 'On the line', a + '%', { color: a >= 90 ? '#7ef0c2' : a >= 80 ? '#f5c542' : '#ff7a6e' });
    pill(ctx, pad + w + gapW, y, w, 'Feet to go', String(Math.max(0, Math.round(L.len - s))));
    if (L.feed) {
      const hx = pad + (w + gapW) * 2, low = hopper < 0.25;
      pill(ctx, hx, y, w, 'Hopper', '', low ? { edge: '#ff7a6e', bg: Math.floor(t * 3) % 2 ? 'rgba(110,20,16,0.85)' : undefined } : {});
      bar(ctx, hx + 10, y + 24, w - 20, 11, hopper, low ? '#ff7a6e' : hopper > 0.97 ? '#f5c542' : '#34d399');
    }
    bar(ctx, pad, y + 52, W - pad * 2, 6, s / L.len, '#0ea5a9');
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, y + 68, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
    const docked = truck && truck.state === 'docked';
    feedBtn.style.opacity = docked ? '1' : '0.45'; feedBtn.style.borderColor = docked && !pedal ? '#34d399' : '';
  }
  return { start, update, draw, destroy() { feedBtn.remove(); }, peek: () => ({ s, x, center, hopper, truck, L }), poke: (v) => { target = v; } };
}
