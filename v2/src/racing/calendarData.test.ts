import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../types/database';
import { calendarRaceDate, calendarRaceStatus, calendarTrack, loadCalendar, loadCalendarArchive, racingHref, type CalendarRace } from './calendarData';
import tracks from './trackCatalog.json';
import { calendarMessages } from './calendarMessages';

const race: CalendarRace = { id: 'race-one', season_id: 'season-one', round_number: 1, grand_prix_name: 'Japan GP', circuit_name: 'Suzuka International Racing Course', country_code: 'JP', race_date: '2026-09-20', race_time: '20:00', race_start_at: null, status: 'upcoming', weather: 'dynamisch' };
function fixture(options: { fail?: string; noSeason?: boolean; onSeason?: () => void } = {}) {
  const requests: URL[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input)); requests.push(url);
    const table = url.pathname.split('/').pop();
    if (table === options.fail) return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 403 });
    if (table === 'seasons') options.onSeason?.();
    const body = table === 'leagues' ? { id: 'league-one' } : table === 'seasons' ? options.noSeason ? null : url.searchParams.get('is_active') === 'eq.false' ? [{ id: 'archive', is_active: false }] : { id: 'season-one', game_key: 'f1_25' } : table === 'races' ? [race] : [{ race_id: race.id }, { race_id: race.id }];
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  const client = createClient<Database>('https://native-calendar-test.supabase.co', 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, storageKey: `calendar-test-${crypto.randomUUID()}` }, global: { fetch: fetcher } });
  return { client, requests };
}

describe('native calendar preserves existing racing data semantics', () => {
  it('keeps race dates and lifecycle classification, without inferring publication status', () => {
    const date = calendarRaceDate(race)!;
    expect(date.getHours()).toBe(20);
    expect(calendarRaceStatus(race, date.getTime() - 1)).toBe('upcoming');
    expect(calendarRaceStatus(race, date.getTime())).toBe('completed');
    expect(calendarRaceStatus({ ...race, status: 'completed' }, 0)).toBe('completed');
    expect(calendarRaceStatus({ ...race, status: 'cancelled' })).toBe('cancelled');
    expect(calendarRaceDate({ ...race, race_date: 'invalid' })).toBeNull();
    expect(calendarRaceDate({ ...race, race_date: null })).toBeNull();
  });
  it('matches local track assets and the season game without assuming one F1 version', () => {
    expect(calendarTrack(race)?.trackMapFile).toBe('suzuka.png');
    expect(calendarTrack({ ...race, grand_prix_name: 'Spanien GP' }, 'f1_25')?.key).toBe('spain');
    expect(calendarTrack({ ...race, grand_prix_name: 'Spanien GP' }, 'f1-26')?.key).toBe('madrid');
    expect(calendarTrack({ grand_prix_name: 'Custom race', circuit_name: 'Suzuka International Racing Course' })?.key).toBe('japan');
    expect(calendarTrack({ grand_prix_name: 'Custom race', circuit_name: null })).toBeNull();
  });
  it('keeps the native catalog synchronized with the trusted existing source', () => {
    const context = { window: {} as { RCC_TRACKS?: typeof tracks } };
    runInNewContext(readFileSync('../assets/js/data/tracks.js', 'utf8'), context);
    expect(tracks).toEqual(context.window.RCC_TRACKS!.map(({ key, trackMapFile, grandPrixName, circuitName, countryCode, aliases, games }) => ({ key, trackMapFile, grandPrixName, circuitName, countryCode, aliases, ...(games ? { games } : {}) })));
    for (const track of tracks) expect(existsSync(`../assets/trackmaps/${track.trackMapFile}`)).toBe(true);
  });
  it('preserves encoded league, season and race deep links', () => {
    expect(racingHref('/racing/races/detail', 'test-league', { round: 2, season: 'season & one' })).toBe('/racing/races/detail?league=test-league&round=2&season=season+%26+one');
  });
  it('has complete copy in all four app languages', () => {
    for (const messages of Object.values(calendarMessages)) expect(Object.keys(messages).sort()).toEqual(Object.keys(calendarMessages.de).sort());
  });
  it('scopes season and races explicitly and reads only visible steward counts', async () => {
    const { client, requests } = fixture();
    const data = await loadCalendar(client, 'test-league', new AbortController().signal);
    expect(data.races).toEqual([race]);
    expect(data.stewardCounts[race.id]).toBe(2);
    expect(requests[0].searchParams.get('slug')).toBe('eq.test-league');
    expect(requests[1].searchParams.get('league_id')).toBe('eq.league-one');
    expect(requests[2].searchParams.get('season_id')).toBe('eq.season-one');
    expect(requests.some((url) => url.pathname.includes('season_driver_assignments'))).toBe(false);
  });
  it('shows an empty calendar without falling back to another season or league', async () => {
    const { client, requests } = fixture({ noSeason: true });
    expect((await loadCalendar(client, 'empty-league', new AbortController().signal)).races).toEqual([]);
    expect(requests).toHaveLength(2);
  });
  it('surfaces race errors while keeping unavailable optional steward counts non-blocking', async () => {
    await expect(loadCalendar(fixture({ fail: 'races' }).client, 'test-league', new AbortController().signal)).rejects.toBeTruthy();
    const data = await loadCalendar(fixture({ fail: 'steward_cases' }).client, 'test-league', new AbortController().signal);
    expect(data.races).toHaveLength(1);
    expect(data.stewardCounts).toEqual({});
  });
  it('does not continue to query races after leaving the league', async () => {
    const controller = new AbortController();
    const { client, requests } = fixture({ onSeason: () => controller.abort() });
    await expect(loadCalendar(client, 'test-league', controller.signal)).rejects.toBeTruthy();
    expect(requests.some((url) => url.pathname.endsWith('/races'))).toBe(false);
  });
  it('scopes archive reads and excludes the active season', async () => {
    const { client, requests } = fixture();
    expect(await loadCalendarArchive(client, 'test-league', new AbortController().signal)).toEqual([{ id: 'archive', is_active: false }]);
    expect(requests[1].searchParams.get('league_id')).toBe('eq.league-one');
    expect(requests[1].searchParams.get('is_active')).toBe('eq.false');
  });
});
