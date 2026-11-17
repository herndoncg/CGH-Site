// BACK IT IN: back a loaded dump truck up to the paver.
// Seen from straight above. Hold REV to back up, FWD to pull ahead, and the arrows to turn the wheel.
// Stop with the tailgate lined up just short of the paver's hopper. Do not hit cones, fresh mat, the
// paver, or (worst of all) a person.
//
// Every level is a small yard, 60 feet wide and 90 feet tall, measured from the top left corner.
// In LEVELS below:
//   start   where the truck begins: x, y of its rear axle, and which way it faces (degrees: -90 = up the
//           screen, 0 = to the right, 180 = to the left)
//   goal    where the rear axle should end up, facing up the screen. The paver sits right behind that spot.
//   cones   x, y of each cone        crew  people standing still       walkers  people walking back and forth
//   mat     strips of fresh asphalt to keep the tires off: x, y, width, height
//   par     seconds a good driver takes (beating it is part of three stars)
import { clamp, rr, font, pill, banner } from './kit.js';

const LEVELS = [
  { start: [30, 24, -90], goal: [30, 60], par: 14, cones: [[22, 30], [38, 30], [22, 42], [38, 42], [22, 54], [38, 54]], crew: [], walkers: [], mat: [] },
  { start: [38, 22, -90], goal: [30, 60], par: 18, cones: [[22, 38], [22, 50], [38, 52], [48, 34]], crew: [], walkers: [], mat: [] },
  { start: [40, 22, 0], goal: [18, 62], par: 24, cones: [[30, 36], [28, 62], [8, 32]], crew: [[34, 68]], walkers: [], mat: [] },
  { start: [40, 22, -90], goal: [26, 62], par: 22, cones: [[50, 32], [32, 26], [34, 54], [34, 62], [16, 46], [16, 56]], crew: [], walkers: [], mat: [] },
  { start: [34, 22, -90], goal: [30, 62], par: 22, cones: [[20, 52], [40, 52]], crew: [[42, 64]], walkers: [{ a: [8, 42], b: [52, 42], speed: 5 }], mat: [] },
  { start: [32, 22, -90], goal: [22, 62], par: 20, cones: [[29, 52], [29, 60], [29, 68]], crew: [], walkers: [], mat: [[4, 34, 12, 56]] },
  { start: [25, 28, -125], goal: [30, 62], par: 26, cones: [[18, 46], [42, 46], [20, 60], [40, 60]], crew: [], walkers: [], mat: [] },
  { start: [40, 22, 0], goal: [20, 62], par: 28, cones: [[31, 36], [29, 62], [8, 34], [50, 40]], crew: [[9, 70]], walkers: [{ a: [6, 52], b: [36, 52], speed: 5 }], mat: [[38, 58, 18, 32]] },
];
const YARD_W = 60, YARD_H = 90;
const WB = 14, TAIL = 5, NOSE = 17, HALF = 4;     // the truck: wheelbase, rear overhang, nose length, half width (feet)
const MAX_STEER = 0.72, REV = 7, FWD = 9;

