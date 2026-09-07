import type { LeagueSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database';
import tracks from './trackCatalog.json';

export type CalendarRace = Pick<Database['public']['Tables']['races']['Row'],
  'id' | 'season_id' | 'round_number' | 'grand_prix_name' | 'circuit_name' | 'country_code' | 'race_date' | 'race_time' | 'race_start_at' | 'status' | 'weather'>;
export type CalendarSeason = Pick<Database['public']['Tables']['seasons']['Row'],
  'id' | 'name' | 'game_key' | 'game_label' | 'is_active' | 'archived_at'>;
export interface CalendarData { season: CalendarSeason | null; races: CalendarRace[]; stewardCounts: Record<string, number> }
const seasonColumns = 'id,name,game_key,game_label,is_active,archived_at' as const;

async function leagueId(client: LeagueSupabaseClient, slug: string, signal: AbortSignal) {
  const response = await client.from('leagues').select('id').eq('slug', slug).abortSignal(signal).single();
  signal.throwIfAborted();
  if (response.error) throw response.error;
  return response.data.id;
}

export async function loadCalendar(client: LeagueSupabaseClient, slug: string, signal: AbortSignal): Promise<CalendarData> {
  const id = await leagueId(client, slug, signal);
  const seasonResponse = await client.from('seasons').select(seasonColumns).eq('league_id', id)
    .eq('is_active', true).order('created_at', { ascending: false }).limit(1).abortSignal(signal).maybeSingle();
  signal.throwIfAborted();
  if (seasonResponse.error) throw seasonResponse.error;
  const season = seasonResponse.data;
  if (!season) return { season: null, races: [], stewardCounts: {} };
  const response = await client.from('races')
    .select('id,season_id,round_number,grand_prix_name,circuit_name,country_code,race_date,race_time,race_start_at,status,weather')
    .eq('season_id', season.id).order('round_number').limit(500).abortSignal(signal);
  signal.throwIfAborted();
  if (response.error) throw response.error;
  const races = response.data ?? [];
  const stewardCounts: Record<string, number> = {};
  if (races.length) {
    // Match the existing calendar: optional counts include only RLS-visible cases.
    // An unavailable steward endpoint must not hide the public race calendar.
    const cases = await client.from('steward_cases').select('race_id').in('race_id', races.map((race) => race.id)).abortSignal(signal);
    signal.throwIfAborted();
    if (!cases.error) for (const entry of cases.data ?? []) {
      if (entry.race_id) stewardCounts[entry.race_id] = (stewardCounts[entry.race_id] ?? 0) + 1;
    }
  }
  return { season, races, stewardCounts };
}

export async function loadCalendarArchive(client: LeagueSupabaseClient, slug: string, signal: AbortSignal): Promise<CalendarSeason[]> {
  const id = await leagueId(client, slug, signal);
  const response = await client.from('seasons').select(seasonColumns).eq('league_id', id).eq('is_active', false)
    .order('archived_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200).abortSignal(signal);
  signal.throwIfAborted();
  if (response.error) throw response.error;
  return response.data ?? [];
}

// Preserve the legacy calendar's date/lifecycle semantics during this UI migration.
export function calendarRaceDate(race: CalendarRace): Date | null {
  const value = race.race_date?.trim();
  if (!value) return null;
  const time = /^\d{2}:\d{2}$/.test(race.race_time ?? '') ? race.race_time : '00:00';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${time}:00` : value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calendarRaceStatus(race: CalendarRace, now = Date.now()): string {
  if (race.status === 'completed') return 'completed';
  if (race.status !== 'upcoming') return race.status || 'upcoming';
  const date = calendarRaceDate(race);
  return date && date.getTime() <= now ? 'completed' : 'upcoming';
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function calendarTrack(race: Pick<CalendarRace, 'grand_prix_name' | 'circuit_name'>, gameKey = '') {
  const game = gameKey.replaceAll('-', '_');
  const available = tracks.filter((track) => !game || !track.games || track.games.includes(game));
  const matches = (name: string, values: string[]) => {
    const needle = normalized(name);
    return needle && values.some((value) => { const candidate = normalized(value); return candidate && (candidate === needle || candidate.includes(needle) || needle.includes(candidate)); });
  };
  return available.find((track) => matches(race.grand_prix_name, [track.grandPrixName, ...track.aliases]))
    ?? available.find((track) => matches(race.circuit_name ?? '', [track.circuitName])) ?? null;
}

export function racingHref(path: string, league: string, values: Record<string, string | number> = {}) {
  const params = new URLSearchParams({ league });
  Object.entries(values).forEach(([key, value]) => params.set(key, String(value)));
  return `${path}?${params}`;
}
