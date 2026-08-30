import { THEME_PRESETS } from '../league/leagueBranding';
import type { GraphicFormat, GraphicModel } from './graphics';
import raceResultPortraitTemplate from './templates/race-result-portrait.svg?raw';

export const GRAPHIC_DIMENSIONS: Record<GraphicFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

const RACEVORA_FOOTER_LOGO_URL = '/assets/graphics/racevora-logo-white.png';
const LOCAL_FLAG_DIRECTORY = '/v1-assets/images/flags';

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
  const achievement = sourceRecord(model.source.achievement);
  return {
    leagueName: typeof league.name === 'string' ? league.name : 'RaceVora',
    raceDate: typeof result.race_date === 'string' ? result.race_date : typeof achievement.unlocked_at === 'string' ? achievement.unlocked_at : null,
    round: typeof result.round === 'number' ? result.round : null,
    countryCode: typeof result.country_code === 'string' && /^[a-z]{2}$/i.test(result.country_code) ? result.country_code.toLowerCase() : null,
  };
}

function countryFlagUrl(countryCode: string | null): string | undefined {
  return countryCode ? `${LOCAL_FLAG_DIRECTORY}/${countryCode}.svg` : undefined;
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

function drawCountryFlag(context: CanvasRenderingContext2D, image: HTMLImageElement | null, countryCode: string | null, x: number, centerY: number, theme: GraphicTheme, scale: number) {
  const width = 36 * scale;
  const height = 25 * scale;
  const y = centerY - height / 2;
  context.save();
  context.fillStyle = theme.surfaceAlt;
  context.fillRect(x, y, width, height);
  if (image) {
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    drawContainedImage(context, image, x, y, width, height);
  } else if (countryCode) {
    context.textAlign = 'center';
    drawText(context, countryCode.toUpperCase(), x + width / 2, centerY, width - 4 * scale, 14 * scale, theme.text, 800, 10);
  }
  context.restore();
  context.strokeStyle = theme.line;
  context.lineWidth = Math.max(1, scale);
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

type PilotLayout = {
  width: number;
  height: number;
  margin: number;
  headerY: number;
  eyebrowY: number;
  titleFirstY: number;
  titleSecondY: number;
  subtitleY: number;
  dataTop: number;
  dataBottom: number;
  footerTop: number;
  titleSize: number;
  scale: number;
};

function pilotLayout(format: GraphicFormat): PilotLayout {
  const { width, height } = GRAPHIC_DIMENSIONS[format];
  if (format === 'story') return { width, height, margin: 48, headerY: 70, eyebrowY: 142, titleFirstY: 230, titleSecondY: 330, subtitleY: 414, dataTop: 490, dataBottom: 1620, footerTop: 1660, titleSize: 102, scale: 1.16 };
  if (format === 'landscape') return { width, height, margin: 64, headerY: 54, eyebrowY: 104, titleFirstY: 162, titleSecondY: 226, subtitleY: 278, dataTop: 324, dataBottom: 872, footerTop: 900, titleSize: 70, scale: 1.02 };
  if (format === 'square') return { width, height, margin: 36, headerY: 54, eyebrowY: 104, titleFirstY: 166, titleSecondY: 230, subtitleY: 288, dataTop: 336, dataBottom: 888, footerTop: 910, titleSize: 70, scale: 0.94 };
  return { width, height, margin: 36, headerY: 60, eyebrowY: 112, titleFirstY: 180, titleSecondY: 260, subtitleY: 331, dataTop: 386, dataBottom: 1106, footerTop: 1128, titleSize: 82, scale: 1 };
}

function drawLeagueIdentity(context: CanvasRenderingContext2D, name: string, logo: HTMLImageElement | null, theme: GraphicTheme, layout: PilotLayout) {
  const markSize = 52 * layout.scale;
  const markX = layout.margin + 8;
  const markY = layout.headerY - markSize / 2;
  if (logo) {
    drawContainedImage(context, logo, markX, markY, markSize * 1.12, markSize);
  } else {
    context.fillStyle = theme.primary;
    context.beginPath();
    context.moveTo(markX, markY + 6);
    context.lineTo(markX + markSize, markY + 6);
    context.lineTo(markX + markSize - 10 * layout.scale, markY + markSize - 2);
    context.lineTo(markX - 10 * layout.scale, markY + markSize - 2);
    context.closePath();
    context.fill();
    context.textAlign = 'center';
    drawText(context, name.trim().charAt(0).toUpperCase() || 'R', markX + markSize / 2 - 5 * layout.scale, layout.headerY, markSize * 0.8, 24 * layout.scale, theme.onPrimary, 900, 16);
  }
  context.textAlign = 'left';
  drawText(context, name.toUpperCase(), markX + markSize + 20 * layout.scale, layout.headerY, Math.min(layout.width * 0.44, 680), 29 * layout.scale, theme.text, 750, 17);
}

function leagueInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'RV';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word.charAt(0)).join('').toUpperCase();
}

