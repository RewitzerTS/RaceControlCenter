import { createContext, type PropsWithChildren, useContext } from 'react';
import type { FeatureFlags } from '../config/environment';

const FeatureFlagContext = createContext<Readonly<FeatureFlags> | null>(null);

export function FeatureFlagProvider({ flags, children }: PropsWithChildren<{ flags: FeatureFlags }>) {
  return <FeatureFlagContext.Provider value={Object.freeze({ ...flags })}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags(): Readonly<FeatureFlags> {
  const context = useContext(FeatureFlagContext);
  if (!context) throw new Error('useFeatureFlags must be used inside FeatureFlagProvider.');
  return context;
}
