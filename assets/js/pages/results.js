let trendChartInstance = null;

function renderStaticResultsOverride() {
  const data = window.RCC_STATIC_RESULTS_15;
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
      <span class="results-race-head-compact">R${index + 1}</span>
    </th>
  `).join('');

  const body = sortedRows.map((row) => {
    const cells = row.points.map((value, index) => {
      const tone = row.classes?.[index] || '';
      const classes = ['results-points-cell'];
      const chips = [];
      const valueClasses = ['results-points-value'];
      if (tone === 'bot') valueClasses.push('results-points-value--bot');
      if (tone === 'player') valueClasses.push('results-points-value--fl-chip');
      if (tone === 'player') chips.push('<span class="results-cell-chip results-cell-chip--fl">FL</span>');
      return `<td class="${classes.join(' ')}"><div class="results-cell-stack"><span class="${valueClasses.join(' ')}">${value}</span>${chips.length ? `<span class="results-cell-chips">${chips.join('')}</span>` : ''}</div></td>`;
    }).join('');

    return `
      <tr>
        <td class="sticky-driver"><span class="driver-label-text">${window.escapeHtml(row.driver)}</span></td>
        ${cells}
        <td class="results-total-cell"><strong>${row.total}</strong></td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <table class="results-matrix-table">
      <thead>
        <tr>
          <th class="sticky-driver sticky-driver-head">Fahrer</th>
          ${head}
          <th class="results-total-head">Total</th>
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

  trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: '#ffffff', boxWidth: 10, usePointStyle: true, padding: 14 } } },
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

function buildMatrixData(drivers, races, raceResults, resolver) {
  const completedRaces = races.filter((race) => race.status === 'completed').sort((a, b) => Number(b.round_number || 0) - Number(a.round_number || 0));
  const raceIds = new Set(completedRaces.map((race) => race.id));
  const resultsByRace = window.RCCData.groupBy(raceResults.filter((row) => raceIds.has(row.race_id)), (row) => row.race_id);
  const fastestByRace = new Map();
  completedRaces.forEach((race) => fastestByRace.set(race.id, window.RCCData.getFastestLapDriverId(resultsByRace.get(race.id) || [])));

  const rows = drivers.map((driver) => {
    const raceCells = completedRaces.map((race) => {
      const row = (resultsByRace.get(race.id) || []).find((entry) => entry.driver_id === driver.id);
      const snapshot = resolver?.resolveDriverSnapshot(driver.id, race.id) || driver;
      const fastestDriverId = fastestByRace.get(race.id);
      const points = row ? window.RCCData.getAwardedRacePoints(row, fastestDriverId) : 0;
      return {
        points,
        isBot: String(row?.participation_status || '').toUpperCase() === 'BOT',
        hasFastestLapBonus: row?.driver_id === fastestDriverId && window.RCCData.isTopTen(row?.finish_position),
        carName: snapshot?.car_name || driver.car_name || '—'
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
      <span class="results-race-head-compact">R${race.round_number}</span>
    </th>
  `).join('');
  const body = rows.map((entry) => {
    const cells = entry.raceCells.map((cell) => {
      const classes = ['results-points-cell'];
      const chips = [];
      const valueClasses = ['results-points-value'];
      if (cell.isBot) valueClasses.push('results-points-value--bot');
      if (cell.hasFastestLapBonus) valueClasses.push('results-points-value--fl-chip');
      if (cell.hasFastestLapBonus) chips.push('<span class="results-cell-chip results-cell-chip--fl">FL</span>');
      const cellValue = `<span class="${valueClasses.join(' ')}">${cell.points}</span>`;
      return `<td class="${classes.join(' ')}" title="Auto: ${window.escapeHtml(cell.carName)}"><div class="results-cell-stack">${cellValue}${chips.length ? `<span class="results-cell-chips">${chips.join('')}</span>` : ''}</div></td>`;
    }).join('');

    return `
      <tr>
        <td class="sticky-driver"><span class="driver-label-text">${window.escapeHtml(getDriverDisplayLabel(entry.driver))}</span></td>
        ${cells}
        <td class="results-total-cell"><strong>${entry.total}</strong></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="results-matrix-table">
      <thead>
        <tr>
          <th class="sticky-driver sticky-driver-head">Fahrer</th>
          ${head}
          <th class="results-total-head">Total</th>
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
  const datasets = matrixData.rows.map((entry) => {
    let running = 0;
    const chronologicalCells = chartRaces.map((race) => entry.raceCells[raceOrder.get(race.id)]);
    const data = chronologicalCells.map((cell) => {
      running += cell?.points || 0;
      return running;
    });
    return {
      label: entry.driver.display_name,
      data,
      tension: 0.25,
      fill: false,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2
    };
  });

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
            color: '#ffffff',
            boxWidth: 10,
            usePointStyle: true,
            padding: 14
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

async function loadResultsPage() {
  const wrap = document.getElementById('results-matrix-wrap');
  const labelEl = document.getElementById('results-matrix-label');
  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();
    const [drivers, races, raceResults, assignments] = await Promise.all([
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: currentSeason?.id }),
      window.RCCData.fetchRaceResults(),
      window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: currentSeason?.id })
    ]);

    const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races, assignments });
    const matrixData = buildMatrixData(drivers, races, raceResults, resolver);
    renderMatrix(wrap, labelEl, matrixData);
    renderTrendChart(matrixData);
  } catch (error) {
    console.error(error);
    wrap.innerHTML = '<div class="notice">Fehler beim Laden der Saisonergebnisse.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (renderStaticResultsOverride()) return;
  loadResultsPage();
});
