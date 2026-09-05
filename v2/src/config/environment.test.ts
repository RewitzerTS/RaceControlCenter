import { describe, expect, it } from 'vitest';
import { PRODUCTION_PROJECT_REFS, RETIRED_PROJECT_REFS, STAGING_PROJECT_REFS, V2_PROJECT_REFS, parseEnvironment } from './environment';

const validSource = {
  VITE_APP_ENV: 'staging',
  VITE_SUPABASE_URL: `https://${STAGING_PROJECT_REFS[0]}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_test_key',
  VITE_DEFAULT_LEAGUE_SLUG: 'demo-league',
  VITE_FEATURE_STEWARD_WORKSPACE: 'true',
  VITE_AUTH_CAPTCHA_ENABLED: 'false',
};

describe('parseEnvironment', () => {
  it('accepts an isolated staging project', () => {
    expect(parseEnvironment(validSource)).toMatchObject({
      appEnvironment: 'staging',
      supabaseProjectRef: STAGING_PROJECT_REFS[0],
      defaultLeagueSlug: 'demo-league',
      features: { stewardWorkspace: true, leagueAdmin: false, ownerControl: true, notificationsV2: true },
    });
  });

  it('rejects the Production project reference', () => {
    expect(() => parseEnvironment({
      ...validSource,
      VITE_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REFS[0]}.supabase.co`,
    })).toThrow(/cannot connect to the Production/i);
  });

  it('accepts Production only on the dedicated V2 project', () => {
    expect(parseEnvironment({
      ...validSource,
      VITE_APP_ENV: 'production',
      VITE_SUPABASE_URL: `https://${V2_PROJECT_REFS[0]}.supabase.co`,
      VITE_DEFAULT_LEAGUE_SLUG: 'rcc',
    })).toMatchObject({
      appEnvironment: 'production',
      defaultLeagueSlug: 'rcc',
      supabaseProjectRef: V2_PROJECT_REFS[0],
    });

    expect(() => parseEnvironment({
      ...validSource,
      VITE_APP_ENV: 'production',
      VITE_SUPABASE_URL: 'https://anotherprojectref.supabase.co',
    })).toThrow(/dedicated V2 Supabase project/i);
  });

  it('rejects production in local mode and unknown staging projects', () => {
    expect(() => parseEnvironment({ ...validSource, VITE_APP_ENV: 'local',
      VITE_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REFS[0]}.supabase.co`,
    })).toThrow(/cannot connect to the Production/i);
    expect(() => parseEnvironment({ ...validSource,
      VITE_SUPABASE_URL: 'https://unknownproject.supabase.co',
    })).toThrow(/dedicated staging/i);
    expect(() => parseEnvironment({ ...validSource,
      VITE_SUPABASE_URL: `https://${RETIRED_PROJECT_REFS[0]}.supabase.co`,
    })).toThrow(/retired/i);
  });

  it('rejects placeholders and missing values', () => {
    expect(() => parseEnvironment({
      ...validSource,
      VITE_SUPABASE_URL: 'https://your-staging-project.supabase.co',
    })).toThrow(/placeholders/i);
    expect(() => parseEnvironment({ ...validSource, VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toThrow(/Missing required/i);
  });

  it('permits an explicit local Supabase instance', () => {
    expect(parseEnvironment({
      ...validSource,
      VITE_APP_ENV: 'local',
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    }).supabaseProjectRef).toBe('local');
  });

  it('allows completed staging experiences to be explicitly disabled', () => {
    expect(parseEnvironment({
      ...validSource,
      VITE_FEATURE_OWNER_CONTROL: 'false',
      VITE_FEATURE_NOTIFICATIONS_V2: 'false',
    }).features).toMatchObject({ ownerControl: false, notificationsV2: false });
  });

  it('requires a target-specific Turnstile key when CAPTCHA is enabled', () => {
    expect(() => parseEnvironment({
      ...validSource,
      VITE_AUTH_CAPTCHA_ENABLED: 'true',
      VITE_TURNSTILE_SITE_KEY: '',
    })).toThrow(/target-specific Turnstile site key/i);
    expect(parseEnvironment({
      ...validSource,
      VITE_AUTH_CAPTCHA_ENABLED: 'true',
      VITE_TURNSTILE_SITE_KEY: '0x4AAA-staging-only',
    }).authCaptcha).toEqual({ enabled: true, turnstileSiteKey: '0x4AAA-staging-only' });
  });
});

