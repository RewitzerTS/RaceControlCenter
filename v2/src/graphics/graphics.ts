import type { Json } from '../types/database';
import type { LeagueSupabaseClient } from '../lib/supabase';

export const GRAPHIC_TYPES = ['race_result', 'podium', 'winner', 'driver_standings', 'team_standings', 'achievement'] as const;
export const GRAPHIC_FORMATS = ['square', 'portrait', 'story', 'landscape'] as const;
export const GRAPHIC_DRIVER_LABEL_MODES = ['driver_name', 'display_name', 'gamertag'] as const;

export type GraphicType = (typeof GRAPHIC_TYPES)[number];
export type GraphicFormat = (typeof GRAPHIC_FORMATS)[number];
export type GraphicDriverLabelMode = (typeof GRAPHIC_DRIVER_LABEL_MODES)[number];
export type GraphicDriverLabels = { driverId: string; leagueDriverName?: string | null; driverName?: string | null; displayName?: string | null; gamertag?: string | null };
export type ResultRow = {
  position: number | null;
  driverId?: string;
  driver: string;
  driverName?: string | null;
  displayName?: string | null;
  gamertag?: string | null;
  team: string;
  points: number;
  status: string;
  raceTime?: string | null;
  raceTimeMs?: number | null;
};
export type GraphicsResult = {
  id: string;
  version: number;
  race_id: string;
  race_name: string;
  circuit: string | null;
  country_code?: string | null;
  race_date: string | null;
  round: number;
  rows: ResultRow[];
};
export type GraphicsResultOption = Omit<GraphicsResult, 'id' | 'rows' | 'version'> & { result_version_id: string };
export type StandingRow = { position: number; driverId?: string; driver?: string; team?: string; points: number; wins: number };
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
  latest_result: GraphicsResult | null;
  driver_labels?: GraphicDriverLabels[];
  driver_standings: StandingRow[];
  team_standings: StandingRow[];
  latest_achievement: null | { driverId?: string; driver: string; code: string; value: number; unlocked_at: string };
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
  time: string;
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
  rows: Array<{ rank: string; primary: string; secondary: string; detail?: string; value: string }>;
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
  const [response, labelsResponse] = await Promise.all([
    client.rpc('get_social_graphics_workspace'),
    client.rpc('get_social_graphics_driver_labels'),
  ]);
  if (response.error) throw response.error;
  if (labelsResponse.error) throw labelsResponse.error;
  return {
    ...(object(response.data) as unknown as GraphicsWorkspace),
    driver_labels: (labelsResponse.data ?? []) as unknown as GraphicDriverLabels[],
  };
}

export async function loadGraphicsResultOptions(client: LeagueSupabaseClient): Promise<GraphicsResultOption[]> {
  const seasonResponse = await client
    .from('seasons')
    .select('id')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seasonResponse.error) throw seasonResponse.error;
  if (!seasonResponse.data) return [];

  const racesResponse = await client
    .from('races')
    .select('id,grand_prix_name,circuit_name,country_code,race_date,round_number,current_result_version_id')
    .eq('season_id', seasonResponse.data.id)
    .not('current_result_version_id', 'is', null)
    .order('round_number', { ascending: false })
    .limit(100);
  if (racesResponse.error) throw racesResponse.error;

  return (racesResponse.data ?? []).flatMap((race) => race.current_result_version_id ? [{
    result_version_id: race.current_result_version_id,
    race_id: race.id,
    race_name: race.grand_prix_name,
    circuit: race.circuit_name,
    country_code: race.country_code,
    race_date: race.race_date,
    round: race.round_number,
  }] : []);
}

