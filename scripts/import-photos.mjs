// Shrinks phone photos into web-sized .webp files in public/img/work.
// usage: node scripts/import-photos.mjs <src-file>=<name>[:crop] ...
// ":crop" trims the black bars off a phone screenshot before resizing.
import sharp from 'sharp';
for (const arg of process.argv.slice(2)) {
  const [src, rest] = arg.split('=');
  const [name, crop] = rest.split(':');
  let img = sharp(src).rotate();
  if (crop) {
    const { data, info } = await sharp(src).rotate().greyscale().resize({ width: 64, fit: 'fill', height: 640 }).raw().toBuffer({ resolveWithObject: true });
    const rows = Array.from({ length: info.height }, (_, y) => { let s = 0; for (let x = 0; x < info.width; x++) s += data[y * info.width + x]; return s / info.width; });
    let best = [0, 0], start = -1;
    rows.forEach((m, y) => { if (m > 28) { if (start < 0) start = y; if (y - start > best[1] - best[0]) best = [start, y]; } else start = -1; });
    const meta = await sharp(src).metadata();
    const top = Math.round((best[0] / info.height) * meta.height) + 6, bottom = Math.round(((best[1] + 1) / info.height) * meta.height) - 6;
    img = sharp(src).extract({ left: 0, top, width: meta.width, height: bottom - top });
  }
  const out = `public/img/work/${name}.webp`;
  const r = await img.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74 }).toFile(out);
  console.log(`${name}.webp ${r.width}x${r.height} ${Math.round(r.size / 1024)}kB`);
}
