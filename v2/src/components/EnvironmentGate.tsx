import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { loadEnvironment, type RuntimeEnvironment } from '../config/environment';

export function EnvironmentGate({ children }: {
  children: (environment: RuntimeEnvironment) => PropsWithChildren['children'];
}) {
  const result = useMemo(() => {
    try {
      return { environment: loadEnvironment(), error: null };
    } catch (error) {
      return {
        environment: null,
        error: error instanceof Error ? error.message : 'Unknown environment error.',
      };
    }
  }, []);

  if (!result.environment) {
    return (
      <main className="fatal-state" id="main-content">
        <p className="eyebrow">V2 · Fail closed</p>
        <h1>Staging-Konfiguration erforderlich</h1>
        <p>{result.error}</p>
        <p className="technical-note">Die App verbindet sich ohne gültige, isolierte Konfiguration mit keinem Backend.</p>
      </main>
    );
  }

  return <>{children(result.environment)}</>;
}
