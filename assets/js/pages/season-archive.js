function getArchiveSeasonParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('season') || '';
}

function updateArchiveUrlSeason(seasonId) {
  const nextUrl = new URL(window.location.href);
  if (seasonId) nextUrl.searchParams.set('season', seasonId);
  else nextUrl.searchParams.delete('season');
  window.history.replaceState({}, '', nextUrl.toString());
}

function buildResultRows(results, resolver, fastestDriverId, raceId) {
  if (!results.length) return '<tr><td colspan="9">Noch keine Ergebnisse importiert.</td></tr>';

  return results.map((row) => {
    const snapshot = resolver.resolveDriverSnapshot(row.driver_id, raceId) || {};
    const hasFastestLap = row.driver_id === fastestDriverId;
    const hasFastestLapBonus = hasFastestLap && window.RCCData.isTopTen(row.finish_position);
    const points = window.RCCData.getAwardedRacePoints(row, fastestDriverId);
    const statusText = String(row.participation_status || '').trim().toUpperCase();
    const statusChipClass = statusText === 'BOT' ? 'bot' : 'player';

    return `
      <tr>
        <td>${row.finish_position ?? '—'}</td>
        <td>${window.escapeHtml(snapshot.display_name || 'Unbekannt')}</td>
        <td>${window.escapeHtml(snapshot.league_team || 'Ohne Team')}</td>
        <td>${row.grid_position ?? '—'}</td>
        <td>${row.finish_position ?? '—'}</td>
        <td>${hasFastestLap ? `<span class="fastest-lap-value">${window.escapeHtml(row.fastest_lap_time || '—')}</span>` : window.escapeHtml(row.fastest_lap_time || '—')}</td>
        <td>${window.escapeHtml(row.race_time || '—')}</td>
        <td><strong class="${hasFastestLap ? 'fastest-lap-points' : ''}">${points}</strong>${hasFastestLapBonus ? '<span class="fastest-lap-bonus">+FL</span>' : ''}</td>
        <td><span class="status-chip ${statusChipClass}">${window.escapeHtml(statusText || 'PLAYER')}</span></td>
      </tr>
    `;
  }).join('');
}

function renderArchiveRaces(container, races, season, resultsByRace, resolver) {
  if (!container) return;
  if (!races.length) {
    container.innerHTML = '<section class="panel"><div class="notice">Für diese Saison sind keine Rennen hinterlegt.</div></section>';
    return;
  }

  container.innerHTML = races.map((race) => {
    const { track } = window.getRaceTrackMeta(race);
    const raceResults = resultsByRace.get(race.id) || [];
    const fastestDriverId = window.RCCData.getFastestLapDriverId(raceResults);
    const detailLink = `rennen-detail.html?round=${encodeURIComponent(race.round_number)}&season=${encodeURIComponent(race.season_id || season.id)}`;

    return `
      <section class="table-card archive-race-card">
        <div class="table-header">
          <h2>R${race.round_number} · ${window.escapeHtml(race.grand_prix_name || 'Grand Prix')}</h2>
          <a class="btn" href="${detailLink}">Strecke / Renn-Detail öffnen</a>
        </div>
        <div class="archive-race-meta">
          <span>${window.escapeHtml(race.circuit_name || track?.circuitName || 'Strecke offen')}</span>
          <span>${window.escapeHtml(window.formatRaceDateTime(race))}</span>
          <span>Status: ${window.escapeHtml(window.formatStatusLabel(race.status))}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Pos</th><th>Fahrer</th><th>Team</th><th>Start</th><th>Ziel</th><th>Schnellste Runde</th><th>Gesamtrennzeit</th><th>Punkte</th><th>Status</th></tr></thead>
            <tbody>${buildResultRows(raceResults, resolver, fastestDriverId, race.id)}</tbody>
          </table>
        </div>
      </section>
    `;
  }).join('');
}

async function loadArchivePage() {
  const titleEl = document.getElementById('archive-title');
  const subtitleEl = document.getElementById('archive-subtitle');
  const selectEl = document.getElementById('archive-season-select-page');
  const resultsContainer = document.getElementById('archive-race-results');

  if (!selectEl || !resultsContainer) return;

  try {
    const seasons = await window.RCCData.fetchSeasons({ archivedOnly: true });
    if (!seasons.length) {
      titleEl.textContent = 'Saison-Archiv leer';
      subtitleEl.textContent = 'Noch keine abgeschlossene Saison vorhanden.';
      selectEl.innerHTML = '<option value="">Keine Saison verfügbar</option>';
      resultsContainer.innerHTML = '<section class="panel"><div class="notice">Sobald eine Saison abgeschlossen wird, erscheint sie im Archiv.</div></section>';
      return;
    }

    const selectedSeasonId = getArchiveSeasonParam();
    const fallbackSeason = seasons[0];
    const selectedSeason = seasons.find((season) => String(season.id) === String(selectedSeasonId)) || fallbackSeason;

    selectEl.innerHTML = seasons
      .map((season) => `<option value="${window.escapeHtml(String(season.id))}" ${String(season.id) === String(selectedSeason.id) ? 'selected' : ''}>${window.escapeHtml(season.name || `Saison ${season.id}`)}</option>`)
      .join('');

    updateArchiveUrlSeason(String(selectedSeason.id));

    const [drivers, races, raceResults, assignments] = await Promise.all([
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: selectedSeason.id }),
      window.RCCData.fetchRaceResults(),
      window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: selectedSeason.id })
    ]);

    const sortedRaces = races.slice().sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));
    const raceIds = new Set(sortedRaces.map((race) => race.id));
    const scopedResults = raceResults.filter((entry) => raceIds.has(entry.race_id));
    const resultsByRace = window.RCCData.groupBy(scopedResults, (entry) => entry.race_id);
    const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races: sortedRaces, assignments });

    titleEl.textContent = `${selectedSeason.name || `Saison ${selectedSeason.id}`} · Archiv`;
    subtitleEl.textContent = `${sortedRaces.length} Rennen mit kompletter Ergebnistabelle und Direktlink zur Strecken-/Renn-Detailseite.`;
    renderArchiveRaces(resultsContainer, sortedRaces, selectedSeason, resultsByRace, resolver);

    selectEl.addEventListener('change', () => {
      const nextSeason = selectEl.value;
      window.location.href = `saison-archiv.html?season=${encodeURIComponent(nextSeason)}`;
    });
  } catch (error) {
    console.error(error);
    resultsContainer.innerHTML = '<section class="panel"><div class="notice">Fehler beim Laden des Archivs.</div></section>';
  }
}

document.addEventListener('DOMContentLoaded', loadArchivePage);
