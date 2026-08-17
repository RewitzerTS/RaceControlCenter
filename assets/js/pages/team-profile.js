(() => {
  const state = { history: null, team: '', seasonId: '' };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
  const points = (value) => Number.isInteger(Number(value)) ? String(Number(value || 0)) : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(value || 0));

  function scopedHref(file, params = {}) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (state.team) url.searchParams.set('team', state.team);
    if (state.seasonId) url.searchParams.set('season', state.seasonId);
    else url.searchParams.delete('season');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function populate() {
    const options = { seasonId: state.seasonId || null };
    const withHistory = window.RCCTeamStats.calculateAllTeamStats(state.history, options)
      .filter((entry) => entry.races > 0)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.teamName.localeCompare(b.teamName, 'de'))
      .map((entry) => entry.teamName);
    const allTeams = window.RCCTeamStats.listTeams(state.history, options);
    const teams = [...withHistory, ...allTeams.filter((team) => !withHistory.some((name) => name === team))];
    const select = byId('team-profile-select');
    select.innerHTML = teams.map((team) => `<option value="${esc(team)}">${esc(team)}</option>`).join('');
    if (!teams.some((team) => team === state.team)) state.team = teams[0] || '';
    select.value = state.team;

    const seasons = [...state.history.seasons].sort((a, b) => (Date.parse(b.start_date || b.created_at || 0) || 0) - (Date.parse(a.start_date || a.created_at || 0) || 0));
    const seasonSelect = byId('team-profile-season');
    seasonSelect.innerHTML = '<option value="">Historie</option>' + seasons.map((season) => `<option value="${esc(season.id)}">${esc(season.name || season.slug || 'Saison')}</option>`).join('');
    if (state.seasonId && !state.history.seasonsById.has(String(state.seasonId))) state.seasonId = '';
    seasonSelect.value = state.seasonId;
  }

  function renderHero(stats) {
    byId('team-profile-name').textContent = stats.teamName;
    byId('team-profile-best').textContent = stats.bestFinish ? `P${stats.bestFinish}` : '—';
    byId('team-profile-cars').textContent = stats.cars.length ? stats.cars.map((car) => car.name).join(' · ') : 'Fahrzeuge noch nicht hinterlegt';
    const logoHost = byId('team-profile-logo');
    logoHost.innerHTML = window.createTeamLogoBadge?.(stats.cars[0]?.name || stats.teamName, { size: 'large', label: stats.teamName }) || `<strong>${esc(stats.teamName.slice(0, 2).toUpperCase())}</strong>`;
    document.title = `RaceVora · ${stats.teamName}`;
  }

  function renderStats(stats) {
    byId('team-stat-races').textContent = stats.races;
    byId('team-stat-starts').textContent = stats.starts;
    byId('team-stat-wins').textContent = stats.wins;
    byId('team-stat-podiums').textContent = stats.podiums;
    byId('team-stat-poles').textContent = stats.poles;
    byId('team-stat-points').textContent = points(stats.points);
  }

  function renderDrivers(stats) {
    const host = byId('team-profile-drivers');
    host.innerHTML = stats.drivers.length ? stats.drivers.map((driver) => `
      <div class="team-driver-item">
        <div><a href="${scopedHref('fahrer-profil.html', { driver: driver.driverId, season: state.seasonId || null })}"><strong>${esc(driver.name)}</strong></a><small>${driver.starts} Starts · ${driver.wins} Siege · ${driver.podiums} Podien</small></div>
        <span>${points(driver.points)} P</span>
      </div>`).join('') : '<div class="driver-empty">Noch keine Fahrerhistorie vorhanden.</div>';
  }

  function renderCars(stats) {
    const host = byId('team-profile-cars-list');
    host.innerHTML = stats.cars.length ? stats.cars.map((car) => `
      <div class="team-car-item"><div><strong>${esc(car.name)}</strong><small>${car.starts} Fahrer-Starts</small></div><span>${window.createTeamLogoBadge?.(car.name, { size: 'large', label: car.name }) || ''}</span></div>`).join('') : '<div class="driver-empty">Noch keine Fahrzeuge hinterlegt.</div>';
  }

  function renderSeasons(stats) {
    const tbody = byId('team-profile-seasons');
    tbody.innerHTML = stats.seasonBreakdown.length ? stats.seasonBreakdown.map((season) => `
      <tr><td><a href="${scopedHref('team-profil.html', { team: stats.teamName, season: season.seasonId })}">${esc(season.seasonName)}</a></td><td>${season.races}</td><td>${season.starts}</td><td>${season.wins}</td><td>${season.podiums}</td><td>${season.poles}</td><td>${season.fastestLaps}</td><td><strong>${points(season.points)}</strong></td><td>${season.bestFinish ? `P${season.bestFinish}` : '—'}</td></tr>`).join('') : '<tr><td colspan="9">Noch keine Saisonhistorie vorhanden.</td></tr>';
  }

  function renderRecent(stats) {
    const tbody = byId('team-profile-recent');
    tbody.innerHTML = stats.recent.length ? stats.recent.map((entry) => `
      <tr>
        <td><a href="${scopedHref('rennen-detail.html', { round: entry.race.round_number, season: entry.race.season_id })}">${esc(entry.race.grand_prix_name || `Runde ${entry.race.round_number}`)}</a></td>
        <td>${esc(entry.season?.name || '—')}</td>
        <td>${entry.bestFinish ? `P${entry.bestFinish}` : '—'}</td>
        <td>${entry.drivers.map((driver) => `<a href="${scopedHref('fahrer-profil.html', { driver: driver.driverId })}">${esc(driver.name)}</a>`).join(' · ') || '—'}</td>
        <td><strong>${points(entry.points)}</strong></td>
      </tr>`).join('') : '<tr><td colspan="5">Noch keine Rennen vorhanden.</td></tr>';
  }

  function render() {
    const stats = window.RCCTeamStats.calculateTeamStats(state.team, state.history, { seasonId: state.seasonId || null });
    if (!stats) throw new Error('Team konnte nicht berechnet werden.');
    renderHero(stats);
    renderStats(stats);
    renderDrivers(stats);
    renderCars(stats);
    renderSeasons(stats);
    renderRecent(stats);
    byId('team-profile-loading').hidden = true;
    byId('team-profile-error').hidden = true;
    byId('team-profile-content').hidden = false;
    updateUrl();
    document.dispatchEvent(new CustomEvent('rcc:page-content-ready', { detail: { page: 'team-profil' } }));
  }

  function bind() {
    byId('team-profile-select').addEventListener('change', (event) => { state.team = event.target.value; render(); });
    byId('team-profile-season').addEventListener('change', (event) => {
      state.seasonId = event.target.value;
      populate();
      render();
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.team = params.get('team') || '';
    state.seasonId = params.get('season') || '';
    try {
      state.history = await window.RCCDriverStats.loadLeagueHistory();
      populate();
      if (!state.team) throw new Error('Keine Teams vorhanden.');
      bind();
      render();
    } catch (error) {
      console.error('RaceVora Teamprofil:', error);
      byId('team-profile-loading').hidden = true;
      byId('team-profile-content').hidden = true;
      const host = byId('team-profile-error');
      host.hidden = false;
      host.textContent = 'Das Teamprofil konnte nicht geladen werden. Bitte prüfe die Liga oder versuche es erneut.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
