// The draw-on-a-map screen, used by the website quote tool and by the team inside the app.
//
// Plain version: it opens a satellite map over the whole window. The person finds their place
// (types an address, or taps "Use my location", or just slides the map), then taps a dot on each
// corner of the area. The area fills in as they tap and the square feet show at the bottom.
// For a long driveway or road they can instead tap along the middle of it and pick how wide it is.
// Pressing Done hands the drawing and its size back to whatever opened the map.
//
// Nothing is saved from in here. The quote tool and the app decide what to do with the result.
// The map pictures come from the sources listed in src/data/map.ts.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/mapdraw.css';
import { shapeSqft, shapeFt, stripOutline, totalSqft } from '../../netlify/functions/lib/geo.mjs';
import { MAP } from '../data/map';

export type Shape = { kind: 'area' | 'line'; pts: [number, number][]; width_ft?: number; sqft?: number; ft?: number };
export type MapResult = { shapes: Shape[]; sqft: number; address: string; center: [number, number]; zoom: number };
export type MapOptions = {
  /** Team members get extra read-outs (square yards, feet around) and can type any width. */
  staff?: boolean;
  /** An address to look up as soon as the map opens. */
  address?: string;
  /** A drawing to open with (to look at or change). */
  map?: Partial<MapResult> | null;
  title?: string;
  doneLabel?: string;
  /** Let Done be pressed with nothing drawn (used by the team to clear a drawing or just look). */
  allowEmpty?: boolean;
};

const WIDTHS = [10, 12, 14, 16, 20];
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
// Dots are kept to the nearest half inch or so, so the size on screen is exactly the size that gets saved.
const snap = (ll: { lat: number; lng: number }): [number, number] => [Math.round(ll.lat * 1e7) / 1e7, Math.round(ll.lng * 1e7) / 1e7];
const WORLD = 20037508.342789244; // half the width of the web map, in meters

// Asks an ArcGIS "image server" for one square of ground at a time, so it can be used like ordinary map tiles.
const ArcImageLayer = (L.TileLayer as any).extend({
  getTileUrl(this: any, c: { x: number; y: number; z: number }) {
    const px = this.getTileSize().x, span = (2 * WORLD) / ((256 * 2 ** c.z) / px);
    const x0 = -WORLD + c.x * span, y1 = WORLD - c.y * span;
    return `${this._url}?bbox=${x0},${y1 - span},${x0 + span},${y1}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=jpg&interpolation=RSP_BilinearInterpolation&f=image`;
  },
});

let openNow = false;

