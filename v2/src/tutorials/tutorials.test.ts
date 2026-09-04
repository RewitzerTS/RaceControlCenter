import { describe, expect, it } from 'vitest';
import { availableTutorials, defaultTutorial, tutorialStorageKey } from './tutorials';

describe('role-aware tutorials', () => {
  it('does not send accounts without league access into protected areas', () => {
    expect(availableTutorials(null).map((track) => track.id)).toEqual(['starter']);
    expect(defaultTutorial(null).id).toBe('starter');
  });

  it('adds only tutorials the current role can actually use', () => {
    expect(availableTutorials('driver').map((track) => track.id)).toEqual(['driver']);
    expect(availableTutorials('league_admin').map((track) => track.id)).toEqual(['driver', 'league', 'steward']);
    expect(availableTutorials('platform_owner').map((track) => track.id)).toEqual(['driver', 'league', 'steward', 'owner']);
  });

  it('opens the role-specific guide by default', () => {
    expect(defaultTutorial('driver').id).toBe('driver');
    expect(defaultTutorial('steward').id).toBe('steward');
    expect(defaultTutorial('league_admin').id).toBe('league');
    expect(defaultTutorial('platform_owner').id).toBe('owner');
  });

  it('scopes completion to tutorial version and account', () => {
    expect(tutorialStorageKey('user-1', 'driver')).toBe('racevora.tutorial.v1.user-1.driver');
  });
});
