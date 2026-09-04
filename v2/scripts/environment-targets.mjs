export const productionRef = 'znnkwjogtvzwfkwnmawp';
export const stagingRef = 'nfvwarlowjqphytqqtxz';

export function assertBuildTarget(environment) {
  const mode = environment.VITE_APP_ENV;
  const expected = mode === 'production' ? productionRef : mode === 'staging' ? stagingRef : null;
  if (!expected || environment.VITE_SUPABASE_URL !== `https://${expected}.supabase.co`) {
    throw new Error('Build blocked: environment and Supabase project do not match.');
  }
  return expected;
}

export function targetHeaders(source, environment) {
  const target = assertBuildTarget(environment);
  return source.replaceAll(`${productionRef}.supabase.co`, `${target}.supabase.co`);
}
