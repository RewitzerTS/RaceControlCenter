import type { Json } from '../types/database';
import type { LeagueSupabaseClient } from '../lib/supabase';

export const GRAPHIC_TYPES = ['race_result', 'podium', 'winner', 'driver_standings', 'team_standings', 'achievement'] as const;
export const GRAPHIC_FORMATS = ['square', 'portrait', 'story', 'landscape'] as const;

export type GraphicType = (typeof GRAPHIC_TYPES)[number];
export type GraphicFormat = (typeof GRAPHIC_FORMATS)[number];
export type ResultRow = { position: number | null; driver: string; team: string; points: number; status: string };
export type StandingRow = { position: number; driver?: string; team?: string; points: number; wins: number };
export type GraphicRender = {
  id: string;
  graphic_type: GraphicType;
  graphic_format: GraphicFormat;
  result_version_id: string | null;
  source_digest: string;
  status: 'ready' | 'outdated';
  generated_at: string;
};
export type GraphicsWorkspace = {
  league: { id: string; name: string; slug: string };
  latest_result: null | {
    id: string;
    version: number;
    race_id: string;
    race_name: string;
    circuit: string | null;
    race_date: string | null;
    round: number;
    rows: ResultRow[];
  };
  driver_standings: StandingRow[];
  team_standings: StandingRow[];
  latest_achievement: null | { driver: string; code: string; value: number; unlocked_at: string };
  recent_renders: GraphicRender[];
};

export type GraphicLabels = {
  raceResult: string;
  podium: string;
  winner: string;
  driverStandings: string;
  teamStandings: string;
  achievement: string;
  points: string;
  wins: string;
  round: string;
  resultVersion: string;
  official: string;
  noData: string;
};

export type GraphicModel = {
  type: GraphicType;
  eyebrow: string;
  title: string;
  subtitle: string;
  hero?: string;
  rows: Array<{ rank: string; primary: string; secondary: string; value: string }>;
  footer: string;
  resultVersionId: string | null;
  source: Record<string, Json | undefined>;
};

export type GraphicPage = {
  model: GraphicModel;
  pageNumber: number;
  pageCount: number;
};

function object(value: Json | null): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Unexpected Social Graphics payload.');
  return value;
}

export async function loadGraphicsWorkspace(client: LeagueSupabaseClient): Promise<GraphicsWorkspace> {
  const response = await client.rpc('get_social_graphics_workspace');
  if (response.error) throw response.error;
  return object(response.data) as unknown as GraphicsWorkspace;
}

export async function recordGraphicRender(
  client: LeagueSupabaseClient,
  model: GraphicModel,
  format: GraphicFormat,
  digest: string,
  presentation?: unknown,
) {
  const response = await client.rpc('record_social_graphic_render', {
    p_graphic_type: model.type,
    p_graphic_format: format,
    p_result_version_id: model.resultVersionId as string,
    p_source_digest: digest,
    p_source_payload: (presentation ? { ...model.source, presentation } : model.source) as Json,
  });
  if (response.error) throw response.error;
  return response.data;
}

