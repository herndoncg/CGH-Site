// STOP / SLOW: run traffic past a one-lane work zone.
// Seen from straight above. Cars come from the top and the bottom and have to share one lane past the
// work. Tap the top half of the screen to flip the top paddle, the bottom half for the bottom paddle.
// Let one side go, stop it, wait for the lane to empty, then let the other side go.
//
// The numbers that set how hard a level is are in LEVELS below:
//   cars   how many cars have to get through   rate  cars per second from the top and from the bottom
//   max    how long a line can get before drivers give up (a strike)
//   trucks how many times a dump truck needs out of the work zone
//   sirens how many ambulances come through
import { clamp, rr, rng, font, pill, bar, banner } from './kit.js';

const LEVELS = [
  { cars: 14, rate: [0.22, 0.22], max: 6, trucks: 0, sirens: 0 },
  { cars: 20, rate: [0.28, 0.28], max: 6, trucks: 0, sirens: 0 },
  { cars: 24, rate: [0.42, 0.2], max: 6, trucks: 0, sirens: 0 },
  { cars: 28, rate: [0.34, 0.34], max: 6, trucks: 0, sirens: 0 },
  { cars: 28, rate: [0.3, 0.3], max: 6, trucks: 2, sirens: 0 },
  { cars: 34, rate: [0.5, 0.3], max: 7, trucks: 2, sirens: 0 },
  { cars: 36, rate: [0.4, 0.4], max: 7, trucks: 1, sirens: 2 },
  { cars: 44, rate: [0.44, 0.44], max: 8, trucks: 2, sirens: 2 },
];
// The road runs from 0 (top of the screen) to 100 (bottom). The shared lane is the middle of it.
const LINE = [26, 74];        // where the top line and the bottom line of cars stop
const LANE = [29, 71];        // the stretch only one direction can use at a time
const SPEED = 24, CAR = 6.2, GAP = 2.2;
const COLORS = ['#c9d2dc', '#8b1e24', '#2c4a7c', '#3f4650', '#d8d2c2', '#5d6b4a', '#b7791f'];