function drawRaceVoraFooter(context: CanvasRenderingContext2D, theme: GraphicTheme, layout: PilotLayout, raceVoraLogo: HTMLImageElement | null) {
  const footerHeight = layout.height - layout.footerTop;
  const footerScale = Math.max(0.68, Math.min(1.12, footerHeight / 222));
  const brandTop = layout.footerTop + Math.max(20, footerHeight * 0.14);
  const bottomY = layout.height - Math.max(28, footerHeight * 0.12);
  const dividerY = layout.height - Math.max(56, footerHeight * 0.27);
  const leftX = layout.margin + 12;
  const rightX = Math.max(layout.width * 0.59, leftX + 500 * footerScale);

  if (raceVoraLogo) drawContainedImage(context, raceVoraLogo, leftX - 10 * footerScale, brandTop - 8 * footerScale, 112 * footerScale, 92 * footerScale);
  context.textAlign = 'left';
  drawText(context, 'FROM', leftX + 126 * footerScale, brandTop + 18 * footerScale, 360 * footerScale, 34 * footerScale, theme.text, 850, 18);
  drawText(context, 'RACE TO RESULT', leftX + 126 * footerScale, brandTop + 62 * footerScale, 410 * footerScale, 34 * footerScale, theme.primary, 850, 17);

  context.fillStyle = theme.line;
  context.fillRect(rightX - 46 * footerScale, brandTop - 10 * footerScale, 1, 102 * footerScale);
  drawText(context, 'RACEVORA', rightX, brandTop + 12 * footerScale, layout.width - rightX - layout.margin, 25 * footerScale, theme.primary, 800, 15);
  drawText(context, 'THE OPERATING SYSTEM', rightX, brandTop + 50 * footerScale, layout.width - rightX - layout.margin, 20 * footerScale, theme.text, 550, 13);
  drawText(context, 'FOR SIM RACING LEAGUES', rightX, brandTop + 78 * footerScale, layout.width - rightX - layout.margin, 20 * footerScale, theme.text, 550, 13);

  context.fillStyle = theme.line;
  context.fillRect(layout.margin, dividerY, layout.width - layout.margin * 2, 1);
  const contactCenter = layout.width / 2;
  drawGlobeIcon(context, contactCenter - 250 * footerScale, bottomY, theme.primary);
  drawText(context, 'RACEVORA.COM', contactCenter - 224 * footerScale, bottomY, 230 * footerScale, 20 * footerScale, theme.text, 550, 13);
  context.fillStyle = theme.line;
  context.fillRect(contactCenter, bottomY - 15 * footerScale, 1, 30 * footerScale);
  drawInstagramIcon(context, contactCenter + 50 * footerScale, bottomY, theme.primary);
  drawText(context, '@RACE.VORA', contactCenter + 76 * footerScale, bottomY, 220 * footerScale, 20 * footerScale, theme.text, 550, 13);
}

