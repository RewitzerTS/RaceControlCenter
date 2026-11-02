import { describe, expect, it } from 'vitest';
import { championshipPointOwner } from './championshipInheritance';

describe('AI championship inheritance', () => {
  const assignments = [
    { ai_driver_id: 'gasly', human_driver_id: 'robin', effective_from_round: 9, effective_to_round: 10 },
    { ai_driver_id: 'gasly', human_driver_id: 'later-player', effective_from_round: 13, effective_to_round: null },
    { ai_driver_id: 'albon', human_driver_id: 'robin', effective_from_round: 11, effective_to_round: null },
  ];
  it('keeps earlier inherited points with the first driver after a seat change', () => {
    expect(championshipPointOwner('gasly', 1, assignments)).toBe('robin');
    expect(championshipPointOwner('gasly', 10, assignments)).toBe('robin');
    expect(championshipPointOwner('gasly', 11, assignments)).toBe('later-player');
    expect(championshipPointOwner('albon', 1, assignments)).toBe('robin');
    expect(championshipPointOwner('robin', 9, assignments)).toBe('robin');
  });
  it('leaves returned AI points alone before another takeover becomes effective', () => {
    expect(championshipPointOwner('gasly', 11, assignments.slice(0, 1))).toBe('gasly');
    expect(championshipPointOwner('gasly', 1, [])).toBe('gasly');
    expect(championshipPointOwner('other', 1, assignments)).toBe('other');
  });
  it('refuses conflicting owners instead of selecting arbitrarily', () => {
    expect(() => championshipPointOwner('gasly', 1, [...assignments, { ...assignments[0], human_driver_id: 'conflict' }])).toThrow('Ambiguous');
  });
});
