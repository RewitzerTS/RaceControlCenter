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
    if (!panel || panel.dataset.rccWizardAdopted === 'true') return;
    ensureStylesheet();
    const shell = buildShell();
    const content = shell.querySelector('[data-rcc-wizard-content]');
    const title = shell.querySelector('#rcc-wizard-dialog-title');
    if (!content) return;

    panel.dataset.rccWizardAdopted = 'true';
    panel.classList.add('rcc-wizard-dialog__panel');
    content.replaceChildren(panel);
    if (title && options.title) title.textContent = options.title;
    shell.hidden = false;
    shell.setAttribute('aria-hidden', 'false');
    document.body.classList.add('rcc-wizard-dialog-open');

    requestAnimationFrame(() => {
      const firstInput = panel.querySelector('input:not([type="hidden"]), select, textarea, button');
      firstInput?.focus?.({ preventScroll: true });
    });
  }

  function close() {
    const shell = document.getElementById('rcc-wizard-dialog');
    if (!shell) return;
    shell.hidden = true;
    shell.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('rcc-wizard-dialog-open');
  }

  function adoptLeagueOnboarding(root = document) {
    const panel = root.querySelector?.('#admin-section-league-onboarding');
    if (!panel) return false;
    open(panel, { title: 'Liga einrichten' });
    return true;
  }

  function observeLeagueOnboarding() {
    if (adoptLeagueOnboarding()) return;
    const observer = new MutationObserver(() => {
      if (adoptLeagueOnboarding()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  ensureStylesheet();
  window.RCCWizardDialog = { open, close, adoptLeagueOnboarding, observeLeagueOnboarding };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLeagueOnboarding, { once: true });
  } else {
    observeLeagueOnboarding();
  }
})();