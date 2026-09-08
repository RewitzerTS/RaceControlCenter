import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { racingHref } from './calendarData';
import { loadResults, type ResultsData } from './resultsData';
import { buildStandings, standingSnapshot, type Trend } from './standingsData';
import { standingsMessages } from './standingsMessages';
import './racing.css';
import './standings.css';

const logos: [string[], string][] = [
  [['mclaren'], 'mclaren.png'], [['ferrari'], 'ferrari.png'], [['red bull', 'redbull'], 'red-bull.png'], [['mercedes', 'petronas'], 'mercedes.png'], [['aston martin'], 'aston-martin.png'], [['alpine', 'renault'], 'alpine.png'], [['haas'], 'haas.png'], [['racing bulls', 'rb', 'vcarb', 'alpha tauri', 'alphatauri', 'toro rosso'], 'racing-bulls.png'], [['williams'], 'williams.png'], [['sauber', 'stake', 'kick f1', 'alfa romeo'], 'sauber.png'], [['audi'], 'audi.svg'], [['cadillac'], 'cadillac.svg'],
];
export function CarLogo({ candidates, label }: { candidates: (string | null | undefined)[]; label: string }) {
  const [failed, setFailed] = useState('');
  const file = candidates.flatMap((candidate) => {
    const normalized = (candidate || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return logos.find(([keys]) => keys.some((key) => normalized.includes(key)))?.[1] || [];
  })[0];
  return file && failed !== file ? <img className="standing-car" src={`/v1-assets/images/team-logos/${file}`} alt={label} width={72} height={44} onError={() => setFailed(file)} /> : <span>{label}</span>;
}
function TrendIcon({ trend, label }: { trend: Trend; label: string }) {
  const path = trend === 'flat' ? 'M2.4 8l2.8-2.8 1.2 1.2L5.6 7.1H10.4L9.6 6.4l1.2-1.2L13.6 8l-2.8 2.8-1.2-1.2.8-.7H5.6l.8.7-1.2 1.2L2.4 8z' : trend === 'down' ? 'M8 13.6l-4.8-4.8 1.2-1.2 2.7 2.6V3h1.8v7.2l2.7-2.6 1.2 1.2L8 13.6z' : 'M8 2.4l4.8 4.8-1.2 1.2L8.9 5.8V13H7.1V5.8L4.4 8.4 3.2 7.2 8 2.4z';
  return <span className={`standing-trend standing-trend--${trend}`} role="img" aria-label={label} title={label}><svg viewBox="0 0 16 16" aria-hidden="true"><path d={path} /></svg></span>;
}

export function RacingStandings({ teams }: { teams: boolean }) {
  const { client, leagueSlug } = useLeague();
  const { user, loading: authLoading } = useAuth();
  const { language, formatNumber } = useI18n();
  const copy = standingsMessages[language];
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const userId = user?.id ?? '';
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    if (!authLoading) void loadResults(client, leagueSlug, Boolean(userId), controller.signal).then((next) => {
      if (!controller.signal.aborted) setData(next);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [client, leagueSlug, userId, authLoading, retry]);
  useEffect(() => { setExpanded(false); if (scroll.current) scroll.current.scrollLeft = 0; }, [teams]);
  const standings = useMemo(() => data ? buildStandings(data) : null, [data]);
  const tableId = teams ? 'team-standings-table' : 'driver-standings-table';
  const teamLabel = (name: string) => name === 'Ohne Team' ? copy.noTeam : name;
  return <section className="native-racing native-standings" data-native-racing="standings" aria-labelledby="standings-title">
    <header><h1 id="standings-title">{teams ? copy.teamsTitle : copy.driversTitle}</h1><p>{data?.season ? `${copy.season} ${data.season.name} · ` : ''}{copy.subtitle}</p></header>
    <nav className="standings-switch" aria-label={copy.total}>{[false, true].map((value) => <Link key={String(value)} aria-current={teams === value ? 'page' : undefined} to={racingHref('/racing/standings', leagueSlug, value ? { view: 'teams' } : {})}>{value ? copy.teams : copy.drivers}</Link>)}</nav>
    {error ? <div role="alert"><p>{copy.error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button></div> : !data ? <p role="status">{copy.loading}</p> : !data.season ? <div><h2>{copy.noSeason}</h2><p><Link to={racingHref('/racing/history', leagueSlug, { view: 'seasons' })}>{copy.archive}</Link></p></div> : <section className="standings-panel" aria-labelledby="standings-total">
      <div className="standings-heading"><h2 id="standings-total">{copy.total}</h2><span>{formatNumber(teams ? standings!.teamStandings.length : standings!.driverStandings.length)} {teams ? copy.teamCount : copy.driverCount}</span></div>
      {!teams && <button className="standings-detail-toggle" type="button" aria-controls={tableId} aria-expanded={expanded} onClick={() => { setExpanded(!expanded); if (scroll.current) scroll.current.scrollLeft = 0; }}>{expanded ? copy.less : copy.more}</button>}
      <div className="standings-scroll" ref={scroll} tabIndex={0} role="region" aria-label={copy.scroll}><table id={tableId} className={`standings-table${expanded ? ' standings-table--expanded' : ''}${teams ? ' standings-table--teams' : ' standings-table--drivers'}`}>
        <thead><tr>{(teams ? [copy.position, copy.trend, copy.team, `${copy.driver} 1`, copy.car, `${copy.driver} 2`, copy.car, copy.points] : [copy.position, copy.trend, copy.driver, copy.team, copy.car, copy.wins, copy.podiums, copy.fastest, copy.points]).map((label, index) => <th scope="col" key={index}>{label}</th>)}</tr></thead>
        {teams ? <tbody id="teams-standings-body">{standings!.teamStandings.map((entry, index) => <tr key={entry.teamName} className={index < 3 ? `podium-${index + 1}` : ''}><td>{index + 1}</td><td><TrendIcon trend={entry.trend} label={copy[entry.trend]} /></td><td><Link to={racingHref('/racing/teams/profile', leagueSlug, { team: entry.teamName })}>{teamLabel(entry.teamName)}</Link></td>{[0, 1].map((seat) => {
          const driver = entry.drivers[seat];
          const snapshot = driver ? standingSnapshot(data, driver.id, standings!.latestRace) : null;
          return <StandingTeamDriver key={seat} name={driver?.name} href={driver ? racingHref('/racing/drivers/profile', leagueSlug, { driver: driver.id }) : undefined} logo={<CarLogo label={driver?.car || entry.teamName} candidates={[snapshot?.car_name, snapshot?.league_team, driver?.car, entry.teamName]} />} />;
        })}<td><strong>{formatNumber(entry.points)}</strong></td></tr>)}{!standings!.teamStandings.length && <tr><td colSpan={8}>{copy.emptyTeams}</td></tr>}</tbody> : <tbody id="drivers-standings-body">{standings!.driverStandings.map((entry, index) => {
          const snapshot = standingSnapshot(data, entry.driverId, standings!.latestRace);
          return <tr key={entry.driverId} className={index < 3 ? `podium-${index + 1}` : ''}><td>{index + 1}</td><td><TrendIcon trend={entry.trend} label={copy[entry.trend]} /></td><td><Link to={racingHref('/racing/drivers/profile', leagueSlug, { driver: entry.driverId })}>{entry.driverName}</Link></td><td>{teamLabel(entry.leagueTeam)}</td><td><CarLogo label={entry.carName} candidates={[snapshot?.car_name, snapshot?.league_team, entry.carName, entry.leagueTeam]} /></td><td>{formatNumber(entry.wins)}</td><td>{formatNumber(entry.podiums)}</td><td>{formatNumber(entry.fastestLaps)}</td><td><strong>{formatNumber(entry.points)}</strong></td></tr>;
        })}{!standings!.driverStandings.length && <tr><td colSpan={9}>{copy.emptyDrivers}</td></tr>}</tbody>}
      </table></div>
    </section>}
  </section>;
}

function StandingTeamDriver({ name, href, logo }: { name?: string; href?: string; logo: React.ReactNode }) {
  return <><td>{href ? <Link to={href}>{name}</Link> : '—'}</td><td>{logo}</td></>;
}
