(() => {
  const state = { history: null, driverId: '', seasonId: '', profileNumber: null };
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
    if (state.driverId) url.searchParams.set('driver', state.driverId);
    else url.searchParams.delete('driver');
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
    const driverSelect = byId('driver-profile-select');
    const seasonSelect = byId('driver-profile-season');
    const drivers = [...(state.history?.drivers || [])].sort((a, b) => {
      const activeDelta = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
      return activeDelta || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de');
    });

    driverSelect.innerHTML = drivers.map((driver) => `<option value="${esc(driver.id)}">${esc(driver.display_name)}</option>`).join('');
    if (!state.driverId || !state.history.driversById.has(String(state.driverId))) state.driverId = String(drivers[0]?.id || '');
    driverSelect.value = state.driverId;

    const seasons = [...(state.history?.seasons || [])].sort((a, b) => {
      const left = Date.parse(a.start_date || a.created_at || 0) || 0;
      const right = Date.parse(b.start_date || b.created_at || 0) || 0;
      return right - left;
    });
    seasonSelect.innerHTML = '<option value="">Karriere</option>' + seasons.map((season) => `<option value="${esc(season.id)}">${esc(season.name || season.slug || 'Saison')}</option>`).join('');
    if (state.seasonId && !state.history.seasonsById.has(String(state.seasonId))) state.seasonId = '';
    seasonSelect.value = state.seasonId;
  }

  function renderHero(stats) {
    const driver = stats.driver;
    const snapshot = stats.currentSnapshot || driver;
    renderAvatar(byId('driver-profile-avatar'), driver);
    byId('driver-profile-name').textContent = driver.display_name || 'Unbekannt';
    const linkedProfileNumber = state.history?.profileNumbersByDriver?.get(String(driver.id)) ?? state.profileNumber;
    const displayedNumber = linkedProfileNumber ?? driver.number;
    const driverNumber = displayedNumber === null || displayedNumber === undefined || displayedNumber === ''
      ? null
      : Number(displayedNumber);
    const numberHost = byId('driver-profile-number');
    numberHost.textContent = Number.isFinite(driverNumber) ? `#${driverNumber}` : '#—';
    numberHost.setAttribute('aria-label', Number.isFinite(driverNumber)
      ? `${linkedProfileNumber !== undefined ? 'Profilnummer' : 'Fahrernummer'} ${driverNumber}`
      : 'Keine Fahrer- oder Profilnummer hinterlegt');
    byId('driver-profile-team').textContent = snapshot.league_team || snapshot.car_name || 'Aktuell ohne Teamzuordnung';

    const countryCode = String(driver.nationality_code || '').trim().toUpperCase();
    const nationality = driver.nationality || driver.nationality_code || '';
    const flag = /^[A-Z]{2}$/.test(countryCode)
      ? window.createFlagBadge?.(countryCode, `${nationality || countryCode} Flagge`) || ''
      : '';
    const metaParts = [nationality, driver.gamertag]
      .filter(Boolean)
      .map((value) => `<span>${esc(value)}</span>`)
      .join('');
    byId('driver-profile-meta').innerHTML = flag || metaParts
      ? `${flag}${metaParts}`
      : '<span>RaceVora Fahrer</span>';

    const tags = [];
    if (snapshot.car_name) tags.push(snapshot.car_name);
    if (driver.gamertag && driver.gamertag !== driver.display_name) tags.push(`Gamertag: ${driver.gamertag}`);
    if (!driver.is_active) tags.push('Inaktiv');
    byId('driver-profile-tags').innerHTML = tags.map((tag) => `<span>${esc(tag)}</span>`).join('');

    document.title = `RaceVora · ${driver.display_name || 'Fahrerprofil'}`;
    const h2h = byId('driver-profile-h2h');
    h2h.href = scopedHref('head-to-head.html', { driver: driver.id, season: state.seasonId || null });
  }

  function renderStats(stats) {
    byId('driver-stat-starts').textContent = stats.starts;
    byId('driver-stat-wins').textContent = stats.wins;
    byId('driver-stat-podiums').textContent = stats.podiums;
    byId('driver-stat-poles').textContent = stats.poles;
    byId('driver-stat-fastest').textContent = stats.fastestLaps;
    byId('driver-stat-points').textContent = formatPoints(stats.points);
    byId('driver-stat-avg-start').textContent = Number.isFinite(stats.avgStart) ? formatNumber(stats.avgStart, 1) : '—';
    byId('driver-stat-avg-finish').textContent = Number.isFinite(stats.avgFinish) ? formatNumber(stats.avgFinish, 1) : '—';
    byId('driver-stat-gain').textContent = `${stats.positionsGained > 0 ? '+' : ''}${stats.positionsGained}`;
    byId('driver-stat-best-finish').textContent = stats.bestFinish ? `P${stats.bestFinish}` : '—';
    byId('driver-stat-finish-rate').textContent = Number.isFinite(stats.finishRate) ? `${formatNumber(stats.finishRate * 100, 0)} %` : '—';
    byId('driver-stat-dnf').textContent = stats.dnfs;
  }

  function renderPerformance() {
    const performance = window.RCCDriverPerformance?.calculate?.(state.driverId, state.history, { seasonId: state.seasonId || null });
    const gauge = byId('driver-rating-gauge');
    const scoreHost = byId('driver-rating-score');
    const labelHost = byId('driver-rating-label');
    const sampleHost = byId('driver-rating-sample');
    const trendHost = byId('driver-rating-trend');
    const componentsHost = byId('driver-rating-components');
    if (!performance || !Number.isFinite(performance.score)) {
      gauge?.style.setProperty('--driver-rating', '0');
      if (scoreHost) scoreHost.textContent = '—';
      if (labelHost) labelHost.textContent = 'Noch ohne Rating';
      if (sampleHost) sampleHost.textContent = 'Für den Performance Index ist mindestens ein veröffentlichter Start nötig.';
      if (trendHost) {
        trendHost.textContent = 'Trend noch nicht verfügbar';
        trendHost.className = 'driver-rating-trend';
      }
      if (componentsHost) componentsHost.innerHTML = '<div class="driver-empty">Noch keine Rating-Daten vorhanden.</div>';
      return;
    }

    gauge?.style.setProperty('--driver-rating', String(Math.max(0, Math.min(100, performance.score))));
    scoreHost.textContent = performance.score;
    labelHost.textContent = performance.label;
    sampleHost.textContent = `${performance.sampleSize} von maximal 5 Starts im aktuellen Zeitraum fließen in das Rating ein.`;

    trendHost.className = 'driver-rating-trend';
    if (Number.isFinite(performance.trend) && performance.previousSampleSize >= 2) {
      const roundedTrend = Math.round(performance.trend);
      const sign = roundedTrend > 0 ? '+' : '';
      trendHost.textContent = `${sign}${roundedTrend} Punkte vs. vorherige Formphase`;
      if (roundedTrend > 0) trendHost.classList.add('is-up');
      else if (roundedTrend < 0) trendHost.classList.add('is-down');
    } else {
      trendHost.textContent = 'Trend nach mindestens 7 Starts verfügbar';
    }

    const components = [
      ['Rennergebnis', performance.components.finish],
      ['Qualifying', performance.components.qualifying],
      ['Punkte', performance.components.points],
      ['Racecraft', performance.components.racecraft],
      ['Zielankunft', performance.components.reliability]
    ];
    componentsHost.innerHTML = components.map(([label, value]) => {
      const score = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
      return `<div class="driver-rating-component"><span>${esc(label)}</span><strong>${score === null ? '—' : score}</strong><div class="driver-rating-component-bar"><i style="width:${score === null ? 0 : score}%"></i></div></div>`;
    }).join('');
  }

  function renderForm(stats) {
    const host = byId('driver-profile-form');
    const caption = byId('driver-profile-form-caption');
    if (!stats.recent.length) {
      host.innerHTML = '<span class="driver-empty">Noch keine Rennstarts vorhanden.</span>';
      caption.textContent = '';
      return;
    }

    host.innerHTML = stats.recent.map((entry) => {
      const finish = window.RCCDriverStats.validPosition(entry.row.finish_position);
      const label = finish ? `P${finish}` : 'DNF';
      const tone = finish === 1 ? ' driver-form-result--win' : (finish && finish <= 3 ? ' driver-form-result--podium' : (!finish ? ' driver-form-result--dnf' : ''));
      return `<a class="driver-form-result${tone}" href="${scopedHref('rennen-detail.html', { round: entry.race.round_number, season: entry.race.season_id })}" title="${esc(entry.race.grand_prix_name || 'Rennen')}">${esc(label)}</a>`;
    }).join('');
    caption.textContent = 'Neueste Ergebnisse links nach rechts. Tippe auf ein Ergebnis für die Renndetails.';
  }

  function renderSeasons(stats) {
    const tbody = byId('driver-profile-seasons');
    if (!stats.seasonBreakdown.length) {
      tbody.innerHTML = '<tr><td colspan="8">Noch keine Saisonstatistiken vorhanden.</td></tr>';
      return;
    }
    tbody.innerHTML = stats.seasonBreakdown.map((season) => `
      <tr>
        <td><a href="${scopedHref('fahrer-profil.html', { driver: state.driverId, season: season.seasonId })}">${esc(season.seasonName)}</a></td>
        <td>${season.starts}</td><td>${season.wins}</td><td>${season.podiums}</td><td>${season.poles}</td><td>${season.fastestLaps}</td>
        <td><strong>${formatPoints(season.points)}</strong></td><td>${season.bestFinish ? `P${season.bestFinish}` : '—'}</td>
      </tr>`).join('');
  }

  function renderTracks(stats) {
    const host = byId('driver-profile-tracks');
    if (!stats.trackStats.length) {
      host.innerHTML = '<div class="driver-empty">Noch keine Streckenstatistik verfügbar.</div>';
      return;
    }
    host.innerHTML = stats.trackStats.map((track) => `
      <div class="driver-track-item">
        <div><strong>${esc(track.name)}</strong><small>${track.starts} Starts · ${track.wins} Siege · ${track.podiums} Podien</small></div>
        <span>${track.bestFinish ? `Best P${track.bestFinish}` : '—'}</span>
      </div>`).join('');
  }

  function renderTeams(stats) {
    const host = byId('driver-profile-teams');
    if (!stats.teamHistory.length) {
      host.innerHTML = '<div class="driver-empty">Noch keine Team-Historie verfügbar.</div>';
      return;
    }
    host.innerHTML = stats.teamHistory.map((team) => {
      const logo = window.createTeamLogoBadge?.(team.car || team.team, { size: 'large', label: team.car || team.team }) || '';
      return `<div class="driver-team-item"><div><strong>${esc(team.team)}</strong><small>${esc(team.car || 'Fahrzeug nicht hinterlegt')} · ${team.starts} Starts</small></div><div class="driver-team-item__logo">${logo}</div></div>`;
    }).join('');
  }

  function renderRecent(stats) {
    const tbody = byId('driver-profile-recent');
    if (!stats.recent.length) {
      tbody.innerHTML = '<tr><td colspan="6">Noch keine Rennen vorhanden.</td></tr>';
      return;
    }
    tbody.innerHTML = stats.recent.map((entry) => {
      const finish = window.RCCDriverStats.validPosition(entry.row.finish_position);
      const grid = window.RCCDriverStats.validPosition(entry.row.grid_position);
      const gain = Number.isFinite(entry.gain) ? `${entry.gain > 0 ? '+' : ''}${entry.gain}` : '—';
      return `<tr>
        <td><a href="${scopedHref('rennen-detail.html', { round: entry.race.round_number, season: entry.race.season_id })}">${esc(entry.race.grand_prix_name || `Runde ${entry.race.round_number}`)}</a></td>
        <td>${esc(entry.season?.name || '—')}</td><td>${grid ? `P${grid}` : '—'}</td><td>${finish ? `P${finish}` : 'DNF'}</td><td>${gain}</td><td><strong>${formatPoints(entry.points)}</strong></td>
      </tr>`;
    }).join('');
  }

  function render() {
    const stats = window.RCCDriverStats.calculateDriverStats(state.driverId, state.history, { seasonId: state.seasonId || null });
    if (!stats) throw new Error('Fahrer konnte nicht gefunden werden.');
    renderHero(stats);
    renderStats(stats);
    renderPerformance();
    renderForm(stats);
    renderSeasons(stats);
    renderTracks(stats);
    renderTeams(stats);
    renderRecent(stats);
    byId('driver-profile-loading').hidden = true;
    byId('driver-profile-error').hidden = true;
    byId('driver-profile-content').hidden = false;
    updateUrl();
    document.dispatchEvent(new CustomEvent('rcc:page-content-ready', { detail: { page: 'fahrer-profil' } }));
  }

  function bindControls() {
    byId('driver-profile-select').addEventListener('change', (event) => {
      state.driverId = event.target.value;
      render();
    });
    byId('driver-profile-season').addEventListener('change', (event) => {
      state.seasonId = event.target.value;
      render();
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    state.driverId = params.get('driver') || '';
    state.seasonId = params.get('season') || '';
    const routedProfileNumber = params.get('profile_number');
    state.profileNumber = routedProfileNumber !== null && /^\d{1,2}$/.test(routedProfileNumber)
      ? Number(routedProfileNumber)
      : null;
    try {
      state.history = await window.RCCDriverStats.loadLeagueHistory();
      if (!state.history.drivers.length) throw new Error('In dieser Liga sind noch keine Fahrer angelegt.');
      populateSelectors();
      bindControls();
      render();
    } catch (error) {
      console.error('RaceVora Fahrerprofil:', error);
      byId('driver-profile-loading').hidden = true;
      byId('driver-profile-content').hidden = true;
      const errorHost = byId('driver-profile-error');
      errorHost.hidden = false;
      errorHost.textContent = 'Das Fahrerprofil konnte nicht geladen werden. Bitte prüfe die Liga oder versuche es erneut.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
