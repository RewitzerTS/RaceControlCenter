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

function renderVehiclePairs(drivers = []) {
  const list = document.getElementById('vehicle-pair-list');
  if (!list) return;

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
              <div class="driver-team-member">
                <div class="driver-team-member-main">
                  <strong>${window.escapeHtml(driver.display_name || '—')}</strong>
                  <span class="muted">KI Bot: ${window.escapeHtml(driver.ai_driver_reference || '—')}</span>
                  <span class="muted">Gamertag: ${window.escapeHtml(driver.gamertag || '—')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </article>`;
    });

  list.innerHTML = cards.join('');
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

  try {
    const currentSeason = await window.RCCData.fetchCurrentSeason();
    const [content, drivers, races, assignments] = await Promise.all([
      window.RCCData.fetchLeagueContent(),
      window.RCCData.fetchDrivers(),
      window.RCCData.fetchRaces({ seasonId: currentSeason?.id }),
      window.RCCDriverContext?.fetchDriverSeasonAssignments?.({ seasonId: currentSeason?.id }) || Promise.resolve([])
    ]);
    const currentAssignmentDrivers = resolveDriversForCurrentAssignments({ drivers, races, assignments });

    renderRulesConfig(content.rules_config || {});
    renderFaqItems(content.faq_items || []);
    renderVehiclePairs(currentAssignmentDrivers || []);
  } catch (error) {
    console.error(error);
    const list = document.getElementById('vehicle-pair-list');
    if (list) list.innerHTML = `<div class="notice notice-error">Fehler beim Laden: ${window.escapeHtml(error.message || 'Unbekannt')}</div>`;
    const faqList = document.getElementById('faq-list');
    if (faqList) faqList.innerHTML = `<div class="notice notice-error">Fehler beim Laden: ${window.escapeHtml(error.message || 'Unbekannt')}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', initRulesFaqPage);
