// HAUL RUN: drive a loaded dump truck from the plant to the job.
// Three lanes seen from behind the truck. Swipe to change lanes, hold the brake for slow zones,
// and get there before the hot mix cools off.
//
// Each level is one haul. The numbers that set how hard a level is are in LEVELS below:
//   len    how long the haul is            speed  cruising speed
//   gap    seconds between things in the road (smaller = busier)
//   mix    what shows up: cones, holes (potholes), cars
//   zones  slow zones: where they start, how long, the speed limit, work zone or school zone
//   cool   degrees lost on a perfect run (bigger = less room for mistakes)
import { clamp, lerp, rr, rng, font, pill, bar, banner } from './kit.js';

const LEVELS = [
  { len: 1100, speed: 24, gap: 1.8, mix: { cones: 1 }, zones: [], cool: 12 },
  { len: 1300, speed: 25, gap: 1.6, mix: { cones: 1, holes: 1.4 }, zones: [], cool: 13 },
  { len: 1500, speed: 26, gap: 1.5, mix: { cones: 1, holes: 0.6, cars: 1.3 }, zones: [], cool: 14 },
  { len: 1450, speed: 26, gap: 1.45, mix: { cones: 1.2, holes: 0.6, cars: 0.7 }, zones: [{ at: 420, len: 170, limit: 25, kind: 'work' }, { at: 1020, len: 170, limit: 25, kind: 'work' }], cool: 14 },
  { len: 1800, speed: 28, gap: 1.35, mix: { cones: 1, holes: 1, cars: 1 }, zones: [], cool: 19, cold: true },
  { len: 1600, speed: 26, gap: 1.45, mix: { cones: 0.8, holes: 1.2, cars: 1.2 }, zones: [{ at: 850, len: 170, limit: 25, kind: 'work' }], cool: 15, rain: true },
  { len: 1700, speed: 28, gap: 1.3, mix: { cones: 1, holes: 0.8, cars: 1.2 }, zones: [{ at: 400, len: 150, limit: 20, kind: 'school' }, { at: 1150, len: 150, limit: 20, kind: 'school' }], cool: 15 },
  { len: 2000, speed: 31, gap: 1.12, mix: { cones: 1.3, holes: 1, cars: 1.3 }, zones: [{ at: 560, len: 160, limit: 25, kind: 'work' }, { at: 1350, len: 160, limit: 20, kind: 'school' }], cool: 16 },
];
const MPH = 1.8;              // game speed to miles per hour on the dash
const LANE = 3.6;             // lane width
const START_TEMP = 300, REJECT = 250, GOOD = 265, GREAT = 275;
const CAR_COLORS = ['#c9d2dc', '#8b1e24', '#2c4a7c', '#3f4650', '#d8d2c2', '#5d6b4a'];

// Lays the whole haul out ahead of time, the same way every time for a given level.
function layout(n) {
  const L = LEVELS[n], rand = rng(9001 + n * 77), items = [];
  const kinds = Object.entries(L.mix), total = kinds.reduce((a, [, w]) => a + w, 0);
  const pick = () => { let r = rand() * total; for (const [k, w] of kinds) { r -= w; if (r <= 0) return k; } return kinds[0][0]; };
  const inZone = (d) => L.zones.find((z) => d > z.at - 70 && d < z.at + z.len + 20);
  const carUntil = [0, 0, 0];
  let d = 170, lastFree = 1;
  while (d < L.len - 120) {
    const z = inZone(d), blockedByCar = [0, 1, 2].filter((l) => carUntil[l] > d);
    if (z) {
      // inside a slow zone the road is quiet: just a line of checks to pick up
      if (rand() < 0.5) { const lane = Math.floor(rand() * 3); for (let i = 0; i < 4; i++) items.push({ t: 'check', lane, d: d + i * 7 }); }
      d += L.speed * L.gap * 1.2; continue;
    }
    const kind = pick();
    // a slow car is only put out where the truck will be past it before the next slow zone
    const zoneSoon = L.zones.some((zz) => zz.at - 80 > d - 40 && zz.at - 80 < d + 340);
    if (kind === 'cars' && blockedByCar.length === 0 && !zoneSoon && d < L.len - 420) {
      const lane = Math.floor(rand() * 3);
      items.push({ t: 'car', lane, d, v: L.speed * (0.5 + rand() * 0.14), color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], truck: rand() < 0.45 });
      carUntil[lane] = d + 300;
    } else {
      // block one or two lanes, but always leave a lane open that a car is not sitting in
      const open = [0, 1, 2].filter((l) => !blockedByCar.includes(l));
      const two = n >= 2 && open.length === 3 && rand() < 0.2 + n * 0.05;
      const keep = open[Math.floor(rand() * open.length)];
      let block = open.filter((l) => l !== keep);
      if (!two && block.length > 1) block = [block[Math.floor(rand() * block.length)]];
      if (open.length === 1) block = [];
      for (const lane of block) items.push({ t: kind === 'holes' ? 'hole' : rand() < 0.3 ? 'barrel' : 'cone', lane, d });
      // a few checks to grab in a lane that is open
      if (rand() < 0.7) { const lane = block.length ? keep : Math.floor(rand() * 3); if (!blockedByCar.includes(lane)) for (let i = 0; i < 3; i++) items.push({ t: 'check', lane, d: d + 6 + i * 7 }); }
      lastFree = keep;
    }
    d += L.speed * L.gap * (0.85 + rand() * 0.3);
  }
  for (const z of L.zones) { items.push({ t: 'sign', d: z.at - 95, zone: z, ahead: true }, { t: 'sign', d: z.at, zone: z }); }
  return items.sort((a, b) => a.d - b.d);
}

