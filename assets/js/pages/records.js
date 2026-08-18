(() => {
  const state = { history: null, seasonId: '' };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
  const format = (value, digits = 0) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  };
  function href(file, params = {}) {
    const base = window.withLeagueContextHref?.(file) || file;
    const url = new URL(base, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}`;
  }
  function populateSeasons() {
    const select = byId('records-season');
    const seasons = [...(state.history.seasons || [])].sort((a, b) => (Date.parse(b.start_date || b.created_at || 0) || 0) - (Date.parse(a.start_date || a.created_at || 0) || 0));
    select.innerHTML = '<option value="">All-Time</option>' + seasons.map((season) => `<option value="${esc(season.id)}">${esc(season.name || season.slug || 'Saison')}</option>`).join('');
    if (state.seasonId && !state.history.seasonsById.has(String(state.seasonId))) state.seasonId = '';
    select.value = state.seasonId;
  }
  function updateUrl() {
    const url = new URL(location.href);
    if (state.seasonId) url.searchParams.set('season', state.seasonId); else url.searchParams.delete('season');
    history.replaceState({}, '', `${url.pathname}${url.search}`);
  }
  function driverLink(driver) {
    return driver ? href('fahrer-profil.html', { driver: driver.id, season: state.seasonId || null }) : '';
  }
  function teamLink(name) {
    return name ? href('team-profil.html', { team: name, season: state.seasonId || null }) : '';
  }
  function specialCard(label, name, value, detail, url) {
    const body = `<span>${esc(label)}</span><strong>${esc(name || '—')}</strong><b>${esc(value || '—')}</b>${detail ? `<small>${esc(detail)}</small>` : ''}`;
    return `<article class="records-special-card">${url ? `<a href="${esc(url)}">${body}</a>` : body}</article>`;
  }
  function renderSpecials(data) {
    const s = data.specials;
    const comeback = s.comeback;
    const specialist = s.specialist;
    const cards = [
      specialCard('Größte Aufholjagd', comeback?.driver?.display_name, comeback ? `+${comeback.gain} Plätze` : '—', comeback ? `${comeback.race.grand_prix_name || 'Rennen'} · P${comeback.grid} → P${comeback.finish}` : 'Keine Daten', comeback ? driverLink(comeback.driver) : ''),
      specialCard('Längste Siegesserie', s.winStreak?.driver?.display_name, s.winStreak ? `${s.winStreak.value} Siege` : '—', 'Starts in Folge', s.winStreak ? driverLink(s.winStreak.driver) : ''),
      specialCard('Längste Podiumsserie', s.podiumStreak?.driver?.display_name, s.podiumStreak ? `${s.podiumStreak.value} Podien` : '—', 'Starts in Folge', s.podiumStreak ? driverLink(s.podiumStreak.driver) : ''),
      specialCard('Längste Punkteserie', s.pointsStreak?.driver?.display_name, s.pointsStreak ? `${s.pointsStreak.value} Starts` : '—', 'mit Punkten in Folge', s.pointsStreak ? driverLink(s.pointsStreak.driver) : ''),
      specialCard('Streckenspezialist', specialist?.driver?.display_name, specialist ? `${specialist.wins} Siege` : '—', specialist?.track || 'Keine Daten', specialist ? driverLink(specialist.driver) : ''),
      specialCard('Beste Ø-Zielposition', s.avgFinish?.driver?.display_name, s.avgFinish ? `P${format(s.avgFinish.avgFinish, 1)}` : '—', 'mindestens 3 Starts', s.avgFinish ? driverLink(s.avgFinish.driver) : ''),
      specialCard('Beste Zielankunftsquote', s.finishRate?.driver?.display_name, s.finishRate ? `${format(s.finishRate.finishRate * 100)} %` : '—', 'mindestens 5 Starts', s.finishRate ? driverLink(s.finishRate.driver) : ''),
      specialCard('Meiste Positionen gewonnen', s.positionsGained?.driver?.display_name, s.positionsGained ? `${s.positionsGained.positionsGained > 0 ? '+' : ''}${s.positionsGained.positionsGained}` : '—', 'Netto über alle Starts', s.positionsGained ? driverLink(s.positionsGained.driver) : '')
    ];
    byId('records-specials').innerHTML = cards.join('');
  }
  function renderBoard(hostId, title, rows, valueFn, urlFn) {
    const host = byId(hostId);
    host.innerHTML = `<h3>${esc(title)}</h3><div class="records-list">${rows.length ? rows.map((row, index) => `<div class="records-row"><span class="records-rank">${index + 1}</span><a href="${esc(urlFn(row))}">${esc(row.driver?.display_name || row.teamName || '—')}</a><b>${esc(valueFn(row))}</b></div>`).join('') : '<div class="records-state">Keine Daten</div>'}</div>`;
  }
  function render(data) {
    byId('records-races').textContent = data.raceCount;
    byId('records-drivers').textContent = data.driverStats.length;
    byId('records-teams').textContent = data.teamStats.length;
    renderSpecials(data);
    const d = data.leaderboards.drivers;
    const t = data.leaderboards.teams;
    renderBoard('records-driver-wins', 'Siege', d.wins, (x) => x.wins, (x) => driverLink(x.driver));
    renderBoard('records-driver-points', 'Punkte', d.points, (x) => format(x.points), (x) => driverLink(x.driver));
    renderBoard('records-driver-poles', 'Poles', d.poles, (x) => x.poles, (x) => driverLink(x.driver));
    renderBoard('records-driver-podiums', 'Podien', d.podiums, (x) => x.podiums, (x) => driverLink(x.driver));
    renderBoard('records-team-points', 'Team-Punkte', t.points, (x) => format(x.points), (x) => teamLink(x.teamName));
    renderBoard('records-team-wins', 'Team-Siege', t.wins, (x) => x.wins, (x) => teamLink(x.teamName));
    renderBoard('records-team-podiums', 'Team-Podien', t.podiums, (x) => x.podiums, (x) => teamLink(x.teamName));
    renderBoard('records-team-poles', 'Team-Poles', t.poles, (x) => x.poles, (x) => teamLink(x.teamName));
    byId('records-loading').hidden = true;
    byId('records-content').hidden = false;
    updateUrl();
    document.dispatchEvent(new CustomEvent('rcc:page-content-ready', { detail: { page: 'rekorde' } }));
  }
  function rerender() {
    const data = window.RCCRecords.calculate(state.history, { seasonId: state.seasonId || null });
    render(data);
  }
  async function init() {
    state.seasonId = new URLSearchParams(location.search).get('season') || '';
    try {
      state.history = await window.RCCDriverStats.loadLeagueHistory();
      populateSeasons();
      byId('records-season').addEventListener('change', (event) => { state.seasonId = event.target.value; rerender(); });
      rerender();
    } catch (error) {
      console.error('RaceVora Rekorde:', error);
      byId('records-loading').hidden = true;
      const errorHost = byId('records-error');
      errorHost.hidden = false;
      errorHost.textContent = 'Die Rekorde konnten nicht geladen werden. Bitte prüfe die Liga oder versuche es erneut.';
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
