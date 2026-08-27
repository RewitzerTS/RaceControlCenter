import { describe, expect, it } from 'vitest';
import { leagueSwitcherDestination } from './LeagueSwitcher';

describe('leagueSwitcherDestination', () => {
  it('adds an explicit league context on every page', () => {
    expect(leagueSwitcherDestination('/career', '', '', 'second-league'))
      .toBe('/career?league=second-league');
  });

  it('preserves page filters and replaces an existing league context', () => {
    expect(leagueSwitcherDestination(
      '/racing/standings',
      '?view=drivers&league=first-league',
      '#table',
      'second-league',
    )).toBe('/racing/standings?view=drivers&league=second-league#table');
  });
});
