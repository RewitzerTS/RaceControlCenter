(() => {
  let initialized = false;
  let originalRpc = null;

  function getVisibleStepNumber() {
    const visible = [...document.querySelectorAll('[data-onboarding-step]')]
      .find((section) => !section.hidden);
    return Number(visible?.dataset?.onboardingStep || 0);
  }

  function getDriverRows() {
    return [...document.querySelectorAll('[data-onboarding-row="driver"]')];
  }

  function getTeamRows() {
    return [...document.querySelectorAll('[data-onboarding-row="team"]')];
  }

  function isLegacySeasonOnboarding(panel) {
    return Boolean(
      panel?.querySelector('[data-onboarding-step="4"]')
      && panel.querySelector('[data-onboarding-step="5"]')
    );
  }

  function ensureRoleSelect(row) {
    if (!row || row.querySelector('[data-driver-role]')) return;
    const grid = row.querySelector('.form-grid');
    if (!grid) return;

    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `
      <label>Fahrerstatus</label>
      <select data-driver-role>
        <option value="primary" selected>Stammfahrer</option>
        <option value="reserve">Ersatzfahrer</option>
      </select>
      <small>Stammfahrer belegen einen der zwei festen Teamplätze. Ersatzfahrer können später eingesetzt werden.</small>`;
    grid.appendChild(field);

    const select = field.querySelector('[data-driver-role]');
    select?.addEventListener('change', () => updateTeamRequirement(row));
    updateTeamRequirement(row);
  }

  function updateTeamRequirement(row) {
    const role = row.querySelector('[data-driver-role]')?.value || 'primary';
    const teamSelect = row.querySelector('[data-driver-team]');
    const label = teamSelect?.closest('.field')?.querySelector('label');
    if (!teamSelect) return;

    if (role === 'primary') {
      if (label) label.textContent = 'Team (Pflicht für Stammfahrer)';
      teamSelect.setAttribute('aria-required', 'true');
    } else {
      if (label) label.textContent = 'Team (optional für Ersatzfahrer)';
      teamSelect.removeAttribute('aria-required');
    }
  }

  function decorateExistingRows() {
    getDriverRows().forEach(ensureRoleSelect);
  }

  function ensureStructureNotice() {
    const step = document.querySelector('[data-onboarding-step="4"]');
    if (!step || step.querySelector('[data-season-structure-notice]')) return;

    const notice = document.createElement('div');
    notice.className = 'notice';
    notice.dataset.seasonStructureNotice = 'true';
    notice.innerHTML = '<strong>Saisonstruktur:</strong> Bis zu 10 Teams, jeweils zwei Stammplätze. Ersatzfahrer belegen keinen festen Startplatz und können einem Team optional zugeordnet werden.';
    const heading = step.querySelector('h3');
    heading?.insertAdjacentElement('afterend', notice);
  }

  function validateSeasonStructure() {
    const panel = document.getElementById('admin-section-league-onboarding');
    if (!isLegacySeasonOnboarding(panel)) return '';

    const teams = getTeamRows()
      .map((row) => String(row.querySelector('[data-team-name]')?.value || '').trim())
      .filter(Boolean);

    if (!teams.length) return 'Bitte mindestens ein Team anlegen.';
    if (teams.length > 10) return 'Es sind maximal 10 Teams pro Saison möglich.';

    const primaryByTeam = new Map();
    let primaryCount = 0;

    for (const row of getDriverRows()) {
      const name = String(row.querySelector('[data-driver-name]')?.value || '').trim();
      if (!name) continue;
      const role = row.querySelector('[data-driver-role]')?.value || 'primary';
      const team = String(row.querySelector('[data-driver-team]')?.value || '').trim();

      if (role === 'primary') {
        primaryCount += 1;
        if (!team) return `Stammfahrer ${name} benötigt ein Team.`;
        const count = (primaryByTeam.get(team) || 0) + 1;
        primaryByTeam.set(team, count);
        if (count > 2) return `Team ${team} kann maximal zwei Stammfahrer haben.`;
      }
    }

    if (!primaryCount) return 'Bitte mindestens einen Stammfahrer anlegen.';
    return '';
  }

  function showError(message) {
    const feedback = document.getElementById('league-onboarding-feedback');
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.classList.add('notice-error');
  }

  function installValidationGuard() {
    document.addEventListener('click', (event) => {
      const panel = document.getElementById('admin-section-league-onboarding');
      if (!isLegacySeasonOnboarding(panel)) return;

      const button = event.target.closest('#onboarding-next, #onboarding-finish');
      if (!button) return;

      const step = getVisibleStepNumber();
      if (step !== 4 && button.id !== 'onboarding-finish') return;

      const error = validateSeasonStructure();
      if (!error) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (step !== 4) {
        document.querySelectorAll('[data-onboarding-step]').forEach((section) => {
          section.hidden = Number(section.dataset.onboardingStep) !== 4;
        });
      }
      showError(error);
    }, true);
  }

  function installRpcEnrichment() {
    const client = window.supabaseClient;
    if (!client || client.__rccSeasonStructureRpcPatched) return;

    originalRpc = client.rpc.bind(client);
    client.rpc = (fn, args, options) => {
      if (fn === 'complete_league_onboarding' && args?.p_payload?.drivers) {
        const roleRows = getDriverRows();
        const drivers = args.p_payload.drivers.map((driver, index) => ({
          ...driver,
          role: roleRows[index]?.querySelector('[data-driver-role]')?.value || 'primary'
        }));
        return originalRpc(fn, {
          ...args,
          p_payload: {
            ...args.p_payload,
            drivers
          }
        }, options);
      }
      return originalRpc(fn, args, options);
    };
    client.__rccSeasonStructureRpcPatched = true;
  }

  function installObserver() {
    const list = document.getElementById('onboarding-driver-list');
    if (!list) return;
    const observer = new MutationObserver(() => decorateExistingRows());
    observer.observe(list, { childList: true, subtree: true });
  }

  async function init() {
    if (initialized) return;
    const panel = document.getElementById('admin-section-league-onboarding');
    if (!isLegacySeasonOnboarding(panel)) return;

    ensureStructureNotice();
    decorateExistingRows();
    installObserver();
    installValidationGuard();
    installRpcEnrichment();
    initialized = true;
  }

  window.RCCOnboardingSeasonStructure = {
    init,
    validateSeasonStructure
  };
})();
