// POTHOLE PATROL: patch potholes in a parking lot before the next car hits them.
// Seen from above. A pothole opens up and a car is on its way. Tap the tools in the right order
// (cut, clean, tack, fill, pack) to fix the hole before the car gets there.
//
// The numbers that set how hard a level is are in LEVELS below:
//   steps   which steps the level uses, in order      holes  how many potholes to fix
//   every   seconds between new potholes              fuse   seconds until a car reaches a new pothole
//   shuffle true = the tools trade places on the tool bar for every pothole
//   hints   how many potholes get the right tool lit up, to teach the order
import { clamp, rr, rng, font, pill, bar, banner } from './kit.js';

const ALL = ['cut', 'clean', 'tack', 'fill', 'pack'];
const LEVELS = [
  { steps: ['clean', 'fill', 'pack'], holes: 6, every: 6.0, fuse: 11, hints: 2 },
  { steps: ['clean', 'fill', 'pack'], holes: 9, every: 4.2, fuse: 8.5, hints: 0 },
  { steps: ['clean', 'tack', 'fill', 'pack'], holes: 9, every: 4.8, fuse: 9.5, hints: 2 },
  { steps: ALL, holes: 9, every: 5.2, fuse: 10, hints: 2 },
  { steps: ALL, holes: 12, every: 4.2, fuse: 8.5, hints: 0 },
  { steps: ALL, holes: 12, every: 4.4, fuse: 8.5, hints: 0, shuffle: true },
  { steps: ALL, holes: 14, every: 3.6, fuse: 7.5, hints: 0 },
  { steps: ALL, holes: 16, every: 3.3, fuse: 7, hints: 0, shuffle: true },
];
const TOOL = {
  cut: { name: 'CUT', why: 'Cut the edges square first.', icon: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' },
  clean: { name: 'CLEAN', why: 'Clean the hole out before anything goes in.', icon: '<path d="M5 19l5-9m0 0l4 2-5 9m1-11l5-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
  tack: { name: 'TACK', why: 'Spray the tack coat so the patch sticks.', icon: '<path d="M8 21V10h6v11M10 10V6h2v4M14 12l5-3M14 14l5 0M14 16l5 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
  fill: { name: 'FILL', why: 'Fill the hole with hot mix.', icon: '<path d="M4 18c3-7 13-7 16 0z" fill="currentColor"/><path d="M12 4v6m-3-3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
  pack: { name: 'PACK', why: 'Pack it down last.', icon: '<path d="M5 19h14v-4H5zM9 15V8h6M15 8l3-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
};
const CAR_COLORS = ['#c9d2dc', '#8b1e24', '#2c4a7c', '#d8d2c2', '#5d6b4a', '#b7791f'];

export function create(env) {
  const { ctx } = env;
  let L, n, rand, holes, cars, made, fixed, strikes, slips, points, streak, t, note, noteT, nextHole, active, lock, fx, endT, hintsLeft, order, barEl, geo;

  const say = (text, good = false, time = 2) => { note = { text, good }; noteT = time; };
  const layout = () => { const top = 104, bottom = env.H - 104, lanes = [0.2, 0.5, 0.8].map((f) => top + (bottom - top) * f); return { top, bottom, lanes }; };

  function drawBar() {
    barEl.innerHTML = order.map((k, i) => `<button type="button" class="pp-tool" data-tool="${k}"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${TOOL[k].icon}</svg><b>${TOOL[k].name}</b><small>${i + 1}</small></button>`).join('');
    lightHint();
  }
  function lightHint() {
    const next = active && hintsLeft > 0 ? L.steps[active.step] : null;
    barEl.querySelectorAll('.pp-tool').forEach((b) => b.classList.toggle('is-hint', b.dataset.tool === next));
  }
  function choose(h) {
    if (active === h) return; active = h;
    if (L.shuffle && h) { order = L.steps.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } drawBar(); }
    lightHint();
  }
  // The pothole that needs it most: the open one whose car gets there soonest.
  const neediest = () => holes.filter((h) => !h.done).sort((a, b) => a.due - b.due)[0] || null;

  function use(tool) {
    if (lock > 0 || endT > 0 || !active) return;
    const want = L.steps[active.step];
    if (tool !== want) {
      slips++; streak = 0; lock = 0.55; env.sfx('bad'); env.buzz(70); say(TOOL[want].why, false, 2.2);
      barEl.classList.add('is-wrong'); setTimeout(() => barEl.classList.remove('is-wrong'), 350);
      return;
    }
    active.step++; active.anim = 0.3; fx.push({ x: active.x, y: active.y, kind: tool, age: 0 });
    env.sfx(tool === 'pack' ? 'thump' : tool === 'cut' ? 'beep' : tool === 'fill' ? 'scoop' : 'pour'); env.buzz(tool === 'pack' ? 40 : 12);
    if (active.step >= L.steps.length) {
      active.done = true; fixed++; streak++; if (hintsLeft > 0) hintsLeft--;
      const spare = Math.max(0, active.due - t), pts = 100 + Math.round(spare * 10) + Math.min(5, streak - 1) * 20;
      points += pts; env.pop(active.x, active.y - 26, streak > 1 ? `+${pts}  ${streak} in a row` : '+' + pts, '#7ef0c2'); env.sfx('good');
      choose(neediest());
      if (fixed >= L.holes) { endT = 1.1; }
    } else lightHint();
  }

  function start(level) {
    n = level; L = LEVELS[n]; rand = rng(700 + n * 13);
    holes = []; cars = []; made = 0; fixed = 0; strikes = 0; slips = 0; points = 0; streak = 0; t = 0; note = null; noteT = 0; nextHole = 0.6; active = null; lock = 0; fx = []; endT = 0; hintsLeft = L.hints; order = L.steps.slice();
    barEl = document.createElement('div'); barEl.className = 'pp-tools'; env.stage.appendChild(barEl); drawBar();
    barEl.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-tool]'); if (b) { e.preventDefault(); use(b.dataset.tool); } });
    env.onSwipe = (d, x, y) => { if (d !== 'tap') return; const h = holes.filter((q) => !q.done).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; if (h && Math.hypot(h.x - x, h.y - y) < 70) { choose(h); env.sfx('click'); } };
    env.onKey = (k) => { const i = '12345'.indexOf(k); if (i >= 0 && order[i]) use(order[i]); };
    say('Tap the tools in the right order', true, 2.6);
  }

  function addHole() {
    const g = layout(), W = env.W;
    for (let tries = 0; tries < 30; tries++) {
      const lane = Math.floor(rand() * 3), x = W * (0.16 + rand() * 0.68), y = g.lanes[lane];
      if (holes.some((h) => !h.done && h.lane === lane && Math.abs(h.x - x) < 110)) continue;
      // a new hole right on top of an old patch replaces it
      holes = holes.filter((h) => !(h.done && h.lane === lane && Math.abs(h.x - x) < 64));
      const h = { x, y, lane, step: 0, done: false, due: t + L.fuse, seed: rand() * 100, anim: 0 };
      holes.push(h); made++; sendCar(h, L.fuse); env.sfx('tick');
      if (!active) choose(h);
      return;
    }
  }
  // A car heads for a pothole and gets there in `secs` seconds.
  function sendCar(h, secs) {
    const fromLeft = rand() < 0.5, W = env.W, startX = fromLeft ? -50 : W + 50, show = Math.min(secs, 4.2);
    cars.push({ h, x: startX, y: h.y, dir: fromLeft ? 1 : -1, v: Math.abs(h.x - startX) / show, wait: secs - show, color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], jolt: 0 });
  }

  function update(dt) {
    t += dt; noteT = Math.max(0, noteT - dt); lock = Math.max(0, lock - dt);
    for (const f of fx) f.age += dt; fx = fx.filter((f) => f.age < 0.5);
    for (const h of holes) h.anim = Math.max(0, h.anim - dt);
    if (endT > 0) { endT -= dt; if (endT <= 0) done(); }
    else {
      nextHole -= dt;
      if (made < L.holes && nextHole <= 0 && holes.filter((h) => !h.done).length < 3) { addHole(); nextHole = L.every * (0.8 + rand() * 0.4); }
    }
    for (const c of cars) {
      if (c.wait > 0) { c.wait -= dt; continue; }
      const before = c.x; c.x += c.dir * c.v * dt; c.jolt = Math.max(0, c.jolt - dt);
      if (!c.passed && (c.h.x - before) * (c.h.x - c.x) <= 0) {
        c.passed = true;
        if (c.h.done) { points += 25; env.pop(c.h.x, c.h.y - 30, 'Smooth +25', '#fff'); }
        else if (endT <= 0) {
          strikes++; streak = 0; c.jolt = 0.4; env.sfx('thump'); env.sfx('horn'); env.buzz(120); say('A car hit the open pothole.', false, 2.2);
          c.h.due = t + L.fuse * 0.9; sendCar(c.h, L.fuse * 0.9);
          if (strikes >= 3) endT = 1.0;
        }
      }
    }
    cars = cars.filter((c) => c.x > -80 && c.x < env.W + 80);
    if (!active || active.done) choose(neediest());
  }
  function done() {
    const stats = [['Patched', `${fixed} of ${L.holes}`], ['Cars hit a hole', String(strikes)], ['Wrong tool', String(slips)]];
    if (strikes >= 3) return env.finish({ stars: 0, score: points, headline: 'Three cars hit potholes', note: 'Work the hole with a car coming first, and learn the order so every tap counts: ' + L.steps.map((s) => TOOL[s].name.toLowerCase()).join(', ') + '.', stats });
    const stars = strikes === 0 && slips <= 1 ? 3 : strikes <= 1 ? 2 : 1;
    env.finish({ stars, score: points + (3 - strikes) * 200, headline: 'Lot is patched', note: stars === 3 ? 'Every hole fixed right and nobody lost a hubcap.' : strikes ? 'Patched, but a car got to a hole first. Fix the one with traffic coming.' : 'Patched. Know the order cold: ' + L.steps.map((s) => TOOL[s].name.toLowerCase()).join(', ') + '.', stats });
  }

  // ----- drawing -----
  function draw() {
    const W = env.W, H = env.H, g = layout(); geo = g;
    // the lot: old grey asphalt, stall lines top and bottom, three drive lanes
    ctx.fillStyle = '#5a6068'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.035)'; for (let i = 0; i < 90; i++) { const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; ctx.fillRect(h * W, ((h * 31.7) % 1) * H, 3, 3); }
    ctx.strokeStyle = 'rgba(30,34,40,0.28)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { const h = Math.abs(Math.sin(i * 77.7) * 43758.5453) % 1; ctx.beginPath(); ctx.moveTo(h * W, g.top + ((h * 3.3) % 1) * (g.bottom - g.top)); ctx.lineTo(h * W + 40 - ((h * 9) % 1) * 80, g.top + ((h * 3.3) % 1) * (g.bottom - g.top) + 34); ctx.lineTo(h * W + 10, g.top + ((h * 3.3) % 1) * (g.bottom - g.top) + 70); ctx.stroke(); }
    ctx.fillStyle = 'rgba(240,243,247,0.55)';
    const mid = [(g.lanes[0] + g.lanes[1]) / 2, (g.lanes[1] + g.lanes[2]) / 2];
    for (const y of mid) { for (let x = 14; x < W; x += 46) ctx.fillRect(x, y - 20, 3, 40); ctx.fillRect(0, y - 1.5, W, 3); }
    ctx.fillStyle = 'rgba(233,185,58,0.5)'; for (const y of g.lanes) for (let x = 6; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 10, y - 34); ctx.lineTo(x + 5, y - 28); ctx.closePath(); ctx.fill(); }
    for (const h of holes) hole(h);
    for (const f of fx) effect(f);
    // the ring around the pothole being worked on, and its steps
    if (active && !active.done) {
      const r = 34 + Math.sin(t * 6) * 3; ctx.strokeStyle = '#2cc4c8'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(active.x, active.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const k = L.steps.length; for (let i = 0; i < k; i++) { ctx.beginPath(); ctx.arc(active.x + (i - (k - 1) / 2) * 12, active.y - 46, 4, 0, 7); ctx.fillStyle = i < active.step ? '#34d399' : 'rgba(255,255,255,0.4)'; ctx.fill(); }
    }
    for (const c of cars) if (c.wait <= 0) car(c);
    // warning on the edge of the screen where a car is about to come in
    for (const c of cars) if (c.wait > 0 && c.wait < 1.6 && !c.h.done) { const x = c.dir > 0 ? 16 : W - 16; ctx.globalAlpha = 0.5 + Math.sin(t * 12) * 0.4; ctx.beginPath(); ctx.arc(x, c.y, 12, 0, 7); ctx.fillStyle = '#f5c542'; ctx.fill(); ctx.fillStyle = '#0b1220'; ctx.font = font(16, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, c.y + 1); ctx.globalAlpha = 1; }
    hud(W);
  }
  function hole(h) {
    const s = h.done ? L.steps.length : h.step, has = (k) => L.steps.indexOf(k) > -1 && L.steps.indexOf(k) < s, squared = has('cut') || (h.done && L.steps[0] !== 'cut'), R = 22;
    ctx.save(); ctx.translate(h.x, h.y + (h.anim > 0 && L.steps[s - 1] === 'pack' ? Math.sin(h.anim * 60) * 2 : 0));
    const blob = (r, fill) => { ctx.beginPath(); for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2, k = 0.78 + (Math.abs(Math.sin((h.seed + i) * 12.9898) * 43758.5453) % 1) * 0.4; ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k * 0.82); } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    const square = (r, fill) => { rr(ctx, -r, -r * 0.84, r * 2, r * 1.68, 2); ctx.fillStyle = fill; ctx.fill(); };
    const shape = squared ? square : blob;
    if (h.done) { square(R + 2, '#1b1d21'); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.strokeRect(-R - 2, -(R + 2) * 0.84, (R + 2) * 2, (R + 2) * 1.68); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(-R, -R * 0.5, R * 2, 4); }
    else {
      if (!squared) blob(R + 6, 'rgba(40,44,50,0.55)');                                   // crumbling edge
      else { ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 2; ctx.strokeRect(-R - 3, -(R + 3) * 0.84, (R + 3) * 2, (R + 3) * 1.68); }   // saw cut
      shape(R, has('clean') ? '#4a3f33' : '#2b2622');
      if (!has('clean')) { ctx.fillStyle = '#8a8272'; for (let i = 0; i < 9; i++) { const a = (h.seed + i) * 2.4, r = (i % 4) * 4 + 3; ctx.fillRect(Math.cos(a) * r - 2, Math.sin(a) * r * 0.8 - 2, 4, 4); } ctx.fillStyle = 'rgba(70,110,150,0.4)'; ctx.beginPath(); ctx.ellipse(-4, 4, 9, 5, 0, 0, 7); ctx.fill(); }
      if (has('tack')) { shape(R - 1, '#0c0d0f'); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.ellipse(-6, -5, 8, 3, -0.4, 0, 7); ctx.fill(); }
      if (has('fill')) { shape(R + 1, '#17181b'); ctx.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 12; i++) { const a = (h.seed + i) * 1.9, r = (i % 5) * 4; ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r * 0.8, 2.5, 2.5); } ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.7, R * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    }
    ctx.restore();
  }
  function effect(f) {
    const k = f.age / 0.5; ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = 1 - k;
    if (f.kind === 'cut') { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * 0.8 + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * (30 + k * 26), Math.sin(a) * (26 + k * 22)); ctx.stroke(); } }
    else if (f.kind === 'clean') { ctx.fillStyle = '#b9ae98'; for (let i = 0; i < 9; i++) { const a = i * 0.7; ctx.beginPath(); ctx.arc(Math.cos(a) * (14 + k * 40), Math.sin(a) * (12 + k * 30), 7 * (1 - k) + 3, 0, 7); ctx.fill(); } }
    else if (f.kind === 'tack') { ctx.fillStyle = '#0c0d0f'; for (let i = 0; i < 12; i++) { const a = i * 0.52; ctx.beginPath(); ctx.arc(Math.cos(a) * (10 + k * 22), Math.sin(a) * (8 + k * 18), 3, 0, 7); ctx.fill(); } }
    else if (f.kind === 'fill') { ctx.fillStyle = '#17181b'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(Math.sin(i * 5.1) * 16, -40 * (1 - k) + (i % 3) * 5, 4, 0, 7); ctx.fill(); } }
    else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 26 + k * 26, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  function car(c) {
    const w = 74, hgt = 36; ctx.save(); ctx.translate(c.x, c.y + (c.jolt > 0 ? Math.sin(c.jolt * 50) * 5 : 0)); if (c.dir < 0) ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, -w / 2 + 3, -hgt / 2 + 4, w, hgt, 9); ctx.fill();
    rr(ctx, -w / 2, -hgt / 2, w, hgt, 9); ctx.fillStyle = c.color; ctx.fill();
    ctx.fillStyle = 'rgba(18,27,46,0.85)'; rr(ctx, 4, -hgt / 2 + 4, 15, hgt - 8, 4); ctx.fill(); rr(ctx, -w / 2 + 9, -hgt / 2 + 5, 10, hgt - 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-14, -hgt / 2 + 4, 16, hgt - 8);
    ctx.fillStyle = '#fff4c2'; ctx.fillRect(w / 2 - 4, -hgt / 2 + 3, 3, 7); ctx.fillRect(w / 2 - 4, hgt / 2 - 10, 3, 7);
    ctx.fillStyle = '#c62828'; ctx.fillRect(-w / 2 + 1, -hgt / 2 + 3, 3, 7); ctx.fillRect(-w / 2 + 1, hgt / 2 - 10, 3, 7);
    ctx.restore();
  }
  function hud(W) {
    const pad = 10, gapW = 8, w = (W - pad * 2 - gapW * 2) / 3, y = 10;
    pill(ctx, pad, y, w, 'Patched', `${fixed} / ${L.holes}`);
    pill(ctx, pad + w + gapW, y, w, 'Score', points.toLocaleString('en-US'));
    pill(ctx, pad + (w + gapW) * 2, y, w, 'Strikes', '', {});
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(pad + (w + gapW) * 2 + 18 + i * 22, y + 29, 7, 0, 7); ctx.fillStyle = i < strikes ? '#ff5a4d' : 'rgba(255,255,255,0.18)'; ctx.fill(); }
    bar(ctx, pad, y + 52, W - pad * 2, 6, fixed / L.holes, '#0ea5a9');
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, y + 64, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
  }
  return { start, update, draw, destroy() { if (barEl) barEl.remove(); }, peek: () => ({ L, active, holes, strikes, fixed, lock }), poke: use };
}
