import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { LevelGauge } from './LevelGauge';

describe('LevelGauge', () => {
  let observerCallback: IntersectionObserverCallback;
  const disconnect = vi.fn();

  beforeEach(() => {
    localStorage.setItem('racevora.locale', 'de');
    disconnect.mockClear();
    vi.stubGlobal('IntersectionObserver', class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      disconnect = disconnect;
      observe = vi.fn();
      takeRecords = vi.fn(() => []);
      unobserve = vi.fn();
      root = null;
      rootMargin = '';
      thresholds = [];
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the live driver progression as an accessible gauge', () => {
    const { container } = render(
      <I18nProvider>
        <LevelGauge
          balance={1525}
          level={5}
          lifetimeXp={4365}
          progress={68}
          rank="Challenger"
          xpIntoLevel={680}
          xpToNextLevel={320}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Level-Fortschritt' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Level 5: 68 Prozent auf dem Weg zu Level 6' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Fortschritt zum nächsten Level' })).toHaveValue(68);
    expect(screen.getByText('680 XP gesammelt')).toBeInTheDocument();
    expect(screen.getByText('1.525 VC')).toBeInTheDocument();
    expect(screen.getByText('4.365 Lifetime XP')).toBeInTheDocument();
    expect(container.querySelector('.level-gauge-core-pill')).not.toBeInTheDocument();
    expect(container.querySelector('.level-gauge-percentage')).toHaveTextContent('68%');
  });

  it('starts its motion only after the instrument enters the viewport', () => {
    const { container } = render(
      <I18nProvider>
        <LevelGauge
          balance={1525}
          level={5}
          lifetimeXp={4365}
          progress={68}
          rank="Challenger"
          xpIntoLevel={680}
          xpToNextLevel={320}
        />
      </I18nProvider>,
    );
    const instrument = container.querySelector('.level-gauge-instrument');

    expect(instrument).not.toHaveClass('level-gauge-instrument--visible');

    act(() => {
      observerCallback([
        { isIntersecting: true, target: instrument } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(instrument).toHaveClass('level-gauge-instrument--visible');
    expect(disconnect).toHaveBeenCalled();
  });
});
