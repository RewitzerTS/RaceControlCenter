import { describe, expect, it } from 'vitest';
import { assertBuildTarget, productionRef, stagingRef, targetHeaders } from './environment-targets.mjs';

describe('build target isolation', () => {
  it('rejects swapped database targets before building', () => {
    expect(() => assertBuildTarget({ VITE_APP_ENV: 'staging', VITE_SUPABASE_URL: `https://${productionRef}.supabase.co` })).toThrow(/blocked/);
    expect(() => assertBuildTarget({ VITE_APP_ENV: 'production', VITE_SUPABASE_URL: `https://${stagingRef}.supabase.co` })).toThrow(/blocked/);
  });
  it('pins HTTP, WebSocket and image CSP to the selected database', () => {
    const source = `connect-src https://${productionRef}.supabase.co wss://${productionRef}.supabase.co; img-src https://${productionRef}.supabase.co`;
    const output = targetHeaders(source, { VITE_APP_ENV: 'staging', VITE_SUPABASE_URL: `https://${stagingRef}.supabase.co` });
    expect(output).not.toContain(productionRef);
    expect(output.match(new RegExp(stagingRef, 'g'))).toHaveLength(3);
    expect(targetHeaders(source, { VITE_APP_ENV: 'production', VITE_SUPABASE_URL: `https://${productionRef}.supabase.co` })).toBe(source);
  });
});
