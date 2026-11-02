import { describe, expect, it } from 'vitest';
import { canonicalImportTeam, matchImportDriver, raceImportDrivers } from './importMatching';
import type { DriverAdminWorkspace, LeagueDriver, LeagueRace } from './operations';
const driver = (id: string, display_name: string, league_team = 'Williams'): LeagueDriver => ({ id, display_name, league_team, gamertag: null } as LeagueDriver);
describe('conservative AI import matching', () => {
  it('uses both Robin aliases despite an unused duplicate, but only in his assigned races', () => {
    const robin = { ...driver('robin', 'alpine_wolf'), gamertag: 'alpine_wolf', public_name: 'MuirecoX', gamertag_aliases: ['MuirecoX', 'alpine_wolf'], identity_linked: true, result_count: 0 };
    const old = { ...driver('old', 'Robin S'), gamertag: 'MuirecoX', identity_linked: false, result_count: 0, is_active: false };
    const workspace = { drivers: [robin, old], active_season: { id: 's' }, ai_assignments: [
      { human_driver_id: 'robin', ai_driver_id: 'gasly', effective_from_round: 9, effective_to_round: null },
    ] } as DriverAdminWorkspace;
    const current = raceImportDrivers(workspace, { season_id: 's', round_number: 9 } as LeagueRace);
    for (const tag of ['alpine_wolf', 'Alpine-Wolf', 'Muirecox', 'MUIRECOX']) expect(matchImportDriver(tag, current)?.driver.id).toBe('robin');
    expect(matchImportDriver('MuirecoX', raceImportDrivers(workspace, { season_id: 's', round_number: 8 } as LeagueRace))).toBeNull();
    expect(matchImportDriver('MuirecoX', raceImportDrivers(workspace, { season_id: 'other', round_number: 9 } as LeagueRace))).toBeNull();
    expect(matchImportDriver('MuirecoX', [current[0], { ...current[1], identity_linked: true }])).toBeNull();
    expect(matchImportDriver('MuirecoX', [current[0], { ...current[1], result_count: 1 }])).toBeNull();
    expect(matchImportDriver('MuirecoX', [current[0], { ...current[1], import_race_assigned: true }])).toBeNull();
    expect(matchImportDriver('Muireco2', current)).toBeNull();
    expect(robin).not.toHaveProperty('import_race_assigned');
  });
  it('keeps two Jakobs separate and never guesses from their shared public or historical name', () => {
    const a = { ...driver('a', 'Jakob'), public_name: 'Jakob', gamertag: 'JakobNbdg', gamertag_aliases: ['Jacock'] };
    const b = { ...driver('b', 'Jakob'), public_name: 'Jakob', gamertag: 'SecondJakob', gamertag_aliases: ['OtherPSN'] };
    expect(matchImportDriver('Jakob', [a, b])).toBeNull();
    expect(matchImportDriver('JakobNbdg', [a, b])?.driver.id).toBe('a');
    expect(matchImportDriver('OtherPSN', [a, b])?.driver.id).toBe('b');
    expect(matchImportDriver('Jakob', [{ ...a, display_name: 'Old A' }, { ...b, display_name: 'Old B' }])).toBeNull();
    expect(matchImportDriver('Jakob', [{ ...a, display_name: 'Old A' }])?.driver.id).toBe('a');
  });
  it('recognizes platform aliases, deduplicates one driver and refuses collisions', () => {
    const a = { ...driver('a','Aaron'), gamertag: 'Darkqz', gamertag_aliases: ['D4RK','Fabiylolboi','FABIYLOLBOI'] };
    for (const name of ['Darkqz','D4RK','Fabiylolboi']) expect(matchImportDriver(name,[a])?.driver.id).toBe('a');
    const b = { ...driver('b','Other'), gamertag:'D4RK' };
    expect(matchImportDriver('D4RK',[a,b])).toBeNull();
    expect(matchImportDriver('D4RK',[a,{...b,import_driver_id:'a'}])?.driver.id).toBe('a');
    expect(matchImportDriver('_-',[a])).toBeNull();
  });
  it('recognizes Sain2 without changing the original input or roster', () => {
    const roster = [driver('sainz', 'Carlos Sainz')];
    expect(matchImportDriver('Carlos Sain2', roster)).toMatchObject({ driver: { id: 'sainz' }, source: 'similar' });
    expect(roster[0].display_name).toBe('Carlos Sainz');
  });
  it('does not guess between two similar drivers or duplicate exact names', () => {
    expect(matchImportDriver('Carlos Sain2', [driver('a', 'Carlos Sainz'), driver('b', 'Carlos Sain3')])).toBeNull();
    expect(matchImportDriver('Carlos Sainz', [driver('a', 'Carlos Sainz'), driver('b', 'Carlos Sainz')])).toBeNull();
    expect(matchImportDriver('Ca', [driver('a', 'Carlos Sainz')])).toBeNull();
  });
  it('prioritizes exact matches and accepts accented case variants', () => {
    expect(matchImportDriver('CARLOS SÁINZ', [driver('a', 'Carlos Sainz'), driver('b', 'Carlos Sain3')])?.driver.id).toBe('a');
  });
  it('resolves Red Bull aliases only against the actual league roster', () => {
    expect(canonicalImportTeam('Red Bull', [driver('a', 'Max', 'Red Bull Racing')])).toBe('Red Bull Racing');
    expect(canonicalImportTeam('Oracle Red Bull Racing', [driver('a', 'Max', 'Red Bull')])).toBe('Red Bull');
    expect(canonicalImportTeam('Red Bull Racing', [])).toBe('Red Bull Racing');
  });
});
