import { readdir, writeFile } from 'node:fs/promises';
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
const imageFiles = [];
let checked = 0;
let trimmed = 0;

async function trimImage(path) {
  const image = sharp(path);
  const before = await image.metadata();
  const { data, info } = await sharp(path)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });

  checked++;
  if (before.width === info.width && before.height === info.height) return;
  await writeFile(path, data);
  trimmed++;
}

for (const mode of modes) {
  const dir = resolve(root, 'images', mode);
  const files = (await readdir(dir)).filter(file => file.endsWith('.png'));
  imageFiles.push(...files.map(file => resolve(dir, file)));
}

for (const path of imageFiles) {
  await trimImage(path);
  process.stdout.write(`\r${checked}/${imageFiles.length} checked, ${trimmed} trimmed`);
}

console.log(`\nTrimmed transparent padding from ${trimmed} of ${checked} images.`);
