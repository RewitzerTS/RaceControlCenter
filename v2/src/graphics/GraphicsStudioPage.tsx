import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState, EmptyState } from '../components/AppState';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import {
  buildGraphicModel,
  digestGraphicSource,
  graphicFilename,
  GRAPHIC_FORMATS,
  GRAPHIC_TYPES,
  loadGraphicsWorkspace,
  paginateGraphicModel,
  recordGraphicRender,
  type GraphicFormat,
  type GraphicLabels,
  type GraphicsWorkspace,
  type GraphicType,
} from './graphics';
import { downloadPng, drawGraphic, readGraphicTheme, renderGraphicPng, type GraphicBranding } from './renderPng';

const TYPE_KEYS: Record<GraphicType, MessageKey> = {
  race_result: 'graphics.type.raceResult',
  podium: 'graphics.type.podium',
  winner: 'graphics.type.winner',
  driver_standings: 'graphics.type.driverStandings',
  team_standings: 'graphics.type.teamStandings',
  achievement: 'graphics.type.achievement',
};

const FORMAT_KEYS: Record<GraphicFormat, MessageKey> = {
  square: 'graphics.format.square',
  portrait: 'graphics.format.portrait',
  story: 'graphics.format.story',
  landscape: 'graphics.format.landscape',
};

function GraphicCanvasPreview({ branding, format, model, pageCount, pageLabel, pageNumber }: {
  branding: GraphicBranding;
  format: GraphicFormat;
  model: ReturnType<typeof buildGraphicModel>;
  pageCount: number;
  pageLabel: string;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const paint = () => {
      const canvas = canvasRef.current;
      if (!canvas || !active) return;
      void drawGraphic(canvas, model, format, { branding, pageCount, pageLabel, pageNumber, theme: readGraphicTheme() });
    };
    paint();
    window.addEventListener('racevora:theme-changed', paint);
    return () => {
      active = false;
      window.removeEventListener('racevora:theme-changed', paint);
    };
  }, [branding, format, model, pageCount, pageLabel, pageNumber]);

  return <canvas aria-label={`${model.eyebrow}: ${model.title} · ${pageLabel}`} className={`graphic-canvas-preview graphic-canvas-preview--${format}`} ref={canvasRef} role="img"/>;
}