export function create(env) {
  const { ctx } = env;
  let L, n, tr, goal, cones, people, mats, t, time, coneHits, bumps, matHits, note, noteT, endT, failed, hold, beep, held, dust, parked;
  const pedals = [];
  const makePedal = (cls, html, key) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gk-pedal gk-pedal--sm ' + cls; b.innerHTML = html;
    const set = (on) => (e) => { e.preventDefault(); held[key] = on; b.classList.toggle('is-down', on); };
    b.addEventListener('pointerdown', set(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, set(false))); b.addEventListener('contextmenu', (e) => e.preventDefault());
    pedals.push(b); return b;
  };
  const say = (text, good = false, time2 = 2.2) => { note = { text, good }; noteT = time2; };

  function start(level) {
    n = level; L = LEVELS[n];
    tr = { x: L.start[0], y: L.start[1], th: (L.start[2] * Math.PI) / 180, v: 0, st: 0 };
    goal = { x: L.goal[0], y: L.goal[1], th: -Math.PI / 2 };
    cones = L.cones.map(([x, y]) => ({ x, y, hit: 0 }));
    people = [...L.crew.map(([x, y]) => ({ x, y, still: true })), ...L.walkers.map((w) => ({ a: w.a, b: w.b, speed: w.speed, k: 0.15, dir: 1, x: w.a[0], y: w.a[1] }))];
    // fresh mat behind the paver always counts, plus any strips the level adds
    mats = [{ x: goal.x - 6, y: goal.y + TAIL + 1.5 + 13, w: 12, h: 60, on: false }, ...L.mat.map(([x, y, w, h]) => ({ x, y, w, h, on: false }))];
    t = 0; time = 0; coneHits = 0; bumps = 0; matHits = 0; note = null; noteT = 0; endT = 0; failed = ''; hold = 0; beep = 0; held = {}; dust = []; parked = false;
    pedals.length = 0;
    env.stage.append(makePedal('gk-pedal--left', '◀<small>wheel left</small>', 'left'), makePedal('gk-pedal--left gk-pedal--l2', '▶<small>wheel right</small>', 'right'), makePedal('gk-pedal--right gk-pedal--r2', 'REV<small>back up</small>', 'rev'), makePedal('gk-pedal--right', 'FWD<small>pull up</small>', 'fwd'));
    say('Back up to the paver. Stop just short of it.', true, 3);
  }

  // ----- where things are -----
  const dir = (a) => [Math.cos(a), Math.sin(a)];
  // Is a point inside the truck's body? (pad makes the truck a little fatter, for round things)
  function inTruck(px, py, pad = 0, at = tr) { const [c, s] = dir(at.th), dx = px - at.x, dy = py - at.y, lx = dx * c + dy * s, ly = -dx * s + dy * c; const qx = clamp(lx, -TAIL, NOSE), qy = clamp(ly, -HALF, HALF); return Math.hypot(lx - qx, ly - qy) <= pad; }
  const corners = (at = tr) => { const [c, s] = dir(at.th); return [[-TAIL, -HALF], [-TAIL, HALF], [NOSE, -HALF], [NOSE, HALF]].map(([lx, ly]) => [at.x + lx * c - ly * s, at.y + lx * s + ly * c]); };
  const wheels = (at = tr) => { const [c, s] = dir(at.th); return [[-2.2, -3.2], [-2.2, 3.2], [2.2, -3.2], [2.2, 3.2], [WB, -3.2], [WB, 3.2]].map(([lx, ly]) => [at.x + lx * c - ly * s, at.y + lx * s + ly * c]); };
  // How the tailgate sits against the paver: feet short of the hopper, feet off to the side, and the angle.
  function lineup(at = tr) {
    const [c, s] = dir(at.th), tx = at.x - TAIL * c, ty = at.y - TAIL * s;      // middle of the tailgate
    const hx = goal.x, hy = goal.y + TAIL + 1.5;                                 // front lip of the hopper (the paver faces up the screen)
    let da = at.th - goal.th; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    return { short: hy - ty, side: tx - hx, angle: da };
  }
  const paverHit = (at = tr) => { const [c, s] = dir(at.th); return [[-TAIL, -HALF], [-TAIL, 0], [-TAIL, HALF], [3, -HALF], [3, HALF], [NOSE, -HALF], [NOSE, HALF]].some(([lx, ly]) => { const x = at.x + lx * c - ly * s, y = at.y + lx * s + ly * c; return Math.abs(x - goal.x) < 5 && y > goal.y + TAIL + 1.5 && y < goal.y + TAIL + 1.5 + 14; }); };

  function update(dt) {
    t += dt; noteT = Math.max(0, noteT - dt);
    for (const d of dust) d.age += dt; dust = dust.filter((d) => d.age < 0.7);
    for (const c of cones) if (c.hit) c.hit += dt;
    for (const p of people) if (!p.still) { const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]); p.k += (p.dir * p.speed * dt) / len; if (p.k > 1) { p.k = 1; p.dir = -1; } if (p.k < 0) { p.k = 0; p.dir = 1; } p.x = p.a[0] + (p.b[0] - p.a[0]) * p.k; p.y = p.a[1] + (p.b[1] - p.a[1]) * p.k; }
    if (endT > 0) { endT -= dt; tr.v *= 0.8; if (endT <= 0) done(); return; }
    time += dt;

    // the wheel stays where you leave it; it pauses a moment at straight so it is easy to find
    const k = env.keys, left = held.left || k.has('ArrowLeft') || k.has('a'), right = held.right || k.has('ArrowRight') || k.has('d');
    const rev = held.rev || k.has('ArrowDown') || k.has('s'), fwd = held.fwd || k.has('ArrowUp') || k.has('w');
    const turn = (right ? 1 : 0) - (left ? 1 : 0);
    if (turn) { const before = tr.st; tr.st = clamp(tr.st + turn * 1.5 * dt, -MAX_STEER, MAX_STEER); if (hold > 0) { hold -= dt; tr.st = 0; } else if (before !== 0 && Math.sign(before) !== Math.sign(tr.st)) { tr.st = 0; hold = 0.16; } } else hold = 0;
    const want = rev ? -REV : fwd ? FWD : 0;
    tr.v += clamp(want - tr.v, -dt * (want === 0 ? 16 : 10), dt * (want === 0 ? 16 : 10));

    // move, then check what the truck would be touching
    const next = { x: tr.x + Math.cos(tr.th) * tr.v * dt, y: tr.y + Math.sin(tr.th) * tr.v * dt, th: tr.th + (tr.v / WB) * Math.tan(tr.st) * dt };
    const outside = corners(next).some(([x, y]) => x < 0.5 || x > YARD_W - 0.5 || y < 0.5 || y > YARD_H - 0.5);
    if (outside) { tr.v = 0; }
    else if (paverHit(next)) { if (Math.abs(tr.v) > 0.6) { bumps++; env.sfx('thump'); env.buzz(120); say('Never bump the paver. Stop short and let it pick you up.', false, 2.8); } tr.v = 1.5; }
    else { tr.x = next.x; tr.y = next.y; tr.th = next.th; }
    for (const c of cones) if (!c.hit && inTruck(c.x, c.y, 0.9)) { c.hit = 0.01; c.vx = Math.cos(tr.th) * tr.v * 1.5 + (Math.random() - 0.5) * 8; c.vy = Math.sin(tr.th) * tr.v * 1.5 + (Math.random() - 0.5) * 8; coneHits++; env.sfx('hit'); env.buzz(70); say('Cone down. If it is tight, get out and look.', false, 2.2); }
    for (const m of mats) { const on = wheels().some(([x, y]) => x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h); if (on && !m.on) { matHits++; env.sfx('bad'); env.buzz(70); say('Tires on fresh mat. Those marks stay.', false, 2.4); } m.on = on; }
    for (const p of people) if (inTruck(p.x, p.y, 1.5) && Math.abs(tr.v) > 0.3) { failed = 'person'; endT = 1.0; env.sfx('hit'); env.buzz(250); say('STOP! Someone was behind the truck.', false, 3); return; }
    // backup alarm
    if (tr.v < -0.5) { beep -= dt; if (beep <= 0) { beep = 0.55; env.sfx('beep'); } if (Math.random() < dt * 10) dust.push({ x: tr.x, y: tr.y, age: 0 }); } else beep = 0;

    // parked right: tailgate lined up, just short of the hopper, stopped
    const a = lineup(); const lined = a.short >= 0.3 && a.short <= 4.5 && Math.abs(a.side) <= 1.7 && Math.abs(a.angle) <= 0.21;
    parked = lined;
    if (lined && Math.abs(tr.v) < 0.4 && !rev && !fwd) { endT = 0.9; env.sfx('good'); say('Whoa! Right there.', true, 2); }
  }
  const slips = () => coneHits + bumps + matHits;
  function done() {
    const stats = [['Time', Math.round(time) + ' sec'], ['Cones hit', String(coneHits)], ...(bumps ? [['Bumped paver', String(bumps)]] : []), ...(matHits ? [['On fresh mat', String(matHits)]] : [])];
    if (failed === 'person') return env.finish({ stars: 0, score: 0, headline: 'Someone was behind you', note: 'Never back up with a person behind the truck. Stop and wait until they are clear and they can see you.', stats });
    const stars = slips() === 0 && time <= L.par ? 3 : slips() <= 1 ? 2 : 1;
    const score = Math.max(100, Math.round(2000 - time * 25 - slips() * 300 + (stars === 3 ? 500 : 0)));
    env.finish({ stars, score, headline: 'Backed in', note: stars === 3 ? 'Clean, quick, and stopped short of the paver. That is a driver the crew wants.' : slips() ? 'In, but not clean. Slow down and use small steering moves.' : 'Clean, but slow. Beat ' + L.par + ' seconds for three stars.', stats });
  }

  // ----- drawing -----
  function draw() {
    const W = env.W, H = env.H, top = 100, bottom = H - 104, f = Math.min((W - 12) / YARD_W, (bottom - top) / YARD_H), x0 = (W - YARD_W * f) / 2, y0 = top + ((bottom - top) - YARD_H * f) / 2;
    const X = (x) => x0 + x * f, Y = (y) => y0 + y * f;
    ctx.fillStyle = '#4c7a45'; ctx.fillRect(0, 0, W, H);
    rr(ctx, X(0) - 4, Y(0) - 4, YARD_W * f + 8, YARD_H * f + 8, 8); ctx.fillStyle = '#8f8672'; ctx.fill();
    rr(ctx, X(0), Y(0), YARD_W * f, YARD_H * f, 5); ctx.fillStyle = '#a89f89'; ctx.fill();
    ctx.fillStyle = 'rgba(60,54,44,0.2)'; for (let i = 0; i < 120; i++) { const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; ctx.fillRect(X(h * YARD_W), Y(((h * 37.7) % 1) * YARD_H), 2, 2); }
    // fresh mat
    for (const m of mats) { const y1 = Math.min(YARD_H, m.y + m.h); ctx.fillStyle = '#1a1c20'; ctx.fillRect(X(m.x), Y(m.y), m.w * f, (y1 - m.y) * f); ctx.fillStyle = 'rgba(255,255,255,0.03)'; for (let yy = m.y + 2; yy < y1; yy += 4) ctx.fillRect(X(m.x), Y(yy), m.w * f, 1); ctx.strokeStyle = m.on ? '#ff5a4d' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = m.on ? 3 : 1; ctx.strokeRect(X(m.x), Y(m.y), m.w * f, (y1 - m.y) * f); }
    // where the tailgate should stop
    const zy = goal.y + TAIL + 1.5; ctx.setLineDash([7, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = parked ? '#34d399' : '#2cc4c8'; ctx.fillStyle = parked ? 'rgba(52,211,153,0.25)' : 'rgba(44,196,200,0.12)';
    ctx.fillRect(X(goal.x - HALF - 1), Y(zy - 4.5), (HALF * 2 + 2) * f, 4.2 * f); ctx.strokeRect(X(goal.x - HALF - 1), Y(zy - 4.5), (HALF * 2 + 2) * f, 4.2 * f); ctx.setLineDash([]);
    for (const d of dust) { ctx.globalAlpha = 0.35 * (1 - d.age / 0.7); ctx.beginPath(); ctx.arc(X(d.x), Y(d.y), (1.5 + d.age * 4) * f, 0, 7); ctx.fillStyle = '#e6dcc8'; ctx.fill(); } ctx.globalAlpha = 1;
    paver(X(goal.x), Y(zy), f);
    for (const c of cones) { const k = c.hit ? Math.min(1, c.hit * 2) : 0, x = X(c.x + (c.vx || 0) * k * 0.3), y = Y(c.y + (c.vy || 0) * k * 0.3); ctx.globalAlpha = c.hit ? 0.75 : 1; ctx.fillStyle = '#1d232d'; ctx.fillRect(x - 1.1 * f, y - 1.1 * f, 2.2 * f, 2.2 * f); if (c.hit) { ctx.save(); ctx.translate(x, y); ctx.rotate(1 + c.vx); ctx.fillStyle = '#f47a20'; ctx.fillRect(-0.6 * f, -1.6 * f, 1.2 * f, 3.2 * f); ctx.fillStyle = '#f3f5f8'; ctx.fillRect(-0.6 * f, -0.4 * f, 1.2 * f, 0.8 * f); ctx.restore(); } else { ctx.beginPath(); ctx.arc(x, y, 0.85 * f, 0, 7); ctx.fillStyle = '#f47a20'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 0.38 * f, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill(); } ctx.globalAlpha = 1; }
    for (const p of people) person(X(p.x), Y(p.y), f, inTruck(p.x, p.y, 9));
    truck(X(tr.x), Y(tr.y), f);
    // the spotter beside the hopper, calling the distance
    const a = lineup(), sx = X(goal.x + 8.5), sy = Y(zy - 1);
    person(sx, sy, f, false, true);
    const call = failed ? 'STOP!' : parked ? 'WHOA!' : a.short < 0.3 ? 'TOO FAR' : a.short > 40 ? 'COME BACK' : Math.round(a.short) + ' FT';
    ctx.font = font(12, 900); const bw = ctx.measureText(call).width + 16, bx = Math.min(W - bw - 6, sx + 10), by = sy - 30;
    rr(ctx, bx, by, bw, 22, 7); ctx.fillStyle = parked ? '#34d399' : '#0b1220'; ctx.fill(); ctx.fillStyle = parked ? '#0b1220' : '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(call, bx + 8, by + 12);
    hud(W, a);
  }
  function person(x, y, f, close, spotter) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 1.6 * f, 1.3 * f, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 1.5 * f, 0, 7); ctx.fillStyle = spotter ? '#f47a20' : '#c8f03c'; ctx.fill(); ctx.strokeStyle = spotter ? '#c8f03c' : '#f47a20'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 0.8 * f, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();
    if (close) { ctx.strokeStyle = 'rgba(255,90,77,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(x, y, 3.2 * f, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }
  // The paver from above, facing up the screen. (x, y) is the middle of the front lip of its hopper.
  function paver(x, y, f) {
    ctx.save(); ctx.translate(x, y);
    const box = (bx, by, w, h, r, fill) => { rr(ctx, bx * f, by * f, w * f, h * f, r * f); ctx.fillStyle = fill; ctx.fill(); };
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, -4.6 * f, 0.3 * f, 9.8 * f, 13.6 * f, 0.6 * f); ctx.fill();
    box(-3.4, -0.45, 6.8, 0.45, 0.2, '#14171c');
    ctx.beginPath(); ctx.moveTo(-4.7 * f, 0); ctx.lineTo(4.7 * f, 0); ctx.lineTo(4.3 * f, 4.8 * f); ctx.lineTo(-4.3 * f, 4.8 * f); ctx.closePath(); ctx.fillStyle = '#2f353f'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4.05 * f, 0.4 * f); ctx.lineTo(4.05 * f, 0.4 * f); ctx.lineTo(3.7 * f, 4.5 * f); ctx.lineTo(-3.7 * f, 4.5 * f); ctx.closePath(); ctx.fillStyle = '#4a515d'; ctx.fill();
    ctx.fillStyle = 'rgba(11,18,32,0.4)'; for (let yy = 0.8; yy < 4.4; yy += 0.6) ctx.fillRect(-1.4 * f, yy * f, 2.8 * f, 0.18 * f);
    box(-4.2, 4.6, 1.1, 7.2, 0.3, '#14171c'); box(3.1, 4.6, 1.1, 7.2, 0.3, '#14171c');
    const g = ctx.createLinearGradient(-3.2 * f, 0, 3.2 * f, 0); g.addColorStop(0, '#e2940f'); g.addColorStop(0.5, '#f7b12c'); g.addColorStop(1, '#dc8d0c');
    rr(ctx, -3.2 * f, 4.8 * f, 6.4 * f, 6.2 * f, 0.4 * f); ctx.fillStyle = g; ctx.fill();
    box(-2.5, 5.2, 5.0, 2.0, 0.25, '#c97f0a'); box(-2.7, 7.6, 5.4, 3.0, 0.25, '#2a2f37');
    ctx.beginPath(); ctx.arc(-0.85 * f, 9.1 * f, 0.62 * f, 0, 7); ctx.fillStyle = '#c8f03c'; ctx.fill(); ctx.beginPath(); ctx.arc(-0.85 * f, 9.1 * f, 0.38 * f, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();
    box(-6, 11.2, 12, 1.6, 0.15, '#3a414c'); box(-6.25, 10.9, 0.5, 2.1, 0.1, '#f2a516'); box(5.75, 10.9, 0.5, 2.1, 0.1, '#f2a516');
    ctx.restore();
  }
  // The dump truck from above. (x, y) is the middle of its rear axles.
  function truck(x, y, f) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tr.th);
    const box = (bx, by, w, h, r, fill) => { rr(ctx, bx * f, by * f, w * f, h * f, r * f); ctx.fillStyle = fill; ctx.fill(); };
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, (-TAIL + 0.4) * f, (-HALF + 0.6) * f, (TAIL + NOSE) * f, HALF * 2 * f, 0.6 * f); ctx.fill();
    for (const ax of [-2.2, 2.2]) { box(ax - 1.6, -4.2, 3.2, 1.1, 0.3, '#14171c'); box(ax - 1.6, 3.1, 3.2, 1.1, 0.3, '#14171c'); }
    for (const side of [-1, 1]) { ctx.save(); ctx.translate(WB * f, side * 3.5 * f); ctx.rotate(tr.st); rr(ctx, -1.5 * f, -0.5 * f, 3 * f, 1 * f, 0.3 * f); ctx.fillStyle = '#14171c'; ctx.fill(); ctx.restore(); }
    box(-TAIL + 0.3, -3.8, 14.6, 7.6, 0.35, '#23272e'); box(-TAIL + 0.8, -3.3, 13.6, 6.6, 0.25, '#14161a');
    ctx.beginPath(); ctx.ellipse(2.6 * f, 0, 6.3 * f, 2.9 * f, 0, 0, 7); ctx.fillStyle = '#0d0e10'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2; ctx.stroke();
    box(-TAIL + 0.3, -3.8, 0.9, 7.6, 0.2, '#2d323a'); box(-TAIL + 2.2, -3.8, 0.4, 7.6, 0.1, '#0ea5a9');
    box(10.6, -3.6, 6.2, 7.2, 0.7, '#eef1f5'); box(11.0, -3.1, 2.9, 6.2, 0.4, '#dfe5ec'); box(13.9, -3.0, 1.3, 6.0, 0.3, '#1c2942');
    box(14.3, -4.5, 0.5, 0.9, 0.1, '#23272e'); box(14.3, 3.6, 0.5, 0.9, 0.1, '#23272e');
    const lit = tr.v < -0.3 ? '#fff' : '#a3231c'; ctx.fillStyle = lit; ctx.fillRect((-TAIL + 0.1) * f, -3.4 * f, 0.4 * f, 1.0 * f); ctx.fillRect((-TAIL + 0.1) * f, 2.4 * f, 0.4 * f, 1.0 * f);
    ctx.restore();
  }
  function hud(W, a) {
    const pad = 10, gapW = 8, w = (W - pad * 2 - gapW * 2) / 3, y = 10, late = time > L.par;
    pill(ctx, pad, y, w, 'Time (par ' + L.par + ')', Math.floor(time) + 's', { color: late ? '#f5c542' : '#7ef0c2' });
    pill(ctx, pad + w + gapW, y, w, 'Hits', String(slips()), { color: slips() ? '#ff7a6e' : '#7ef0c2' });
    pill(ctx, pad + (w + gapW) * 2, y, w, 'Wheel', '', {});
    // steering gauge: a dot that slides left and right of center
    const gx = pad + (w + gapW) * 2 + 10, gw = w - 20, gy = y + 29; rr(ctx, gx, gy - 3, gw, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(gx + gw / 2 - 1, gy - 6, 2, 12);
    ctx.beginPath(); ctx.arc(gx + gw / 2 + (tr.st / MAX_STEER) * (gw / 2 - 6), gy, 6, 0, 7); ctx.fillStyle = Math.abs(tr.st) < 0.02 ? '#34d399' : '#f5c542'; ctx.fill();
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, y + 52, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
  }
  return { start, update, draw, destroy() { pedals.forEach((b) => b.remove()); }, peek: () => ({ L, tr, goal, people, lineup: lineup(), parked, time, slips: slips(), inTruck }), poke: (h) => { held = h; } };
}
