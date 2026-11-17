// The frame every game runs in: the full-screen panel, the level list, the lesson card before a level,
// the pause and results screens, sound, and the saved stars. Each game (haul.js, paver.js, roller.js,
// math.js) only has to draw itself and say when a level is over.
import * as store from './progress.js';

const ICON = {
  x: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  on: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 010 6M17.8 6.5a7.5 7.5 0 010 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
};
const STAR = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';
const starRow = (n, size = 18) => `<span class="gk-stars" aria-label="${n} of 3 stars">${[0, 1, 2].map((i) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${i < n ? 'on' : ''}" aria-hidden="true"><path d="${STAR}"/></svg>`).join('')}</span>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ----- sound: a few short tones made on the spot, no audio files -----
function makeSound() {
  let ac = null, on = true;
  try { on = localStorage.getItem('cgh-games-sound') !== 'off'; } catch {}
  const tone = (freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) => {
    if (!on || !ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
  };
  const noise = (dur, vol = 0.2) => {
    if (!on || !ac) return;
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol; src.buffer = buf; src.connect(f).connect(g).connect(ac.destination); src.start();
  };
  const sounds = {
    click: () => tone(520, 0.06, 'triangle', 0.08),
    pick: () => { tone(880, 0.08, 'triangle', 0.1); tone(1320, 0.1, 'triangle', 0.08, 0, 0.06); },
    good: () => { tone(660, 0.09, 'triangle', 0.1); tone(990, 0.14, 'triangle', 0.1, 0, 0.08); },
    bad: () => tone(200, 0.28, 'sawtooth', 0.1, -90),
    hit: () => { noise(0.3, 0.3); tone(110, 0.3, 'square', 0.1, -50); },
    warn: () => { tone(740, 0.1, 'square', 0.06); tone(740, 0.1, 'square', 0.06, 0, 0.18); },
    tick: () => tone(1000, 0.03, 'square', 0.04),
    move: () => tone(300, 0.07, 'triangle', 0.07, 120),
    pour: () => noise(0.12, 0.08),
    star: (i = 0) => tone(700 + i * 180, 0.16, 'triangle', 0.12),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.11, 0, i * 0.11)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, 0, i * 0.16)),
  };
  return {
    wake() { try { if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); } if (ac && ac.state === 'suspended') ac.resume(); } catch {} },
    play(name, arg) { try { sounds[name] && sounds[name](arg); } catch {} },
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem('cgh-games-sound', on ? 'on' : 'off'); } catch {} return on; },
  };
}

