let trendChartInstance = null;
let trendFocusMode = 'leaders';
let trendFocusMatrixData = null;
let trendFocusOwnDriverId = '';
let trendFocusCompareKeys = [];
let trendFocusBreakpointBound = false;

function getTrendRowKey(entry, index = 0) {
  return String(entry?.driver?.id || entry?.id || entry?.driver || `row-${index}`);
}

function getTrendLeaderCount(compact = false) {
  return compact ? 3 : 5;
}

function selectTrendFocusKeys(rows = [], options = {}) {
  const compact = options.compact === true;
  const mode = options.mode || 'leaders';
  const ownDriverId = String(options.ownDriverId || '');
  const rowKeys = rows.map((entry, index) => getTrendRowKey(entry, index));
  const validKeys = new Set(rowKeys);
  const selected = new Set();

  if (mode === 'own') {
    if (validKeys.has(ownDriverId)) selected.add(ownDriverId);
  } else if (mode === 'compare') {
    if (validKeys.has(ownDriverId)) selected.add(ownDriverId);
    (options.compareKeys || []).slice(0, 2).forEach((key) => {
      const normalized = String(key || '');
      if (validKeys.has(normalized)) selected.add(normalized);
    });
  } else {
    rowKeys.slice(0, getTrendLeaderCount(compact)).forEach((key) => selected.add(key));
    if (validKeys.has(ownDriverId)) selected.add(ownDriverId);
  }

  if (!selected.size) {
    rowKeys.slice(0, getTrendLeaderCount(compact)).forEach((key) => selected.add(key));
  }

  return [...selected];
}

async function fetchOwnDriverId(drivers = []) {
  if (!window.supabaseClient) return '';
  const availableDriverIds = new Set(drivers.map((driver) => String(driver.id || '')).filter(Boolean));

  try {
    const identityResponse = await window.supabaseClient
      .from('driver_identities')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (identityResponse.error || !identityResponse.data?.id) return '';

    const linksResponse = await window.supabaseClient
      .from('driver_identity_links')
      .select('driver_id')
      .eq('driver_identity_id', identityResponse.data.id);
    if (linksResponse.error) return '';

    const ownLink = (linksResponse.data || []).find((link) => availableDriverIds.has(String(link.driver_id || '')));
    return ownLink ? String(ownLink.driver_id) : '';
  } catch (_error) {
    return '';
  }
}

function trendFocusIsCompact() {
  return window.matchMedia?.('(max-width: 700px)').matches === true;
}

function getTrendFocusDriverLabel(key) {
  const rows = trendFocusMatrixData?.rows || [];
  const index = rows.findIndex((entry, entryIndex) => getTrendRowKey(entry, entryIndex) === String(key || ''));
  return index >= 0 ? rows[index].driver?.display_name || String(rows[index].driver || '') : '';
}

