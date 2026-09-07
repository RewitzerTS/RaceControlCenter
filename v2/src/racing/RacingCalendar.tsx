import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { calendarMessages } from './calendarMessages';
import { calendarRaceDate, calendarRaceStatus, calendarTrack, loadCalendar, loadCalendarArchive, racingHref, type CalendarData, type CalendarRace, type CalendarSeason } from './calendarData';
import './racing.css';

type Section = 'upcoming' | 'completed' | 'archive';
type LoadState<T> = { data: T | null; loading: boolean; error: boolean };
const initialState = { data: null, loading: true, error: false };
function readPreference(key: string) { try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; } }
function savePreference(key: string, value: string) { try { sessionStorage.setItem(key, value); } catch { /* Storage is optional. */ } }

function CalendarImage({ src, alt, fallback, ...props }: { src: string; alt: string; fallback: string; className?: string; width?: number; height?: number }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="calendar-image-fallback">{fallback}</span> : <img {...props} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export function RacingCalendar() {
  const { client, leagueSlug } = useLeague();
  const { language, t, formatDate, formatNumber } = useI18n();
  const copy = calendarMessages[language];
  const location = useLocation();
  const navigate = useNavigate();
  const preferenceKey = `racevora.calendar:${leagueSlug}`;
  const [section, setSection] = useState<Section>(() => {
    const saved = readPreference(`${preferenceKey}:section`);
    return saved === 'completed' || saved === 'archive' ? saved : 'upcoming';
  });
  const [archiveId, setArchiveId] = useState(() => readPreference(`${preferenceKey}:season`));
  const [calendar, setCalendar] = useState<LoadState<CalendarData>>(initialState);
  const [archive, setArchive] = useState<LoadState<CalendarSeason[]>>(initialState);
  const [retry, setRetry] = useState(0);
  const [archiveRetry, setArchiveRetry] = useState(0);
  const [map, setMap] = useState<{ src: string; title: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mapTrigger = useRef<HTMLButtonElement | null>(null);
  const targetCard = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setCalendar(initialState);
    void loadCalendar(client, leagueSlug, controller.signal).then((data) => {
      if (!controller.signal.aborted) setCalendar({ data, loading: false, error: false });
    }).catch(() => { if (!controller.signal.aborted) setCalendar({ data: null, loading: false, error: true }); });
    return () => controller.abort();
  }, [client, leagueSlug, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setArchive(initialState);
    void loadCalendarArchive(client, leagueSlug, controller.signal).then((data) => {
      if (!controller.signal.aborted) setArchive({ data, loading: false, error: false });
    }).catch(() => { if (!controller.signal.aborted) setArchive({ data: null, loading: false, error: true }); });
    return () => controller.abort();
  }, [client, leagueSlug, archiveRetry]);

  const races = calendar.data?.races ?? [];
  const upcoming = races.filter((race) => calendarRaceStatus(race) === 'upcoming');
  const completed = races.filter((race) => calendarRaceStatus(race) === 'completed').sort((a, b) => b.round_number - a.round_number);
  const params = new URLSearchParams(location.search);
  const targetRound = params.get('round');
  const targetSeason = params.get('season');
  const target = races.find((race) => String(race.round_number) === targetRound && (!targetSeason || race.season_id === targetSeason))
    ?? races.find((race) => String(race.round_number) === targetRound);

  useEffect(() => {
    if (!calendar.data) return;
    const requested = target ? (calendarRaceStatus(target) === 'completed' ? 'completed' : 'upcoming') : null;
    if (requested) setSection(requested);
    else if (!calendar.data.races.some((race) => calendarRaceStatus(race) === 'upcoming') && calendar.data.races.some((race) => calendarRaceStatus(race) === 'completed')) {
      setSection((current) => current === 'upcoming' ? 'completed' : current);
    }
  }, [calendar.data, target]);

  useEffect(() => {
    if (!target || !targetCard.current || section === 'archive') return;
    setHighlight(true);
    targetCard.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlight(false), 2400);
    return () => window.clearTimeout(timer);
  }, [target, section]);

  useEffect(() => { if (map) dialog.current?.showModal(); }, [map]);

  const chooseSection = (next: Section) => { setSection(next); savePreference(`${preferenceKey}:section`, next); };
  const selectedArchive = archive.data?.find((season) => season.id === archiveId);
  const archiveLabel = (season: CalendarSeason) => [season.name, season.game_label, season.archived_at ? new Date(season.archived_at).getFullYear() : null].filter(Boolean).join(' · ');

  function raceCard(race: CalendarRace) {
    const track = calendarTrack(race, calendar.data?.season?.game_key);
    const country = track?.countryCode ?? race.country_code ?? '';
    const date = calendarRaceDate(race);
    const mapSrc = track?.trackMapFile ? `/v1-assets/trackmaps/${track.trackMapFile}` : '';
    const title = race.circuit_name || track?.circuitName || copy.circuit;
    const done = calendarRaceStatus(race) === 'completed';
    const stewardCount = calendar.data?.stewardCounts[race.id] ?? 0;
    return <div key={race.id} ref={target?.id === race.id ? targetCard : undefined} className={`race-card-link${highlight && target?.id === race.id ? ' race-card-link-highlight' : ''}`} data-race-round={race.round_number} data-race-season={race.season_id}>
      <article className="race-card">
        <div className="race-top"><div>
          <div className="race-round">{/^[A-Za-z]{2}$/.test(country) && <span className="calendar-flag"><CalendarImage key={country} src={`/v1-assets/images/flags/${country.toLowerCase()}.svg`} alt={country.toUpperCase()} fallback={country.toUpperCase()} width={24} height={18} /></span>}<span>{copy.round} {formatNumber(race.round_number)}</span></div>
          <h3 className="race-name"><Link className="race-detail-link" to={racingHref('/racing/races/detail', leagueSlug, { round: race.round_number, season: race.season_id })}>{race.grand_prix_name}</Link></h3>
        </div><span className={`calendar-status ${done ? 'done' : ''}`}>{done ? copy.done : copy.planned}</span></div>
        <div className="race-meta">{date ? <time dateTime={date.toISOString()}>{formatDate(date, { dateStyle: 'medium', timeStyle: 'short' })}</time> : copy.date}<div>{title}</div><div>{copy.weather}: <strong>{race.weather ? race.weather.charAt(0).toUpperCase() + race.weather.slice(1) : copy.unknown}</strong></div>
          {stewardCount > 0 && <div>{copy.steward}: <strong>{formatNumber(stewardCount)} {stewardCount === 1 ? copy.caseOne : copy.caseMany}</strong></div>}
        </div>
        <div className="calendar-map">{mapSrc ? <button className="track-map-button" type="button" data-trackmap-open={mapSrc} aria-label={`${copy.openMap} ${title}`} onClick={(event) => { mapTrigger.current = event.currentTarget; setMap({ src: mapSrc, title }); }}><CalendarImage key={mapSrc} src={mapSrc} alt={`${title} · ${copy.map}`} fallback={copy.mapError} /></button> : <span>{copy.mapPending}</span>}</div>
      </article>
    </div>;
  }

  return <section className="native-racing native-calendar" aria-labelledby="calendar-title" data-native-racing="calendar">
    <header className="calendar-heading"><h1 id="calendar-title">{copy.title}</h1><p>{copy.subtitle}</p></header>
    <div className="calendar-toggle-row" aria-label={copy.title}>
      {(['upcoming', 'completed', 'archive'] as const).map((value) => <button className={`calendar-toggle${value === section ? ' primary' : ''}`} type="button" key={value} aria-pressed={value === section} aria-controls={`calendar-${value}`} onClick={() => chooseSection(value)}>{copy[value]}{value !== 'archive' && calendar.data ? ` (${formatNumber(value === 'upcoming' ? upcoming.length : completed.length)})` : ''}</button>)}
      <Link className="calendar-link" to={racingHref('/racing/tracks', leagueSlug)}>{copy.tracks}</Link>
    </div>
    {(['upcoming', 'completed'] as const).map((value) => <section key={value} id={`calendar-${value}`} className="calendar-section" hidden={section !== value} aria-labelledby={`calendar-${value}-title`} aria-busy={calendar.loading}>
      <h2 id={`calendar-${value}-title`}>{copy[value]}</h2>
      {calendar.loading ? <p role="status">{copy.loading}</p> : calendar.error ? <div role="alert"><p>{copy.error}</p><button type="button" className="calendar-link" onClick={() => setRetry((count) => count + 1)}>{copy.retry}</button></div> : <div className="calendar-grid">{(value === 'upcoming' ? upcoming : completed).length ? (value === 'upcoming' ? upcoming : completed).map(raceCard) : <p>{value === 'upcoming' ? copy.emptyUpcoming : copy.emptyCompleted}</p>}</div>}
    </section>)}
    <section id="calendar-archive" className="calendar-section" hidden={section !== 'archive'} aria-labelledby="calendar-archive-title" aria-busy={archive.loading}>
      <h2 id="calendar-archive-title">{copy.archiveTitle}</h2><p>{copy.archiveCopy}</p>
      {archive.loading ? <p role="status">{copy.archiveLoading}</p> : archive.error ? <div role="alert"><p>{copy.archiveError}</p><button type="button" className="calendar-link" onClick={() => setArchiveRetry((count) => count + 1)}>{copy.retry}</button></div> : !archive.data?.length ? <p>{copy.archiveEmpty}</p> : <div className="calendar-archive-controls">
        <label htmlFor="archive-season-select">{copy.season}</label>
        <select id="archive-season-select" value={selectedArchive?.id ?? ''} onChange={(event) => { setArchiveId(event.target.value); savePreference(`${preferenceKey}:season`, event.target.value); }}><option value="">{copy.selectSeason}</option>{archive.data.map((season) => <option key={season.id} value={season.id}>{archiveLabel(season)}</option>)}</select>
        <button className="calendar-toggle primary" type="button" disabled={!selectedArchive} onClick={() => { if (selectedArchive) void navigate(racingHref('/racing/history', leagueSlug, { view: 'seasons', season: selectedArchive.id })); }}>{copy.openArchive}</button>
        <p role="status">{selectedArchive ? `${copy.selected} ${archiveLabel(selectedArchive)}` : copy.archiveHint}</p>
      </div>}
    </section>
    <dialog ref={dialog} className="integrated-track-map" aria-labelledby="native-calendar-map-title" onClose={() => { setMap(null); mapTrigger.current?.focus({ preventScroll: true }); }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header><h2 id="native-calendar-map-title">{map?.title}</h2><button type="button" onClick={() => dialog.current?.close()}>{t('racing.closeMap')}</button></header>
      {map && <CalendarImage key={map.src} src={map.src} alt={map.title} fallback={copy.mapError} />}
    </dialog>
  </section>;
}
