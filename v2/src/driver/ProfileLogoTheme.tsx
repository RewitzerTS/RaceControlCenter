import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { themeFromLogoUrl } from '../league/logoTheme';
import type { CustomThemeColors } from '../league/leagueBranding';

export function ProfileLogoTheme({ logoUrl, leagueName, disabled, onColors, onBusy }: {
  logoUrl: string; leagueName: string; disabled: boolean;
  onColors: (colors: CustomThemeColors) => void; onBusy: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'supplemented' | 'error'>('idle');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); onBusy(false); }, [onBusy]);
  async function importColors() {
    if (disabled || state === 'loading' || !logoUrl) return;
    const controller = new AbortController();
    request.current = controller;
    setState('loading');
    onBusy(true);
    try {
      const result = await themeFromLogoUrl(logoUrl, controller.signal);
      if (controller.signal.aborted) return;
      onColors(result.colors);
      setState(result.supplemented ? 'supplemented' : 'ready');
    } catch {
      if (!controller.signal.aborted) setState('error');
    } finally {
      if (!controller.signal.aborted) onBusy(false);
    }
  }
  return <div className="profile-logo-theme" aria-busy={state === 'loading'}>
    <button className="text-action" type="button" disabled={disabled || state === 'loading' || !logoUrl} onClick={() => void importColors()}>{t(state === 'loading' ? 'profile.logoThemeLoading' : 'profile.logoThemeImport')}</button>
    <small>{logoUrl ? t('profile.logoThemeSource', { league: leagueName }) : t('profile.logoThemeMissing')}</small>
    {state === 'error' && <p role="alert">{t('profile.logoThemeError')}</p>}
    {(state === 'ready' || state === 'supplemented') && <p role="status">{t(state === 'supplemented' ? 'profile.logoThemeSupplemented' : 'profile.logoThemeReady')}</p>}
  </div>;
}
