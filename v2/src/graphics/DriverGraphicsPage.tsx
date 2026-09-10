import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import { AppState } from '../components/AppState';
import { loadHistory, type HistoryData } from '../racing/profileData';
import { loadResultsOwnDriver } from '../racing/resultsData';
import { buildDriverGraphic, driverGraphicCopy, type DriverGraphicKind } from './driverGraphics';
import { paginateGraphicModel, type GraphicFormat } from './graphics';
import { drawGraphic, readGraphicTheme, renderGraphicPng, mixGraphicColors } from './renderPng';
import { downloadGraphicFiles } from './downloadGraphics';

function driverTheme() {
  const theme = readGraphicTheme();
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const target = luminance(theme.surface) < 0.18 ? '#FFFFFF' : '#000000';
  const original = theme.primary;
  for (let step = 0; step <= 20 && Math.min(contrast(theme.primary, theme.surface), contrast(theme.primary, theme.background)) < 4.5; step++) theme.primary = mixGraphicColors(original, target, step / 20);
  theme.onPrimary = contrast(theme.primary, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#000000';
  return theme;
}

export function DriverGraphicsPage() {
  const { client, leagueSlug, branding } = useLeague();
  const { user } = useAuth();
  const { language } = useI18n();
  const copy = driverGraphicCopy[language];
  const [loaded, setLoaded] = useState<{ data: HistoryData; own: string; client: typeof client; userId: string } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [seasonId, setSeasonId] = useState('');
  const [raceId, setRaceId] = useState('');
  const [kind, setKind] = useState<DriverGraphicKind>('race_result');
  const [format, setFormat] = useState<GraphicFormat>('portrait');
  const [pageIndex, setPageIndex] = useState(0);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = loaded?.client === client && loaded.userId === user?.id ? loaded.data : null;
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setError(false);
    setLoaded(null);
    void loadHistory(client, leagueSlug, user.id, controller.signal).then(async (history) => {
      const own = await loadResultsOwnDriver(client, user.id, history.drivers, controller.signal);
      controller.signal.throwIfAborted();
      setLoaded({ data: history, own, client, userId: user.id });
      const season = history.seasons.filter((item) => item.is_active).at(-1) || history.seasons.at(-1);
      setSeasonId(season?.id || '');
      setRaceId('');
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [client, leagueSlug, user?.id, retry]);
  const races = data?.races.filter((race) => race.season_id === seasonId && race.current_result_version_id).sort((a, b) => b.round_number - a.round_number) || [];
  const selectedRace = races.find((race) => race.id === raceId)?.id || races[0]?.id || '';
  const model = useMemo(() => data ? buildDriverGraphic(data, kind, seasonId, selectedRace, loaded?.own || '', branding.name, copy) : null, [data, kind, seasonId, selectedRace, loaded?.own, branding.name, copy]);
  const pages = useMemo(() => model ? paginateGraphicModel(model, 10) : [], [model]);
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  useEffect(() => { setPageIndex(0); setExportState('idle'); }, [model, format]);
  useEffect(() => {
    let active = true;
    const paint = () => {
      if (!page || !canvas.current) return;
      void drawGraphic(canvas.current, page.model, format, { branding: { name: branding.name, logoUrl: branding.logoUrl || undefined }, theme: driverTheme(), pageLabel: `${copy.page} ${page.pageNumber}/${page.pageCount}`, pageNumber: page.pageNumber, pageCount: page.pageCount }).catch(() => { if (active) setExportState('error'); });
    };
    paint();
    window.addEventListener('racevora:theme-changed', paint);
    return () => { active = false; window.removeEventListener('racevora:theme-changed', paint); };
  }, [page, format, branding.name, branding.logoUrl, copy.page]);
  async function download() {
    if (!pages.length || exportState === 'busy') return;
    setExportState('busy');
    try {
      const files = [];
      for (const item of pages) files.push({ blob: await renderGraphicPng(item.model, format, { branding: { name: branding.name, logoUrl: branding.logoUrl || undefined }, theme: driverTheme(), pageLabel: `${copy.page} ${item.pageNumber}/${item.pageCount}`, pageNumber: item.pageNumber, pageCount: item.pageCount }), filename: `racevora-${kind}-${format}-${item.pageNumber}.png` });
      await downloadGraphicFiles(files, `racevora-${kind}-${format}.zip`);
      setExportState('done');
    } catch { setExportState('error'); }
  }
  if (error) return <AppState title={copy.error} action={<button type="button" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button>} tone="error" />;
  if (!data) return <AppState title={copy.title} copy={copy.busy} tone="loading" />;
  return <section className="graphics-studio">
    <header className="graphics-header"><div><h1>{copy.title}</h1><p>{copy.copy}</p></div><NavLink to="/profile" className="text-link">{copy.back}</NavLink></header>
    <div className="graphics-workbench">
      <section className="graphics-controls" aria-label={copy.title}>
        <label className="graphics-race-picker">{copy.season}<select value={seasonId} onChange={(event) => { setSeasonId(event.target.value); setRaceId(''); }}>{data.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        <fieldset><legend>{copy.title}</legend><div className="graphics-choice-list">{(['race_result', 'driver_standings', 'team_standings', 'statistics'] as const).map((value) => <label key={value}><input type="radio" name="driver-graphic-kind" checked={kind === value} onChange={() => setKind(value)} /><span>{copy[value]}</span></label>)}</div></fieldset>
        {kind === 'race_result' && <label className="graphics-race-picker">{copy.race}<select value={selectedRace} onChange={(event) => setRaceId(event.target.value)}>{races.map((race) => <option key={race.id} value={race.id}>{race.round_number} · {race.grand_prix_name}</option>)}</select></label>}
        <fieldset><legend>{copy.format}</legend><div className="graphics-format-list">{(['square', 'portrait', 'story'] as const).map((value) => <label key={value}><input type="radio" name="driver-graphic-format" checked={format === value} onChange={() => setFormat(value)} /><span>{value === 'square' ? '1:1' : value === 'portrait' ? 'Feed · 4:5' : 'Story · 9:16'}</span></label>)}</div></fieldset>
        <button type="button" className="primary-action" disabled={!model || exportState === 'busy'} onClick={() => void download()}>{exportState === 'busy' ? copy.busy : pages.length > 1 ? copy.all : copy.download}</button>
        <p role="status">{exportState === 'error' ? copy.error : exportState === 'done' ? copy.done : ''}</p>
      </section>
      <section className="graphics-preview-panel" aria-label={copy.preview}>
        {page ? <><canvas className={`graphic-canvas-preview graphic-canvas-preview--${format}`} ref={canvas} role="img" aria-label={`${copy.preview}: ${page.model.title}`} />{pages.length > 1 && <nav className="graphics-page-navigation" aria-label={copy.page}>{pages.map((item, index) => <button key={item.pageNumber} type="button" aria-current={page === item ? 'page' : undefined} onClick={() => setPageIndex(index)}>{item.pageNumber}</button>)}</nav>}</> : <p>{kind === 'statistics' && !loaded?.own ? copy.noLink : copy.empty}</p>}
      </section>
    </div>
  </section>;
}
