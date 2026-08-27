import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_BADGE_CODES, AchievementBadge } from './AchievementBadge';

describe('AchievementBadge', () => {
  it('covers all 50 unique Core Achievement codes', () => {
    expect(ACHIEVEMENT_BADGE_CODES).toHaveLength(50);
    expect(new Set(ACHIEVEMENT_BADGE_CODES).size).toBe(50);
  });

  it('renders an accessible, code-specific badge', () => {
    render(<AchievementBadge code="wins_25" metric="wins" threshold={25} title="25 Rennsiege" />);
    const badge = screen.getByRole('img', { name: '25 Rennsiege: 25' });
    expect(badge).toHaveAttribute('data-achievement-code', 'wins_25');
    expect(badge).toHaveTextContent('25');
  });
});