function updateTrendFocusControls(visibleKeys) {
  const buttons = [...document.querySelectorAll('[data-results-focus-mode]')];
  const compareFields = document.getElementById('results-chart-compare-fields');
  const ownButton = document.querySelector('[data-results-focus-mode="own"]');
  const status = document.getElementById('results-chart-focus-status');
  const ownAvailable = Boolean(trendFocusOwnDriverId);

  if (ownButton) {
    ownButton.disabled = !ownAvailable;
    ownButton.title = ownAvailable ? '' : 'Für dieses Konto ist in der aktiven Liga kein Fahrerprofil verknüpft.';
  }

  buttons.forEach((button) => {
    const active = button.dataset.resultsFocusMode === trendFocusMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (compareFields) compareFields.hidden = trendFocusMode !== 'compare';

  if (!status) return;
  if (trendFocusMode === 'own') {
    status.textContent = getTrendFocusDriverLabel(trendFocusOwnDriverId) || 'Kein Fahrerprofil verknüpft';
    return;
  }
  if (trendFocusMode === 'compare') {
    const names = visibleKeys.map(getTrendFocusDriverLabel).filter(Boolean);
    status.textContent = names.length ? names.join(' · ') : 'Vergleichsfahrer auswählen';
    return;
  }

  const leaderCount = Math.min(getTrendLeaderCount(trendFocusIsCompact()), trendFocusMatrixData?.rows?.length || 0);
  const ownOutsideLeaders = trendFocusOwnDriverId
    && !trendFocusMatrixData.rows.slice(0, leaderCount).some((entry, index) => getTrendRowKey(entry, index) === trendFocusOwnDriverId);
  status.textContent = `Top ${leaderCount}${ownOutsideLeaders ? ' + Mein Fahrer' : ''}`;
}

function applyTrendFocus() {
  if (!trendChartInstance || !trendFocusMatrixData) return;
  const visibleKeys = selectTrendFocusKeys(trendFocusMatrixData.rows, {
    mode: trendFocusMode,
    ownDriverId: trendFocusOwnDriverId,
    compareKeys: trendFocusCompareKeys,
    compact: trendFocusIsCompact()
  });
  const visibleSet = new Set(visibleKeys);

  trendChartInstance.data.datasets.forEach((dataset) => {
    dataset.hidden = !visibleSet.has(String(dataset.rccFocusKey || ''));
  });
  trendChartInstance.update('none');
  updateTrendFocusControls(visibleKeys);
  document.dispatchEvent(new CustomEvent('rcc:results-focus-change'));
}

function syncTrendCompareOptions() {
  const selectA = document.getElementById('results-chart-compare-a');
  const selectB = document.getElementById('results-chart-compare-b');
  if (!selectA || !selectB) return;

  [...selectA.options].forEach((option) => {
    option.disabled = Boolean(option.value && option.value === selectB.value);
  });
  [...selectB.options].forEach((option) => {
    option.disabled = Boolean(option.value && option.value === selectA.value);
  });
}

function setupTrendFocus(matrixData, ownDriverId = '') {
  trendFocusMatrixData = matrixData;
  trendFocusOwnDriverId = String(ownDriverId || '');
  trendFocusMode = 'leaders';

  // Apply the useful default immediately. Building the optional comparison
  // controls must never leave the chart in a permanent loading state.
  applyTrendFocus();

  const rows = matrixData.rows || [];
  const candidates = rows
    .map((entry, index) => getTrendRowKey(entry, index))
    .filter((key) => key !== trendFocusOwnDriverId);
  trendFocusCompareKeys = candidates.slice(0, 2);

  const optionsMarkup = `
    <option value="">Fahrer wählen</option>
    ${rows.map((entry, index) => {
      const key = getTrendRowKey(entry, index);
      const label = entry.driver?.display_name || String(entry.driver || 'Unbekannt');
      return `<option value="${window.escapeHtml(key)}">P${index + 1} · ${window.escapeHtml(label)}</option>`;
    }).join('')}
  `;
  const selectA = document.getElementById('results-chart-compare-a');
  const selectB = document.getElementById('results-chart-compare-b');
  if (selectA) {
    selectA.innerHTML = optionsMarkup;
    selectA.value = trendFocusCompareKeys[0] || '';
  }
  if (selectB) {
    selectB.innerHTML = optionsMarkup;
    selectB.value = trendFocusCompareKeys[1] || '';
  }
  syncTrendCompareOptions();

  document.querySelectorAll('[data-results-focus-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.resultsFocusMode || 'leaders';
      if (nextMode === 'own' && !trendFocusOwnDriverId) return;
      trendFocusMode = nextMode;
      applyTrendFocus();
    });
  });

  [selectA, selectB].filter(Boolean).forEach((select) => {
    select.addEventListener('change', () => {
      trendFocusCompareKeys = [selectA?.value || '', selectB?.value || ''].filter(Boolean);
      syncTrendCompareOptions();
      applyTrendFocus();
    });
  });

  if (!trendFocusBreakpointBound && window.matchMedia) {
    const mediaQuery = window.matchMedia('(max-width: 700px)');
    mediaQuery.addEventListener?.('change', () => {
      if (trendFocusMode === 'leaders') applyTrendFocus();
    });
    trendFocusBreakpointBound = true;
  }

  applyTrendFocus();
}

