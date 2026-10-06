import { useEffect, useState } from 'react';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { StewardPenalty } from './stewardWorkspace';
import { simpleStewardMessages } from './simpleStewardMessages';

type CaseSummary = { id: string; title: string; description: string; reported_driver_id: string | null; accused_driver_id: string; status: string };
type Decision = { id: string; case_id: string; outcome: string; reasoning: string };
type Incoming = { id: string; driver_id: string; grid_positions: number | null; reason: string };
type Summary = { decisions: Decision[]; penalties: StewardPenalty[]; incoming: Incoming[] };

export function RaceStewardDecisions({ raceId, cases, drivers }: { raceId: string; cases: CaseSummary[]; drivers: { id: string; display_name: string }[] }) {
  const { client } = useLeague(), { language, t, formatNumber } = useI18n(), c = simpleStewardMessages[language];
  const [data,setData] = useState<Summary | null>(null), [error,setError] = useState(false), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError(false);
    async function load() {
      const [decisions,incoming] = await Promise.all([
        cases.length ? client.from('steward_decision_versions').select('id,case_id,outcome,reasoning').in('case_id',cases.map((item) => item.id)).order('version_number',{ ascending:false }) : { data:[],error:null },
        client.from('steward_penalties').select('id,driver_id,grid_positions,reason').eq('target_race_id',raceId).eq('penalty_type','grid_penalty'),
      ]);
      if (decisions.error || incoming.error) throw decisions.error || incoming.error;
      const penalties = decisions.data?.length ? await client.from('steward_penalties').select('id,decision_version_id,penalty_type,time_delta_ms,points_delta,reason,grid_positions,target_race_id').in('decision_version_id',decisions.data.map((d) => d.id)) : { data:[],error:null };
      if (penalties.error) throw penalties.error;
      const applications = penalties.data?.length ? await client.from('steward_penalty_applications').select('penalty_id,result_version_id').in('penalty_id',penalties.data.map((p) => p.id)) : { data:[],error:null };
      if (applications.error) throw applications.error;
      if (active) setData({ decisions:decisions.data || [],incoming:incoming.data || [], penalties:(penalties.data || []).map((p) => ({...p,applied_result_version_id:applications.data?.find((a) => a.penalty_id === p.id)?.result_version_id})) });
    }
    void load().catch(() => { if(active) setError(true); });
    return () => { active=false; };
  },[client,raceId,cases,attempt]);
  const name = (id: string | null) => drivers.find((d) => d.id===id)?.display_name || '—';
  if (error) return <div role="alert"><p>{t('steward.loadError')}</p><button type="button" onClick={() => setAttempt((n) => n+1)}>{c.retry}</button></div>;
  if (!data) return <p role="status">{t('pending')}</p>;
  return <>
    {data.incoming.length>0 && <section><h3>{c.incoming}</h3><ul className="profile-list">{data.incoming.map((p) => <li key={p.id}><strong>{name(p.driver_id)} · {p.grid_positions} {c.places}</strong><p>{p.reason}</p></li>)}</ul><p>{c.gridHint}</p></section>}
    {cases.length ? <ul className="profile-list">{cases.map((item) => {
      const decision = data.decisions.find((d) => d.case_id===item.id);
      return <li key={item.id}><h3>{item.title}</h3><p>{c.reporter}: {name(item.reported_driver_id)}<br />{c.accused}: {name(item.accused_driver_id)}</p>
        <p className="profile-description">{decision?.reasoning || item.description}</p>
        {!decision && <p>{t(`steward.status.${item.status}` as Parameters<typeof t>[0])}</p>}
        {decision?.outcome==='no_action' && <strong>{c.no_action}</strong>}
        {data.penalties.filter((p) => p.decision_version_id===decision?.id).map((p) => <p key={p.id}><strong>{c[p.penalty_type as keyof typeof c] || p.penalty_type}{p.time_delta_ms != null ? ` · ${p.time_delta_ms>0?'+':'−'}${formatNumber(Math.abs(p.time_delta_ms)/1000)} s` : p.grid_positions ? ` · ${p.grid_positions} ${c.places}` : ''}</strong>
          {p.time_delta_ms != null && <><br />{p.applied_result_version_id ? c.applied : c.pending}</>}</p>)}
      </li>;
    })}</ul> : data.incoming.length===0 && <p>{t('steward.empty')}</p>}
  </>;
}
