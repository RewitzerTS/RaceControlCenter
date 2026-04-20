const RULES_LABELS = {
  ai_strength: 'KI Stärke',
  race_distance: 'Renndistanz',
  vehicle_performance: 'Fahrzeug-Performance',
  fastest_lap_point: 'Extra-Punkt für schnellste Runde',
  damage: 'Schaden',
  safety_car: 'Safety Car Wahrscheinlichkeit',
  red_flag: 'Red Flag Wahrscheinlichkeit',
  ghosting: 'Ghosting',
  assists: 'Fahrhilfen',
  qualifying: 'Qualifying'
};

const DEFAULT_FAQ_ITEMS = [
  {
    question: 'Wie melde ich mich für ein Rennen an oder ab?',
    answer: 'Bitte die Anmeldung erfolgt über eine Umfrage auf Whatsapp. Eine Abmeldung sollte spätestens fünf Minuten vor Rennbeginn ebenfalls über Whatsapp erfolgen, damit das Rennen pünktlich starten kann.'
  },
  {
    question: 'Was passiert, wenn ich kurzfristig nicht teilnehmen kann?',
    answer: 'Das ist nicht schlimm, dein Ersatzfahrer wird sich für dich ins Cockpit setzen. Die Punkte werden in der Ergebnisübersicht dann entsprechend markiert.'
  },
  {
    question: 'Wann werden Rennergebnisse und Tabellen aktualisiert?',
    answer: 'Sobald die Stewards alle Vorfälle abschließend besprochen und mögliche Konsequenzen verhängt haben.'
  },
  {
    question: 'Wo reiche ich einen Vorfall ein und welche Infos brauche ich dafür?',
    answer: 'Vorfälle reichst du als Videoclip direkt über die Whatsapp Gruppe mit dem Vermerk „bewerten“ ein.'
  },
  {
    question: 'Wo werden Entscheidungen der Rennleitung veröffentlicht?',
    answer: 'Die Entscheidungen findest du über den Kalender, indem du das entsprechende Rennen öffnest.'
  }
];

let currentDriversForCards = [];
let currentDriverFactsById = new Map();

function normalizeFaqItems(items) {
  const source = Array.isArray(items) && items.length ? items : DEFAULT_FAQ_ITEMS;
  return source
    .map((item) => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim()
    }))
    .filter((item) => item.question && item.answer);
}

function renderFaqItems(items = []) {
  const list = document.getElementById('faq-list');
  if (!list) return;

  const normalizedItems = normalizeFaqItems(items);
  if (!normalizedItems.length) {
    list.innerHTML = '<div class="notice">Noch keine FAQs hinterlegt.</div>';
    return;
  }

  list.innerHTML = normalizedItems
    .map((item, index) => `
      <details class="faq-item" ${index === 0 ? 'open' : ''}>
        <summary>${window.escapeHtml(item.question)}</summary>
        <p>${window.escapeHtml(item.answer)}</p>
      </details>
    `)
    .join('');
}


function renderRulesConfig(config = {}) {
  const target = document.getElementById('rules-config-list');
  if (!target) return;

  const rows = Object.entries(RULES_LABELS)
    .map(([key, label]) => ({ key, label, value: String(config[key] || '').trim() || 'Nicht festgelegt' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));

  target.innerHTML = `
    <div class="rules-config-grid">
      ${rows.map((row) => `
        <article class="rules-config-item">
          <span class="muted">${window.escapeHtml(row.label)}</span>
          <strong>${window.escapeHtml(row.value)}</strong>
        </article>
      `).join('')}
    </div>`;
}

function resolveDriverLogoSourceForView(driver = {}) {
  return window.resolveDriverLogoSource?.(driver)
    || window.findMatchingTeamLogoName?.([driver.car_name, driver.league_team])
    || String(driver.car_name || driver.league_team || '').trim();
}

function createEmptyDriverFacts() {
  return {
    championships: { driver: 0, constructor: 0 },
    allTime: {
      podiums: 0,
      fastestLaps: 0,
      averageStart: null,
      averageFinish: null
    },
    currentSeason: {
      podiums: 0,
      fastestLaps: 0,
      averageStart: null,
      averageFinish: null
    }
  };
}

function formatAveragePosition(value) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(2).replace('.', ',');
}

