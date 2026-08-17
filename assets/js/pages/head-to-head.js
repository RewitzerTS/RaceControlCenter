(() => {
  const state = { history: null, driverA: '', driverB: '', seasonId: '' };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
  const formatNumber = (value, digits = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number);
  };
  const formatPoints = (value) => {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(number);
  };

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?';
  }

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
    if (state.driverA) url.searchParams.set('driver', state.driverA);
    if (state.driverB) url.searchParams.set('opponent', state.driverB);
    if (state.seasonId) url.searchParams.set('season', state.seasonId);
    else url.searchParams.delete('season');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function renderAvatar(host, driver) {
    if (!host) return;
    host.textContent = initials(driver?.display_name);
    if (!driver?.avatar_url) return;
    const img = document.createElement('img');
    img.alt = `${driver.display_name || 'Fahrer'} Avatar`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = driver.avatar_url;
    img.addEventListener('load', () => { host.textContent = ''; host.appendChild(img); }, { once: true });
  }

  function populateSelectors() {
    const drivers = [...(state.history?.drivers || [])].sort((a, b) => {
      const activeDelta = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
      return activeDelta || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de');
    });
    if (drivers.length < 2) throw new Error('Für Head-to-Head werden mindestens zwei Fahrer benötigt.');

    const options = drivers.map((driver) => `<option value="${esc(driver.id)}">${esc(driver.display_name)}</option>`).join('');
    byId('h2h-driver-a').innerHTML = options;
    byId('h2h-driver-b').innerHTML = options;

    if (!state.history.driversById.has(String(state.driverA))) state.driverA = String(drivers[0].id);
    if (!state.history.driversById.has(String(state.driverB)) || state.driverB === state.driverA) {
      state.driverB = String(drivers.find((driver) => String(driver.id) !== state.driverA)?.id || '');
    }
    byId('h2h-driver-a').value = state.driverA;
    byId('h2h-driver-b').value = state.driverB;

    const seasons = [...(state.history?.seasons || [])].sort((a, b) => {
      const left = Date.parse(a.start_date || a.created_at || 0) || 0;
      const right = Date.parse(b.start_date || b.created_at || 0) || 0;
      return right - left;
    });
    byId('h2h-season').innerHTML = '<option value="">Alle Saisons</option>' + seasons.map((season) => `<option value="${esc(season.id)}">${esc(season.name || season.slug || 'Saison')}</option>`).join('');
    if (state.seasonId && !state.history.seasonsById.has(String(state.seasonId))) state.seasonId = '';
    byId('h2h-season').value = state.seasonId;
  }

  function latestSnapshot(driverId, comparison) {
    const latestRace = comparison.commonRaces.at(-1)?.race || state.history.completedRaces.at(-1) || null;
    if (!latestRace) return state.history.driversById.get(String(driverId));
    return window.RCCDriverStats.driverDisplaySnapshot(state.history, driverId, latestRace.id) || state.history.driversById.get(String(driverId));
  }

  function renderHero(comparison) {
    const snapshotA = latestSnapshot(state.driverA, comparison) || comparison.driverA;
    const snapshotB = latestSnapshot(state.driverB, comparison) || comparison.driverB;
    renderAvatar(byId('h2h-avatar-a'), comparison.driverA);
    renderAvatar(byId('h2h-avatar-b'), comparison.driverB);
    byId('h2h-name-a').textContent = comparison.driverA.display_name || 'Fahrer 1';
    byId('h2h-name-b').textContent = comparison.driverB.display_name || 'Fahrer 2';
    byId('h2h-team-a').textContent = snapshotA.league_team || snapshotA.car_name || 'Ohne Team';
    byId('h2h-team-b').textContent = snapshotB.league_team || snapshotB.car_name || 'Ohne Team';
    byId('h2h-score-a').textContent = comparison.raceH2H.a;
    byId('h2h-score-b').textContent = comparison.raceH2H.b;
    byId('h2h-common-races').textContent = `${comparison.commonRaceCount} gemeinsame${comparison.commonRaceCount === 1 ? 's' : ''} Rennen`;
    byId('h2h-ties').textContent = comparison.raceH2H.ties ? `${comparison.raceH2H.ties} Unentschieden / nicht klassifiziert` : '';
    byId('h2h-profile-a').href = scopedHref('fahrer-profil.html', { driver: state.driverA, season: state.seasonId || null });
    byId('h2h-profile-b').href = scopedHref('fahrer-profil.html', { driver: state.driverB, season: state.seasonId || null });
    byId('h2h-th-a').textContent = comparison.driverA.display_name;
    byId('h2h-th-b').textContent = comparison.driverB.display_name;
    document.title = `RaceVora · ${comparison.driverA.display_name} vs. ${comparison.driverB.display_name}`;
  }

  function metricCard(label, a, b, options = {}) {
    const aNum = Number(a);
    const bNum = Number(b);
    let winner = 0;
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
      winner = options.lowerIsBetter ? (aNum < bNum ? 1 : -1) : (aNum > bNum ? 1 : -1);
    }
    const formatter = options.format || ((value) => String(value ?? '—'));
    return `<article class="h2h-metric-card">
      <strong class="${winner > 0 ? 'is-leading' : ''}">${esc(formatter(a))}</strong>
      <span>${esc(label)}</span>
      <strong class="${winner < 0 ? 'is-leading' : ''}">${esc(formatter(b))}</strong>
    </article>`;
  }

  function renderMetrics(comparison) {
    const metrics = [
      metricCard('Qualifying H2H', comparison.qualifyingH2H.a, comparison.qualifyingH2H.b),
      metricCard('Punkte in gemeinsamen Rennen', comparison.points.a, comparison.points.b, { format: formatPoints }),
      metricCard('Siege', comparison.metricsA.wins, comparison.metricsB.wins),
      metricCard('Podien', comparison.metricsA.podiums, comparison.metricsB.podiums),
      metricCard('Pole Positions', comparison.metricsA.poles, comparison.metricsB.poles),
      metricCard('Schnellste Runden', comparison.metricsA.fastestLaps, comparison.metricsB.fastestLaps),
      metricCard('Ø Startposition', comparison.avgStart.a, comparison.avgStart.b, { lowerIsBetter: true, format: (value) => Number.isFinite(value) ? formatNumber(value, 1) : '—' }),
      metricCard('Ø Zielposition', comparison.avgFinish.a, comparison.avgFinish.b, { lowerIsBetter: true, format: (value) => Number.isFinite(value) ? formatNumber(value, 1) : '—' })
    ];
    byId('h2h-metrics').innerHTML = metrics.join('');
  }

  function renderTimeline(comparison) {
    const host = byId('h2h-timeline');
    if (!comparison.commonRaces.length) {
      host.innerHTML = '<div class="driver-empty">Diese beiden Fahrer haben im gewählten Zeitraum noch kein gemeinsames Rennen.</div>';
      return;
    }
    host.innerHTML = comparison.commonRaces.map((entry) => {
      const tone = entry.finishWinner > 0 ? ' h2h-timeline-dot--a' : (entry.finishWinner < 0 ? ' h2h-timeline-dot--b' : '');
      const winner = entry.finishWinner > 0 ? comparison.driverA.display_name : (entry.finishWinner < 0 ? comparison.driverB.display_name : 'Unentschieden');
      return `<a href="${scopedHref('rennen-detail.html', { round: entry.race.round_number, season: entry.race.season_id })}" class="h2h-timeline-dot${tone}" title="${esc(entry.race.grand_prix_name)} · ${esc(winner)}">R${esc(entry.race.round_number)}</a>`;
    }).join('');
  }

  function renderRaces(comparison) {
    const tbody = byId('h2h-races');
    if (!comparison.commonRaces.length) {
      tbody.innerHTML = '<tr><td colspan="6">Keine gemeinsamen Rennen im ausgewählten Zeitraum.</td></tr>';
      return;
    }

    tbody.innerHTML = [...comparison.commonRaces].reverse().map((entry) => {
      const finishA = window.RCCDriverStats.validPosition(entry.rowA.finish_position);
      const finishB = window.RCCDriverStats.validPosition(entry.rowB.finish_position);
      const gridA = window.RCCDriverStats.validPosition(entry.rowA.grid_position);
      const gridB = window.RCCDriverStats.validPosition(entry.rowB.grid_position);
      const winner = entry.finishWinner > 0 ? comparison.driverA.display_name : (entry.finishWinner < 0 ? comparison.driverB.display_name : '—');
      const winnerClass = entry.finishWinner > 0 ? 'h2h-winner h2h-winner--a' : (entry.finishWinner < 0 ? 'h2h-winner h2h-winner--b' : '');
      return `<tr>
        <td><a href="${scopedHref('rennen-detail.html', { round: entry.race.round_number, season: entry.race.season_id })}">${esc(entry.race.grand_prix_name || `Runde ${entry.race.round_number}`)}</a></td>
        <td>${esc(entry.season?.name || '—')}</td>
        <td>${finishA ? `P${finishA}` : 'DNF'} · ${formatPoints(entry.pointsA)} P</td>
        <td>${finishB ? `P${finishB}` : 'DNF'} · ${formatPoints(entry.pointsB)} P</td>
        <td>${gridA ? `P${gridA}` : '—'} : ${gridB ? `P${gridB}` : '—'}</td>
        <td class="${winnerClass}">${esc(winner)}</td>
      </tr>`;
    }).join('');
  }

  function render() {
    if (state.driverA === state.driverB) {
      const alternative = state.history.drivers.find((driver) => String(driver.id) !== state.driverA);
      state.driverB = String(alternative?.id || '');
      byId('h2h-driver-b').value = state.driverB;
    }
    const comparison = window.RCCDriverStats.calculateHeadToHead(state.driverA, state.driverB, state.history, { seasonId: state.seasonId || null });
    if (!comparison) throw new Error('Head-to-Head konnte nicht berechnet werden.');
    renderHero(comparison);
    renderMetrics(comparison);
    renderTimeline(comparison);
    renderRaces(comparison);
    byId('h2h-loading').hidden = true;
    byId('h2h-error').hidden = true;
    byId('h2h-content').hidden = false;
    updateUrl();
    document.dispatchEvent(new CustomEvent('rcc:page-content-ready', { detail: { page: 'head-to-head' } }));
  }

  function bindControls() {
    byId('h2h-driver-a').addEventListener('change', (event) => { state.driverA = event.target.value; render(); });
    byId('h2h-driver-b').addEventListener('change', (event) => { state.driverB = event.target.value; render(); });
    byId('h2h-season').addEventListener('change', (event) => { state.seasonId = event.target.value; render(); });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.driverA = params.get('driver') || '';
    state.driverB = params.get('opponent') || '';
    state.seasonId = params.get('season') || '';
    try {
      state.history = await window.RCCDriverStats.loadLeagueHistory();
      populateSelectors();
      bindControls();
      render();
    } catch (error) {
      console.error('RaceVora Head-to-Head:', error);
      byId('h2h-loading').hidden = true;
      byId('h2h-content').hidden = true;
      const errorHost = byId('h2h-error');
      errorHost.hidden = false;
      errorHost.textContent = 'Der Head-to-Head-Vergleich konnte nicht geladen werden. Für den Vergleich werden mindestens zwei Fahrer und veröffentlichte Renndaten benötigt.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
