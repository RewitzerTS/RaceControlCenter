import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { loadHistory, type HistoryData, type HistoryRace } from './profileData';
import { profileMessages } from './profileMessages';
import { racingHref } from './calendarData';
import './racing.css';
import './profiles.css';

export function useRacingHistory(raceDetail = false) {
  const { client, leagueSlug } = useLeague();
  const { user, loading } = useAuth();
  const i18n = useI18n();
  const location = useLocation(), navigate = useNavigate();
  const raceSeason = raceDetail ? new URLSearchParams(location.search).get('season') || 'active' : undefined;
  const [data, setData] = useState<HistoryData | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const userId = user?.id || '';
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    if (!loading) void loadHistory(client, leagueSlug, userId, controller.signal, raceSeason).then((value) => { if (!controller.signal.aborted) setData(value); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [client, leagueSlug, userId, loading, retry, raceSeason]);
  const params = new URLSearchParams(location.search);
  const choose = (key: string, value: string) => { const next = new URLSearchParams(location.search); if (value) next.set(key, value); else next.delete(key); next.set('league', leagueSlug); navigate(`${location.pathname}?${next}`); };
  return { data, error, retry: () => setRetry((value) => value + 1), copy: profileMessages[i18n.language], ...i18n, params, choose, client, leagueSlug };
}
export type HistoryView = ReturnType<typeof useRacingHistory>;
export function ProfileFrame({ view, title, kind, children }: { view: HistoryView; title: string; kind: string; children: ReactNode }) {
  return <section className="native-racing native-profile" data-native-racing={kind} aria-labelledby="profile-page-title"><h1 id="profile-page-title">{title}</h1>{view.error ? <div role="alert"><p>{view.copy.error}</p><button type="button" onClick={view.retry}>{view.copy.retry}</button></div> : !view.data ? <p role="status">{view.copy.loading}</p> : children}</section>;
}
export function PeriodSelect({ view }: { view: HistoryView }) {
  return <label>{view.copy.season}<select value={view.params.get('season') || ''} onChange={(event) => view.choose('season', event.target.value)}><option value="">{view.copy.career}</option>{[...view.data!.seasons].reverse().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>;
}
export function MissingSelection({ view }: { view: HistoryView }) { return <p role="status">{view.copy.missing} <Link to={racingHref('/racing/grid', view.leagueSlug)}>{view.copy.grid}</Link></p>; }
export function ProfileTable({ view, headings, children }: { view: HistoryView; headings: string[]; children: ReactNode }) {
  return <div className="profile-table-scroll" role="region" aria-label={view.copy.scroll} tabIndex={0}><table><thead><tr>{headings.map((heading, index) => <th scope="col" key={index}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
export function StatList({ values }: { values: [string, ReactNode][] }) { return <dl className="profile-stats">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
export function RaceLink({ race, view }: { race: HistoryRace; view: HistoryView }) { return <Link to={racingHref('/racing/races/detail', view.leagueSlug, { round: String(race.round_number), season: race.season_id })}>{race.grand_prix_name || `${view.copy.round} ${race.round_number}`}</Link>; }
export function ProfileImage({ src, alt, className, fallback }: { src?: string | null; alt: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState('');
  const safe = src && (src.startsWith('/v1-assets/') || /^https:\/\//i.test(src));
  return safe && failed !== src ? <img className={className} src={src!} alt={alt} onError={() => setFailed(src!)} /> : <>{fallback}</>;
}