function drawPilotBackdrop(context: CanvasRenderingContext2D, layout: PilotLayout, theme: GraphicTheme) {
  const { width, height, margin, dataTop, dataBottom, footerTop } = layout;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.background);
  gradient.addColorStop(0.56, theme.surface);
  gradient.addColorStop(1, theme.background);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const sweep = context.createLinearGradient(width, 0, width * 0.48, layout.dataTop);
  sweep.addColorStop(0, mixGraphicColors(theme.background, theme.primary, 0.42));
  sweep.addColorStop(0.58, mixGraphicColors(theme.background, theme.secondary, 0.18));
  sweep.addColorStop(1, theme.background);
  context.fillStyle = sweep;
  context.beginPath();
  context.moveTo(width, 0);
  context.lineTo(width * 0.64, 0);
  context.lineTo(width * 0.47, dataTop - 36);
  context.lineTo(width, dataTop - 36);
  context.closePath();
  context.fill();

  context.save();
  context.globalAlpha = 0.12;
  context.fillStyle = theme.secondary;
  context.beginPath();
  context.moveTo(width * 0.46, dataTop - 36);
  context.lineTo(width * 0.65, 0);
  context.lineTo(width * 0.71, 0);
  context.lineTo(width * 0.53, dataTop - 36);
  context.closePath();
  context.fill();
  context.restore();

  const panel = context.createLinearGradient(margin, dataTop, width - margin, dataBottom);
  panel.addColorStop(0, mixGraphicColors(theme.surface, theme.secondary, 0.12));
  panel.addColorStop(0.28, mixGraphicColors(theme.background, theme.surface, 0.42));
  panel.addColorStop(1, mixGraphicColors(theme.background, theme.surfaceAlt, 0.22));
  context.fillStyle = panel;
  context.fillRect(margin, dataTop, width - margin * 2, dataBottom - dataTop);
  context.strokeStyle = mixGraphicColors(theme.line, theme.primary, 0.18);
  context.lineWidth = 1;
  context.strokeRect(margin + 0.5, dataTop + 0.5, width - margin * 2 - 1, dataBottom - dataTop - 1);

  const footer = context.createLinearGradient(0, footerTop, width, height);
  footer.addColorStop(0, mixGraphicColors(theme.surfaceAlt, theme.background, 0.46));
  footer.addColorStop(0.5, theme.background);
  footer.addColorStop(1, theme.surface);
  context.fillStyle = footer;
  context.fillRect(0, footerTop, width, height - footerTop);

  context.save();
  context.strokeStyle = theme.primary;
  context.lineWidth = 7 * layout.scale;
  context.globalAlpha = 0.58;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(width * 0.57, dataTop - 74 * layout.scale);
  context.bezierCurveTo(width * 0.68, dataTop - 126 * layout.scale, width * 0.7, 84 * layout.scale, width * 0.82, 70 * layout.scale);
  context.bezierCurveTo(width * 0.9, 58 * layout.scale, width * 0.95, 84 * layout.scale, width, 112 * layout.scale);
  context.stroke();
  context.setLineDash([3 * layout.scale, 14 * layout.scale]);
  context.lineWidth = 2 * layout.scale;
  context.globalAlpha = 0.48;
  context.beginPath();
  context.moveTo(width * 0.57, dataTop - 52 * layout.scale);
  context.bezierCurveTo(width * 0.68, dataTop - 104 * layout.scale, width * 0.7, 106 * layout.scale, width * 0.82, 92 * layout.scale);
  context.bezierCurveTo(width * 0.9, 80 * layout.scale, width * 0.95, 106 * layout.scale, width, 134 * layout.scale);
  context.stroke();
  context.restore();

  context.fillStyle = theme.primary;
  context.fillRect(margin, dataTop, Math.min(152 * layout.scale, (width - margin * 2) * 0.18), 5 * layout.scale);
  context.globalAlpha = 0.65;
  context.fillRect(width - margin - Math.min(152 * layout.scale, (width - margin * 2) * 0.18), dataTop, Math.min(152 * layout.scale, (width - margin * 2) * 0.18), 5 * layout.scale);
  context.globalAlpha = 1;
}

const PILOT_TITLE_LINES: Record<GraphicModel['type'], [string, string]> = {
  race_result: ['RACE', 'RESULT'],
  podium: ['RACE', 'PODIUM'],
  winner: ['RACE', 'WINNER'],
  driver_standings: ['DRIVER', 'STANDINGS'],
  team_standings: ['TEAM', 'STANDINGS'],
  achievement: ['CAREER', 'ACHIEVEMENT'],
};

