import type { MessageKey } from '../i18n/messages';
import type { AppRole } from '../roles/roleMapping';

export type TutorialId = 'starter' | 'driver' | 'league' | 'steward' | 'owner';

export type TutorialStep = {
  copyKey: MessageKey;
  path: string;
  selector: string;
  titleKey: MessageKey;
};

export type TutorialTrack = {
  copyKey: MessageKey;
  id: TutorialId;
  minutes: number;
  steps: readonly TutorialStep[];
  titleKey: MessageKey;
};

export const TUTORIAL_TRACKS: Readonly<Record<TutorialId, TutorialTrack>> = {
  starter: {
    id: 'starter',
    minutes: 1,
    titleKey: 'tutorial.track.starter.title',
    copyKey: 'tutorial.track.starter.copy',
    steps: [
      { path: '/home', selector: '#main-content', titleKey: 'tutorial.starter.home.title', copyKey: 'tutorial.starter.home.copy' },
      { path: '/profile', selector: '.profile-create-league', titleKey: 'tutorial.starter.profile.title', copyKey: 'tutorial.starter.profile.copy' },
    ],
  },
  driver: {
    id: 'driver',
    minutes: 2,
    titleKey: 'tutorial.track.driver.title',
    copyKey: 'tutorial.track.driver.copy',
    steps: [
      { path: '/home', selector: '.dashboard-hero', titleKey: 'tutorial.driver.home.title', copyKey: 'tutorial.driver.home.copy' },
      { path: '/racing/calendar', selector: '.section-navigation', titleKey: 'tutorial.driver.racing.title', copyKey: 'tutorial.driver.racing.copy' },
      { path: '/career', selector: '.career-hero', titleKey: 'tutorial.driver.career.title', copyKey: 'tutorial.driver.career.copy' },
      { path: '/profile', selector: '.profile-summary', titleKey: 'tutorial.driver.profile.title', copyKey: 'tutorial.driver.profile.copy' },
    ],
  },
  league: {
    id: 'league',
    minutes: 3,
    titleKey: 'tutorial.track.league.title',
    copyKey: 'tutorial.track.league.copy',
    steps: [
      { path: '/admin', selector: '.admin-next-action', titleKey: 'tutorial.league.next.title', copyKey: 'tutorial.league.next.copy' },
      { path: '/admin', selector: '.operations-menu', titleKey: 'tutorial.league.navigation.title', copyKey: 'tutorial.league.navigation.copy' },
      { path: '/admin/users', selector: '#main-content', titleKey: 'tutorial.league.members.title', copyKey: 'tutorial.league.members.copy' },
      { path: '/admin/season/setup', selector: '.season-setup-card', titleKey: 'tutorial.league.season.title', copyKey: 'tutorial.league.season.copy' },
      { path: '/admin/results/import', selector: '.result-import-form', titleKey: 'tutorial.league.results.title', copyKey: 'tutorial.league.results.copy' },
    ],
  },
  steward: {
    id: 'steward',
    minutes: 2,
    titleKey: 'tutorial.track.steward.title',
    copyKey: 'tutorial.track.steward.copy',
    steps: [
      { path: '/stewarding', selector: '.case-metrics', titleKey: 'tutorial.steward.overview.title', copyKey: 'tutorial.steward.overview.copy' },
      { path: '/stewarding', selector: '.case-queue', titleKey: 'tutorial.steward.queue.title', copyKey: 'tutorial.steward.queue.copy' },
      { path: '/stewarding', selector: '.case-layout', titleKey: 'tutorial.steward.decision.title', copyKey: 'tutorial.steward.decision.copy' },
    ],
  },
  owner: {
    id: 'owner',
    minutes: 2,
    titleKey: 'tutorial.track.owner.title',
    copyKey: 'tutorial.track.owner.copy',
    steps: [
      { path: '/owner', selector: '.operations-metrics', titleKey: 'tutorial.owner.overview.title', copyKey: 'tutorial.owner.overview.copy' },
      { path: '/owner', selector: '.owner-leagues', titleKey: 'tutorial.owner.leagues.title', copyKey: 'tutorial.owner.leagues.copy' },
      { path: '/owner', selector: '.owner-flags', titleKey: 'tutorial.owner.flags.title', copyKey: 'tutorial.owner.flags.copy' },
      { path: '/owner', selector: '.owner-instagram-entry', titleKey: 'tutorial.owner.instagram.title', copyKey: 'tutorial.owner.instagram.copy' },
    ],
  },
};

export function availableTutorials(role: AppRole | null): readonly TutorialTrack[] {
  if (!role) return [TUTORIAL_TRACKS.starter];
  if (role === 'driver') return [TUTORIAL_TRACKS.driver];
  if (role === 'steward') return [TUTORIAL_TRACKS.driver, TUTORIAL_TRACKS.steward];
  if (role === 'league_admin') return [TUTORIAL_TRACKS.driver, TUTORIAL_TRACKS.league, TUTORIAL_TRACKS.steward];
  return [TUTORIAL_TRACKS.driver, TUTORIAL_TRACKS.league, TUTORIAL_TRACKS.steward, TUTORIAL_TRACKS.owner];
}

export function defaultTutorial(role: AppRole | null): TutorialTrack {
  if (!role) return TUTORIAL_TRACKS.starter;
  if (role === 'platform_owner') return TUTORIAL_TRACKS.owner;
  if (role === 'league_admin') return TUTORIAL_TRACKS.league;
  if (role === 'steward') return TUTORIAL_TRACKS.steward;
  return TUTORIAL_TRACKS.driver;
}

export function tutorialStorageKey(userId: string, suffix: string): string {
  return `racevora.tutorial.v1.${userId}.${suffix}`;
}
