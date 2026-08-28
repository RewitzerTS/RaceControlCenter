import { describe, expect, it, vi } from 'vitest';
import { activeStewardRaces, createStewardCase, finalizeStewardDecision, stewardDetailCounts } from './stewardWorkspace';

describe('steward workspace commands', () => {
  it('derives every visible detail counter from the freshly loaded detail', () => {
    expect(stewardDetailCounts(null)).toBeNull();
    expect(stewardDetailCounts({
      appeals: [{ id: 'appeal-1' }] as never,
      decisions: [{ id: 'decision-1' }] as never,
      evidence: [{ id: 'evidence-1' }, { id: 'evidence-2' }] as never,
      penalties: [{ id: 'penalty-1' }] as never,
      votes: [{ id: 'vote-1' }, { id: 'vote-2' }, { id: 'vote-3' }] as never,
    })).toEqual({ appeals: 1, decisions: 1, evidence: 2, penalties: 1, votes: 3 });
  });

  it('derives tenant context server-side when a case is created', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'case-1' }, error: null });
    await createStewardCase({ rpc } as never, {
      raceId: 'race-1', reportedDriverId: null, accusedDriverId: 'driver-1',
      title: 'Unsafe return', description: 'The driver returned unsafely to the circuit.',
      ruleCode: 'SC-4.1', ruleVersion: '2026.1',
    });
    expect(rpc).toHaveBeenCalledWith('create_steward_case', expect.not.objectContaining({ p_league_id: expect.anything() }));
  });

  it('offers only races from the active season for new cases', () => {
    expect(activeStewardRaces({
      cases: [],
      drivers: [],
      races: [
        { id: 'active', season_id: 'season-2', grand_prix_name: 'Active GP', round_number: 1, race_date: null, current_result_version_id: 'version-2', is_active_season: true },
        { id: 'archived', season_id: 'season-1', grand_prix_name: 'Archived GP', round_number: 1, race_date: null, current_result_version_id: 'version-1', is_active_season: false },
      ],
    }).map((race) => race.id)).toEqual(['active']);
  });

  it('sends structured penalties to the atomic finalization RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'decision-1' }, error: null });
    await finalizeStewardDecision({ rpc } as never, {
      caseId: 'case-1', outcome: 'penalty', reasoning: 'Evidence and votes support the decision.',
      ruleCode: 'SC-4.1', ruleVersion: '2026.1',
      penalties: [{ driver_id: 'driver-1', penalty_type: 'time_penalty', time_delta_ms: 5000, reason: 'Unsafe return' }],
    });
    expect(rpc).toHaveBeenCalledWith('finalize_steward_decision', expect.objectContaining({
      p_case_id: 'case-1', p_penalties: [expect.objectContaining({ penalty_type: 'time_penalty' })],
    }));
  });
});