export function create(env) {
  const { ctx } = env;
  let L, n, rand, cars, go, through, strikes, points, t, note, noteT, nextCar, truck, trucksLeft, sirensLeft, eventAt, crashed, endT, chain, lastDir, hint, why;

  const say = (text, good = false, time = 2.2) => { note = { text, good }; noteT = time; };
  // dir 0 = coming from the top (driving down the screen), dir 1 = coming from the bottom.
  const sign = (d) => (d === 0 ? 1 : -1);
  const ahead = (c) => sign(c.dir) * c.y;                       // how far along its trip a car is
  const passedLine = (c) => (c.dir === 0 ? c.y > LINE[0] + 0.01 : c.y < LINE[1] - 0.01);
  const inLane = (c) => { const a = Math.min(c.y, c.y - sign(c.dir) * c.len), b = Math.max(c.y, c.y - sign(c.dir) * c.len); return b > LANE[0] && a < LANE[1]; };
  const waiting = (d) => cars.filter((c) => c.dir === d && !passedLine(c)).length;
  // A car is "in the lane" from the moment it passes its stop line until its back end is out the far side.
  const committed = (c) => passedLine(c) && (c.dir === 0 ? c.y - c.len < LANE[1] : c.y + c.len > LANE[0]);
  const laneBusy = (except) => cars.some((c) => c !== except && (inLane(c) || committed(c)));

  function flip(d) {
    if (crashed || endT > 0) return;
    go[d] = !go[d]; hint = false; env.sfx(go[d] ? 'move' : 'click'); env.buzz(15);
  }
  function addCar(d, kind = 'car') {
    const same = cars.filter((c) => c.dir === d && !passedLine(c));
    const last = same.length ? same.reduce((a, b) => (ahead(a) < ahead(b) ? a : b)) : null;
    const start = d === 0 ? -8 : 108;
    let y = last ? (d === 0 ? Math.min(start, last.y - last.len - GAP - 1) : Math.max(start, last.y + last.len + GAP + 1)) : start;
    const c = { dir: d, y, v: SPEED, len: kind === 'siren' ? 7.5 : CAR, color: COLORS[Math.floor(rand() * COLORS.length)], kind, hold: 0, wait: 0 };
    if (kind === 'siren') {
      // an ambulance comes up the shoulder to the front of its line
      const front = same.length ? same.reduce((a, b) => (ahead(a) > ahead(b) ? a : b)) : null;
      c.y = front && Math.abs(front.y - LINE[d]) < 30 ? LINE[d] - sign(d) * 0.01 : (d === 0 ? 4 : 96);
      for (const o of same) o.y -= sign(d) * (c.len + GAP);
      c.clock = 10;
    }
    cars.push(c);
  }

  function start(level) {
    n = level; L = LEVELS[n]; rand = rng(500 + n * 31);
    cars = []; go = [false, false]; through = 0; strikes = 0; points = 0; t = 0; note = null; noteT = 0; nextCar = [1.2, 2.0];
    truck = null; trucksLeft = L.trucks; sirensLeft = L.sirens; eventAt = 9; crashed = null; endT = 0; chain = 0; lastDir = -1; hint = true; why = [];
    env.onSwipe = (d, x, y) => { if (d === 'tap') flip(y < env.H / 2 ? 0 : 1); else if (d === 'up') flip(0); else if (d === 'down') flip(1); };
    env.onKey = (k) => { if (k === 'ArrowUp' || k === 'w') flip(0); if (k === 'ArrowDown' || k === 's') flip(1); };
    say('Tap the top or bottom of the screen to flip that paddle', true, 3.2);
  }

  function strike(text) {
    strikes++; chain = 0; why.push(text); env.sfx('horn'); env.buzz(100); say(text, false, 2.4);
    if (strikes >= 3) { endT = 1.0; }
  }
  function update(dt) {
    t += dt; noteT = Math.max(0, noteT - dt);
    if (endT > 0) { endT -= dt; if (endT <= 0) done(); return; }

    // new cars show up
    for (const d of [0, 1]) { nextCar[d] -= dt; if (nextCar[d] <= 0) { nextCar[d] = (0.35 + rand() * 1.3) / L.rate[d]; if (through + cars.length < L.cars + 6) addCar(d); } }
    // now and then: a truck needs out, or an ambulance comes
    eventAt -= dt;
    if (eventAt <= 0 && !truck && !cars.some((c) => c.kind === 'siren')) {
      const options = []; if (trucksLeft > 0) options.push('truck'); if (sirensLeft > 0) options.push('siren');
      if (options.length && through < L.cars - 4) {
        const pick = options[Math.floor(rand() * options.length)];
        if (pick === 'truck') { trucksLeft--; truck = { state: 'waiting', clock: 16, dir: rand() < 0.5 ? 0 : 1, y: 50, x: 1 }; say('The dump truck needs out. Stop both sides.', false, 3); env.sfx('warn'); }
        else { sirensLeft--; const d = rand() < 0.5 ? 0 : 1; addCar(d, 'siren'); say('Ambulance coming from the ' + (d === 0 ? 'top' : 'bottom') + '. Clear the lane.', false, 3); env.sfx('warn'); }
      }
      eventAt = 10 + rand() * 4;
    }
    // the truck pulls out once both paddles say STOP and the lane is empty
    if (truck) {
      if (truck.state === 'waiting') {
        truck.clock -= dt;
        if (!go[0] && !go[1] && !laneBusy()) { truck.state = 'out'; truck.car = { dir: truck.dir, y: 50 + sign(truck.dir) * 4, v: SPEED * 0.75, len: 9, color: '#eef1f5', kind: 'truck', hold: 0, wait: 0, slide: 1 }; cars.push(truck.car); env.sfx('good'); points += 200; env.pop(env.W / 2, env.H / 2, 'Truck is out +200', '#f5c542'); }
        else if (truck.clock <= 0) { truck = null; strike('The truck waited too long. The paver ran out of mix.'); }
      } else if (!cars.includes(truck.car)) truck = null;
    }

    // every car: follow the one in front, stop at the paddle, take turns starting up
    for (const d of [0, 1]) {
      const mine = cars.filter((c) => c.dir === d).sort((a, b) => ahead(b) - ahead(a));
      mine.forEach((c, i) => {
        let limit = Infinity;                                   // how far along it may go this instant
        if (i > 0) { const f = mine[i - 1]; limit = ahead(f) - f.len - GAP; }
        if (!go[d] && !passedLine(c) && c.kind !== 'truck') limit = Math.min(limit, sign(d) * LINE[d]);
        const room = limit - ahead(c);
        if (room <= 0.02) { c.v = 0; c.hold = 0.42; c.wait += dt; }
        else {
          if (c.hold > 0) { c.hold -= dt; c.v = 0; }
          else c.v = Math.min(c.kind === 'truck' ? SPEED * 0.75 : SPEED, c.v + 46 * dt, Math.max(3, room * 6));
          c.y += sign(d) * Math.min(c.v * dt, room);
        }
        if (c.slide) c.slide = Math.max(0, c.slide - dt * 1.6);
        if (c.kind === 'siren' && !c.done) { c.clock -= dt; if (passedLine(c)) { c.done = true; points += 300; env.sfx('good'); env.pop(env.W / 2, env.H / 2, 'Ambulance through +300', '#f5c542'); } else if (c.clock <= 0) { c.done = true; strike('The ambulance got held up.'); } }
      });
    }
    // two cars nose to nose in the one lane
    const down = cars.filter((c) => c.dir === 0 && c.y > LANE[0]), up = cars.filter((c) => c.dir === 1 && c.y < LANE[1]);
    for (const a of down) for (const b of up) {
      // the part of the road both of them are on at once; it only counts inside the shared lane
      const lo = Math.max(a.y - a.len, b.y), hi = Math.min(a.y, b.y + b.len);
      if (!crashed && hi - lo > -0.8 && hi > LANE[0] + 1 && lo < LANE[1] - 1) { crashed = { y: (a.y + b.y) / 2 }; a.v = b.v = 0; env.sfx('hit'); env.buzz(200); endT = 1.3; say('Head-on in the lane!', false, 3); }
    }

    // cars that made it out the far end
    cars = cars.filter((c) => {
      const out = c.dir === 0 ? c.y - c.len > 104 : c.y + c.len < -4;
      if (out && c.kind !== 'truck') {
        through++; chain = c.dir === lastDir ? chain + 1 : 1; lastDir = c.dir;
        const pts = 100 + Math.min(4, chain - 1) * 25; points += pts;
        env.pop(env.W / 2 + (c.dir === 0 ? -1 : 1) * 60, c.dir === 0 ? env.H - 60 : 130, '+' + pts, '#7ef0c2'); env.sfx('pick');
      }
      return !out;
    });
    // a line that gets too long: the last driver gives up and turns around
    for (const d of [0, 1]) if (waiting(d) > L.max) {
      const mine = cars.filter((c) => c.dir === d && !passedLine(c) && c.kind === 'car').sort((a, b) => ahead(a) - ahead(b));
      if (mine[0]) cars.splice(cars.indexOf(mine[0]), 1);
      strike('The ' + (d === 0 ? 'top' : 'bottom') + ' line got too long. Take turns.');
    }
    if (through >= L.cars && endT <= 0 && !crashed) { endT = 0.8; env.sfx('good'); }
  }
  function done() {
    const stats = [['Cars through', `${Math.min(through, L.cars)} of ${L.cars}`], ['Strikes', String(strikes)]];
    if (crashed) return env.finish({ stars: 0, score: points, headline: 'Head-on in the lane', note: 'Traffic was released while a car from the other side was still in the lane. Stop one side, wait for the lane to empty, then release the other.', stats });
    if (strikes >= 3) return env.finish({ stars: 0, score: points, headline: 'Three strikes', note: 'The lines got out of hand. Switch sides more often so nobody waits too long.', stats });
    const stars = strikes === 0 ? 3 : strikes === 1 ? 2 : 1;
    env.finish({ stars, score: points + (3 - strikes) * 300, headline: 'Everybody got through', note: stars === 3 ? 'No strikes and nobody waited long. That is a flagger drivers thank.' : 'Everyone made it, but somebody waited too long. Keep both lines short.', stats });
  }

  // ----- drawing -----
  function draw() {
    const W = env.W, H = env.H, top = 100, bot = H - 14, cx = W / 2, lw = clamp(W * 0.17, 48, 74);
    const Y = (u) => top + (u / 100) * (bot - top), U = (bot - top) / 100;
    const laneX = (d, u) => {
      // Cars from the bottom belong in the right lane, but the work has it closed, so they cross over.
      if (d === 0) return cx - lw / 2;
      const k = u >= 70 ? 0 : u >= 64 ? (70 - u) / 6 : u >= 36 ? 1 : u >= 30 ? (u - 30) / 6 : 0;
      return cx + lw / 2 - k * lw;
    };
    // ground and road
    ctx.fillStyle = '#4c7a45'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 26; i++) { const h = Math.abs(Math.sin(i * 51.3) * 43758.5453) % 1; ctx.beginPath(); ctx.ellipse(h * W, ((h * 17.3) % 1) * H, 28 + h * 30, 12, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#8f8672'; ctx.fillRect(cx - lw - 9, 0, lw * 2 + 18, H);
    ctx.fillStyle = '#3c4149'; ctx.fillRect(cx - lw, 0, lw * 2, H);
    ctx.fillStyle = '#e8ecf1'; ctx.fillRect(cx - lw + 3, 0, 2.5, H); ctx.fillRect(cx + lw - 5.5, 0, 2.5, H);
    ctx.fillStyle = '#e9b93a'; for (let y = -10; y < H; y += 30) { if (y > Y(30) - 26 && y < Y(70)) continue; ctx.fillRect(cx - 1.5, y, 3, 18); }
    // the closed lane: fresh mat going down, cones around it
    const zx = cx + 4, zw = lw - 8;
    ctx.fillStyle = '#17191c'; ctx.fillRect(zx, Y(38), zw, Y(62) - Y(38));
    const hg = ctx.createLinearGradient(0, Y(38), 0, Y(46)); hg.addColorStop(0, 'rgba(255,118,40,0.3)'); hg.addColorStop(1, 'rgba(255,118,40,0)'); ctx.fillStyle = hg; ctx.fillRect(zx, Y(38), zw, Y(46) - Y(38));
    const cone = (x, y) => { ctx.fillStyle = '#1d232d'; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fillStyle = '#f47a20'; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill(); };
    for (let u = 36; u <= 64; u += 4) cone(cx + 1, Y(u));
    for (let k = 0; k <= 3; k++) { cone(cx + 1 + (k / 3) * (lw - 6), Y(36 - k * 2)); cone(cx + 1 + (k / 3) * (lw - 6), Y(64 + k * 2)); }
    // the roller working in the closed lane (or the truck waiting to get out)
    roller(zx + zw / 2, Y(41 + ((t * 2) % 8 < 4 ? (t * 2) % 8 : 8 - ((t * 2) % 8))), zw * 0.62);
    if (truck && truck.state === 'waiting') {
      vehicle(zx + zw / 2, Y(54.5), zw * 0.78, 9 * U, { dir: truck.dir, color: '#eef1f5', kind: 'truck' }, true);
      const urgent = truck.clock < 6, bx = zx + zw + 8, by = Y(50) - 16;
      rr(ctx, bx, by, 92, 32, 8); ctx.fillStyle = urgent && Math.floor(t * 4) % 2 ? '#d9453a' : '#0b1220'; ctx.fill(); ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = font(11, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('NEEDS OUT', bx + 8, by + 13); bar(ctx, bx + 8, by + 19, 76, 6, truck.clock / 16, urgent ? '#ff7a6e' : '#f5c542');
    }
    // stop lines
    ctx.fillStyle = '#e8ecf1'; ctx.fillRect(cx - lw + 6, Y(LINE[0]) + 2, lw - 9, 4); ctx.fillRect(cx + 3, Y(LINE[1]) - 6, lw - 9, 4);

    // cars, far lane first so nothing overlaps oddly
    for (const c of cars) {
      const mid = c.y - sign(c.dir) * c.len / 2;
      let x = laneX(c.dir, mid); if (c.kind === 'truck' && c.slide) x += c.slide * lw;
      vehicle(x, Y(mid), lw * (c.kind === 'car' ? 0.56 : 0.64), c.len * U, c, c.v < 2);
    }
    if (crashed) { const yy = Y(crashed.y), x = cx - lw / 2; for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (10 + (i % 3) * 9), yy + Math.sin(a) * (10 + (i % 3) * 9), 7 + (i % 3) * 3, 0, 7); ctx.fillStyle = ['#f5c542', '#ff7a6e', '#fff'][i % 3]; ctx.globalAlpha = 0.85; ctx.fill(); } ctx.globalAlpha = 1; }

    // the two flaggers and their paddles
    for (const d of [0, 1]) {
      const y = Y(LINE[d]) + (d === 0 ? -6 : 6), side = d === 0 ? -1 : 1, fx = cx + side * (lw + 20), px = cx + side * (lw + Math.min(74, (W / 2 - lw) * 0.62)), r = Math.min(34, (W / 2 - lw) * 0.36);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(fx + 2, y + 3, 11, 9, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, y, 10, 0, 7); ctx.fillStyle = '#c8f03c'; ctx.fill(); ctx.strokeStyle = '#f47a20'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.arc(fx, y, 5.5, 0, 7); ctx.fillStyle = '#f3f5f8'; ctx.fill();
      ctx.strokeStyle = '#7c8794'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx + side * 8, y); ctx.lineTo(px - side * r * 0.8, y); ctx.stroke();
      paddle(px, y, r, go[d]);
      // how long the line is
      const q = waiting(d), frac = q / L.max, by = d === 0 ? Y(LINE[0]) - 64 : Y(LINE[1]) + 46, bx = cx + (d === 0 ? 1 : -1) * (lw + 12) + (d === 0 ? 0 : -86);
      rr(ctx, bx, by, 86, 30, 8); ctx.fillStyle = frac > 0.8 && Math.floor(t * 4) % 2 ? 'rgba(170,36,28,0.92)' : 'rgba(11,18,32,0.8)'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = font(11, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(q + ' WAITING', bx + 8, by + 13); bar(ctx, bx + 8, by + 18, 70, 6, frac, frac > 0.8 ? '#ff7a6e' : frac > 0.5 ? '#f5c542' : '#34d399');
      if (hint && t < 8) { ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.3; ctx.fillStyle = '#fff'; ctx.font = font(13, 800); ctx.textAlign = 'center'; ctx.fillText('TAP', px, y + (d === 0 ? r + 18 : -r - 10)); ctx.globalAlpha = 1; }
    }
    hud(W);
  }
  function paddle(x, y, r, slow) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(2, 3, r, 0, 7); ctx.fill();
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
    ctx.fillStyle = slow ? '#f48a20' : '#c62828'; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.09); ctx.strokeStyle = slow ? '#14171c' : '#fff'; ctx.stroke();
    ctx.fillStyle = slow ? '#14171c' : '#fff'; ctx.font = font(r * 0.54, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(slow ? 'SLOW' : 'STOP', 0, 1);
    ctx.restore();
  }
  // A car, truck or ambulance from above. (x, y) is its middle; it points the way it is driving.
  function vehicle(x, y, w, len, c, braking) {
    ctx.save(); ctx.translate(x, y); if (c.dir === 1) ctx.rotate(Math.PI);      // drawn nose down, flipped for cars heading up
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, -w / 2 + 2, -len / 2 + 3, w, len, w * 0.25); ctx.fill();
    if (c.kind === 'truck') {
      rr(ctx, -w / 2, -len / 2, w, len * 0.66, 3); ctx.fillStyle = '#23272e'; ctx.fill(); rr(ctx, -w / 2 + 3, -len / 2 + 3, w - 6, len * 0.66 - 6, 2); ctx.fillStyle = '#0d0e10'; ctx.fill();
      rr(ctx, -w / 2 + 1, len * 0.18, w - 2, len * 0.32, 4); ctx.fillStyle = '#eef1f5'; ctx.fill(); ctx.fillStyle = '#1c2942'; ctx.fillRect(-w / 2 + 4, len * 0.36, w - 8, len * 0.08);
      ctx.fillStyle = '#0ea5a9'; ctx.fillRect(-w / 2, -len / 2 + len * 0.6, w, 2.5);
    } else {
      rr(ctx, -w / 2, -len / 2, w, len, w * 0.28); ctx.fillStyle = c.kind === 'siren' ? '#f3f5f8' : c.color; ctx.fill();
      ctx.fillStyle = 'rgba(18,27,46,0.85)'; rr(ctx, -w / 2 + 3, len * 0.08, w - 6, len * 0.2, 3); ctx.fill(); rr(ctx, -w / 2 + 3, -len * 0.36, w - 6, len * 0.14, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-w / 2 + 3, -len * 0.2, w - 6, len * 0.26);
      if (c.kind === 'siren') { ctx.fillStyle = '#d9453a'; ctx.fillRect(-w / 2, -len * 0.05, w, 3); ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ff3b30' : '#3b82f6'; ctx.fillRect(-w / 2 + 3, -len * 0.16, w / 2 - 3, 5); ctx.fillStyle = Math.floor(t * 8) % 2 ? '#3b82f6' : '#ff3b30'; ctx.fillRect(0, -len * 0.16, w / 2 - 3, 5); }
      ctx.fillStyle = '#fff4c2'; ctx.fillRect(-w / 2 + 2, len / 2 - 3, 5, 2.5); ctx.fillRect(w / 2 - 7, len / 2 - 3, 5, 2.5);
    }
    ctx.fillStyle = braking ? '#ff4b3e' : '#8f1f19'; ctx.fillRect(-w / 2 + 2, -len / 2, 6, 2.5); ctx.fillRect(w / 2 - 8, -len / 2, 6, 2.5);
    ctx.restore();
    if (c.kind === 'siren' && !c.done) { const urgent = c.clock < 4; rr(ctx, x + w / 2 + 6, y - 9, 58, 18, 6); ctx.fillStyle = urgent && Math.floor(t * 4) % 2 ? '#d9453a' : '#0b1220'; ctx.fill(); bar(ctx, x + w / 2 + 11, y - 3, 48, 6, c.clock / 10, urgent ? '#ff7a6e' : '#f5c542'); }
  }
  function roller(cx, cy, w) {
    const len = w * 1.5; ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, -w / 2 + 2, -len / 2 + 3, w, len, 4); ctx.fill();
    for (const yy of [-len / 2, len / 2 - len * 0.26]) { const g = ctx.createLinearGradient(0, yy, 0, yy + len * 0.26); g.addColorStop(0, '#7d8794'); g.addColorStop(0.45, '#d5dbe3'); g.addColorStop(1, '#69727f'); rr(ctx, -w / 2, yy, w, len * 0.26, 2); ctx.fillStyle = g; ctx.fill(); }
    rr(ctx, -w * 0.4, -len * 0.27, w * 0.8, len * 0.54, 3); ctx.fillStyle = '#f8c62a'; ctx.fill(); rr(ctx, -w * 0.3, -len * 0.06, w * 0.6, len * 0.26, 2); ctx.fillStyle = 'rgba(20,23,28,0.82)'; ctx.fill();
    ctx.restore();
  }
  function hud(W) {
    const pad = 10, gapW = 8, w = (W - pad * 2 - gapW * 2) / 3, y = 10;
    pill(ctx, pad, y, w, 'Cars through', `${Math.min(through, L.cars)} / ${L.cars}`);
    pill(ctx, pad + w + gapW, y, w, 'Score', points.toLocaleString('en-US'));
    pill(ctx, pad + (w + gapW) * 2, y, w, 'Strikes', '', {});
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(pad + (w + gapW) * 2 + 18 + i * 22, y + 29, 7, 0, 7); ctx.fillStyle = i < strikes ? '#ff5a4d' : 'rgba(255,255,255,0.18)'; ctx.fill(); }
    bar(ctx, pad, y + 52, W - pad * 2, 6, through / L.cars, '#0ea5a9');
    if (noteT > 0 && note) { ctx.globalAlpha = Math.min(1, noteT * 3); banner(ctx, W, y + 66, note.text, note.good ? '#0b1220' : '#fff', note.good ? 'rgba(52,211,153,0.94)' : 'rgba(170,36,28,0.94)'); ctx.globalAlpha = 1; }
  }
  return { start, update, draw, destroy() {}, peek: () => ({ L, go, cars, truck, through, strikes, waiting, laneBusy, crashed, why }), poke: flip };
}
