import type { LeagueSupabaseClient } from '../lib/supabase';

export type ThemePreset = {
  id: number;
  name: string;
  subtitle: string;
  primary: string;
  secondary: string;
  accent: string;
  accent2: string;
  background: string;
  surface: string;
  text: string;
  textOnPrimary: string;
};

export type CustomThemeColors = Pick<ThemePreset,
  'primary' | 'secondary' | 'accent' | 'accent2' | 'background' | 'surface' | 'text' | 'textOnPrimary'
>;

export const CUSTOM_THEME_ID = 12;

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 0, name: 'RaceVora', subtitle: 'RaceVora Violett & Teal', primary: '#35246A', secondary: '#5A32A3', accent: '#2C8FA6', accent2: '#2F6F8A', background: '#021B34', surface: '#0A1F37', text: '#FFFFFF', textOnPrimary: '#FFFFFF' },
  { id: 1, name: 'Turquoise Carbon', subtitle: 'V1 Türkis & Carbon', primary: '#27F4D2', secondary: '#0B0D10', accent: '#C5C7C9', accent2: '#FFFFFF', background: '#060809', surface: '#15181B', text: '#F4F7F8', textOnPrimary: '#08110F' },
  { id: 2, name: 'Papaya Grid', subtitle: 'Papaya & Electric Blue', primary: '#FF8000', secondary: '#2B2D31', accent: '#00AEEF', accent2: '#F5F5F5', background: '#0D0F12', surface: '#1A1D21', text: '#F6F6F6', textOnPrimary: '#101010' },
  { id: 3, name: 'Rosso Corse', subtitle: 'Rot & Gold', primary: '#E8002D', secondary: '#FFFFFF', accent: '#FFD500', accent2: '#111111', background: '#100003', surface: '#240007', text: '#FFFFFF', textOnPrimary: '#FFFFFF' },
  { id: 4, name: 'Neon Glacier', subtitle: 'Pink & Electric Blue', primary: '#FF87BC', secondary: '#00A1E8', accent: '#0057B8', accent2: '#FFFFFF', background: '#07131A', surface: '#0E2530', text: '#FFFFFF', textOnPrimary: '#081015' },
  { id: 5, name: 'Grand Prix Blue', subtitle: 'Blau, Rot & Gelb', primary: '#3671C6', secondary: '#FFFFFF', accent: '#E10600', accent2: '#FFD100', background: '#071322', surface: '#10243D', text: '#FFFFFF', textOnPrimary: '#FFFFFF' },
  { id: 6, name: 'Racing Green', subtitle: 'Grün & Lime', primary: '#229971', secondary: '#00352F', accent: '#C7FF00', accent2: '#D6D2C4', background: '#061A16', surface: '#0D2A24', text: '#FFFFFF', textOnPrimary: '#08100D' },
  { id: 7, name: 'Carbon Pulse', subtitle: 'Signalrot, Carbon & Titan', primary: '#FF2D00', secondary: '#111111', accent: '#A6A6A6', accent2: '#FFFFFF', background: '#090909', surface: '#1A1A1A', text: '#FFFFFF', textOnPrimary: '#111111' },
  { id: 8, name: 'Midnight Charge', subtitle: 'Nachtblau, Signalrot & Rennsportgelb', primary: '#2446C7', secondary: '#D81F2A', accent: '#F6D31A', accent2: '#F4F6FA', background: '#060A1C', surface: '#101A4A', text: '#F7F8FC', textOnPrimary: '#FFFFFF' },
  { id: 9, name: 'Azure Sprint', subtitle: 'Royalblau, Weiß & Signalrot', primary: '#2146C7', secondary: '#F4F6FA', accent: '#E23A45', accent2: '#B8CBFF', background: '#070D20', surface: '#111C3C', text: '#F4F6FA', textOnPrimary: '#FFFFFF' },
  { id: 10, name: 'Velocity Steel', subtitle: 'Stahlgrau, Weiß & Signalrot', primary: '#D72638', secondary: '#20242A', accent: '#F3F4F6', accent2: '#A9AFB7', background: '#0D0F12', surface: '#20242A', text: '#F3F4F6', textOnPrimary: '#FFFFFF' },
  { id: 11, name: 'Golden Crest', subtitle: 'Schwarz, Gold & Chrom', primary: '#C7A24E', secondary: '#111318', accent: '#E2C266', accent2: '#E8EAED', background: '#08090B', surface: '#17191E', text: '#F5F1E8', textOnPrimary: '#111318' },
] as const;

export type LeagueBrandingRuntime = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  subtitle: string;
  theme: ThemePreset;
};

