import { Link } from 'react-router-dom';
import { ProfileFrame, ProfileImage, ProfileTable, RaceLink, StatList, useRacingHistory, type HistoryView } from './ProfileShared';
import { listHistoryTracks, trackFacts, trackStats, type trackMeta } from './trackData';
import { historyMessages } from './historyMessages';
import { racingHref } from './calendarData';
import './history.css';

export function HistoryPeriod({ view }: { view: HistoryView }) {
  const h = historyMessages[view.language];
  return <label>{view.copy.season}<select value={view.params.get('season') || ''} onChange={(event) => view.choose('season', event.target.value)}><option value="">{h.history}</option>{[...view.data!.seasons].reverse().map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>;
}
export function HistoryDriverLink({ view, id, name }: { view: HistoryView; id: string; name: string }) {
  return <Link to={racingHref('/racing/drivers/profile', view.leagueSlug, { driver: id, ...(view.params.get('season') ? { season: view.params.get('season')! } : {}) })}>{name}</Link>;
}
function TrackMap({ meta, compact = false }: { meta: ReturnType<typeof trackMeta>; compact?: boolean }) {
  return meta.track ? <ProfileImage src={`/v1-assets/trackmaps/${meta.track.trackMapFile}`} alt={meta.circuit} className={compact ? 'history-track-thumbnail' : 'profile-track-map'} fallback={meta.circuit} /> : null;
}
function TrackFlag({ country }: { country: string }) { return /^[a-z]{2}$/i.test(country) ? <ProfileImage src={`/v1-assets/images/flags/${country.toLowerCase()}.svg`} alt={country} className="profile-flag" fallback={country} /> : null; }

export function RacingTracks({ profile = false }: { profile?: boolean }) {
  const view = useRacingHistory(), { data, copy: c, params, formatNumber: n } = view, h = historyMessages[view.language];
  const season = params.get('season') || '';
  const validSeason = !season || data?.seasons.some((s) => s.id === season);
  const tracks = data && validSeason ? listHistoryTracks(data, season) : [];
  const key = params.get('track') || tracks[0]?.key || '';
  const stats = data && profile && validSeason ? trackStats(data, key, season) : null;
  const info = stats ? trackFacts(stats.meta) : null;
  const totals = data && !profile ? tracks.map((meta) => trackStats(data, meta.key, season)!).reduce((sum, value) => ({ races: sum.races + value.races, starts: sum.starts + value.starts, laps: sum.laps + Number(Boolean(value.bestLap)) }), { races: 0, starts: 0, laps: 0 }) : null;
  return <ProfileFrame view={view} title={profile ? h.trackProfile : h.tracks} kind={profile ? 'track-profile' : 'tracks'}>{data && <>
    <div className="profile-controls">{profile && <label>{h.track}<select value={key} onChange={(event) => view.choose('track', event.target.value)}>{tracks.map((meta) => <option key={meta.key} value={meta.key}>{meta.name} · {meta.circuit}</option>)}</select></label>}<HistoryPeriod view={view} /></div>
    {!validSeason || (profile && !stats && tracks.length > 0) ? <p role="status">{c.missing}</p> : !tracks.length ? <p role="status">{h.emptyTracks}</p> : !profile ? <>
      <StatList values={[[h.tracks, n(tracks.length)], [c.race, n(totals!.races)], [c.starts, n(totals!.starts)], [h.withLap, n(totals!.laps)]]} />
      <ul className="history-track-grid">{tracks.map((meta) => <li key={meta.key}><Link to={racingHref('/racing/tracks/profile', view.leagueSlug, { track: meta.key, ...(season ? { season } : {}) })}><TrackMap meta={meta} compact /><div className="profile-meta"><TrackFlag country={meta.country} /><h2>{meta.name}</h2></div><p>{meta.circuit}</p></Link></li>)}</ul>
    </> : stats && <>
      <p><Link to={racingHref('/racing/tracks', view.leagueSlug, season ? { season } : {})}>{h.backTracks}</Link></p>
      <div className="profile-identity"><div><div className="profile-meta"><TrackFlag country={stats.meta.country} /><span>{info?.country || stats.meta.country}</span></div><h2>{stats.meta.name}</h2><p>{stats.meta.circuit}</p><p>{[info?.trackType, info?.direction].filter(Boolean).join(' · ')}</p></div><TrackMap meta={stats.meta} /></div>
      <StatList values={[[c.race, n(stats.races)], [c.starts, n(stats.starts)], [c.driver, n(stats.uniqueDrivers)], [h.corners, info?.corners ?? '—'], [h.length, info?.lengthKm || '—']]} />
      <section className="profile-section"><h2>{h.bestLap}</h2>{stats.bestLap ? <p className="profile-fastest"><strong>{stats.bestLap.text}</strong> · <HistoryDriverLink view={view} id={stats.bestLap.driverId} name={stats.bestLap.name} /></p> : <p>{c.empty}</p>}<p>{h.f1Record}: {info?.lapRecord || '—'}</p></section>
      <div className="profile-columns"><section className="profile-section"><h2>{h.facts}</h2>{info ? <dl className="history-facts">{[[h.country, info.country], [h.type, info.trackType], [h.direction, info.direction], [h.corners, info.corners], [h.drs, info.drsZones], [h.length, info.lengthKm], [h.distance, info.raceDistanceKm], [h.laps, info.laps], [h.firstGP, info.firstGrandPrix]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p>{c.empty}</p>}</section>
      <section className="profile-section"><h2>{h.leaders}</h2><ul className="profile-list">{(['wins', 'podiums', 'poles', 'fastestLaps', 'points', 'starts'] as const).map((field) => { const leader = stats.leaders[field]; return <li key={field}><span>{c[field]}: </span>{leader ? <><HistoryDriverLink view={view} id={leader.driverId} name={leader.name} /> · <strong>{n(leader[field])}</strong></> : '—'}</li>; })}</ul></section></div>
      <section className="profile-section"><h2>{c.driver}</h2><ProfileTable view={view} headings={[c.driver, c.starts, c.wins, c.podiums, c.poles, c.fastestLaps, c.points, c.bestFinish, h.bestLap]}>{stats.records.map((driver) => <tr key={driver.driverId}><td><HistoryDriverLink view={view} id={driver.driverId} name={driver.name} /></td>{([driver.starts, driver.wins, driver.podiums, driver.poles, driver.fastestLaps, driver.points] as number[]).map((value, index) => <td key={index}>{n(value)}</td>)}<td>{driver.bestFinish ? `P${driver.bestFinish}` : '—'}</td><td>{driver.bestLap?.text || '—'}</td></tr>)}</ProfileTable></section>
      <section className="profile-section"><h2>{c.history}</h2><ProfileTable view={view} headings={[c.seasonName, c.raceTitle, h.winner, c.fastestLaps]}>{stats.history.map(({ race, winner, fastest }) => <tr key={race.id}><td>{data.seasons.find((s) => s.id === race.season_id)?.name || '—'}</td><td><RaceLink view={view} race={race} /></td><td>{winner ? <HistoryDriverLink view={view} id={winner.driverId} name={winner.name} /> : '—'}</td><td>{fastest ? <><HistoryDriverLink view={view} id={fastest.driverId} name={fastest.name} /> · {fastest.text}</> : '—'}</td></tr>)}</ProfileTable></section>
    </>}
  </>}</ProfileFrame>;
}
