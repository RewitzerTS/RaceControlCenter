import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { ChallengeRotationCountdown } from './ChallengeRotationCountdown';
import type { DriverChallenge } from './driverHome';

const challenge: DriverChallenge = {
  activeFrom: '2026-08-20T12:00:00Z',
  activeUntil: '2026-08-25T18:00:00Z',
  code: 'clean_finish',
  metric: 'classified_finishes',
  progress: 1,
  rewardVc: 100,
  status: 'active',
  target: 3,
};

describe('ChallengeRotationCountdown', () => {
  beforeEach(() => {
    localStorage.setItem('racevora.locale', 'de');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('shows and updates the remaining Challenge rotation time', () => {
    render(<I18nProvider><ChallengeRotationCountdown challenges={[challenge]} /></I18nProvider>);

    expect(screen.getByText('2 T · 6 Std · 0 Min')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30 * 60_000);
    });

    expect(screen.getByText('2 T · 5 Std · 30 Min')).toBeInTheDocument();
  });
});
