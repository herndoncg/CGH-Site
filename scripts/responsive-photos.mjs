// Makes phones download smaller copies of the job photos.
//
// Plain version: every job photo on the site is about 1,200 dots wide, which is more than a phone needs.
// After the site is built, this makes a 640-wide and a 960-wide copy of each photo and tells every page
// about them, so each phone or computer picks the smallest one that still looks sharp on its screen.
// Nothing in the page files has to change, and the full-size photo is still there for big screens.
// It runs by itself on every build (see astro.config.mjs).
import sharp from 'sharp';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTHS = [640, 960];
async function* walk(dir) { for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }

export default function responsivePhotos() {
  return {
    name: 'cgh-responsive-photos',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir), sizes = new Map(); // photo path -> its real width, or 0 when it is too small to bother
        const prepare = async (src) => {
          if (sizes.has(src)) return sizes.get(src);
          let width = 0;
          try {
            const file = path.join(root, src), meta = await sharp(file).metadata();
            if (meta.width > WIDTHS[1] + 100) {
              for (const w of WIDTHS) await sharp(file).resize({ width: w }).webp({ quality: 72 }).toFile(file.replace(/\.webp$/, `-${w}.webp`));
              width = meta.width;
            }
          } catch { width = 0; }
          sizes.set(src, width); return width;
        };
        let pages = 0, tags = 0;
        for await (const file of walk(root)) {
          if (!file.endsWith('.html')) continue;
          const html = await readFile(file, 'utf8');
          const found = [...html.matchAll(/<img\b[^>]*\bsrc="(\/img\/(?:work|blog|hero|uploads)\/[^"]+\.webp)"[^>]*>/g)].filter((m) => !/\bsrcset=/.test(m[0]));
          if (!found.length) continue;
          let out = html;
          for (const m of found) {
            const width = await prepare(m[1]); if (!width) continue;
            const srcset = [...WIDTHS.map((w) => `${m[1].replace(/\.webp$/, `-${w}.webp`)} ${w}w`), `${m[1]} ${width}w`].join(', ');
            // "sizes" is set a little under the true width on purpose, so high-density phone screens take the 960 copy, not the full one.
            out = out.replace(m[0], m[0].replace(/<img\b/, `<img srcset="${srcset}" sizes="(max-width: 700px) 62vw, (max-width: 1200px) 45vw, 560px"`)); tags++;
          }
          if (out !== html) { await writeFile(file, out); pages++; }
        }
        let saved = 0; for (const [src, w] of sizes) if (w) saved += (await stat(path.join(root, src))).size - (await stat(path.join(root, src.replace(/\.webp$/, '-640.webp')))).size;
        console.log(`[photos] ${[...sizes.values()].filter(Boolean).length} photos given phone-size copies, ${tags} picture tags on ${pages} pages. A phone now loads about ${Math.round(saved / 1024 / [...sizes.values()].filter(Boolean).length || 0)} kB less per photo.`);
      },
    },
  };
}
