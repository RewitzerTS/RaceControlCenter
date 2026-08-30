(() => {
  const state = { history: null, seasonId: '' };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');

  function scopedHref(file, params = {}) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}${url.hash}`;
  }

  function populateSeason() {
    const seasons = [...state.history.seasons].sort((a, b) => (Date.parse(b.start_date || b.created_at || 0) || 0) - (Date.parse(a.start_date || a.created_at || 0) || 0));
    const select = byId('track-hub-season');
    select.innerHTML = '<option value="">Historie</option>' + seasons.map((season) => `<option value="${esc(season.id)}">${esc(season.name || season.slug || 'Saison')}</option>`).join('');
    if (state.seasonId && !state.history.seasonsById.has(String(state.seasonId))) state.seasonId = '';
    select.value = state.seasonId;
  }

  function render() {
    const tracks = window.RCCTrackStats.listTracks(state.history, { seasonId: state.seasonId || null });
    const calculated = tracks.map((track) => ({ track, stats: window.RCCTrackStats.calculateTrackStats(track.key, state.history, { seasonId: state.seasonId || null }) })).filter((entry) => entry.stats);
    const totals = calculated.reduce((sum, entry) => {
      sum.races += entry.stats.races;
      sum.starts += entry.stats.starts;
      if (entry.stats.bestLap) sum.laps += 1;
      return sum;
    }, { races: 0, starts: 0, laps: 0 });

    byId('track-hub-count').textContent = calculated.length;
    byId('track-hub-races').textContent = totals.races;
    byId('track-hub-starts').textContent = totals.starts;
    byId('track-hub-laps').textContent = totals.laps;

    byId('track-hub-grid').innerHTML = calculated.length ? calculated.map(({ track }) => `
      <a class="track-hub-card" href="${scopedHref('strecken-profil.html', { track: track.key, season: state.seasonId || null })}">
        <div class="track-hub-map">${window.createTrackMapSvg?.(track.track) || ''}</div>
        <div class="track-hub-copy">
          <div class="track-hub-heading">
            ${window.createFlagBadge?.(track.track?.countryCode, `${track.grandPrixName} Flagge`) || `<span class="track-flag-fallback" aria-hidden="true">${window.getFlagEmoji?.(track.track?.countryCode) || '🏁'}</span>`}
            <h3>${esc(track.grandPrixName)}</h3>
          </div>
          <p>${esc(track.circuitName)}</p>
        </div>
      </a>`).join('') : '<div class="driver-empty">Für diesen Zeitraum sind noch keine gefahrenen Strecken vorhanden.</div>';

    byId('track-hub-loading').hidden = true;
    byId('track-hub-error').hidden = true;
    byId('track-hub-content').hidden = false;
    document.dispatchEvent(new CustomEvent('rcc:page-content-ready', { detail: { page: 'strecken' } }));
  }

  async function init() {
    state.seasonId = new URLSearchParams(location.search).get('season') || '';
    try {
      state.history = await window.RCCDriverStats.loadLeagueHistory();
      populateSeason();
      byId('track-hub-season').addEventListener('change', (event) => {
        state.seasonId = event.target.value;
        const url = new URL(location.href);
        if (state.seasonId) url.searchParams.set('season', state.seasonId); else url.searchParams.delete('season');
        history.replaceState({}, '', `${url.pathname}${url.search}`);
        render();
      });
      render();
    } catch (error) {
      console.error('RaceVora Track Hub:', error);
      byId('track-hub-loading').hidden = true;
      const host = byId('track-hub-error');
      host.hidden = false;
      host.textContent = 'Die Streckenübersicht konnte nicht geladen werden.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
