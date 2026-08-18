(() => {
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');

  function scopedHref(file, params = {}) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}`;
  }

  function card(entry, driverId, seasonId, teammate = false) {
    const opponentId = entry.driver.id;
    const name = entry.driver.display_name || 'Unbekannt';
    const races = teammate ? entry.teammateRaces : entry.shared;
    const ahead = teammate ? entry.teammateAhead : entry.ahead;
    const behind = teammate ? entry.teammateBehind : entry.behind;
    const ties = teammate ? entry.teammateTies : entry.ties;
    const result = `${ahead}:${behind}${ties ? ` · ${ties} Remis` : ''}`;
    return `
      <article class="driver-rival-card">
        <div class="driver-rival-main">
          <a class="driver-rival-name" href="${scopedHref('fahrer-profil.html', { driver: opponentId, season: seasonId || null })}">${esc(name)}</a>
          <span>${races} gemeinsame ${races === 1 ? 'Rennen' : 'Rennen'}</span>
        </div>
        <div class="driver-rival-score"><span>${teammate ? 'Teamduell' : 'Race H2H'}</span><strong>${esc(result)}</strong></div>
        <a class="driver-rival-action" href="${scopedHref('head-to-head.html', { a: driverId, b: opponentId, season: seasonId || null })}">Vergleichen</a>
      </article>`;
  }

  async function render() {
    const rivalHost = document.getElementById('driver-profile-rivals');
    const teammateHost = document.getElementById('driver-profile-teammates');
    if (!rivalHost || !teammateHost || !window.RCCDriverRivalries || !window.RCCDriverStats) return;

    const params = new URLSearchParams(window.location.search);
    const driverId = params.get('driver') || document.getElementById('driver-profile-select')?.value || '';
    const seasonId = params.get('season') || document.getElementById('driver-profile-season')?.value || '';
    if (!driverId) return;

    try {
      const history = await window.RCCDriverStats.loadLeagueHistory();
      const result = window.RCCDriverRivalries.calculate(driverId, history, { seasonId: seasonId || null });
      rivalHost.innerHTML = result.rivalries.length
        ? result.rivalries.map((entry) => card(entry, driverId, seasonId, false)).join('')
        : '<div class="driver-empty">Noch nicht genug gemeinsame Rennen für eine Rivalität.</div>';
      teammateHost.innerHTML = result.teammates.length
        ? result.teammates.map((entry) => card(entry, driverId, seasonId, true)).join('')
        : '<div class="driver-empty">Noch keine gemeinsamen Teamrennen gefunden.</div>';
    } catch (error) {
      console.warn('RaceVora Rivalitäten konnten nicht geladen werden.', error);
      rivalHost.innerHTML = '<div class="driver-empty">Rivalitäten konnten nicht geladen werden.</div>';
      teammateHost.innerHTML = '<div class="driver-empty">Teamduelle konnten nicht geladen werden.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.getElementById('driver-profile-select')?.addEventListener('change', () => setTimeout(render, 0));
    document.getElementById('driver-profile-season')?.addEventListener('change', () => setTimeout(render, 0));
  });
  document.addEventListener('rcc:page-content-ready', (event) => {
    if (event.detail?.page === 'fahrer-profil') render();
  });
})();
