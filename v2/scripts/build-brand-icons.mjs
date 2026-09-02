/**
 * Export the approved flat SVG master to transparent PNGs and a multi-size ICO.
 * Run: node scripts/build-brand-icons.mjs (requires Sharp, optionally via NODE_PATH).
 * Generated assets are committed; Sharp is not a build/deployment dependency.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)('sharp');
const root = new URL('../../', import.meta.url);
const source = await readFile(new URL('assets/images/racevora-logo-color.svg', root));
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function square(size, ratio = 0.96, background = transparent) {
  const limit = Math.round(size * ratio);
  const mark = await sharp(source, { density: 300 })
    .resize(limit, limit, { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
}

async function save(path, bytes) {
  await writeFile(new URL(path, root), bytes);
}

await save('assets/images/racevora-logo-color.png', await sharp(source, { density: 300 })
  .resize({ width: 1068 }).png().toBuffer());

const faviconSizes = [16, 32, 48, 64];
const faviconImages = await Promise.all(faviconSizes.map((size) => square(size)));
for (const [index, size] of faviconSizes.entries()) {
  if (size <= 48) await save(`assets/icons/favicon-${size}x${size}.png`, faviconImages[index]);
}
await save('assets/icons/apple-touch-icon.png', await square(180));
for (const size of [192, 512]) await save(`assets/icons/icon-${size}.png`, await square(size));
// Only the OS-maskable tile needs an opaque canvas. Keep the complete mark inside
// the central circular safe zone; the SVG and ordinary app icons stay transparent.
await save('assets/icons/icon-maskable-512.png', await square(512, 0.64, '#090b10'));

// ICO supports embedded PNG images; no platform-specific image utility is needed.
const directory = Buffer.alloc(6 + faviconImages.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(faviconImages.length, 4);
let offset = directory.length;
for (const [index, bytes] of faviconImages.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = faviconSizes[index];
  directory[entry + 1] = faviconSizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(bytes.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += bytes.length;
}
await save('favicon.ico', Buffer.concat([directory, ...faviconImages]));
console.log(`Exported flat SVG master: ${fileURLToPath(new URL('assets/images/racevora-logo-color.svg', root))}`);
console.log('Created transparent PNG logo, favicons, app icons, multi-size ICO and opaque maskable tile.');