export async function loadGraphicsResult(client: LeagueSupabaseClient, option: GraphicsResultOption): Promise<GraphicsResult> {
  const response = await client.rpc('get_social_graphics_result', { p_result_version_id: option.result_version_id });
  if (response.error) throw response.error;
  return object(response.data) as unknown as GraphicsResult;
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

export function formatRaceGap(milliseconds: number) {
  const totalMilliseconds = Math.max(0, Math.round(milliseconds));
  const totalMinutes = Math.floor(totalMilliseconds / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const millisecondRemainder = totalMilliseconds % 1_000;
  return `+${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millisecondRemainder).padStart(3, '0')}`;
}

const RACE_STATUS_CODES = new Set(['DNF', 'DNS', 'DSQ', 'DNQ', 'RET']);

function raceStatusLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && RACE_STATUS_CODES.has(normalized) ? normalized : null;
}

function raceResultTime(row: ResultRow, winnerTimeMs: number | null) {
  const status = row.status.trim().toUpperCase();
  const recordedTime = row.raceTime?.trim();
  const recordedStatus = raceStatusLabel(recordedTime);

  // The import review combines race time and classification in one field. Older
  // result versions can therefore contain race_time = DNF while the canonical
  // classification status still carries its historic default "classified".
  if (recordedStatus) return recordedStatus;

  if (row.position === 1) {
    return recordedTime || (status === 'CLASSIFIED' ? '—' : status);
  }

  if (
    winnerTimeMs !== null
    && typeof row.raceTimeMs === 'number'
    && Number.isFinite(row.raceTimeMs)
    && row.raceTimeMs >= winnerTimeMs
  ) {
    return formatRaceGap(row.raceTimeMs - winnerTimeMs);
  }

  if (recordedTime?.startsWith('+')) {
    return recordedTime.replace(',', '.');
  }

  return status === 'CLASSIFIED' ? '—' : status;
}

function cleanDriverLabel(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned || null;
}

function graphicDriverLabel(
  workspace: GraphicsWorkspace,
  driver: { driverId?: string; driver?: string; driverName?: string | null; displayName?: string | null; gamertag?: string | null },
  mode: GraphicDriverLabelMode,
  fallback: string,
) {
  const existing = cleanDriverLabel(driver.driver) ?? cleanDriverLabel(fallback) ?? '—';
  const savedLabels = workspace.driver_labels?.find((candidate) => (
    (driver.driverId && candidate.driverId === driver.driverId)
    || cleanDriverLabel(candidate.leagueDriverName)?.localeCompare(existing, undefined, { sensitivity: 'base' }) === 0
    || cleanDriverLabel(candidate.driverName)?.localeCompare(existing, undefined, { sensitivity: 'base' }) === 0
    || cleanDriverLabel(candidate.displayName)?.localeCompare(existing, undefined, { sensitivity: 'base' }) === 0
    || cleanDriverLabel(candidate.gamertag)?.localeCompare(existing, undefined, { sensitivity: 'base' }) === 0
  ));
  const driverName = cleanDriverLabel(savedLabels?.driverName) ?? cleanDriverLabel(driver.driverName);
  const displayName = cleanDriverLabel(savedLabels?.displayName) ?? cleanDriverLabel(driver.displayName);
  const gamertag = cleanDriverLabel(savedLabels?.gamertag) ?? cleanDriverLabel(driver.gamertag);

  if (mode === 'driver_name') return driverName ?? displayName ?? existing;
  if (mode === 'gamertag') return gamertag ?? displayName ?? existing;
  return displayName ?? existing;
}

export function buildGraphicModel(
  workspace: GraphicsWorkspace,
  type: GraphicType,
  labels: GraphicLabels,
  driverLabelMode: GraphicDriverLabelMode = 'driver_name',
): GraphicModel {
  const result = workspace.latest_result;
  const footer = result ? `${labels.official} · ${labels.resultVersion} ${result.version}` : labels.official;
  const resultVersionId = ['race_result', 'podium', 'winner'].includes(type) ? result?.id ?? null : null;

  if (type === 'race_result') {
    const winner = (result?.rows ?? []).find((row) => row.position === 1);
    const winnerTimeMs = typeof winner?.raceTimeMs === 'number' && Number.isFinite(winner.raceTimeMs)
      ? winner.raceTimeMs
      : null;
    const rows = (result?.rows ?? []).map((row) => ({
      rank: row.position ? String(row.position).padStart(2, '0') : row.status.toUpperCase(),
      primary: graphicDriverLabel(workspace, row, driverLabelMode, labels.noData),
      secondary: row.team,
      detail: raceResultTime(row, winnerTimeMs),
      value: points(row.points, labels.points),
    }));
    return { type, eyebrow: labels.raceResult, title: result?.race_name ?? labels.noData, subtitle: result?.circuit ?? `${labels.round} ${result?.round ?? '—'}`, rows, footer, resultVersionId, source: { type, league: workspace.league, result } as unknown as Record<string, Json> };
  }
  if (type === 'podium') {
    const rows = (result?.rows ?? []).filter((row) => row.position && row.position <= 3).slice(0, 3).map((row) => ({ rank: `P${row.position}`, primary: graphicDriverLabel(workspace, row, driverLabelMode, labels.noData), secondary: row.team, value: points(row.points, labels.points) }));
    return { type, eyebrow: labels.podium, title: result?.race_name ?? labels.noData, subtitle: result?.circuit ?? '', rows, footer, resultVersionId, source: { type, league: workspace.league, result: result ? { ...result, rows: result.rows.slice(0, 3) } : null } as unknown as Record<string, Json> };
  }
  if (type === 'winner') {
    const winner = (result?.rows ?? []).find((row) => row.position === 1);
    return { type, eyebrow: labels.winner, title: winner ? graphicDriverLabel(workspace, winner, driverLabelMode, labels.noData) : labels.noData, subtitle: result?.race_name ?? '', hero: winner?.team, rows: [], footer, resultVersionId, source: { type, league: workspace.league, result: result ? { ...result, rows: undefined, winner } : null } as unknown as Record<string, Json> };
  }
  if (type === 'driver_standings') {
    const rows = workspace.driver_standings.slice(0, 10).map((row) => ({ rank: String(row.position).padStart(2, '0'), primary: graphicDriverLabel(workspace, row, driverLabelMode, labels.noData), secondary: `${row.wins} ${labels.wins}`, value: points(row.points, labels.points) }));
    return { type, eyebrow: labels.driverStandings, title: workspace.league.name, subtitle: result?.race_name ?? '', rows, footer: labels.official, resultVersionId, source: { type, league: workspace.league, result: result ? { id: result.id, version: result.version, race_name: result.race_name, circuit: result.circuit, country_code: result.country_code, race_date: result.race_date, round: result.round } : null, rows: workspace.driver_standings } as unknown as Record<string, Json> };
  }
  if (type === 'team_standings') {
    const rows = workspace.team_standings.slice(0, 10).map((row) => ({ rank: String(row.position).padStart(2, '0'), primary: row.team ?? labels.noData, secondary: `${row.wins} ${labels.wins}`, value: points(row.points, labels.points) }));
    return { type, eyebrow: labels.teamStandings, title: workspace.league.name, subtitle: result?.race_name ?? '', rows, footer: labels.official, resultVersionId, source: { type, league: workspace.league, result: result ? { id: result.id, version: result.version, race_name: result.race_name, circuit: result.circuit, country_code: result.country_code, race_date: result.race_date, round: result.round } : null, rows: workspace.team_standings } as unknown as Record<string, Json> };
  }
  const achievement = workspace.latest_achievement;
  return { type, eyebrow: labels.achievement, title: achievement ? graphicDriverLabel(workspace, achievement, driverLabelMode, labels.noData) : labels.noData, subtitle: achievement?.code.replaceAll('_', ' ') ?? '', hero: achievement ? String(achievement.value) : undefined, rows: [], footer: labels.official, resultVersionId, source: { type, league: workspace.league, achievement } as unknown as Record<string, Json> };
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
  const bytes = new TextEncoder().encode(canonicalize({
    format,
    presentation,
    rendered: { eyebrow: model.eyebrow, title: model.title, subtitle: model.subtitle, hero: model.hero, rows: model.rows, footer: model.footer },
    source: model.source,
  }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function graphicFilename(workspace: GraphicsWorkspace, type: GraphicType, format: GraphicFormat, pageNumber = 1, pageCount = 1) {
  const version = workspace.latest_result?.version ? `-v${workspace.latest_result.version}` : '';
  const page = pageCount > 1 ? `-${String(pageNumber).padStart(2, '0')}` : '';
  return `racevora-${workspace.league.slug}-${type}-${format}${version}${page}.png`;
}

export function graphicArchiveFilename(workspace: GraphicsWorkspace, type: GraphicType, format: GraphicFormat) {
  const resultVersion = workspace.latest_result ? `-v${workspace.latest_result.version}` : '';
  return `racevora-${workspace.league.slug}-${type}-${format}${resultVersion}.zip`;
}
