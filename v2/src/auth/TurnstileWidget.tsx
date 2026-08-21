import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    turnstile?: {
      remove: (widgetId: string) => void;
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
    const script = existing ?? document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile could not be loaded.')), { once: true });
    if (!existing) document.head.append(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  enabled,
  errorCopy,
  onTokenChange,
  resetSignal,
  siteKey,
}: {
  enabled: boolean;
  errorCopy: string;
  onTokenChange: (token: string | null) => void;
  resetSignal: number;
  siteKey: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !siteKey) return;
    let active = true;
    void loadTurnstile().then(() => {
      if (!active || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible',
        callback: (token: string) => onTokenChange(token),
        'expired-callback': () => onTokenChange(null),
        'error-callback': () => onTokenChange(null),
      });
    }).catch(() => {
      if (active) {
        setLoadFailed(true);
        onTokenChange(null);
      }
    });
    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [enabled, onTokenChange, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    onTokenChange(null);
  }, [onTokenChange, resetSignal]);

  if (!enabled) return null;
  return (
    <div className="beta-captcha" aria-label="Cloudflare Turnstile">
      <div ref={containerRef} />
      {loadFailed && <p className="beta-feedback beta-feedback--error" role="alert">{errorCopy}</p>}
    </div>
  );
}