function createAverageTracker() {
  return {
    startTotal: 0,
    finishTotal: 0,
    startCount: 0,
    finishCount: 0
  };
}

function addAverageValue(tracker, startPosition, finishPosition) {
  const start = Number(startPosition);
  const finish = Number(finishPosition);

  if (Number.isFinite(start) && start > 0) {
    tracker.startTotal += start;
    tracker.startCount += 1;
  }

  if (Number.isFinite(finish) && finish > 0) {
    tracker.finishTotal += finish;
    tracker.finishCount += 1;
  }
}

function finalizeAverageTracker(tracker) {
  return {
    averageStart: tracker.startCount ? tracker.startTotal / tracker.startCount : null,
    averageFinish: tracker.finishCount ? tracker.finishTotal / tracker.finishCount : null
  };
}

function normalizeDriverNameForFacts(name) {
  return window.RCCData?.normalizeDriverName?.(name) || String(name || '').trim().toLowerCase();
}

function computeFastestLapWinnersByRace(raceResults = []) {
  const byRace = new Map();
  (raceResults || []).forEach((row) => {
    if (!byRace.has(row.race_id)) byRace.set(row.race_id, []);
    byRace.get(row.race_id).push(row);
  });

  const winnerByRace = new Map();
  byRace.forEach((rows, raceId) => {
    const winner = window.RCCData?.getFastestLapDriverId?.(rows);
    if (winner) winnerByRace.set(raceId, winner);
  });
  return winnerByRace;
}

function computeDriverFacts({
  drivers = [],
  races = [],
  raceResults = [],
  currentSeasonId = null,
  championshipHistory = []
} = {}) {
  const byDriverId = new Map((drivers || []).map((driver) => [driver.id, createEmptyDriverFacts()]));
  const racesById = new Map((races || []).map((race) => [race.id, race]));
  const fastestLapWinnerByRace = computeFastestLapWinnersByRace(raceResults);
  const allTimeAverageByDriver = new Map();
  const currentSeasonAverageByDriver = new Map();

  (raceResults || []).forEach((row) => {
    if (!row?.driver_id || !byDriverId.has(row.driver_id)) return;
    const race = racesById.get(row.race_id);
    const raceSeasonId = race?.season_id;
    const facts = byDriverId.get(row.driver_id);
    const finishPosition = Number(row.finish_position);

    if (Number.isFinite(finishPosition) && finishPosition >= 1 && finishPosition <= 3) {
      facts.allTime.podiums += 1;
      if (currentSeasonId !== null && raceSeasonId === currentSeasonId) facts.currentSeason.podiums += 1;
    }

    if (fastestLapWinnerByRace.get(row.race_id) === row.driver_id) {
      facts.allTime.fastestLaps += 1;
      if (currentSeasonId !== null && raceSeasonId === currentSeasonId) facts.currentSeason.fastestLaps += 1;
    }

    if (!allTimeAverageByDriver.has(row.driver_id)) {
      allTimeAverageByDriver.set(row.driver_id, createAverageTracker());
    }
    addAverageValue(
      allTimeAverageByDriver.get(row.driver_id),
      row.start_position,
      row.finish_position
    );

    if (currentSeasonId !== null && raceSeasonId === currentSeasonId) {
      if (!currentSeasonAverageByDriver.has(row.driver_id)) {
        currentSeasonAverageByDriver.set(row.driver_id, createAverageTracker());
      }
      addAverageValue(
        currentSeasonAverageByDriver.get(row.driver_id),
        row.start_position,
        row.finish_position
      );
    }
  });

  const driversByNormalizedName = new Map();
  (drivers || []).forEach((driver) => {
    const normalized = normalizeDriverNameForFacts(driver.display_name);
    if (!normalized) return;
    if (!driversByNormalizedName.has(normalized)) driversByNormalizedName.set(normalized, []);
    driversByNormalizedName.get(normalized).push(driver.id);
  });

  (championshipHistory || []).forEach((record) => {
    const driverChampion = String(record?.driver_champion || '').trim();
    if (driverChampion) {
      const ids = driversByNormalizedName.get(normalizeDriverNameForFacts(driverChampion)) || [];
      ids.forEach((id) => {
        const facts = byDriverId.get(id);
        if (facts) facts.championships.driver += 1;
      });
    }

    String(record?.constructor_champion_lineup || '')
      .split('&')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .map((entry) => entry.match(/^([^()]+?)(?:\s*\(([^)]+)\))?$/)?.[1] || entry)
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .forEach((name) => {
        const ids = driversByNormalizedName.get(normalizeDriverNameForFacts(name)) || [];
        ids.forEach((id) => {
          const facts = byDriverId.get(id);
          if (facts) facts.championships.constructor += 1;
        });
      });
  });

  byDriverId.forEach((facts, driverId) => {
    const allTimeAverages = finalizeAverageTracker(allTimeAverageByDriver.get(driverId) || createAverageTracker());
    const currentSeasonAverages = finalizeAverageTracker(currentSeasonAverageByDriver.get(driverId) || createAverageTracker());
    facts.allTime.averageStart = allTimeAverages.averageStart;
    facts.allTime.averageFinish = allTimeAverages.averageFinish;
    facts.currentSeason.averageStart = currentSeasonAverages.averageStart;
    facts.currentSeason.averageFinish = currentSeasonAverages.averageFinish;
  });

  return byDriverId;
}

