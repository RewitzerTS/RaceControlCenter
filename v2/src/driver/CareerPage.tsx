import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { LegacyLeagueView } from '../components/LegacyLeagueView';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useDriverIdentity } from './DriverIdentityProvider';
import { levelProgress, useDriverHome } from './driverHome';

export function CareerPage() {
  const location = useLocation();
  const { loading: authLoading, user } = useAuth();
  const { identity, loading: identityLoading } = useDriverIdentity();
  const { client, leagueSlug } = useLeague();
  const { formatNumber, plural, t } = useI18n();
  const { error, loading, reload, snapshot } = useDriverHome(client, identity?.id ?? null);

  if (authLoading || identityLoading || loading) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">C</span><div><h1>{t('home.loadingTitle')}</h1><p>{t('home.loadingCopy')}</p></div></main>;
  }
  if (!user) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">C</span><div><h1>{t('home.signedOutTitle')}</h1><p>{t('home.signedOutCopy')}</p><NavLink className="primary-action" to="/login?mode=signin">{t('beta.action')}</NavLink></div></main>;
  }
  if (!identity || identity.status !== 'active' || identity.linkedDriverCount === 0) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">C</span><div><h1>{t('career.linkTitle')}</h1><p>{t('career.linkCopy')}</p><NavLink className="text-link" to="/profile">{t('route.profileTitle')}</NavLink></div></main>;
  }
  if (error) {
    return <main className="driver-state" id="main-content"><span className="state-mark" aria-hidden="true">!</span><div><h1>{t('home.errorTitle')}</h1><p>{t('home.errorCopy')}</p><button className="text-action" type="button" onClick={reload}>{t('home.retry')}</button></div></main>;
  }

  const careerSearch = new URLSearchParams(location.search);
  if (location.pathname === '/career/profile' && identity.driverId && !careerSearch.has('driver')) careerSearch.set('driver', identity.driverId);
  const careerSection = location.pathname === '/career/profile'
    ? { page: 'fahrer-profil', title: t('career.driverProfile') }
    : location.pathname === '/career/compare'
      ? { page: 'head-to-head', title: t('career.compare') }
      : null;

  if (careerSection) {
    return (
      <main className="career-page dashboard-shell integrated-section-page" id="main-content">
        <nav aria-label={t('career.navigation')} className="section-navigation">
          <NavLink end to="/career">{t('career.overview')}</NavLink>
          <NavLink to="/career/profile">{t('career.driverProfile')}</NavLink>
          <NavLink to="/career/compare">{t('career.compare')}</NavLink>
        </nav>
        <header className="integrated-section-heading"><div><h1>{careerSection.title}</h1><p>{t('career.sectionCopy')}</p></div></header>
        <LegacyLeagueView page={careerSection.page} search={`?${careerSearch.toString()}`} title={careerSection.title} />
      </main>
    );
  }

  const career = snapshot.career;
  const progression = snapshot.progression;
  const progress = levelProgress(progression);
  const stats: Array<[MessageKey, string]> = [
    ['home.starts', formatNumber(career?.starts ?? 0)],
    ['home.wins', formatNumber(career?.wins ?? 0)],
    ['home.podiums', formatNumber(career?.podiums ?? 0)],
    ['home.poles', formatNumber(career?.poles ?? 0)],
    ['home.fastestLaps', formatNumber(career?.fastest_laps ?? 0)],
    ['home.averageFinish', career?.average_finish == null ? '—' : formatNumber(career.average_finish, { maximumFractionDigits: 1 })],
  ];

  return (
    <main className="career-page dashboard-shell" id="main-content">
      <nav aria-label={t('career.navigation')} className="section-navigation">
        <NavLink end to="/career">{t('career.overview')}</NavLink>
        <NavLink to="/career/profile">{t('career.driverProfile')}</NavLink>
        <NavLink to="/career/compare">{t('career.compare')}</NavLink>
      </nav>
      <section className="storyline-strip"><strong>{t('route.careerTitle')}</strong><span>{t('home.context', { league: leagueSlug })}</span><i aria-hidden="true">•</i><span>{t('career.crossLeague')}</span></section>
      <section className="career-layout">
        <article className="hero-main career-hero">
          <p className="hero-kicker">{t('home.progression')}</p>
          <h1>{t('home.levelRank', { level: progression?.level ?? 1, rank: progression?.rank ?? t('home.unranked') })}</h1>
          <p className="hero-subcopy">{t('route.careerCopy')}</p>
          <div className="level-meter" role="progressbar" aria-label={t('home.xpProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
          <div className="progress-meta"><span>{formatNumber(progression?.lifetime_xp ?? 0)} {t('home.lifetimeXp')}</span><span>{formatNumber(snapshot.wallet?.balance ?? 0)} VC</span></div>
        </article>
        <article className="hero-side" aria-labelledby="career-stats-title">
          <div className="section-heading"><h2 id="career-stats-title">{t('home.careerStats')}</h2><span>{t('career.officialOnly')}</span></div>
          <div className="career-number-grid">{stats.map(([key, value]) => <div className="career-number" key={key}><span>{t(key)}</span><strong>{value}</strong></div>)}</div>
        </article>
      </section>
      <section className="v2-dashboard-grid career-detail-grid">
        <article className="dashboard-card achievement-summary"><p className="section-label">{t('home.careerMoment')}</p><h2>{t('home.achievements')}</h2><strong>{formatNumber(snapshot.achievementCount)}</strong><p>{plural('home.achievementCount', snapshot.achievementCount)}</p></article>
        <article className="dashboard-card challenge-panel"><div className="section-heading"><div><p className="section-label">{t('home.activeNow')}</p><h2>{t('home.challenges')}</h2></div><span>{snapshot.challenges.length}/3</span></div>{snapshot.challenges.length === 0 ? <p className="empty-copy">{t('home.noChallenges')}</p> : <ol className="challenge-list">{snapshot.challenges.map((challenge) => <li key={challenge.code}><div><strong>{t((`metric.${challenge.metric}`) as MessageKey)}</strong><span>{t('home.challengeReward', { reward: formatNumber(challenge.rewardVc) })}</span></div><div className="challenge-progress"><span>{formatNumber(challenge.progress)} / {formatNumber(challenge.target)}</span><i aria-hidden="true"><b style={{ width: `${Math.min(100, challenge.progress / challenge.target * 100)}%` }} /></i></div></li>)}</ol>}</article>
      </section>
    </main>
  );
}
