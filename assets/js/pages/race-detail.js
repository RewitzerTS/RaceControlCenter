function extractIncidentMeta(description = '') {
  const lines = String(description || '').split(/\r?\n/);
  let driver1 = '';
  let driver2 = '';
  const detailLines = [];

  lines.forEach((line) => {
    if (line.startsWith('[Fahrer1] ')) driver1 = line.replace('[Fahrer1] ', '').trim();
    else if (line.startsWith('[Fahrer2] ')) driver2 = line.replace('[Fahrer2] ', '').trim();
    else detailLines.push(line);
  });

  return {
    driver1,
    driver2,
    description: detailLines.join('\n').trim()
  };
}

function renderStewardSection(stewardsEl, stewardEntries, stewardError) {
  if (!stewardsEl) return;

  if (stewardError) {
    const relationMissing = stewardError.code === 'PGRST205' || stewardError.code === '42P01';
    stewardsEl.innerHTML = `<div class="notice">${relationMissing ? 'Steward-Datenbank noch nicht eingerichtet.' : 'Fehler beim Laden der Steward-Einträge.'}</div>`;
    return;
  }

  if (!stewardEntries?.length) {
    stewardsEl.innerHTML = '<div class="notice">Noch kein Eintrag vorhanden</div>';
    return;
  }

  stewardsEl.innerHTML = stewardEntries.map((entry) => {
    const meta = extractIncidentMeta(entry.description);
    const driver1 = entry.driver1?.display_name || meta.driver1 || '—';
    const driver2 = entry.driver2?.display_name || meta.driver2 || '—';

    return `
      <div class="incident-item">
        <strong>${window.escapeHtml(entry.title || 'Steward-Fall')}</strong>
        <span class="muted">${window.escapeHtml(meta.description || 'Keine Beschreibung hinterlegt.')}</span>
        <span class="muted">Beteiligte: ${window.escapeHtml(driver1)} / ${window.escapeHtml(driver2)}</span>
        <span class="muted">Entscheidung: ${window.escapeHtml(entry.decision_text || '—')}</span>
        <span class="muted">Konsequenz: ${window.escapeHtml(entry.consequence || '—')}</span>
      </div>
    `;
  }).join('');
}