export function GraphicsStudioPage() {
  const { branding, client } = useLeague();
  const { role } = useRole();
  const { formatDate, t } = useI18n();
  const [workspace, setWorkspace] = useState<GraphicsWorkspace | null>(null);
  const [type, setType] = useState<GraphicType>('race_result');
  const [format, setFormat] = useState<GraphicFormat>('square');
  const [previewPage, setPreviewPage] = useState(0);
  const [state, setState] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [loadError, setLoadError] = useState(false);
  const allowed = role === 'league_admin' || role === 'platform_owner';

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoadError(false);
    void loadGraphicsWorkspace(client)
      .then((data) => { if (active) setWorkspace(data); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [allowed, client]);

  const labels: GraphicLabels = useMemo(() => ({
    raceResult: t('graphics.type.raceResult'), podium: t('graphics.type.podium'), winner: t('graphics.type.winner'),
    driverStandings: t('graphics.type.driverStandings'), teamStandings: t('graphics.type.teamStandings'), achievement: t('graphics.type.achievement'),
    points: t('graphics.points'), wins: t('graphics.wins'), round: t('graphics.round'), resultVersion: t('graphics.resultVersion'),
    official: t('graphics.official'), noData: t('graphics.noData'),
  }), [t]);
  const model = useMemo(() => workspace ? buildGraphicModel(workspace, type, labels) : null, [labels, type, workspace]);
  const graphicPages = useMemo(() => model ? paginateGraphicModel(model, type === 'race_result' ? 11 : Math.max(1, model.rows.length)) : [], [model, type]);
  const graphicBranding = useMemo<GraphicBranding>(() => ({ name: branding.name, logoUrl: branding.logoUrl || undefined }), [branding.logoUrl, branding.name]);
  const activePageIndex = Math.min(previewPage, Math.max(0, graphicPages.length - 1));
  const activePage = graphicPages[activePageIndex];

  useEffect(() => setPreviewPage(0), [format, type, workspace?.latest_result?.id]);

  async function exportGraphic() {
    if (!workspace || !model) return;
    setState('exporting');
    try {
      const theme = readGraphicTheme();
      const presentation = { branding: graphicBranding, theme };
      const [blobs, digest] = await Promise.all([
        Promise.all(graphicPages.map((page) => renderGraphicPng(page.model, format, {
          pageCount: page.pageCount,
          pageLabel: t('graphics.page', { current: page.pageNumber, total: page.pageCount }),
          pageNumber: page.pageNumber,
          theme,
          branding: graphicBranding,
        }))),
        digestGraphicSource(model, format, presentation),
      ]);
      await recordGraphicRender(client, model, format, digest, presentation);
      blobs.forEach((blob, index) => {
        const page = graphicPages[index];
        if (page) downloadPng(blob, graphicFilename(workspace, type, format, page.pageNumber, page.pageCount));
      });
      const refreshed = await loadGraphicsWorkspace(client);
      setWorkspace(refreshed);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (!allowed) return <AppState copy="Du benötigst die Rolle Ligaleitung, um Ligagrafiken zu erstellen." title={t('graphics.denied')} tone="denied" />;
  if (loadError) return <AppState action={<button className="text-action" onClick={() => window.location.reload()} type="button">Erneut versuchen</button>} copy="Rennergebnisse und Grafikvorlagen konnten nicht geladen werden." title={t('graphics.loadError')} tone="error" />;
  if (!workspace || !model || !activePage) return <AppState copy="Ergebnisse und Grafikvorlagen werden für die Vorschau vorbereitet." title={t('pending')} tone="loading" />;

  return <main className="graphics-studio" id="main-content">
    <header className="graphics-header">
      <div><p className="section-label">{t('graphics.eyebrow')}</p><h1>{t('graphics.title')}</h1></div>
      <NavLink className="text-link" to="/admin">{t('graphics.back')}</NavLink>
    </header>

    <div className="graphics-workbench">
      <section className="graphics-controls" aria-labelledby="graphics-config-title">
        <h2 id="graphics-config-title">{t('graphics.configure')}</h2>
        <fieldset><legend>{t('graphics.template')}</legend><div className="graphics-choice-list">{GRAPHIC_TYPES.map((item) => <label key={item}><input type="radio" name="graphic-type" value={item} checked={type === item} onChange={() => { setType(item); setState('idle'); }} /><span>{t(TYPE_KEYS[item])}</span></label>)}</div></fieldset>
        <fieldset><legend>{t('graphics.format')}</legend><div className="graphics-format-list">{GRAPHIC_FORMATS.map((item) => <label key={item}><input type="radio" name="graphic-format" value={item} checked={format === item} onChange={() => { setFormat(item); setState('idle'); }} /><span>{t(FORMAT_KEYS[item])}</span></label>)}</div></fieldset>
        <div className="graphics-provenance"><strong>{t('graphics.source')}</strong><span>{workspace.latest_result ? `${workspace.latest_result.race_name} · ${t('graphics.resultVersion')} ${workspace.latest_result.version} · ${t('graphics.driverCount', { count: workspace.latest_result.rows.length })}` : t('graphics.noResult')}</span><small>{t('graphics.deterministic')}</small></div>
        <button className="primary-action" type="button" disabled={state === 'exporting' || (model.resultVersionId === null && ['race_result', 'podium', 'winner'].includes(type))} onClick={() => void exportGraphic()}>{state === 'exporting' ? t('graphics.exporting') : graphicPages.length > 1 ? t('graphics.exportMany', { count: graphicPages.length }) : t('graphics.export')}</button>
        <p className={`graphics-feedback graphics-feedback--${state}`} role="status">{state === 'done' ? graphicPages.length > 1 ? t('graphics.exportedMany', { count: graphicPages.length }) : t('graphics.exported') : state === 'error' ? t('graphics.exportError') : ''}</p>
      </section>

      <section className="graphics-preview-panel" aria-labelledby="graphics-preview-title">
        <div className="graphics-preview-heading"><h2 id="graphics-preview-title">{t('graphics.preview')}</h2><span>{t(FORMAT_KEYS[format])}</span></div>
        <GraphicCanvasPreview branding={graphicBranding} format={format} model={activePage.model} pageCount={activePage.pageCount} pageLabel={t('graphics.page', { current: activePage.pageNumber, total: activePage.pageCount })} pageNumber={activePage.pageNumber}/>
        {graphicPages.length > 1 && <nav aria-label={t('graphics.previewPages')} className="graphics-page-navigation"><button aria-label={t('graphics.previousPage')} disabled={activePageIndex === 0} onClick={() => setPreviewPage((current) => Math.max(0, current - 1))} type="button">←</button><span>{t('graphics.page', { current: activePage.pageNumber, total: activePage.pageCount })}</span><button aria-label={t('graphics.nextPage')} disabled={activePageIndex === graphicPages.length - 1} onClick={() => setPreviewPage((current) => Math.min(graphicPages.length - 1, current + 1))} type="button">→</button></nav>}
      </section>
    </div>

    <section className="graphics-history" aria-labelledby="graphics-history-title"><div><h2 id="graphics-history-title">{t('graphics.history')}</h2><p>{t('graphics.historyCopy')}</p></div>{workspace.recent_renders.length ? <ol>{workspace.recent_renders.map((render) => <li key={render.id}><div><strong>{t(TYPE_KEYS[render.graphic_type])}</strong><span>{t(FORMAT_KEYS[render.graphic_format])}</span></div><span className={`render-status render-status--${render.status}`}>{t(render.status === 'outdated' ? 'graphics.outdated' : 'graphics.ready')}</span><time dateTime={render.generated_at}>{formatDate(render.generated_at)}</time></li>)}</ol> : <EmptyState copy={t('graphics.historyEmpty')} title="Noch keine Exporte" />}</section>
  </main>;
}
