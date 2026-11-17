// YARDAGE BOSS: the math behind a paving job, against the clock.
// Eight questions a level. Tap the right answer; a wrong answer shows how the math works.
// No prices anywhere in this game, only sizes, yards, loads and tons.
//
// Per level: what kind of question it asks (KINDS below) and how many seconds each question gets.
import { rng } from './kit.js';

const LEVELS = [
  { kinds: ['rect'], secs: 40 },
  { kinds: ['lshape'], secs: 50 },
  { kinds: ['sqyd'], secs: 45 },
  { kinds: ['rock'], secs: 60 },
  { kinds: ['loads', 'loads', 'rockloads'], secs: 55 },
  { kinds: ['tons'], secs: 70 },
  { kinds: ['tri', 'circle', 'flare'], secs: 55 },
  { kinds: ['rect', 'lshape', 'rock', 'rockloads', 'tons', 'tri', 'circle', 'sqyd'], secs: 45 },
];
const QUESTIONS = 8;
const LB_PER_CUFT = 145;   // hot mix, the same figure the app's job calculator uses
const LOAD_YARDS = 10;     // cubic yards of rock in one truck load

const fmt = (v) => (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const r1 = (v) => Math.round(v * 10) / 10;

// ----- pictures -----
const svg = (inner) => `<svg viewBox="0 0 300 150" role="img" aria-hidden="true">${inner}</svg>`;
const label = (x, y, text, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="ym-dim">${text}</text>`;
const slab = (fill, w, h, lenText, widText, extra = '') => svg(`<rect x="${150 - w / 2}" y="${70 - h / 2}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="#f3f5f8" stroke-width="2"/>${label(150, 70 - h / 2 - 8, lenText)}${label(150 - w / 2 - 8, 74, widText, 'end')}${extra}`);
const depthTag = (text) => `<rect x="196" y="118" width="96" height="26" rx="13" fill="#0ea5a9"/><text x="244" y="136" text-anchor="middle" class="ym-tag">${text}</text>`;
const truckPic = (nText) => svg(`<rect x="60" y="52" width="120" height="50" rx="4" fill="#23272e" stroke="#f3f5f8" stroke-width="2"/><path d="M66 52 Q120 22 174 52z" fill="#a39a84"/><rect x="184" y="62" width="48" height="40" rx="6" fill="#eef1f5"/><rect x="204" y="68" width="24" height="16" rx="3" fill="#1c2942"/><circle cx="88" cy="108" r="12" fill="#14171c"/><circle cx="118" cy="108" r="12" fill="#14171c"/><circle cx="210" cy="108" r="12" fill="#14171c"/>${label(120, 84, nText)}`);

// ----- the kinds of question -----
// Each one returns the question, the right answer, three wrong answers people really get, and the math.
const KINDS = {
  rect(R) {
    const L = R.int(4, 24) * 5, W = R.int(8, 24), a = L * W;
    return { ask: `A driveway is ${L} feet long and ${W} feet wide. How many square feet is it?`, unit: 'sq ft', answer: a, wrong: [2 * (L + W), a + L, a - W * 5, (L + W) * 10], pic: slab('#1b1d21', 190, 60, `${L} ft`, `${W} ft`), work: `Length × width: ${L} × ${W} = ${fmt(a)} square feet.` };
  },
  lshape(R) {
    const L = R.int(6, 20) * 5, W = R.int(10, 16), C = R.int(3, 8) * 5, D = R.int(10, 24), a = L * W + C * D;
    const pic = svg(`<path d="M40 30 H230 V70 H130 V125 H40z" fill="#1b1d21" stroke="#f3f5f8" stroke-width="2" stroke-linejoin="round"/><path d="M40 70 H130" stroke="#f3f5f8" stroke-width="1.5" stroke-dasharray="5 4"/>${label(135, 22, `${L} ft`)}${label(238, 54, `${W} ft`, 'start')}${label(85, 142, `${C} ft`)}${label(138, 102, `${D} ft`, 'start')}`);
    return { ask: `A driveway (${L} by ${W} feet) has a parking pad on the side (${C} by ${D} feet). What is the total square feet?`, unit: 'sq ft', answer: a, wrong: [L * W, (L + C) * (W + D), a + C * W, a - C * 5], pic, work: `Two rectangles: ${L} × ${W} = ${fmt(L * W)}, and ${C} × ${D} = ${fmt(C * D)}. Add them: ${fmt(a)} square feet.` };
  },
  sqyd(R) {
    const y = R.int(8, 80) * 10, a = y * 9;
    return { ask: `A parking lot is ${fmt(a)} square feet. How many square yards is that?`, unit: 'sq yd', answer: y, wrong: [a / 3, Math.round(a / 12), Math.round(a / 27), y + 90], pic: svg(`<rect x="60" y="24" width="180" height="100" rx="3" fill="#1b1d21" stroke="#f3f5f8" stroke-width="2"/><path d="M120 24v100M180 24v100M60 57h180M60 91h180" stroke="#f3f5f8" stroke-opacity="0.35" stroke-dasharray="4 4"/>${label(150, 80, `${fmt(a)} sq ft`)}`), work: `Nine square feet make a square yard: ${fmt(a)} ÷ 9 = ${fmt(y)} square yards.` };
  },
  rock(R) {
    const d = R.pick([2, 3, 4, 6]), y = R.int(1, 8) * 5, a = (324 * y) / d;
    return { ask: `A ${fmt(a)} square foot pad needs ${d} inches of rock. How many cubic yards is that?`, unit: 'cu yd', answer: y, wrong: [27 * y, Math.round((a * d) / 27), y * 3, y + R.pick([4, 6, 8])], pic: slab('#a39a84', 190, 60, `${fmt(a)} sq ft`, '', depthTag(`${d} in deep`)), work: `${fmt(a)} × ${d} ÷ 12 = ${fmt((a * d) / 12)} cubic feet. Divide by 27: ${fmt(y)} cubic yards.` };
  },
  loads(R) {
    let y = R.int(12, 78); if (y % LOAD_YARDS === 0) y += 3;
    const n = Math.ceil(y / LOAD_YARDS);
    return { ask: `A job needs ${y} cubic yards of rock. The truck hauls ${LOAD_YARDS} yards a load. How many loads do you order?`, unit: 'loads', answer: n, wrong: [n - 1, n + 1, n + 2], pic: truckPic(`${LOAD_YARDS} yd`), work: `${y} ÷ ${LOAD_YARDS} = ${fmt(r1(y / LOAD_YARDS))}. Trucks only come in whole loads, so round up: ${n} loads.` };
  },
  rockloads(R) {
    const d = R.pick([2, 3, 4]), a = R.int(8, 30) * 100, y = (a * d) / 324, n = Math.ceil(y / LOAD_YARDS);
    return { ask: `${fmt(a)} square feet needs ${d} inches of rock. The truck hauls ${LOAD_YARDS} yards a load. How many loads?`, unit: 'loads', answer: n, wrong: [n + 1, n + 3, Math.max(1, n - 1) === n ? n + 2 : n - 1], pic: slab('#a39a84', 190, 60, `${fmt(a)} sq ft`, '', depthTag(`${d} in deep`)), work: `${fmt(a)} × ${d} ÷ 12 ÷ 27 = ${fmt(r1(y))} cubic yards. ${fmt(r1(y))} ÷ ${LOAD_YARDS} rounds up to ${n} loads.` };
  },
  tons(R) {
    const d = R.pick([2, 2, 3]), a = R.int(6, 40) * 200, t = r1((a * d * LB_PER_CUFT) / 24000);
    return { ask: `A ${fmt(a)} square foot driveway gets ${d} inches of hot mix. Hot mix weighs ${LB_PER_CUFT} pounds a cubic foot. About how many tons?`, unit: 'tons', answer: t, wrong: [r1(t * (d + 1) / d), r1(t / 1.45), r1(t * 2), r1(t / 2)], pic: slab('#1b1d21', 190, 60, `${fmt(a)} sq ft`, '', depthTag(`${d} in deep`)), work: `${fmt(a)} × ${d} ÷ 12 = ${fmt((a * d) / 12)} cubic feet. Times ${LB_PER_CUFT} pounds = ${fmt(((a * d) / 12) * LB_PER_CUFT)} pounds. Divide by 2,000: about ${fmt(t)} tons.` };
  },
  tri(R) {
    const b = R.int(4, 15) * 2, h = R.int(3, 12) * 2, a = (b * h) / 2;
    return { ask: `The flare where a driveway meets the road is a triangle ${b} feet wide and ${h} feet deep. How many square feet?`, unit: 'sq ft', answer: a, wrong: [b * h, b + h, a / 2 === Math.round(a / 2) ? a / 2 : a + b, a + h], pic: svg(`<path d="M60 120 H240 L150 34z" fill="#1b1d21" stroke="#f3f5f8" stroke-width="2" stroke-linejoin="round"/><path d="M150 34V120" stroke="#f3f5f8" stroke-dasharray="5 4"/>${label(150, 140, `${b} ft`)}${label(158, 84, `${h} ft`, 'start')}`), work: `A triangle is half of base × height: ${b} × ${h} ÷ 2 = ${fmt(a)} square feet.` };
  },
  circle(R) {
    const r = R.pick([10, 12, 15, 20, 25, 30]), a = Math.round(3.14 * r * r);
    return { ask: `A round turnaround is ${r} feet from the middle to the edge. About how many square feet? (Use 3.14)`, unit: 'sq ft', answer: a, wrong: [Math.round(2 * 3.14 * r), r * r, Math.round(3.14 * r * 2 * r * 2), Math.round(3.14 * r * r / 2)], pic: svg(`<circle cx="150" cy="75" r="60" fill="#1b1d21" stroke="#f3f5f8" stroke-width="2"/><path d="M150 75H210" stroke="#f3f5f8" stroke-width="2"/><circle cx="150" cy="75" r="3" fill="#f3f5f8"/>${label(180, 68, `${r} ft`)}`), work: `A circle is 3.14 × radius × radius: 3.14 × ${r} × ${r} = ${fmt(a)} square feet.` };
  },
  flare(R) {
    const L = R.int(6, 16) * 5, W = R.int(10, 14), b = R.int(3, 8) * 2, h = R.int(4, 9) * 2, a = L * W + (b * h) / 2;
    return { ask: `A ${L} by ${W} foot driveway has a triangle flare at the road, ${b} feet wide and ${h} feet deep. Total square feet?`, unit: 'sq ft', answer: a, wrong: [L * W + b * h, L * W, a + L, (L + h) * W], pic: svg(`<path d="M40 50 H200 V26 L262 75 L200 124 V100 H40z" fill="#1b1d21" stroke="#f3f5f8" stroke-width="2" stroke-linejoin="round"/><path d="M200 50V100" stroke="#f3f5f8" stroke-dasharray="5 4"/>${label(120, 42, `${L} ft`)}${label(32, 80, `${W} ft`, 'end')}${label(232, 142, `${h} ft deep`)}${label(206, 18, `${b} ft wide`, 'start')}`), work: `Rectangle: ${L} × ${W} = ${fmt(L * W)}. Triangle: ${b} × ${h} ÷ 2 = ${fmt((b * h) / 2)}. Together: ${fmt(a)} square feet.` };
  },
};

function makeQuestion(kind, R) {
  const q = KINDS[kind](R);
  // four different answers: the right one and three wrong ones, shuffled
  const wrong = [];
  for (const w of q.wrong) { const v = r1(w); if (v > 0 && v !== q.answer && !wrong.includes(v)) wrong.push(v); }
  for (let bump = 1; wrong.length < 3; bump++) { const v = r1(q.answer + bump * Math.max(1, Math.round(q.answer * 0.1))); if (!wrong.includes(v)) wrong.push(v); }
  const picks = []; while (picks.length < 3) picks.push(wrong.splice(Math.floor(R() * wrong.length), 1)[0]);
  const choices = [q.answer, ...picks]; for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { ...q, choices };
}

// The questions start right away, with no READY and GO.
export const quickStart = true;

export function create(env) {
  let L, qs, i, right, streak, best, points, left, answered, box, auto;
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

  function start(level) {
    L = LEVELS[level];
    // a different set of numbers every time, so it cannot be memorized
    const base = rng((Date.now() & 0xfffffff) ^ (level * 7919)), R = Object.assign(() => base(), { int: (a, b) => a + Math.floor(base() * (b - a + 1)), pick: (arr) => arr[Math.floor(base() * arr.length)] });
    qs = Array.from({ length: QUESTIONS }, (_, k) => makeQuestion(L.kinds[k % L.kinds.length], R));
    if (L.kinds.length > 1) for (let k = qs.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [qs[k], qs[j]] = [qs[j], qs[k]]; }
    i = 0; right = 0; streak = 0; best = 0; points = 0;
    box = el('<div class="ym"></div>'); env.stage.appendChild(box);
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) pick(+b.dataset.pick); else if (e.target.closest('[data-next]')) next(); });
    env.onKey = (k) => { if (!answered && ['1', '2', '3', '4'].includes(k)) pick(+k - 1); else if (answered && (k === 'Enter' || k === ' ')) next(); };
    show();
  }
  function show() {
    const q = qs[i]; left = L.secs; answered = false; clearTimeout(auto);
    box.innerHTML = `
      <div class="ym-top"><span>Question ${i + 1} of ${QUESTIONS}</span><span class="ym-streak">${streak > 1 ? streak + ' in a row' : ''}</span><span>${right} right</span></div>
      <div class="ym-clock"><i></i></div>
      <div class="ym-card"><div class="ym-pic">${q.pic}</div><p class="ym-ask">${q.ask}</p></div>
      <div class="ym-choices">${q.choices.map((c, k) => `<button type="button" class="ym-choice" data-pick="${k}"><b>${fmt(c)}</b><span>${q.unit}</span></button>`).join('')}</div>
      <div class="ym-after" hidden></div>`;
  }
  function pick(k) {
    if (answered) return; answered = true;
    const q = qs[i], ok = k >= 0 && q.choices[k] === q.answer, after = box.querySelector('.ym-after');
    box.querySelectorAll('.ym-choice').forEach((b, idx) => { b.disabled = true; if (q.choices[idx] === q.answer) b.classList.add('is-right'); else if (idx === k) b.classList.add('is-wrong'); });
    if (ok) { right++; streak++; best = Math.max(best, streak); points += 100 + Math.round((left / L.secs) * 50) + Math.min(5, streak - 1) * 20; env.sfx('good'); }
    else { streak = 0; env.sfx('bad'); env.buzz(80); }
    after.hidden = false; after.className = 'ym-after ' + (ok ? 'is-right' : 'is-wrong');
    after.innerHTML = `<p><b>${ok ? 'Right.' : k < 0 ? 'Out of time.' : 'Not quite.'}</b> ${q.work}</p><button type="button" class="gk-btn gk-btn--go" data-next>${i === QUESTIONS - 1 ? 'See how you did' : 'Next question'}</button>`;
    after.querySelector('button').focus({ preventScroll: true });
    if (ok) auto = setTimeout(next, 2600);
  }
  function next() {
    if (!answered) return; clearTimeout(auto);
    if (++i < QUESTIONS) return show();
    const stars = right >= QUESTIONS ? 3 : right >= QUESTIONS - 1 ? 2 : right >= 5 ? 1 : 0;
    env.finish({ stars, score: points, headline: stars ? 'Numbers check out' : 'Measure twice', note: stars === 3 ? 'Every one right. You could figure a job from the truck seat.' : stars ? 'Close. Read how the math works on the ones you missed and run it again.' : 'You need 5 of 8 to pass. Read how the math works after each answer, then try again.', stats: [['Right', `${right} of ${QUESTIONS}`], ['Best streak', String(best)]] });
  }
  function update(dt) {
    if (answered) return;
    left -= dt; const bar = box.querySelector('.ym-clock i');
    if (bar) { bar.style.transform = `scaleX(${Math.max(0, left / L.secs)})`; bar.classList.toggle('is-low', left < 10); }
    if (left <= 0) pick(-1);
  }
  function draw() { const { ctx } = env; ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, env.W, env.H); }
  return { start, update, draw, destroy() { clearTimeout(auto); if (box) box.remove(); } };
}
