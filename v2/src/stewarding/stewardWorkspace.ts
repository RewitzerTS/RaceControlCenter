import type { Json } from '../types/database';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { loadResultRevisions, type ResultRevision } from '../results/resultRevisions';

export type StewardCase = {
  id: string;
  race_id: string;
  case_number: string;
  status: string;
  title: string;
  description: string;
  accused_driver_id: string;
  reported_driver_id: string | null;
  rule_code: string;
  rule_version: string;
  created_at: string;
  closed_at: string | null;
  current_decision_version: number | null;
};

export type StewardRace = { id: string; season_id: string; grand_prix_name: string; round_number: number; race_date: string | null; race_time: string | null; race_start_at: string | null; status: string; current_result_version_id: string | null; is_active_season: boolean };
export type StewardDriver = { id: string; display_name: string; number: number | null };
export type StewardEvidence = { id: string; evidence_kind: string; description: string; uri: string | null; is_public: boolean; submitted_at: string };
export type StewardVote = { id: string; vote_version: number; outcome: string; reasoning: string; conflict_disclosed: boolean; cast_at: string; steward_user_id: string };
export type StewardDecision = { id: string; version_number: number; outcome: string; reasoning: string; rule_code: string; rule_version: string; finalized_at: string; result_version_id: string; result_revision: ResultRevision | null };
export type StewardPenalty = { id: string; decision_version_id: string; penalty_type: string; time_delta_ms: number | null; points_delta: number | null; reason: string };
export type StewardAppeal = { id: string; reason: string; status: string; submitted_at: string };

export interface StewardWorkspaceSnapshot {
  cases: StewardCase[];
  races: StewardRace[];
  drivers: StewardDriver[];
}

export interface StewardCaseDetail {
  evidence: StewardEvidence[];
  votes: StewardVote[];
  decisions: StewardDecision[];
  penalties: StewardPenalty[];
  appeals: StewardAppeal[];
}

export interface StewardDetailCounts {
  appeals: number;
  decisions: number;
  evidence: number;
  penalties: number;
  votes: number;
}

export function stewardDetailCounts(detail: StewardCaseDetail | null): StewardDetailCounts | null {
  if (!detail) return null;
  return {
    appeals: detail.appeals.length,
    decisions: detail.decisions.length,
    evidence: detail.evidence.length,
    penalties: detail.penalties.length,
    votes: detail.votes.length,
  };
}

