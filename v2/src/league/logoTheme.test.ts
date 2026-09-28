import { afterEach, describe, expect, it, vi } from 'vitest';
import { customThemeHasAccessibleContrast } from './leagueBranding';
import { themeFromLogoPixels, themeFromLogoUrl } from './logoTheme';

const pixels = (...colors: number[][]) => new Uint8ClampedArray(colors.flat());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('personal palette from logo pixels', () => {
  it('ignores transparent padding and never mutates the samples', () => {
    const input = pixels([0, 0, 0, 0], [250, 140, 70, 255], [10, 20, 30, 80]);
    const before = [...input];
    expect(themeFromLogoPixels(input).colors.primary).toBe('#FA8C46');
    expect([...input]).toEqual(before);
  });
  it('finds a colored mark even on a large white background', () => {
    const image = pixels(...Array.from({ length: 100 }, () => [255, 255, 255, 255]), ...Array.from({ length: 20 }, () => [0, 220, 180, 255]));
    expect(themeFromLogoPixels(image).colors.primary).toBe('#00DCB4');
  });
  it('retains distinct colorful logo hues instead of inventing a full palette', () => {
    const result = themeFromLogoPixels(pixels([255, 150, 0, 255], [0, 230, 180, 255], [210, 130, 250, 255]));
    expect(result.supplemented).toBe(false);
    expect(result.colors.primary).toBe('#FF9600');
    expect(result.colors.accent).toBe('#00E6B4');
  });
  it('explains supplemented single-color and monochrome palettes', () => {
    for (const color of [[0, 0, 0, 255], [255, 255, 255, 255], [10, 90, 160, 255]]) {
      const result = themeFromLogoPixels(pixels(color));
      expect(result.supplemented).toBe(true);
      expect(customThemeHasAccessibleContrast(result.colors)).toBe(true);
    }
  });
  it('produces contrast-safe dark themes across a deterministic color cube', () => {
    for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
      const { colors } = themeFromLogoPixels(pixels([r, g, b, 255]));
      expect(customThemeHasAccessibleContrast(colors), `${r}/${g}/${b}`).toBe(true);
      expect(Object.values(colors).every(value => /^#[0-9A-F]{6}$/.test(value))).toBe(true);
    }
  });
  it('rejects empty and entirely transparent logos instead of reporting invented extraction', () => {
    expect(() => themeFromLogoPixels(pixels())).toThrow('empty_logo');
    expect(() => themeFromLogoPixels(pixels([40, 50, 60, 0]))).toThrow('empty_logo');
  });
});

describe('browser logo loading boundaries', () => {
  it.each(['', 'javascript:alert(1)', 'data:image/png;base64,AA', 'https://user:secret@example.invalid/a.png'])('rejects unsafe/unsupported source %s', async source => {
    await expect(themeFromLogoUrl(source, new AbortController().signal)).rejects.toThrow();
  });
  function imageStub() {
    const image = { src: '', crossOrigin: '', referrerPolicy: '', naturalWidth: 256, naturalHeight: 128, onload: null as (() => void) | null, onerror: null as (() => void) | null, removeAttribute: vi.fn() };
    vi.stubGlobal('Image', class { constructor() { return image; } });
    return image;
  }
  it('loads anonymously, bounds the canvas and preserves aspect ratio', async () => {
    const image = imageStub();
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({ data: pixels([0, 220, 180, 255]) }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, getImageData } as unknown as CanvasRenderingContext2D);
    const result = themeFromLogoUrl('https://example.invalid/logo.png', new AbortController().signal);
    expect(image.crossOrigin).toBe('anonymous');
    expect(image.referrerPolicy).toBe('no-referrer');
    image.onload?.();
    expect((await result).colors.primary).toBe('#00DCB4');
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 128, 64);
    expect(image.removeAttribute).toHaveBeenCalledWith('src');
  });
  it('cleans up failed, cancelled and timed-out loads', async () => {
    vi.useFakeTimers();
    for (const reason of ['error', 'abort', 'timeout']) {
      const image = imageStub();
      const controller = new AbortController();
      const promise = themeFromLogoUrl('/logo.png', controller.signal);
      const rejection = expect(promise).rejects.toThrow();
      if (reason === 'error') image.onerror?.();
      else if (reason === 'abort') controller.abort();
      else vi.advanceTimersByTime(10000);
      await rejection;
      expect(image.onload).toBeNull();
      expect(image.removeAttribute).toHaveBeenCalledWith('src');
    }
  });
  it('turns a CORS-tainted canvas into a recoverable error', async () => {
    const image = imageStub();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {}, getImageData() { throw new DOMException('Tainted', 'SecurityError'); } } as unknown as CanvasRenderingContext2D);
    const promise = themeFromLogoUrl('/logo.png', new AbortController().signal);
    const rejection = expect(promise).rejects.toThrow('logo_unreadable');
    image.onload?.();
    await rejection;
  });
});
