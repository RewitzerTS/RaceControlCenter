// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

describe('RaceVora color logo rollout', () => {
  it('uses the supplied color logo for the landing page and app fallback', async () => {
    for (const path of ['index.html', 'v2/src/components/AppShell.tsx', 'components/header.html', 'v2/scripts/copy-v1-public-routes.mjs']) {
      const source = await read(path);
      expect(source, path).toContain('racevora-logo-color.png');
      expect(source, path).not.toContain('racevora-mark.svg');
    }
  });

  it('provides correctly sized, cache-versioned ordinary and maskable app icons', async () => {
    const manifest = JSON.parse(await read('manifest.json'));
    expect(manifest.icons.map(({ purpose }) => purpose)).toEqual(['any', 'any', 'maskable']);
    for (const icon of manifest.icons) {
      expect(icon.src).toContain('?v=rv-20260903');
      const data = await readFile(fileURLToPath(new URL(icon.src.split('?')[0], root)));
      expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    expect(manifest.start_url).toBe('/home');
    expect(manifest.id).toBe('/');
  });

  it('refreshes the favicons on both entry points', async () => {
    for (const path of ['index.html', 'v2/index.html']) {
      const source = await read(path);
      expect(source).toContain('favicon-32x32.png?v=rv-20260903');
      expect(source).toContain('apple-touch-icon.png?v=rv-20260903');
      expect(source).toContain('favicon.ico?v=rv-20260903');
    }
  });

  it('keeps the complete championship word together with fluid mobile sizing', async () => {
    expect(await read('index.html')).toContain('<span class="final-championship">CHAMPIONSHIP.</span>');
    const css = await read('test-landing/style.css');
    expect(css).toContain('.final-championship{white-space:nowrap}');
    expect(css).toContain('font-size:clamp(1rem,9.5vw,4.125rem);overflow-wrap:normal;word-break:normal');
  });
});