function drawPilotHeader(context: CanvasRenderingContext2D, model: GraphicModel, theme: GraphicTheme, options: GraphicRenderOptions, layout: PilotLayout, logo: HTMLImageElement | null, countryFlag: HTMLImageElement | null) {
  const meta = graphicEventMeta(model);
  const brandName = options.branding?.name?.trim() || meta.leagueName;
  const [firstLine, secondLine] = PILOT_TITLE_LINES[model.type];

  context.save();
  context.globalAlpha = 0.09;
  context.textAlign = 'right';
  drawText(context, leagueInitials(brandName), layout.width - layout.margin, (layout.titleFirstY + layout.titleSecondY) / 2, layout.width * 0.42, layout.titleSize * 2.05, theme.text, 900, 62);
  context.restore();

  drawLeagueIdentity(context, brandName, logo, theme, layout);
  context.textAlign = 'right';
  const calendarX = layout.width - layout.margin - 172 * layout.scale;
  drawCalendarIcon(context, calendarX, layout.headerY - 14 * layout.scale, theme.primary);
  drawText(context, formatGraphicDate(meta.raceDate), layout.width - layout.margin, layout.headerY, 136 * layout.scale, 22 * layout.scale, theme.primary, 750, 14);
  context.textAlign = 'left';
  drawText(context, model.type === 'achievement' ? model.eyebrow.toUpperCase() : `ROUND ${meta.round ?? '—'}`, layout.margin + 8, layout.eyebrowY, 360 * layout.scale, 23 * layout.scale, theme.primary, 800, 14);
  drawText(context, firstLine, layout.margin + 8, layout.titleFirstY, layout.width * 0.54, layout.titleSize, theme.text, 900, 34);
  drawText(context, secondLine, layout.margin + 8, layout.titleSecondY, layout.width * 0.58, layout.titleSize, theme.primary, 900, 34);
  const eventMarkX = layout.margin + 8;
  const eventTextX = layout.margin + 58 * layout.scale;
  if (meta.countryCode) drawCountryFlag(context, countryFlag, meta.countryCode, eventMarkX, layout.subtitleY, theme, layout.scale);
  else {
    context.fillStyle = theme.primary;
    context.fillRect(eventMarkX, layout.subtitleY - 6 * layout.scale, 12 * layout.scale, 12 * layout.scale);
  }
  const pageReservedWidth = (options.pageCount ?? 1) > 1 ? layout.width * 0.22 : 0;
  drawText(context, `${model.title} · ${model.subtitle}`.toUpperCase(), eventTextX, layout.subtitleY, layout.width - eventTextX - layout.margin - pageReservedWidth, 21 * layout.scale, theme.text, 650, 13);
  if ((options.pageCount ?? 1) > 1 && options.pageLabel) {
    context.textAlign = 'right';
    drawText(context, options.pageLabel.toUpperCase(), layout.width - layout.margin - 8, layout.subtitleY, layout.width * 0.2, 18 * layout.scale, theme.primary, 800, 12);
    context.textAlign = 'left';
  }
}

