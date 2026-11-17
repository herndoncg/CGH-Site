// HOT ROLL: compact the mat before it cools.
// Seen from straight above. The roller drives itself up and down one lane of fresh mat. Tap left or
// right to move over a lane, but only at the ends, off the hot mat. Every square needs a set number
// of passes while it is still hot.
//
// The numbers that set how hard a level is are in LEVELS below:
//   lanes, rows   size of the mat          need   passes every square needs
//   speed         squares per second       slack  how much spare time there is (1 = none at all)
//   edge          how much faster the two outside lanes cool (1 = same as the middle)
import { clamp, rr, font, pill, banner } from './kit.js';

const LEVELS = [
  { lanes: 3, rows: 9, need: 2, speed: 4, slack: 2.0, edge: 1 },
  { lanes: 3, rows: 10, need: 2, speed: 4.2, slack: 1.8, edge: 1 },
  { lanes: 4, rows: 10, need: 3, speed: 4.5, slack: 1.65, edge: 1 },
  { lanes: 4, rows: 11, need: 2, speed: 4.5, slack: 1.8, edge: 1.9 },
  { lanes: 5, rows: 11, need: 2, speed: 5, slack: 1.6, edge: 1.3 },
  { lanes: 5, rows: 12, need: 3, speed: 5, slack: 1.55, edge: 1.7 },
  { lanes: 6, rows: 12, need: 2, speed: 5.5, slack: 1.45, edge: 1.3 },
  { lanes: 6, rows: 13, need: 3, speed: 6, slack: 1.45, edge: 1.6 },
];
const HOT = 290, COLD = 175;   // the mat starts at 290 degrees; under 175, rolling does nothing
const END = 1.4;               // how far past each end of the mat the roller runs (in squares)
const TURN = 0.4;              // seconds it sits at the end before coming back

