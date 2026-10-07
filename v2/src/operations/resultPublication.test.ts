import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublishedResultCaches } from './resultPublication';
import { discardLeagueResultDraft, publishLeagueResultDraft } from './operations';
import { resultRecoveryError } from './resultDraftRecovery';

describe('result publication cache invalidation', () => {
  it('validates draft discard receipts and preserves server failures', async () => {
    const rpc = vi.fn().mockResolvedValue({data:{id:'draft',race_id:'race',status:'discarded'},error:null});
    await expect(discardLeagueResultDraft({rpc} as never,'draft')).resolves.toMatchObject({status:'discarded'});
    expect(rpc).toHaveBeenCalledWith('discard_league_result_draft',{p_result_version_id:'draft'});
    rpc.mockResolvedValueOnce({data:{id:'other',race_id:'race',status:'discarded'},error:null});
    await expect(discardLeagueResultDraft({rpc} as never,'draft')).rejects.toThrow('not confirmed');
    rpc.mockResolvedValueOnce({data:null,error:{message:'Only unpublished result drafts can be discarded.'}});
    await expect(discardLeagueResultDraft({rpc} as never,'draft')).rejects.toMatchObject({message:expect.stringContaining('Only unpublished')});
  });
  it('explains PostgREST object errors without exposing raw database details', () => {
    expect(resultRecoveryError({message:'The affected driver needs a classified result with a valid race time.'},'de','publish')).toContain('Rennzeiten');
    expect(resultRecoveryError({message:'This result draft was discarded.'},'de','publish')).toContain('bereits verworfen');
    expect(resultRecoveryError({message:'Only unpublished result drafts can be discarded.'},'de','discard')).toContain('bereits veröffentlicht');
    expect(resultRecoveryError({message:'secret SQL detail'},'de','publish')).not.toContain('secret');
    for (const lang of ['de','en','es','fr'] as const) expect(resultRecoveryError({},lang,'discard').length).toBeGreaterThan(20);
  });
  it('accepts a corrected publication only when the server links it to the submitted draft', async () => {
    const rpc = vi.fn().mockResolvedValue({data:{id:'corrected',source_version_id:'draft',race_id:'race',status:'active'},error:null});
    await expect(publishLeagueResultDraft({rpc} as never,'draft','rcc')).resolves.toMatchObject({id:'corrected'});
    rpc.mockResolvedValueOnce({data:{id:'unrelated',source_version_id:'other-draft',race_id:'race',status:'active'},error:null});
    await expect(publishLeagueResultDraft({rpc} as never,'draft','rcc')).rejects.toThrow('nicht vollständig');
  });
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes every legacy data and standings cache for the published league only', () => {
    localStorage.setItem('rcc_query_cache_v3:testliga:races', 'stale');
    localStorage.setItem('rcc_query_cache_v4:testliga:raceResults', 'stale');
    localStorage.setItem('rcc_query_cache_v4:andereliga:races', 'keep');
    sessionStorage.setItem('rcc.standings.view.v2:testliga:fahrer-wm', 'stale');
    sessionStorage.setItem('rcc.standings.view.v2:andereliga:fahrer-wm', 'keep');
    const listener = vi.fn();
    window.addEventListener('racevora:result-published', listener);

    invalidatePublishedResultCaches('TestLiga');

    expect(localStorage.getItem('rcc_query_cache_v3:testliga:races')).toBeNull();
    expect(localStorage.getItem('rcc_query_cache_v4:testliga:raceResults')).toBeNull();
    expect(localStorage.getItem('rcc_query_cache_v4:andereliga:races')).toBe('keep');
    expect(sessionStorage.getItem('rcc.standings.view.v2:testliga:fahrer-wm')).toBeNull();
    expect(sessionStorage.getItem('rcc.standings.view.v2:andereliga:fahrer-wm')).toBe('keep');
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener('racevora:result-published', listener);
  });
});
