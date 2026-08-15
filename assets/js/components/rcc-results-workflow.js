(() => {
  if (window.RCCResultsWorkflow) return;

  let manualModulePromise = null;

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-results-workflow="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-results-workflow.css';
    link.dataset.rccResultsWorkflow = 'true';
    document.head.appendChild(link);
  }

  function loadManualModule() {
    if (window.RCCManualResultsEntry) return Promise.resolve(window.RCCManualResultsEntry);
    if (manualModulePromise) return manualModulePromise;
    manualModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/components/rcc-manual-results-entry.js';
      script.onload = () => resolve(window.RCCManualResultsEntry);
      script.onerror = () => reject(new Error('Manuelle Ergebniseingabe konnte nicht geladen werden.'));
      document.head.appendChild(script);
    }).finally(() => { manualModulePromise = null; });
    return manualModulePromise;
  }

  function getPanels(root) {
    const section = root.querySelector?.('#admin-section-results');
    if (!section) return null;
    const panels = [...section.children].filter((node) => node.tagName === 'DETAILS');
    return {
      section,
      legacyCsvPanel: panels.find((panel) => panel.querySelector('#csv-file')) || null,
      publishPanel: panels.find((panel) => panel.querySelector('#publish-workflow-list')) || null,
      manualPanel: panels.find((panel) => panel.querySelector('#manual-results-panel')) || null
    };
  }

  function openPanel(panel, title) {
    if (!panel || !window.RCCWizardDialog?.open) return;
    panel.classList.add('rcc-results-workflow-panel');
    window.RCCWizardDialog.open(panel, {
      title,
      headerActionLabel: 'Schließen',
      onHeaderAction: () => window.RCCWizardDialog.close?.()
    });
  }

  function showAiImportUnavailable() {
    let panel = document.getElementById('rcc-ai-results-import-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'rcc-ai-results-import-panel';
      panel.className = 'panel admin-panel-wide admin-panel-accent';
      panel.innerHTML = `
        <div class="notice notice-error">
          Der frühere KI-Bildimport ist im aktuell ausgelieferten Frontend nicht enthalten. Die alte CSV-Eingabe wird hier bewusst nicht mehr als Ersatz geöffnet.
        </div>
        <p class="muted">Sobald die vorhandene KI-Edge-Function wieder angebunden ist, werden hier Rennbilder hochgeladen und anschließend als editierbare, bereits gemappte Ergebnistabelle angezeigt.</p>`;
      document.body.appendChild(panel);
    }
    openPanel(panel, 'KI-Bildimport');
  }

  async function openManualEntry(manualPanel) {
    try {
      const manualModule = await loadManualModule();
      manualModule?.mount?.(manualPanel);
      openPanel(manualPanel, 'Ergebnis manuell eingeben');
    } catch (error) {
      console.error(error);
      openPanel(manualPanel, 'Ergebnis manuell eingeben');
    }
  }

  function ensureLauncher(root = document) {
    const found = getPanels(root);
    if (!found) return false;
    const { section, legacyCsvPanel, publishPanel, manualPanel } = found;
    if (!publishPanel || !manualPanel) return false;
    if (section.querySelector('#admin-results-workflow-launcher')) return true;

    [legacyCsvPanel, publishPanel, manualPanel].filter(Boolean).forEach((panel) => {
      panel.hidden = true;
    });

    const launcher = document.createElement('section');
    launcher.id = 'admin-results-workflow-launcher';
    launcher.className = 'rcc-results-workflow';
    launcher.innerHTML = `
      <div class="rcc-results-workflow__intro">
        <div>
          <span class="eyebrow">Rennergebnis</span>
          <h3>Wie möchtest du das Ergebnis erfassen?</h3>
          <p class="muted">Beide Erfassungswege erzeugen zunächst einen Entwurf. Erst nach den Steward-Entscheidungen wird das Ergebnis final veröffentlicht.</p>
        </div>
      </div>
      <div class="rcc-results-workflow__grid">
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">◫</div>
          <div>
            <h4>KI-Bildimport</h4>
            <p>Rennbilder hochladen, automatisch auslesen und anschließend die bereits gemappte Tabelle kontrollieren und bearbeiten.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="ai">KI-Import öffnen</button>
        </article>
        <article class="rcc-results-workflow__card">
          <div class="rcc-results-workflow__icon" aria-hidden="true">✎</div>
          <div>
            <h4>Manuelle Eingabe</h4>
            <p>Rennen auswählen und Position, Fahrer, Grid, Stopps sowie Renn- und Rundenzeiten in einer leeren Tabelle erfassen.</p>
          </div>
          <button type="button" class="button-primary" data-rcc-results-action="manual">Manuell eingeben</button>
        </article>
        <article class="rcc-results-workflow__card rcc-results-workflow__card--secondary">
          <div class="rcc-results-workflow__icon" aria-hidden="true">✓</div>
          <div>
            <h4>Entwürfe & Freigabe</h4>
            <p>Zwischengespeicherte Rennergebnisse prüfen und nach den Steward-Entscheidungen final veröffentlichen.</p>
          </div>
          <button type="button" class="button-secondary" data-rcc-results-action="publish">Freigabe öffnen</button>
        </article>
      </div>`;

    const summary = [...section.children].find((node) => node.tagName === 'SUMMARY');
    if (summary?.nextSibling) section.insertBefore(launcher, summary.nextSibling);
    else section.appendChild(launcher);

    launcher.querySelector('[data-rcc-results-action="ai"]')?.addEventListener('click', () => {
      if (typeof window.RCCAIResultsImport?.open === 'function') {
        window.RCCAIResultsImport.open();
        return;
      }
      showAiImportUnavailable();
    });
    launcher.querySelector('[data-rcc-results-action="manual"]')?.addEventListener('click', () => openManualEntry(manualPanel));
    launcher.querySelector('[data-rcc-results-action="publish"]')?.addEventListener('click', () => openPanel(publishPanel, 'Entwürfe & Freigabe'));
    return true;
  }

  ensureStylesheet();
  window.RCCResultsWorkflow = { ensureLauncher };
})();
