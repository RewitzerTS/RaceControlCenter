import { useEffect, useMemo, useState } from 'react';
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
  recordGraphicRender,
  type GraphicFormat,
  type GraphicLabels,
  type GraphicsWorkspace,
  type GraphicType,
} from './graphics';
import { downloadPng, renderGraphicPng } from './renderPng';

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
};

export function GraphicsStudioPage() {
  const { client } = useLeague();
  const { role } = useRole();
  const { formatDate, t } = useI18n();
  const [workspace, setWorkspace] = useState<GraphicsWorkspace | null>(null);
  const [type, setType] = useState<GraphicType>('race_result');
  const [format, setFormat] = useState<GraphicFormat>('square');
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

  async function exportGraphic() {
    if (!workspace || !model) return;
    setState('exporting');
    try {
      const [blob, digest] = await Promise.all([renderGraphicPng(model, format), digestGraphicSource(model, format)]);
      await recordGraphicRender(client, model, format, digest);
      downloadPng(blob, graphicFilename(workspace, type, format));
      const refreshed = await loadGraphicsWorkspace(client);
      setWorkspace(refreshed);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (!allowed) return <AppState copy="Du benötigst die Rolle Ligaleitung, um Ligagrafiken zu erstellen." title={t('graphics.denied')} tone="denied" />;
  if (loadError) return <AppState action={<button className="text-action" onClick={() => window.location.reload()} type="button">Erneut versuchen</button>} copy="Rennergebnisse und Grafikvorlagen konnten nicht geladen werden." title={t('graphics.loadError')} tone="error" />;
  if (!workspace || !model) return <AppState copy="Ergebnisse und Grafikvorlagen werden für die Vorschau vorbereitet." title={t('pending')} tone="loading" />;

  return <main className="graphics-studio" id="main-content">
    <header className="graphics-header">
      <div><p className="section-label">{t('graphics.eyebrow')}</p><h1>{t('graphics.title')}</h1><p>{t('graphics.copy')}</p></div>
      <NavLink className="text-link" to="/admin">{t('graphics.back')}</NavLink>
    </header>

    <div className="graphics-workbench">
      <section className="graphics-controls" aria-labelledby="graphics-config-title">
        <h2 id="graphics-config-title">{t('graphics.configure')}</h2>
        <fieldset><legend>{t('graphics.template')}</legend><div className="graphics-choice-list">{GRAPHIC_TYPES.map((item) => <label key={item}><input type="radio" name="graphic-type" value={item} checked={type === item} onChange={() => { setType(item); setState('idle'); }} /><span>{t(TYPE_KEYS[item])}</span></label>)}</div></fieldset>
        <fieldset><legend>{t('graphics.format')}</legend><div className="graphics-format-list">{GRAPHIC_FORMATS.map((item) => <label key={item}><input type="radio" name="graphic-format" value={item} checked={format === item} onChange={() => { setFormat(item); setState('idle'); }} /><span>{t(FORMAT_KEYS[item])}</span></label>)}</div></fieldset>
        <div className="graphics-provenance"><strong>{t('graphics.source')}</strong><span>{workspace.latest_result ? `${workspace.latest_result.race_name} · ${t('graphics.resultVersion')} ${workspace.latest_result.version}` : t('graphics.noResult')}</span><small>{t('graphics.deterministic')}</small></div>
        <button className="primary-action" type="button" disabled={state === 'exporting' || (model.resultVersionId === null && ['race_result', 'podium', 'winner'].includes(type))} onClick={() => void exportGraphic()}>{state === 'exporting' ? t('graphics.exporting') : t('graphics.export')}</button>
        <p className={`graphics-feedback graphics-feedback--${state}`} role="status">{state === 'done' ? t('graphics.exported') : state === 'error' ? t('graphics.exportError') : ''}</p>
      </section>

      <section className="graphics-preview-panel" aria-labelledby="graphics-preview-title">
        <div className="graphics-preview-heading"><h2 id="graphics-preview-title">{t('graphics.preview')}</h2><span>{t(FORMAT_KEYS[format])}</span></div>
        <article className={`graphic-preview graphic-preview--${format}`}>
          <div className="graphic-preview-brand"><strong>RACEVORA</strong><span>{model.eyebrow}</span></div>
          <div className="graphic-preview-title"><h3>{model.title}</h3><p>{model.subtitle}</p></div>
          {model.hero && <strong className="graphic-preview-hero">{model.hero}</strong>}
          {model.rows.length > 0 && <ol>{model.rows.map((row, index) => <li key={`${row.rank}-${row.primary}-${index}`}><span>{row.rank}</span><div><strong>{row.primary}</strong><small>{row.secondary}</small></div><b>{row.value}</b></li>)}</ol>}
          <footer><span>{model.footer}</span><strong>racevora.app</strong></footer>
        </article>
      </section>
    </div>

    <section className="graphics-history" aria-labelledby="graphics-history-title"><div><h2 id="graphics-history-title">{t('graphics.history')}</h2><p>{t('graphics.historyCopy')}</p></div>{workspace.recent_renders.length ? <ol>{workspace.recent_renders.map((render) => <li key={render.id}><div><strong>{t(TYPE_KEYS[render.graphic_type])}</strong><span>{t(FORMAT_KEYS[render.graphic_format])}</span></div><span className={`render-status render-status--${render.status}`}>{t(render.status === 'outdated' ? 'graphics.outdated' : 'graphics.ready')}</span><time dateTime={render.generated_at}>{formatDate(render.generated_at)}</time></li>)}</ol> : <EmptyState copy={t('graphics.historyEmpty')} title="Noch keine Exporte" />}</section>
  </main>;
}
