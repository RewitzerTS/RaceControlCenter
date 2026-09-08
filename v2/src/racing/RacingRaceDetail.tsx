import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Database } from '../types/database';
import { useRacingHistory, ProfileFrame, ProfileTable, ProfileImage, type HistoryView } from './ProfileShared';
import { historySnapshot, points, position, readHistoryPages, type HistoryResult } from './profileData';
import { fastestLapDriver } from './resultsData';
import { calendarRaceDate, calendarTrack, racingHref } from './calendarData';

type Tables = Database['public']['Tables'];
type Revision = Pick<Tables['result_versions']['Row'], 'id' | 'version_number' | 'status' | 'change_reason'>;
type Steward = Pick<Tables['steward_cases']['Row'], 'id' | 'title' | 'description' | 'reported_driver_id' | 'accused_driver_id' | 'status' | 'rule_code' | 'rule_version'>;
type Extras = { raceId: string; versions: Revision[] | null; stewards: Steward[] | null };
export function formatRaceDuration(milliseconds: number | null | undefined) {
  if (milliseconds == null || !Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(3).padStart(6, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
export function lapTime(row: HistoryResult) {
  if (row.fastest_lap_time) return row.fastest_lap_time;
  const value = [row.fastest_lap_time_ms, row.fastest_lap_ms].find((n) => n != null && n > 0);
  return value ? `${Math.floor(value / 60000)}:${((value % 60000) / 1000).toFixed(3).padStart(6, '0')}` : '—';
}
function Incident({ entry, view }: { entry: Steward; view: HistoryView }) {
  const lines = entry.description.split(/\r?\n/);
  const fallback = (key: string) => lines.find((line) => line.startsWith(key))?.slice(key.length).trim() || '—';
  const name = (id: string | null, key: string) => view.data!.drivers.find((driver) => driver.id === id)?.display_name || fallback(key);
  const description = lines.filter((line) => !/^\[Fahrer[12]\] /.test(line)).join('\n');
  const c = view.copy;
  const statuses: Record<string, string> = { closed: c.closed, open: c.open, under_review: c.review, appeal: c.appeal, draft: c.draft, finalized: c.finalized, published: c.published, withdrawn: c.withdrawn };
  return <li><h3>{entry.title || c.stewards}</h3><p className="profile-description">{description || c.noDescription}</p><p>{c.participants}: {name(entry.reported_driver_id, '[Fahrer1] ')} / {name(entry.accused_driver_id, '[Fahrer2] ')}</p><p>{c.decision}: {statuses[entry.status] || entry.status || '—'}</p><p>{c.consequence}: {[entry.rule_code, entry.rule_version].filter(Boolean).join(' · ') || '—'}</p></li>;
}
export function RacingRaceDetail() {
  const view = useRacingHistory(true), { data, copy: c, client, params } = view;
  const selectedSeason = params.get('season') || [...data?.seasons || []].reverse().find((season) => season.is_active)?.id;
  const round = params.get('round');
  const race = data?.races.find((race) => race.season_id === selectedSeason && String(race.round_number) === round);
  const raceId = race?.id || '', leagueId = data?.leagueId || '';
  const [extras, setExtras] = useState<Extras | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setExtras(null);
    if (raceId) void Promise.allSettled([
      readHistoryPages((from, to) => client.from('result_versions').select('id,version_number,status,change_reason').eq('race_id', raceId).order('version_number', { ascending: false }).order('id').range(from, to).abortSignal(controller.signal), controller.signal),
      readHistoryPages((from, to) => client.from('steward_cases').select('id,title,description,reported_driver_id,accused_driver_id,status,rule_code,rule_version').eq('league_id', leagueId).eq('race_id', raceId).order('created_at', { ascending: false }).order('id').range(from, to).abortSignal(controller.signal), controller.signal),
    ]).then(([versions, stewards]) => { if (!controller.signal.aborted) setExtras({ raceId, versions: versions.status === 'fulfilled' ? versions.value : null, stewards: stewards.status === 'fulfilled' ? stewards.value : null }); });
    return () => controller.abort();
  }, [client, raceId, leagueId, retry]);
  const rows = data?.results.filter((row) => row.race_id === raceId).sort((a, b) => (position(a.finish_position) ?? 999) - (position(b.finish_position) ?? 999)) || [];
  const fastest = fastestLapDriver(rows), track = race ? calendarTrack(race) : null;
  const startAt = race?.race_start_at ? new Date(race.race_start_at) : null;
  const date = startAt && Number.isFinite(startAt.getTime()) ? startAt : race ? calendarRaceDate(race) : null;
  const status: Record<string, string> = { completed: c.raceFinished, scheduled: c.scheduled, upcoming: c.scheduled, cancelled: c.cancelled, canceled: c.cancelled };
  const weather: Record<string, string> = { dynamic: c.dynamic, dry: c.dry, wet: c.wet };
  const metadata = extras?.raceId === raceId ? extras : null;
  return <ProfileFrame view={view} title={race?.grand_prix_name || c.raceTitle} kind="race-detail">{data && <><p><Link to={racingHref('/racing/calendar', view.leagueSlug, race ? { round: race.round_number, season: race.season_id } : {})}>{c.calendar}</Link></p>{!race ? <p role="status">{c.missing}</p> : <>
    <div className="profile-race-summary">{/^[a-z]{2}$/i.test(race.country_code || track?.countryCode || '') && <ProfileImage src={`/v1-assets/images/flags/${(race.country_code || track!.countryCode).toLowerCase()}.svg`} alt={race.country_code || track?.countryCode || ''} className="profile-flag" fallback={race.country_code} />}<dl>{[[c.round, String(race.round_number)], [c.seasonName, data.seasons.find((season) => season.id === race.season_id)?.name || '—'], [c.date, date ? view.formatDate(date) + (startAt && Number.isFinite(startAt.getTime()) ? ` · ${view.formatTime(date)}` : race.race_time ? ` · ${race.race_time}` : '') : '—'], [c.circuit, race.circuit_name || track?.circuitName || '—'], [c.weather, weather[race.weather || ''] || race.weather || c.unknown], [c.status, status[race.status] || race.status]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
    <section className="profile-section"><h2>{c.versions}</h2>{!metadata ? <p role="status">{c.loading}</p> : metadata.versions == null ? <div role="alert"><p>{c.versionError}</p><button type="button" onClick={() => setRetry((n) => n + 1)}>{c.retry}</button></div> : metadata.versions.length ? <details><summary>{c.history} · {metadata.versions.length}</summary><ol className="profile-list">{metadata.versions.map((version) => <li key={version.id}><strong>V{version.version_number} · {race.current_result_version_id === version.id ? c.current : version.status === 'superseded' ? c.replaced : c.voided}</strong><p>{version.change_reason || (version.version_number === 1 ? c.initial : c.correction)}</p></li>)}</ol></details> : <p>{race.current_result_version_id ? c.versionUnavailable : c.noPublication}</p>}</section>
    <section className="profile-section"><h2>{c.results}</h2><ProfileTable view={view} headings={[c.position, c.driver, c.team, c.start, c.finish, c.lapTime, c.raceTime, c.points, c.status]}>{rows.length ? rows.map((row) => { const snapshot = historySnapshot(data, row.driver_id, race); const fl = row.driver_id === fastest; return <tr key={row.id}><td>{position(row.finish_position) ?? '—'}</td><td><Link to={racingHref('/racing/drivers/profile', view.leagueSlug, { driver: row.driver_id, season: race.season_id })}>{snapshot.display_name}</Link></td><td>{snapshot.league_team || c.noTeam}</td><td>{position(row.grid_position) ?? '—'}</td><td>{position(row.finish_position) ?? '—'}</td><td className={fl ? 'profile-fastest' : undefined}>{lapTime(row)}{fl && <span className="profile-badge" title={c.fastestLaps}>FL</span>}</td><td>{row.race_time || formatRaceDuration(row.race_time_ms)}</td><td className={fl ? 'profile-fastest' : undefined}><strong>{view.formatNumber(points(row))}</strong></td><td>{row.participation_status?.trim().toUpperCase() || '—'}</td></tr>; }) : <tr><td colSpan={9}>{c.noPublication}</td></tr>}</ProfileTable></section>
    {track && <section className="profile-section"><h2>{c.map}</h2><ProfileImage src={`/v1-assets/trackmaps/${track.trackMapFile}`} alt={track.circuitName} className="profile-track-map" fallback={track.circuitName} /></section>}
    <section className="profile-section"><h2>{c.stewards}</h2>{!metadata ? <p role="status">{c.loading}</p> : metadata.stewards == null ? <div role="alert"><p>{c.stewardError}</p><button type="button" onClick={() => setRetry((n) => n + 1)}>{c.retry}</button></div> : metadata.stewards.length ? <ul className="profile-list">{metadata.stewards.map((entry) => <Incident key={entry.id} view={view} entry={entry} />)}</ul> : <p>{c.empty}</p>}</section>
  </>}</>}</ProfileFrame>;
}
