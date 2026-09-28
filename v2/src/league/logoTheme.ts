import { readableActionStop, readablePrimaryText, type CustomThemeColors } from './leagueBranding';

type RGB = [number, number, number];
export type LogoTheme = { colors: CustomThemeColors; supplemented: boolean };
const rgb = (hex: string): RGB => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) as RGB;
const hex = (channels: number[]) => '#' + channels.map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a: string, b: string, amount: number) => hex(rgb(a).map((value, index) => value * (1 - amount) + rgb(b)[index] * amount));
const distance = (a: RGB, b: RGB) => Math.hypot(...a.map((value, index) => value - b[index]));

/** Bounded quantized sampling; transparent pixels never become black logo colors. */
export function themeFromLogoPixels(pixels: Uint8ClampedArray): LogoTheme {
  const buckets = new Map<number, { sum: RGB; weight: number }>();
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 128) continue;
    const channels: RGB = [pixels[index], pixels[index + 1], pixels[index + 2]];
    const key = (channels[0] >> 4) * 256 + (channels[1] >> 4) * 16 + (channels[2] >> 4);
    const bucket = buckets.get(key) ?? { sum: [0, 0, 0], weight: 0 };
    const weight = alpha / 255;
    channels.forEach((value, channel) => { bucket.sum[channel] += value * weight; });
    bucket.weight += weight;
    buckets.set(key, bucket);
  }
  if (!buckets.size) throw new Error('empty_logo');
  const total = [...buckets.values()].reduce((sum, bucket) => sum + bucket.weight, 0);
  const ranked = [...buckets.values()].map(bucket => ({
    color: bucket.sum.map(value => value / bucket.weight) as RGB, weight: bucket.weight,
  })).sort((a, b) => b.weight - a.weight);
  // Prefer the actual colored mark over a large white/black background. Ignore tiny specks.
  const chromatic = ranked.filter(({ color, weight }) => Math.max(...color) - Math.min(...color) >= 32 && weight >= Math.max(1, total * 0.002));
  const palette: RGB[] = [];
  for (const candidate of chromatic.length ? chromatic : ranked) {
    if (palette.every(color => distance(color, candidate.color) >= 64)) palette.push(candidate.color);
    if (palette.length === 3) break;
  }
  const primarySource = hex(palette[0]);
  const background = mix('#080B12', primarySource, 0.035);
  const surface = mix('#141A23', primarySource, 0.07);
  const primary = readableActionStop(primarySource, surface).toUpperCase();
  const accent = readableActionStop(palette[1] ? hex(palette[1]) : chromatic.length ? mix(primary, '#FFFFFF', 0.3) : '#47CFDE', surface).toUpperCase();
  const accent2 = readableActionStop(palette[2] ? hex(palette[2]) : chromatic.length ? mix(primary, '#FFFFFF', 0.5) : '#B994FF', surface).toUpperCase();
  return {
    supplemented: chromatic.length === 0 || palette.length < 3,
    colors: { primary, secondary: mix(surface, primarySource, 0.16), accent, accent2, background, surface, text: '#F6F8FC', textOnPrimary: readablePrimaryText(primary, '#081018') },
  };
}

/** No backend proxy, credentials or upload. A CORS-blocked image produces an explicit retryable failure. */
export function themeFromLogoUrl(source: string, signal: AbortSignal): Promise<LogoTheme> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(source, window.location.href);
      if (!source.trim() || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid_logo');
    } catch (error) { reject(error); return; }
    if (signal.aborted) { reject(new Error('aborted')); return; }
    const image = new Image();
    let settled = false;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null; image.removeAttribute('src'); };
    const fail = (reason: string) => { if (settled) return; settled = true; cleanup(); reject(new Error(reason)); };
    const abort = () => fail('aborted');
    const timer = window.setTimeout(() => fail('logo_timeout'), 10000);
    signal.addEventListener('abort', abort, { once: true });
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('invalid_logo');
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('canvas_unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = themeFromLogoPixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
        settled = true;
        cleanup();
        resolve(result);
      } catch { fail('logo_unreadable'); }
    };
    image.onerror = () => fail('logo_unreadable');
    image.src = url.href;
  });
}
