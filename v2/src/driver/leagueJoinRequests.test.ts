import { describe, expect, it, vi } from 'vitest';
import { joinRequestPresentation, loadMyLeagueJoinRequests } from './leagueJoinRequests';

describe('league join request status', () => {
  it('distinguishes every persisted decision', () => {
    expect(joinRequestPresentation('pending').tone).toBe('pending');
    expect(joinRequestPresentation('approved').labelKey).toBe('joinRequests.approved');
    expect(joinRequestPresentation('rejected').tone).toBe('rejected');
    expect(joinRequestPresentation('cancelled').descriptionKey).toBe('joinRequests.cancelledCopy');
  });

  it('loads only valid requests from the actor-bound RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: 'r1', league_id: 'l1', league_name: 'Nova', league_slug: 'nova', status: 'pending', requested_at: '2026-08-26T12:00:00Z', reviewed_at: null },
        { id: 'unsafe' },
      ],
      error: null,
    });
    const client = { rpc } as never;
    await expect(loadMyLeagueJoinRequests(client)).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('get_my_league_join_requests');
  });

  it('propagates RPC failures', async () => {
    const failure = new Error('unavailable');
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: failure }) } as never;
    await expect(loadMyLeagueJoinRequests(client)).rejects.toBe(failure);
  });
});
