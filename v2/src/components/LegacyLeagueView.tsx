import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useLeague } from '../league/LeagueProvider';

const LEGACY_DESTINATIONS: Record<string, string> = {
  'race-hub': '/racing',
  kalender: '/racing/calendar',
  ergebnisse: '/racing/results',
  'fahrer-wm': '/racing/standings?view=drivers',
  'team-wm': '/racing/standings?view=teams',
  grid: '/racing/grid',
  'regeln-faq': '/racing/rules',
  strecken: '/racing/tracks',
  'strecken-profil': '/racing/tracks/profile',
  'rennen-detail': '/racing/races/detail',
  'fahrer-profil': '/racing/drivers/profile',
  'team-profil': '/racing/teams/profile',
  'head-to-head': '/career/compare',
  rekorde: '/racing/history?view=records',
  'hall-of-fame': '/racing/history?view=hall-of-fame',
  'saison-archiv': '/racing/history?view=seasons',
};

function integratedDestination(anchor: HTMLAnchorElement): string | null {
  const target = new URL(anchor.href, window.location.origin);
  if (target.origin !== window.location.origin) return null;
  const page = target.pathname.split('/').pop()?.replace(/\.html$/, '') ?? '';
  const destination = LEGACY_DESTINATIONS[page];
  if (!destination) return null;
  const next = new URL(destination, window.location.origin);
  target.searchParams.forEach((value, key) => next.searchParams.set(key, value));
  next.hash = target.hash;
  return `${next.pathname}${next.search}${next.hash}`;
}

const LEGACY_THEME_VARIABLES: Record<string, string> = {
  '--brand-background': '--bg-main',
  '--brand-surface': '--surface',
  '--brand-primary': '--primary',
  '--brand-secondary': '--secondary',
  '--brand-accent': '--accent',
  '--brand-accent-2': '--accent-2',
  '--brand-text': '--text',
  '--brand-on-primary': '--text-on-primary',
};

function applyPersonalThemeToFrame(frameDocument: Document): void {
  const parentRoot = window.document.documentElement;
  const parentStyle = window.getComputedStyle(parentRoot);
  const frameRoot = frameDocument.documentElement;

  for (const [source, destination] of Object.entries(LEGACY_THEME_VARIABLES)) {
    const value = parentStyle.getPropertyValue(source).trim();
    if (value) frameRoot.style.setProperty(`--racevora-user-${destination.slice(2)}`, value);
  }

  const background = parentStyle.getPropertyValue('--brand-background').trim();
  const surface = parentStyle.getPropertyValue('--brand-surface').trim();
  const secondary = parentStyle.getPropertyValue('--brand-secondary').trim();
  const text = parentStyle.getPropertyValue('--brand-text').trim();
  const accent2 = parentStyle.getPropertyValue('--brand-accent-2').trim();
  if (background) frameRoot.style.setProperty('--racevora-user-bg-deep', `color-mix(in srgb, ${background} 72%, #000000)`);
  if (surface) frameRoot.style.setProperty('--racevora-user-surface-2', `color-mix(in srgb, ${surface} 78%, ${secondary || '#ffffff'})`);
  if (text) frameRoot.style.setProperty('--racevora-user-text-muted', `color-mix(in srgb, ${text} 72%, ${surface || background || '#000000'})`);
  if (accent2) frameRoot.style.setProperty('--racevora-user-accent-dark', accent2);

  frameRoot.dataset.userTheme = parentRoot.dataset.leagueTheme ?? '0';
  frameRoot.dataset.leagueBrandingApplied = 'true';
}

export function LegacyLeagueView({ page, title, search = '' }: {
  page: string;
  title: string;
  search?: string;
}) {
  const { leagueSlug } = useLeague();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [height, setHeight] = useState(760);
  const [readySource, setReadySource] = useState('');
  const source = useMemo(() => legacyLeagueSource(page, search, leagueSlug), [leagueSlug, page, search]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const prepareFrame = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const document = frame.contentDocument;
    if (!document?.body) return;

    cleanupRef.current?.();

    document.documentElement.classList.add('racevora-integrated-view');
    document.querySelectorAll('#site-header, #site-footer, #app-launch-splash').forEach((node) => node.remove());

    const style = document.createElement('style');
    style.dataset.racevoraIntegrated = 'true';
    style.textContent = `
      html.racevora-integrated-view {
        --bg-main: var(--racevora-user-bg-main) !important;
        --bg-deep: var(--racevora-user-bg-deep) !important;
        --surface: var(--racevora-user-surface) !important;
        --surface-2: var(--racevora-user-surface-2) !important;
        --primary: var(--racevora-user-primary) !important;
        --secondary: var(--racevora-user-secondary) !important;
        --accent: var(--racevora-user-accent) !important;
        --accent-2: var(--racevora-user-accent-2) !important;
        --accent-dark: var(--racevora-user-accent-dark) !important;
        --text: var(--racevora-user-text) !important;
        --text-muted: var(--racevora-user-text-muted) !important;
        --text-on-primary: var(--racevora-user-text-on-primary) !important;
      }
      html, body { min-height: 0 !important; background: transparent !important; }
      body { padding-top: 0 !important; }
      body > main { margin-top: 0 !important; padding-top: 0 !important; }
      .section { padding-top: 8px !important; }
      .dashboard-shell { padding-top: 0 !important; }
      .footer, .site-header { display: none !important; }
    `;
    document.head.append(style);

    const syncTheme = () => applyPersonalThemeToFrame(document);
    syncTheme();
    window.addEventListener('racevora:theme-changed', syncTheme);

    document.addEventListener('click', (clickEvent) => {
      const anchor = (clickEvent.target as Element | null)?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const destination = integratedDestination(anchor);
      if (!destination) return;
      clickEvent.preventDefault();
      window.location.assign(destination);
    }, { capture: true });

    const resize = () => setHeight(Math.max(620, Math.min(1800, document.documentElement.scrollHeight + 24)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(document.body);
    cleanupRef.current = () => {
      observer.disconnect();
      window.removeEventListener('racevora:theme-changed', syncTheme);
    };
    frameRef.current = frame;
    setReadySource(source);
  };

  return (
    <div className="integrated-league-view">
      <iframe
        key={source}
        onLoad={prepareFrame}
        ref={frameRef}
        src={source}
        style={{ height, visibility: readySource === source ? 'visible' : 'hidden' }}
        title={title}
      />
    </div>
  );
}

export function legacyLeagueSource(page: string, search: string, leagueSlug: string): string {
  const params = new URLSearchParams(search);
  params.set('embed', '1');
  params.set('league', leagueSlug);
  return `/${page}.html?${params.toString()}`;
}
