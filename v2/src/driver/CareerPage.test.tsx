import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CareerPage } from './CareerPage';

const { client, useDriverHomeMock } = vi.hoisted(() => ({
  client: {},
  useDriverHomeMock: vi.fn(() => ({
    error: null,
    loading: true,
    reload: vi.fn(),
    snapshot: {},
  })),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ loading: false, user: { id: 'user-1' } }),
}));

vi.mock('../components/LegacyLeagueView', () => ({
  LegacyLeagueView: ({ page }: { page: string }) => <div data-testid="legacy-view">{page}</div>,
}));

vi.mock('../i18n/I18nProvider', () => ({
  useI18n: () => ({
    formatDate: String,
    formatNumber: String,
    t: (key: string) => key,
  }),
}));

vi.mock('../league/LeagueProvider', () => ({
  useLeague: () => ({ client, leagueSlug: 'test-league' }),
}));

vi.mock('./DriverIdentityProvider', () => ({
  useDriverIdentity: () => ({
    identity: {
      driverId: 'driver-1',
      id: 'identity-1',
      linkedDriverCount: 1,
      profileNumber: 27,
      status: 'active',
    },
    loading: false,
  }),
}));

vi.mock('./driverHome', () => ({
  levelProgress: vi.fn(() => 0),
  nextChallengeRotation: vi.fn(() => null),
  useDriverHome: useDriverHomeMock,
}));

describe('CareerPage detail routes', () => {
  afterEach(() => {
    cleanup();
    useDriverHomeMock.mockClear();
  });

  it('renders the driver profile without waiting for dashboard data', () => {
    render(<MemoryRouter initialEntries={['/career/profile']}><CareerPage /></MemoryRouter>);

    expect(screen.getByTestId('legacy-view')).toHaveTextContent('fahrer-profil');
    expect(screen.queryByText('home.loadingTitle')).not.toBeInTheDocument();
    expect(useDriverHomeMock).toHaveBeenCalledWith(client, null);
  });

  it('renders head-to-head without waiting for dashboard data', () => {
    render(<MemoryRouter initialEntries={['/career/compare']}><CareerPage /></MemoryRouter>);

    expect(screen.getByTestId('legacy-view')).toHaveTextContent('head-to-head');
    expect(screen.queryByText('home.loadingTitle')).not.toBeInTheDocument();
    expect(useDriverHomeMock).toHaveBeenCalledWith(client, null);
  });
});
