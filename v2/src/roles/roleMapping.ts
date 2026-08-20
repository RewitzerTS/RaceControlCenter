export type AppRole = 'driver' | 'steward' | 'league_admin' | 'platform_owner';

export function mapLegacyLeagueRole(role: string | null | undefined): AppRole | null {
  switch (role?.trim().toLowerCase()) {
    case 'member':
    case 'driver':
      return 'driver';
    case 'steward':
      return 'steward';
    case 'admin':
    case 'owner':
    case 'league_admin':
      return 'league_admin';
    default:
      return null;
  }
}
