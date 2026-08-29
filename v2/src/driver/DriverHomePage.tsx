import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AppState } from '../components/AppState';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { useDriverIdentity } from './DriverIdentityProvider';
import { levelProgress, selectDriverHero, useDriverHome } from './driverHome';

function formatAchievementCode(code: string | null): string {
  if (!code) return '';
  return code
    .replace(/[-_]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

export function DriverHomePage() {
  const { loading: authLoading, user } = useAuth();
  const { error: identityError, identity, loading: identityLoading } = useDriverIdentity();
  const { client, leagueSlug } = useLeague();
  const { role } = useRole();
  const { formatDate, formatNumber, formatTime, plural, t } = useI18n();
  const { error, loading, reload, snapshot } = useDriverHome(client, identity?.id ?? null);

  if (authLoading || identityLoading) {
    return <AppState title={t('home.loadingTitle')} copy={t('home.loadingCopy')} tone="loading" />;
  }
  if (!user) {
    return (
      <AppState
        title={t('home.signedOutTitle')}
        copy={t('home.signedOutCopy')}
        action={<NavLink className="primary-action" to="/login?mode=signin">{t('beta.action')}</NavLink>}
      />
    );
  }
  if (identityError || !identity || identity.status !== 'active') {
    return <AppState title={t('home.identityTitle')} copy={t('home.identityCopy')} tone="info" />;
  }
  if (identity.linkedDriverCount === 0) {
    return (
      <AppState
        title={t('profile.createLeague')}
        copy={t('profile.createLeagueCopy')}
        tone="empty"
        action={<NavLink className="primary-action" to="/leagues/new">{t('profile.createLeague')}</NavLink>}
      />
    );
  }
  if (loading) {
    return <AppState title={t('home.loadingTitle')} copy={t('home.loadingCopy')} tone="loading" />;
  }
  if (error) {
    return (
      <AppState
        title={t('home.errorTitle')}
        copy={t('home.errorCopy')}
        tone="error"
        action={<button className="text-action" type="button" onClick={reload}>{t('home.retry')}</button>}
      />
    );
  }

  const displayName = (
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : user.email?.split('@')[0]
  ) || t('home.defaultDriver');
  const heroKind = selectDriverHero(snapshot);
  const progression = snapshot.progression;
  const career = snapshot.career;
  const progress = levelProgress(progression);
  const hero = heroKind === 'season-complete'
    ? {
        action: t('home.hero.seasonCompleteAction'),
        copy: t('home.hero.seasonCompleteCopy', {
          date: snapshot.latestArchivedSeason?.archivedAt
            ? formatDate(snapshot.latestArchivedSeason.archivedAt, { dateStyle: 'long' })
            : t('home.dateTbd'),
        }),
        kicker: t('home.hero.seasonCompleteKicker'),
        title: t('home.hero.seasonCompleteTitle', {
          season: snapshot.latestArchivedSeason?.name ?? t('home.season'),
        }),
        to: '/racing/history?view=seasons',
      }
    : heroKind === 'result'
    ? {
        action: t('home.hero.resultAction'),
        copy: t('home.hero.resultCopy', {
          date: career?.last_race_date ? formatDate(career.last_race_date) : t('home.dateTbd'),
        }),
        kicker: t('home.hero.resultKicker'),
        title: t('home.hero.resultTitle'),
        to: '/racing',
      }
    : heroKind === 'next-race'
      ? {
          action: t('home.hero.raceAction'),
          copy: t('home.hero.raceCopy', {
            date: snapshot.nextRace?.race_date
              ? formatDate(snapshot.nextRace.race_date, { dateStyle: 'long' })
              : t('home.dateTbd'),
          }),
          kicker: t('home.hero.raceKicker'),
          title: snapshot.nextRace?.grand_prix_name ?? t('home.hero.raceTitle'),
          to: '/racing',
        }
      : {
          action: t('home.hero.careerAction'),
          copy: t('home.hero.careerCopy'),
          kicker: t('home.hero.careerKicker'),
          title: t('home.hero.careerTitle'),
          to: '/career',
        };
  const raceStart = snapshot.nextRace?.race_start_at;
  const seasonCompleted = heroKind === 'season-complete';
  const canManageSeason = role === 'league_admin' || role === 'platform_owner';

  return (
    <main className="driver-home dashboard-shell" id="main-content">
      <section className="storyline-strip storyline-strip--ticker" aria-label={t('home.racingNow')}>
        <strong className="storyline-label">{t('home.racingNow')}</strong>
        <span className="storyline-viewport">
          <span className="storyline-track">
            <span className="storyline-message">
              <span>{t('home.context', { league: leagueSlug })}</span>
              <i aria-hidden="true">•</i>
              <span>{hero.copy}</span>
            </span>
            <span aria-hidden="true" className="storyline-message">
              <span>{t('home.context', { league: leagueSlug })}</span>
              <i aria-hidden="true">•</i>
              <span>{hero.copy}</span>
            </span>
          </span>
        </span>
      </section>

      <section className="dashboard-hero v2-driver-dashboard" aria-labelledby="driver-hero-title">
        <article className="hero-main">
          <div className="hero-topline">
            <p className="hero-kicker">{hero.kicker}</p>
          </div>
          <h1 id="driver-hero-title">{t('home.greeting', { name: displayName })}</h1>
          <p className="hero-subcopy">{hero.title} {hero.copy}</p>
          <div className="next-race-showcase">
            <span className="section-label">{seasonCompleted ? t('home.seasonStatus') : t('home.nextRace')}</span>
            <strong>{seasonCompleted ? t('home.noActiveSeason') : snapshot.nextRace?.grand_prix_name ?? t('home.noRaceScheduled')}</strong>
            <small>{seasonCompleted
              ? t('home.seasonArchived', { season: snapshot.latestArchivedSeason?.name ?? t('home.season') })
              : <>{snapshot.nextRace?.race_date ? formatDate(snapshot.nextRace.race_date) : t('home.dateTbd')}{raceStart ? ' · ' + formatTime(raceStart) : ''}</>}</small>
          </div>
          <div className="driver-hero-actions">
            <NavLink className="btn-primary-glow primary-action" to={hero.to}>{hero.action}</NavLink>
            <NavLink className="btn-secondary-ghost text-link" to={seasonCompleted && canManageSeason ? '/admin/season/setup' : '/racing'}>
              {seasonCompleted && canManageSeason ? t('home.setupNextSeason') : t('home.openLeague')}
            </NavLink>
          </div>
        </article>

        <aside className="hero-side" aria-labelledby="career-numbers-title">
          <div className="section-heading">
            <h2 id="career-numbers-title">{t('home.careerStats')}</h2>
          </div>
          <div className="career-number-grid">
            {[
              ['home.starts', formatNumber(career?.starts ?? 0)],
              ['home.wins', formatNumber(career?.wins ?? 0)],
              ['home.podiums', formatNumber(career?.podiums ?? 0)],
              ['home.poles', formatNumber(career?.poles ?? 0)],
              ['home.fastestLaps', formatNumber(career?.fastest_laps ?? 0)],
              [
                'home.averageFinish',
                career?.average_finish == null
                  ? '—'
                  : formatNumber(career.average_finish, { maximumFractionDigits: 1 }),
              ],
            ].map(([key, value]) => (
              <div className="career-number" key={key}>
                <span>{t(key as MessageKey)}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="v2-dashboard-grid">
        <article className="dashboard-card v2-progress-card" aria-labelledby="progression-title">
          <div className="section-heading">
            <div>
              <p className="section-label">{t('home.progression')}</p>
              <h2 id="progression-title">{t('home.levelRank', {
                level: progression?.level ?? 1,
                rank: progression?.rank ?? t('home.unranked'),
              })}</h2>
            </div>
            <strong className="vc-balance">{formatNumber(snapshot.wallet?.balance ?? 0)} VC</strong>
          </div>
          <div className="level-meter" role="progressbar" aria-label={t('home.xpProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <span style={{ width: String(progress) + '%' }} />
          </div>
          <div className="progress-meta">
            <span>{formatNumber(progression?.lifetime_xp ?? 0)} {t('home.lifetimeXp')}</span>
            <span>{progression?.level === 100 ? t('immortal') : t('home.xpRemaining', { xp: formatNumber(progression?.xp_to_next_level ?? 1000) })}</span>
          </div>
        </article>

        <article className="dashboard-card achievement-summary" aria-labelledby="achievements-title">
          <p className="section-label">{t('home.careerMoment')}</p>
          <h2 id="achievements-title">{t('home.achievements')}</h2>
          <strong>{formatNumber(snapshot.achievementCount)}</strong>
          <p>{plural('home.achievementCount', snapshot.achievementCount)}</p>
          <p className="achievement-latest"><span>{t('home.latestAchievement')}</span><strong>{snapshot.latestAchievement ? formatAchievementCode(snapshot.latestAchievement) : t('home.noLatestAchievement')}</strong></p>
          <NavLink className="btn-secondary-ghost text-link" to="/career">{t('home.openCareer')}</NavLink>
        </article>

        <article className="dashboard-card challenge-panel" aria-labelledby="challenges-title">
          <div className="section-heading">
            <div>
              <p className="section-label">{t('home.activeNow')}</p>
              <h2 id="challenges-title">{t('home.challenges')}</h2>
            </div>
            <span>{snapshot.challenges.length}/3</span>
          </div>
          {snapshot.challenges.length === 0 ? (
            <p className="empty-copy">{t('home.noChallenges')}</p>
          ) : (
            <ol className="challenge-list">
              {snapshot.challenges.map((challenge) => {
                const challengeProgress = Math.min(100, (challenge.progress / challenge.target) * 100);
                const metricKey = ('metric.' + challenge.metric) as MessageKey;
                return (
                  <li key={challenge.code}>
                    <div><strong>{t(metricKey)}</strong><span>{t('home.challengeReward', { reward: formatNumber(challenge.rewardVc) })}</span><small>{challenge.activeUntil ? t('home.challengeUntil', { date: formatDate(challenge.activeUntil) }) : t('home.challengeOngoing')}</small></div>
                    <div className="challenge-progress"><span>{formatNumber(challenge.progress)} / {formatNumber(challenge.target)}</span><i aria-hidden="true"><b style={{ width: String(challengeProgress) + '%' }} /></i></div>
                  </li>
                );
              })}
            </ol>
          )}
        </article>

        <article className="dashboard-card vora-preview" aria-labelledby="vora-title">
          <span className="vora-mark" aria-hidden="true">V</span>
          <div>
            <p className="section-label">{t('home.voraInsight')}</p>
            <h2 id="vora-title">{t('home.voraTitle')}</h2>
            <p>{t('home.voraPending')}</p>
            <NavLink className="btn-secondary-ghost text-link" to="/vora">Vora</NavLink>
          </div>
        </article>
      </section>
    </main>
  );
}