export function create(env) {
  const { ctx } = env;
  let L, n, items, dist, v, px, lane, temp, hits, tickets, checks, points, streak, shake, ghost, t, braking, coolRate, zoneNow, over, overTime, ticketed, note, noteT, endT, particles;
  const brakeBtn = document.createElement('button');
  brakeBtn.type = 'button'; brakeBtn.className = 'gk-pedal gk-pedal--right gk-pedal--red'; brakeBtn.innerHTML = 'BRAKE<small>hold to slow</small>';
  let pedal = false;
  const press = (on) => (e) => { e.preventDefault(); pedal = on; brakeBtn.classList.toggle('is-down', on); };
  brakeBtn.addEventListener('pointerdown', press(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => brakeBtn.addEventListener(ev, press(false)));
  brakeBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  const say = (text, good) => { note = { text, good }; noteT = 2.2; };
  // where the truck is on the screen, for score pop-ups
  const truckAt = () => { const s = (env.W * 0.86) / 10.8; return [env.W / 2 + px * 0.18 * s, env.H * 0.34 + env.H * 0.47 - 3.9 * s]; };
  const award = (pts, text, color) => { points += pts; const [x, y] = truckAt(); env.pop(x, y, text, color); };
  let left = { lane: -1, at: -99 };   // the lane the truck last pulled out of, and where
  const steer = (dir) => { const next = clamp(lane + dir, 0, 2); if (next !== lane) { left = { lane, at: dist }; lane = next; env.sfx('move'); } };

  function start(level) {
    n = level; L = LEVELS[n]; items = layout(n).map((o) => ({ ...o }));
    dist = 0; v = L.speed * 0.5; px = 0; lane = 1; temp = START_TEMP; hits = 0; tickets = 0; checks = 0; points = 0; streak = 0; shake = 0; ghost = 0; t = 0; braking = false;
    left = { lane: -1, at: -99 }; zoneNow = null; over = false; overTime = 0; ticketed = new Set(); note = null; noteT = 0; endT = 0; particles = [];
    // Heat is lost by the second. A clean run at cruising speed, slowing only for the zones, loses `cool` degrees.
    const zoneLen = L.zones.reduce((a, z) => a + z.len, 0), clean = (L.len - zoneLen) / L.speed + L.zones.reduce((a, z) => a + z.len / ((z.limit - 2) / MPH), 0);
    coolRate = L.cool / clean;
    env.stage.appendChild(brakeBtn);
    env.onSwipe = (dir, x) => { if (dir === 'left') steer(-1); else if (dir === 'right') steer(1); else if (dir === 'tap') steer(x < env.W / 2 ? -1 : 1); };
    env.onKey = (k) => { if (k === 'ArrowLeft' || k === 'a' || k === 'A') steer(-1); if (k === 'ArrowRight' || k === 'd' || k === 'D') steer(1); };
    say(L.rain ? 'Wet road. Brake early.' : L.cold ? 'Cold morning. The mix cools faster.' : 'Deliver the mix while it is hot', true);
  }

  function crash(o) {
    hits++; streak = 0; temp -= 6; v = Math.max(8, v * 0.4); ghost = 1.5; shake = 0.5; env.sfx('hit'); env.buzz(120);
    say(o.t === 'hole' ? 'Pothole. That shook the load.' : o.t === 'car' ? 'Too close. Leave room.' : 'Hit a ' + o.t + '.', false);
    if (o.t !== 'car' && o.t !== 'hole') { o.gone = true; for (let i = 0; i < 8; i++) particles.push({ x: px, z: 4, vx: (Math.random() - 0.5) * 9, vy: 5 + Math.random() * 6, y: 0.4, life: 0.8, c: '#f47a20' }); }
  }

  function update(dt) {
    t += dt;
    if (endT > 0) { endT -= dt; v = Math.max(0, v - 30 * dt); dist += v * dt; if (endT <= 0) done(); return; }
    braking = pedal || env.keys.has('ArrowDown') || env.keys.has(' ') || env.keys.has('s') || env.keys.has('S');
    const grip = L.rain ? 0.55 : 1;
    if (braking) v = Math.max(9, v - 24 * grip * dt); else v = Math.min(L.speed, v + 8 * dt);
    dist += v * dt;
    const target = (lane - 1) * LANE, side = 17 * (L.rain ? 0.7 : 1) * dt;
    px = Math.abs(target - px) <= side ? target : px + Math.sign(target - px) * side;
    temp -= coolRate * dt; ghost = Math.max(0, ghost - dt); shake = Math.max(0, shake - dt); noteT = Math.max(0, noteT - dt);

    // slow zones
    const z = L.zones.find((zz) => dist > zz.at && dist < zz.at + zz.len) || null;
    if (z && !zoneNow) { env.sfx('warn'); }
    if (!z && zoneNow) { if (!ticketed.has(zoneNow)) { say('Zone clear. Nice and slow.', true); award(200, 'Zone clear +200', '#7ef0c2'); env.sfx('good'); } }
    zoneNow = z;
    over = !!z && v * MPH > z.limit + 3;
    if (over) { overTime += dt; if (overTime > 0.7 && !ticketed.has(z)) { ticketed.add(z); tickets++; streak = 0; shake = 0.25; env.sfx('bad'); env.buzz(80); say(z.kind === 'school' ? 'Speeding in a school zone: ticket' : 'Speeding in a work zone: ticket', false); } } else overTime = 0;
    const coming = L.zones.find((zz) => dist > zz.at - 95 && dist <= zz.at);
    if (coming && !coming.warned) { coming.warned = true; say((coming.kind === 'school' ? 'School zone ahead: ' : 'Work zone ahead: ') + coming.limit + ' mph', false); env.sfx('warn'); }

    // everything in the road
    for (const o of items) {
      if (o.gone || o.t === 'sign') continue;
      if (o.t === 'car') {
        // A slow car has a stretch of lane kept clear for it. If the truck dawdles and the car gets past
        // that stretch, the car speeds up and pulls away so it can never box the truck in.
        if (o.from === undefined) o.from = o.d;
        if (o.d > o.from + 280) o.flee = true;
        if (o.d - dist < 190) o.d += (o.flee ? L.speed * 1.35 : o.v) * dt;
        else if (o.flee) o.gone = true;
      }
      const rel = o.d - dist;
      if (rel > 7 || rel < -2) continue;
      const ox = (o.lane - 1) * LANE, side2 = Math.abs(px - ox);
      if (o.t === 'check') {
        if (side2 < 2.1) {
          // checks in a row build a streak: every four in a row is worth one more times the points, up to five
          o.gone = true; checks++; streak++; const mult = Math.min(5, 1 + Math.floor(streak / 4));
          if (streak % 4 === 0 && mult > 1 && streak <= 16) { award(50 * mult, 'Streak ×' + mult + '!', '#f5c542'); env.sfx('good'); } else { award(50 * mult, '+' + 50 * mult, '#7ef0c2'); env.sfx('pick'); }
        }
      }
      // squeezing past something in the next lane without touching it
      else if (rel < 1.5 && !o.hit && !o.near && o.t !== 'hole' && side2 >= 2.25 && ghost <= 0) { o.near = true; if (o.lane === left.lane && dist - left.at < 24) award(75, 'Close call +75', '#fff'); }
      else if (side2 < (o.t === 'car' ? 2.25 : 2.0) && ghost <= 0 && !o.hit) { o.hit = true; crash(o); }
    }
    for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 22 * dt; p.z -= v * dt * 0.6; }
    particles = particles.filter((p) => p.life > 0 && p.y > -0.2);

    if (hits >= 3) return env.finish({ stars: 0, score: score(), headline: 'Truck is out of service', note: 'Three hits and the truck is done for the day. Look farther ahead and move over early.', stats: stats() });
    if (temp < REJECT) return env.finish({ stars: 0, score: score(), headline: 'The load got too cold', note: 'Under 250 degrees the mix will not pack down right, so the load was turned away.', stats: stats() });
    if (dist >= L.len && endT <= 0) { endT = 0.9; env.sfx('good'); }
  }
  const score = () => Math.max(0, Math.round(points + Math.max(0, temp - REJECT) * 20 + (3 - hits) * 300 - tickets * 400));
  const stats = () => [['Mix temp', Math.round(temp) + '°F'], ['Hits', String(hits)], ['Tickets', String(tickets)], ['Checks', String(checks)]];
  function done() {
    let stars = 1; if (temp >= GOOD && tickets === 0) stars = 2; if (stars === 2 && temp >= GREAT && hits === 0) stars = 3;
    const noteText = stars === 3 ? 'Hot load, no dents, no tickets. That is how it is done.' : tickets ? 'Delivered, but a ticket costs more than the minute you saved.' : hits ? 'Delivered. Every hit cost heat and time.' : 'Delivered, but the mix cooled off. Brake only where you need to.';
    env.finish({ stars, score: score(), headline: 'Load delivered', note: noteText, stats: stats() });
  }

  // ----- drawing -----
  let W, H, hz, s0, D = 9, CH;
  const scaleAt = (z) => (s0 * D) / (z + D);
  const curveNow = () => (Math.sin(dist / 190) * 0.55 + Math.sin(dist / 71 + 1.3) * 0.25) * 0.42;
  function proj(x, z, y = 0) {
    const s = scaleAt(z), k = 1 - s / s0;
    return { x: W / 2 + (x - px * 0.82) * s + curveNow() * k * k * W, y: hz + (CH - y) * s, s };
  }
  function quad(a, b, c, d, fill) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }

  function scenery() {
    const rain = L.rain, g = ctx.createLinearGradient(0, 0, 0, hz);
    if (rain) { g.addColorStop(0, '#4b5663'); g.addColorStop(1, '#8a96a2'); } else if (L.cold) { g.addColorStop(0, '#6f8fb3'); g.addColorStop(1, '#f0d9c4'); } else { g.addColorStop(0, '#4f93d1'); g.addColorStop(1, '#cfe6f5'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
    if (!rain) { const sx = W * 0.74 - curveNow() * W * 0.5, sy = hz * 0.42; const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, hz * 0.5); sg.addColorStop(0, 'rgba(255,244,214,0.95)'); sg.addColorStop(0.12, 'rgba(255,240,200,0.5)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, hz); }
    // far tree line (East Texas pines): two low rows of pointed tops, sliding a little with the curve
    const shift = -curveNow() * W * 0.6 - dist * 0.02;
    for (const [amp, base, col, step, par] of [[hz * 0.075, hz * 0.955, rain ? '#3a4a44' : '#4f7d5f', 17, 0.5], [hz * 0.07, hz * 1.0, rain ? '#26352f' : '#2c543c', 13, 1]]) {
      const off = ((shift * par) % step + step) % step, i0 = Math.floor(-shift * par / step);
      ctx.beginPath(); ctx.moveTo(-step, hz + 2);
      for (let k = -1; k * step <= W + step; k++) { const h = Math.abs(Math.sin((i0 + k) * 12.9898) * 43758.5453) % 1, x = k * step + off; ctx.lineTo(x - step * 0.5, base - amp * 0.15); ctx.lineTo(x, base - amp * (0.45 + h * 0.55)); }
      ctx.lineTo(W + step, hz + 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
  }
  function road() {
    const B = 6, zFar = 190, rain = L.rain;
    const first = Math.floor((dist - 5.2) / B);
    const bands = []; for (let i = first; i * B - dist < zFar; i++) bands.push(i);
    for (let k = bands.length - 1; k >= 0; k--) {
      const i = bands[k], z1 = Math.max(-5.2, i * B - dist - 0.3), z2 = Math.min(zFar, (i + 1) * B - dist); if (z2 <= z1) continue;
      const odd = ((i % 2) + 2) % 2, a = proj(0, z2), b = proj(0, z1);
      const zone = L.zones.find((zz) => i * B > zz.at && i * B < zz.at + zz.len);
      ctx.fillStyle = rain ? (odd ? '#2f4a38' : '#2b4434') : odd ? '#3d7446' : '#376b40';
      ctx.fillRect(0, a.y - 0.5, W, b.y - a.y + 1.5);
      const edge = (x, z) => proj(x, z);
      // shoulder, pavement, edge lines
      quad(edge(-7.2, z2), edge(7.2, z2), edge(7.2, z1), edge(-7.2, z1), rain ? '#6d6a60' : odd ? '#9a917c' : '#91886f');
      quad(edge(-5.7, z2), edge(5.7, z2), edge(5.7, z1), edge(-5.7, z1), rain ? (odd ? '#2a2e35' : '#272b31') : odd ? '#41464e' : '#3c4149');
      for (const x of [-5.45, 5.45]) quad(edge(x - 0.09, z2), edge(x + 0.09, z2), edge(x + 0.09, z1), edge(x - 0.09, z1), zone ? '#f47a20' : '#e8ecf1');
      if (odd) for (const x of [-1.8, 1.8]) quad(edge(x - 0.08, z2), edge(x + 0.08, z2), edge(x + 0.08, z1), edge(x - 0.08, z1), '#e8ecf1');
    }
    // a little haze where the road meets the trees
    const hg = ctx.createLinearGradient(0, hz, 0, hz + H * 0.05); hg.addColorStop(0, L.rain ? 'rgba(138,150,162,0.7)' : 'rgba(190,215,200,0.22)'); hg.addColorStop(1, 'rgba(190,215,200,0)'); ctx.fillStyle = hg; ctx.fillRect(0, hz, W, H * 0.05);
  }
  function shadow(p, w, a = 0.28) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * p.s, w * p.s * 0.22, 0, 0, 7); ctx.fill(); }
  function pine(x, z, seed) {
    const p = proj(x, z); if (p.x < -80 || p.x > W + 80) return;
    const h = (8 + (seed % 5)) * p.s, w = h * 0.36;
    ctx.fillStyle = '#4a3423'; ctx.fillRect(p.x - w * 0.07, p.y - h * 0.3, w * 0.14, h * 0.3);
    for (let i = 0; i < 3; i++) { const top = p.y - h + i * h * 0.2, bot = p.y - h * 0.22 + i * h * 0.04 - (2 - i) * h * 0.2, half = w * (0.5 + i * 0.25); ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x + half, bot); ctx.lineTo(p.x - half, bot); ctx.closePath(); ctx.fillStyle = L.rain ? ['#27402f', '#223829', '#1d3124'][i] : ['#2f6b3f', '#295f38', '#235331'][i]; ctx.fill(); }
  }
  function cone(p, dx = 0) {
    const s = p.s, x = p.x + dx * s, h = 1.25 * s, w = 0.42 * s;
    ctx.fillStyle = '#1d232d'; ctx.fillRect(x - w * 1.25, p.y - 0.09 * s, w * 2.5, 0.11 * s);
    ctx.beginPath(); ctx.moveTo(x - w, p.y - 0.08 * s); ctx.lineTo(x - w * 0.22, p.y - h); ctx.lineTo(x + w * 0.22, p.y - h); ctx.lineTo(x + w, p.y - 0.08 * s); ctx.closePath(); ctx.fillStyle = '#f47a20'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - w * 0.66, p.y - h * 0.42); ctx.lineTo(x - w * 0.5, p.y - h * 0.62); ctx.lineTo(x + w * 0.5, p.y - h * 0.62); ctx.lineTo(x + w * 0.66, p.y - h * 0.42); ctx.closePath(); ctx.fillStyle = '#f3f5f8'; ctx.fill();
  }
  function barrel(p) {
    const s = p.s, w = 0.95 * s, h = 1.5 * s, x = p.x - w / 2, y = p.y - h;
    rr(ctx, x, y, w, h, w * 0.18); ctx.fillStyle = '#f47a20'; ctx.fill();
    ctx.fillStyle = '#f3f5f8'; ctx.fillRect(x, y + h * 0.2, w, h * 0.16); ctx.fillRect(x, y + h * 0.56, w, h * 0.16);
    ctx.fillStyle = '#1d232d'; ctx.fillRect(x - w * 0.08, p.y - h * 0.07, w * 1.16, h * 0.08);
  }
  function hole(p) {
    const rx = 1.45 * p.s, ry = rx * 0.26;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 1.12, ry * 1.25, 0, 0, 7); ctx.fillStyle = 'rgba(160,150,128,0.75)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x, p.y + ry * 0.08, rx, ry, 0, 0, 7); ctx.fillStyle = '#14171c'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x - rx * 0.1, p.y + ry * 0.3, rx * 0.6, ry * 0.4, 0, 0, 7); ctx.fillStyle = 'rgba(70,110,140,0.35)'; ctx.fill();
  }
  function check(p, phase) {
    const r = 0.62 * p.s, y = p.y - (1.3 + Math.sin(t * 5 + phase) * 0.12) * p.s;
    ctx.beginPath(); ctx.arc(p.x, y, r * 1.35, 0, 7); ctx.fillStyle = 'rgba(52,211,153,0.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, y, r, 0, 7); ctx.fillStyle = '#34d399'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.14); ctx.strokeStyle = '#eafff6'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - r * 0.45, y); ctx.lineTo(p.x - r * 0.1, y + r * 0.36); ctx.lineTo(p.x + r * 0.5, y - r * 0.34); ctx.lineWidth = Math.max(1.2, r * 0.24); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1220'; ctx.stroke();
  }
  function car(p, o) {
    const s = p.s, w = (o.truck ? 2.05 : 1.9) * s, h = (o.truck ? 1.75 : 1.45) * s, x = p.x - w / 2, y = p.y - h;
    ctx.fillStyle = '#14171c'; rr(ctx, x + w * 0.02, p.y - 0.62 * s, w * 0.2, 0.62 * s, 0.08 * s); ctx.fill(); rr(ctx, x + w * 0.78, p.y - 0.62 * s, w * 0.2, 0.62 * s, 0.08 * s); ctx.fill();
    rr(ctx, x, y + h * 0.36, w, h * 0.5, 0.14 * s); ctx.fillStyle = o.color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.4); ctx.lineTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.8, y); ctx.lineTo(x + w * 0.9, y + h * 0.4); ctx.closePath(); ctx.fillStyle = o.color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h * 0.36); ctx.lineTo(x + w * 0.25, y + h * 0.07); ctx.lineTo(x + w * 0.75, y + h * 0.07); ctx.lineTo(x + w * 0.82, y + h * 0.36); ctx.closePath(); ctx.fillStyle = 'rgba(18,27,46,0.85)'; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + h * 0.7, w, h * 0.06);
    ctx.fillStyle = '#e02d2d'; rr(ctx, x + w * 0.05, y + h * 0.46, w * 0.16, h * 0.13, 2); ctx.fill(); rr(ctx, x + w * 0.79, y + h * 0.46, w * 0.16, h * 0.13, 2); ctx.fill();
    ctx.fillStyle = '#eef1f5'; ctx.fillRect(x + w * 0.4, y + h * 0.62, w * 0.2, h * 0.1);
  }
  function sign(p, o) {
    const s = p.s, z = o.zone, school = z.kind === 'school', w = 2.9 * s, h = 2.5 * s, top = p.y - 4.3 * s;
    ctx.fillStyle = '#7c8794'; ctx.fillRect(p.x - 0.07 * s, top + h, 0.14 * s, 4.3 * s - h);
    rr(ctx, p.x - w / 2, top, w, h, 0.18 * s); ctx.fillStyle = school ? '#d7e94b' : '#f47a20'; ctx.fill(); ctx.lineWidth = Math.max(1, 0.08 * s); ctx.strokeStyle = '#14171c'; ctx.stroke();
    if (s > 3.2) {
      ctx.fillStyle = '#14171c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = font(0.5 * s, 800); ctx.fillText(school ? 'SCHOOL' : 'WORK ZONE', p.x, top + h * 0.2, w * 0.9);
      if (o.ahead) { ctx.font = font(0.5 * s, 800); ctx.fillText('AHEAD', p.x, top + h * 0.45, w * 0.9); ctx.font = font(0.62 * s, 900); ctx.fillText(z.limit + ' MPH', p.x, top + h * 0.76, w * 0.9); }
      else { ctx.font = font(1.25 * s, 900); ctx.fillText(String(z.limit), p.x, top + h * 0.62); }
    }
  }
  function gate(z) {
    const a = proj(-7, z), b = proj(7, z), s = a.s, top = a.y - 6.2 * s;
    ctx.fillStyle = '#56616f'; ctx.fillRect(a.x - 0.18 * s, top, 0.36 * s, 6.2 * s); ctx.fillRect(b.x - 0.18 * s, top, 0.36 * s, 6.2 * s);
    rr(ctx, a.x - 0.2 * s, top, b.x - a.x + 0.4 * s, 1.9 * s, 0.2 * s); ctx.fillStyle = '#0ea5a9'; ctx.fill();
    if (s > 2) { ctx.fillStyle = '#0b1220'; ctx.font = font(1.05 * s, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CGH JOB SITE', (a.x + b.x) / 2, top + 1.0 * s, (b.x - a.x) * 0.9); }
  }
  // The dump truck, seen from behind.
  function truck() {
    const s = s0, bounce = Math.sin(t * 34) * 0.5 * (v / 30), lean = clamp(((lane - 1) * LANE - px) * 0.035, -0.07, 0.07);
    const cx = W / 2 + px * 0.18 * s + (shake > 0 && !env.reduced ? (Math.random() - 0.5) * 10 * shake : 0), gy = hz + CH * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, gy + 0.05 * s, 1.75 * s, 0.34 * s, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(cx, gy + bounce); ctx.rotate(lean);
    if (ghost > 0 && Math.floor(ghost * 12) % 2) ctx.globalAlpha = 0.45;
    const m = (x, y, w, h, r, fill) => { rr(ctx, x * s, -y * s - h * s, w * s, h * s, r * s); ctx.fillStyle = fill; ctx.fill(); };
    // dual tires
    for (const x of [-1.28, -0.94, 0.5, 0.84]) m(x, 0, 0.44, 1.02, 0.1, '#14171c');
    for (const x of [-1.28, -0.94, 0.5, 0.84]) m(x + 0.06, 0.1, 0.06, 0.8, 0.02, '#2a2f37');
    m(-0.5, 0.36, 1.0, 0.34, 0.08, '#20252d');                // axle
    m(-1.32, 0.42, 0.72, 0.72, 0.03, '#0d1016'); m(0.6, 0.42, 0.72, 0.72, 0.03, '#0d1016');   // mud flaps
    m(-1.36, 1.02, 2.72, 0.24, 0.04, '#2b313a');              // frame bar
    const lit = braking ? '#ff4b3e' : '#a3231c';
    if (braking) { ctx.shadowColor = '#ff4b3e'; ctx.shadowBlur = 16; }
    m(-1.26, 1.06, 0.34, 0.16, 0.04, lit); m(0.92, 1.06, 0.34, 0.16, 0.04, lit); ctx.shadowBlur = 0;
    m(-0.2, 1.06, 0.4, 0.15, 0.02, '#eef1f5');                // plate
    // the bed and tailgate
    const g = ctx.createLinearGradient(0, -3.0 * s, 0, -1.26 * s); g.addColorStop(0, '#343b46'); g.addColorStop(1, '#1d2229');
    rr(ctx, -1.36 * s, -3.0 * s, 2.72 * s, 1.76 * s, 0.07 * s); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; for (const x of [-0.92, -0.46, 0, 0.46, 0.92]) ctx.fillRect((x - 0.035) * s, -2.94 * s, 0.07 * s, 1.64 * s);
    m(-1.36, 1.92, 2.72, 0.14, 0.02, '#0ea5a9');              // CGH teal stripe
    m(-1.42, 2.9, 2.84, 0.16, 0.05, '#596271');               // top rail
    m(-0.62, 2.22, 1.24, 0.52, 0.06, '#eef1f5');              // CGH plate on the tailgate
    ctx.fillStyle = '#0b1220'; ctx.font = font(0.44 * s, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CGH', 0, -2.46 * s);
    // the tarp over the load
    ctx.beginPath(); ctx.moveTo(-1.34 * s, -3.04 * s); ctx.quadraticCurveTo(0, -3.62 * s, 1.34 * s, -3.04 * s); ctx.closePath(); ctx.fillStyle = '#1c2942'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; for (const x of [-0.7, 0, 0.7]) { ctx.beginPath(); ctx.moveTo(x * s, -3.05 * s); ctx.lineTo(x * s, -(3.33 - Math.abs(x) * 0.2) * s); ctx.stroke(); }
    // heat coming off the load
    if (!env.reduced) for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i / 3) % 1; ctx.beginPath(); ctx.arc((-0.6 + i * 0.6) * s + Math.sin(t * 3 + i) * 3, -(3.5 + ph * 1.1) * s, (0.16 + ph * 0.2) * s, 0, 7); ctx.fillStyle = `rgba(255,255,255,${0.12 * (1 - ph)})`; ctx.fill(); }
    ctx.restore();
  }
  function hud() {
    const pad = 10, gapW = 8, w = (W - pad * 2 - gapW * 2) / 3, y = 10;
    const tc = temp >= GREAT ? '#7ef0c2' : temp >= GOOD ? '#f5c542' : '#ff7a6e';
    pill(ctx, pad, y, w, 'Mix temp', Math.round(temp) + '°F', { color: tc });
    const mph = Math.round(v * MPH);
    pill(ctx, pad + w + gapW, y, w, zoneNow ? 'Limit ' + zoneNow.limit : 'Speed', mph + ' mph', zoneNow ? { color: over ? '#ff7a6e' : '#7ef0c2', edge: over ? '#ff7a6e' : 'rgba(126,240,194,0.6)', bg: over ? 'rgba(110,20,16,0.85)' : undefined } : {});
    pill(ctx, pad + (w + gapW) * 2, y, w, 'Truck', '', {});
    for (let i = 0; i < 3; i++) { rr(ctx, pad + (w + gapW) * 2 + 10 + i * 22, y + 22, 16, 14, 4); ctx.fillStyle = i < 3 - hits ? '#34d399' : 'rgba(255,255,255,0.18)'; ctx.fill(); }
    // how far along the haul
    const by = y + 52; bar(ctx, pad, by, W - pad * 2, 6, dist / L.len, '#0ea5a9');
    for (const z of L.zones) { ctx.fillStyle = z.kind === 'school' ? '#d7e94b' : '#f47a20'; ctx.fillRect(pad + (W - pad * 2) * (z.at / L.len), by, (W - pad * 2) * (z.len / L.len), 6); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pad + (W - pad * 2) * clamp(dist / L.len, 0, 1), by + 3, 6, 0, 7); ctx.fill();
    ctx.font = font(10, 700); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillText('PLANT', pad, by + 20); ctx.textAlign = 'right'; ctx.fillText('JOB', W - pad, by + 20);
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, by + 30, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
  }
  function draw() {
    W = env.W; H = env.H; hz = H * 0.34; s0 = (W * 0.86) / 10.8; CH = (H * 0.47) / s0;
    ctx.save();
    if (shake > 0 && !env.reduced) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
    scenery(); road();
    // everything standing on or beside the road, far ones first
    const things = [];
    const firstTree = Math.ceil((dist - 1) / 11);
    for (let i = firstTree; i * 11 - dist < 185; i++) { const h = Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1; things.push({ z: i * 11 - dist, f: () => { pine(-(9.5 + h * 9), i * 11 - dist, i); pine(9.5 + ((h * 7.3) % 1) * 9, i * 11 - dist + 4, i + 3); } }); }
    for (const o of items) {
      const z = o.d - dist; if (o.gone || z > 185 || z < -4) continue;
      if (o.t === 'sign') { things.push({ z, f: () => sign(proj(7.9, z), o) }); continue; }
      const ox = (o.lane - 1) * LANE;
      things.push({ z, f: () => { const p = proj(ox, z); if (o.t === 'hole') return hole(p); if (o.t === 'check') return check(p, o.d); shadow(p, o.t === 'car' ? 1.2 : 0.7); if (o.t === 'cone') { cone(p, -0.75); cone(p, 0.75); } else if (o.t === 'barrel') barrel(p); else car(p, o); } });
    }
    for (const z of L.zones) for (let d = Math.ceil(Math.max(z.at, dist - 5) / 9) * 9; d < z.at + z.len && d - dist < 150; d += 9) things.push({ z: d - dist, f: () => { const p = proj(-6.3, d - dist); cone(p); const q = proj(6.3, d - dist); cone(q); } });
    const gz = L.len + 14 - dist; if (gz < 185 && gz > -4) things.push({ z: gz, f: () => gate(gz) });
    things.sort((a, b) => b.z - a.z);
    let drewTruck = false;
    for (const th of things) { if (!drewTruck && th.z < 1.5) { truck(); drewTruck = true; } th.f(); }
    if (!drewTruck) truck();
    for (const p of particles) { const q = proj(p.x, p.z, p.y); ctx.fillStyle = p.c; ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillRect(q.x - 3, q.y - 3, 6, 6); ctx.globalAlpha = 1; }
    if (L.rain && !env.reduced) { ctx.strokeStyle = 'rgba(220,232,245,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 46; i++) { const x = Math.random() * (W + 60) - 30, y = Math.random() * H; ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 22); } ctx.stroke(); }
    if (L.rain) { ctx.fillStyle = 'rgba(20,30,45,0.18)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    hud();
  }
  return { start, update, draw, destroy() { brakeBtn.remove(); }, peek: () => ({ L, items, dist, lane, px, v, temp, hits, tickets }), poke: steer };
}
