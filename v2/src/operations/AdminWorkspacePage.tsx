import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState } from '../components/AppState';
import { useI18n } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { useAuth } from '../auth/AuthProvider';
import { LeagueSwitcher } from '../league/LeagueSwitcher';
import { loadAdminSnapshot, type AdminSnapshot } from './operations';
import { deriveOverview, loadOverview, raceIsDue, type OverviewData } from './adminOverview';
import { adminOverviewCopy } from './adminOverviewCopy';

export async function copyLeagueIdToClipboard(clipboard: Pick<Clipboard, 'writeText'> | undefined, leagueId: string): Promise<boolean> {
  if (!clipboard) return false;
  try { await clipboard.writeText(leagueId); return true; } catch { return false; }
}

export function AdminWorkspacePage() {
  const { user } = useAuth();
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const { language, formatDate, formatNumber, t } = useI18n();
  const c = adminOverviewCopy[language];
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const allowed = role === 'league_admin' || role === 'platform_owner';
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setError(false); setSnapshot(null); setData(null); setCopyState('idle');
    void Promise.all([loadAdminSnapshot(client), loadOverview(client)]).then(([nextSnapshot, nextData]) => {
      if (active) { setSnapshot(nextSnapshot); setData(nextData); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [allowed, client, retry]);

  if (!allowed) return <AppState copy={t('admin.deniedCopy')} title={t('admin.deniedTitle')} tone="denied" />;
  if (error) return <AppState action={<><button className="text-action" onClick={() => setRetry(n => n + 1)} type="button">{c.retry}</button>{user && <LeagueSwitcher userId={user.id} isPlatformOwner={role === 'platform_owner'} />}<NavLink className="text-action" to="/profile">{t('nav.profile')}</NavLink></>} copy={t('admin.contextError')} title={t('admin.error')} tone="error" />;
  if (!snapshot || !data) return <AppState copy={t('home.loadingCopy')} title={t('pending')} tone="loading" />;
  const view = deriveOverview(data);
  const now = new Date();
  const seasonStarted = view.races.some(r => r.status === 'completed' || r.result_status === 'active');
  return <main className="operations-page admin-overview" id="main-content">
    <header className="admin-overview-heading">
      <div><h1>{c.title}</h1><p>{snapshot.league.name}</p>
        {view.scopeKnown && <p>{view.season ? `${view.season.name} · ${seasonStarted ? c.running : c.preparing}` : c.noSeason}</p>}
        {role === 'platform_owner' && <small className="admin-owner-note">{c.owner}</small>}
      </div>
      {snapshot.league.join_code && <div className="admin-invite"><span>{c.code}</span><div><code>{snapshot.league.join_code}</code><button className="text-action" type="button" onClick={() => void copyLeagueIdToClipboard(navigator.clipboard, snapshot.league.join_code!).then(ok => setCopyState(ok ? 'copied' : 'failed'))}>{copyState === 'copied' ? t('admin.leagueIdCopied') : t('admin.copyLeagueId')}</button></div>
        {copyState !== 'idle' && <span className="visually-hidden" role="status">{copyState === 'failed' ? t('admin.leagueIdCopyFailed') : t('admin.leagueIdCopied')}</span>}
        <details><summary>{c.invite}</summary><p>{c.inviteHint}</p></details>
      </div>}
    </header>
    <section className="admin-overview-section" aria-labelledby="admin-tasks-title">
      <h2 id="admin-tasks-title">{c.tasks}</h2>
      {view.incomplete && <div className="admin-overview-warning" role="status"><p>{c.unknown}</p><button className="text-action" type="button" onClick={() => setRetry(n => n + 1)}>{c.retry}</button></div>}
      {view.scopeKnown && (!view.season || view.emptyCalendar) && <NavLink className="primary-action" to="/admin/season/setup">{view.season ? c.emptyCalendar : c.setup}</NavLink>}
      {view.tasks.length > 0 ? <ul className="admin-task-list">{view.tasks.map(task => <li key={task.key}><NavLink to={task.to}><strong>{formatNumber(task.count)}</strong><span>{c[task.key]}</span><span className="admin-task-arrow" aria-hidden="true">→</span></NavLink></li>)}</ul> : !view.incomplete && view.season && !view.emptyCalendar ? <p>{c.nothing}</p> : null}
    </section>
    {view.season && view.scopeKnown && <section className="admin-overview-section" aria-labelledby="admin-race-day-title">
      <div className="admin-section-heading"><h2 id="admin-race-day-title">{view.isBacklog ? c.reviewDay : c.nextDay}</h2><NavLink className="text-action" to="/admin/races">{c.calendar}</NavLink></div>
      {view.raceDay.length ? <ul className="admin-race-list">{view.raceDay.map(race => {
        const draft = view.drafts.find(d => d.race_id === race.id);
        const official = race.result_status === 'active';
        const due = raceIsDue(race, now);
        const to = draft ? `/admin/results/import?race=${encodeURIComponent(race.id)}#result-draft-heading` : official ? `/racing/races/detail?league=${encodeURIComponent(leagueSlug)}&season=${encodeURIComponent(race.season_id)}&round=${race.round_number}` : due ? `/admin/results/import?race=${encodeURIComponent(race.id)}` : '/admin/races';
        return <li key={race.id}><div><time dateTime={race.race_start_at ?? race.race_date ?? undefined}>{race.race_start_at ? formatDate(race.race_start_at, { dateStyle: 'medium', timeStyle: 'short' }) : race.race_date ? formatDate(race.race_date) : c.dateMissing}</time><strong>{race.round_number}. {race.grand_prix_name}</strong><small>{official ? c.finished : draft ? c.drafts : due ? c.outstanding : c.planned}</small></div><NavLink className="text-action" to={to}>{draft ? c.review : official ? c.result : due ? c.import : c.calendar}</NavLink></li>;
      })}</ul> : !view.incomplete ? <p>{c.noDay}</p> : null}
    </section>}
    {view.ready && <aside className="admin-season-ready"><strong>{c.ready}</strong><p>{c.readyHint}</p><NavLink className="text-action" to="/admin/races">{c.completion}</NavLink></aside>}
    <details className="admin-recent-changes"><summary>{c.changes}</summary>
      {snapshot.recent_audit.length ? <ol className="admin-change-list">{snapshot.recent_audit.slice(0, 5).map(item => <li key={item.id}><span>{item.action}</span><time dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time></li>)}</ol> : <p>{t('admin.noAudit')}</p>}
      <NavLink className="text-action" to="/admin/audit">{c.allChanges}</NavLink>
    </details>
  </main>;
}
