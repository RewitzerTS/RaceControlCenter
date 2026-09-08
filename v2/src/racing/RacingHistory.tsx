import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { ProfileFrame, ProfileImage, ProfileTable, RaceLink, StatList, useRacingHistory, type HistoryView } from './ProfileShared';
import { HistoryDriverLink, HistoryPeriod } from './RacingTracks';
import { calculateRecords, championTotals, loadHistoricChampions, type Champion } from './recordData';
import { historyMessages } from './historyMessages';
import { profileMessages } from './profileMessages';
import { racingHref } from './calendarData';
import { historySnapshot, points, position, type HistoryRace } from './profileData';
import { fastestLapDriver } from './resultsData';
import { formatRaceDuration, lapTime } from './RacingRaceDetail';
import './history.css';

export function RacingRecords() {
  const view = useRacingHistory(), { data, copy: c, formatNumber: n } = view, h = historyMessages[view.language];
  const season = view.params.get('season') || '', valid = !season || data?.seasons.some((s) => s.id === season);
  const record = data && valid ? calculateRecords(data, season) : null;
  const driver = (id: string, name: string) => <HistoryDriverLink view={view} id={id} name={name} />;
  const special = (title: string, who: ReactNode, value: ReactNode, detail?: string) => <article key={title}><h3>{title}</h3><p>{who || '—'}</p><strong>{value ?? '—'}</strong>{detail && <p>{detail}</p>}</article>;
  const s = record?.specials;
  return <ProfileFrame view={view} title={h.records} kind="records">{data && <><div className="profile-controls"><HistoryPeriod view={view} /></div>{!record ? <p role="status">{c.missing}</p> : <>
    <StatList values={[[c.race, n(record.raceCount)], [c.driver, n(record.drivers.length)], [c.team, n(record.teams.length)]]} />
    <section className="profile-section"><h2>{h.specialRecords}</h2><div className="history-specials">
      {special(h.comeback, s!.comeback && driver(s!.comeback.driverId, s!.comeback.name), s!.comeback ? `+${n(s!.comeback.gain)}` : '—', s!.comeback ? `${s!.comeback.race.grand_prix_name} · P${s!.comeback.grid} → P${s!.comeback.finish}` : undefined)}
      {(['winStreak', 'podiumStreak', 'pointsStreak'] as const).map((key) => special(h[key], s![key] && driver(s![key]!.driver.id, s![key]!.driver.display_name), s![key] ? n(s![key]!.value) : '—', h.consecutive))}
      {special(h.specialist, s!.specialist && driver(s!.specialist.driverId, s!.specialist.name), s!.specialist ? `${n(s!.specialist.wins)} ${c.wins}` : '—', s!.specialist?.track)}
      {special(h.average, s!.avgFinish && driver(s!.avgFinish.driver.id, s!.avgFinish.driver.display_name), s!.avgFinish ? `P${n(s!.avgFinish.avgFinish!, { maximumFractionDigits: 1 })}` : '—', h.minThree)}
      {special(h.rate, s!.finishRate && driver(s!.finishRate.driver.id, s!.finishRate.driver.display_name), s!.finishRate ? `${n(s!.finishRate.finishRate! * 100, { maximumFractionDigits: 0 })} %` : '—', h.minFive)}
      {special(h.gained, s!.positionsGained && driver(s!.positionsGained.driver.id, s!.positionsGained.driver.display_name), s!.positionsGained ? `+${n(s!.positionsGained.positionsGained)}` : '—', h.net)}
    </div></section>
    <div className="profile-columns"><section className="profile-section"><h2>{h.driverRecords}</h2>{(['wins', 'points', 'poles', 'podiums'] as const).map((key) => <section key={key}><h3>{c[key]}</h3><ol className="profile-list">{record.topDrivers(key).map((entry, index) => <li className="history-record-row" key={entry.driver.id}><span>{index + 1}</span>{driver(entry.driver.id, entry.driver.display_name)}<strong>{n(entry[key])}</strong></li>)}</ol>{!record.drivers.length && <p>{c.empty}</p>}</section>)}</section>
    <section className="profile-section"><h2>{h.teamRecords}</h2>{(['points', 'wins', 'podiums', 'poles'] as const).map((key) => <section key={key}><h3>{c[key]}</h3><ol className="profile-list">{record.topTeams(key).map((entry, index) => <li className="history-record-row" key={entry.teamName}><span>{index + 1}</span><Link to={racingHref('/racing/teams/profile', view.leagueSlug, { team: entry.teamName, ...(season ? { season } : {}) })}>{entry.teamName}</Link><strong>{n(entry[key])}</strong></li>)}</ol>{!record.teams.length && <p>{c.empty}</p>}</section>)}</section></div>
  </>}</>}</ProfileFrame>;
}

