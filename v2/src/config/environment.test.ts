import { describe, expect, it } from 'vitest';
import { PRODUCTION_PROJECT_REFS, parseEnvironment } from './environment';

const validSource = {
  VITE_APP_ENV: 'staging',
  VITE_SUPABASE_URL: 'https://stagingprojectref.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_test_key',
  VITE_DEFAULT_LEAGUE_SLUG: 'demo-league',
  VITE_FEATURE_STEWARD_WORKSPACE: 'true',
};

describe('parseEnvironment', () => {
  it('accepts an isolated staging project', () => {
    expect(parseEnvironment(validSource)).toMatchObject({
      appEnvironment: 'staging',
      supabaseProjectRef: 'stagingprojectref',
      defaultLeagueSlug: 'demo-league',
      features: { stewardWorkspace: true, leagueAdmin: false },
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
});
