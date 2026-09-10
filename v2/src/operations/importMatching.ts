import type { LeagueDriver } from './operations';

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
  const exact = drivers.filter((driver) => [driver.gamertag, driver.display_name].some((name) => normalizedName(name) === raw));
  if (exact.length === 1) return { driver: exact[0], source: normalizedName(exact[0].gamertag) === raw ? 'gamertag' as const : 'driverName' as const };
  if (exact.length > 1 || raw.length < 4) return null;
  const candidates = drivers.filter((driver) => [driver.gamertag, driver.display_name].some((name) => {
    const value = normalizedName(name);
    return value.length >= 4 && (value.includes(raw) || raw.includes(value) || oneEditApart(raw, value));
  }));
  return candidates.length === 1 ? { driver: candidates[0], source: 'similar' as const } : null;
}

export function canonicalImportTeam(raw: string, drivers: LeagueDriver[]): string {
  const key = (value: string) => normalizedName(value).replace(/^oracle(?=redbull)/, '').replace(/^redbullracing$/, 'redbull');
  const matches = [...new Set(drivers.map((driver) => driver.league_team?.trim()).filter((team): team is string => Boolean(team) && key(team!) === key(raw)))];
  return matches.length === 1 ? matches[0] : raw.trim();
}
