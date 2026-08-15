(() => {
  if (window.RCCWizardDialog) return;

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-wizard-dialog="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-wizard-dialog.css';
    link.dataset.rccWizardDialog = 'true';
    document.head.appendChild(link);
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
        </header>
        <div class="rcc-wizard-dialog__content" data-rcc-wizard-content></div>
      </div>`;
    document.body.appendChild(shell);
    return shell;
  }

  function open(panel, options = {}) {
    if (!panel) return false;
    ensureStylesheet();
    const shell = buildShell();
    const content = shell.querySelector('[data-rcc-wizard-content]');
    const title = shell.querySelector('#rcc-wizard-dialog-title');
    if (!content) return false;

    panel.dataset.rccWizardAdopted = 'true';
    panel.classList.add('rcc-wizard-dialog__panel');
    panel.hidden = false;
    if (panel.tagName === 'DETAILS') panel.open = true;
    if (panel.parentNode !== content) content.replaceChildren(panel);
    if (title && options.title) title.textContent = options.title;
    shell.hidden = false;
    shell.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rcc-wizard-dialog-open');

    requestAnimationFrame(() => {
      const firstInput = panel.querySelector('input:not([type="hidden"]), select, textarea, button');
      firstInput?.focus?.({ preventScroll: true });
    });
    return true;
  }

  function close() {
    const shell = document.getElementById('rcc-wizard-dialog');
    if (!shell) return;
    shell.hidden = true;
    shell.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rcc-wizard-dialog-open');
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
      open(panel, { title: 'Neue Liga erstellen' });
    });
    return true;
  }

  function adoptLeagueOnboarding(root = document) {
    const panel = root.querySelector?.('#admin-section-league-onboarding');
    if (!panel) return false;
    return open(panel, { title: 'Liga einrichten' });
  }

  // Lifecycle is explicit: the league-create module calls these functions
  // immediately after creating the respective DOM surface. We intentionally do
  // not observe the whole document because moving/updating wizard content would
  // otherwise trigger the lifecycle again and can lock the page in a feedback loop.
  ensureStylesheet();
  window.RCCWizardDialog = { open, close, ensureLeagueCreateLauncher, adoptLeagueOnboarding };
})();
