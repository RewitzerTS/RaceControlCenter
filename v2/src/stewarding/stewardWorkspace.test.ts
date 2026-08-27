import { describe, expect, it, vi } from 'vitest';
import { createStewardCase, finalizeStewardDecision, stewardDetailCounts } from './stewardWorkspace';

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
