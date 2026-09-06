import { useEffect, useRef, useState } from 'react';

const PREFIX = 'racevora.draft.v1:';
const MAX_AGE = 24 * 60 * 60 * 1000;

// Tab-scoped recovery only: no files, passwords or server writes. Callers scope
// drafts to account + league + season and validate them against fresh data.
export function useDraftRecovery<T>({ scope, value, restore, validate }: {
  scope: string | null;
  value: T;
  restore: (value: T) => void;
  validate: (value: unknown) => value is T;
}) {
  const current = useRef({ value, restore, validate });
  current.current = { value, restore, validate };
  const baseline = useRef('');
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [, refresh] = useState(0);
  const serialized = JSON.stringify(value);

  useEffect(() => {
    setReadyScope(null);
    setRestored(false);
    if (!scope) return;
    baseline.current = JSON.stringify(current.current.value);
    try {
      const raw = sessionStorage.getItem(PREFIX + scope);
      if (raw) {
        const draft: unknown = JSON.parse(raw);
        if (draft && typeof draft === 'object' && 'savedAt' in draft && 'value' in draft
          && typeof draft.savedAt === 'number' && Date.now() - draft.savedAt < MAX_AGE
          && current.current.validate(draft.value)) {
          current.current.restore(draft.value);
          setRestored(true);
        } else sessionStorage.removeItem(PREFIX + scope);
      }
    } catch { setUnavailable(true); }
    setReadyScope(scope);
  }, [scope]);

  const dirty = Boolean(scope && readyScope === scope && serialized !== baseline.current);
  useEffect(() => {
    if (!scope || readyScope !== scope) return;
    try {
      if (serialized !== baseline.current) {
        sessionStorage.setItem(PREFIX + scope, JSON.stringify({ savedAt: Date.now(), value: JSON.parse(serialized) }));
      } else sessionStorage.removeItem(PREFIX + scope);
      setUnavailable(false);
    } catch { setUnavailable(true); }
  }, [scope, readyScope, serialized]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function markSaved() {
    baseline.current = JSON.stringify(current.current.value);
    if (scope) {
      try { sessionStorage.removeItem(PREFIX + scope); } catch { /* Saving on the server already succeeded. */ }
    }
    setRestored(false);
    refresh((revision) => revision + 1);
  }
  return { dirty, restored, unavailable, markSaved };
}