function renderDriverFactsList(facts = createEmptyDriverFacts()) {
  const items = [];

  if (facts.championships.driver > 0) {
    items.push(`<li><strong>${facts.championships.driver}x</strong> Fahrer-WM gewonnen</li>`);
  }
  if (facts.championships.constructor > 0) {
    items.push(`<li><strong>${facts.championships.constructor}x</strong> Konstrukteurs-Titel gewonnen</li>`);
  }

  items.push(`<li>Podien gesamt: <strong>${facts.allTime.podiums}</strong></li>`);
  items.push(`<li>Schnellste Runden gesamt: <strong>${facts.allTime.fastestLaps}</strong></li>`);
  items.push(`<li>Ø Startposition gesamt: <strong>${formatAveragePosition(facts.allTime.averageStart)}</strong></li>`);
  items.push(`<li>Ø Endposition gesamt: <strong>${formatAveragePosition(facts.allTime.averageFinish)}</strong></li>`);
  items.push('<li class="driver-facts-divider" aria-hidden="true"></li>');
  items.push('<li class="driver-facts-season-label">Laufende Saison</li>');
  items.push(`<li>Podien: <strong>${facts.currentSeason.podiums}</strong></li>`);
  items.push(`<li>Schnellste Runden: <strong>${facts.currentSeason.fastestLaps}</strong></li>`);
  items.push(`<li>Ø Startposition: <strong>${formatAveragePosition(facts.currentSeason.averageStart)}</strong></li>`);
  items.push(`<li>Ø Endposition: <strong>${formatAveragePosition(facts.currentSeason.averageFinish)}</strong></li>`);

  return `<ul class="driver-facts-list">${items.join('')}</ul>`;
}

function resolveComparisonMetrics(facts = createEmptyDriverFacts()) {
  return [
    { label: 'Fahrer-WM Titel', value: facts.championships.driver || 0, invert: false },
    { label: 'Konstrukteurs-Titel', value: facts.championships.constructor || 0, invert: false },
    { label: 'Podien gesamt', value: facts.allTime.podiums || 0, invert: false },
    { label: 'Schnellste Runden gesamt', value: facts.allTime.fastestLaps || 0, invert: false },
    { label: 'Ø Startposition gesamt', value: Number.isFinite(facts.allTime.averageStart) ? facts.allTime.averageStart : null, invert: true },
    { label: 'Ø Endposition gesamt', value: Number.isFinite(facts.allTime.averageFinish) ? facts.allTime.averageFinish : null, invert: true },
    { label: 'Podien (laufende Saison)', value: facts.currentSeason.podiums || 0, invert: false },
    { label: 'Schnellste Runden (laufende Saison)', value: facts.currentSeason.fastestLaps || 0, invert: false },
    { label: 'Ø Startposition (laufende Saison)', value: Number.isFinite(facts.currentSeason.averageStart) ? facts.currentSeason.averageStart : null, invert: true },
    { label: 'Ø Endposition (laufende Saison)', value: Number.isFinite(facts.currentSeason.averageFinish) ? facts.currentSeason.averageFinish : null, invert: true }
  ];
}

function formatCompareValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  if (typeof value === 'number') return formatAveragePosition(value);
  return String(value);
}

function getMetricWinnerClass(leftValue, rightValue, invert = false) {
  const left = Number(leftValue);
  const right = Number(rightValue);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) return { left: '', right: '' };
  const leftWins = invert ? left < right : left > right;
  return {
    left: leftWins ? 'is-better' : '',
    right: leftWins ? '' : 'is-better'
  };
}

function renderDriverComparison(primaryDriver, compareDriver) {
  if (!primaryDriver || !compareDriver) return '';

  const primaryFacts = currentDriverFactsById.get(primaryDriver.id) || createEmptyDriverFacts();
  const compareFacts = currentDriverFactsById.get(compareDriver.id) || createEmptyDriverFacts();
  const primaryMetrics = resolveComparisonMetrics(primaryFacts);
  const compareMetrics = resolveComparisonMetrics(compareFacts);

  const rows = primaryMetrics.map((metric, index) => {
    const compareMetric = compareMetrics[index];
    const winnerClass = getMetricWinnerClass(metric.value, compareMetric.value, metric.invert);
    return `
      <tr>
        <td class="${winnerClass.left}">${window.escapeHtml(formatCompareValue(metric.value))}</td>
        <th scope="row">${window.escapeHtml(metric.label)}</th>
        <td class="${winnerClass.right}">${window.escapeHtml(formatCompareValue(compareMetric.value))}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="driver-compare-panel" aria-live="polite">
      <h4>Direktvergleich</h4>
      <p class="muted">${window.escapeHtml(primaryDriver.display_name || 'Fahrer A')} vs. ${window.escapeHtml(compareDriver.display_name || 'Fahrer B')}</p>
      <div class="driver-compare-table-wrap">
        <table class="driver-compare-table">
          <thead>
            <tr>
              <th>${window.escapeHtml(primaryDriver.display_name || 'Fahrer A')}</th>
              <th>Wert</th>
              <th>${window.escapeHtml(compareDriver.display_name || 'Fahrer B')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderVehiclePairs(drivers = [], driverFactsById = new Map()) {
  const list = document.getElementById('vehicle-pair-list');
  if (!list) return;
  currentDriversForCards = [...(drivers || [])];
  currentDriverFactsById = driverFactsById instanceof Map ? driverFactsById : new Map();

  if (!drivers.length) {
    list.innerHTML = '<div class="notice">Noch keine Fahrer angelegt.</div>';
    return;
  }

  const groupedByCar = new Map();
  drivers.forEach((driver) => {
    const teamName = String(driver.car_name || driver.league_team || '').trim() || 'Ohne Team';
    if (!groupedByCar.has(teamName)) groupedByCar.set(teamName, []);
    groupedByCar.get(teamName).push(driver);
  });

  const cards = [...groupedByCar.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'de', { sensitivity: 'base' }))
    .map(([teamName, members]) => {
      const sortedMembers = [...members].sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de', { sensitivity: 'base' }));
      const logoSource = members
        .map((driver) => resolveDriverLogoSourceForView(driver))
        .find(Boolean) || teamName;
      return `
        <article class="list-card driver-team-card">
          <header class="driver-team-card-head">
            <h5 class="driver-team-title-with-logo">
              ${window.createTeamLogoBadge?.(logoSource, { size: 'large', label: teamName }) || ''}
              <span class="sr-only">${window.escapeHtml(teamName)}</span>
            </h5>
            <span class="driver-team-count">${sortedMembers.length} Fahrer</span>
          </header>
          <div class="driver-team-members">
            ${sortedMembers.map((driver) => `
              <button type="button" class="driver-team-member driver-team-member-flip" data-driver-id="${window.escapeHtml(String(driver.id || ''))}" data-driver-name="${window.escapeHtml(driver.display_name || 'Unbekannt')}" aria-label="Fahrerkarte ${window.escapeHtml(driver.display_name || 'Unbekannt')} drehen">
                <span class="driver-team-member-inner">
                  <span class="driver-team-member-front">
                    <span class="driver-team-member-main">
                      <strong>${window.escapeHtml(driver.display_name || '—')}</strong>
                      <span class="muted">KI Bot: ${window.escapeHtml(driver.ai_driver_reference || '—')}</span>
                      <span class="muted">Gamertag: ${window.escapeHtml(driver.gamertag || '—')}</span>
                    </span>
                    <span class="driver-card-hint">Tippen für Facts</span>
                  </span>
                  <span class="driver-team-member-back">
                    <span class="driver-facts-heading">Fahrer Facts</span>
                    ${renderDriverFactsList(driverFactsById.get(driver.id))}
                    <span class="driver-card-hint">Erneut tippen zum Zurückdrehen</span>
                  </span>
                </span>
              </button>
            `).join('')}
          </div>
        </article>`;
    });

  list.innerHTML = cards.join('');

  list.querySelectorAll('.driver-team-member-flip').forEach((card) => {
    card.addEventListener('click', () => {
      openDriverCardModal(card.dataset.driverId || null);
    });
  });
}

function closeDriverCardModal() {
  const modal = document.getElementById('driver-card-modal');
  const modalContent = document.getElementById('driver-card-modal-content');
  if (!modal || !modalContent) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function openDriverCardModal(driverId) {
  const modal = document.getElementById('driver-card-modal');
  const modalContent = document.getElementById('driver-card-modal-content');
  const title = document.getElementById('driver-card-modal-title');
  if (!modal || !modalContent) return;

  const selectedDriver = currentDriversForCards.find((driver) => String(driver.id) === String(driverId));
  if (!selectedDriver) return;

  const currentFacts = currentDriverFactsById.get(selectedDriver.id) || createEmptyDriverFacts();
  const selectableDrivers = currentDriversForCards
    .filter((driver) => String(driver.id) !== String(selectedDriver.id))
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de', { sensitivity: 'base' }));

  modalContent.innerHTML = `
    <button type="button" class="driver-team-member driver-team-member-flip is-flipped" data-driver-id="${window.escapeHtml(String(selectedDriver.id || ''))}" data-driver-name="${window.escapeHtml(selectedDriver.display_name || 'Unbekannt')}" aria-pressed="true" aria-label="Fahrerkarte ${window.escapeHtml(selectedDriver.display_name || 'Unbekannt')}">
      <span class="driver-team-member-inner">
        <span class="driver-team-member-front">
          <span class="driver-team-member-main">
            <strong>${window.escapeHtml(selectedDriver.display_name || '—')}</strong>
            <span class="muted">KI Bot: ${window.escapeHtml(selectedDriver.ai_driver_reference || '—')}</span>
            <span class="muted">Gamertag: ${window.escapeHtml(selectedDriver.gamertag || '—')}</span>
          </span>
          <span class="driver-card-hint">Facts werden angezeigt</span>
        </span>
        <span class="driver-team-member-back">
          <span class="driver-facts-heading">Fahrer Facts</span>
          ${renderDriverFactsList(currentFacts)}
          <span class="driver-card-hint">Direktvergleich unten auswählen</span>
        </span>
      </span>
    </button>
    <section class="driver-compare-controls">
      <label for="driver-compare-select">Mit Fahrer vergleichen</label>
      <select id="driver-compare-select" class="manual-results-select">
        <option value="">Bitte wählen</option>
        ${selectableDrivers.map((driver) => `<option value="${window.escapeHtml(String(driver.id))}">${window.escapeHtml(driver.display_name || 'Unbekannt')}</option>`).join('')}
      </select>
    </section>
    <div id="driver-compare-content"></div>
  `;

  if (title) {
    title.textContent = selectedDriver.display_name ? `Fahrerkarte · ${selectedDriver.display_name}` : 'Fahrerkarte';
  }

  const compareSelect = modalContent.querySelector('#driver-compare-select');
  const compareContent = modalContent.querySelector('#driver-compare-content');
  compareSelect?.addEventListener('change', () => {
    const compareDriver = currentDriversForCards.find((driver) => String(driver.id) === String(compareSelect.value));
    compareContent.innerHTML = renderDriverComparison(selectedDriver, compareDriver);
  });

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function bindDriverCardModalEvents() {
  const modal = document.getElementById('driver-card-modal');
  if (!modal) return;

  document.getElementById('driver-card-modal-close')?.addEventListener('click', closeDriverCardModal);
  document.getElementById('driver-card-modal-backdrop')?.addEventListener('click', closeDriverCardModal);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modal.classList.contains('hidden')) return;
    closeDriverCardModal();
  });
}

function resolveReferenceRaceForCurrentAssignments(races = []) {
  const sortedRaces = [...(races || [])]
    .filter((race) => Number.isFinite(Number(race?.round_number)))
    .sort((a, b) => Number(a.round_number) - Number(b.round_number));
  if (!sortedRaces.length) return null;

  const nextRace = sortedRaces.find((race) => race.status !== 'completed');
  return nextRace || sortedRaces[sortedRaces.length - 1];
}

function resolveDriversForCurrentAssignments({ drivers = [], races = [], assignments = [] } = {}) {
  const referenceRace = resolveReferenceRaceForCurrentAssignments(races);
  if (!window.RCCDriverContext?.createAssignmentResolver) return drivers;

  if (!referenceRace) {
    const latestAssignmentByDriver = new Map();
    const getAssignmentRound = (row) => {
      const explicitRound = Number(row?.effective_round_number);
      if (Number.isFinite(explicitRound)) return explicitRound;
      if (row?.is_primary) return 0;
      return Number.MAX_SAFE_INTEGER;
    };

    [...(assignments || [])]
      .sort((left, right) => {
        const roundDiff = getAssignmentRound(left) - getAssignmentRound(right);
        if (roundDiff !== 0) return roundDiff;
        return new Date(left?.created_at || 0).getTime() - new Date(right?.created_at || 0).getTime();
      })
      .forEach((assignment) => {
        if (assignment?.driver_id) latestAssignmentByDriver.set(assignment.driver_id, assignment);
      });

    return (drivers || []).map((driver) => {
      const assignment = latestAssignmentByDriver.get(driver.id);
      if (!assignment) return driver;
      return {
        ...driver,
        car_name: assignment.car_name || driver.car_name,
        ai_driver_reference: assignment.ai_driver_reference || driver.ai_driver_reference,
        team_id: assignment.team_id || driver.team_id
      };
    });
  }

  const resolver = window.RCCDriverContext.createAssignmentResolver({
    drivers,
    races,
    assignments
  });

  return (drivers || []).map((driver) =>
    resolver.resolveDriverSnapshot(driver.id, referenceRace.id) || driver
  );
}

async function initRulesFaqPage() {
  renderRulesConfig({});
  renderFaqItems([]);
  bindDriverCardModalEvents();

  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();
    const [content, drivers, races, raceResults, seasons, assignments] = await Promise.all([
      window.RCCData.fetchLeagueContent(),
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces(),
      window.RCCData.fetchRaceResults(),
      window.RCCData.fetchSeasonHistory(100),
      window.RCCDriverContext?.fetchDriverSeasonAssignments?.({ seasonId: currentSeason?.id }) || Promise.resolve([])
    ]);
    const currentAssignmentDrivers = resolveDriversForCurrentAssignments({ drivers, races, assignments });
    const driverFactsById = computeDriverFacts({
      drivers: currentAssignmentDrivers,
      races,
      raceResults,
      currentSeasonId: currentSeason?.id ?? null,
      championshipHistory: seasons
    });

    renderRulesConfig(content.rules_config || {});
    renderFaqItems(content.faq_items || []);
    renderVehiclePairs(currentAssignmentDrivers || [], driverFactsById);
  } catch (error) {
    console.error(error);
    const list = document.getElementById('vehicle-pair-list');
    if (list) list.innerHTML = `<div class="notice notice-error">Fehler beim Laden: ${window.escapeHtml(error.message || 'Unbekannt')}</div>`;
    const faqList = document.getElementById('faq-list');
    if (faqList) faqList.innerHTML = `<div class="notice notice-error">Fehler beim Laden: ${window.escapeHtml(error.message || 'Unbekannt')}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', initRulesFaqPage);
