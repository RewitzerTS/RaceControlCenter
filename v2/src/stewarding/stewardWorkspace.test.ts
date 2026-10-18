import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { activeStewardRaces, createStewardCase, deleteStewardCase, finalizeStewardDecision, loadStewardWorkspace, stewardDetailCounts, nextStewardRace, recordStewardDecision, saveStewardGroupCase, stewardParticipantIds, type StewardRace } from './stewardWorkspace';

const race: StewardRace = { id: 'race-1', season_id: 'season-2', grand_prix_name: 'Japan GP', round_number: 1, race_date: '2026-10-05', race_time: '20:00', race_start_at: '2026-10-05T18:00:00Z', status: 'upcoming', current_result_version_id: null, is_active_season: true };

describe('steward workspace commands', () => {
  it('reads grouped participants and falls back to untouched historical cases', () => {
    const item = { reported_driver_id: 'legacy-reporter', accused_driver_id: 'legacy-accused' };
    expect(stewardParticipantIds(item, 'reporter')).toEqual(['legacy-reporter']);
    expect(stewardParticipantIds({ ...item, reported_driver_id: null }, 'reporter')).toEqual([]);
    expect(stewardParticipantIds({ ...item, steward_case_participants: [
      { driver_id: 'a', role: 'reporter' }, { driver_id: 'b', role: 'reporter' }, { driver_id: 'a', role: 'accused' },
    ] }, 'reporter')).toEqual(['a', 'b']);
  });
  it('saves all participants and exactly one outcome per accused in one guarded request', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'case' }, error: null });
    const input = { raceId: 'race', reporterIds: ['a', 'b'], accusedIds: ['b', 'c'], title: 'Incident', description: 'A multi-driver incident', caseId: null,
      decisions: [{ driver_id: 'b', penalty_type: 'time_credit', amount: 5, target_race_id: null, reasoning: 'Credit reviewed externally.' },
        { driver_id: 'c', penalty_type: 'no_action', amount: null, target_race_id: null, reasoning: 'No further action required.' }] };
    await saveStewardGroupCase({ rpc } as never, input, 'stable-group-key', false);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('save_steward_group_case', { p_race_id: 'race', p_reporter_ids: ['a', 'b'], p_accused_ids: ['b', 'c'],
      p_title: 'Incident', p_description: 'A multi-driver incident', p_case_id: null, p_decisions: input.decisions, p_draft: false, p_idempotency_key: 'stable-group-key' });
    await saveStewardGroupCase({ rpc } as never, input, 'draft-group-key', true);
    expect(rpc).toHaveBeenLastCalledWith('save_steward_group_case', expect.objectContaining({ p_draft: true, p_decisions: [], p_reporter_ids: ['a', 'b'] }));
    rpc.mockResolvedValue({ data: null, error: { message: 'Rejected group' } });
    await expect(saveStewardGroupCase({ rpc } as never, input, 'retry', false)).rejects.toThrow('Rejected group');
  });
  it('deletes through a guarded RPC with the displayed case and result versions', async () => {
    const rpc = vi.fn().mockResolvedValue({data:{id:'case',deleted:true},error:null});
    await deleteStewardCase({rpc} as never,'case','Incorrect time credit',1,'result');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('delete_steward_case',{p_case_id:'case',p_reason:'Incorrect time credit',p_expected_decision_version:1,p_expected_result_version_id:'result'});
    rpc.mockResolvedValue({data:null,error:{message:'Case or result changed. Reload before deleting.'}});
    await expect(deleteStewardCase({rpc} as never,'case','Incorrect time credit',1,'old')).rejects.toThrow('Reload');
  });
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

  it('restricts races and cases to the active season before pagination, without requiring publication', async () => {
    const urls: URL[] = [];
    const client = createClient<Database>('https://steward-test.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url);
      const table = url.pathname.split('/').pop();
      const data = table === 'seasons' ? { id: 'season-2' }
        : table === 'steward_cases' ? url.searchParams.get('race_id') === 'eq.old-race' ? [] : [{ id: 'active-case', race_id: race.id }]
        : table === 'races' ? [race]
        : [];
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    const snapshot = await loadStewardWorkspace(client);
    const queries = urls.filter((url) => url.pathname.endsWith('/races'));
    expect(queries[0].searchParams.get('season_id')).toBe('eq.season-2');
    expect(queries[0].searchParams.has('current_result_version_id')).toBe(false);
    expect(queries[0].searchParams.get('offset')).toBe('0');
    expect(queries).toHaveLength(1);
    expect(snapshot.races.map((item) => [item.id, item.is_active_season])).toEqual([['race-1', true]]);
    const caseQuery = urls.find((url) => url.pathname.endsWith('/steward_cases'))!;
    expect(caseQuery.searchParams.get('select')).toContain('races!inner(season_id)');
    expect(caseQuery.searchParams.get('races.season_id')).toBe('eq.season-2');
    expect(caseQuery.searchParams.get('limit')).toBe('26');
    expect((await loadStewardWorkspace(client, 'old-race')).cases).toEqual([]);
    const oldRaceQuery = urls.filter((url) => url.pathname.endsWith('/steward_cases')).at(-1)!;
    expect(oldRaceQuery.searchParams.get('race_id')).toBe('eq.old-race');
    expect(oldRaceQuery.searchParams.get('races.season_id')).toBe('eq.season-2');
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

  it('returns an empty queue without reading archived races or cases when no season is active', async () => {
    const urls: URL[] = [];
    const client = createClient<Database>('https://steward-empty.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url);
      return new Response(JSON.stringify(url.pathname.endsWith('/seasons') ? null : []), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } } });
    expect(await loadStewardWorkspace(client, 'old-race')).toEqual({ cases: [], races: [], drivers: [], hasMoreCases: false });
    expect(urls.map(url => url.pathname.split('/').pop())).toEqual(['seasons']);
  });

  it('filters cases before pagination and keeps a lookahead row out of the displayed page', async () => {
    const urls: URL[] = [];
    const client = createClient<Database>('https://steward-filter.supabase.co', 'test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url);
      const data = url.pathname.endsWith('/seasons') ? { id: 'season-2' } : url.pathname.endsWith('/steward_cases') ? Array.from({ length: 26 }, (_, i) => ({ id: `case-${i}`, race_id: race.id })) : [];
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    } } });
    const result = await loadStewardWorkspace(client, race.id, 2);
    const query = urls.find((url) => url.pathname.endsWith('/steward_cases'))!;
    expect(query.searchParams.get('race_id')).toBe('eq.race-1');
    expect(query.searchParams.get('races.season_id')).toBe('eq.season-2');
    expect(query.searchParams.get('offset')).toBe('50');
    expect(query.searchParams.get('limit')).toBe('26');
    expect(query.searchParams.get('order')).toBe('created_at.desc,id.asc');
    expect(result.cases).toHaveLength(25);
    expect(result.hasMoreCases).toBe(true);
    await expect(loadStewardWorkspace(client, '', -1)).rejects.toThrow('Invalid case page');
  });
});
