export type InstagramFormat = 'feed' | 'story';
export type InstagramTextStyle = 'h1' | 'h2';
export type InstagramBlock = {
  id: string;
  text: string;
  style: InstagramTextStyle;
  x: number;
  y: number;
  width: number;
  size: number;
  align: 'left' | 'center' | 'right';
};
export type InstagramDocument = { format: InstagramFormat; blocks: InstagramBlock[] };
export const INSTAGRAM_FORMATS = {
  feed: { width: 1080, height: 1350, background: '/assets/instagram/feed-v1.png' },
  story: { width: 1080, height: 1920, background: '/assets/instagram/story-v1.png' },
} as const;
export const MAX_INSTAGRAM_BLOCKS = 12;
export const INSTAGRAM_FONT = '"RaceVora Instagram"';
// The RaceVora landing-page spectrum, independent of the selected league theme.
export const INSTAGRAM_GRADIENT = ['#86eaf0', '#8d72ff', '#cf73e6'] as const;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function newInstagramBlock(style: InstagramTextStyle, index: number): InstagramBlock {
  return { id: crypto.randomUUID(), text: '', style, x: 9, y: Math.min(20 + index * 12, 70), width: 82, size: style === 'h1' ? 88 : 64, align: 'left' };
}

export function updateInstagramBlock(block: InstagramBlock, patch: Partial<InstagramBlock>): InstagramBlock {
  const next = { ...block, ...patch };
  next.width = clamp(next.width, 15, 100);
  next.x = clamp(next.x, 0, 100 - next.width);
  next.y = clamp(next.y, 0, 95);
  next.size = clamp(next.size, 24, 160);
  next.text = next.text.slice(0, 500);
  return next;
}

/** Preserve deliberate line breaks; split long words without dropping characters. */
export function wrapInstagramText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.toUpperCase().replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > maxWidth) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export type InstagramBlockLayout = { id: string; x: number; y: number; width: number; height: number; lines: string[]; overflow: boolean };

export function layoutInstagramBlock(context: CanvasRenderingContext2D, block: InstagramBlock, format: InstagramFormat): InstagramBlockLayout {
  const { width, height } = INSTAGRAM_FORMATS[format];
  context.font = `900 ${block.size}px ${INSTAGRAM_FONT}`;
  const boxWidth = block.width * width / 100;
  const lines = wrapInstagramText(block.text, boxWidth, (text) => context.measureText(text).width);
  const boxHeight = lines.length * block.size * 1.12;
  const y = block.y * height / 100;
  return { id: block.id, x: block.x * width / 100, y, width: boxWidth, height: boxHeight, lines,
    overflow: Boolean(block.text.trim()) && (y + boxHeight > height || lines.some((line) => context.measureText(line).width > boxWidth)) };
}

let fontPromise: Promise<void> | undefined;
const backgrounds = new Map<InstagramFormat, Promise<HTMLImageElement>>();

export function loadInstagramAssets(format: InstagramFormat): Promise<[void, HTMLImageElement]> {
  if (!fontPromise) {
    fontPromise = new FontFace('RaceVora Instagram', 'url(/assets/instagram/InterVariable.woff2)', { weight: '100 900' }).load()
      .then((font) => { document.fonts.add(font); })
      .catch((error) => { fontPromise = undefined; throw error; });
  }
  if (!backgrounds.has(format)) {
    backgrounds.set(format, new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timer = window.setTimeout(() => reject(new Error('Background timeout')), 15000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Background unavailable')); };
      image.src = INSTAGRAM_FORMATS[format].background;
    }).catch((error) => { backgrounds.delete(format); throw error; }));
  }
  return Promise.all([fontPromise, backgrounds.get(format)!]);
}

export function paintInstagram(canvas: HTMLCanvasElement, doc: InstagramDocument, background: HTMLImageElement): InstagramBlockLayout[] {
  const { width, height } = INSTAGRAM_FORMATS[doc.format];
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(background, 0, 0, width, height);
  context.textBaseline = 'top';
  const layouts: InstagramBlockLayout[] = [];
  for (const block of doc.blocks) {
    const layout = layoutInstagramBlock(context, block, doc.format);
    layouts.push(layout);
    if (!block.text.trim()) continue;
    context.textAlign = block.align;
    if (block.style === 'h2') {
      const gradient = context.createLinearGradient(layout.x, 0, layout.x + layout.width, 0);
      INSTAGRAM_GRADIENT.forEach((color, index) => gradient.addColorStop(index / 2, color));
      context.fillStyle = gradient;
    } else context.fillStyle = '#ffffff';
    const x = layout.x + (block.align === 'center' ? layout.width / 2 : block.align === 'right' ? layout.width : 0);
    layout.lines.forEach((line, index) => context.fillText(line, x, layout.y + index * block.size * 1.12));
  }
  return layouts;
}

export function instagramPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
}

export function canShareInstagram(file: File): boolean {
  try { return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }); }
  catch { return false; }
}

// Keep this synchronous up to navigator.share: a delayed render would lose user activation.
export function shareInstagram(file: File): Promise<void> {
  return navigator.share({ files: [file] });
}