function drawPilotRows(context: CanvasRenderingContext2D, model: GraphicModel, theme: GraphicTheme, layout: PilotLayout) {
  const isRaceResult = model.type === 'race_result';
  const isStandings = model.type === 'driver_standings' || model.type === 'team_standings';
  const isPodium = model.type === 'podium';
  const headerHeight = 64 * layout.scale;
  const rowTop = layout.dataTop + headerHeight;
  const availableHeight = layout.dataBottom - rowTop;
  const maximumRowHeight = isPodium ? 178 * layout.scale : 104 * layout.scale;
  const rowHeight = Math.min(maximumRowHeight, availableHeight / Math.max(1, model.rows.length));
  const contentWidth = layout.width - layout.margin * 2;
  const rankWidth = 98 * layout.scale;
  const valueWidth = 112 * layout.scale;
  const detailWidth = isRaceResult ? 158 * layout.scale : isStandings ? 180 * layout.scale : 0;
  const driverWidth = isStandings ? contentWidth - rankWidth - detailWidth - valueWidth : contentWidth * 0.34;
  const rankRight = layout.margin + rankWidth;
  const driverLeft = rankRight + 28 * layout.scale;
  const teamLeft = layout.margin + rankWidth + driverWidth;
  const valueLeft = layout.width - layout.margin - valueWidth;
  const detailLeft = valueLeft - detailWidth;
  const detailRight = valueLeft - 22 * layout.scale;
  const valueRight = layout.width - layout.margin - 18 * layout.scale;

  context.save();
  context.globalAlpha = 0.34;
  context.fillStyle = theme.surfaceAlt;
  context.fillRect(layout.margin, layout.dataTop, contentWidth, headerHeight);
  context.restore();
  context.fillStyle = theme.line;
  context.fillRect(layout.margin, rowTop, contentWidth, 1);
  [rankRight, ...(isStandings ? [detailLeft, valueLeft] : [teamLeft, ...(isRaceResult ? [detailLeft] : []), valueLeft])].forEach((x) => context.fillRect(Math.round(x), rowTop, 1, layout.dataBottom - rowTop));

  const headerY = layout.dataTop + headerHeight / 2;
  context.textAlign = 'left';
  drawText(context, 'POS', layout.margin + 24 * layout.scale, headerY, rankWidth - 36 * layout.scale, 17 * layout.scale, theme.muted, 650, 11);
  drawText(context, model.type === 'team_standings' ? 'TEAM' : 'DRIVER', driverLeft, headerY, Math.max(80, (isStandings ? detailLeft : teamLeft) - driverLeft - 16), 17 * layout.scale, theme.muted, 650, 11);
  if (!isStandings) drawText(context, 'TEAM', teamLeft + 28 * layout.scale, headerY, Math.max(80, (isRaceResult ? detailLeft : valueLeft) - teamLeft - 36), 17 * layout.scale, theme.muted, 650, 11);
  if (isRaceResult || isStandings) {
    context.textAlign = 'right';
    drawText(context, isRaceResult ? 'TIME' : 'WINS', detailRight, headerY, detailWidth - 32 * layout.scale, 17 * layout.scale, theme.muted, 650, 11);
  }
  context.textAlign = 'right';
  drawText(context, 'PTS', valueRight, headerY, valueWidth - 28 * layout.scale, 17 * layout.scale, theme.muted, 650, 11);

  model.rows.slice(0, 11).forEach((row, index) => {
    const centerY = rowTop + rowHeight * (index + 0.5);
    if (index > 0) {
      context.save();
      context.globalAlpha = 0.62;
      context.fillStyle = theme.line;
      context.fillRect(layout.margin, Math.round(centerY - rowHeight / 2), contentWidth, 1);
      context.restore();
    }
    const numericRank = Number.parseInt(row.rank.replace(/^P/i, ''), 10);
    const podium = Number.isFinite(numericRank) && numericRank <= 3;
    context.save();
    context.fillStyle = podium ? theme.primary : theme.secondary;
    context.globalAlpha = podium ? 0.92 : 0.24;
    context.beginPath();
    context.moveTo(layout.margin, centerY - rowHeight / 2);
    context.lineTo(rankRight, centerY - rowHeight / 2);
    context.lineTo(rankRight - 15 * layout.scale, centerY + rowHeight / 2);
    context.lineTo(layout.margin, centerY + rowHeight / 2);
    context.closePath();
    context.fill();
    context.restore();

    const primarySize = Math.min(isPodium ? 31 : 25, rowHeight * 0.42) * layout.scale;
    const secondarySize = Math.min(isPodium ? 22 : 19, rowHeight * 0.3) * layout.scale;
    context.textAlign = 'center';
    drawText(context, row.rank.replace(/^0/, ''), layout.margin + rankWidth * 0.44, centerY, rankWidth * 0.62, Math.min(32 * layout.scale, rowHeight * 0.52), podium ? theme.onPrimary : theme.text, 900, 14);
    context.textAlign = 'left';
    drawText(context, row.primary.toUpperCase(), driverLeft, centerY, Math.max(90, (isStandings ? detailLeft : teamLeft) - driverLeft - 20), primarySize, theme.text, 800, 13);
    if (!isStandings) drawText(context, row.secondary.toUpperCase(), teamLeft + 28 * layout.scale, centerY, Math.max(80, (isRaceResult ? detailLeft : valueLeft) - teamLeft - 48), secondarySize, theme.text, 550, 11);
    if (isRaceResult || isStandings) {
      context.textAlign = 'right';
      drawText(context, isRaceResult ? row.detail ?? '—' : row.secondary.toUpperCase(), detailRight, centerY, detailWidth - 34 * layout.scale, secondarySize, isRaceResult ? theme.text : theme.muted, 650, 11);
    }
    context.textAlign = 'right';
    drawText(context, row.value, valueRight, centerY, valueWidth - 30 * layout.scale, 22 * layout.scale, theme.primary, 850, 12);
  });
  context.textAlign = 'left';
}

