import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { useLeague } from '../league/LeagueProvider';
import { useDriverIdentity } from './DriverIdentityProvider';
import { levelProgress, selectDriverHero, useDriverHome } from './driverHome';

function DriverState({
  action,
  copy,
  title,
}: {
  action?: ReactNode;
  copy: string;
  title: string;
}) {
  return (
    <main className="driver-state" id="main-content">
      <span className="state-mark" aria-hidden="true">RV</span>
      <div>
        <h1>{title}</h1>
        <p>{copy}</p>
        {action}
      </div>
    </main>
  );
}

export function DriverHomePage() {
  const { loading: authLoading, user } = useAuth();
  const { error: identityError, identity, loading: identityLoading } = useDriverIdentity();
  const { client, leagueSlug } = useLeague();
  const { formatDate, formatNumber, formatTime, plural, t } = useI18n();
  const { error, loading, reload, snapshot } = useDriverHome(client, identity?.id ?? null);

  if (authLoading || identityLoading) {
    return <DriverState title={t('home.loadingTitle')} copy={t('home.loadingCopy')} />;
  }
  if (!user) {
    return <DriverState title={t('home.signedOutTitle')} copy={t('home.signedOutCopy')} />;
  }
  if (identityError || !identity || identity.status !== 'active') {
    return <DriverState title={t('home.identityTitle')} copy={t('home.identityCopy')} />;
  }
  if (loading) {
    return <DriverState title={t('home.loadingTitle')} copy={t('home.loadingCopy')} />;
  }
  if (error) {
    return (
      <DriverState
        title={t('home.errorTitle')}
        copy={t('home.errorCopy')}
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
  const hero = heroKind === 'result'
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

  return (
    <main className="driver-home" id="main-content">
      <header className="page-intro">
        <div>
          <p className="section-label">{t('home.racingNow')}</p>
          <h1>{t('home.greeting', { name: displayName })}</h1>
          <p>{t('home.context', { league: leagueSlug })}</p>
        </div>
        <div className="phase-badge">{t('phaseLabel')} 15</div>
      </header>

      <section className="driver-hero" aria-labelledby="driver-hero-title">
        <div className="hero-copy">
          <p className="hero-kicker">{hero.kicker}</p>
          <h2 id="driver-hero-title">{hero.title}</h2>
          <p>{hero.copy}</p>
          <NavLink className="primary-action" to={hero.to}>{hero.action}<span aria-hidden="true">→</span></NavLink>
        </div>
        <div className="hero-signal" aria-label={t('home.nextRace')}>
          <span>{t('home.nextRace')}</span>
          <strong>{snapshot.nextRace?.grand_prix_name ?? t('home.noRaceScheduled')}</strong>
          <small>
            {snapshot.nextRace?.race_date
              ? formatDate(snapshot.nextRace.race_date)
              : t('home.dateTbd')}
            {raceStart ? ' · ' + formatTime(raceStart) : ''}
          </small>
        </div>
      </section>

      <section className="career-numbers" aria-labelledby="career-numbers-title">
        <h2 className="visually-hidden" id="career-numbers-title">{t('home.careerStats')}</h2>
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
      </section>

      <div className="home-columns">
        <div className="home-primary">
          <section className="progression-panel" aria-labelledby="progression-title">
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
            <div
              className="level-meter"
              role="progressbar"
              aria-label={t('home.xpProgress')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <span style={{ width: String(progress) + '%' }} />
            </div>
            <div className="progress-meta">
              <span>{formatNumber(progression?.lifetime_xp ?? 0)} {t('home.lifetimeXp')}</span>
              <span>
                {progression?.level === 100
                  ? t('immortal')
                  : t('home.xpRemaining', { xp: formatNumber(progression?.xp_to_next_level ?? 1000) })}
              </span>
            </div>
          </section>

          <section className="challenge-panel" aria-labelledby="challenges-title">
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
                      <div>
                        <strong>{t(metricKey)}</strong>
                        <span>{t('home.challengeReward', { reward: formatNumber(challenge.rewardVc) })}</span>
                      </div>
                      <div className="challenge-progress">
                        <span>{formatNumber(challenge.progress)} / {formatNumber(challenge.target)}</span>
                        <i aria-hidden="true"><b style={{ width: String(challengeProgress) + '%' }} /></i>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="home-secondary">
          <section className="achievement-summary" aria-labelledby="achievements-title">
            <p className="section-label">{t('home.careerMoment')}</p>
            <h2 id="achievements-title">{t('home.achievements')}</h2>
            <strong>{formatNumber(snapshot.achievementCount)}</strong>
            <p>{plural('home.achievementCount', snapshot.achievementCount)}</p>
            <NavLink className="text-link" to="/career">{t('home.openCareer')}<span aria-hidden="true">→</span></NavLink>
          </section>
          <section className="vora-preview" aria-labelledby="vora-title">
            <span className="vora-mark" aria-hidden="true">V</span>
            <div>
              <p className="section-label">{t('home.voraInsight')}</p>
              <h2 id="vora-title">{t('home.voraTitle')}</h2>
              <p>{t('home.voraPending')}</p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
