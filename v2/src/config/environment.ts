export const PRODUCTION_PROJECT_REFS = ['kjccstcbqygxuqkvdaqw'] as const;

export type AppEnvironment = 'local' | 'staging';

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

export function parseEnvironment(source: EnvironmentSource): RuntimeEnvironment {
  const appEnvironment = required(source, 'VITE_APP_ENV');
  if (appEnvironment !== 'local' && appEnvironment !== 'staging') {
    throw new Error('V2 currently accepts only local or staging environments.');
  }

  const supabaseUrl = required(source, 'VITE_SUPABASE_URL');
  const supabasePublishableKey = required(source, 'VITE_SUPABASE_PUBLISHABLE_KEY');
  const defaultLeagueSlug = required(source, 'VITE_DEFAULT_LEAGUE_SLUG').toLowerCase();

  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabasePublishableKey)) {
    throw new Error('Replace all V2 environment placeholders with staging-only values.');
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
    throw new Error('Staging must use an HTTPS Supabase project URL.');
  }

  const projectRef = parsedUrl.hostname.split('.')[0];
  if (!projectRef || PRODUCTION_PROJECT_REFS.includes(projectRef as (typeof PRODUCTION_PROJECT_REFS)[number])) {
    throw new Error('Blocked: V2 cannot connect to the Production Supabase project.');
  }

  return {
    appEnvironment,
    supabaseUrl: parsedUrl.toString().replace(/\/$/, ''),
    supabasePublishableKey,
    supabaseProjectRef: projectRef,
    defaultLeagueSlug,
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
