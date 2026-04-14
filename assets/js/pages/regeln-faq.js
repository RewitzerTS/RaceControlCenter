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

function renderVehiclePairs(drivers = []) {
  const list = document.getElementById('vehicle-pair-list');
  if (!list) return;

  if (!drivers.length) {
    list.innerHTML = '<div class="notice">Noch keine Fahrer angelegt.</div>';
    return;
  }

  const groupedByCar = new Map();
  drivers.forEach((driver) => {
    const carName = String(driver.car_name || '').trim() || 'Ohne Fahrzeug';
    if (!groupedByCar.has(carName)) groupedByCar.set(carName, []);
    groupedByCar.get(carName).push(driver);
  });

  const cards = [...groupedByCar.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'de', { sensitivity: 'base' }))
    .map(([carName, members]) => {
      const sortedMembers = [...members].sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'de', { sensitivity: 'base' }));
      return `
        <article class="list-card driver-team-card">
          <header class="driver-team-card-head">
            <h5>${window.escapeHtml(carName)}</h5>
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

async function initRulesFaqPage() {
  renderRulesConfig({});

  try {
    const [content, drivers] = await Promise.all([
      window.RCCData.fetchLeagueContent(),
      window.RCCData.fetchDrivers()
    ]);

    renderRulesConfig(content.rules_config || {});
    renderVehiclePairs(drivers || []);
  } catch (error) {
    console.error(error);
    const list = document.getElementById('vehicle-pair-list');
    if (list) list.innerHTML = `<div class="notice notice-error">Fehler beim Laden: ${window.escapeHtml(error.message || 'Unbekannt')}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', initRulesFaqPage);
