global.window = {};

const driver1 = { id: 'd1', display_name: 'Driver One' };
const driver2 = { id: 'd2', display_name: 'Driver Two' };
window.RCCDriverStats = {
  validPosition(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  },
  getAwardedPoints(row) { return Number(row.points || 0); },
  driverDisplaySnapshot(history, id) { return history.driversById.get(String(id)); },
  calculateDriverStats(id) {
    return id === 'd1'
      ? { driver: driver1, starts: 5, wins: 3, podiums: 4, poles: 1, fastestLaps: 1, points: 90, avgFinish: 2.2, finishRate: 1, positionsGained: 12 }
      : { driver: driver2, starts: 5, wins: 1, podiums: 1, poles: 2, fastestLaps: 2, points: 45, avgFinish: 5.0, finishRate: 1, positionsGained: 2 };
  }
};
window.RCCTeamStats = {
  calculateAllTeamStats() {
    return [
      { teamName: 'Team One', races: 5, starts: 10, wins: 3, podiums: 5, poles: 2, fastestLaps: 2, points: 155 },
      { teamName: 'Team Two', races: 5, starts: 10, wins: 1, podiums: 3, poles: 1, fastestLaps: 1, points: 100 }
    ];
  }
};

require('../assets/js/services/rcc-records.js');

const completedRaces = [];
const resultsByRace = new Map();
const fastestByRace = new Map();
for (let i = 1; i <= 5; i += 1) {
  const race = { id: `r${i}`, season_id: 's1', round_number: i, grand_prix_name: `Race ${i}`, circuit_name: i <= 3 ? 'Track A' : 'Track B' };
  completedRaces.push(race);
  const d1Finish = i <= 3 ? 1 : (i === 4 ? 2 : 4);
  const d1Grid = i === 1 ? 10 : Math.min(8, d1Finish + 2);
  resultsByRace.set(race.id, [
    { driver_id: 'd1', grid_position: d1Grid, finish_position: d1Finish, points: d1Finish === 1 ? 25 : 12 },
    { driver_id: 'd2', grid_position: 2, finish_position: i === 4 ? 1 : 6, points: i === 4 ? 25 : 4 }
  ]);
  fastestByRace.set(race.id, i % 2 ? 'd1' : 'd2');
}
const history = {
  completedRaces,
  resultsByRace,
  fastestByRace,
  drivers: [driver1, driver2],
  driversById: new Map([['d1', driver1], ['d2', driver2]])
};
const records = window.RCCRecords.calculate(history, {});
if (records.raceCount !== 5) throw new Error(`raceCount=${records.raceCount}`);
if (records.specials.comeback?.gain !== 9) throw new Error(`comeback=${records.specials.comeback?.gain}`);
if (records.specials.winStreak?.driver?.id !== 'd1' || records.specials.winStreak?.value !== 3) throw new Error('win streak incorrect');
if (records.specials.podiumStreak?.driver?.id !== 'd1' || records.specials.podiumStreak?.value !== 4) throw new Error('podium streak incorrect');
if (records.specials.specialist?.driver?.id !== 'd1' || records.specials.specialist?.wins !== 3) throw new Error('track specialist incorrect');
if (records.leaderboards.drivers.wins[0]?.driver?.id !== 'd1') throw new Error('driver wins leaderboard incorrect');
if (records.leaderboards.teams.points[0]?.teamName !== 'Team One') throw new Error('team points leaderboard incorrect');
console.log('Records formula smoke passed');
