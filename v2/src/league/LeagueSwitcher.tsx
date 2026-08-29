import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { useLeague } from './LeagueProvider';

interface AccessibleLeague {
  id: string;
  name: string;
  slug: string;
  role: string | null;
}

export function leagueSwitcherDestination(
  pathname: string,
  search: string,
  hash: string,
  leagueSlug: string,
): string {
  const query = new URLSearchParams(search);
  query.set('league', leagueSlug);
  return `${pathname}?${query.toString()}${hash}`;
}

async function loadAccessibleLeagues(
  client: LeagueSupabaseClient,
  userId: string,
  isPlatformOwner: boolean,
): Promise<AccessibleLeague[]> {
  if (isPlatformOwner) {
    const { data, error } = await client
      .from('leagues')
      .select('id, name, slug')
      .eq('status', 'active')
      .order('name');
    if (error) throw error;
    return (data ?? []).map((league) => ({ ...league, role: 'platform_owner' }));
  }

  const { data: memberships, error: membershipError } = await client
    .from('league_members')
    .select('league_id, role')
    .eq('user_id', userId);
  if (membershipError) throw membershipError;
  if (!memberships?.length) return [];

  const roleByLeagueId = new Map(memberships.map((membership) => [membership.league_id, membership.role]));
  const { data: leagues, error: leagueError } = await client
    .from('leagues')
    .select('id, name, slug')
    .in('id', [...roleByLeagueId.keys()])
    .eq('status', 'active')
    .order('name');
  if (leagueError) throw leagueError;

  return (leagues ?? []).map((league) => ({
    ...league,
    role: roleByLeagueId.get(league.id) ?? null,
  }));
}

export function LeagueSwitcher({
  isPlatformOwner,
  navigateToLeague,
  onSwitch,
  userId,
}: {
  isPlatformOwner: boolean;
  navigateToLeague?: (destination: string) => void;
  onSwitch?: () => void;
  userId: string;
}) {
  const { branding, client, leagueSlug, setLeagueSlug } = useLeague();
  const { t } = useI18n();
  const location = useLocation();
  const switcherRef = useRef<HTMLDivElement>(null);
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  const [leagues, setLeagues] = useState<AccessibleLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedForLeagueSlug, setLoadedForLeagueSlug] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadedForLeagueSlug(null);
    setLoadFailed(false);

    void loadAccessibleLeagues(client, userId, isPlatformOwner)
      .then((nextLeagues) => {
        if (!active) return;
        setLeagues(nextLeagues);
        setLoadFailed(false);
      })
      .catch((reason) => {
        if (!active) return;
        setLeagues([]);
        setLoadFailed(true);
        console.warn('Verfügbare Ligen konnten nicht geladen werden.', reason);
      })
      .finally(() => {
        if (active) {
          setLoadedForLeagueSlug(leagueSlug);
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [client, isPlatformOwner, leagueSlug, userId]);

  useEffect(() => {
    if (loading || loadedForLeagueSlug !== leagueSlug || leagues.length === 0 || leagues.some((league) => league.slug === leagueSlug)) return;
    setLeagueSlug(leagues[0].slug);
  }, [leagueSlug, leagues, loadedForLeagueSlug, loading, setLeagueSlug]);

  useEffect(() => {
    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node | null)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeWhenClickingOutside);
    return () => document.removeEventListener('pointerdown', closeWhenClickingOutside);
  }, []);

  const currentLeagueName = useMemo(
    () => leagues.find((league) => league.slug === leagueSlug)?.name || branding.name || leagueSlug,
    [branding.name, leagueSlug, leagues],
  );

  const selectLeague = (slug: string) => {
    setOpen(false);
    onSwitch?.();
    if (slug === leagueSlug) return;

    setLeagueSlug(slug);
    const destination = leagueSwitcherDestination(location.pathname, location.search, location.hash, slug);
    if (navigateToLeague) {
      navigateToLeague(destination);
      return;
    }
    window.location.replace(destination);
  };

  if (loading || leagues.length < 2) {
    return (
      <div
        aria-label={`${t('leagueSwitcher.active')}: ${currentLeagueName}`}
        className="league-switcher league-switcher--static"
        title={loadFailed ? t('leagueSwitcher.error') : currentLeagueName}
      >
        <span className="league-switcher__copy">
          <small>{t('leagueSwitcher.active')}</small>
          <strong>{currentLeagueName}</strong>
        </span>
      </div>
    );
  }

  return (
    <div
      className="league-switcher"
      ref={switcherRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          switcherRef.current?.querySelector<HTMLButtonElement>('.league-switcher__trigger')?.focus();
        }
      }}
    >
      <button
        aria-controls={optionsId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t('leagueSwitcher.change')}: ${currentLeagueName}`}
        className="league-switcher__trigger"
        onClick={() => setOpen((current) => !current)}
        title={t('leagueSwitcher.change')}
        type="button"
      >
        <span className="league-switcher__copy">
          <small>{t('leagueSwitcher.active')}</small>
          <strong>{currentLeagueName}</strong>
        </span>
      </button>
      {open && <div aria-label={t('leagueSwitcher.change')} className="league-switcher__options" id={optionsId} role="menu">
        {leagues.map((league) => {
          const selected = league.slug === leagueSlug;
          return (
            <button
              aria-checked={selected}
              className={selected ? 'league-switcher__option league-switcher__option--active' : 'league-switcher__option'}
              key={league.id}
              onClick={() => selectLeague(league.slug)}
              role="menuitemradio"
              type="button"
            >
              <span>
                <strong>{league.name}</strong>
                <small>{league.slug}</small>
              </span>
              {selected && <em>{t('leagueSwitcher.current')}</em>}
            </button>
          );
        })}
      </div>}
    </div>
  );
}
