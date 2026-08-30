import { THEME_PRESETS } from '../league/leagueBranding';
import type { GraphicFormat, GraphicModel } from './graphics';
import raceResultPortraitTemplate from './templates/race-result-portrait.svg?raw';

export const GRAPHIC_DIMENSIONS: Record<GraphicFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

export type GraphicTheme = {
  background: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  line: string;
  onPrimary: string;
};

export type GraphicBranding = {
  name: string;
  logoUrl?: string;
};

export type GraphicRenderOptions = {
  pageNumber?: number;
  pageCount?: number;
  pageLabel?: string;
  theme?: GraphicTheme;
  branding?: GraphicBranding;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_PRESET = THEME_PRESETS[0];

function hexChannels(value: string): [number, number, number] {
  const normalized = HEX_COLOR.test(value) ? value : '#000000';
  return [Number.parseInt(normalized.slice(1, 3), 16), Number.parseInt(normalized.slice(3, 5), 16), Number.parseInt(normalized.slice(5, 7), 16)];
}

function channel(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

export function mixGraphicColors(base: string, overlay: string, overlayWeight: number): string {
  const first = hexChannels(base);
  const second = hexChannels(overlay);
  const weight = Math.max(0, Math.min(1, overlayWeight));
  return `#${first.map((value, index) => channel(value * (1 - weight) + second[index] * weight)).join('')}`;
}

function themeColor(style: CSSStyleDeclaration, property: string, fallback: string): string {
  const value = style.getPropertyValue(property).trim();
  return HEX_COLOR.test(value) ? value.toUpperCase() : fallback;
}

export function readGraphicTheme(root: Element = document.documentElement): GraphicTheme {
  const style = getComputedStyle(root);
  const background = themeColor(style, '--brand-background', DEFAULT_PRESET.background);
  const surface = themeColor(style, '--brand-surface', DEFAULT_PRESET.surface);
  const secondary = themeColor(style, '--brand-secondary', DEFAULT_PRESET.secondary);
  const text = themeColor(style, '--brand-text', DEFAULT_PRESET.text);
  return {
    background,
    surface,
    surfaceAlt: mixGraphicColors(surface, secondary, 0.16),
    primary: themeColor(style, '--brand-primary', DEFAULT_PRESET.primary),
    secondary,
    accent: themeColor(style, '--brand-accent', DEFAULT_PRESET.accent),
    text,
    muted: mixGraphicColors(surface, text, 0.7),
    line: mixGraphicColors(surface, text, 0.2),
    onPrimary: themeColor(style, '--brand-on-primary', DEFAULT_PRESET.textOnPrimary),
  };
}

const TEMPLATE_THEME_VARIABLES: Record<string, keyof GraphicTheme> = {
  '--rv-background': 'background',
  '--rv-surface': 'surface',
  '--rv-surface-alt': 'surfaceAlt',
  '--rv-primary': 'primary',
  '--rv-secondary': 'secondary',
  '--rv-accent': 'accent',
  '--rv-text': 'text',
  '--rv-muted': 'muted',
  '--rv-line': 'line',
  '--rv-on-primary': 'onPrimary',
};

export function resolveRaceResultPortraitTemplate(theme: GraphicTheme): string {
  let resolved = raceResultPortraitTemplate;
  for (const [variable, key] of Object.entries(TEMPLATE_THEME_VARIABLES)) resolved = resolved.replaceAll(`var(${variable})`, theme[key]);
  return resolved;
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number, startSize: number, weight = 700, minimumSize = 18) {
  let size = startSize;
  do {
    context.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    if (context.measureText(value).width <= maxWidth) return size;
    size -= 2;
  } while (size > minimumSize);
  return size;
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, color: string, weight = 700, minimumSize = 18) {
  fitText(context, text, maxWidth, size, weight, minimumSize);
  context.fillStyle = color;
  context.fillText(text, x, y, maxWidth);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG template could not be loaded.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function loadOptionalImage(source?: string): Promise<HTMLImageElement | null> {
  if (!source) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => resolve(null), 5000);
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };
    image.src = source;
  });
}

function drawContainedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - renderedWidth) / 2, y + (height - renderedHeight) / 2, renderedWidth, renderedHeight);
}

function sourceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function graphicEventMeta(model: GraphicModel) {
  const league = sourceRecord(model.source.league);
  const result = sourceRecord(model.source.result);
  return {
    leagueName: typeof league.name === 'string' ? league.name : 'RaceVora',
    raceDate: typeof result.race_date === 'string' ? result.race_date : null,
    round: typeof result.round === 'number' ? result.round : null,
  };
}

function formatGraphicDate(value: string | null): string {
  if (!value) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

function drawCalendarIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(x, y + 4, 24, 22);
  context.beginPath();
  context.moveTo(x, y + 11);
  context.lineTo(x + 24, y + 11);
  context.moveTo(x + 6, y);
  context.lineTo(x + 6, y + 8);
  context.moveTo(x + 18, y);
  context.lineTo(x + 18, y + 8);
  context.stroke();
  context.restore();
}

function drawGlobeIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 11, 0, Math.PI * 2);
  context.moveTo(x - 11, y);
  context.lineTo(x + 11, y);
  context.moveTo(x, y - 11);
  context.bezierCurveTo(x - 7, y - 4, x - 7, y + 4, x, y + 11);
  context.moveTo(x, y - 11);
  context.bezierCurveTo(x + 7, y - 4, x + 7, y + 4, x, y + 11);
  context.stroke();
  context.restore();
}

function drawInstagramIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(x - 11, y - 11, 22, 22);
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.moveTo(x + 7, y - 7);
  context.arc(x + 7, y - 7, 1, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawLeagueIdentity(context: CanvasRenderingContext2D, name: string, logo: HTMLImageElement | null, theme: GraphicTheme) {
  if (logo) {
    drawContainedImage(context, logo, 44, 32, 58, 52);
  } else {
    context.fillStyle = theme.primary;
    context.beginPath();
    context.moveTo(44, 38);
    context.lineTo(96, 38);
    context.lineTo(86, 82);
    context.lineTo(34, 82);
    context.closePath();
    context.fill();
    context.textAlign = 'center';
    drawText(context, name.trim().charAt(0).toUpperCase() || 'R', 65, 60, 42, 24, theme.onPrimary, 900, 18);
  }
  context.textAlign = 'left';
  drawText(context, name.toUpperCase(), 118, 60, 468, 29, theme.text, 750, 18);
}

function leagueInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'RV';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word.charAt(0)).join('').toUpperCase();
}

function drawRaceVoraMark(context: CanvasRenderingContext2D, x: number, y: number, theme: GraphicTheme) {
  context.save();
  context.translate(x, y);
  context.fillStyle = theme.primary;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(96, 0);
  context.lineTo(79, 18);
  context.lineTo(25, 18);
  context.lineTo(39, 36);
  context.lineTo(66, 36);
  context.lineTo(43, 68);
  context.closePath();
  context.fill();
  context.fillStyle = theme.secondary;
  context.beginPath();
  context.moveTo(14, 28);
  context.lineTo(36, 28);
  context.lineTo(62, 64);
  context.lineTo(50, 82);
  context.closePath();
  context.fill();
  context.fillStyle = theme.accent;
  context.beginPath();
  context.moveTo(96, 12);
  context.lineTo(96, 40);
  context.lineTo(66, 82);
  context.lineTo(52, 82);
  context.closePath();
  context.fill();
  context.restore();
}

function drawRaceVoraFooter(context: CanvasRenderingContext2D, theme: GraphicTheme) {
  drawRaceVoraMark(context, 48, 1160, theme);
  context.textAlign = 'left';
  drawText(context, 'FROM', 174, 1176, 360, 34, theme.text, 850, 22);
  drawText(context, 'RACE TO RESULT', 174, 1220, 410, 34, theme.primary, 850, 21);

  context.fillStyle = theme.line;
  context.fillRect(612, 1150, 1, 102);
  drawText(context, 'RACEVORA', 662, 1170, 330, 25, theme.primary, 800, 18);
  drawText(context, 'THE OPERATING SYSTEM', 662, 1208, 360, 20, theme.text, 550, 15);
  drawText(context, 'FOR SIM RACING LEAGUES', 662, 1236, 360, 20, theme.text, 550, 15);

  context.fillStyle = theme.line;
  context.fillRect(36, 1290, 1008, 1);
  drawGlobeIcon(context, 304, 1320, theme.primary);
  drawText(context, 'RACEVORA.COM', 330, 1320, 230, 20, theme.text, 550, 15);
  context.fillStyle = theme.line;
  context.fillRect(552, 1305, 1, 30);
  drawInstagramIcon(context, 602, 1320, theme.primary);
  drawText(context, '@RACE.VORA', 628, 1320, 220, 20, theme.text, 550, 15);
}