function ArchiveResults({ view, race }: { view: HistoryView; race: HistoryRace }) {
  const c = view.copy, data = view.data!, rows = data.results.filter((row) => row.race_id === race.id).sort((a, b) => (position(a.finish_position) ?? Infinity) - (position(b.finish_position) ?? Infinity) || (position(a.grid_position) ?? Infinity) - (position(b.grid_position) ?? Infinity) || a.id.localeCompare(b.id));
  const fastest = fastestLapDriver(rows);
  return <ProfileTable view={view} headings={[c.position, c.driver, c.team, c.start, c.finish, c.lapTime, c.raceTime, c.points, c.status]}>{rows.length ? rows.map((row) => { const snapshot = historySnapshot(data, row.driver_id, race), fl = row.driver_id === fastest; return <tr key={row.id}><td>{position(row.finish_position) ?? '—'}</td><td><HistoryDriverLink view={view} id={row.driver_id} name={snapshot.display_name} /></td><td>{snapshot.league_team || c.noTeam}</td><td>{position(row.grid_position) ?? '—'}</td><td>{position(row.finish_position) ?? '—'}</td><td className={fl ? 'profile-fastest' : undefined}>{lapTime(row)}{fl && <span className="profile-badge" title={c.fastestLaps}>FL</span>}</td><td>{row.race_time || formatRaceDuration(row.race_time_ms)}</td><td className={fl ? 'profile-fastest' : undefined}>{view.formatNumber(points(row))}</td><td>{row.participation_status?.trim().toUpperCase() || '—'}</td></tr>; }) : <tr><td colSpan={9}>{c.noPublication}</td></tr>}</ProfileTable>;
}
export function RacingArchive() {
  const view = useRacingHistory(), { data, copy: c, formatNumber: n } = view, h = historyMessages[view.language];
  const seasons = [...data?.seasons || []].filter((s) => !s.is_active).sort((a, b) => (b.archived_at || b.created_at).localeCompare(a.archived_at || a.created_at));
  const id = view.params.get('season') || seasons[0]?.id, season = seasons.find((s) => s.id === id);
  const races = data?.races.filter((r) => r.season_id === season?.id).sort((a, b) => a.round_number - b.round_number) || [];
  return <ProfileFrame view={view} title={season ? `${season.name} · ${h.archived}` : h.archive} kind="archive">{data && <>{!seasons.length ? <div role="status"><p>{h.emptyArchive}</p><p>{h.archiveHint}</p></div> : <><div className="profile-controls"><label>{c.seasonName}<select value={id} onChange={(event) => view.choose('season', event.target.value)}>{seasons.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div>{!season ? <p role="status">{c.missing}</p> : <>
    <StatList values={[[c.race, n(races.length)], [h.withResults, n(races.filter((r) => data.results.some((row) => row.race_id === r.id)).length)], [h.resultRows, n(data.results.filter((row) => races.some((r) => r.id === row.race_id)).length)], [h.game, season.game_label || season.game_key || '—']]} />
    {!races.length && <p>{h.emptyRaces}</p>}{races.map((race, index) => <details className="history-archive-race" key={`${season.id}:${race.id}`} open={index === 0}><summary><strong>{c.round} {race.round_number} · {race.grand_prix_name}</strong><small>{race.circuit_name} · {race.race_date ? view.formatDate(race.race_date) : c.unknown}</small></summary><p>{c.status}: {race.status === 'completed' ? c.raceFinished : race.status}</p><p><RaceLink view={view} race={race} /></p><ArchiveResults view={view} race={race} /></details>)}
  </>}</>}</>}</ProfileFrame>;
}

function ChampionCard({ entry, language }: { entry: Champion; language: ReturnType<typeof useI18n>['language'] }) {
  const h = historyMessages[language], c = profileMessages[language];
  return <div className="history-champions"><div><ProfileImage src="/v1-assets/images/hof-driver-champion.svg" alt="" fallback={null} /><p>{h.driverChampion}</p><h3>{entry.driver_champion}</h3><p>{h.championTeam}: {entry.driver_champion_team || c.noTeam}</p></div><div><ProfileImage src="/v1-assets/images/hof-constructor-champion.svg" alt="" fallback={null} /><p>{h.teamChampion}</p><h3>{entry.constructor_champion}</h3><p>{h.lineup}: {entry.constructor_champion_lineup || '—'}</p></div></div>;
}
export function RacingHallOfFame() {
  const { leagueSlug } = useLeague(), { language, formatNumber: n } = useI18n(), h = historyMessages[language], c = profileMessages[language];
  const [records, setRecords] = useState<Champion[] | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0), [celebrating, setCelebrating] = useState(false);
  useEffect(() => { const abort = new AbortController(); setRecords(null); setError(false); void loadHistoricChampions(leagueSlug, abort.signal).then((value) => { if (!abort.signal.aborted) setRecords(value); }).catch(() => { if (!abort.signal.aborted) setError(true); }); return () => abort.abort(); }, [leagueSlug, retry]);
  useEffect(() => { if (!celebrating) return; const timer = window.setTimeout(() => setCelebrating(false), 5000); return () => window.clearTimeout(timer); }, [celebrating]);
  const current = records?.[0], totals = championTotals(records || []);
  return <section className="native-racing native-profile" data-native-racing="hall-of-fame" aria-labelledby="hall-title"><h1 id="hall-title">{h.hall}</h1>{error ? <div role="alert"><p>{h.hallError}</p><button type="button" onClick={() => setRetry((n) => n + 1)}>{c.retry}</button></div> : !records ? <p role="status">{c.loading}</p> : !current ? <p role="status">{h.emptyHall}</p> : <>
    <p>{h.historicSource} · {n(records.length)} {c.seasonName}</p><section className="profile-section"><h2>{h.currentChampions} · {c.seasonName} {current.season_name}</h2><ChampionCard entry={current} language={language} /><button type="button" disabled={celebrating} onClick={() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setCelebrating(true); }}>{h.celebrate}</button></section>
    {celebrating && <div className="history-celebration" aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ left: `${(i * 31) % 100}%`, animationDelay: `${(i % 7) * .2}s` }} />)}</div>}
    <section className="profile-section"><h2>{h.championHistory}</h2>{records.slice(1, 4).map((entry) => <section key={entry.season_name}><h3>{c.seasonName} {entry.season_name}</h3><ChampionCard entry={entry} language={language} /></section>)}{records.length > 4 && <details><summary>{h.archived} · {records.length - 4}</summary>{records.slice(4).map((entry) => <section key={entry.season_name}><h3>{c.seasonName} {entry.season_name}</h3><ChampionCard entry={entry} language={language} /></section>)}</details>}</section>
    <div className="profile-columns"><section className="profile-section"><h2>{h.peopleTotals}</h2><ol className="profile-list">{totals.people.map((entry) => <li key={entry.name}><strong>{entry.name}</strong><p>{h.driverChampion}: {n(entry.driver)} · {h.teamChampion}: {n(entry.constructor)}</p></li>)}</ol></section><section className="profile-section"><h2>{h.teamTotals}</h2><ol className="profile-list">{totals.teams.map((entry) => <li key={entry.name}><strong>{entry.name}</strong><p>{n(entry.total)} × {h.teamChampion}</p></li>)}</ol></section></div>
  </>}</section>;
}