function points(value: number, label: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${label}`;
}

export function buildGraphicModel(workspace: GraphicsWorkspace, type: GraphicType, labels: GraphicLabels): GraphicModel {
  const result = workspace.latest_result;
  const footer = result ? `${labels.official} · ${labels.resultVersion} ${result.version}` : labels.official;
  const resultVersionId = ['race_result', 'podium', 'winner'].includes(type) ? result?.id ?? null : null;

  if (type === 'race_result') {
    const rows = (result?.rows ?? []).map((row) => ({
      rank: row.position ? String(row.position).padStart(2, '0') : row.status.toUpperCase(),
      primary: row.driver,
      secondary: row.team,
      value: points(row.points, labels.points),
    }));
    return { type, eyebrow: labels.raceResult, title: result?.race_name ?? labels.noData, subtitle: result?.circuit ?? `${labels.round} ${result?.round ?? '—'}`, rows, footer, resultVersionId, source: { type, league: workspace.league, result } as unknown as Record<string, Json> };
  }
  if (type === 'podium') {
    const rows = (result?.rows ?? []).filter((row) => row.position && row.position <= 3).slice(0, 3).map((row) => ({ rank: `P${row.position}`, primary: row.driver, secondary: row.team, value: points(row.points, labels.points) }));
    return { type, eyebrow: labels.podium, title: result?.race_name ?? labels.noData, subtitle: result?.circuit ?? '', rows, footer, resultVersionId, source: { type, league: workspace.league, result: result ? { ...result, rows: result.rows.slice(0, 3) } : null } as unknown as Record<string, Json> };
  }
  if (type === 'winner') {
    const winner = (result?.rows ?? []).find((row) => row.position === 1);
    return { type, eyebrow: labels.winner, title: winner?.driver ?? labels.noData, subtitle: result?.race_name ?? '', hero: winner?.team, rows: [], footer, resultVersionId, source: { type, league: workspace.league, result: result ? { id: result.id, version: result.version, race_name: result.race_name, winner } : null } as unknown as Record<string, Json> };
  }
  if (type === 'driver_standings') {
    const rows = workspace.driver_standings.slice(0, 10).map((row) => ({ rank: String(row.position).padStart(2, '0'), primary: row.driver ?? labels.noData, secondary: `${row.wins} ${labels.wins}`, value: points(row.points, labels.points) }));
    return { type, eyebrow: labels.driverStandings, title: workspace.league.name, subtitle: result?.race_name ?? '', rows, footer: labels.official, resultVersionId, source: { type, league: workspace.league, rows: workspace.driver_standings } as unknown as Record<string, Json> };
  }
  if (type === 'team_standings') {
    const rows = workspace.team_standings.slice(0, 10).map((row) => ({ rank: String(row.position).padStart(2, '0'), primary: row.team ?? labels.noData, secondary: `${row.wins} ${labels.wins}`, value: points(row.points, labels.points) }));
    return { type, eyebrow: labels.teamStandings, title: workspace.league.name, subtitle: result?.race_name ?? '', rows, footer: labels.official, resultVersionId, source: { type, league: workspace.league, rows: workspace.team_standings } as unknown as Record<string, Json> };
  }
  const achievement = workspace.latest_achievement;
  return { type, eyebrow: labels.achievement, title: achievement?.driver ?? labels.noData, subtitle: achievement?.code.replaceAll('_', ' ') ?? '', hero: achievement ? String(achievement.value) : undefined, rows: [], footer: labels.official, resultVersionId, source: { type, league: workspace.league, achievement } as unknown as Record<string, Json> };
}

export function paginateGraphicModel(model: GraphicModel, maximumRows: number): GraphicPage[] {
  if (!Number.isInteger(maximumRows) || maximumRows < 1) throw new Error('Graphic page size must be a positive integer.');
  const pageCount = Math.max(1, Math.ceil(model.rows.length / maximumRows));
  if (pageCount === 1) return [{ model, pageNumber: 1, pageCount: 1 }];

  const minimumPageSize = Math.floor(model.rows.length / pageCount);
  const largerPageCount = model.rows.length % pageCount;
  let offset = 0;
  return Array.from({ length: pageCount }, (_, index) => {
    const pageSize = minimumPageSize + (index < largerPageCount ? 1 : 0);
    const pageNumber = index + 1;
    const pageRows = model.rows.slice(offset, offset + pageSize);
    offset += pageSize;
    return { model: { ...model, rows: pageRows }, pageNumber, pageCount };
  });
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function digestGraphicSource(model: GraphicModel, format: GraphicFormat, presentation?: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize({ format, presentation, source: model.source }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function graphicFilename(workspace: GraphicsWorkspace, type: GraphicType, format: GraphicFormat, pageNumber = 1, pageCount = 1) {
  const version = workspace.latest_result?.version ? `-v${workspace.latest_result.version}` : '';
  const page = pageCount > 1 ? `-${String(pageNumber).padStart(2, '0')}` : '';
  return `racevora-${workspace.league.slug}-${type}-${format}${version}${page}.png`;
}
