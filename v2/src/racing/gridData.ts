import type { ResultsAssignment, ResultsData } from './resultsData';

export function buildGrid(data: ResultsData) {
  const drivers = new Map(data.drivers.map((driver) => [driver.id, driver]));
  const seen = new Set<string>();
  const source: ResultsAssignment[] = data.assignments.length ? data.assignments : data.drivers.filter((driver) => driver.is_active).map((driver) => ({ driver_id: driver.id, car_name: driver.car_name, created_at: '' }));
  const seats = source.flatMap((assignment) => {
    const key = assignment.seat_code || assignment.id || assignment.driver_id;
    if (seen.has(key)) return [];
    seen.add(key);
    const driver = drivers.get(assignment.driver_id);
    const kind = assignment.participant_type?.trim().toUpperCase();
    const type = kind === 'PLAYER' || kind === 'HUMAN' ? 'player' : kind === 'BOT' ? 'bot' : 'unknown';
    const ai = assignment.ai_driver_name || driver?.ai_driver_reference || '';
    const number = assignment.number ?? driver?.number;
    return [{ key, driverId: driver?.id, name: (type === 'bot' ? ai : '') || driver?.display_name || assignment.gamertag_snapshot || ai || '—', gamertag: assignment.gamertag_snapshot || driver?.gamertag || '', ai, type, number, team: assignment.team_name || driver?.league_team || '', car: assignment.car_name || driver?.car_name || '' }];
  }).sort((a, b) => a.team.localeCompare(b.team, 'de') || (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'de'));
  const groups = new Map<string, typeof seats>();
  for (const seat of seats) {
    const key = seat.team || seat.car;
    groups.set(key, [...(groups.get(key) || []), seat]);
  }
  return { seats, groups: [...groups].map(([name, members]) => ({ name, members })) };
}
