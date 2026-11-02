import type { DriverAdminWorkspace, LeagueDriver, LeagueRace } from './operations';

export function raceImportDrivers(workspace: DriverAdminWorkspace | null, race: LeagueRace | undefined): LeagueDriver[] {
  const drivers = workspace?.drivers ?? [];
  if (!race || race.season_id !== workspace?.active_season?.id || !Array.isArray(workspace.ai_assignments)) return drivers;
  const assigned = new Set(workspace.ai_assignments.filter(item => item.effective_from_round <= race.round_number
    && (item.effective_to_round === null || item.effective_to_round >= race.round_number)).map(item => item.human_driver_id));
  return drivers.map(driver => ({ ...driver, import_race_assigned: assigned.has(driver.id) }));
}

export function normalizedName(value: string | null | undefined): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function oneEditApart(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) === 1;
}

export function matchImportDriver(rawName: string, drivers: LeagueDriver[]) {
  const raw = normalizedName(rawName);
  if (!raw) return null;
  const names = (driver: LeagueDriver) => [driver.gamertag, driver.display_name, driver.public_name, ...(driver.gamertag_aliases ?? [])];
  const destinations = (matches: LeagueDriver[]) => [...new Map(matches.map(driver => {
    const target = drivers.find(item => item.id === driver.import_driver_id) ?? driver;
    return [target.id, target] as const;
  })).values()];
  const exact = destinations(drivers.filter(driver => names(driver).some(name => normalizedName(name) === raw)));
  if (exact.length === 1) return { driver: exact[0], source: normalizedName(exact[0].display_name) === raw ? 'driverName' as const : 'gamertag' as const };
  if (exact.length > 1) {
    // Only a confirmed account's exact gamertag/alias and explicit race seat can
    // disambiguate an unused, unlinked profile. Never prefer a shared real name,
    // a fuzzy OCR match or one of two established drivers.
    const confirmed = exact.filter(driver => driver.identity_linked && driver.import_race_assigned === true
      && [driver.gamertag, ...(driver.gamertag_aliases ?? [])].some(tag => normalizedName(tag) === raw));
    if (confirmed.length === 1 && exact.every(driver => driver.id === confirmed[0].id
      || (!driver.identity_linked && driver.import_race_assigned === false && driver.result_count === 0))) {
      return { driver: confirmed[0], source: 'gamertag' as const };
    }
  }
  if (exact.length > 1 || raw.length < 4) return null;
  const candidates = destinations(drivers.filter((driver) => names(driver).some((name) => {
    const value = normalizedName(name);
    return value.length >= 4 && (value.includes(raw) || raw.includes(value) || oneEditApart(raw, value));
  })));
  return candidates.length === 1 ? { driver: candidates[0], source: 'similar' as const } : null;
}

export function canonicalImportTeam(raw: string, drivers: LeagueDriver[]): string {
  const key = (value: string) => normalizedName(value).replace(/^oracle(?=redbull)/, '').replace(/^redbullracing$/, 'redbull');
  const matches = [...new Set(drivers.map((driver) => driver.league_team?.trim()).filter((team): team is string => Boolean(team) && key(team!) === key(raw)))];
  return matches.length === 1 ? matches[0] : raw.trim();
}
