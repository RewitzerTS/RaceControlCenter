export const PRODUCTION_PROJECT_REFS = ['kjccstcbqygxuqkvdaqw'] as const;
export const V2_PROJECT_REFS = ['znnkwjogtvzwfkwnmawp'] as const;

export type AppEnvironment = 'local' | 'staging' | 'production';

export interface FeatureFlags {
  stewardWorkspace: boolean;
  leagueAdmin: boolean;
  ownerControl: boolean;
  notificationsV2: boolean;
  socialGraphics: boolean;
}

export interface RuntimeEnvironment {
  appEnvironment: AppEnvironment;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseProjectRef: string;
  defaultLeagueSlug: string;
  authCaptcha: {
    enabled: boolean;
    turnstileSiteKey: string | null;
  };
  features: FeatureFlags;
}

type EnvironmentSource = Record<string, string | boolean | undefined>;

const PLACEHOLDER_PATTERNS = [/your-staging/i, /placeholder/i, /example/i, /^<.*>$/];
const LEAGUE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function required(source: EnvironmentSource, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required V2 environment variable: ${key}`);
  }
  return value.trim();
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function parseBoolean(value: string | boolean | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return value?.trim().toLowerCase() === 'true';
}

function authCaptcha(source: EnvironmentSource) {
  const enabled = parseBoolean(source.VITE_AUTH_CAPTCHA_ENABLED);
  const rawSiteKey = source.VITE_TURNSTILE_SITE_KEY;
  const turnstileSiteKey = typeof rawSiteKey === 'string' && rawSiteKey.trim() ? rawSiteKey.trim() : null;
  if (enabled && (!turnstileSiteKey || isPlaceholder(turnstileSiteKey))) {
    throw new Error('V2 CAPTCHA is enabled without a target-specific Turnstile site key.');
  }
  return { enabled, turnstileSiteKey };
}

export function parseEnvironment(source: EnvironmentSource): RuntimeEnvironment {
  const appEnvironment = required(source, 'VITE_APP_ENV');
  if (appEnvironment !== 'local' && appEnvironment !== 'staging' && appEnvironment !== 'production') {
    throw new Error('V2 accepts only local, staging or production environments.');
  }

  const supabaseUrl = required(source, 'VITE_SUPABASE_URL');
  const supabasePublishableKey = required(source, 'VITE_SUPABASE_PUBLISHABLE_KEY');
  const defaultLeagueSlug = required(source, 'VITE_DEFAULT_LEAGUE_SLUG').toLowerCase();

  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabasePublishableKey)) {
    throw new Error('Replace all V2 environment placeholders with target-specific values.');
  }
  if (!LEAGUE_SLUG_PATTERN.test(defaultLeagueSlug)) {
    throw new Error('VITE_DEFAULT_LEAGUE_SLUG must be a lowercase URL-safe slug.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL.');
  }

  const isLocalHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
  if (appEnvironment === 'local' && isLocalHost) {
    return {
      appEnvironment,
      supabaseUrl: parsedUrl.toString().replace(/\/$/, ''),
      supabasePublishableKey,
      supabaseProjectRef: 'local',
      defaultLeagueSlug,
      authCaptcha: authCaptcha(source),
      features: {
        stewardWorkspace: parseBoolean(source.VITE_FEATURE_STEWARD_WORKSPACE),
        leagueAdmin: parseBoolean(source.VITE_FEATURE_LEAGUE_ADMIN),
        ownerControl: parseBoolean(source.VITE_FEATURE_OWNER_CONTROL, true),
        notificationsV2: parseBoolean(source.VITE_FEATURE_NOTIFICATIONS_V2, true),
        socialGraphics: parseBoolean(source.VITE_FEATURE_SOCIAL_GRAPHICS, true),
      },
    };
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('Hosted V2 environments must use an HTTPS Supabase project URL.');
  }

  const projectRef = parsedUrl.hostname.split('.')[0];
  if (!projectRef || PRODUCTION_PROJECT_REFS.includes(projectRef as (typeof PRODUCTION_PROJECT_REFS)[number])) {
    throw new Error('Blocked: V2 cannot connect to the Production Supabase project.');
  }
  if (appEnvironment === 'production'
      && !V2_PROJECT_REFS.includes(projectRef as (typeof V2_PROJECT_REFS)[number])) {
    throw new Error('Blocked: V2 Production must use the dedicated V2 Supabase project.');
  }

  return {
    appEnvironment,
    supabaseUrl: parsedUrl.toString().replace(/\/$/, ''),
    supabasePublishableKey,
    supabaseProjectRef: projectRef,
    defaultLeagueSlug,
    authCaptcha: authCaptcha(source),
    features: {
      stewardWorkspace: parseBoolean(source.VITE_FEATURE_STEWARD_WORKSPACE),
      leagueAdmin: parseBoolean(source.VITE_FEATURE_LEAGUE_ADMIN),
      ownerControl: parseBoolean(source.VITE_FEATURE_OWNER_CONTROL, true),
      notificationsV2: parseBoolean(source.VITE_FEATURE_NOTIFICATIONS_V2, true),
      socialGraphics: parseBoolean(source.VITE_FEATURE_SOCIAL_GRAPHICS, true),
    },
  };
}

export function loadEnvironment(): RuntimeEnvironment {
  return parseEnvironment(import.meta.env);
}