// Starts the game panel inside `root`. `meta` is the game's entry in catalog.ts; `load` fetches its code.
export function boot({ root, meta, load }) {
  const sound = makeSound();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML = `
    <div class="gk__bar">
      <button type="button" class="gk__ic" data-act="close" aria-label="Close the game">${ICON.x}</button>
      <p class="gk__title"><b>${esc(meta.name)}</b><span data-el="sub"></span></p>
      <button type="button" class="gk__ic" data-act="sound" aria-label="Sound on or off">${sound.on ? ICON.on : ICON.off}</button>
      <button type="button" class="gk__ic" data-act="pause" aria-label="Pause" hidden>${ICON.pause}</button>
    </div>
    <div class="gk__body"><div class="gk__col">
      <canvas class="gk__cv"></canvas>
      <div class="gk__stage"></div>
      <div class="gk__screen" data-screen></div>
    </div></div>`;
  const $ = (sel) => root.querySelector(sel);
  const col = $('.gk__col'), canvas = $('.gk__cv'), stage = $('.gk__stage'), screen = $('[data-screen]'), sub = $('[data-el=sub]'), pauseBtn = $('[data-act=pause]');
  const ctx = canvas.getContext('2d');

  let mod = null, game = null, level = 0, mode = 'idle', raf = 0, last = 0, opened = false;
  const keys = new Set();
  const env = {
    canvas, ctx, stage, W: 0, H: 0, keys, reduced,
    sfx: (name, arg) => sound.play(name, arg),
    buzz: (ms) => { try { if (navigator.vibrate && !reduced) navigator.vibrate(ms); } catch {} },
    // Swipes and taps on the play area. cb('left' | 'right' | 'up' | 'down') or cb('tap', x, y).
    onSwipe: null,
    // Finger or mouse position while it is down on the play area (for dragging), or null.
    pointer: null,
    onKey: null,
    finish,
  };

  function size() {
    const r = col.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    env.W = Math.max(280, Math.round(r.width)); env.H = Math.max(360, Math.round(r.height));
    canvas.width = Math.round(env.W * dpr); canvas.height = Math.round(env.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (r.height < 330 && mode === 'play') pause();   // a phone turned on its side: too short to play
    if (game && game.resize) game.resize();
    if (game && mode !== 'play') game.draw();
  }
  new ResizeObserver(size).observe(col);

  // ----- input -----
  let down = null;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { if (mode !== 'play') return; e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {} down = { ...pos(e), t: performance.now(), swiped: false }; env.pointer = pos(e); });
  canvas.addEventListener('pointermove', (e) => {
    if (!down || mode !== 'play') return; const p = pos(e); env.pointer = p;
    // a swipe fires as soon as the finger has moved far enough, without waiting for it to lift
    const dx = p.x - down.x, dy = p.y - down.y;
    if (!down.swiped && env.onSwipe && Math.max(Math.abs(dx), Math.abs(dy)) > 26) { down.swiped = true; env.onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'); }
  });
  const lift = (e) => { if (!down) return; const p = pos(e); if (mode === 'play' && !down.swiped && env.onSwipe && performance.now() - down.t < 400) env.onSwipe('tap', p.x, p.y); down = null; env.pointer = null; };
  canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', () => { down = null; env.pointer = null; });
  const NAVKEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '];
  window.addEventListener('keydown', (e) => {
    if (!opened) return;
    if (e.key === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); else close(); return; }
    if (mode !== 'play') return;
    if (NAVKEYS.includes(e.key) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
    if (!keys.has(e.key)) { keys.add(e.key); if (env.onKey) env.onKey(e.key); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

  // ----- the loop -----
  function frame(t) {
    if (mode !== 'play') return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    game.update(dt); if (mode === 'play') game.draw();
    raf = requestAnimationFrame(frame);
  }
  const run = () => { mode = 'play'; pauseBtn.hidden = false; screen.hidden = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };

  // ----- screens -----
  function show(html, cls = '') { screen.className = 'gk__screen ' + cls; screen.innerHTML = html; screen.hidden = false; screen.scrollTop = 0; const f = screen.querySelector('[data-focus]'); if (f) f.focus({ preventScroll: true }); }
  function levels() {
    mode = 'levels'; pauseBtn.hidden = true; stage.innerHTML = ''; sub.textContent = meta.machine;
    if (game && game.destroy) game.destroy(); game = null; ctx.clearRect(0, 0, env.W, env.H);
    const p = store.local(), open = store.open(p, meta.id), got = store.stars(p, meta.id);
    show(`
      <div class="gk-pad">
        <p class="gk-eyebrow">${esc(meta.machine)}</p>
        <h2 class="gk-h">${esc(meta.name)}</h2>
        <p class="gk-lede">${esc(meta.tagline)}</p>
        <div class="gk-grid">${meta.levels.map((l, i) => {
          const s = p[meta.id].s[i] || 0, locked = i >= open;
          return `<button type="button" class="gk-lv ${locked ? 'is-locked' : ''} ${i === open - 1 && !s ? 'is-next' : ''}" data-level="${i}" ${locked ? 'disabled' : ''} ${i === open - 1 ? 'data-focus' : ''}><span class="gk-lv__n">${locked ? ICON.lock : i + 1}</span><span class="gk-lv__name">${esc(l.name)}</span>${locked ? '<span class="gk-lv__lock">Pass level ' + i + ' to open</span>' : starRow(s, 16)}</button>`;
        }).join('')}</div>
        <p class="gk-count">${got} of ${meta.levels.length * 3} stars${p[meta.id].b ? ' · best score ' + p[meta.id].b.toLocaleString('en-US') : ''}</p>
        <details class="gk-how"><summary>How to play</summary><ul>${meta.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></details>
        ${store.who() ? `<p class="gk-save">Signed in as <b>${esc(store.who().name)}</b>. Your levels are saved.</p>` : '<p class="gk-save">Your levels are saved on this device. <a href="/games#save">Sign in</a> to keep them everywhere.</p>'}
      </div>`, 'is-levels');
  }
  async function brief(i) {
    level = i; mode = 'brief'; pauseBtn.hidden = true; sub.textContent = `Level ${i + 1} of ${meta.levels.length}`;
    const l = meta.levels[i];
    show(`
      <div class="gk-pad gk-pad--mid">
        <p class="gk-eyebrow">Level ${i + 1} · ${esc(meta.name)}</p>
        <h2 class="gk-h">${esc(l.name)}</h2>
        <div class="gk-lesson"><p class="gk-lesson__k">Know this first</p><p>${esc(l.lesson)}</p></div>
        <ul class="gk-tips">${meta.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <div class="gk-btns"><button type="button" class="gk-btn gk-btn--go" data-act="start" data-focus>Start</button><button type="button" class="gk-btn" data-act="levels">Levels</button></div>
      </div>`, 'is-brief');
    if (!mod) { try { mod = await load(); } catch { show('<div class="gk-pad gk-pad--mid"><h2 class="gk-h">The game did not load</h2><p class="gk-lede">Check your connection and try again.</p><div class="gk-btns"><button type="button" class="gk-btn gk-btn--go" data-act="levels">Back</button></div></div>'); } }
  }
  function start() {
    if (!mod) return;
    sound.wake(); sound.play('click');
    if (game && game.destroy) game.destroy();
    stage.innerHTML = ''; keys.clear(); env.onSwipe = null; env.onKey = null; env.pointer = null;
    game = mod.create(env); game.start(level);
    run();
  }
  function pause() {
    if (mode !== 'play') return; mode = 'pause'; cancelAnimationFrame(raf); pauseBtn.hidden = true; keys.clear();
    show(`<div class="gk-pad gk-pad--mid"><h2 class="gk-h">Paused</h2><div class="gk-btns gk-btns--stack"><button type="button" class="gk-btn gk-btn--go" data-act="resume" data-focus>Keep going</button><button type="button" class="gk-btn" data-act="retry">Start this level over</button><button type="button" class="gk-btn" data-act="levels">Levels</button></div></div>`, 'is-pause');
  }
  const resume = () => { if (mode === 'pause') run(); };
  // A game calls this when the level is over. stars 0 means it was not passed.
  function finish({ stars = 0, score = 0, headline, note = '', stats = [] }) {
    if (mode !== 'play') return;
    mode = 'result'; cancelAnimationFrame(raf); pauseBtn.hidden = true; keys.clear(); game.draw();
    stars = Math.max(0, Math.min(3, stars | 0));
    if (stars > 0) store.record(meta.id, level, stars, score);
    const lastLevel = level === meta.levels.length - 1, won = stars > 0;
    show(`
      <div class="gk-pad gk-pad--mid">
        <p class="gk-eyebrow">Level ${level + 1} · ${esc(meta.levels[level].name)}</p>
        <h2 class="gk-h">${esc(headline || (won ? 'Level passed' : 'Not this time'))}</h2>
        <div class="gk-bigstars">${starRow(stars, 46)}</div>
        ${note ? `<p class="gk-lede">${esc(note)}</p>` : ''}
        <dl class="gk-stats">${stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}<div><dt>Score</dt><dd>${Math.round(score).toLocaleString('en-US')}</dd></div></dl>
        <div class="gk-lesson gk-lesson--sm"><p class="gk-lesson__k">Remember</p><p>${esc(meta.levels[level].lesson)}</p></div>
        <div class="gk-btns">${won && !lastLevel ? '<button type="button" class="gk-btn gk-btn--go" data-act="next" data-focus>Next level</button>' : ''}<button type="button" class="gk-btn ${won && !lastLevel ? '' : 'gk-btn--go'}" data-act="retry" ${won && !lastLevel ? '' : 'data-focus'}>${won ? 'Play again' : 'Try again'}</button><button type="button" class="gk-btn" data-act="levels">Levels</button></div>
        ${won && lastLevel ? `<p class="gk-save">That is every level of ${esc(meta.name)}. <a href="/games">Try another game</a>.</p>` : ''}
        ${won && level >= 2 ? '<p class="gk-save">Rather do this for real? <a href="/careers">CGH is hiring</a>.</p>' : ''}
        ${store.who() ? '' : '<p class="gk-save"><a href="/games#save">Sign in</a> to keep your levels on any phone or computer.</p>'}
      </div>`, 'is-result ' + (won ? 'is-won' : 'is-lost'));
    sound.play(won ? 'win' : 'lose');
    if (won && !reduced) screen.querySelectorAll('.gk-bigstars svg.on').forEach((s, i) => { s.style.animationDelay = 0.25 + i * 0.22 + 's'; });
  }

  function openPanel() {
    if (opened) return; opened = true; root.hidden = false; document.documentElement.classList.add('gk-open');
    size(); levels(); store.session().then(() => { if (mode === 'levels') levels(); });
  }
  function close() {
    if (!opened) return; opened = false; mode = 'idle'; cancelAnimationFrame(raf);
    if (game && game.destroy) game.destroy(); game = null; stage.innerHTML = '';
    root.hidden = true; document.documentElement.classList.remove('gk-open');
    if (location.hash === '#play') history.replaceState(null, '', location.pathname);
    root.dispatchEvent(new CustomEvent('gk:close'));
  }

  root.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-level]'); if (lv && !lv.disabled) { sound.wake(); sound.play('click'); brief(+lv.dataset.level); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') close();
    else if (act === 'sound') { const on = sound.toggle(); b.innerHTML = on ? ICON.on : ICON.off; if (on) { sound.wake(); sound.play('click'); } }
    else if (act === 'pause') pause();
    else if (act === 'resume') resume();
    else if (act === 'start' || act === 'retry') start();
    else if (act === 'next') brief(level + 1);
    else if (act === 'levels') levels();
  });

  // For testing only: with ?debug in the address, the running game can be inspected from the browser console.
  if (/[?&]debug\b/.test(location.search)) window.__cghGame = { get game() { return game; }, get mode() { return mode; }, env };
  return { open: openPanel, close };
}

