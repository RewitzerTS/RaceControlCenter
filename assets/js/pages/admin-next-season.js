(() => {
  let initialized = false;
  let wizardPromise = null;
  let completedStateRefreshTimer = null;
  let completedStateRefreshInFlight = false;

  function installGeneratedRaceColumnSanitizer() {
    const client = window.supabaseClient;
    if (!client || client.__rccGeneratedRaceColumnsSanitized) return;

    const originalFrom = client.from.bind(client);
    client.from = (table) => {
      const builder = originalFrom(table);
      if (table !== 'races' || typeof builder?.insert !== 'function') return builder;

      const originalInsert = builder.insert.bind(builder);
      builder.insert = (payload, options) => {
        const sanitizeRow = (row) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
          const next = { ...row };
          delete next.race_order;
          return next;
        };
        const sanitized = Array.isArray(payload) ? payload.map(sanitizeRow) : sanitizeRow(payload);
        return originalInsert(sanitized, options);
      };
      return builder;
    };

    client.__rccGeneratedRaceColumnsSanitized = true;
  }

  function installFreshCurrentSeasonReader() {
    const data = window.RCCData;
    if (!data?.fetchCurrentSeason || data.__rccFreshCurrentSeasonReader) return;

    const originalFetchCurrentSeason = data.fetchCurrentSeason.bind(data);
    data.fetchCurrentSeason = (options = {}) => originalFetchCurrentSeason({
      ...options,
      forceRefresh: true,
      backgroundRefresh: false
    });
    data.__rccFreshCurrentSeasonReader = true;
  }

  function removeLegacySeasonStartControls() {
    document.getElementById('season-start-controls')?.remove();
  }

  async function refreshCompletedSeasonSummary() {
    const summary = document.getElementById('season-summary');
    if (!summary || completedStateRefreshInFlight || !window.RCCData?.fetchCurrentSeason) return;

    completedStateRefreshInFlight = true;
    try {
      const activeSeason = await window.RCCData.fetchCurrentSeason({
        forceRefresh: true,
        backgroundRefresh: false
      });
      if (activeSeason) return;

      const seasons = await window.RCCData.fetchSeasons?.({
        forceRefresh: true,
        backgroundRefresh: false
      });
      const latestSeason = Array.isArray(seasons) ? seasons[0] : null;
      if (!latestSeason || latestSeason.is_active !== false) return;

      const completedMarkup = '<strong>Aktive Saison:</strong> Abgeschlossen<br><strong>Spiel:</strong> —<br><strong>Rennen:</strong> —<br><strong>Status:</strong> abgeschlossen';
      if (summary.innerHTML !== completedMarkup) summary.innerHTML = completedMarkup;
      delete summary.dataset.gameKey;

      const activeControls = document.getElementById('season-active-controls');
      if (activeControls) activeControls.hidden = true;

      const overviewSeason = document.getElementById('admin-overview-season');
      const overviewRaces = document.getElementById('admin-overview-races');
      if (overviewSeason) overviewSeason.textContent = 'Keine aktive Saison';
      if (overviewRaces) overviewRaces.textContent = 'Saison abgeschlossen';
    } catch (error) {
      console.warn('Abgeschlossenen Saisonstatus konnte nicht aktualisiert werden.', error);
    } finally {
      completedStateRefreshInFlight = false;
    }
  }

  function scheduleCompletedSeasonSummaryRefresh(delay = 0) {
    if (completedStateRefreshTimer) window.clearTimeout(completedStateRefreshTimer);
    completedStateRefreshTimer = window.setTimeout(() => {
      completedStateRefreshTimer = null;
      refreshCompletedSeasonSummary();
    }, delay);
  }

  function installSeasonSummaryObserver() {
    const summary = document.getElementById('season-summary');
    if (!summary || summary.dataset.rccCompletedSeasonObserver === 'true') return;

    const observer = new MutationObserver(() => scheduleCompletedSeasonSummaryRefresh(20));
    observer.observe(summary, { childList: true, subtree: true, characterData: true });
    summary.dataset.rccCompletedSeasonObserver = 'true';
    scheduleCompletedSeasonSummaryRefresh();
  }

  function loadWizard() {
    installGeneratedRaceColumnSanitizer();
    installFreshCurrentSeasonReader();
    if (window.RCCSeasonCalendarWizard) return Promise.resolve(window.RCCSeasonCalendarWizard);
    if (wizardPromise) return wizardPromise;

    wizardPromise = new Promise((resolve, reject) => {
      const src = 'assets/js/components/rcc-season-calendar-wizard.js';
      const existing = document.querySelector(`script[data-rcc-dynamic-src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.RCCSeasonCalendarWizard), { once: true });
        existing.addEventListener('error', () => reject(new Error('Season-Wizard konnte nicht geladen werden.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.dataset.rccDynamicSrc = src;
      script.onload = () => {
        if (!window.RCCSeasonCalendarWizard) {
          reject(new Error('Season-Wizard wurde geladen, aber nicht initialisiert.'));
          return;
        }
        resolve(window.RCCSeasonCalendarWizard);
      };
      script.onerror = () => reject(new Error('Season-Wizard konnte nicht geladen werden.'));
      document.head.appendChild(script);
    }).finally(() => {
      wizardPromise = null;
    });

    return wizardPromise;
  }

  async function openWizard() {
    try {
      installGeneratedRaceColumnSanitizer();
      installFreshCurrentSeasonReader();
      const wizard = await loadWizard();
      wizard?.init?.();
      await wizard?.open?.();
    } catch (error) {
      console.error(error);
      window.alert?.(error.message || 'Season-Wizard konnte nicht geöffnet werden.');
    }
  }

  function ensureLauncher() {
    removeLegacySeasonStartControls();

    const seasonSummary = document.getElementById('season-summary');
    const seasonDetails = seasonSummary?.closest('details');
    if (!seasonDetails || document.getElementById('season-calendar-wizard-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'season-calendar-wizard-launcher';
    launcher.className = 'card-actions';
    launcher.innerHTML = `
      <button type="button" class="button-primary" id="open-season-calendar-wizard-btn">
        Season & Rennkalender einrichten
      </button>`;
    seasonSummary.insertAdjacentElement('afterend', launcher);

    const oldGenerator = document.getElementById('generate-season-btn');
    if (oldGenerator) oldGenerator.hidden = true;
  }

  function interceptLegacyActions(event) {
    const trigger = event.target?.closest?.(
      '#generate-season-btn, #open-season-calendar-wizard-btn'
    );
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWizard();
  }

  function installBrandingCompletionBridge() {
    const wasBrandingSetup = new URLSearchParams(window.location.search).get('onboarding') === '1';
    const brandingPanel = document.getElementById('admin-section-league-onboarding');
    if (!wasBrandingSetup || !brandingPanel) return;

    let handled = false;
    const observer = new MutationObserver(() => {
      if (handled || document.contains(brandingPanel)) return;
      const onboardingFlagStillPresent = new URLSearchParams(window.location.search).get('onboarding') === '1';
      if (onboardingFlagStillPresent) return;
      handled = true;
      observer.disconnect();
      window.setTimeout(() => openWizard(), 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (initialized) return;
    installGeneratedRaceColumnSanitizer();
    installFreshCurrentSeasonReader();
    removeLegacySeasonStartControls();
    ensureLauncher();
    installSeasonSummaryObserver();

    document.addEventListener('click', interceptLegacyActions, true);
    installBrandingCompletionBridge();

    initialized = true;
  }

  window.RCCNextSeason = { init, openWizard, refreshCompletedSeasonSummary };
})();