async function drawRaceResultPortrait(context: CanvasRenderingContext2D, model: GraphicModel, theme: GraphicTheme, options: GraphicRenderOptions) {
  const meta = graphicEventMeta(model);
  const brandName = options.branding?.name?.trim() || meta.leagueName;
  const [image, leagueLogo] = await Promise.all([
    loadSvgImage(resolveRaceResultPortraitTemplate(theme)),
    loadOptionalImage(options.branding?.logoUrl),
  ]);
  context.drawImage(image, 0, 0, 1080, 1350);
  context.textBaseline = 'middle';

  context.save();
  context.globalAlpha = 0.1;
  context.textAlign = 'right';
  drawText(context, leagueInitials(brandName), 1036, 228, 430, 168, theme.text, 900, 72);
  context.restore();

  drawLeagueIdentity(context, brandName, leagueLogo, theme);
  context.textAlign = 'right';
  drawCalendarIcon(context, 864, 46, theme.primary);
  drawText(context, formatGraphicDate(meta.raceDate), 1036, 60, 136, 22, theme.primary, 750, 16);
  context.textAlign = 'left';
  drawText(context, `ROUND ${meta.round ?? '—'}`, 44, 112, 340, 23, theme.primary, 800, 16);
  drawText(context, 'RACE', 44, 180, 520, 82, theme.text, 900, 44);
  drawText(context, 'RESULT', 44, 260, 570, 82, theme.primary, 900, 44);
  context.fillStyle = theme.primary;
  context.fillRect(44, 325, 12, 12);
  drawText(context, `${model.title} · ${model.subtitle}`.toUpperCase(), 72, 331, 748, 21, theme.text, 650, 14);
  if ((options.pageCount ?? 1) > 1 && options.pageLabel) {
    context.textAlign = 'right';
    drawText(context, options.pageLabel.toUpperCase(), 1036, 331, 194, 18, theme.primary, 800, 13);
  }

  context.textAlign = 'left';
  drawText(context, 'POS', 62, 419, 66, 17, theme.muted, 650, 13);
  drawText(context, 'DRIVER', 164, 419, 250, 17, theme.muted, 650, 13);
  drawText(context, 'TEAM', 496, 419, 300, 17, theme.muted, 650, 13);
  context.textAlign = 'right';
  drawText(context, 'PTS', 1014, 419, 80, 17, theme.muted, 650, 13);

  const tableTop = 451;
  const rowHeight = 655 / 11;
  model.rows.slice(0, 11).forEach((row, index) => {
    const centerY = tableTop + rowHeight * (index + 0.5);
    if (index > 0) {
      context.fillStyle = theme.line;
      context.globalAlpha = 0.62;
      context.fillRect(36, Math.round(centerY - rowHeight / 2), 1008, 1);
      context.globalAlpha = 1;
    }
    const numericRank = Number.parseInt(row.rank, 10);
    const podium = Number.isFinite(numericRank) && numericRank <= 3;
    context.fillStyle = podium ? theme.primary : theme.secondary;
    context.globalAlpha = podium ? 0.92 : 0.24;
    context.beginPath();
    context.moveTo(36, centerY - rowHeight / 2);
    context.lineTo(134, centerY - rowHeight / 2);
    context.lineTo(119, centerY + rowHeight / 2);
    context.lineTo(36, centerY + rowHeight / 2);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    context.textAlign = 'center';
    drawText(context, row.rank.replace(/^0/, ''), 78, centerY, 64, 28, podium ? theme.onPrimary : theme.text, 900, 18);
    context.textAlign = 'left';
    drawText(context, row.primary.toUpperCase(), 164, centerY, 282, 24, theme.text, 800, 15);
    drawText(context, row.secondary.toUpperCase(), 496, centerY, 396, 19, theme.text, 550, 13);
    context.textAlign = 'right';
    drawText(context, row.value, 1014, centerY, 76, 22, theme.primary, 850, 14);
  });

  drawRaceVoraFooter(context, theme);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
}

