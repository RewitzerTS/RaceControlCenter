function getTrendIcon(currentPos, previousPos, hasPreviousRace = false) {
  if (!hasPreviousRace) return '<span class="trend-pill flat">↔</span>';
  if (!Number.isFinite(previousPos)) return '<span class="trend-pill up">↑</span>';
  if (currentPos < previousPos) return '<span class="trend-pill up">↑</span>';
  if (currentPos > previousPos) return '<span class="trend-pill down">↓</span>';
  return '<span class="trend-pill flat">↔</span>';
}

function withDriverTrends(current, previous, hasPreviousRace = false) {
  const previousPositions = new Map(previous.map((entry, index) => [entry.driverId, index + 1]));
  return current.map((entry, index) => ({
    ...entry,
    trend: getTrendIcon(index + 1, previousPositions.get(entry.driverId), hasPreviousRace)
  }));
}

function withTeamTrends(current, previous, hasPreviousRace = false) {
  const previousPositions = new Map(previous.map((entry, index) => [entry.teamName, index + 1]));
  return current.map((entry, index) => ({
    ...entry,
    trend: getTrendIcon(index + 1, previousPositions.get(entry.teamName), hasPreviousRace)
  }));
}

function renderDriverStandings(standings) {
  const tbody = document.getElementById('drivers-standings-body');
  if (!tbody) return;

  if (!standings.length) {
    tbody.innerHTML = '<tr><td colspan="9">Noch keine Fahrerdaten vorhanden.</td></tr>';
    return;
  }

  tbody.innerHTML = standings.map((entry, index) => `
    <tr class="${index < 3 ? `podium-${index + 1}` : ''}">
      <td>${index + 1}</td>
      <td class="trend-cell">${entry.trend}</td>
      <td>${window.escapeHtml(entry.driverName)}</td>
      <td>${window.createTeamLogoBadge?.(
    window.findMatchingTeamLogoName?.([entry.leagueTeam, entry.carName]) || entry.leagueTeam || entry.carName || '',
    { size: 'large', label: entry.leagueTeam || entry.carName || 'Team' }
  ) || window.escapeHtml(entry.leagueTeam || '—')}</td>
      <td>${window.createTeamLogoBadge?.(
    window.findMatchingTeamLogoName?.([entry.carName, entry.leagueTeam]) || entry.carName || entry.leagueTeam || '',
    { size: 'large', label: entry.carName || entry.leagueTeam || 'Auto' }
  ) || window.escapeHtml(entry.carName || entry.leagueTeam || '—')}</td>
      <td>${entry.wins ?? 0}</td>
      <td>${entry.podiums ?? 0}</td>
      <td>${entry.fastestLaps ?? 0}</td>
      <td><strong>${entry.points ?? 0}</strong></td>
    </tr>
  `).join('');
}

function renderTeamStandings(standings) {
  const tbody = document.getElementById('teams-standings-body');
  if (!tbody) return;

  if (!standings.length) {
    tbody.innerHTML = '<tr><td colspan="8">Noch keine Teamdaten vorhanden.</td></tr>';
    return;
  }

  tbody.innerHTML = standings.map((entry, index) => `
    <tr class="${index < 3 ? `podium-${index + 1}` : ''}">
      <td>${index + 1}</td>
      <td class="trend-cell">${entry.trend}</td>
      <td>${window.createTeamLogoBadge?.(
    window.findMatchingTeamLogoName?.([entry.teamName, entry.car1, entry.car2]) || entry.teamName || entry.car1 || entry.car2 || '',
    { size: 'large', label: entry.teamName || 'Team' }
  ) || window.escapeHtml(entry.teamName || '—')}</td>
      <td>${window.escapeHtml(entry.driver1 || '—')}</td>
      <td>${window.createTeamLogoBadge?.(
    window.findMatchingTeamLogoName?.([entry.car1, entry.teamName]) || entry.car1 || entry.teamName || '',
    { size: 'large', label: entry.car1 || entry.teamName || 'Auto 1' }
  ) || window.escapeHtml(entry.car1 || entry.teamName || '—')}</td>
      <td>${window.escapeHtml(entry.driver2 || '—')}</td>
      <td>${window.createTeamLogoBadge?.(
    window.findMatchingTeamLogoName?.([entry.car2, entry.teamName]) || entry.car2 || entry.teamName || '',
    { size: 'large', label: entry.car2 || entry.teamName || 'Auto 2' }
  ) || window.escapeHtml(entry.car2 || entry.teamName || '—')}</td>
      <td><strong>${entry.points ?? 0}</strong></td>
    </tr>
  `).join('');
}

function updateStandingsMeta(currentSeason, driverCount, teamCount) {
  const subtitles = document.querySelectorAll('.page-subtitle');
  const seasonLabel = currentSeason?.name ? `Saison ${currentSeason.name}` : 'Alle verfügbaren Daten';

  if (subtitles[0]) {
    subtitles[0].textContent = `${seasonLabel} · automatische Wertung aus den veröffentlichten Rennergebnissen.`;
  }

  if (subtitles[1]) {
    subtitles[1].textContent = `${seasonLabel} · automatische Wertung aus den veröffentlichten Rennergebnissen.`;
  }

  const tableHeaders = document.querySelectorAll('.table-header .muted');
  if (tableHeaders[0]) tableHeaders[0].textContent = `${driverCount} Fahrer`;
  if (tableHeaders[1]) tableHeaders[1].textContent = `${teamCount} Teams`;
}

async function loadStandingsPage() {
  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();

    const [drivers, races, raceResults, assignments] = await Promise.all([
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: currentSeason?.id }),
      window.RCCData.fetchRaceResults(),
      window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: currentSeason?.id })
    ]);

    const completedRaces = (races || [])
      .filter((race) => race.status === 'completed')
      .sort((a, b) => a.round_number - b.round_number);

    const resolver = window.RCCDriverContext.createAssignmentResolver({
      drivers,
      races,
      assignments
    });

    const currentStandings = window.RCCData.buildStandings({
      drivers,
      races: completedRaces,
      raceResults,
      resolver
    });

    const previousRaces = completedRaces.slice(0, -1);

    const previousStandings = window.RCCData.buildStandings({
      drivers,
      races: previousRaces,
      raceResults,
      resolver
    });

    const hasPreviousRace = previousRaces.length > 0;

    const driverStandings = withDriverTrends(
      currentStandings.driverStandings || [],
      previousStandings.driverStandings || [],
      hasPreviousRace
    );

    const teamStandings = withTeamTrends(
      currentStandings.teamStandings || [],
      previousStandings.teamStandings || [],
      hasPreviousRace
    );

    renderDriverStandings(driverStandings);
    renderTeamStandings(teamStandings);
    updateStandingsMeta(currentSeason, driverStandings.length, teamStandings.length);
  } catch (error) {
    console.error(error);

    const driverBody = document.getElementById('drivers-standings-body');
    const teamBody = document.getElementById('teams-standings-body');

    if (driverBody) {
      driverBody.innerHTML = '<tr><td colspan="9">Fehler beim Laden der Fahrer-WM.</td></tr>';
    }

    if (teamBody) {
      teamBody.innerHTML = '<tr><td colspan="8">Fehler beim Laden der Team-WM.</td></tr>';
    }
  }
}

document.addEventListener('DOMContentLoaded', loadStandingsPage);
