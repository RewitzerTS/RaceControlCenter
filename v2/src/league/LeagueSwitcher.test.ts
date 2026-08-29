import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeagueSwitcher, leagueSwitcherDestination } from './LeagueSwitcher';

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  navigate: vi.fn(),
  setLeagueSlug: vi.fn(),
}));

vi.mock('../i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'leagueSwitcher.active': 'Aktive Liga',
      'leagueSwitcher.change': 'Liga wechseln',
      'leagueSwitcher.current': 'Aktiv',
      'leagueSwitcher.error': 'Fehler',
    })[key] ?? key,
  }),
}));

vi.mock('./LeagueProvider', () => ({
  useLeague: () => ({
    branding: { name: 'League One' },
    client: mocks.client,
    leagueSlug: 'league-one',
    setLeagueSlug: mocks.setLeagueSlug,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ hash: '#main', pathname: '/home', search: '?tab=career&league=league-one' }),
}));

function accessibleLeaguesClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'league_members') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { league_id: 'league-1', role: 'driver' },
                { league_id: 'league-2', role: 'driver' },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'league-1', name: 'League One', slug: 'league-one' },
                  { id: 'league-2', name: 'League Two', slug: 'league-two' },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
    }),
  };
}

beforeEach(() => {
  mocks.client = accessibleLeaguesClient();
  mocks.navigate.mockReset();
  mocks.setLeagueSlug.mockReset();
});

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

describe('LeagueSwitcher', () => {
  it('uses a controlled mobile-safe menu and switches the selected league', async () => {
    const onSwitch = vi.fn();
    render(createElement(LeagueSwitcher, { isPlatformOwner: false, navigateToLeague: mocks.navigate, onSwitch, userId: 'user-1' }));

    const trigger = await screen.findByRole('button', { name: 'Liga wechseln: League One' });
    expect(document.querySelector('details')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: /League Two.*league-two/ }));

    await waitFor(() => expect(mocks.setLeagueSlug).toHaveBeenCalledWith('league-two'));
    expect(mocks.navigate).toHaveBeenCalledWith('/home?tab=career&league=league-two#main');
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
