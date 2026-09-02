import { describe, expect, it, vi, afterEach } from 'vitest';
import { canShareInstagram, INSTAGRAM_FORMATS, INSTAGRAM_GRADIENT, layoutInstagramBlock, newInstagramBlock, paintInstagram, shareInstagram, updateInstagramBlock, wrapInstagramText } from './instagram';
import { instagramMessages } from './instagramMessages';

afterEach(() => vi.unstubAllGlobals());

describe('Owner Instagram graphics', () => {
  it('uses the supplied dedicated background for each export format', () => {
    expect(INSTAGRAM_FORMATS.feed).toEqual({ width: 1080, height: 1350, background: '/assets/instagram/feed-v1.png' });
    expect(INSTAGRAM_FORMATS.story).toEqual({ width: 1080, height: 1920, background: '/assets/instagram/story-v1.png' });
  });

  it('creates independent blocks with stable IDs and no placeholder content', () => {
    const first = newInstagramBlock('h1', 0);
    const second = newInstagramBlock('h2', 1);
    expect(first.id).not.toBe(second.id);
    expect(first.text).toBe('');
    expect(first.size).toBeGreaterThan(second.size);
  });

  it('bounds positions and sizes and rejects invalid numeric values', () => {
    const block = newInstagramBlock('h1', 0);
    expect(updateInstagramBlock(block, { x: 400, width: 80, y: -1, size: NaN })).toMatchObject({ x: 20, width: 80, y: 0, size: 24 });
    expect(updateInstagramBlock(block, { width: 200, x: 50 })).toMatchObject({ width: 100, x: 0 });
    expect(updateInstagramBlock(block, { text: 'A'.repeat(800) }).text).toHaveLength(500);
  });

  it('wraps words, preserves explicit empty lines and handles long Unicode words', () => {
    const measure = (text: string) => Array.from(text).length * 10;
    expect(wrapInstagramText('Hallo Welt\n\nRaceVora', 60, measure)).toEqual(['HALLO', 'WELT', '', 'RACEVO', 'RA']);
    expect(wrapInstagramText('ÄÖÜß 🚀🚀🚀', 20, measure)).toEqual(['ÄÖ', 'ÜS', 'S', '🚀🚀', '🚀']);
    expect(wrapInstagramText('a\r\nb', 60, measure)).toEqual(['A', 'B']);
  });

  it('reports overflow instead of silently dropping text', () => {
    const context = { measureText: (text: string) => ({ width: text.length * 35 }) } as CanvasRenderingContext2D;
    const block = { ...newInstagramBlock('h1', 0), text: 'HELLO\nWORLD', y: 90 };
    expect(layoutInstagramBlock(context, block, 'feed').overflow).toBe(true);
    expect(layoutInstagramBlock(context, { ...block, y: 20 }, 'feed').overflow).toBe(false);
  });

  it('renders the exact background and both styles without editor outlines', () => {
    const colors: unknown[] = [];
    const gradient = { addColorStop: vi.fn() };
    const context = { drawImage: vi.fn(), measureText: (text: string) => ({ width: text.length * 50 }), createLinearGradient: vi.fn(() => gradient), fillText: vi.fn(),
      set fillStyle(value: unknown) { colors.push(value); } };
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const background = {} as HTMLImageElement;
    const first = { ...newInstagramBlock('h1', 0), text: 'RaceVora' };
    const second = { ...newInstagramBlock('h2', 1), text: 'Start now', align: 'center' as const };
    const layouts = paintInstagram(canvas, { format: 'story', blocks: [first, second] }, background);
    expect(context.drawImage).toHaveBeenCalledWith(background, 0, 0, 1080, 1920);
    expect(colors).toEqual(['#ffffff', gradient]);
    expect(gradient.addColorStop.mock.calls.map((call) => call[1])).toEqual(INSTAGRAM_GRADIENT);
    expect(context.fillText).toHaveBeenCalledWith('RACEVORA', layouts[0].x, layouts[0].y);
    expect(canvas.height).toBe(1920);
  });

  it('shares the already prepared PNG synchronously and handles unsupported browsers', async () => {
    const file = new File(['png'], 'racevora.png', { type: 'image/png' });
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true) });
    expect(canShareInstagram(file)).toBe(true);
    const pending = shareInstagram(file);
    expect(share).toHaveBeenCalledWith({ files: [file] });
    await pending;
    vi.stubGlobal('navigator', {});
    expect(canShareInstagram(file)).toBe(false);
    vi.stubGlobal('navigator', { share, canShare() { throw new Error('Policy denied'); } });
    expect(canShareInstagram(file)).toBe(false);
  });

  it('has matching complete labels in all four languages', () => {
    for (const locale of Object.values(instagramMessages)) {
      expect(Object.keys(locale).sort()).toEqual(Object.keys(instagramMessages.de).sort());
      expect(Object.values(locale).every((value) => value.trim())).toBe(true);
    }
  });
});
