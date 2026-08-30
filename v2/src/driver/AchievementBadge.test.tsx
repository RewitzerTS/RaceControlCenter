import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_BADGE_CODES, AchievementBadge } from './AchievementBadge';

describe('AchievementBadge', () => {
  it('covers all 50 Core and 11 Racecraft Achievement codes', () => {
    expect(ACHIEVEMENT_BADGE_CODES).toHaveLength(61);
    expect(new Set(ACHIEVEMENT_BADGE_CODES).size).toBe(61);
    expect(ACHIEVEMENT_BADGE_CODES).toEqual(expect.arrayContaining([
      'podiums_after_dnf_1',
      'wins_after_dnf_1',
      'wins_after_two_dnfs_1',
      'perfect_weekends_1',
      'wins_from_grid_10_1',
      'podiums_from_grid_15_1',
      'win_streak_3',
      'classified_streak_5',
      'pole_streak_3',
      'fastest_lap_streak_3',
      'first_race_wins_1',
    ]));
  });

  it('renders an accessible, code-specific badge', () => {
    render(<AchievementBadge code="wins_25" metric="wins" threshold={25} title="25 Rennsiege" />);
    const badge = screen.getByRole('img', { name: '25 Rennsiege: 25' });
    expect(badge).toHaveAttribute('data-achievement-code', 'wins_25');
    expect(badge).toHaveTextContent('25');
  });
});