const DEFAULT_THEME = THEME_PRESETS[0];
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstText(settings: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function color(settings: Record<string, unknown>, fallback: string, ...keys: string[]): string {
  const candidate = firstText(settings, ...keys);
  return COLOR_PATTERN.test(candidate) ? candidate.toUpperCase() : fallback;
}

function themePresetId(settings: Record<string, unknown>): number {
  for (const key of ['theme_id', 'theme_preset']) {
    const value = settings[key];
    const candidate = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
    if (Number.isInteger(candidate) && (candidate === CUSTOM_THEME_ID || THEME_PRESETS.some((theme) => theme.id === candidate))) return candidate;
  }
  return DEFAULT_THEME.id;
}

export function customThemeMetadata(theme: CustomThemeColors): Record<string, string> {
  return {
    primary_color: theme.primary,
    secondary_color: theme.secondary,
    accent_color: theme.accent,
    accent_2_color: theme.accent2,
    background_color: theme.background,
    surface_color: theme.surface,
    text_color: theme.text,
    text_on_primary_color: theme.textOnPrimary,
  };
}

export function toCustomThemeColors(theme: ThemePreset): CustomThemeColors {
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    accent: theme.accent,
    accent2: theme.accent2,
    background: theme.background,
    surface: theme.surface,
    text: theme.text,
    textOnPrimary: theme.textOnPrimary,
  };
}

function relativeLuminance(hex: string): number {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function customThemeHasAccessibleContrast(theme: CustomThemeColors): boolean {
  return contrastRatio(theme.text, theme.background) >= 4.5
    && contrastRatio(theme.text, theme.surface) >= 4.5
    && contrastRatio(theme.textOnPrimary, theme.primary) >= 4.5;
}

export function resolveTheme(settingsValue: unknown): ThemePreset {
  const settings = record(settingsValue);
  const themeId = themePresetId(settings);
  const preset = THEME_PRESETS.find((item) => item.id === themeId) ?? DEFAULT_THEME;
  return {
    ...preset,
    id: themeId,
    name: themeId === CUSTOM_THEME_ID ? 'Custom' : preset.name,
    subtitle: themeId === CUSTOM_THEME_ID ? 'Personal colors' : preset.subtitle,
    primary: color(settings, preset.primary, 'primary_color', 'brand_primary'),
    secondary: color(settings, preset.secondary, 'secondary_color', 'brand_secondary'),
    accent: color(settings, preset.accent, 'accent_color', 'brand_accent'),
    accent2: color(settings, preset.accent2, 'accent_2_color', 'brand_accent_2'),
    background: color(settings, preset.background, 'background_color', 'brand_background'),
    surface: color(settings, preset.surface, 'surface_color', 'brand_surface'),
    text: color(settings, preset.text, 'text_color', 'brand_text'),
    textOnPrimary: color(settings, preset.textOnPrimary, 'text_on_primary_color', 'brand_text_on_primary'),
  };
}

export function resolveStoredCustomTheme(metadataValue: unknown, fallback: ThemePreset = DEFAULT_THEME): ThemePreset {
  const metadata = record(metadataValue);
  return resolveTheme({
    theme_id: CUSTOM_THEME_ID,
    ...customThemeMetadata(fallback),
    ...record(metadata.theme_custom),
  });
}

export function resolvePersonalTheme(metadataValue: unknown): ThemePreset {
  const metadata = record(metadataValue);
  const themeId = themePresetId({ theme_id: metadata.theme_preset ?? metadata.theme_id });
  if (themeId === CUSTOM_THEME_ID) return resolveStoredCustomTheme(metadata);
  return resolveTheme({ theme_id: themeId });
}

export function applyLeagueBranding(branding: LeagueBrandingRuntime): void {
  const root = document.documentElement;
  const { theme } = branding;
  const variables: Record<string, string> = {
    '--brand-primary': theme.primary,
    '--brand-secondary': theme.secondary,
    '--brand-accent': theme.accent,
    '--brand-accent-2': theme.accent2,
    '--brand-background': theme.background,
    '--brand-surface': theme.surface,
    '--brand-text': theme.text,
    '--brand-on-primary': theme.textOnPrimary,
  };
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
  root.style.backgroundColor = theme.surface;
  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = theme.surface || theme.background;
  root.dataset.leagueTheme = String(theme.id);
  root.dataset.leagueSlug = branding.slug;
  window.dispatchEvent(new CustomEvent('racevora:theme-changed'));
}

export async function loadLeagueBrandingRuntime(client: LeagueSupabaseClient, leagueSlug: string): Promise<LeagueBrandingRuntime> {
  const response = await client.from('leagues').select('id,name,slug,logo_url,settings').eq('slug', leagueSlug).single();
  if (response.error) throw response.error;
  const settings = record(response.data.settings);
  return {
    id: response.data.id,
    name: response.data.name,
    slug: response.data.slug,
    logoUrl: firstText(settings, 'brand_logo_url', 'logo_url') || response.data.logo_url || '',
    subtitle: firstText(settings, 'brand_subtitle', 'subtitle') || 'Race Management Platform',
    theme: resolveTheme(settings),
  };
}

export function fallbackLeagueBranding(slug: string): LeagueBrandingRuntime {
  return { id: '', name: 'RaceVora', slug, logoUrl: '', subtitle: 'Race Management Platform', theme: DEFAULT_THEME };
}

export function shouldUseStandardRaceVoraBranding({
  authenticated,
  authLoading,
  leagueSlug,
  pathname,
  search,
}: {
  authenticated: boolean;
  authLoading: boolean;
  leagueSlug: string;
  pathname: string;
  search: string;
}): boolean {
  const params = new URLSearchParams(search);
  const demoMode = params.get('demo') === '1'
    || leagueSlug === 'demo'
    || leagueSlug === 'racevora-demo'
    || pathname === '/owner/demo';
  return authLoading || !authenticated || demoMode;
}
