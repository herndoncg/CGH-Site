// Downloads the ground textures for the opening animation from Poly Haven (polyhaven.com),
// a free library of professional photo-scanned textures. License: CC0 (free for any use, no credit needed).
// Runs at the start of every build. A texture that is already in public/img/intro is not downloaded again.
// If a download fails the build carries on and the animation falls back to flat colors.
import { existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/img/intro';
// name on the site -> Poly Haven textures to try, in order, plus light color grading
const wanted = {
  grass: { from: ['leafy_grass', 'grass_ground', 'aerial_grass_rock'], grade: { saturation: 1.25, hue: 14, brightness: 1.02 } },
  dirt: { from: ['red_dirt_mud_01', 'red_laterite_soil_stones', 'dirt_floor'], grade: { saturation: 1.05 } },
  rock: { from: ['gravel_floor_02', 'gravel_floor', 'gravelly_sand'], grade: { saturation: 0.75, brightness: 1.03 } },
  asphalt: { from: ['asphalt_track', 'asphalt_pit_lane', 'asphalt_02'], grade: { saturation: 0.6, brightness: 0.82 } },
};

mkdirSync(OUT, { recursive: true });
for (const [name, { from, grade }] of Object.entries(wanted)) {
  const file = `${OUT}/${name}.webp`;
  if (existsSync(file)) { console.log(`[textures] ${name}: already here`); continue; }
  let done = false;
  for (const id of from) {
    try {
      const res = await fetch(`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}_diff_1k.jpg`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await sharp(Buffer.from(await res.arrayBuffer())).resize(900, 900).modulate(grade).webp({ quality: 66 }).toFile(file);
      console.log(`[textures] ${name}: ${id} (${Math.round(info.size / 1024)} kB)`);
      done = true; break;
    } catch (e) { console.log(`[textures] ${name}: ${id} failed (${e.message})`); }
  }
  if (!done) console.log(`[textures] ${name}: no texture downloaded, the animation will use a flat color`);
}
