import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState } from '../components/AppState';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import {
  loadAdminSnapshot,
  loadRaceAdminWorkspace,
  loadSeasonSetupWorkspace,
  type AdminSnapshot,
  type RaceAdminWorkspace,
  type SeasonSetupWorkspace,
} from './operations';

const ADMIN_AREAS: Array<{ title: MessageKey; items: Array<{ key: MessageKey; to: string }> }> = [
  { title: 'admin.league', items: [{ key: 'admin.branding', to: '/admin/branding' }, { key: 'admin.users', to: '/admin/users' }, { key: 'admin.drivers', to: '/admin/drivers' }, { key: 'admin.teams', to: '/admin/teams' }, { key: 'admin.rules', to: '/admin/rules' }, { key: 'profile.createLeague', to: '/leagues/new' }] },
  { title: 'admin.raceOps', items: [{ key: 'admin.seasonSetup', to: '/admin/season/setup' }, { key: 'admin.races', to: '/admin/races' }, { key: 'admin.results', to: '/admin/results' }, { key: 'admin.import', to: '/admin/results/import' }, { key: 'admin.standings', to: '/admin/standings' }, { key: 'admin.cases', to: '/stewarding' }] },
  { title: 'admin.content', items: [{ key: 'admin.graphics', to: '/admin/graphics' }, { key: 'admin.audit', to: '/admin/audit' }] },
];

type AdminNextAction = {
  actionKey: MessageKey;
  copyKey: MessageKey;
  titleKey: MessageKey;
  to: string;
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selectAdminNextAction(snapshot: AdminSnapshot, setup: SeasonSetupWorkspace | null, raceWorkspace: RaceAdminWorkspace | null, now = new Date()): AdminNextAction {
  const activeSeason = setup?.active_season ?? raceWorkspace?.seasons.find((season) => season.is_active) ?? null;
  if (!activeSeason) return { actionKey: 'admin.seasonSetup', copyKey: 'admin.nextSeasonCopy', titleKey: 'admin.nextSeasonTitle', to: '/admin/season/setup' };

  const activeRaces = raceWorkspace?.races.filter((race) => race.season_id === activeSeason.id) ?? [];
  if ('calendar' in activeSeason && activeSeason.calendar.length === 0 && activeRaces.length === 0) return { actionKey: 'admin.seasonSetup', copyKey: 'admin.nextCalendarEmptyCopy', titleKey: 'admin.nextCalendarEmptyTitle', to: '/admin/season/setup' };
  if ((snapshot.counts.open_steward_cases ?? 0) > 0) return { actionKey: 'admin.cases', copyKey: 'admin.nextStewardCopy', titleKey: 'admin.nextStewardTitle', to: '/stewarding' };

  const today = localDateKey(now);
  const hasRaceToProcess = activeRaces.some((race) => race.race_date && race.race_date <= today && race.result_status !== 'active' && !['cancelled', 'canceled'].includes(race.status));
  if (hasRaceToProcess) return { actionKey: 'admin.quickImport', copyKey: 'admin.nextImportCopy', titleKey: 'admin.nextImportTitle', to: '/admin/results/import' };
  if (activeRaces.length > 0 && activeRaces.every((race) => race.result_status === 'active' || ['cancelled', 'canceled'].includes(race.status))) return { actionKey: 'admin.races', copyKey: 'admin.nextCompleteCopy', titleKey: 'admin.nextCompleteTitle', to: '/admin/races' };
  return { actionKey: 'admin.races', copyKey: 'admin.nextCalendarCopy', titleKey: 'admin.nextCalendarTitle', to: '/admin/races' };
}

export function AdminWorkspacePage() {
  const { client } = useLeague();
  const { role } = useRole();
  const { formatDate, formatNumber, t } = useI18n();
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [seasonSetup, setSeasonSetup] = useState<SeasonSetupWorkspace | null>(null);
  const [raceWorkspace, setRaceWorkspace] = useState<RaceAdminWorkspace | null>(null);
  const [error, setError] = useState(false);
  const [openAreas, setOpenAreas] = useState<Set<MessageKey>>(() => new Set());
  const allowed = role === 'league_admin' || role === 'platform_owner';

  const loadWorkspace = useCallback(async () => {
    setError(false);
    setSnapshot(null);
    const [data, setup, races] = await Promise.all([
      loadAdminSnapshot(client),
      loadSeasonSetupWorkspace(client).catch(() => null),
      loadRaceAdminWorkspace(client).catch(() => null),
    ]);
    setSnapshot(data);
    setSeasonSetup(setup);
    setRaceWorkspace(races);
  }, [client]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void Promise.all([
      loadAdminSnapshot(client),
      loadSeasonSetupWorkspace(client).catch(() => null),
      loadRaceAdminWorkspace(client).catch(() => null),
    ]).then(([data, setup, races]) => {
      if (!active) return;
      setSnapshot(data);
      setSeasonSetup(setup);
      setRaceWorkspace(races);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [allowed, client]);

  if (!allowed) return <AppState copy={t('admin.deniedCopy')} title={t('admin.deniedTitle')} tone="denied" />;
  if (error) return <AppState action={<button className="text-action" onClick={() => void loadWorkspace().catch(() => setError(true))} type="button">{t('home.retry')}</button>} copy={t('home.errorCopy')} title={t('admin.error')} tone="error" />;
  if (!snapshot) return <AppState copy={t('home.loadingCopy')} title={t('pending')} tone="loading" />;

  const nextAction = selectAdminNextAction(snapshot, seasonSetup, raceWorkspace);

  return <main className="operations-page" id="main-content">
    {role === 'platform_owner' && <div className="owner-mode" role="status">{t('owner.mode')}</div>}
    <section className="admin-next-action" aria-labelledby="admin-next-action-title">
      <div><p className="section-label">{t('admin.nextStep')}</p><h1 id="admin-next-action-title">{t(nextAction.titleKey)}</h1><p>{t(nextAction.copyKey, { count: formatNumber(snapshot.counts.open_steward_cases ?? 0) })}</p></div>
      <NavLink className="primary-action" to={nextAction.to}>{t(nextAction.actionKey)}</NavLink>
    </section>
    <div className="operations-layout">
      <nav className="operations-menu" aria-labelledby="admin-navigation-title">
        <div className="operations-menu-heading">
          <h2 id="admin-navigation-title">{t('admin.navigation')}</h2>
        </div>
        <div className="operations-menu-groups">
          {ADMIN_AREAS.map((area) => <details key={area.title} open={openAreas.has(area.title)}><summary onClick={(event) => { event.preventDefault(); setOpenAreas((current) => { const next = new Set(current); if (next.has(area.title)) next.delete(area.title); else next.add(area.title); return next; }); }}>{t(area.title)}</summary><div>{area.items.map((item) => <NavLink key={item.key} to={item.to}>{t(item.key)}</NavLink>)}</div></details>)}
        </div>
      </nav>
      <details className="operations-feed operations-audit">
        <summary>
          <span>{t('admin.recentAudit')}</span>
          <span className="operations-audit-state"><span>{t('admin.auditShow')}</span><span>{t('admin.auditHide')}</span></span>
        </summary>
        <div className="operations-audit-content">{snapshot.recent_audit.length ? <ol>{snapshot.recent_audit.map((item) => <li key={item.id}><div><strong>{item.action}</strong><span>{item.entity_type}</span></div><time dateTime={item.occurred_at}>{formatDate(item.occurred_at)}</time></li>)}</ol> : <p className="empty-copy">{t('admin.noAudit')}</p>}</div>
      </details>
    </div>
  </main>;
}
