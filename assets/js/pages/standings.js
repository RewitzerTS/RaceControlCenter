async function loadStandings() {
  if (!window.supabaseClient) return;

  const tableBody = document.querySelector('[data-standings-body]');
  const pageTitle = document.querySelector('[data-standings-title]');
  const pageMeta = document.querySelector('[data-standings-meta]');

  const isTeamPage = location.pathname.includes('team-wm');
  if (pageTitle) pageTitle.textContent = isTeamPage ? 'Team-WM' : 'Fahrer-WM';

  const [{ data: season, error: seasonError }, { data: rows, error: resultsError }] = await Promise.all([
    window.supabaseClient.from('seasons').select('id, name, is_active').eq('is_active', true).maybeSingle(),
    window.supabaseClient
      .from('race_results')
      .select('awarded_points, driver_id, drivers(display_name, league_team)')
  ]);

  if (seasonError) console.error(seasonError);
  if (resultsError) {
    console.error(resultsError);
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="4">Fehler beim Laden der WM.</td></tr>';
    return;
  }

  if (pageMeta) pageMeta.textContent = season?.name ? `Aktive Saison ${season.name}` : 'Laufende Saison';

  const map = new Map();

  (rows || []).forEach((row) => {
    const key = isTeamPage ? (row.drivers?.league_team || 'Ohne Team') : (row.drivers?.display_name || 'Unbekannt');
    if (!map.has(key)) {
      map.set(key, { name: key, points: 0 });
    }
    map.get(key).points += Number(row.awarded_points || 0);
  });

  const items = [...map.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'de'));

  if (!tableBody) return;
  if (!items.length) {
    tableBody.innerHTML = '<tr><td colspan="4">Noch keine WM-Daten vorhanden.</td></tr>';
    return;
  }

  tableBody.innerHTML = items.map((entry, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${entry.name}</td>
      <td>${entry.points}</td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadStandings);
