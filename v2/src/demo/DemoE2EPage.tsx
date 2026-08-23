import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { completeCoverage, DEMO_COVERAGE_KEYS, DEMO_LEAGUE_SLUG, loadDemoSnapshot, type DemoSnapshot } from './demo';

const coverageLabels: Record<(typeof DEMO_COVERAGE_KEYS)[number], MessageKey> = {
  dns: 'demo.coverage.dns', dnf: 'demo.coverage.dnf', dsq: 'demo.coverage.dsq',
  substitute: 'demo.coverage.substitute', team_change: 'demo.coverage.teamChange',
  steward_case: 'demo.coverage.stewardCase', penalty: 'demo.coverage.penalty',
  revised_result: 'demo.coverage.revisedResult', achievements: 'demo.coverage.achievements',
  challenges: 'demo.coverage.challenges', xp: 'demo.coverage.xp',
  credits: 'demo.coverage.credits', cosmetics: 'demo.coverage.cosmetics',
};

export function DemoE2EPage() {
  const { client, leagueSlug, setLeagueSlug } = useLeague();
  const { role } = useRole();
  const { formatDate, formatNumber, t } = useI18n();
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (leagueSlug !== DEMO_LEAGUE_SLUG) {
      setLeagueSlug(DEMO_LEAGUE_SLUG);
      return;
    }
    if (role !== 'platform_owner') return;
    let active = true;
    setFailed(false);
    void loadDemoSnapshot(client)
      .then((data) => { if (active) setSnapshot(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [client, leagueSlug, role, setLeagueSlug]);

  if (role !== 'platform_owner') return <main className="driver-state" id="main-content"><span className="state-mark">22</span><div><h1>{t('demo.denied')}</h1></div></main>;
  if (failed) return <main className="driver-state" id="main-content"><span className="state-mark">!</span><div><h1>{t('demo.error')}</h1><p>{t('demo.errorCopy')}</p></div></main>;
  if (!snapshot) return <main className="driver-state" id="main-content"><span className="state-mark">22</span><div><h1>{t('pending')}</h1></div></main>;

  const covered = completeCoverage(snapshot);
  return <main className="demo-cockpit" id="main-content">
    <div className="demo-isolation" role="status"><strong>{t('demo.isolated')}</strong><span>{t('demo.isolatedCopy')}</span></div>
    <header className="demo-header">
      <div><p className="section-label">{t('demo.eyebrow')}</p><h1>{snapshot.league.name}</h1><p>{t('demo.copy')}</p></div>
      <div className="demo-actions"><NavLink to="/admin">{t('demo.admin')}</NavLink><NavLink to="/stewarding">{t('demo.steward')}</NavLink><NavLink to="/admin/graphics">{t('demo.graphics')}</NavLink></div>
    </header>

    <section className="demo-metrics" aria-label={t('overview')}>
      <div><strong>{formatNumber(snapshot.counts.registered_drivers)}</strong><span>{t('demo.drivers')}</span></div>
      <div><strong>{formatNumber(snapshot.counts.teams)}</strong><span>{t('demo.teams')}</span></div>
      <div><strong>{formatNumber(snapshot.counts.races)}</strong><span>{t('demo.races')}</span></div>
      <div><strong>{formatNumber(snapshot.counts.result_versions)}</strong><span>{t('demo.versions')}</span></div>
      <div><strong>{covered}/{DEMO_COVERAGE_KEYS.length}</strong><span>{t('demo.coverage')}</span></div>
    </section>

    <div className="demo-layout">
      <section className="demo-coverage"><div className="demo-section-heading"><h2>{t('demo.coverage')}</h2><span>{covered === DEMO_COVERAGE_KEYS.length ? t('demo.complete') : t('demo.incomplete')}</span></div><ul>{DEMO_COVERAGE_KEYS.map((key) => <li key={key} className={snapshot.coverage[key] ? 'is-covered' : ''}><i aria-hidden="true">{snapshot.coverage[key] ? '✓' : '–'}</i><span>{t(coverageLabels[key])}</span></li>)}</ul></section>
      <section className="demo-calendar"><div className="demo-section-heading"><h2>{t('demo.calendar')}</h2><span>{t('demo.officialVersions')}</span></div><ol>{snapshot.calendar.map((race) => <li key={race.id}><b>{String(race.round).padStart(2, '0')}</b><div><strong>{race.name}</strong><span>{race.circuit} · {formatDate(race.date)}</span></div><small>{race.result_version ? `V${race.result_version}` : t('demo.upcoming')}</small></li>)}</ol></section>
    </div>

    <section className="demo-drivers"><div className="demo-section-heading"><h2>{t('demo.driverProfiles')}</h2><span>{t('demo.demoProgression')}</span></div><div className="responsive-table" role="region" tabIndex={0}><table><thead><tr><th>#</th><th>{t('demo.driver')}</th><th>{t('demo.teamHistory')}</th><th>XP</th><th>{t('demo.levelRank')}</th><th>VC</th></tr></thead><tbody>{snapshot.drivers.map((driver) => <tr key={driver.gamertag}><td>{driver.number}</td><td><strong>{driver.name}</strong><small>{driver.gamertag}{driver.substitute ? ` · ${t('demo.substitute')}` : ''}</small></td><td>{driver.team_history.map((team) => team.team).join(' → ')}</td><td>{formatNumber(driver.progression.xp)}</td><td>{driver.progression.level} · {driver.progression.rank}</td><td>{formatNumber(driver.progression.credits)}</td></tr>)}</tbody></table></div></section>

    {snapshot.steward && <section className="demo-revision"><div><p className="section-label">{t('demo.stewardDecision')}</p><h2>{snapshot.steward.case_number} · {snapshot.steward.title}</h2><p>{t('demo.revisionCopy')}</p></div><dl><div><dt>{t('demo.penalty')}</dt><dd>{snapshot.steward.penalty}</dd></div><div><dt>{t('demo.currentVersion')}</dt><dd>V{snapshot.steward.result_version}</dd></div><div><dt>{t('demo.status')}</dt><dd>{snapshot.steward.status}</dd></div></dl></section>}
  </main>;
}
