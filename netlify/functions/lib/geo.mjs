// Map math: how many square feet a shape drawn on the map covers.
//
// Plain version: a customer (or one of our crew) taps dots around an area on the satellite map.
// Each dot is a latitude and longitude. This file turns those dots into square feet and feet.
// The same file is used by the website, the app and the server, so all three always agree.
//
// Two kinds of shape:
//   area - dots around the outside of a patch of ground. Size = what is inside the dots.
//   line - dots along the middle of a long driveway or road, plus a width. Size = length x width.

const R = 6378137; // the earth's radius in meters
const rad = (d) => (d * Math.PI) / 180;
const SQFT_PER_SQM = 10.7639104, FT_PER_M = 3.2808399;

// Flattens a handful of nearby points onto a sheet of paper measured in meters.
// Accurate to a fraction of a percent for anything the size of a job site.
export function toMeters(pts) {
  if (!pts.length) return [];
  const lat0 = pts.reduce((t, p) => t + p[0], 0) / pts.length, lng0 = pts.reduce((t, p) => t + p[1], 0) / pts.length;
  const k = Math.cos(rad(lat0));
  return pts.map(([lat, lng]) => [R * rad(lng - lng0) * k, R * rad(lat - lat0)]);
}
export function areaSqft(pts) {
  if (!pts || pts.length < 3) return 0;
  const m = toMeters(pts); let sum = 0;
  for (let i = 0; i < m.length; i++) { const a = m[i], b = m[(i + 1) % m.length]; sum += a[0] * b[1] - b[0] * a[1]; }
  return (Math.abs(sum) / 2) * SQFT_PER_SQM;
}
export function lengthFt(pts, closed = false) {
  if (!pts || pts.length < 2) return 0;
  let total = 0; const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total * FT_PER_M;
}
// Square feet of one shape. A line with no width is only a distance, so it adds no area.
export const shapeSqft = (s) => (s.kind === 'line' ? lengthFt(s.pts) * (Number(s.width_ft) || 0) : areaSqft(s.pts));
// Feet of one shape: the length of a line, or the distance around an area.
export const shapeFt = (s) => lengthFt(s.pts, s.kind !== 'line');
export const totalSqft = (shapes) => (shapes || []).reduce((t, s) => t + shapeSqft(s), 0);

// The outline of a line once it is given its width, for drawing the strip on the map.
export function stripOutline(pts, widthFt) {
  if (!pts || pts.length < 2 || !(widthFt > 0)) return [];
  const lat0 = pts.reduce((t, p) => t + p[0], 0) / pts.length, lng0 = pts.reduce((t, p) => t + p[1], 0) / pts.length, k = Math.cos(rad(lat0));
  const m = toMeters(pts), half = widthFt / FT_PER_M / 2, left = [], right = [];
  for (let i = 0; i < m.length; i++) {
    const prev = m[Math.max(0, i - 1)], next = m[Math.min(m.length - 1, i + 1)];
    let dx = next[0] - prev[0], dy = next[1] - prev[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    left.push([m[i][0] - dy * half, m[i][1] + dx * half]); right.push([m[i][0] + dy * half, m[i][1] - dx * half]);
  }
  return [...left, ...right.reverse()].map(([x, y]) => [lat0 + (y / R) * (180 / Math.PI), lng0 + (x / (R * k)) * (180 / Math.PI)]);
}

// Checks a drawing that arrived from a browser before it is saved. Anything odd is dropped, never trusted.
// Sizes are worked out again here, so a browser cannot claim a size its dots do not cover.
export function cleanMap(raw) {
  let m = raw;
  if (typeof raw === 'string') { if (raw.length > 60000) return null; try { m = JSON.parse(raw); } catch { return null; } }
  if (!m || typeof m !== 'object' || !Array.isArray(m.shapes)) return null;
  const pt = (p) => { const lat = Number(p?.[0]), lng = Number(p?.[1]); return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [Math.round(lat * 1e7) / 1e7, Math.round(lng * 1e7) / 1e7] : null; };
  const shapes = [];
  for (const s of m.shapes.slice(0, 8)) {
    const kind = s?.kind === 'line' ? 'line' : 'area';
    const pts = (Array.isArray(s?.pts) ? s.pts.slice(0, 80) : []).map(pt).filter(Boolean);
    if (pts.length < (kind === 'line' ? 2 : 3)) continue;
    const shape = { kind, pts };
    if (kind === 'line') shape.width_ft = Math.min(200, Math.max(0, Math.round((Number(s.width_ft) || 0) * 10) / 10));
    shape.sqft = Math.round(shapeSqft(shape)); shape.ft = Math.round(shapeFt(shape));
    shapes.push(shape);
  }
  if (!shapes.length) return null;
  const out = { shapes, sqft: Math.round(totalSqft(shapes)), at: Date.now() };
  const c = pt(m.center); if (c) out.center = c;
  const z = Number(m.zoom); if (Number.isFinite(z)) out.zoom = Math.min(22, Math.max(3, Math.round(z)));
  const addr = String(m.address ?? '').trim().slice(0, 200); if (addr) out.address = addr;
  return out;
}
// One short line for a lead note or an alert: "2 areas drawn on the map, 1,850 sq ft".
export function describeMap(map) {
  if (!map || !map.shapes?.length) return '';
  const areas = map.shapes.filter((s) => s.kind !== 'line').length, lines = map.shapes.length - areas;
  const parts = []; if (areas) parts.push(`${areas} area${areas > 1 ? 's' : ''}`); if (lines) parts.push(`${lines} traced drive${lines > 1 ? 's' : ''}`);
  return `${parts.join(' and ')} drawn on the map, ${map.sqft.toLocaleString('en-US')} sq ft`;
}
