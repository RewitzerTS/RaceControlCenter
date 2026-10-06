import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { activeStewardRaces, createStewardCase, finalizeStewardDecision, loadStewardWorkspace, stewardDetailCounts, nextStewardRace, recordStewardDecision, type StewardRace } from './stewardWorkspace';

const race: StewardRace = { id: 'race-1', season_id: 'season-2', grand_prix_name: 'Japan GP', round_number: 1, race_date: '2026-10-05', race_time: '20:00', race_start_at: '2026-10-05T18:00:00Z', status: 'upcoming', current_result_version_id: null, is_active_season: true };

describe('steward workspace commands', () => {
  it('targets the immediate next scheduled race, including the second race that evening', () => {
    const next = { ...race,id:'next',round_number:2,race_start_at:'2026-10-05T19:00:00Z' };
    expect(nextStewardRace([race,next],race.id,Date.parse('2026-10-05T18:45Z'))?.id).toBe('next');
    expect(nextStewardRace([race,next,{...next,id:'later',round_number:3,race_start_at:'2026-10-12T18:00Z'}],race.id,Date.parse('2026-10-06T18:00Z'))).toBeNull();
    expect(nextStewardRace([race,{...next,status:'cancelled'}],race.id,0)).toBeNull();
    expect(nextStewardRace([race,{...next,current_result_version_id:'v1'}],race.id,0)).toBeNull();
  });
  it('sends one decision with a stable retry key and no fabricated steward vote', async () => {
    const rpc = vi.fn().mockResolvedValue({data:{id:'decision'},error:null});
    const input = {raceId:'race',reporterId:'reporter',accusedId:'accused',title:'Incident',reasoning:'Reviewed externally',penaltyType:'time_credit' as const,amount:5,targetRaceId:null,caseId:null};
    await recordStewardDecision({rpc} as never,input,'stable-test-key');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('record_steward_decision',expect.objectContaining({p_idempotency_key:'stable-test-key',p_reported_driver_id:'reporter',p_penalty_type:'time_credit',p_amount:5}));
  });
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
        { ...race, id: 'active', current_result_version_id: 'version-2' },
        { ...race, id: 'archived', season_id: 'season-1', current_result_version_id: 'version-1', is_active_season: false },
      ],
    }).map((race) => race.id)).toEqual(['active']);
  });

  it('offers both elapsed rounds before result publication, but not future or cancelled races', () => {
    const races = [
      { ...race, id: 'round-2', round_number: 2, race_start_at: '2026-10-05T19:00:00Z' },
      race,
      { ...race, id: 'future', race_start_at: '2026-10-12T18:00:00Z' },
      { ...race, id: 'cancelled', status: 'cancelled' },
      { ...race, id: 'postponed', status: 'postponed' },
      { ...race, id: 'undated', race_date: null, race_start_at: null },
      { ...race, id: 'invalid', race_start_at: 'invalid' },
      { ...race, id: 'archive', is_active_season: false },
    ];
    expect(activeStewardRaces({ cases: [], drivers: [], races }, Date.parse('2026-10-05T20:00:00Z')).map((item) => item.id)).toEqual(['race-1', 'round-2']);
    expect(activeStewardRaces({ cases: [], drivers: [], races: [race] }, Date.parse('2026-10-05T17:59:59Z'))).toEqual([]);
  });

  it('keeps completed, published and legacy-calendar races available', () => {
    const races = [
      { ...race, id: 'completed', status: 'completed', race_date: null, race_start_at: null },
      { ...race, id: 'published', current_result_version_id: 'v1', race_date: null, race_start_at: null },
      { ...race, id: 'legacy', race_start_at: null },
    ];
    expect(activeStewardRaces({ cases: [], drivers: [], races }, new Date('2026-10-06T12:00').getTime()).map((item) => item.id)).toEqual(['completed', 'published', 'legacy']);
  });

  it('loads the active season without a publication filter and retains old case race labels', async () => {
    const urls: URL[] = [];
    const client = createClient<Database>('https://steward-test.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url);
      const table = url.pathname.split('/').pop();
      const data = table === 'seasons' ? { id: 'season-2' }
        : table === 'steward_cases' ? [{ id: 'old-case', race_id: 'old-race' }]
        : table === 'races' ? url.searchParams.has('season_id') ? [race] : [{ ...race, id: 'old-race', season_id: 'season-1' }]
        : [];
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    const snapshot = await loadStewardWorkspace(client);
    const queries = urls.filter((url) => url.pathname.endsWith('/races'));
    expect(queries[0].searchParams.get('season_id')).toBe('eq.season-2');
    expect(queries[0].searchParams.has('current_result_version_id')).toBe(false);
    expect(queries[0].searchParams.get('offset')).toBe('0');
    expect(queries[1].searchParams.get('id')).toBe('in.(old-race)');
    expect(snapshot.races.map((item) => [item.id, item.is_active_season])).toEqual([['race-1', true], ['old-race', false]]);
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

  it('paginates season races and propagates failures instead of returning a partial selection', async () => {
    let fail = false;
    const offsets: string[] = [];
    const client = createClient<Database>('https://steward-pages.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => {
      const url = new URL(String(input)), table = url.pathname.split('/').pop();
      let data: unknown = table === 'seasons' ? { id: 'season-2' } : [];
      if (table === 'races') {
        const offset = url.searchParams.get('offset') || '0'; offsets.push(offset);
        if (offset === '500' && fail) return new Response(JSON.stringify({ message: 'Temporary read failure' }), { status: 403 });
        data = offset === '0' ? Array.from({ length: 500 }, (_, i) => ({ ...race, id: `race-${i}`, round_number: i + 1 })) : [{ ...race, id: 'last', round_number: 501 }];
      }
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    expect((await loadStewardWorkspace(client)).races).toHaveLength(501);
    expect(offsets).toEqual(['0', '500']);
    fail = true;
    await expect(loadStewardWorkspace(client)).rejects.toThrow('Temporary read failure');
  });

  it('does not offer archive races when there is no active season', async () => {
    const urls: URL[] = [];
    const client = createClient<Database>('https://steward-empty.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url);
      return new Response(JSON.stringify(url.pathname.endsWith('/seasons') ? null : []), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    expect((await loadStewardWorkspace(client)).races).toEqual([]);
    expect(urls.some((url) => url.pathname.endsWith('/races'))).toBe(false);
  });
});
