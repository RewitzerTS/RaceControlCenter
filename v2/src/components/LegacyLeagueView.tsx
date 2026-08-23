import { useMemo, useRef, useState, type SyntheticEvent } from 'react';
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

export function LegacyLeagueView({ page, title, search = '' }: {
  page: string;
  title: string;
  search?: string;
}) {
  const { leagueSlug } = useLeague();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(760);
  const source = useMemo(() => {
    const params = new URLSearchParams(search);
    params.set('embed', '1');
    if (!params.has('league')) params.set('league', leagueSlug);
    return `/${page}.html?${params.toString()}`;
  }, [leagueSlug, page, search]);

  const prepareFrame = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const document = frame.contentDocument;
    if (!document?.body) return;

    document.documentElement.classList.add('racevora-integrated-view');
    document.querySelectorAll('#site-header, #site-footer, #app-launch-splash').forEach((node) => node.remove());

    const style = document.createElement('style');
    style.dataset.racevoraIntegrated = 'true';
    style.textContent = `
      html, body { min-height: 0 !important; background: transparent !important; }
      body { padding-top: 0 !important; }
      body > main { margin-top: 0 !important; padding-top: 0 !important; }
      .section { padding-top: 8px !important; }
      .dashboard-shell { padding-top: 0 !important; }
      .footer, .site-header { display: none !important; }
    `;
    document.head.append(style);

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
    frameRef.current = frame;
  };

  return (
    <div className="integrated-league-view">
      <iframe
        key={source}
        onLoad={prepareFrame}
        ref={frameRef}
        src={source}
        style={{ height }}
        title={title}
      />
    </div>
  );
}

