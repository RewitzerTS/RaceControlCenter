(() => {
  'use strict';

  if (window.RCCAdminDriverWizard) return;

  let wrapper = null;
  let feedbackObserver = null;

  function ensureStyles() {
    if (document.querySelector('link[data-rcc-driver-wizard="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-driver-wizard.css';
    link.dataset.rccDriverWizard = 'true';
    document.head.appendChild(link);
  }

  function ensureDialog() {
    if (window.RCCWizardDialog) return Promise.resolve(window.RCCWizardDialog);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/components/rcc-wizard-dialog.js';
      script.onload = () => resolve(window.RCCWizardDialog);
      script.onerror = () => reject(new Error('Fahrer-Wizard konnte nicht geladen werden.'));
      document.head.appendChild(script);
    });
  }

  function resetNativeForm() {
    document.getElementById('reset-driver-btn')?.click();
    const save = document.getElementById('save-driver-btn');
    if (save) save.textContent = 'Fahrer speichern';
  }

  function open(title = 'Fahrer anlegen', { reset = false } = {}) {
    if (!wrapper) return;
    if (reset) resetNativeForm();
    ensureDialog().then((dialog) => {
      dialog?.open?.(wrapper, {
        title,
        headerActionLabel: 'Schließen',
        onHeaderAction: () => dialog.close?.()
      });
      window.setTimeout(() => document.getElementById('driver-display-name')?.focus?.({ preventScroll: true }), 0);
    }).catch((error) => console.warn(error));
  }

  function build() {
    if (document.body?.dataset.page !== 'admin' || wrapper) return false;
    const section = document.querySelector('#admin-section-drivers > section.panel');
    const grid = section?.querySelector(':scope > .form-grid');
    const actions = [...(section?.querySelectorAll(':scope > .card-actions') || [])].find((node) => node.querySelector('#save-driver-btn'));
    const hiddenId = document.getElementById('driver-id');
    const feedback = document.getElementById('driver-feedback');
    const listHeading = section?.querySelector('.section-spacer-top');
    if (!section || !grid || !actions || !hiddenId || !feedback || !listHeading) return false;

    wrapper = document.createElement('section');
    wrapper.className = 'rcc-driver-wizard-source';
    wrapper.hidden = true;
    wrapper.dataset.rccAdminHubIgnore = 'true';

    const intro = document.createElement('div');
    intro.className = 'notice rcc-driver-wizard-intro';
    intro.textContent = 'Fahrerstammdaten anlegen oder bearbeiten. Mit „Fahrer speichern“ werden die Angaben direkt in der aktiven Liga gespeichert.';
    wrapper.appendChild(intro);
    wrapper.append(hiddenId, grid, actions, feedback);
    section.appendChild(wrapper);

    const originalHeading = section.querySelector(':scope > h3');
    if (originalHeading) originalHeading.textContent = 'Fahrer';

    const launcher = document.createElement('div');
    launcher.className = 'rcc-driver-wizard-launcher';
    launcher.innerHTML = `
      <div><strong>Fahrerstammdaten</strong><span>Neue Fahrer werden in einem kompakten Dialog angelegt.</span></div>
      <button type="button" class="button-primary" id="rcc-driver-create-btn">Fahrer anlegen</button>`;
    section.insertBefore(launcher, listHeading);
    launcher.querySelector('#rcc-driver-create-btn')?.addEventListener('click', () => open('Fahrer anlegen', { reset: true }));

    const reset = document.getElementById('reset-driver-btn');
    if (reset) {
      reset.textContent = 'Abbrechen';
      reset.addEventListener('click', () => window.setTimeout(() => window.RCCWizardDialog?.close?.(), 0));
    }

    document.addEventListener('click', (event) => {
      const edit = event.target.closest('.edit-driver-btn');
      if (!edit) return;
      window.setTimeout(() => {
        const name = edit.dataset.displayName || document.getElementById('driver-display-name')?.value || 'Fahrer';
        open(`Fahrer bearbeiten · ${name}`);
      }, 0);
    });

    feedbackObserver = new MutationObserver(() => {
      const text = String(feedback.textContent || '');
      if (!feedback.hidden && /erfolgreich (gespeichert|aktualisiert)/i.test(text)) {
        window.setTimeout(() => window.RCCWizardDialog?.close?.(), 450);
      }
    });
    feedbackObserver.observe(feedback, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    return true;
  }

  function init() {
    ensureStyles();
    if (build()) return true;
    const observer = new MutationObserver(() => {
      if (build()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 6000);
    return false;
  }

  window.RCCAdminDriverWizard = { init, open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();