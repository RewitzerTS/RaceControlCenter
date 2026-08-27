(function setupGridRoster(global) {
  function normalizeParticipantType(value) {
    return String(value || '').trim().toUpperCase() === 'PLAYER' ? 'PLAYER' : 'BOT';
  }

  function normalizeNumber(value, fallback = null) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 99 ? number : fallback;
  }

  function buildSeasonGrid({ assignments = [], drivers = [] } = {}) {
    const driversById = new Map((drivers || []).map((driver) => [String(driver.id), driver]));
    const seenSeats = new Set();

    return (assignments || [])
      .map((assignment, index) => {
        const driver = driversById.get(String(assignment?.driver_id || '')) || {};
        const participantType = normalizeParticipantType(assignment?.participant_type);
        const seatCode = String(assignment?.seat_code || assignment?.id || `seat-${index}`).trim();
        const aiDriverName = String(assignment?.ai_driver_name || assignment?.ai_driver_reference || driver.ai_driver_reference || '').trim();
        const gamertag = String(assignment?.gamertag_snapshot || driver.gamertag || '').trim();
        const displayName = String(
          participantType === 'PLAYER'
            ? driver.display_name || gamertag || aiDriverName
            : aiDriverName || driver.display_name
        ).trim() || 'Unbesetzter Sitz';

        return {
          ...driver,
          assignment_id: assignment?.id || null,
          id: assignment?.driver_id || driver.id || seatCode,
          seat_code: seatCode,
          display_name: displayName,
          gamertag,
          participant_type: participantType,
          ai_driver_name: aiDriverName,
          ai_driver_reference: aiDriverName || driver.ai_driver_reference || '',
          league_team: String(assignment?.team_name || assignment?.league_team || driver.league_team || '').trim() || 'Ohne Team',
          car_name: String(assignment?.car_name || driver.car_name || '').trim(),
          number: normalizeNumber(assignment?.number, normalizeNumber(driver.number)),
          roster_order: index
        };
      })
      .filter((seat) => {
        if (seenSeats.has(seat.seat_code)) return false;
        seenSeats.add(seat.seat_code);
        return true;
      })
      .sort((left, right) => {
        const teamOrder = left.league_team.localeCompare(right.league_team, 'de', { sensitivity: 'base' });
        if (teamOrder !== 0) return teamOrder;
        const leftNumber = left.number ?? Number.MAX_SAFE_INTEGER;
        const rightNumber = right.number ?? Number.MAX_SAFE_INTEGER;
        if (leftNumber !== rightNumber) return leftNumber - rightNumber;
        return left.roster_order - right.roster_order;
      });
  }

  function summarizeSeasonGrid(grid = []) {
    return (grid || []).reduce((summary, seat) => {
      summary.seats += 1;
      if (seat.participant_type === 'PLAYER') summary.players += 1;
      else summary.bots += 1;
      return summary;
    }, { seats: 0, players: 0, bots: 0 });
  }

  global.RCCGridRoster = Object.freeze({
    buildSeasonGrid,
    normalizeParticipantType,
    summarizeSeasonGrid
  });
})(window);
