import type { LeagueSupabaseClient } from '../lib/supabase';

export type ResultRevision = {
  resultVersionId: string;
  resultVersion: number;
  resultStatus: string;
  changeReason: string;
  activatedAt: string | null;
  isCurrent: boolean;
  stewardCaseNumber: string | null;
  stewardDecisionVersion: number | null;
  stewardOutcome: string | null;
  stewardFinalizedAt: string | null;
};

type ResultVersionRow = {
  id: string;
  race_id: string;
  version_number: number;
  status: string;
  change_reason: string;
  activated_at: string | null;
};

type StewardDecisionRow = {
  result_version_id: string;
  version_number: number;
  outcome: string;
  finalized_at: string;
  steward_case: { case_number: string } | Array<{ case_number: string }> | null;
};

function relatedCaseNumber(value: StewardDecisionRow['steward_case']): string | null {
  if (Array.isArray(value)) return value[0]?.case_number ?? null;
  return value?.case_number ?? null;
}

export function resultRevisionLabel(revision: ResultRevision | null): string | null {
  if (!revision?.stewardCaseNumber) return null;
  return `Steward-Revision · ${revision.stewardCaseNumber}`;
}

export async function loadResultRevisions(
  client: LeagueSupabaseClient,
  resultVersionIds: Array<string | null | undefined>,
): Promise<Map<string, ResultRevision>> {
  const ids = [...new Set(resultVersionIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const versionsResponse = await client
    .from('result_versions')
    .select('id,race_id,version_number,status,change_reason,activated_at')
    .in('id', ids);
  if (versionsResponse.error) throw versionsResponse.error;

  const versions = (versionsResponse.data ?? []) as ResultVersionRow[];
  const raceIds = [...new Set(versions.map((version) => version.race_id))];
  if (raceIds.length === 0) return new Map();
  const [racesResponse, decisionsResponse] = await Promise.all([
    client.from('races').select('id,current_result_version_id').in('id', raceIds),
    client
      .from('steward_decision_versions')
      .select('result_version_id,version_number,outcome,finalized_at,steward_case:steward_cases!steward_decision_versions_case_id_fkey(case_number)')
      .in('result_version_id', ids),
  ]);
  if (racesResponse.error) throw racesResponse.error;
  if (decisionsResponse.error) throw decisionsResponse.error;

  const currentByRace = new Map((racesResponse.data ?? []).map((race) => [race.id, race.current_result_version_id]));
  const decisionByVersion = new Map(
    ((decisionsResponse.data ?? []) as unknown as StewardDecisionRow[]).map((decision) => [decision.result_version_id, decision]),
  );

  return new Map(versions.map((version) => {
    const decision = decisionByVersion.get(version.id);
    return [version.id, {
      resultVersionId: version.id,
      resultVersion: version.version_number,
      resultStatus: version.status,
      changeReason: version.change_reason,
      activatedAt: version.activated_at,
      isCurrent: currentByRace.get(version.race_id) === version.id,
      stewardCaseNumber: relatedCaseNumber(decision?.steward_case ?? null),
      stewardDecisionVersion: decision?.version_number ?? null,
      stewardOutcome: decision?.outcome ?? null,
      stewardFinalizedAt: decision?.finalized_at ?? null,
    } satisfies ResultRevision];
  }));
}
