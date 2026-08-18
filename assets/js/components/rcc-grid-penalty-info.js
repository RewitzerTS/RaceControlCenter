(() => {
  'use strict';

  if (window.RCCGridPenaltyInfo) return;
  let observer = null;
  let refreshTimer = null;

  function ensureStyles() {
    if (document.querySelector('link[data-rcc-driver-wizard="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-driver-wizard.css';
    link.dataset.rccDriverWizard = 'true';
    document.head.appendChild(link);
  }

  async function currentSeasonRaces() {
    const season = await window.RCCData?.fetchCurrentSeason?.();
    if (!season?.id) return [];
    return window.RCCData.fetchRaces({ seasonId: season.id });
  }

  async function penaltiesForRaceIds(raceIds) {
    if (!raceIds.length) return [];
    const { data, error } = await window.supabaseClient
      .from('race_penalties')
      .select('race_id, driver_id, grid_positions, reason')
      .in('race_id', raceIds)
      .eq('penalty_type', 'grid_penalty');
    if (error) throw error;
    const rows = data || [];
    const driverIds = [...new Set(rows.map((row) => row.driver_id).filter(Boolean))];
    if (!driverIds.length) return rows;
    const { data: drivers, error: driverError } = await window.supabaseClient
      .from('drivers')
      .select('id, display_name')
      .in('id', driverIds);
    if (driverError) throw driverError;
    const names = new Map((drivers || []).map((driver) => [String(driver.id), driver.display_name]));
    return rows.map((row) => ({ ...row, driver_name: names.get(String(row.driver_id)) || 'Fahrer' }));
  }

  function infoMarkup(rows) {
    if (!rows.length) return '';
    return `<div class="rcc-grid-penalty-info"><strong>INFO · Grid-Strafe${rows.length > 1 ? 'n' : ''}</strong>${rows.map((row) => {
      const places = Math.max(1, Number(row.grid_positions || 1));
      return `<div>${window.escapeHtml?.(row.driver_name) || row.driver_name}: ${places} ${places === 1 ? 'Startplatz' : 'Startplätze'}</div>`;
    }).join('')}</div>`;
  }

  async function renderCalendar() {
    const host = document.getElementById('upcoming-races');
    if (!host || !window.RCCData || !window.supabaseClient) return;
    const races = await currentSeasonRaces();
    const upcoming = races.filter((race) => (window.getRaceLifecycleStatus?.(race) || race.status) === 'upcoming');
    const penalties = await penaltiesForRaceIds(upcoming.map((race) => race.id).filter(Boolean));
    const byRace = new Map();
    penalties.forEach((row) => {
      const key = String(row.race_id);
      if (!byRace.has(key)) byRace.set(key, []);
      byRace.get(key).push(row);
    });
    upcoming.forEach((race) => {
      const card = host.querySelector(`.race-card-link[data-race-round="${CSS.escape(String(race.round_number || ''))}"][data-race-season="${CSS.escape(String(race.season_id || ''))}"] .race-meta-stack`);
      if (!card) return;
      card.querySelector('.rcc-grid-penalty-info')?.remove();
      const rows = byRace.get(String(race.id)) || [];
      if (rows.length) card.insertAdjacentHTML('beforeend', infoMarkup(rows));
    });
  }

  async function resolveDetailRace() {
    const params = new URLSearchParams(location.search);
    const round = Number(params.get('round') || 0);
    const seasonId = String(params.get('season') || '').trim();
    if (!round) return null;
    let query = window.supabaseClient.from('races').select('id, round_number, season_id, grand_prix_name').eq('round_number', round);
    if (seasonId) query = query.eq('season_id', seasonId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function renderRaceDetail() {
    const host = document.getElementById('race-info');
    if (!host || !window.supabaseClient) return;
    const race = await resolveDetailRace();
    if (!race?.id) return;
    const rows = await penaltiesForRaceIds([race.id]);
    let block = document.getElementById('rcc-race-grid-penalties');
    if (!rows.length) {
      block?.remove();
      return;
    }
    if (!block) {
      block = document.createElement('div');
      block.id = 'rcc-race-grid-penalties';
      host.insertAdjacentElement('afterend', block);
    }
    block.innerHTML = infoMarkup(rows);
  }

  async function refresh() {
    try {
      if (document.body?.dataset.page === 'kalender') await renderCalendar();
      if (document.body?.dataset.page === 'rennen-detail') await renderRaceDetail();
    } catch (error) {
      console.warn('Grid-Strafen konnten nicht angezeigt werden.', error);
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 80);
  }

  function init() {
    const page = document.body?.dataset.page;
    if (!['kalender', 'rennen-detail'].includes(page)) return false;
    ensureStyles();
    scheduleRefresh();
    if (page === 'kalender') {
      const host = document.getElementById('upcoming-races');
      if (host) {
        observer = new MutationObserver(scheduleRefresh);
        observer.observe(host, { childList: true, subtree: true });
      }
    }
    document.addEventListener('rcc:page-content-ready', scheduleRefresh);
    return true;
  }

  window.RCCGridPenaltyInfo = { init, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();