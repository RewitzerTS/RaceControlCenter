import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { calendarTrack, racingHref } from '../racing/calendarData';
import facts from '../racing/trackFacts.json';
import type { UpcomingRace } from './driverHome';
import venues from './venueMedia.json';
import './raceDay.css';

export function RaceDayCarousel({ races, league, gameKey }: { races: UpcomingRace[]; league: string; gameKey?: string }) {
  const { t, formatDate, formatTime } = useI18n();
  const [selectedId, setSelectedId] = useState(races[0]?.id);
  const container = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(true);
  const start = useRef<{ x: number; y: number } | null>(null);
  const index = Math.max(0, races.findIndex((race) => race.id === selectedId));
  const race = races[index];
  const [failedImage, setFailedImage] = useState<string | null>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    preference.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      preference.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  useEffect(() => {
    if (!container.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= .35), { threshold: [0, .35] });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [Boolean(race)]);
  const rotating = races.length > 1 && !paused && !hovered && !hidden && !reducedMotion && visible;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setSelectedId(races[(index + 1) % races.length].id), 4000);
    return () => window.clearTimeout(timer);
  }, [rotating, index, races]);
  if (!race) return null;
  const track = calendarTrack(race, gameKey);
  const media = venues.find((venue) => venue.keys.includes(track?.key ?? ''));
  const fact = facts.find((entry) => entry.id === track?.key);
  const change = (offset: number) => { setPaused(true); setSelectedId(races[(index + offset + races.length) % races.length].id); };
  const name = race.grand_prix_name.replace(/\s+GP$/i, '');
  return <section ref={container} className="race-day" aria-label={t('raceDay.title')} aria-roledescription={t('raceDay.carousel')}
    tabIndex={0}
    onFocusCapture={(event) => { if (!(event.target instanceof Element) || !event.target.closest('.race-day-playback')) setPaused(true); }}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); change(event.key === 'ArrowRight' ? 1 : -1);
      }
    }}
    onTouchStart={(event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.race-day-playback')) setPaused(true);
      const touch = event.touches[0]; start.current = { x: touch.clientX, y: touch.clientY };
    }}
    onTouchEnd={(event) => {
      const touch = event.changedTouches[0], from = start.current;
      start.current = null;
      if (from && Math.abs(touch.clientX - from.x) > 55 && Math.abs(touch.clientX - from.x) > Math.abs(touch.clientY - from.y) * 1.5) change(touch.clientX < from.x ? 1 : -1);
    }}>
    {media && failedImage !== media.src && <img className="race-day-photo" src={media.src} alt="" fetchPriority="high" onError={() => setFailedImage(media.src)} />}
    <div className="race-day-content">
      <h2>{name}{/\s+GP$/i.test(race.grand_prix_name) && <span> GP</span>}</h2>
      <p className="race-day-circuit">{race.circuit_name || track?.circuitName}</p>
      <p className="race-day-date">{race.race_date ? formatDate(race.race_date) : t('home.dateTbd')}
        {(race.race_start_at || race.race_time) && <span> · {race.race_start_at ? formatTime(race.race_start_at) : race.race_time?.slice(0, 5)}</span>}
      </p>
      {track && <NavLink className="race-day-open" to={racingHref('/racing/tracks/profile', league, { season: race.season_id, track: track.key })}>
        {t('raceDay.open')}<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
      </NavLink>}
      {track?.trackMapFile && <figure className="race-day-map">
        <figcaption>{t('raceDay.layout')}<span>{fact?.lengthKm}</span></figcaption>
        <img src={`/v1-assets/trackmaps/${track.trackMapFile}`} alt={track.circuitName} />
      </figure>}
    </div>
    <footer className="race-day-footer">
      <div className="race-day-controls">
        {races.length > 1 && <button type="button" aria-label={t('raceDay.previous')} onClick={() => change(-1)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg></button>}
        <span role="status" aria-live={rotating ? 'off' : 'polite'}><span className="race-day-accessible-count">{t('raceDay.position', { current: index + 1, total: races.length })}</span><span aria-hidden="true">{index + 1} / {races.length}</span></span>
        {races.length > 1 && <button type="button" aria-label={t('raceDay.next')} onClick={() => change(1)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6" /></svg></button>}
        {races.length > 1 && !reducedMotion && <button type="button" className="race-day-playback" aria-label={t(paused ? 'raceDay.play' : 'raceDay.pause')} title={t(paused ? 'raceDay.play' : 'raceDay.pause')} onClick={() => setPaused((value) => !value)}><svg aria-hidden="true" viewBox="0 0 24 24">{paused ? <path d="m9 5 10 7-10 7Z" /> : <path d="M8 5v14M16 5v14" />}</svg></button>}
      </div>
      {media && failedImage !== media.src && <small className="race-day-credit">{t('raceDay.artCredit')}</small>}
    </footer>
    {races.length > 1 && <nav className="race-day-races" aria-label={t('raceDay.choose')}>{races.map((entry, i) =>
      <button key={entry.id} type="button" aria-pressed={i === index} onClick={() => { setPaused(true); setSelectedId(entry.id); }}><span>{i + 1}</span>{entry.grand_prix_name}</button>
    )}</nav>}
  </section>;
}
