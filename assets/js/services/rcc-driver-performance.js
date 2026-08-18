(() => {
  if (window.RCCDriverPerformance) return;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const num = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const validPosition = (value) => window.RCCDriverStats?.validPosition?.(value) ?? (() => {
    const parsed = num(value, null);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  })();

  function raceSortValue(race, history) {
    const season = history?.seasonsById?.get(String(race?.season_id || ''));
    const seasonDate = Date.parse(season?.start_date || season?.created_at || 0) || 0;
    const raceDate = Date.parse(race?.race_date || race?.race_start_at || race?.weekend_start_date || 0) || 0;
    return seasonDate * 1000 + raceDate + Number(race?.round_number || 0);
  }

  function awardedPoints(row, fastestDriverId) {
    if (window.RCCDriverStats?.getAwardedPoints) {
      return Number(window.RCCDriverStats.getAwardedPoints(row, fastestDriverId) || 0);
    }
    return Number(row?.awarded_points ?? row?.points ?? row?.base_points ?? 0) || 0;
  }

  function resultPercentile(position, fieldSize) {
    const pos = validPosition(position);
    if (!Number.isFinite(pos) || fieldSize < 1) return null;
    if (fieldSize === 1) return 1;
    return clamp(1 - ((pos - 1) / (fieldSize - 1)));
  }

  function scoreEntry(entry, history) {
    const rows = history.resultsByRace.get(String(entry.race.id)) || [];
    const uniqueDrivers = new Set(rows.map((row) => String(row.driver_id || '')).filter(Boolean));
    const fieldSize = Math.max(uniqueDrivers.size, rows.length, 1);
    const fastestDriverId = history.fastestByRace.get(String(entry.race.id));
    const finish = validPosition(entry.row.finish_position);
    const grid = validPosition(entry.row.grid_position);
    const finishScore = Number.isFinite(finish) ? resultPercentile(finish, fieldSize) : 0;
    const qualifyingScore = Number.isFinite(grid) ? resultPercentile(grid, fieldSize) : null;
    const driverPoints = awardedPoints(entry.row, fastestDriverId);
    const maxPoints = rows.reduce((max, row) => Math.max(max, awardedPoints(row, fastestDriverId)), 0);
    const pointsScore = maxPoints > 0 ? clamp(driverPoints / maxPoints) : null;
    const gain = Number.isFinite(grid) && Number.isFinite(finish) ? grid - finish : null;
    const gainScale = Math.max(5, fieldSize / 2);
    const racecraftScore = Number.isFinite(gain) ? clamp(0.5 + (gain / (gainScale * 2))) : null;
    const reliabilityScore = Number.isFinite(finish) ? 1 : 0;

    const parts = [
      ['finish', finishScore, 0.40],
      ['qualifying', qualifyingScore, 0.20],
      ['points', pointsScore, 0.20],
      ['racecraft', racecraftScore, 0.10],
      ['reliability', reliabilityScore, 0.10]
    ].filter(([, value]) => Number.isFinite(value));
    const weightTotal = parts.reduce((sum, [, , weight]) => sum + weight, 0) || 1;
    const score = parts.reduce((sum, [, value, weight]) => sum + value * weight, 0) / weightTotal;

    return {
      ...entry,
      fieldSize,
      finish,
      grid,
      points: driverPoints,
      gain,
      score: score * 100,
      components: {
        finish: finishScore,
        qualifying: qualifyingScore,
        points: pointsScore,
        racecraft: racecraftScore,
        reliability: reliabilityScore
      }
    };
  }

  function weightedAverage(entries, selector) {
    if (!entries.length) return null;
    let weighted = 0;
    let weights = 0;
    entries.forEach((entry, index) => {
      const value = selector(entry);
      if (!Number.isFinite(value)) return;
      const weight = Math.max(0.6, 1 - (index * 0.1));
      weighted += value * weight;
      weights += weight;
    });
    return weights ? weighted / weights : null;
  }

  function summarizeWindow(entries) {
    const newestFirst = [...entries].reverse();
    const score = weightedAverage(newestFirst, (entry) => entry.score);
    const component = (key) => {
      const value = weightedAverage(newestFirst, (entry) => {
        const raw = entry.components[key];
        return Number.isFinite(raw) ? raw * 100 : null;
      });
      return Number.isFinite(value) ? Math.round(value) : null;
    };
    return {
      starts: entries.length,
      score: Number.isFinite(score) ? Math.round(score) : null,
      components: {
        finish: component('finish'),
        qualifying: component('qualifying'),
        points: component('points'),
        racecraft: component('racecraft'),
        reliability: component('reliability')
      }
    };
  }

  function labelFor(score) {
    if (!Number.isFinite(score)) return 'Noch ohne Rating';
    if (score >= 85) return 'Topform';
    if (score >= 72) return 'Stark';
    if (score >= 60) return 'Solide';
    if (score >= 48) return 'Wechselhaft';
    return 'Aufbau';
  }

  function calculate(driverId, history, options = {}) {
    const id = String(driverId || '');
    if (!id || !history?.driversById?.has(id)) return null;
    const races = (history.completedRaces || [])
      .filter((race) => !options.seasonId || String(race.season_id) === String(options.seasonId))
      .sort((a, b) => raceSortValue(a, history) - raceSortValue(b, history));

    const entries = races.map((race) => {
      const rows = history.resultsByRace.get(String(race.id)) || [];
      const row = rows.find((candidate) => String(candidate.driver_id || '') === id);
      return row ? { race, row } : null;
    }).filter(Boolean).map((entry) => scoreEntry(entry, history));

    const currentEntries = entries.slice(-5);
    const previousEntries = entries.slice(-10, -5);
    const current = summarizeWindow(currentEntries);
    const previous = summarizeWindow(previousEntries);
    const trend = Number.isFinite(current.score) && Number.isFinite(previous.score)
      ? current.score - previous.score
      : null;

    return {
      score: current.score,
      label: labelFor(current.score),
      trend,
      sampleSize: current.starts,
      previousSampleSize: previous.starts,
      components: current.components,
      currentEntries: [...currentEntries].reverse(),
      methodology: {
        finish: 40,
        qualifying: 20,
        points: 20,
        racecraft: 10,
        reliability: 10,
        maxStarts: 5
      }
    };
  }

  window.RCCDriverPerformance = { calculate, labelFor };
})();
