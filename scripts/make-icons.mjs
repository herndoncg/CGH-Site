// Builds every site and app icon from the CGH badge (the hexagon with the cross on the mountain).
// White badge on the site navy, so it shows on light and dark browser tabs alike.
// Run after changing the badge: node scripts/make-icons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const ROOT = new URL('../public/', import.meta.url).pathname, BADGE = ROOT + 'img/brand/cgh-badge-white.png', NAVY = '#0b1220';
// size: pixels. round: corner rounding as a share of the size (0 = square). fill: how much of the height the badge takes.
// crisp: at tab sizes the thin white lines fade to grey when shrunk, so they are strengthened a little.
async function icon(size, round, fill, crisp = 1) {
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * round}" fill="${NAVY}"/></svg>`);
  const h = Math.round(size * fill), badge = await sharp(BADGE).trim().resize({ height: h, kernel: 'lanczos3' }).linear([1, 1, 1, crisp], [0, 0, 0, 0]).png().toBuffer();
  const m = await sharp(badge).metadata();
  return sharp(bg).composite([{ input: badge, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }]).png().toBuffer();
}
const tab16 = await icon(16, 0.12, 1, 1.7), tab32 = await icon(32, 0.14, 0.94, 1.35), tab48 = await icon(48, 0.16, 0.9, 1.15);
await writeFile(ROOT + 'cgh-icon-16.png', tab16); await writeFile(ROOT + 'cgh-icon-32.png', tab32);
await writeFile(ROOT + 'apple-touch-icon.png', await icon(180, 0, 0.72));
await writeFile(ROOT + 'android-chrome-192x192.png', await icon(192, 0, 0.66));
await writeFile(ROOT + 'android-chrome-512x512.png', await icon(512, 0, 0.66));
// favicon.ico: one file holding the 16, 32 and 48 pixel pictures.
const pics = [[16, tab16], [32, tab32], [48, tab48]], head = Buffer.alloc(6 + 16 * pics.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pics.length, 4);
let off = head.length; pics.forEach(([s, b], i) => { const p = 6 + i * 16; head.writeUInt8(s, p); head.writeUInt8(s, p + 1); head.writeUInt16LE(1, p + 4); head.writeUInt16LE(32, p + 6); head.writeUInt32LE(b.length, p + 8); head.writeUInt32LE(off, p + 12); off += b.length; });
await writeFile(ROOT + 'favicon.ico', Buffer.concat([head, ...pics.map((p) => p[1])]));
// a preview sheet: each icon blown up, on a light and a dark tab color
const big = async (b, to) => sharp(b).resize(to, to, { kernel: 'nearest' }).png().toBuffer();
const tiles = [[await big(tab16, 160), 20], [await big(tab32, 160), 200], [await sharp(ROOT + 'apple-touch-icon.png').resize(160).toBuffer(), 380], [await sharp(ROOT + 'android-chrome-512x512.png').resize(160).toBuffer(), 560], [tab16, 760], [tab32, 790], [tab16, 760 + 0], [tab32, 790]];
const sheet = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="860" height="200"><rect width="860" height="100" fill="#dee1e6"/><rect y="100" width="860" height="100" fill="#202124"/></svg>');
await sharp(sheet).composite([...tiles.slice(0, 4).map(([input, left]) => ({ input, left, top: 20 })), { input: tab16, left: 760, top: 40 }, { input: tab32, left: 790, top: 34 }, { input: tab16, left: 760, top: 140 }, { input: tab32, left: 790, top: 134 }]).png().toFile('/tmp/icons-new.png');
console.log('made');