function drawPilotFeature(context: CanvasRenderingContext2D, model: GraphicModel, theme: GraphicTheme, layout: PilotLayout) {
  const panelHeight = layout.dataBottom - layout.dataTop;
  const result = sourceRecord(model.source.result);
  const winner = sourceRecord(result.winner);
  const isWinner = model.type === 'winner';
  const badge = isWinner ? 'P1' : model.hero ?? '—';
  const detail = isWinner && typeof winner.raceTime === 'string' && winner.raceTime.trim() ? `TIME · ${winner.raceTime}` : model.subtitle.toUpperCase();

  context.save();
  context.globalAlpha = 0.1;
  context.textAlign = 'right';
  drawText(context, badge, layout.width - layout.margin - 34 * layout.scale, layout.dataTop + panelHeight * 0.5, layout.width * 0.46, Math.min(280 * layout.scale, panelHeight * 0.5), theme.primary, 900, 74);
  context.restore();
  context.fillStyle = theme.primary;
  context.fillRect(layout.margin, layout.dataTop, Math.min(220 * layout.scale, (layout.width - layout.margin * 2) * 0.24), 7 * layout.scale);
  drawText(context, model.eyebrow.toUpperCase(), layout.margin + 42 * layout.scale, layout.dataTop + panelHeight * 0.24, layout.width * 0.48, 24 * layout.scale, theme.primary, 800, 15);
  drawText(context, model.title.toUpperCase(), layout.margin + 42 * layout.scale, layout.dataTop + panelHeight * 0.45, layout.width * 0.66, Math.min(76 * layout.scale, panelHeight * 0.16), theme.text, 900, 28);
  drawText(context, isWinner ? (model.hero ?? '').toUpperCase() : model.subtitle.toUpperCase(), layout.margin + 42 * layout.scale, layout.dataTop + panelHeight * 0.62, layout.width * 0.58, 30 * layout.scale, theme.muted, 650, 16);
  drawText(context, detail, layout.margin + 42 * layout.scale, layout.dataTop + panelHeight * 0.76, layout.width * 0.5, 22 * layout.scale, theme.primary, 750, 14);
}

async function drawPilotGraphic(context: CanvasRenderingContext2D, model: GraphicModel, format: GraphicFormat, theme: GraphicTheme, options: GraphicRenderOptions) {
  const layout = pilotLayout(format);
  const meta = graphicEventMeta(model);
  const [pilotTemplate, leagueLogo, raceVoraLogo, countryFlag] = await Promise.all([
    model.type === 'race_result' && format === 'portrait' ? loadSvgImage(resolveRaceResultPortraitTemplate(theme)) : Promise.resolve(null),
    loadOptionalImage(options.branding?.logoUrl),
    loadOptionalImage(RACEVORA_FOOTER_LOGO_URL),
    loadOptionalImage(countryFlagUrl(meta.countryCode)),
  ]);
  if (pilotTemplate) context.drawImage(pilotTemplate, 0, 0, layout.width, layout.height);
  else drawPilotBackdrop(context, layout, theme);

  context.textBaseline = 'middle';
  drawPilotHeader(context, model, theme, options, layout, leagueLogo, countryFlag);
  if (model.rows.length) drawPilotRows(context, model, theme, layout);
  else drawPilotFeature(context, model, theme, layout);
  drawRaceVoraFooter(context, theme, layout, raceVoraLogo);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
}

export async function drawGraphic(canvas: HTMLCanvasElement, model: GraphicModel, format: GraphicFormat, options: GraphicRenderOptions = {}) {
  const dimensions = GRAPHIC_DIMENSIONS[format];
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG renderer is not available.');
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  const theme = options.theme ?? readGraphicTheme();
  await drawPilotGraphic(context, model, format, theme, options);
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
