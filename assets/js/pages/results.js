function formatFastestLapCell(value, isFastest) {
  const safe = String(value ?? '').trim();
  if (!safe) return '—';
  return isFastest ? `<span class="lap-chip">${safe}</span>` : safe;
}

function formatParticipationCell(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'bot') return '<span class="bot-time">BOT</span>';
  if (normalized === 'player') return 'PLAYER';
  return value || '—';
}

async function loadResultsPage() {
  const listRoot = document.querySelector('[data-results-root]');
  const legendRoot = document.querySelector('[data-results-legend]');
  if (!window.supabaseClient || !listRoot) return;

  const [{ data: season }, { data: races, error: racesError }, { data: rows, error: resultsError }] = await Promise.all([
    window.supabaseClient.from('seasons').select('id, name').eq('is_active', true).maybeSingle(),
    window.supabaseClient.from('races').select('id, grand_prix_name, round_number').order('round_number', { ascending: true }),
    window.supabaseClient
      .from('race_results')
      .select('race_id, finish_position, awarded_points, fastest_lap_time, participation_status, drivers(display_name, league_team)')
  ]);

  if (racesError || resultsError) {
    console.error(racesError || resultsError);
    listRoot.innerHTML = '<div class="notice">Ergebnisse konnten nicht geladen werden.</div>';
    return;
  }

  if (legendRoot) {
    legendRoot.innerHTML = `
      <span class="legend-chip lap-chip">Fastest Lap</span>
      <span class="legend-chip"><span class="bot-time">BOT</span> = BOT gefahren</span>
      <span class="legend-chip">${season?.name ? `Saison ${season.name}` : 'Laufende Saison'}</span>
    `;
  }

  const rowsByRace = new Map();
  (rows || []).forEach((row) => {
    if (!rowsByRace.has(row.race_id)) rowsByRace.set(row.race_id, []);
    rowsByRace.get(row.race_id).push(row);
  });

  listRoot.innerHTML = (races || []).map((race) => {
    const resultRows = rowsByRace.get(race.id) || [];
    if (!resultRows.length) return `
      <section class="panel">
        <h3>${race.grand_prix_name}</h3>
        <div class="notice">Noch keine Ergebnisse vorhanden.</div>
      </section>
    `;

    let fastestLapDriver = null;
    const lapRows = resultRows.filter((row) => row.fastest_lap_time);
    if (lapRows.length) {
      fastestLapDriver = [...lapRows].sort((a,b) => String(a.fastest_lap_time).localeCompare(String(b.fastest_lap_time), 'de'))[0]?.drivers?.display_name || null;
    }

    const sorted = [...resultRows].sort((a,b) => Number(a.finish_position || 999) - Number(b.finish_position || 999));
    return `
      <section class="panel">
        <h3>${race.round_number ? `${race.round_number}. ` : ''}${race.grand_prix_name}</h3>
        <div class="table-wrap">
          <table class="results-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Fahrer</th>
                <th>Team</th>
                <th>Schnellste Runde</th>
                <th>Punkte</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((row) => `
                <tr>
                  <td>${row.finish_position ?? '—'}</td>
                  <td>${row.drivers?.display_name || '—'}</td>
                  <td>${row.drivers?.league_team || '—'}</td>
                  <td>${formatFastestLapCell(row.fastest_lap_time, row.drivers?.display_name === fastestLapDriver)}</td>
                  <td><span class="points-value">${row.awarded_points ?? 0}</span></td>
                  <td>${formatParticipationCell(row.participation_status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', loadResultsPage);
