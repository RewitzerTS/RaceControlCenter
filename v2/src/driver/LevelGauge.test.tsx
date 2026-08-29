import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { LevelGauge } from './LevelGauge';

describe('LevelGauge', () => {
  beforeEach(() => localStorage.setItem('racevora.locale', 'de'));

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
});
