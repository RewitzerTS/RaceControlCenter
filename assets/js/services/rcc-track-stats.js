(() => {
  if (window.RCCTrackStats) return;

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const validPosition = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  function parseLapTime(value) {
    const raw = String(value || '').trim().replace(',', '.');
    if (!raw || raw === '—') return null;
    const parts = raw.split(':').map((part) => part.trim());
    if (!parts.length || parts.length > 3) return null;
    const seconds = Number(parts.at(-1));
    if (!Number.isFinite(seconds)) return null;
    const minutes = parts.length >= 2 ? Number(parts.at(-2)) : 0;
    const hours = parts.length === 3 ? Number(parts[0]) : 0;
    if (!Number.isFinite(minutes) || !Number.isFinite(hours)) return null;
    return Math.round(((hours * 3600) + (minutes * 60) + seconds) * 1000);
  }

  function trackMetaForRace(race) {
    const meta = window.getRaceTrackMeta?.(race) || {};
    const track = meta.track || null;
    return {
      key: String(track?.key || normalize(race?.circuit_name || race?.grand_prix_name || '')),
      grandPrixName: track?.grandPrixName || race?.grand_prix_name || 'Grand Prix',
      circuitName: race?.circuit_name || track?.circuitName || 'Unbekannte Strecke',
      countryCode: track?.countryCode || '',
      track
    };
  }

  function listTracks(history, options = {}) {
    const seasonId = options.seasonId ? String(options.seasonId) : '';
    const map = new Map();
    (history.completedRaces || []).forEach((race) => {
      if (seasonId && String(race.season_id || '') !== seasonId) return;
      const meta = trackMetaForRace(race);
      if (!meta.key) return;
      if (!map.has(meta.key)) map.set(meta.key, { ...meta, races: 0, latestRace: null });
      const entry = map.get(meta.key);
      entry.races += 1;
      entry.latestRace = race;
    });
    return [...map.values()].sort((a, b) => a.grandPrixName.localeCompare(b.grandPrixName, 'de'));
  }

  function raceMatchesTrack(race, trackKey) {
    return trackMetaForRace(race).key === String(trackKey || '');
  }

  function calculateTrackStats(trackKey, history, options = {}) {
    const key = String(trackKey || '');
    const seasonId = options.seasonId ? String(options.seasonId) : '';
    const races = (history.completedRaces || []).filter((race) => {
      if (seasonId && String(race.season_id || '') !== seasonId) return false;
      return raceMatchesTrack(race, key);
    });
    if (!races.length) return null;

    const meta = trackMetaForRace(races.at(-1));
    const drivers = new Map();
    let starts = 0;
    let bestLap = null;
    const raceHistory = [];

    const bucketFor = (driverId, snapshot) => {
      const id = String(driverId || '');
      if (!drivers.has(id)) {
        drivers.set(id, {
          driverId: id,
          name: snapshot?.display_name || history.driversById.get(id)?.display_name || 'Unbekannt',
          starts: 0,
          wins: 0,
          podiums: 0,
          poles: 0,
          fastestLaps: 0,
          points: 0,
          bestFinish: null,
          bestLap: null
        });
      }
      return drivers.get(id);
    };

    races.forEach((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const fastestId = String(history.fastestByRace.get(String(race.id)) || '');
      let winner = null;
      rows.forEach((row) => {
        const driverId = String(row.driver_id || '');
        if (!driverId) return;
        const snapshot = window.RCCDriverStats.driverDisplaySnapshot(history, driverId, race.id) || {};
        const bucket = bucketFor(driverId, snapshot);
        const finish = validPosition(row.finish_position);
        const grid = validPosition(row.grid_position);
        const lapMs = parseLapTime(row.fastest_lap_time);
        bucket.starts += 1;
        starts += 1;
        if (finish === 1) { bucket.wins += 1; winner = { driverId, name: bucket.name }; }
        if (Number.isFinite(finish) && finish <= 3) bucket.podiums += 1;
        if (grid === 1) bucket.poles += 1;
        if (driverId === fastestId) bucket.fastestLaps += 1;
        if (Number.isFinite(finish)) bucket.bestFinish = bucket.bestFinish === null ? finish : Math.min(bucket.bestFinish, finish);
        if (String(row.points_owner_driver_id || row.driver_id || '') === driverId) {
          bucket.points += window.RCCDriverStats.getAwardedPoints(row, fastestId);
        }
        if (Number.isFinite(lapMs) && (!bucket.bestLap || lapMs < bucket.bestLap.ms)) bucket.bestLap = { ms: lapMs, text: row.fastest_lap_time, race };
        if (Number.isFinite(lapMs) && (!bestLap || lapMs < bestLap.ms)) bestLap = { ms: lapMs, text: row.fastest_lap_time, driverId, driverName: bucket.name, race };
      });
      raceHistory.push({
        race,
        season: history.seasonsById.get(String(race.season_id || '')) || null,
        winner,
        fastestDriverId: fastestId || null
      });
    });

    const driverRecords = [...drivers.values()].sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.points - a.points || a.name.localeCompare(b.name, 'de'));
    const leaders = {
      wins: [...driverRecords].sort((a, b) => b.wins - a.wins || b.points - a.points)[0] || null,
      podiums: [...driverRecords].sort((a, b) => b.podiums - a.podiums || b.wins - a.wins)[0] || null,
      poles: [...driverRecords].sort((a, b) => b.poles - a.poles || b.wins - a.wins)[0] || null,
      fastestLaps: [...driverRecords].sort((a, b) => b.fastestLaps - a.fastestLaps || b.wins - a.wins)[0] || null,
      points: [...driverRecords].sort((a, b) => b.points - a.points || b.wins - a.wins)[0] || null,
      starts: [...driverRecords].sort((a, b) => b.starts - a.starts || b.points - a.points)[0] || null
    };

    return {
      key,
      meta,
      races: races.length,
      starts,
      uniqueDrivers: drivers.size,
      bestLap,
      driverRecords,
      leaders,
      raceHistory: raceHistory.reverse()
    };
  }

  window.RCCTrackStats = { normalize, parseLapTime, trackMetaForRace, listTracks, calculateTrackStats };
})();
