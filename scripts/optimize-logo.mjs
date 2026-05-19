import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const SRC = path.resolve('images/FocusMHA.png');
const PUBLIC_DIR = path.resolve('frontend/public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

await mkdir(ICONS_DIR, { recursive: true });

const srcStat = await stat(SRC);
console.log(`Source: ${SRC} (${(srcStat.size / 1024).toFixed(1)} KB)`);

const targets = [
  // Logo principal (utilise dans Sidebar/Login a ~64px max — un 256 retina suffit)
  { out: path.join(PUBLIC_DIR, 'logo.png'), size: 256, format: 'png' },
  { out: path.join(PUBLIC_DIR, 'logo.webp'), size: 256, format: 'webp' },
  // PWA
  { out: path.join(ICONS_DIR, 'icon-192.png'), size: 192, format: 'png' },
  { out: path.join(ICONS_DIR, 'icon-512.png'), size: 512, format: 'png' },
  // Favicon (Chrome accepte un PNG)
  { out: path.join(PUBLIC_DIR, 'favicon-32.png'), size: 32, format: 'png' },
];

for (const t of targets) {
  let pipeline = sharp(SRC).resize(t.size, t.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } });
  if (t.format === 'webp') {
    pipeline = pipeline.webp({ quality: 88 });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true });
  }
  await pipeline.toFile(t.out);
  const s = await stat(t.out);
  console.log(`  -> ${path.relative(process.cwd(), t.out)} (${(s.size / 1024).toFixed(1)} KB)`);
}

console.log('Done.');
