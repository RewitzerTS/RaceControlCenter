// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

describe('RaceVora color logo rollout', () => {
  it('uses the flat color SVG for the landing page and app fallback', async () => {
    for (const path of ['index.html', 'v2/src/components/AppShell.tsx', 'components/header.html', 'v2/scripts/copy-v1-public-routes.mjs']) {
      const source = await read(path);
      expect(source, path).toContain('racevora-logo-color.svg');
      expect(source, path).not.toContain('racevora-mark.svg');
    }
  });

  it('contains only two flat vector shapes with one gradient and no 3D effects or backdrop', async () => {
    const svg = await read('assets/images/racevora-logo-color.svg');
    expect(svg.match(/<path\b/g)).toHaveLength(2);
    expect(svg.match(/<linearGradient\b/g)).toHaveLength(1);
    expect(svg).toContain('viewBox="100 265 1068 740"');
    expect(svg).not.toMatch(/<(?:image|rect|filter|fe\w+|radialGradient)\b|\b(?:stroke|opacity|style)=/);
  });

  it('exports real alpha transparency rather than a painted backdrop in the PNGs', async () => {
    for (const path of ['images/racevora-logo-color.png', 'icons/favicon-16x16.png',
      'icons/favicon-32x32.png', 'icons/favicon-48x48.png', 'icons/apple-touch-icon.png',
      'icons/icon-192.png', 'icons/icon-512.png']) {
      const data = await readFile(new URL(`assets/${path}`, root));
      expect(data.subarray(1, 4).toString(), path).toBe('PNG');
      expect(data[24], path).toBe(8); // 8-bit channels
      expect(data[25], path).toBe(6); // RGBA, not an RGB checkerboard
      expect(data[28], path).toBe(0); // non-interlaced
      const chunks = [];
      for (let offset = 8; offset < data.length;) {
        const length = data.readUInt32BE(offset);
        if (data.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
          chunks.push(data.subarray(offset + 8, offset + 8 + length));
        }
        offset += length + 12;
      }
      const scanlines = inflateSync(Buffer.concat(chunks));
      // The entire first scanline is transparent clear space. All PNG filter
      // methods preserve this zero row, so no full image decoder is necessary.
      const firstRow = scanlines.subarray(1, 1 + data.readUInt32BE(16) * 4);
      expect(firstRow.every((byte) => byte === 0), path).toBe(true);
    }
  });

  it('packages all four favicon sizes in the ICO directory', async () => {
    const data = await readFile(new URL('favicon.ico', root));
    expect(data.readUInt16LE(2)).toBe(1);
    expect(data.readUInt16LE(4)).toBe(4);
    for (const [index, size] of [16, 32, 48, 64].entries()) {
      const entry = 6 + index * 16;
      expect(data[entry]).toBe(size);
      expect(data[entry + 1]).toBe(size);
      const offset = data.readUInt32LE(entry + 12);
      expect(data.subarray(offset + 1, offset + 4).toString()).toBe('PNG');
      expect(offset + data.readUInt32LE(entry + 8)).toBeLessThanOrEqual(data.length);
    }
  });

  it('provides correctly sized, cache-versioned ordinary and maskable app icons', async () => {
    const manifest = JSON.parse(await read('manifest.json'));
    expect(manifest.icons.map(({ purpose }) => purpose)).toEqual(['any', 'any', 'maskable']);
    for (const icon of manifest.icons) {
      expect(icon.src).toContain('?v=rv-flat-20260903');
      const data = await readFile(fileURLToPath(new URL(icon.src.split('?')[0], root)));
      expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    expect(manifest.start_url).toBe('/home');
    expect(manifest.id).toBe('/');
  });

  it('refreshes the favicons on both entry points', async () => {
    for (const path of ['index.html', 'v2/index.html']) {
      const source = await read(path);
      expect(source).toContain('favicon-32x32.png?v=rv-flat-20260903');
      expect(source).toContain('apple-touch-icon.png?v=rv-flat-20260903');
      expect(source).toContain('favicon.ico?v=rv-flat-20260903');
    }
  });

  it('keeps the complete championship word together with fluid mobile sizing', async () => {
    expect(await read('index.html')).toContain('<span class="final-championship">CHAMPIONSHIP.</span>');
    const css = await read('test-landing/style.css');
    expect(css).toContain('.final-championship{white-space:nowrap}');
    expect(css).toContain('font-size:clamp(1rem,9.5vw,4.125rem);overflow-wrap:normal;word-break:normal');
  });
});
