(() => {
  if (window.RCCWizardDialog) return;

  const ONBOARDING_DRAFT_PREFIX = 'rcc_league_onboarding_draft_v1:';

  if (document.body?.dataset.page === 'admin' && !window.RCCAdminLoginGuard) {
    const existing = document.querySelector('script[data-rcc-admin-login-guard="true"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'assets/js/components/rcc-admin-login-guard.js';
      script.dataset.rccAdminLoginGuard = 'true';
      document.head.appendChild(script);
    }
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-wizard-dialog="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-wizard-dialog.css';
    link.dataset.rccWizardDialog = 'true';
    document.head.appendChild(link);
  }

  function leagueSlug() {
    return String(
      new URLSearchParams(window.location.search).get('league')
      || window.RCCLeagueContext?.getSlug?.()
      || 'rcc'
    ).trim().toLowerCase();
  }

  function onboardingDraftKey() {
    return `${ONBOARDING_DRAFT_PREFIX}${leagueSlug()}`;
  }

  function loadOnboardingDraft() {
    try {
      const raw = window.localStorage?.getItem(onboardingDraftKey());
      if (!raw) return null;
      const draft = JSON.parse(raw);
      return draft && typeof draft === 'object' ? draft : null;
    } catch (_) {
      return null;
    }
  }

  function writeOnboardingDraft(draft) {
    try {
      window.localStorage?.setItem(onboardingDraftKey(), JSON.stringify(draft));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getVisibleOnboardingStep(panel) {
    const visible = [...panel.querySelectorAll('[data-onboarding-step]')]
      .find((section) => !section.hidden);
    return Math.max(1, Math.min(6, Number(visible?.dataset.onboardingStep || 1)));
  }

  function saveOnboardingDraft(panel, postponed = true) {
    const onboarding = window.RCCLeagueOnboarding;
    if (!panel || !onboarding?.payloadFromForm) return null;
    const draft = {
      version: 1,
      league: leagueSlug(),
      step: getVisibleOnboardingStep(panel),
      postponed: Boolean(postponed),
      updated_at: new Date().toISOString(),
      payload: onboarding.payloadFromForm()
    };
    writeOnboardingDraft(draft);
    return draft;
  }

  function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = value == null ? '' : String(value);
  }

  function restoreOnboardingDraft(panel) {
    if (!panel || panel.dataset.rccDraftRestored === 'true') return loadOnboardingDraft();
    const draft = loadOnboardingDraft();
    const payload = draft?.payload;
    if (!payload) {
      panel.dataset.rccDraftRestored = 'true';
      return draft;
    }

    const gameSelect = document.getElementById('onboarding-game');
    const knownGame = ['f1_25', 'f1_26'].includes(String(payload.game_key || ''));
    if (gameSelect) gameSelect.value = knownGame ? payload.game_key : 'other';
    setInputValue('onboarding-game-custom', knownGame ? '' : payload.game_label);
    const customGameField = document.getElementById('onboarding-custom-game-field');
    if (customGameField) customGameField.hidden = knownGame;

    setInputValue('onboarding-season-name', payload.season?.name || 'Saison 1');
    setInputValue('onboarding-season-start', payload.season?.start_date || '');
    setInputValue('onboarding-points', Array.isArray(payload.scoring?.points) ? payload.scoring.points.join(', ') : '');
    setInputValue('onboarding-fastest-lap-bonus', payload.scoring?.fastest_lap_bonus ?? 1);
    setInputValue('onboarding-fastest-lap-top-n', payload.scoring?.fastest_lap_top_n ?? 10);
    const publish = document.getElementById('onboarding-publish');
    if (publish) publish.checked = payload.publish !== false;

    const onboarding = window.RCCLeagueOnboarding;
    if (onboarding) {
      if (Array.isArray(payload.teams) && payload.teams.length) {
        panel.querySelectorAll('[data-onboarding-row="team"]').forEach((row) => row.remove());
        payload.teams.forEach((team) => onboarding.addTeam?.(team));
      }
      if (Array.isArray(payload.drivers) && payload.drivers.length) {
        panel.querySelectorAll('[data-onboarding-row="driver"]').forEach((row) => row.remove());
        payload.drivers.forEach((driver) => onboarding.addDriver?.(driver));
      }
      if (Array.isArray(payload.races) && payload.races.length) {
        panel.querySelectorAll('[data-onboarding-row="race"]').forEach((row) => row.remove());
        payload.races.forEach((race) => onboarding.addRace?.(race));
      }
    }

    panel.dataset.rccDraftRestored = 'true';

    // Advance through the existing public controls instead of duplicating the
    // onboarding module's private step state. Previous steps were validated
    // before the user could have reached the saved step.
    const targetStep = Math.max(1, Math.min(6, Number(draft.step || 1)));
    const next = document.getElementById('onboarding-next');
    for (let step = 1; step < targetStep; step += 1) {
      if (!next || next.hidden) break;
      next.click();
    }

    return draft;
  }

  function removeOnboardingQueryFlag() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('onboarding')) return;
    url.searchParams.delete('onboarding');
    window.history.replaceState({}, '', url.toString());
  }

  function setOnboardingQueryFlag() {
    const url = new URL(window.location.href);
    url.searchParams.set('onboarding', '1');
    window.history.replaceState({}, '', url.toString());
  }

  function buildShell() {
    let shell = document.getElementById('rcc-wizard-dialog');
    if (shell) return shell;
    shell = document.createElement('div');
    shell.id = 'rcc-wizard-dialog';
    shell.className = 'rcc-wizard-dialog';
    shell.hidden = true;
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
      <div class="rcc-wizard-dialog__backdrop" data-rcc-wizard-backdrop></div>
      <div class="rcc-wizard-dialog__surface" role="dialog" aria-modal="true" aria-labelledby="rcc-wizard-dialog-title">
        <header class="rcc-wizard-dialog__header">
          <div>
            <div class="eyebrow">Einrichtungsassistent</div>
            <h2 id="rcc-wizard-dialog-title" class="rcc-wizard-dialog__title">Liga einrichten</h2>
          </div>
          <button type="button" class="button-secondary rcc-wizard-dialog__header-action" data-rcc-wizard-header-action hidden></button>
        </header>
        <div class="rcc-wizard-dialog__content" data-rcc-wizard-content></div>
      </div>`;
    document.body.appendChild(shell);
    return shell;
  }

  function close() {
    const shell = document.getElementById('rcc-wizard-dialog');
    if (!shell) return;
    shell.hidden = true;
    shell.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rcc-wizard-dialog-open');
  }

  function open(panel, options = {}) {
    if (!panel) return false;
    ensureStylesheet();
    const shell = buildShell();
    const content = shell.querySelector('[data-rcc-wizard-content]');
    const title = shell.querySelector('#rcc-wizard-dialog-title');
    const headerAction = shell.querySelector('[data-rcc-wizard-header-action]');
    if (!content) return false;

    panel.dataset.rccWizardAdopted = 'true';
    panel.classList.add('rcc-wizard-dialog__panel');
    panel.hidden = false;
    if (panel.tagName === 'DETAILS') panel.open = true;
    if (panel.parentNode !== content) content.replaceChildren(panel);
    if (title && options.title) title.textContent = options.title;

    if (headerAction) {
      if (typeof options.onHeaderAction === 'function') {
        headerAction.hidden = false;
        headerAction.textContent = options.headerActionLabel || 'Schließen';
        headerAction.onclick = options.onHeaderAction;
      } else {
        headerAction.hidden = true;
        headerAction.onclick = null;
      }
    }

    shell.hidden = false;
    shell.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rcc-wizard-dialog-open');

    requestAnimationFrame(() => {
      const firstInput = panel.querySelector('input:not([type="hidden"]), select, textarea, button');
      firstInput?.focus?.({ preventScroll: true });
    });
    return true;
  }

  function ensureLeagueCreateLauncher(root = document) {
    const panel = root.querySelector?.('#admin-section-create-league');
    if (!panel) return false;
    if (document.getElementById('admin-create-league-launcher')) return true;

    panel.hidden = true;
    const launcher = document.createElement('section');
    launcher.id = 'admin-create-league-launcher';
    launcher.className = 'container admin-session-banner';
    launcher.innerHTML = `
      <div>
        <strong>Ligaverwaltung</strong>
        <span class="muted">Eine weitere Rennliga auf RCC anlegen und anschließend Schritt für Schritt einrichten.</span>
      </div>
      <button type="button" class="button-primary" data-rcc-create-league>Neue Liga erstellen</button>`;

    const tabs = document.getElementById('admin-mobile-tabs');
    const layout = document.querySelector('.admin-layout');
    const anchor = tabs || layout;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(launcher, anchor);
    else document.body.appendChild(launcher);

    launcher.querySelector('[data-rcc-create-league]')?.addEventListener('click', () => {
      open(panel, {
        title: 'Neue Liga erstellen',
        headerActionLabel: 'Schließen',
        onHeaderAction: close
      });
    });
    return true;
  }

  function ensureOnboardingResumeLauncher(panel) {
    if (!panel) return false;
    let launcher = document.getElementById('admin-onboarding-resume-launcher');
    if (!launcher) {
      launcher = document.createElement('section');
      launcher.id = 'admin-onboarding-resume-launcher';
      launcher.className = 'container admin-session-banner admin-onboarding-resume-launcher';
      launcher.innerHTML = `
        <div>
          <strong>Ligainrichtung noch nicht abgeschlossen</strong>
          <span class="muted">Dein Zwischenstand ist auf diesem Gerät gespeichert. Du kannst die Einrichtung jederzeit fortsetzen.</span>
        </div>
        <button type="button" class="button-primary" data-rcc-resume-onboarding>Einrichtung fortsetzen</button>`;

      const createLauncher = document.getElementById('admin-create-league-launcher');
      const tabs = document.getElementById('admin-mobile-tabs');
      const anchor = createLauncher?.nextSibling || tabs;
      if (anchor?.parentNode) anchor.parentNode.insertBefore(launcher, anchor);
      else document.querySelector('main')?.prepend(launcher);
    }

    panel.hidden = true;
    launcher.querySelector('[data-rcc-resume-onboarding]')?.addEventListener('click', () => {
      const draft = loadOnboardingDraft() || {};
      writeOnboardingDraft({ ...draft, postponed: false, updated_at: new Date().toISOString() });
      setOnboardingQueryFlag();
      launcher.remove();
      openOnboardingPanel(panel);
    }, { once: true });
    return true;
  }

  function postponeOnboarding(panel) {
    saveOnboardingDraft(panel, true);
    removeOnboardingQueryFlag();
    close();
    ensureOnboardingResumeLauncher(panel);
  }

  function openOnboardingPanel(panel) {
    restoreOnboardingDraft(panel);
    return open(panel, {
      title: 'Liga einrichten',
      headerActionLabel: 'Später einrichten',
      onHeaderAction: () => postponeOnboarding(panel)
    });
  }

  function adoptLeagueOnboarding(root = document) {
    const panel = root.querySelector?.('#admin-section-league-onboarding');
    if (!panel) return false;

    const draft = restoreOnboardingDraft(panel);
    const explicitlyRequested = new URLSearchParams(window.location.search).get('onboarding') === '1';
    if (draft?.postponed && !explicitlyRequested) {
      ensureOnboardingResumeLauncher(panel);
      return true;
    }

    document.getElementById('admin-onboarding-resume-launcher')?.remove();
    return openOnboardingPanel(panel);
  }

  // Lifecycle is explicit: the league-create module calls these functions
  // immediately after creating the respective DOM surface. We intentionally do
  // not observe the whole document because moving/updating wizard content would
  // otherwise trigger the lifecycle again and can lock the page in a feedback loop.
  ensureStylesheet();
  window.RCCWizardDialog = {
    open,
    close,
    ensureLeagueCreateLauncher,
    ensureOnboardingResumeLauncher,
    adoptLeagueOnboarding,
    saveOnboardingDraft
  };
})();