function updateTrendFocusOwnDriver(ownDriverId = '') {
  if (!trendFocusMatrixData) return;
  trendFocusOwnDriverId = String(ownDriverId || '');
  applyTrendFocus();
}

function getRaceFlagFromCountryCode(countryCode) {
  const emoji = window.getFlagEmoji?.(countryCode);
  if (!emoji || emoji === '🏁') return '';
  return emoji;
}

function getCompactLabelForStaticRace(raceName, fallbackRoundLabel) {
  const track = window.findTrackByGrandPrixName?.(raceName);
  const flag = getRaceFlagFromCountryCode(track?.countryCode);
  return flag || fallbackRoundLabel;
}

function getCompactLabelForRace(race) {
  const track = window.findTrackByRace?.(race);
  const flag = getRaceFlagFromCountryCode(track?.countryCode || race?.country_code);
  return flag || `R${race.round_number}`;
}

function renderStaticResultsOverride() {
  const data = window.RCC_STATIC_RESULTS_14;
  if (!data) return false;
  const wrap = document.getElementById('results-matrix-wrap');
  const labelEl = document.getElementById('results-matrix-label');
  if (!wrap || !labelEl) return false;

  const sortedRows = data.rows
    .map((row) => ({ ...row, total: row.points.reduce((sum, value) => sum + value, 0) }))
    .sort((a, b) => b.total - a.total || a.driver.localeCompare(b.driver, 'de'));

  labelEl.textContent = `${data.races.length} gewertete Rennen · ${sortedRows.length} Fahrer`;

  const head = data.races.map((race, index) => `
    <th class="results-race-header" title="${window.escapeHtml(`R${index + 1} · ${race}`)}">
      <span class="results-race-head-full">${window.escapeHtml(race)}</span>
      <span class="results-race-head-compact">${getCompactLabelForStaticRace(race, `R${index + 1}`)}</span>
    </th>
  `).join('');

  const body = sortedRows.map((row) => {
    const cells = row.points.map((value, index) => {
      const tone = row.classes?.[index] || '';
      const classes = ['results-points-cell'];
      const valueClasses = ['results-points-value'];
      if (tone === 'bot') valueClasses.push('results-points-value--bot');
      if (tone === 'player') valueClasses.push('results-points-value--fl-chip');
      return `<td class="${classes.join(' ')}"><div class="results-cell-stack"><span class="${valueClasses.join(' ')}">${value}</span></div></td>`;
    }).join('');

    return `
      <tr>
        <td class="sticky-driver"><span class="driver-label-text">${window.escapeHtml(row.driver)}</span></td>
        ${cells}
        <td class="results-total-cell sticky-total"><strong>${row.total}</strong></td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <table class="results-matrix-table">
      <thead>
        <tr>
          <th class="sticky-driver sticky-driver-head">Fahrer</th>
          ${head}
          <th class="results-total-head sticky-total">Total</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;

  renderStaticTrendChart(data, sortedRows);
  return true;
}

function renderStaticTrendChart(data, rows) {
  const canvas = document.getElementById('results-trend-chart');
  if (!canvas || !window.Chart) return;
  if (trendChartInstance) trendChartInstance.destroy();

  const labels = data.races.map((_, index) => `R${index + 1}`);
  const datasets = rows.map((entry) => {
    let running = 0;
    const points = entry.points.map((value) => {
      running += value;
      return running;
    });
    return {
      label: entry.driver,
      data: points,
      tension: 0.25,
      fill: false,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2
    };
  });

  const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  const legendLabelColor = isLightTheme ? '#111111' : '#ffffff';

  trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: legendLabelColor, boxWidth: 10, usePointStyle: true, padding: 14 } } },
      scales: {
        x: { ticks: { color: '#b9c5d1' }, grid: { color: 'rgba(255,255,255,0.08)' } },
        y: { ticks: { color: '#b9c5d1' }, grid: { color: 'rgba(255,255,255,0.08)' } }
      }
    }
  });
}

function getDriverDisplayLabel(driver) {
  if (!driver) return 'Unbekannt';
  const extras = [];
  if (driver.gamertag) extras.push(driver.gamertag);
  const medalMatch = String(driver.display_name || '').match(/(🥇|🥈|🥉)$/);
  return `${driver.display_name}${extras.length ? ` / ${extras.join(' / ')}` : ''}${medalMatch ? ` ${medalMatch[1]}` : ''}`;
}

function buildMatrixData(drivers, races, raceResults, resolver, scoringRules = null) {
  const raceIdsWithResults = new Set((raceResults || []).map((row) => row.race_id).filter(Boolean));
  const completedRaces = races
    .filter((race) => race.status === 'completed' || raceIdsWithResults.has(race.id))
    .sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));
  const raceIds = new Set(completedRaces.map((race) => race.id));
  const scopedResults = (raceResults || []).filter((row) => raceIds.has(row.race_id));
  const resultsByRace = window.RCCData.groupBy(scopedResults, (row) => row.race_id);
  const fastestByRace = new Map();
  completedRaces.forEach((race) => fastestByRace.set(race.id, window.RCCData.getFastestLapDriverId(resultsByRace.get(race.id) || [])));

  const rows = drivers.map((driver) => {
    const raceCells = completedRaces.map((race) => {
      const sourceRows = resultsByRace.get(race.id) || [];
      const ownedRows = sourceRows.filter((entry) => (entry.points_owner_driver_id || entry.driver_id) === driver.id);
      const fastestDriverId = fastestByRace.get(race.id);

      if (!ownedRows.length) {
        const snapshot = resolver?.resolveDriverSnapshot(driver.id, race.id) || driver;
        return {
          points: 0,
          isBot: false,
          hasFastestLap: false,
          carName: snapshot?.car_name || driver.car_name || '—'
        };
      }

      const points = ownedRows.reduce((sum, row) => sum + window.RCCData.getAwardedRacePoints(row, fastestDriverId, scoringRules), 0);
      const sourceRow = ownedRows[0];
      const sourceSnapshot = resolver?.resolveDriverSnapshot(sourceRow.driver_id, race.id) || driver;

      return {
        points,
        isBot: ownedRows.some((row) => String(row?.participation_status || '').toUpperCase() === 'BOT'),
        hasFastestLap: ownedRows.some((row) => row?.driver_id === fastestDriverId),
        carName: sourceRow.points_car_name || sourceSnapshot?.car_name || driver.car_name || '—'
      };
    });

    const total = raceCells.reduce((sum, cell) => sum + cell.points, 0);
    return { driver, raceCells, total };
  }).sort((a, b) => b.total - a.total || a.driver.display_name.localeCompare(b.driver.display_name, 'de'));

  return { completedRaces, rows };
}

function renderMatrix(container, labelEl, matrixData) {
  const { completedRaces, rows } = matrixData;
  labelEl.textContent = `${completedRaces.length} gewertete Rennen · ${rows.length} Fahrer`;

  const head = completedRaces.map((race) => `
    <th class="results-race-header" title="${window.escapeHtml(`R${race.round_number} · ${race.grand_prix_name}`)}">
      <span class="results-race-head-full">${window.escapeHtml(race.grand_prix_name)}</span>
      <span class="results-race-head-compact">${getCompactLabelForRace(race)}</span>
    </th>
  `).join('');
  const body = rows.map((entry) => {
    const cells = entry.raceCells.map((cell) => {
      const classes = ['results-points-cell'];
      const valueClasses = ['results-points-value'];
      if (cell.isBot) valueClasses.push('results-points-value--bot');
      if (cell.hasFastestLap) valueClasses.push('results-points-value--fl-chip');
      const cellValue = `<span class="${valueClasses.join(' ')}">${cell.points}</span>`;
      return `<td class="${classes.join(' ')}" title="Auto: ${window.escapeHtml(cell.carName)}"><div class="results-cell-stack">${cellValue}</div></td>`;
    }).join('');

    return `
      <tr>
        <td class="sticky-driver"><span class="driver-label-text">${window.escapeHtml(getDriverDisplayLabel(entry.driver))}</span></td>
        ${cells}
        <td class="results-total-cell sticky-total"><strong>${entry.total}</strong></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="results-matrix-table">
      <thead>
        <tr>
          <th class="sticky-driver sticky-driver-head">Fahrer</th>
          ${head}
          <th class="results-total-head sticky-total">Total</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderTrendChart(matrixData) {
  const canvas = document.getElementById('results-trend-chart');
  if (!canvas || !window.Chart) return;
  if (trendChartInstance) trendChartInstance.destroy();

  const chartRaces = matrixData.completedRaces.slice().sort((a, b) => Number(a.round_number || 0) - Number(b.round_number || 0));
  const labels = chartRaces.map((race) => `R${race.round_number}`);
  const raceOrder = new Map(matrixData.completedRaces.map((race, index) => [race.id, index]));
  const datasets = matrixData.rows.map((entry, entryIndex) => {
    let running = 0;
    const chronologicalCells = chartRaces.map((race) => entry.raceCells[raceOrder.get(race.id)]);
    const data = chronologicalCells.map((cell) => {
      running += cell?.points || 0;
      return running;
    });
    return {
      label: entry.driver.display_name,
      rccFocusKey: getTrendRowKey(entry, entryIndex),
      rccStandingIndex: entryIndex,
      data,
      tension: 0.25,
      fill: false,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2
    };
  });

  const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  const legendLabelColor = isLightTheme ? '#111111' : '#ffffff';

  trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: legendLabelColor,
            boxWidth: 10,
            usePointStyle: true,
            padding: 14,
            filter: (item, chartData) => chartData.datasets[item.datasetIndex]?.hidden !== true
          }
        }
      },
      scales: {
        x: { ticks: { color: '#b9c5d1' }, grid: { color: 'rgba(255,255,255,0.08)' } },
        y: { ticks: { color: '#b9c5d1' }, grid: { color: 'rgba(255,255,255,0.08)' } }
      }
    }
  });
}