// ----- small drawing helpers shared by the games -----
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// A repeatable random number maker, so a level lays out the same way every time.
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FONT = '"Overpass Variable", Overpass, system-ui, sans-serif';
export const font = (px, weight = 800) => `${weight} ${px}px ${FONT}`;
// A rounded label on the play area: a small caption over a big value.
export function pill(ctx, x, y, w, label, value, opts = {}) {
  const h = 44;
  rr(ctx, x, y, w, h, 10); ctx.fillStyle = opts.bg || 'rgba(11,18,32,0.78)'; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = opts.edge || 'rgba(255,255,255,0.14)'; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(207,215,226,0.85)'; ctx.font = font(10, 700); ctx.fillText(label.toUpperCase(), x + 10, y + 16);
  ctx.fillStyle = opts.color || '#fff'; ctx.font = font(19, 800); ctx.fillText(value, x + 10, y + 36);
}
// A thin progress bar.
export function bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.16)') {
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = back; ctx.fill();
  if (frac > 0.005) { rr(ctx, x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2); ctx.fillStyle = color; ctx.fill(); }
}
// A short message that floats in the middle of the play area for a moment ("Work zone ahead").
export function banner(ctx, W, y, text, color = '#fff', bg = 'rgba(11,18,32,0.85)') {
  ctx.font = font(17, 800); const w = Math.min(W - 24, ctx.measureText(text).width + 36);
  rr(ctx, (W - w) / 2, y, w, 38, 19); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, y + 20, w - 20);
}