export function activeStewardRaces(snapshot: StewardWorkspaceSnapshot, now = Date.now()): StewardRace[] {
  return snapshot.races.filter((race) => {
    if (!race.is_active_season || ['cancelled', 'postponed'].includes(race.status)) return false;
    if (race.current_result_version_id || race.status === 'completed') return true;
    if (race.status !== 'upcoming') return false;
    // A report must not depend on result publication. Prefer the stored absolute
    // start; legacy date/time values follow the calendar's local-time semantics.
    const start = race.race_start_at || (race.race_date
      ? race.race_date.includes('T') ? race.race_date : `${race.race_date}T${race.race_time || '00:00'}`
      : '');
    const timestamp = Date.parse(start);
    return Number.isFinite(timestamp) && timestamp <= now;
  }).sort((a, b) => a.round_number - b.round_number);
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function loadStewardWorkspace(client: LeagueSupabaseClient): Promise<StewardWorkspaceSnapshot> {
  const activeSeason = await client.from('seasons').select('id').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
  throwIfError(activeSeason.error);
  const [cases, drivers] = await Promise.all([
    client.from('steward_cases').select('id,race_id,case_number,status,title,description,accused_driver_id,reported_driver_id,rule_code,rule_version,created_at,closed_at,current_decision_version').order('created_at', { ascending: false }).limit(25),
    client.from('drivers').select('id,display_name,number').eq('is_active', true).order('display_name').limit(500),
  ]);
  throwIfError(cases.error); throwIfError(drivers.error);
  const columns = 'id,season_id,grand_prix_name,round_number,race_date,race_time,race_start_at,status,current_result_version_id' as const;
  const activeRaces: Omit<StewardRace, 'is_active_season'>[] = [];
  if (activeSeason.data) {
    for (let page = 0; ; page++) {
      if (page === 20) throw new Error('Steward race pagination limit reached');
      const races = await client.from('races').select(columns).eq('season_id', activeSeason.data.id)
        .order('round_number').order('id').range(page * 500, page * 500 + 499);
      throwIfError(races.error);
      activeRaces.push(...races.data ?? []);
      if ((races.data?.length ?? 0) < 500) break;
    }
  }
  // Retain race labels for old cases without letting archive rounds displace
  // active-season races in a globally limited, descending query.
  const missingIds = [...new Set((cases.data ?? []).map((item) => item.race_id))]
    .filter((id) => !activeRaces.some((race) => race.id === id));
  const caseRaces = missingIds.length ? await client.from('races').select(columns).in('id', missingIds) : { data: [], error: null };
  throwIfError(caseRaces.error);
  return {
    cases: cases.data ?? [],
    races: [...activeRaces, ...caseRaces.data ?? []].map((race) => ({ ...race, is_active_season: race.season_id === activeSeason.data?.id })),
    drivers: drivers.data ?? [],
  };
}

export async function loadStewardCaseDetail(client: LeagueSupabaseClient, caseId: string): Promise<StewardCaseDetail> {
  const [evidence, votes, decisions, appeals] = await Promise.all([
    client.from('steward_evidence').select('id,evidence_kind,description,uri,is_public,submitted_at').eq('case_id', caseId).order('submitted_at'),
    client.from('steward_votes').select('id,vote_version,outcome,reasoning,conflict_disclosed,cast_at,steward_user_id').eq('case_id', caseId).order('cast_at', { ascending: false }),
    client.from('steward_decision_versions').select('id,version_number,outcome,reasoning,rule_code,rule_version,finalized_at,result_version_id').eq('case_id', caseId).order('version_number', { ascending: false }),
    client.from('steward_appeals').select('id,reason,status,submitted_at').eq('case_id', caseId).order('submitted_at', { ascending: false }),
  ]);
  throwIfError(evidence.error); throwIfError(votes.error); throwIfError(decisions.error); throwIfError(appeals.error);
  const decisionIds = (decisions.data ?? []).map((decision) => decision.id);
  const penalties = decisionIds.length
    ? await client.from('steward_penalties').select('id,decision_version_id,penalty_type,time_delta_ms,points_delta,reason').in('decision_version_id', decisionIds)
    : { data: [], error: null };
  throwIfError(penalties.error);
  const revisions = await loadResultRevisions(client, (decisions.data ?? []).map((decision) => decision.result_version_id));
  const enrichedDecisions = (decisions.data ?? []).map((decision) => ({ ...decision, result_revision: revisions.get(decision.result_version_id) ?? null }));
  return { evidence: evidence.data ?? [], votes: votes.data ?? [], decisions: enrichedDecisions, penalties: penalties.data ?? [], appeals: appeals.data ?? [] };
}

export async function createStewardCase(client: LeagueSupabaseClient, input: {
  raceId: string; reportedDriverId: string | null; accusedDriverId: string; title: string;
  description: string; ruleCode: string; ruleVersion: string;
}) {
  const response = await client.rpc('create_steward_case', {
    p_race_id: input.raceId, p_reported_driver_id: input.reportedDriverId as string,
    p_accused_driver_id: input.accusedDriverId, p_title: input.title,
    p_description: input.description, p_rule_code: input.ruleCode,
    p_rule_version: input.ruleVersion, p_idempotency_key: crypto.randomUUID(),
  });
  throwIfError(response.error); return response.data;
}

export async function addStewardEvidence(client: LeagueSupabaseClient, input: {
  caseId: string; kind: string; uri: string; description: string; isPublic: boolean;
}) {
  const response = await client.rpc('add_steward_evidence', {
    p_case_id: input.caseId, p_evidence_kind: input.kind, p_uri: input.uri,
    p_description: input.description, p_is_public: input.isPublic,
    p_idempotency_key: crypto.randomUUID(),
  });
  throwIfError(response.error); return response.data;
}

export async function castStewardVote(client: LeagueSupabaseClient, input: {
  caseId: string; outcome: string; reasoning: string; conflict: boolean;
}) {
  const response = await client.rpc('cast_steward_vote', {
    p_case_id: input.caseId, p_outcome: input.outcome, p_reasoning: input.reasoning,
    p_conflict_disclosed: input.conflict, p_idempotency_key: crypto.randomUUID(),
  });
  throwIfError(response.error); return response.data;
}

export async function finalizeStewardDecision(client: LeagueSupabaseClient, input: {
  caseId: string; outcome: string; reasoning: string; ruleCode: string; ruleVersion: string;
  penalties: Json[];
}) {
  const response = await client.rpc('finalize_steward_decision', {
    p_case_id: input.caseId, p_outcome: input.outcome, p_reasoning: input.reasoning,
    p_rule_code: input.ruleCode, p_rule_version: input.ruleVersion,
    p_penalties: input.penalties, p_idempotency_key: crypto.randomUUID(),
  });
  throwIfError(response.error); return response.data;
}
