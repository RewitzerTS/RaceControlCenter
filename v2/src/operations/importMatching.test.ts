import { describe, expect, it } from 'vitest';
import { canonicalImportTeam, matchImportDriver } from './importMatching';
import type { LeagueDriver } from './operations';
const driver = (id: string, display_name: string, league_team = 'Williams'): LeagueDriver => ({ id, display_name, league_team, gamertag: null } as LeagueDriver);
describe('conservative AI import matching', () => {
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
