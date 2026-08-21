import { describe, expect, it } from 'vitest';
import { PRODUCTION_PROJECT_REFS, parseEnvironment } from './environment';

const validSource = {
  VITE_APP_ENV: 'staging',
  VITE_SUPABASE_URL: 'https://stagingprojectref.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_test_key',
  VITE_DEFAULT_LEAGUE_SLUG: 'demo-league',
  VITE_FEATURE_STEWARD_WORKSPACE: 'true',
  VITE_AUTH_CAPTCHA_ENABLED: 'false',
};

describe('parseEnvironment', () => {
  it('accepts an isolated staging project', () => {
    expect(parseEnvironment(validSource)).toMatchObject({
      appEnvironment: 'staging',
      supabaseProjectRef: 'stagingprojectref',
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