function renderNoActiveSeason(wrap, labelEl) {
  labelEl.textContent = 'Keine aktive Saison';
  wrap.innerHTML = '<div class="notice">Für diese Liga ist aktuell keine aktive Saison eingerichtet. Sobald eine Saison angelegt oder aktiviert wurde, erscheinen hier Ergebnisse und Punkteverläufe.</div>';
  document.querySelectorAll('.results-chart-panel').forEach((panel) => { panel.hidden = true; });
}

async function loadResultsPage() {
  const wrap = document.getElementById('results-matrix-wrap');
  const labelEl = document.getElementById('results-matrix-label');
  const notifyReady = () => document.dispatchEvent(new CustomEvent('rcc:page-content-ready', {
    detail: { page: document.body?.dataset.page || '' }
  }));

  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();
    if (!currentSeason?.id) {
      renderNoActiveSeason(wrap, labelEl);
      return;
    }

    const [drivers, races, assignments] = await Promise.all([
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: currentSeason.id }),
      window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: currentSeason.id })
    ]);
    const raceIds = (races || []).map((race) => race.id).filter(Boolean);
    const raceResults = raceIds.length ? await window.RCCData.fetchRaceResults({ raceIds }) : [];

    const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races, assignments });
    const scoringRules = window.RCCData.fastestLapScoringRules?.(currentSeason) || null;
    const matrixData = buildMatrixData(drivers, races, raceResults, resolver, scoringRules);
    renderMatrix(wrap, labelEl, matrixData);
    renderTrendChart(matrixData);
    setupTrendFocus(matrixData);

    // Identity resolution is an enhancement, not a prerequisite for the
    // chart. Slow or unavailable identity queries must not block the Top 5/3.
    void fetchOwnDriverId(drivers).then((ownDriverId) => {
      if (trendFocusMatrixData === matrixData) updateTrendFocusOwnDriver(ownDriverId);
    });
  } catch (error) {
    console.error(error);
    wrap.innerHTML = '<div class="notice">Fehler beim Laden der Saisonergebnisse.</div>';
  } finally {
    notifyReady();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadResultsPage();
});

window.RCCResultsFocusUtils = {
  getTrendLeaderCount,
  getTrendRowKey,
  selectTrendFocusKeys
};
