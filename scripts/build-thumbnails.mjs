import { mkdir, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('This script needs the "sharp" package. Install it with: npm install --save-dev sharp');
  process.exit(1);
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modes = ['regular', 'shiny'];
const size = 180;
let written = 0;
let checked = 0;
let skipped = 0;

async function needsThumbnail(source, target) {
  try {
    const [sourceStats, targetStats] = await Promise.all([stat(source), stat(target)]);
    return targetStats.mtimeMs < sourceStats.mtimeMs;
  } catch {
    return true;
  }
}

async function buildThumbnail(source, target) {
  checked++;
  if (!await needsThumbnail(source, target)) {
    skipped++;
    return;
  }

  await sharp(source)
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(target);

  written++;
}

for (const mode of modes) {
  const sourceDir = resolve(root, 'images', mode);
  const targetDir = resolve(root, 'images', 'thumbs', mode);
  await mkdir(targetDir, { recursive: true });

  const files = (await readdir(sourceDir)).filter(file => file.endsWith('.png'));
  for (const file of files) {
    const source = resolve(sourceDir, file);
    const target = resolve(targetDir, file.replace(/\.png$/, '.webp'));
    await buildThumbnail(source, target);
    if (checked % 50 === 0) process.stdout.write(`\r${checked} thumbnails checked, ${written} written, ${skipped} skipped`);
  }
}

console.log(`\nBuilt ${written} ${size}px WebP thumbnails (${skipped} already current).`);
