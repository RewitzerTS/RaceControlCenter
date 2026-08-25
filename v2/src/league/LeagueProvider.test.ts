import { describe, expect, it } from 'vitest';
import { resolveInitialLeagueSlug } from './LeagueProvider';

describe('resolveInitialLeagueSlug', () => {
  it('prefers a valid league from the URL', () => {
    expect(resolveInitialLeagueSlug('?league=second-league', 'first-league', 'rcc')).toBe('second-league');
  });

  it('restores the persisted league when the URL has no league', () => {
    expect(resolveInitialLeagueSlug('', 'my-league', 'rcc')).toBe('my-league');
  });

  it('ignores invalid stored values', () => {
    expect(resolveInitialLeagueSlug('', '../invalid', 'rcc')).toBe('rcc');
  });
});