export function create(env) {
  const { ctx } = env;
  let L, n, cells, temps, rates, lane, laneX, y, dir, wait, marks, t, note, noteT, queued, lastRow, shown, endT;

  const say = (text, good = false, time = 2) => { note = { text, good }; noteT = time; };
  const onMat = () => y > 0 && y < L.rows;
  function shift(d) {
    const next = clamp(lane + d, 0, L.lanes - 1); if (next === lane) return;
    if (onMat()) {
      // close to the end: wait and move over once the roller is off the mat
      const toEnd = dir > 0 ? L.rows - y : y;
      if (toEnd < 0.9) { queued = d; return; }
      // turned on hot mat: the square under the roller is scuffed and has to be rolled again
      const r = clamp(Math.floor(y), 0, L.rows - 1), c = cells[lane][r];
      if (temps[lane] > COLD) { c.passes = 0; c.scuff = true; marks++; env.sfx('bad'); env.buzz(90); say('Turned on hot mat. That leaves a mark.', false, 2.2); }
    } else env.sfx('move');
    lane = next;
  }

  function start(level) {
    n = level; L = LEVELS[n];
    cells = Array.from({ length: L.lanes }, () => Array.from({ length: L.rows }, () => ({ passes: 0, scuff: false })));
    // Heat is lost by the second. A roller that never wastes a trip needs `best` seconds; the middle
    // lanes stay hot for `slack` times that long, and the outside lanes cool faster.
    const best = (L.lanes * L.need * (L.rows + END * 2)) / L.speed + L.lanes * L.need * TURN;
    const base = (HOT - COLD) / (best * L.slack);
    rates = Array.from({ length: L.lanes }, (_, i) => base * (i === 0 || i === L.lanes - 1 ? L.edge : 1));
    temps = rates.map(() => HOT);
    lane = Math.floor(L.lanes / 2); laneX = lane; y = -END; dir = 1; wait = 0.8; marks = 0; t = 0; note = null; noteT = 0; queued = 0; lastRow = -1; shown = 0; endT = 0;
    env.onSwipe = (d, x) => { if (d === 'left') shift(-1); else if (d === 'right') shift(1); else if (d === 'tap') shift(x < env.W / 2 ? -1 : 1); };
    env.onKey = (k) => { if (k === 'ArrowLeft' || k === 'a') shift(-1); if (k === 'ArrowRight' || k === 'd') shift(1); };
    say(L.edge > 1 ? 'The outside lanes cool first. Roll them first.' : 'Tap left or right to move over. Only at the ends!', true, 3);
  }

  const packed = () => { let done = 0; for (const col of cells) for (const c of col) if (c.passes >= L.need) done++; return done / (L.lanes * L.rows); };
  function update(dt) {
    t += dt; noteT = Math.max(0, noteT - dt);
    if (endT > 0) { endT -= dt; if (endT <= 0) done(); return; }
    for (let i = 0; i < L.lanes; i++) temps[i] = Math.max(120, temps[i] - rates[i] * dt);
    laneX += clamp(lane - laneX, -dt * 9, dt * 9);
    if (wait > 0) { wait -= dt; }
    else {
      y += dir * L.speed * dt;
      if (y >= L.rows + END) { y = L.rows + END; dir = -1; wait = TURN; lastRow = -1; }
      if (y <= -END) { y = -END; dir = 1; wait = TURN; lastRow = -1; }
    }
    if (!onMat() && queued) { const d = queued; queued = 0; shift(d); }
    // the drum counts a pass on each square as its middle goes under
    const r = Math.floor(y);
    if (onMat() && r !== lastRow && Math.abs(lane - laneX) < 0.3) {
      lastRow = r; const c = cells[lane][r];
      if (temps[lane] > COLD) { if (c.passes < L.need) { c.passes++; if (c.passes >= L.need) env.sfx('tick'); } }
      else if (c.passes < L.need && shown < t - 3) { shown = t; say('Too cold. Rolling it now does nothing.', false, 2); }
    }
    // over when every square is either packed or too cold to pack
    let open = 0; for (let i = 0; i < L.lanes; i++) for (const c of cells[i]) if (c.passes < L.need && temps[i] > COLD) open++;
    if (!open) { endT = 0.7; env.sfx(packed() >= 0.9 ? 'good' : 'bad'); }
  }
  const score = () => Math.max(0, Math.round(packed() * 3000 - marks * 150 + Math.max(0, Math.min(...temps) - COLD) * 6));
  function done() {
    const p = packed(), pctNow = Math.round(p * 100);
    let stars = p >= 0.75 ? 1 : 0; if (p >= 0.9 && marks <= 2) stars = 2; if (p >= 0.999 && marks === 0) stars = 3;
    const noteText = !stars ? 'Too much of the mat cooled off before it was packed. Pick a pattern and do not waste a trip.' : stars === 3 ? 'Every square packed hot and not one mark. Smooth.' : marks ? 'Move over at the ends, off the mat. Marks on hot mat never roll out.' : 'Some of it cooled before you got there. Edges cool first, so start with them.';
    env.finish({ stars, score: score(), headline: stars ? 'Mat is packed' : 'The mat got cold', note: noteText, stats: [['Packed', pctNow + '%'], ['Turn marks', String(marks)]] });
  }

  // ----- drawing -----
  function draw() {
    const W = env.W, H = env.H, top = 122, bottom = 18;
    const ch = Math.min(64, (H - top - bottom) / (L.rows + END * 2 + 0.5)), cw = Math.min(78, (W - 36) / L.lanes, ch * 1.75);
    const x0 = (W - cw * L.lanes) / 2, y0 = top + (END + 0.25) * ch, matH = ch * L.rows;
    const Y = (r) => y0 + r * ch;
    // ground: grass, then rock base under and past both ends of the mat
    ctx.fillStyle = '#4c7a45'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 30; i++) { const h = Math.abs(Math.sin(i * 91.7) * 43758.5453) % 1; ctx.beginPath(); ctx.ellipse(h * W, ((h * 13.7) % 1) * H, 30 + h * 30, 12, 0, 0, 7); ctx.fill(); }
    rr(ctx, x0 - 10, Y(-END) - 8, cw * L.lanes + 20, (L.rows + END * 2) * ch + 16, 8); ctx.fillStyle = '#8f8672'; ctx.fill();
    rr(ctx, x0 - 4, Y(-END) - 3, cw * L.lanes + 8, (L.rows + END * 2) * ch + 6, 6); ctx.fillStyle = '#a39a84'; ctx.fill();
    // the two ends: where it is safe to move over
    for (const [ya, yb] of [[Y(-END), Y(0)], [Y(L.rows), Y(L.rows + END)]]) {
      ctx.fillStyle = 'rgba(11,18,32,0.14)'; ctx.fillRect(x0, ya, cw * L.lanes, yb - ya);
      ctx.fillStyle = 'rgba(11,18,32,0.55)'; ctx.font = font(Math.min(13, ch * 0.3), 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('‹  MOVE OVER HERE  ›', W / 2, (ya + yb) / 2);
    }
    // the mat, square by square
    for (let i = 0; i < L.lanes; i++) {
      const heat = clamp((temps[i] - COLD) / (HOT - COLD), 0, 1), cold = temps[i] <= COLD;
      for (let r = 0; r < L.rows; r++) {
        const c = cells[i][r], x = x0 + i * cw, yy = Y(r), done = c.passes >= L.need;
        ctx.fillStyle = done ? '#22262d' : cold ? '#56606d' : '#17191c'; ctx.fillRect(x, yy, cw + 0.5, ch + 0.5);
        if (!done && !cold) {
          // loose, hot mix: rough and glowing
          ctx.fillStyle = `rgba(255,118,40,${0.07 + heat * 0.25})`; ctx.fillRect(x, yy, cw + 0.5, ch + 0.5);
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; for (let k = 0; k < 7 - c.passes * 2; k++) { const h = Math.abs(Math.sin((i * 31 + r * 17 + k * 7) * 12.9898) * 43758.5453) % 1; ctx.fillRect(x + h * (cw - 3), yy + ((h * 9.1) % 1) * (ch - 3), 2, 2); }
        }
        if (done) { const g = ctx.createLinearGradient(x, yy, x + cw, yy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, yy, cw, ch); }
        if (cold && !done) { ctx.strokeStyle = 'rgba(190,205,225,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + cw * 0.3, yy + ch * 0.3); ctx.lineTo(x + cw * 0.7, yy + ch * 0.7); ctx.moveTo(x + cw * 0.7, yy + ch * 0.3); ctx.lineTo(x + cw * 0.3, yy + ch * 0.7); ctx.stroke(); }
        if (c.scuff) { ctx.strokeStyle = 'rgba(190,196,206,0.75)'; ctx.lineWidth = 2; for (const k of [0.25, 0.45, 0.65]) { ctx.beginPath(); ctx.arc(x + cw * 0.5, yy + ch * (0.35 + k), cw * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); } }
        // little dots: passes done out of passes needed
        if (!done && !cold) for (let k = 0; k < L.need; k++) { ctx.beginPath(); ctx.arc(x + cw / 2 + (k - (L.need - 1) / 2) * 9, yy + ch / 2, 3, 0, 7); ctx.fillStyle = k < c.passes ? '#34d399' : 'rgba(255,255,255,0.3)'; ctx.fill(); }
        if (done) { ctx.strokeStyle = 'rgba(52,211,153,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x + cw / 2 - 5, yy + ch / 2); ctx.lineTo(x + cw / 2 - 1, yy + ch / 2 + 4); ctx.lineTo(x + cw / 2 + 6, yy + ch / 2 - 4); ctx.stroke(); }
      }
      // lane temperature, shown past the top end
      const tx = x0 + i * cw + cw / 2, ty = Y(-END) - 22;
      rr(ctx, tx - Math.min(cw / 2 - 2, 27), ty - 11, Math.min(cw - 4, 54), 22, 11); ctx.fillStyle = cold ? '#56606d' : `rgb(${Math.round(120 + heat * 135)},${Math.round(70 + heat * 60)},${Math.round(60 - heat * 30)})`; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = font(12, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cold ? 'COLD' : Math.round(temps[i]) + '°', tx, ty + 1);
    }
    // square outlines
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= L.lanes; i++) { ctx.moveTo(x0 + i * cw, y0); ctx.lineTo(x0 + i * cw, y0 + matH); } for (let r = 0; r <= L.rows; r++) { ctx.moveTo(x0, Y(r)); ctx.lineTo(x0 + cw * L.lanes, Y(r)); } ctx.stroke();

    roller(x0 + laneX * cw + cw / 2, Y(y), Math.min(cw * 0.9, ch * 1.5), dir);
    hud(W);
  }
  // A two-drum roller from above. (cx, cy) is its middle; w is how wide the drums are.
  function roller(cx, cy, w, d) {
    const len = w * 1.55, moving = wait <= 0, sway = clamp((lane - laneX) * 0.5, -0.3, 0.3);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(sway * d); if (d < 0) ctx.rotate(Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, -w / 2 + 3, -len / 2 + 4, w, len, 6); ctx.fill();
    const drum = (yy) => {
      const g = ctx.createLinearGradient(0, yy, 0, yy + len * 0.26); g.addColorStop(0, '#7d8794'); g.addColorStop(0.45, '#d5dbe3'); g.addColorStop(1, '#69727f');
      rr(ctx, -w / 2, yy, w, len * 0.26, 3); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(11,18,32,0.25)'; ctx.lineWidth = 1; const off = moving ? ((t * L.speed * 9) % 6) : 0; ctx.beginPath(); for (let k = off; k < len * 0.26; k += 6) { ctx.moveTo(-w / 2 + 2, yy + k); ctx.lineTo(w / 2 - 2, yy + k); } ctx.stroke();
    };
    drum(-len / 2); drum(len / 2 - len * 0.26);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#e0a50c'); g.addColorStop(0.5, '#f8c62a'); g.addColorStop(1, '#d99d08');
    rr(ctx, -w * 0.4, -len * 0.27, w * 0.8, len * 0.54, 5); ctx.fillStyle = g; ctx.fill();
    rr(ctx, -w * 0.32, -len * 0.23, w * 0.64, len * 0.14, 3); ctx.fillStyle = '#c98f06'; ctx.fill();                       // engine cover
    rr(ctx, -w * 0.34, -len * 0.05, w * 0.68, len * 0.28, 4); ctx.fillStyle = 'rgba(20,23,28,0.82)'; ctx.fill();          // canopy
    ctx.beginPath(); ctx.arc(0, len * 0.09, w * 0.13, 0, 7); ctx.fillStyle = '#c8f03c'; ctx.fill(); ctx.beginPath(); ctx.arc(0, len * 0.09, w * 0.08, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();
    ctx.fillStyle = '#14171c'; ctx.fillRect(-w * 0.44, -len * 0.02, w * 0.05, len * 0.04); ctx.fillRect(w * 0.39, -len * 0.02, w * 0.05, len * 0.04);
    ctx.restore();
  }
  function hud(W) {
    const pad = 10, gapW = 8, w = (W - pad * 2 - gapW * 2) / 3, y = 10, p = Math.round(packed() * 100);
    pill(ctx, pad, y, w, 'Packed', p + '%', { color: p >= 90 ? '#7ef0c2' : '#fff' });
    pill(ctx, pad + w + gapW, y, w, 'Passes each', String(L.need));
    pill(ctx, pad + (w + gapW) * 2, y, w, 'Turn marks', String(marks), { color: marks ? '#ff7a6e' : '#7ef0c2' });
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, y + 52, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
  }
  return { start, update, draw, destroy() {}, peek: () => ({ L, lane, y, dir, cells, temps, onMat: onMat(), wait }), poke: shift };
}
