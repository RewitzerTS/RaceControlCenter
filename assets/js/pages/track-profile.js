(() => {
  const state = { history: null, trackKey: '', seasonId: '' };
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
    return `${url.pathname.split('/').pop()}${url.search}${url.hash}`;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (state.trackKey) url.searchParams.set('track', state.trackKey);
    if (state.seasonId) url.searchParams.set('season', state.seasonId);
    else url.searchParams.delete('season');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function trackInfo(meta) {
    return window.getTrackInfo?.(meta.circuitName)
      || window.getTrackInfo?.(meta.grandPrixName)
      || null;
  }

  function populate() {
    const tracks = window.RCCTrackStats.listTracks(state.history, { seasonId: state.seasonId || null });
    const select = byId('track-profile-select');
    select.innerHTML = tracks.map((entry) => `<option value="${esc(entry.key)}">${esc(entry.grandPrixName)} · ${esc(entry.circuitName)}</option>`).join('');
    if (!tracks.some((entry) => entry.key === state.trackKey)) state.trackKey = tracks[0]?.key || '';
    select.value = state.trackKey;

    const seasons = [...state.history.seasons].sort((a, b) => (Date.parse(b.start_date || b.created_at || 0) || 0) - (Date.parse(a.start_date || a.created_at || 0) || 0));
    const seasonSelect = byId('track-profile-season');
    seasonSelect.innerHTML = '<option value="">Historie</option>' + seasons.map((season) => `<option value="${esc(season.id)}">${esc(season.name || season.slug || 'Saison')}</option>`).join('');
    if (state.seasonId && !state.history.seasonsById.has(String(state.seasonId))) state.seasonId = '';
    seasonSelect.value = state.seasonId;
  }

  function renderHero(stats, info) {
    byId('track-profile-name').textContent = stats.meta.grandPrixName;
    byId('track-profile-circuit').textContent = stats.meta.circuitName;
    byId('track-profile-country').textContent = [info?.country, info?.shortName].filter(Boolean).join(' · ') || 'RaceVora Strecke';
    byId('track-profile-map').innerHTML = window.createTrackMapSvg?.(stats.meta.track) || '';
    byId('track-profile-tags').innerHTML = [info?.trackType, info?.direction].filter(Boolean).map((value) => `<span>${esc(value)}</span>`).join('');
    byId('track-profile-lap').textContent = stats.bestLap?.text || '—';
    byId('track-profile-lap-driver').innerHTML = stats.bestLap
      ? `<a href="${scopedHref('fahrer-profil.html', { driver: stats.bestLap.driverId })}">${esc(stats.bestLap.driverName)}</a>`
      : 'Noch keine Rundenzeit';
    document.title = `RaceVora · ${stats.meta.grandPrixName}`;
  }

  function renderStats(stats, info) {
    byId('track-stat-races').textContent = stats.races;
    byId('track-stat-starts').textContent = stats.starts;
    byId('track-stat-drivers').textContent = stats.uniqueDrivers;
    byId('track-stat-corners').textContent = info?.corners ?? '—';
    byId('track-stat-length').textContent = info?.lengthKm || '—';
    byId('track-stat-f1-record').textContent = info?.lapRecord || '—';
  }

  function renderFacts(info) {
    const facts = [
      ['Land', info?.country],
      ['Streckentyp', info?.trackType],
      ['Richtung', info?.direction],
      ['Kurven', info?.corners],
      ['DRS-Zonen', info?.drsZones],
      ['Länge', info?.lengthKm],
      ['Renndistanz', info?.raceDistanceKm],
      ['F1-Runden', info?.laps],
      ['Erster Grand Prix', info?.firstGrandPrix]
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
    byId('track-profile-facts').innerHTML = facts.length
      ? facts.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')
      : '<div class="driver-empty">Keine zusätzlichen Streckendaten vorhanden.</div>';
  }

  function renderLeaders(stats) {
    const rows = [
      ['Siege', stats.leaders.wins, stats.leaders.wins?.wins],
      ['Podien', stats.leaders.podiums, stats.leaders.podiums?.podiums],
      ['Poles', stats.leaders.poles, stats.leaders.poles?.poles],
      ['Schnellste Runden', stats.leaders.fastestLaps, stats.leaders.fastestLaps?.fastestLaps],
      ['Punkte', stats.leaders.points, stats.leaders.points?.points],
      ['Starts', stats.leaders.starts, stats.leaders.starts?.starts]
    ];
    byId('track-profile-leaders').innerHTML = rows.map(([label, driver, value]) => `
      <div class="track-leader-item">
        <span>${esc(label)}</span>
        <a href="${driver ? scopedHref('fahrer-profil.html', { driver: driver.driverId, season: state.seasonId || null }) : '#'}">${esc(driver?.name || '—')}</a>
        <strong>${driver ? points(value) : '—'}</strong>
      </div>`).join('');
  }

  function renderDrivers(stats) {
    byId('track-profile-drivers').innerHTML = stats.driverRecords.length ? stats.driverRecords.map((driver) => `
      <tr>
        <td><a href="${scopedHref('fahrer-profil.html', { driver: driver.driverId, season: state.seasonId || null })}">${esc(driver.name)}</a></td>
        <td>${driver.starts}</td><td>${driver.wins}</td><td>${driver.podiums}</td><td>${driver.poles}</td><td>${driver.fastestLaps}</td>
        <td><strong>${points(driver.points)}</strong></td><td>${driver.bestFinish ? `P${driver.bestFinish}` : '—'}</td><td>${esc(driver.bestLap?.text || '—')}</td>
      </tr>`).join('') : '<tr><td colspan="9">Noch keine Fahrerdaten vorhanden.</td></tr>';
  }

  function renderRaces(stats) {
    byId('track-profile-races').innerHTML = stats.raceHistory.length ? stats.raceHistory.map((entry) => {
      const rows = state.history.resultsByRace.get(String(entry.race.id)) || [];
      const fastestRow = rows.find((row) => String(row.driver_id || '') === String(entry.fastestDriverId || '')) || null;
      const fastestDriver = entry.fastestDriverId ? state.history.driversById.get(String(entry.fastestDriverId)) : null;
      return `
        <tr>
          <td>${esc(entry.season?.name || '—')}</td>
          <td><a href="${scopedHref('rennen-detail.html', { round: entry.race.round_number, season: entry.race.season_id })}">${esc(entry.race.grand_prix_name || `Runde ${entry.race.round_number}`)}</a></td>
          <td>${entry.winner ? `<a href="${scopedHref('fahrer-profil.html', { driver: entry.winner.driverId })}">${esc(entry.winner.name)}</a>` : '—'}</td>
          <td>${fastestDriver ? `<a href="${scopedHref('fahrer-profil.html', { driver: entry.fastestDriverId })}">${esc(fastestDriver.display_name || 'Fahrer')}</a> · ${esc(fastestRow?.fastest_lap_time || '—')}` : '—'}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="4">Noch keine Rennen vorhanden.</td></tr>';
  }

  function render() {
    const stats = window.RCCTrackStats.calculateTrackStats(state.trackKey, state.history, { seasonId: state.seasonId || null });
    if (!stats) throw new Error('Strecke konnte nicht berechnet werden.');
    const info = trackInfo(stats.meta);
    renderHero(stats, info);
    renderStats(stats, info);
    renderFacts(info);
    renderLeaders(stats);
    renderDrivers(stats);
    renderRaces(stats);
    byId('track-profile-loading').hidden = true;
    byId('track-profile-error').hidden = true;
    byId('track-profile-content').hidden = false;
    updateUrl();
    document.dispatchEvent(new CustomEvent('rcc:page-content-ready', { detail: { page: 'strecken-profil' } }));
  }

  function bind() {
    byId('track-profile-select').addEventListener('change', (event) => { state.trackKey = event.target.value; render(); });
    byId('track-profile-season').addEventListener('change', (event) => { state.seasonId = event.target.value; populate(); render(); });
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    state.trackKey = params.get('track') || '';
    state.seasonId = params.get('season') || '';
    try {
      state.history = await window.RCCDriverStats.loadLeagueHistory();
      populate();
      if (!state.trackKey) throw new Error('Keine Strecken vorhanden.');
      bind();
      render();
    } catch (error) {
      console.error('RaceVora Streckenprofil:', error);
      byId('track-profile-loading').hidden = true;
      byId('track-profile-content').hidden = true;
      const host = byId('track-profile-error');
      host.hidden = false;
      host.textContent = 'Das Streckenprofil konnte nicht geladen werden. Es werden veröffentlichte Renndaten benötigt.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
