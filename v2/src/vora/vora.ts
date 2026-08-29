import catalogDocument from '../../../docs/v2/vora-deterministic-insights-300.json';
import type { Json } from '../types/database';
import type { LeagueSupabaseClient } from '../lib/supabase';

type CatalogConditionValue = string | number | boolean | [number, number];
type CatalogOperator = 'between' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

type CatalogCondition = {
  field: string;
  operator: CatalogOperator;
  value: CatalogConditionValue;
};

export type VoraCatalogInsight = {
  id: string;
  category: string;
  priority: number;
  voice: string;
  when: { all: CatalogCondition[] };
  title: string;
  body: string;
  focus: string;
};

const VORA_INSIGHT_CATALOG = (catalogDocument as unknown as { insights: VoraCatalogInsight[] }).insights;

export type VoraSnapshot = {
  source: 'deterministic_v1';
  generated_at: string;
  insight: { rule: string; title_key: string; body_key: string };
  career: {
    starts: number;
    wins: number;
    podiums: number;
    average_finish: number | null;
    last_race_date: string | null;
    best_finish?: number | null;
    classified_finishes?: number;
    dnfs?: number;
    dns?: number;
    dsqs?: number;
    fastest_laps?: number;
    leagues_competed?: number;
    poles?: number;
    seasons_competed?: number;
    total_points?: number;
  };
  progression: { level: number; rank: string; lifetime_xp: number; xp_to_next_level: number };
  recent_result: {
    finish_position: number | null;
    grid_position: number | null;
    classification_status: string;
    race_date: string | null;
    awarded_points?: number;
    is_fastest_lap?: boolean;
    is_pole?: boolean;
  } | null;
  active_challenges: number;
  context_fields: string[];
};

function isRecord(value: Json | null): value is Record<string, Json | undefined> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function divide(numerator: unknown, denominator: unknown): number | undefined {
  const top = finiteNumber(numerator);
  const bottom = finiteNumber(denominator);
  return top !== undefined && bottom !== undefined && bottom > 0 ? top / bottom : undefined;
}

function readSnapshotField(snapshot: VoraSnapshot, field: string): unknown {
  if (field === 'recent_result.position_delta') {
    const grid = finiteNumber(snapshot.recent_result?.grid_position);
    const finish = finiteNumber(snapshot.recent_result?.finish_position);
    return grid !== undefined && finish !== undefined ? grid - finish : undefined;
  }
  if (field === 'career.classification_rate') return divide(snapshot.career.classified_finishes, snapshot.career.starts);
  if (field === 'career.dnf_rate') return divide(snapshot.career.dnfs, snapshot.career.starts);
  if (field === 'career.points_per_start') return divide(snapshot.career.total_points, snapshot.career.starts);
  if (field === 'career.podium_rate') return divide(snapshot.career.podiums, snapshot.career.starts);
  if (field === 'career.win_rate') return divide(snapshot.career.wins, snapshot.career.starts);
  if (field === 'career.win_podium_ratio') return divide(snapshot.career.wins, snapshot.career.podiums);

  let value: unknown = snapshot;
  for (const segment of field.split('.')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value ?? undefined;
}

function conditionMatches(actual: unknown, condition: CatalogCondition): boolean {
  if (actual === undefined) return false;
  if (condition.operator === 'eq') return actual === condition.value;

  const current = finiteNumber(actual);
  if (current === undefined) return false;
  if (condition.operator === 'between') {
    return Array.isArray(condition.value)
      && current >= condition.value[0]
      && current <= condition.value[1];
  }

  const expected = finiteNumber(condition.value);
  if (expected === undefined) return false;
  if (condition.operator === 'gt') return current > expected;
  if (condition.operator === 'gte') return current >= expected;
  if (condition.operator === 'lt') return current < expected;
  return current <= expected;
}

export function selectVoraCatalogInsight(snapshot: VoraSnapshot): VoraCatalogInsight | null {
  return VORA_INSIGHT_CATALOG.find((insight) => (
    insight.when.all.every((condition) => conditionMatches(readSnapshotField(snapshot, condition.field), condition))
  )) ?? null;
}

export async function loadVoraSnapshot(client: LeagueSupabaseClient): Promise<VoraSnapshot> {
  const response = await client.rpc('get_vora_companion_snapshot');
  if (response.error) throw response.error;
  if (!isRecord(response.data) || response.data.source !== 'deterministic_v1') throw new Error('Unexpected Vora context.');
  return response.data as unknown as VoraSnapshot;
}