function drawDefaultGraphic(context: CanvasRenderingContext2D, model: GraphicModel, format: GraphicFormat, theme: GraphicTheme, options: GraphicRenderOptions) {
  const { width, height } = GRAPHIC_DIMENSIONS[format];
  const isLandscape = format === 'landscape';
  const margin = isLandscape ? 112 : 82;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.background);
  gradient.addColorStop(0.58, theme.surface);
  gradient.addColorStop(1, mixGraphicColors(theme.background, theme.secondary, 0.12));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = theme.primary;
  context.fillRect(0, 0, width, 10);

  context.globalAlpha = 0.12;
  context.fillStyle = theme.accent;
  context.beginPath();
  context.arc(width + 40, -40, 330, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  drawText(context, options.branding?.name?.toUpperCase() || 'RACEVORA', margin, 94, 560, 34, theme.primary, 800);
  context.textAlign = 'right';
  drawText(context, model.eyebrow.toUpperCase(), width - margin, 94, 500, 26, theme.muted, 700);
  if ((options.pageCount ?? 1) > 1 && options.pageLabel) drawText(context, options.pageLabel.toUpperCase(), width - margin, 132, 320, 20, theme.accent, 800, 15);
  context.textAlign = 'left';

  const titleY = format === 'story' ? 310 : isLandscape ? 230 : 250;
  drawText(context, model.title, margin, titleY, width - margin * 2, format === 'story' ? 92 : isLandscape ? 88 : 80, theme.text, 800, 30);
  drawText(context, model.subtitle, margin, titleY + 68, width - margin * 2, 32, theme.muted, 500, 20);
  if (model.hero) {
    const heroY = format === 'story' ? 760 : isLandscape ? 540 : 610;
    drawText(context, model.hero, margin, heroY, width - margin * 2, format === 'story' ? 116 : isLandscape ? 104 : 96, theme.secondary, 800, 30);
  }
  if (model.rows.length) {
    const availableHeight = height - titleY - 250;
    const rowHeight = Math.min(format === 'story' ? 118 : isLandscape ? 82 : 88, Math.floor(availableHeight / model.rows.length));
    const startY = titleY + 145;
    model.rows.forEach((row, index) => {
      const y = startY + rowHeight * index;
      if (index > 0) {
        context.fillStyle = theme.line;
        context.fillRect(margin, y - Math.min(39, rowHeight / 2), width - margin * 2, 1);
      }
      drawText(context, row.rank, margin, y, 90, 30, theme.primary, 800, 17);
      drawText(context, row.primary, margin + 110, y, isLandscape ? 900 : 470, 34, theme.text, 700, 18);
      drawText(context, row.secondary, margin + 110, y + Math.min(32, rowHeight * 0.42), isLandscape ? 860 : 430, 21, theme.muted, 500, 14);
      context.textAlign = 'right';
      drawText(context, row.value, width - margin, y + 7, isLandscape ? 420 : 270, 27, theme.text, 700, 16);
      context.textAlign = 'left';
    });
  }

  context.fillStyle = theme.line;
  context.fillRect(margin, height - 116, width - margin * 2, 1);
  drawText(context, model.footer, margin, height - 66, width - margin * 2, 23, theme.muted, 500, 15);
  context.textAlign = 'right';
  drawText(context, 'racevora.com', width - margin, height - 66, 260, 23, theme.primary, 700, 15);
  context.textAlign = 'left';
}

export async function drawGraphic(canvas: HTMLCanvasElement, model: GraphicModel, format: GraphicFormat, options: GraphicRenderOptions = {}) {
  const dimensions = GRAPHIC_DIMENSIONS[format];
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG renderer is not available.');
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  const theme = options.theme ?? readGraphicTheme();
  if (model.type === 'race_result' && format === 'portrait') {
    await drawRaceResultPortrait(context, model, theme, options);
    return;
  }
  drawDefaultGraphic(context, model, format, theme, options);
}

export async function renderGraphicPng(model: GraphicModel, format: GraphicFormat, options: GraphicRenderOptions = {}): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await drawGraphic(canvas, model, format, options);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
}

export function downloadPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