async function loadRaceDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const round = Number(params.get('round'));
  const seasonParam = params.get('season');
  const titleEl = document.getElementById('race-title');
  const subtitleEl = document.getElementById('race-subtitle');
  const infoEl = document.getElementById('race-info');
  const chipsEl = document.getElementById('race-chips');
  const stewardsEl = document.getElementById('stewards-info');
  const resultsBody = document.getElementById('results-body');

  if (!round) {
    titleEl.textContent = 'Kein Rennen ausgewählt';
    subtitleEl.textContent = 'Bitte öffne die Seite mit einer gültigen Rundennummer.';
    resultsBody.innerHTML = '<tr><td colspan="9">Keine Ergebnisse verfügbar.</td></tr>';
    return;
  }

  try {
    const currentSeason = seasonParam ? { id: seasonParam } : await window.RCCData.fetchCurrentSeason();
    let raceQuery = window.supabaseClient.from('races').select('*').eq('round_number', round);
    if (currentSeason?.id) raceQuery = raceQuery.eq('season_id', currentSeason.id);

    const { data: race, error: raceError } = await raceQuery.maybeSingle();
    if (raceError || !race) throw raceError || new Error('Race not found');

    const [drivers, seasonRaces, assignments, resultsResponse, stewardResponse] = await Promise.all([
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: race.season_id }),
      window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: race.season_id }),
      window.supabaseClient
        .from('race_results')
        .select('id, driver_id, finish_position, grid_position, fastest_lap_time, race_time, participation_status, awarded_points')
        .eq('race_id', race.id)
        .order('finish_position', { ascending: true }),
      window.supabaseClient
        .from('steward_cases')
        .select('title, description, decision_text, consequence, driver1:driver_1_id(display_name), driver2:driver_2_id(display_name), created_at')
        .eq('race_id', race.id)
        .order('created_at', { ascending: false })
    ]);

    if (resultsResponse.error) throw resultsResponse.error;

    const resolver = window.RCCDriverContext.createAssignmentResolver({
      drivers,
      races: seasonRaces,
      assignments
    });
    const results = resultsResponse.data || [];
    const fastestDriverId = window.RCCData.getFastestLapDriverId(results);
    const { track } = window.getRaceTrackMeta(race);
    const flagBadge = window.createFlagBadge(track?.countryCode, `${track?.grandPrixName || race.grand_prix_name} Flagge`);

    titleEl.innerHTML = `${flagBadge} <span>${window.escapeHtml(race.grand_prix_name)}</span>`;
    subtitleEl.textContent = `${race.circuit_name || track?.circuitName || 'Strecke offen'} · ${window.formatRaceDateTime(race)}`;

    infoEl.innerHTML = `
      <strong>Runde:</strong> ${race.round_number ?? '—'}<br>
      <strong>Termin:</strong> ${window.formatRaceDateTime(race)}<br>
      <strong>Strecke:</strong> ${window.escapeHtml(race.circuit_name || track?.circuitName || '—')}<br>
      <strong>Wetter:</strong> ${window.escapeHtml(window.formatWeatherLabel(race.weather))}<br>
      <strong>Status:</strong> ${window.escapeHtml(window.formatStatusLabel(race.status))}<br>
      <div class="detail-track-map">${window.createTrackMapSvg(track)}</div>
    `;

    chipsEl.innerHTML = `
      <span class="chip ${race.status === 'completed' ? 'success' : ''}">${race.status === 'completed' ? 'Ergebnis offiziell' : 'Anstehend'}</span>
      <span class="chip">${results.length || 0} Fahrer</span>
      ${race.season_id ? `<span class="chip">Saison ${window.escapeHtml(race.season_id)}</span>` : ''}
    `;

    renderStewardSection(stewardsEl, stewardResponse.data, stewardResponse.error);

    resultsBody.innerHTML = results.length
      ? results.map((row) => {
          const snapshot = resolver.resolveDriverSnapshot(row.driver_id, race.id) || {};
          const hasFastestLap = row.driver_id === fastestDriverId;
          const hasFastestLapBonus = hasFastestLap && window.RCCData.isTopTen(row.finish_position);
          const points = window.RCCData.getAwardedRacePoints(row, fastestDriverId);
          const fastestLapText = row.fastest_lap_time ? row.fastest_lap_time : '—';
          const statusText = String(row.participation_status || '').trim().toUpperCase();
          const statusChipClass = statusText === 'BOT' ? 'bot' : 'player';
          const statusLabel = statusText || 'PLAYER';

          return `
            <tr>
              <td>${row.finish_position ?? '—'}</td>
              <td>${window.escapeHtml(snapshot.display_name || 'Unbekannt')}</td>
              <td>${window.escapeHtml(snapshot.league_team || 'Ohne Team')}</td>
              <td>${row.grid_position ?? '—'}</td>
              <td>${row.finish_position ?? '—'}</td>
              <td>${hasFastestLap ? `<span class="fastest-lap-value">${window.escapeHtml(fastestLapText)}</span>` : window.escapeHtml(fastestLapText)}</td>
              <td>${window.escapeHtml(row.race_time || '—')}</td>
              <td><strong class="${hasFastestLap ? 'fastest-lap-points' : ''}">${points}</strong>${hasFastestLapBonus ? '<span class="fastest-lap-bonus">+FL</span>' : ''}</td>
              <td><span class="status-chip ${statusChipClass}">${window.escapeHtml(statusLabel)}</span></td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="9">Noch keine Ergebnisse importiert.</td></tr>';
  } catch (error) {
    console.error(error);
    titleEl.textContent = 'Rennen nicht gefunden';
    subtitleEl.textContent = 'Bitte überprüfe die URL oder den Rennkalender.';
    resultsBody.innerHTML = '<tr><td colspan="9">Fehler beim Laden der Renn-Details.</td></tr>';
    if (stewardsEl) stewardsEl.innerHTML = '<div class="notice">Steward-Daten konnten nicht geladen werden.</div>';
  }
}

document.addEventListener('DOMContentLoaded', loadRaceDetailPage);