export function openMapDraw(opts: MapOptions = {}): Promise<MapResult | null> {
  if (openNow) return Promise.resolve(null);
  openNow = true;
  return new Promise((resolve) => {
    const staff = !!opts.staff;
    const el = document.createElement('div');
    el.className = 'md'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', opts.title || 'Draw your area on the map');
    el.innerHTML = `
      <div class="md__top"><b class="md__title"></b><button type="button" class="md__x" data-md="close">Close</button></div>
      <form class="md__find" data-md="find" novalidate>
        <input type="search" data-md="q" aria-label="Address" autocomplete="street-address" enterkeyhint="search" placeholder="Type the address" />
        <button class="md__btn">Find</button>
        <button type="button" class="md__here" data-md="here">Or use my location</button>
      </form>
      <div class="md__results" data-md="results" aria-live="polite"></div>
      <div class="md__mapwrap">
        <div class="md__map" data-md="map"></div>
        <p class="md__hint" data-md="hint" role="status"></p>
        <div class="md__zoom"><button type="button" data-md="in" aria-label="Zoom in">+</button><button type="button" data-md="out" aria-label="Zoom out">&minus;</button></div>
      </div>
      <div class="md__bar">
        <div class="md__row" role="group" aria-label="What to draw">
          <button type="button" class="md__chip on" data-md="tool" data-tool="area">Outline an area</button>
          <button type="button" class="md__chip" data-md="tool" data-tool="line">Trace a long drive</button>
        </div>
        <div class="md__row md__row--tight" data-md="widthrow" hidden><span>Width</span>${WIDTHS.map((w) => `<button type="button" class="md__chip" data-md="width" data-w="${w}">${w} ft</button>`).join('')}${staff ? '<input data-md="widthbox" inputmode="decimal" aria-label="Width in feet" placeholder="ft" />' : ''}</div>
        <div class="md__row" data-md="shapes" hidden></div>
        <p class="md__read" data-md="read" aria-live="polite"></p>
        <div class="md__acts"><button type="button" data-md="undo">Undo</button><button type="button" data-md="clear">Start over</button><button type="button" class="md__done" data-md="done"></button></div>
        <button type="button" class="md__more" data-md="add" hidden>+ Add another area</button>
      </div>`;
    const $ = <T extends HTMLElement = HTMLElement>(k: string) => el.querySelector<T>(`[data-md="${k}"]`)!;
    el.querySelector('.md__title')!.textContent = opts.title || 'Draw it on the map';
    $('done').textContent = opts.doneLabel || 'Done';
    document.body.append(el); document.documentElement.classList.add('md-open');

    // ---------- the map and its three picture layers ----------
    const start = opts.map?.center ? { lat: opts.map.center[0], lng: opts.map.center[1], zoom: opts.map.zoom || 19 } : MAP.start;
    const map = L.map($('map'), { center: [start.lat, start.lng], zoom: start.zoom, minZoom: 5, maxZoom: MAP.maxZoom, zoomControl: false, doubleClickZoom: false, attributionControl: true, tap: false } as any);
    map.attributionControl.setPrefix(false);
    const far = L.tileLayer(MAP.far.url, { maxNativeZoom: MAP.far.maxNativeZoom, maxZoom: MAP.maxZoom, attribution: MAP.far.credit }).addTo(map);
    new ArcImageLayer(MAP.close.url, { minZoom: MAP.close.minZoom, maxZoom: MAP.maxZoom, tileSize: 512, zoomOffset: -1, attribution: MAP.close.credit, keepBuffer: 1 }).addTo(map);
    // Road names over the close-up photo: one picture for the whole view, asked for again whenever the map stops moving.
    let names: any = null, namesTimer = 0, namesSeq = 0;
    const refreshNames = () => {
      clearTimeout(namesTimer);
      namesTimer = window.setTimeout(() => {
        const seq = ++namesSeq;
        if (map.getZoom() < MAP.names.minZoom) { if (names) { names.remove(); names = null; } return; }
        const b = map.getBounds(), size = map.getSize(), sw = L.CRS.EPSG3857.project(b.getSouthWest()), ne = L.CRS.EPSG3857.project(b.getNorthEast());
        const url = `${MAP.names.url}?bbox=${sw.x},${sw.y},${ne.x},${ne.y}&bboxSR=3857&imageSR=3857&size=${Math.min(2048, Math.round(size.x))},${Math.min(2048, Math.round(size.y))}&dpi=96&format=png32&transparent=true&layers=${encodeURIComponent(MAP.names.layers)}&f=image`;
        const img = new Image();
        img.onload = () => { if (seq !== namesSeq || closed) return; const next = L.imageOverlay(url, b, { interactive: false, attribution: MAP.names.credit }).addTo(map); if (names) names.remove(); names = next; };
        img.src = url;
      }, 350);
    };
    map.on('moveend', refreshNames);
    // If the pictures never arrive (no signal, or the map service is down), say so instead of showing a blank grey box.
    let loaded = 0, failed = 0, warned = false;
    far.on('tileload', () => { loaded++; });
    far.on('tileerror', () => { failed++; if (!loaded && failed >= 6 && !warned) { warned = true; setHint('The satellite picture is not loading right now. Press Close and type your size instead.', true); } });

    // ---------- the drawing ----------
    let shapes: Shape[] = (opts.map?.shapes || []).filter((s) => s && Array.isArray(s.pts) && s.pts.length).map((s) => ({ kind: s.kind === 'line' ? 'line' : 'area', pts: s.pts.map((p) => [p[0], p[1]] as [number, number]), ...(s.kind === 'line' ? { width_ft: Number(s.width_ft) || 0 } : {}) }));
    let active = shapes.length - 1;            // which shape the dots belong to (-1 = none yet)
    let tool: 'area' | 'line' = active >= 0 ? shapes[active].kind : 'area';
    let width = active >= 0 && shapes[active].kind === 'line' ? shapes[active].width_ft || 12 : 12;
    let address = opts.map?.address || '';
    let closed = false, placed = shapes.length > 0, dragging = false;
    const drawn = L.layerGroup().addTo(map), dots = L.layerGroup().addTo(map);
    const enough = (s: Shape) => s.pts.length >= (s.kind === 'line' ? 2 : 3);
    const cur = () => (active >= 0 ? shapes[active] : null);
    const LIVE = { color: '#19e3e8', weight: 3, fillColor: '#19e3e8', fillOpacity: 0.3 }, REST = { color: '#ffffff', weight: 2, fillColor: '#ffffff', fillOpacity: 0.18 };

    function setHint(text: string, warn = false) { const h = $('hint'); if (warned && !warn) return; h.textContent = text; h.classList.toggle('is-warn', warn); h.hidden = !text; }
    function paintShapes() {
      drawn.clearLayers();
      shapes.forEach((s, i) => {
        const style = i === active ? LIVE : REST;
        if (s.kind === 'area') { if (s.pts.length >= 3) L.polygon(s.pts, style).addTo(drawn); else if (s.pts.length === 2) L.polyline(s.pts, style).addTo(drawn); }
        else { const strip = stripOutline(s.pts, s.width_ft || 0); if (strip.length) L.polygon(strip, { ...style, weight: 1 }).addTo(drawn); if (s.pts.length >= 2) L.polyline(s.pts, { ...style, dashArray: '6 6' }).addTo(drawn); }
      });
    }
    function paintDots() {
      dots.clearLayers(); const s = cur(); if (!s) return;
      s.pts.forEach((p, i) => {
        const mk = L.marker(p, { draggable: true, autoPan: true, icon: L.divIcon({ className: '', html: `<span class="md-dot">${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }), title: `Dot ${i + 1}. Drag to move it.` } as any).addTo(dots);
        mk.on('dragstart', () => { dragging = true; });
        mk.on('drag', (e: any) => { s.pts[i] = snap(e.latlng); paintShapes(); paintRead(); });
        mk.on('dragend', () => { setTimeout(() => { dragging = false; }, 60); });
      });
    }
    function paintRead() {
      const total = totalSqft(shapes), s = cur(), read = $('read'), done = shapes.filter(enough);
      let main = '', sub = '';
      if (s && enough(s)) {
        const a = shapeSqft(s), ft = shapeFt(s);
        if (s.kind === 'line') { main = s.width_ft ? `About ${fmt(a)} sq ft` : `${fmt(ft)} ft long`; sub = s.width_ft ? `${fmt(ft)} ft long × ${s.width_ft} ft wide${staff ? ` · ${fmt(a / 9)} sq yd` : ''}` : 'Pick a width to turn it into square feet'; }
        else { main = `About ${fmt(a)} sq ft`; if (staff) sub = `${fmt(a / 9)} sq yd · ${fmt(ft)} ft around`; }
      } else if (s && s.pts.length) main = s.kind === 'line' ? 'Tap the other end' : `${3 - s.pts.length} more ${3 - s.pts.length === 1 ? 'corner' : 'corners'} to go`;
      if (done.length > 1) sub = `${sub ? sub + ' · ' : ''}All ${done.length} together: ${fmt(total)} sq ft`;
      read.innerHTML = ''; read.append(main); if (sub) { const sm = document.createElement('small'); sm.textContent = sub; read.append(sm); }
      const row = $('shapes'); row.hidden = shapes.length < 2; row.innerHTML = '';
      if (shapes.length > 1) shapes.forEach((sh, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'md__chip' + (i === active ? ' on' : ''); b.dataset.md = 'pick'; b.dataset.i = String(i); b.textContent = `${sh.kind === 'line' ? 'Drive' : 'Area'} ${i + 1}`; const n = document.createElement('i'); n.textContent = enough(sh) && shapeSqft(sh) ? `${fmt(shapeSqft(sh))} sq ft` : ''; b.append(n); row.append(b); });
      $<HTMLButtonElement>('undo').disabled = !s || !s.pts.length;
      $<HTMLButtonElement>('clear').disabled = !shapes.length;
      $<HTMLButtonElement>('done').disabled = !opts.allowEmpty && !(total >= 1 || (staff && done.length > 0));
      $('add').hidden = !(s && enough(s));
      $('add').textContent = tool === 'line' ? '+ Add another drive or area' : '+ Add another area';
    }
    function paintTools() {
      el.querySelectorAll<HTMLElement>('[data-md="tool"]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
      $('widthrow').hidden = tool !== 'line';
      el.querySelectorAll<HTMLElement>('[data-md="width"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.w) === width));
    }
    function paintHint() {
      const s = cur(), n = s ? s.pts.length : 0;
      if (!placed && !n) return setHint('First, find the place. Type the address above, or slide the map and tap to zoom in.');
      if (map.getZoom() < MAP.drawZoom && !n) return setHint('Tap the map to zoom in closer.');
      if (tool === 'line') return setHint(n === 0 ? 'Tap one end of the driveway, right in the middle of it.' : n === 1 ? 'Now tap along the middle of it, all the way to the other end.' : 'Keep tapping along it, or press Done. Drag a dot to move it.');
      setHint(n === 0 ? 'Tap each corner of the area you want paved. Go around it like connect-the-dots.' : n < 3 ? 'Good. Tap the next corner.' : 'Tap more corners, or press Done. Drag a dot to move it.');
    }
    const paint = () => { paintShapes(); paintDots(); paintRead(); paintTools(); paintHint(); };

    map.on('click', (e: any) => {
      if (dragging) return;
      // Too far out to draw accurately: a tap brings the map closer instead of dropping a dot.
      if (map.getZoom() < MAP.drawZoom) { placed = true; map.setView(e.latlng, Math.min(MAP.drawZoom + 2, map.getZoom() + 3)); return; }
      let s = cur();
      if (!s || s.kind !== tool) { s = tool === 'line' ? { kind: 'line', pts: [], width_ft: width } : { kind: 'area', pts: [] }; shapes.push(s); active = shapes.length - 1; }
      if (s.pts.length >= 80) return;
      s.pts.push(snap(e.latlng)); paint();
    });
    map.on('zoomend', paintHint);

    // ---------- finding the place ----------
    const results = $('results');
    const goTo = (lat: number, lng: number, label: string, exact = true) => { placed = true; if (label) { address = label; $<HTMLInputElement>('q').value = label; } results.innerHTML = ''; $('here').hidden = true; map.setView([lat, lng], exact ? 19 : 16); paintHint(); };
    const say = (text: string) => { results.innerHTML = ''; const p = document.createElement('p'); p.textContent = text; results.append(p); };
    async function find(q: string) {
      q = q.trim(); if (q.length < 3) return say('Type the street address or the town, then press Find.');
      const btn = el.querySelector<HTMLButtonElement>('.md__find .md__btn')!; btn.disabled = true; btn.textContent = 'Looking…';
      try {
        const r = await fetch('/api/geocode?q=' + encodeURIComponent(q)); const j = await r.json().catch(() => ({}));
        if (closed) return;
        const list: { label: string; lat: number; lng: number; exact?: boolean }[] = j.results || [];
        if (!r.ok) say(j.error || 'The address search is not answering. Slide the map to your place instead.');
        else if (!list.length) say('We could not find that address. Try just the town, then slide the map to your place.');
        else if (list.length === 1) goTo(list[0].lat, list[0].lng, list[0].label, list[0].exact !== false);
        else { results.innerHTML = ''; const p = document.createElement('p'); p.textContent = 'Which one is it?'; results.append(p); list.forEach((x) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = x.label; b.addEventListener('click', () => goTo(x.lat, x.lng, x.label, x.exact !== false)); results.append(b); }); }
      } catch { say('The address search is not answering. Slide the map to your place instead.'); }
      btn.disabled = false; btn.textContent = 'Find';
    }
    $<HTMLFormElement>('find').addEventListener('submit', (e) => { e.preventDefault(); $<HTMLInputElement>('q').blur(); find($<HTMLInputElement>('q').value); });

    function finish(result: MapResult | null) {
      if (closed) return; closed = true; openNow = false;
      clearTimeout(namesTimer); removeEventListener('keydown', onKey);
      try { map.stop(); map.remove(); } catch {} el.remove(); document.documentElement.classList.remove('md-open');
      resolve(result);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(null); };
    addEventListener('keydown', onKey);

    el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-md]'); if (!t) return;
      const k = t.dataset.md;
      if (k === 'close') return finish(null);
      if (k === 'in') return void map.zoomIn();
      if (k === 'out') return void map.zoomOut();
      if (k === 'here') {
        if (!navigator.geolocation) return say('This phone will not share its location. Type the address instead.');
        t.textContent = 'Finding you…';
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (!closed) goTo(pos.coords.latitude, pos.coords.longitude, '', true); },
          () => { t.textContent = 'Or use my location'; say('Your phone did not share its location. Type the address instead.'); },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
        );
        return;
      }
      if (k === 'tool') {
        tool = t.dataset.tool as 'area' | 'line';
        const s = cur();
        // An unfinished shape of the other kind is dropped; a finished one stays and a new shape starts on the next tap.
        if (s && s.kind !== tool) { if (!enough(s)) shapes.splice(active, 1); active = -1; }
        return paint();
      }
      if (k === 'width') { width = Number(t.dataset.w); const s = cur(); if (s && s.kind === 'line') s.width_ft = width; const box = el.querySelector<HTMLInputElement>('[data-md="widthbox"]'); if (box) box.value = ''; return paint(); }
      if (k === 'pick') { const i = Number(t.dataset.i); const s = cur(); if (s && !enough(s) && active !== i) { shapes.splice(active, 1); active = i > active ? i - 1 : i; } else active = i; tool = shapes[active].kind; if (tool === 'line') width = shapes[active].width_ft || 0; return paint(); }
      if (k === 'undo') { const s = cur(); if (!s) return; s.pts.pop(); if (!s.pts.length) { shapes.splice(active, 1); active = -1; } return paint(); }
      if (k === 'clear') { shapes = []; active = -1; return paint(); }
      if (k === 'add') { active = -1; paint(); return setHint(tool === 'line' ? 'Tap one end of the next one.' : 'Tap the first corner of the next area.'); }
      if (k === 'done') {
        const keep = shapes.filter(enough).map((s) => ({ ...s, sqft: Math.round(shapeSqft(s)), ft: Math.round(shapeFt(s)) }));
        const c = map.getCenter();
        return finish({ shapes: keep, sqft: Math.round(totalSqft(keep)), address, center: [Math.round(c.lat * 1e6) / 1e6, Math.round(c.lng * 1e6) / 1e6], zoom: map.getZoom() });
      }
    });
    el.querySelector<HTMLInputElement>('[data-md="widthbox"]')?.addEventListener('input', (e) => { const v = parseFloat((e.target as HTMLInputElement).value); width = Number.isFinite(v) && v >= 0 ? Math.min(200, v) : 0; const s = cur(); if (s && s.kind === 'line') s.width_ft = width; paintShapes(); paintRead(); el.querySelectorAll<HTMLElement>('[data-md="width"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.w) === width)); });

    // ---------- opening view ----------
    if (address) $<HTMLInputElement>('q').value = address;
    const all = shapes.flatMap((s) => s.pts);
    if (all.length) { map.fitBounds(L.latLngBounds(all).pad(0.35), { maxZoom: 20 }); $('here').hidden = true; }
    else if (opts.address && !opts.map?.center) { $<HTMLInputElement>('q').value = opts.address; find(opts.address); }
    paint(); refreshNames();
    setTimeout(() => { if (!closed) map.invalidateSize(); }, 60);
    // The bottom bar grows and shrinks (width buttons, list of areas). Keep the map filling whatever room is left.
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { if (closed) ro.disconnect(); else map.invalidateSize(); }); ro.observe($('map')); }
    else addEventListener('resize', () => { if (!closed) map.invalidateSize(); });
  });
}
